import type { 
  Loan, 
  InterestRate, 
  AmortizationSchedule, 
  InsertAmortizationSchedule,
  InsertInterestCalculation 
} from "@shared/schema";

export interface InterestCalculationResult {
  totalInterest: number;
  monthlyPayment: number;
  totalAmount: number;
  effectiveRate: number;
}

export interface AmortizationEntry {
  paymentNumber: number;
  paymentDate: Date;
  principalAmount: number;
  interestAmount: number;
  totalPayment: number;
  outstandingBalance: number;
}

export class InterestCalculator {
  /**
   * Calculate simple interest
   * Formula: I = P * R * T
   */
  static calculateSimpleInterest(
    principal: number,
    annualRate: number,
    timeInYears: number
  ): InterestCalculationResult {
    const interest = principal * (annualRate / 100) * timeInYears;
    const totalAmount = principal + interest;
    
    return {
      totalInterest: interest,
      monthlyPayment: totalAmount / (timeInYears * 12),
      totalAmount,
      effectiveRate: annualRate
    };
  }

  /**
   * Calculate compound interest
   * Formula: A = P(1 + r/n)^(nt)
   */
  static calculateCompoundInterest(
    principal: number,
    annualRate: number,
    timeInYears: number,
    compoundingFrequency: number = 12 // monthly by default
  ): InterestCalculationResult {
    const rate = annualRate / 100;
    const amount = principal * Math.pow(
      (1 + rate / compoundingFrequency), 
      compoundingFrequency * timeInYears
    );
    const interest = amount - principal;
    
    return {
      totalInterest: interest,
      monthlyPayment: amount / (timeInYears * 12),
      totalAmount: amount,
      effectiveRate: ((amount / principal) ** (1 / timeInYears) - 1) * 100
    };
  }

  /**
   * Calculate monthly payment using reducing balance method
   * Formula: PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
   */
  static calculateReducingBalancePayment(
    principal: number,
    annualRate: number,
    termInMonths: number
  ): number {
    const monthlyRate = (annualRate / 100) / 12;
    
    if (monthlyRate === 0) {
      return principal / termInMonths;
    }
    
    const numerator = monthlyRate * Math.pow(1 + monthlyRate, termInMonths);
    const denominator = Math.pow(1 + monthlyRate, termInMonths) - 1;
    
    return principal * (numerator / denominator);
  }

  /**
   * Generate complete amortization schedule
   */
  static generateAmortizationSchedule(
    loanId: number,
    principal: number,
    annualRate: number,
    termInMonths: number,
    startDate: Date = new Date(),
    paymentFrequency: 'monthly' | 'weekly' | 'quarterly' = 'monthly',
    interestType: 'simple' | 'compound' | 'reducing_balance' = 'reducing_balance',
    compoundingFrequency: string = 'monthly'
  ): InsertAmortizationSchedule[] {
    const schedule: InsertAmortizationSchedule[] = [];

    if (interestType === 'simple') {
      const timeInYears = termInMonths / 12;
      const totalInterest = principal * (annualRate / 100) * timeInYears;
      const monthlyInterest = totalInterest / termInMonths;
      const monthlyPrincipal = principal / termInMonths;
      let remainingBalance = principal;

      for (let i = 1; i <= termInMonths; i++) {
        const isLast = i === termInMonths;
        const principalPayment = isLast ? remainingBalance : Math.round(monthlyPrincipal * 100) / 100;
        remainingBalance = Math.max(0, remainingBalance - principalPayment);
        const totalPayment = principalPayment + monthlyInterest;

        const paymentDate = new Date(startDate);
        paymentDate.setMonth(paymentDate.getMonth() + i);

        schedule.push({
          loanId,
          paymentNumber: i,
          paymentDate,
          principalAmount: principalPayment.toFixed(2),
          interestAmount: monthlyInterest.toFixed(2),
          totalPayment: totalPayment.toFixed(2),
          outstandingBalance: Math.max(0, remainingBalance).toFixed(2),
          status: 'pending'
        });
      }
    } else if (interestType === 'compound') {
      let n = 12;
      if (compoundingFrequency === 'quarterly') n = 4;
      if (compoundingFrequency === 'annually') n = 1;
      const timeInYears = termInMonths / 12;
      const totalAmount = principal * Math.pow(1 + (annualRate / 100) / n, n * timeInYears);
      const totalInterest = totalAmount - principal;
      const monthlyInterest = totalInterest / termInMonths;
      const monthlyPrincipal = principal / termInMonths;
      let remainingBalance = principal;

      for (let i = 1; i <= termInMonths; i++) {
        const isLast = i === termInMonths;
        const principalPayment = isLast ? remainingBalance : Math.round(monthlyPrincipal * 100) / 100;
        remainingBalance = Math.max(0, remainingBalance - principalPayment);
        const totalPayment = principalPayment + monthlyInterest;

        const paymentDate = new Date(startDate);
        paymentDate.setMonth(paymentDate.getMonth() + i);

        schedule.push({
          loanId,
          paymentNumber: i,
          paymentDate,
          principalAmount: principalPayment.toFixed(2),
          interestAmount: monthlyInterest.toFixed(2),
          totalPayment: totalPayment.toFixed(2),
          outstandingBalance: Math.max(0, remainingBalance).toFixed(2),
          status: 'pending'
        });
      }
    } else {
      const monthlyPayment = this.calculateReducingBalancePayment(
        principal,
        annualRate,
        termInMonths
      );

      const monthlyRate = (annualRate / 100) / 12;
      let remainingBalance = principal;

      for (let i = 1; i <= termInMonths; i++) {
        const interestPayment = remainingBalance * monthlyRate;
        const principalPayment = monthlyPayment - interestPayment;
        remainingBalance -= principalPayment;

        if (i === termInMonths) {
          remainingBalance = 0;
        }

        const paymentDate = new Date(startDate);
        paymentDate.setMonth(paymentDate.getMonth() + i);

        schedule.push({
          loanId,
          paymentNumber: i,
          paymentDate,
          principalAmount: principalPayment.toFixed(2),
          interestAmount: interestPayment.toFixed(2),
          totalPayment: monthlyPayment.toFixed(2),
          outstandingBalance: Math.max(0, remainingBalance).toFixed(2),
          status: 'pending'
        });
      }
    }

    return schedule;
  }

