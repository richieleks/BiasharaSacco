export type LoanInterestMethod = 'simple' | 'compound' | 'reducing_balance';

export interface ContractualLoanTerms {
  principal: number;
  annualRatePercentage: number;
  termMonths: number;
  interestMethod: LoanInterestMethod;
  compoundingFrequency?: string;
  monthlyPayment?: number;
}

export interface ContractualLoanAmounts {
  monthlyPayment: number;
  totalInterest: number;
  totalRepayable: number;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function normalizeAnnualRatePercentage(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
}

export function calculateContractualLoanAmounts(terms: ContractualLoanTerms): ContractualLoanAmounts {
  const principal = Math.max(0, Number(terms.principal) || 0);
  const termMonths = Math.max(1, Math.trunc(Number(terms.termMonths) || 1));
  const annualRatePercentage = normalizeAnnualRatePercentage(terms.annualRatePercentage);
  const annualRateDecimal = annualRatePercentage / 100;
  const timeInYears = termMonths / 12;
  let calculatedMonthlyPayment: number;

  if (terms.interestMethod === 'simple') {
    calculatedMonthlyPayment = (principal + principal * annualRateDecimal * timeInYears) / termMonths;
  } else if (terms.interestMethod === 'compound') {
    const frequencies: Record<string, number> = { monthly: 12, quarterly: 4, annually: 1 };
    const periodsPerYear = frequencies[terms.compoundingFrequency || 'monthly'] || 12;
    const total = principal * Math.pow(1 + annualRateDecimal / periodsPerYear, periodsPerYear * timeInYears);
    calculatedMonthlyPayment = total / termMonths;
  } else {
    const monthlyRate = annualRateDecimal / 12;
    calculatedMonthlyPayment = monthlyRate === 0
      ? principal / termMonths
      : principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)
        / (Math.pow(1 + monthlyRate, termMonths) - 1);
  }

  const suppliedMonthlyPayment = Number(terms.monthlyPayment);
  const monthlyPayment = Number.isFinite(suppliedMonthlyPayment) && suppliedMonthlyPayment > 0
    ? roundMoney(suppliedMonthlyPayment)
    : roundMoney(calculatedMonthlyPayment);
  const totalRepayable = roundMoney(monthlyPayment * termMonths);

  return {
    monthlyPayment,
    totalInterest: roundMoney(Math.max(0, totalRepayable - principal)),
    totalRepayable,
  };
}

export function calculateRemainingContractualBalance(totalRepayable: number, totalPaid: number): number {
  return roundMoney(Math.max(0, (Number(totalRepayable) || 0) - (Number(totalPaid) || 0)));
}

export function calculateReducingPrincipalOutstanding(
  principal: number,
  annualRatePercentage: number,
  monthlyPayment: number,
  totalPaid: number,
): number {
  const monthlyRate = normalizeAnnualRatePercentage(annualRatePercentage) / 100 / 12;
  let remainingPrincipal = Math.max(0, principal);
  let unappliedPaid = Math.max(0, totalPaid);

  while (remainingPrincipal > 0.005 && unappliedPaid > 0.005) {
    const interestDue = roundMoney(remainingPrincipal * monthlyRate);
    const installmentApplied = Math.min(monthlyPayment, unappliedPaid);
    const principalApplied = Math.max(0, installmentApplied - Math.min(installmentApplied, interestDue));
    remainingPrincipal = roundMoney(Math.max(0, remainingPrincipal - principalApplied));
    unappliedPaid = roundMoney(Math.max(0, unappliedPaid - installmentApplied));
  }

  return remainingPrincipal;
}

export function splitContractualRepayment(
  terms: ContractualLoanTerms,
  paymentAmount: number,
  currentOutstanding: number,
): { interestPortion: number; principalPortion: number; balanceReduction: number } {
  const payment = roundMoney(Math.min(Math.max(0, paymentAmount), Math.max(0, currentOutstanding)));
  const amounts = calculateContractualLoanAmounts(terms);
  let interestPortion = 0;

  if (terms.interestMethod === 'reducing_balance') {
    const totalAlreadyPaid = calculateRemainingContractualBalance(amounts.totalRepayable, currentOutstanding);
    const principalOutstanding = calculateReducingPrincipalOutstanding(
      terms.principal,
      terms.annualRatePercentage,
      amounts.monthlyPayment,
      totalAlreadyPaid,
    );
    interestPortion = Math.min(payment, roundMoney(
      principalOutstanding * normalizeAnnualRatePercentage(terms.annualRatePercentage) / 100 / 12,
    ));
  } else {
    const interestRatio = amounts.totalRepayable > 0 ? amounts.totalInterest / amounts.totalRepayable : 0;
    interestPortion = roundMoney(Math.min(payment, payment * interestRatio));
  }

  return {
    interestPortion,
    principalPortion: roundMoney(Math.max(0, payment - interestPortion)),
    balanceReduction: payment,
  };
}