  /**
   * Calculate interest for savings accounts
   */
  static calculateSavingsInterest(
    balance: number,
    annualRate: number,
    daysInPeriod: number,
    compoundingFrequency: 'daily' | 'monthly' | 'quarterly' | 'annually' = 'monthly'
  ): number {
    const rate = annualRate / 100;
    const periodsPerYear = {
      daily: 365,
      monthly: 12,
      quarterly: 4,
      annually: 1
    }[compoundingFrequency];
    
    const timeInYears = daysInPeriod / 365;
    const periodsInTimeframe = periodsPerYear * timeInYears;
    
    const amount = balance * Math.pow(
      (1 + rate / periodsPerYear), 
      periodsInTimeframe
    );
    
    return amount - balance;
  }

  /**
   * Calculate late fees based on overdue amount and days
   */
  static calculateLateFee(
    overdueAmount: number,
    daysOverdue: number,
    penaltyRate: number = 2 // 2% per month default
  ): number {
    const monthlyPenaltyRate = penaltyRate / 100;
    const dailyPenaltyRate = monthlyPenaltyRate / 30;
    
    return overdueAmount * dailyPenaltyRate * daysOverdue;
  }

  /**
   * Get recommended interest rate based on loan type and amount
   */
  static getRecommendedRate(
    loanType: string,
    amount: number,
    memberCreditScore?: number
  ): number {
    const baseRates: Record<string, number> = {
      'normal_loan': 12.0,
      'emergency_loan': 8.0,
      'development_loan': 10.0,
      'group_loan': 9.0,
      'asset_financing': 14.0
    };
    
    let rate = baseRates[loanType] || 12.0;
    
    // Adjust based on amount (higher amounts get slightly better rates)
    if (amount > 5000000) { // > 5M UGX
      rate -= 1.0;
    } else if (amount > 2000000) { // > 2M UGX
      rate -= 0.5;
    }
    
    // Adjust based on credit score if available
    if (memberCreditScore) {
      if (memberCreditScore > 750) {
        rate -= 1.5;
      } else if (memberCreditScore > 650) {
        rate -= 1.0;
      } else if (memberCreditScore < 500) {
        rate += 2.0;
      }
    }
    
    return Math.max(6.0, Math.min(20.0, rate)); // Cap between 6% and 20%
  }

  /**
   * Create interest calculation record
   */
  static createCalculationRecord(
    loanId: number,
    calculationType: string,
    principal: number,
    rate: number,
    time: number,
    result: number,
    formula: string,
    notes?: string
  ): InsertInterestCalculation {
    return {
      loanId,
      calculationType: calculationType as any,
      principal: principal.toFixed(2),
      rate: rate.toFixed(2),
      time: time.toFixed(4),
      calculatedInterest: result.toFixed(2),
      formula,
      notes
    };
  }
}

export default InterestCalculator;