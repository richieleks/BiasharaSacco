import { storage } from "./storage";
import { differenceInMonths } from "date-fns";

export interface LoanEligibilityResult {
  isEligible: boolean;
  violations: string[];
  warnings: string[];
  maxLoanAmount?: number;
}

export class BusinessRulesValidator {
  
  /**
   * BR-L001 to BR-L007: Comprehensive loan eligibility check
   */
  async checkLoanEligibility(memberId: number, requestedAmount: number): Promise<LoanEligibilityResult> {
    const violations: string[] = [];
    const warnings: string[] = [];
    
    try {
      console.log('=== BUSINESS RULES VALIDATOR ===');
      console.log('Checking eligibility for member ID:', memberId, 'amount:', requestedAmount);
      
      const member = await storage.getMember(memberId);
      console.log('Member data:', JSON.stringify(member, null, 2));
      
      if (!member) {
        console.log('Member not found, returning violations');
        return {
          isEligible: false,
          violations: ["Member not found"],
          warnings: []
        };
      }

      // BR-L001: Only fully paid up shareholders with active savings accounts
      if (!member.isPaidUp) {
        violations.push("❌ SHARE CAPITAL: Complete your share capital payments to qualify for loans. Contact the SACCO office to update your contributions.");
      }

      if (member.status !== 'active') {
        violations.push("❌ MEMBERSHIP STATUS: Your membership status must be active. Please contact the SACCO office to resolve any account issues.");
      }

      // BR-L002: Must not be defaulter on outstanding loans
      if (member.isDefaulter) {
        violations.push("❌ LOAN DEFAULTER: You have outstanding loan defaults. Clear all outstanding balances before applying for new loans.");
      }

      // BR-L003: Must not be guarantor for defaulting borrowers
      if (member.isGuarantorForDefaulter) {
        violations.push("❌ GUARANTOR LIABILITY: You are guarantor for defaulting borrowers. Resolve guarantor obligations before applying for new loans.");
      }

      // BR-L004: Must have been member for at least 3 months
      const membershipDuration = differenceInMonths(new Date(), member.membershipStartDate || member.createdAt);
      if (membershipDuration < 3) {
        const remainingMonths = Math.ceil(3 - membershipDuration);
        violations.push(`❌ MEMBERSHIP DURATION: You need ${remainingMonths} more month(s) of active membership. SACCO requires 3 months minimum membership period.`);
      }

      // BR-L005: Savings account operated for at least 3 months
      const savingsAccounts = await storage.getSavingsAccountsByMember(memberId);
      const activeSavingsAccount = savingsAccounts.find(acc => acc.status === 'active');
      
      if (!activeSavingsAccount) {
        violations.push("❌ SAVINGS ACCOUNT: You must have an active savings account. Open a savings account with the SACCO before applying for loans.");
      } else {
        const accountDuration = differenceInMonths(new Date(), activeSavingsAccount.createdAt);
        if (accountDuration < 3) {
          const remainingMonths = Math.ceil(3 - accountDuration);
          violations.push(`❌ SAVINGS DURATION: Your savings account needs ${remainingMonths} more month(s) of operation. SACCO requires 3 months minimum savings history.`);
        }
      }

      // BR-L006: Cannot have pending loan applications
      const pendingLoans = await storage.getMemberPendingLoans(memberId);
      if (pendingLoans.length > 0) {
        violations.push(`❌ PENDING APPLICATIONS: You already have ${pendingLoans.length} pending loan application(s). Wait for current applications to be processed.`);
      }

      // Calculate maximum loan amount based on BR-L010: 1:2.5 savings ratio
      let maxLoanAmount = 0;
      if (activeSavingsAccount) {
        const totalSavings = parseFloat(activeSavingsAccount.balance);
        maxLoanAmount = totalSavings * 2.5; // 1:2.5 ratio
        
        if (requestedAmount > maxLoanAmount) {
          const currentSavings = parseFloat(activeSavingsAccount.balance);
          violations.push(`❌ LOAN AMOUNT LIMIT: Your requested UGX ${requestedAmount.toLocaleString()} exceeds the maximum UGX ${maxLoanAmount.toLocaleString()}. With current savings of UGX ${currentSavings.toLocaleString()}, you can borrow up to 2.5 times your savings balance.`);
        }

        // BR-L011: Check if savings gradually built up
        if (!activeSavingsAccount.isGraduallyBuiltUp) {
          warnings.push("Large lump sum deposits may require committee discretion for loan approval");
        }
      }

      const result = {
        isEligible: violations.length === 0,
        violations,
        warnings,
        maxLoanAmount
      };
      
      console.log('=== ELIGIBILITY RESULT ===');
      console.log(JSON.stringify(result, null, 2));
      console.log('==========================');
      
      return result;

    } catch (error) {
      console.error("Error checking loan eligibility:", error);
      return {
        isEligible: false,
        violations: ["System error occurred while checking eligibility"],
        warnings: []
      };
    }
  }

  /**
   * BR-L013: Validate loan period (max 24 months)
   */
  validateLoanPeriod(termMonths: number): { isValid: boolean; message?: string } {
    if (termMonths > 24) {
      return {
        isValid: false,
        message: "Maximum loan period is 24 months"
      };
    }
    return { isValid: true };
  }

  /**
   * BR-L019: Validate guarantor eligibility
   */
  async validateGuarantor(guarantorMemberId: number, applicantMemberId: number): Promise<{ isValid: boolean; message?: string }> {
    try {
      if (guarantorMemberId === applicantMemberId) {
        return {
          isValid: false,
          message: "Members cannot guarantee themselves"
        };
      }

      const guarantor = await storage.getMember(guarantorMemberId);
      if (!guarantor) {
        return {
          isValid: false,
          message: "Guarantor member not found"
        };
      }

      if (guarantor.status !== 'active') {
        return {
          isValid: false,
          message: "Guarantor must be an active SACCO member"
        };
      }

      if (guarantor.isDefaulter) {
        return {
          isValid: false,
          message: "Guarantor cannot be a defaulter on loans"
        };
      }

      return { isValid: true };

    } catch (error) {
      console.error("Error validating guarantor:", error);
      return {
        isValid: false,
        message: "System error occurred while validating guarantor"
      };
    }
  }

  /**
   * Calculate loan amount based on share capital and savings pattern
   */
  async calculateMaxLoanAmount(memberId: number): Promise<number> {
    try {
      const member = await storage.getMember(memberId);
      const savingsAccounts = await storage.getSavingsAccountsByMember(memberId);
      
      if (!member || savingsAccounts.length === 0) {
        return 0;
      }

      const activeSavingsAccount = savingsAccounts.find(acc => acc.status === 'active');
      if (!activeSavingsAccount) {
        return 0;
      }

      const totalSavings = parseFloat(activeSavingsAccount.balance);
      const shareCapital = parseFloat(member.shareContribution || "0");
      
      // Base calculation on 1:2.5 savings ratio
      const savingsBasedAmount = totalSavings * 2.5;
      
      // Consider share capital (minimum factor)
      const shareBasedAmount = shareCapital * 5; // Conservative multiplier
      
      // Return the minimum of both calculations for conservative lending
      return Math.min(savingsBasedAmount, shareBasedAmount);

    } catch (error) {
      console.error("Error calculating max loan amount:", error);
      return 0;
    }
  }

  /**
   * Update member status based on loan performance
   */
  async updateMemberDefaultStatus(memberId: number, isDefaulter: boolean): Promise<void> {
    try {
      await storage.updateMember(memberId, { 
        isDefaulter,
        hasActiveLoans: !isDefaulter // If not defaulter and updating, assume has active loans
      });
    } catch (error) {
      console.error("Error updating member default status:", error);
    }
  }

  /**
   * Update guarantor status for defaulters
   */
  async updateGuarantorDefaultStatus(guarantorMemberId: number, isGuarantorForDefaulter: boolean): Promise<void> {
    try {
      await storage.updateMember(guarantorMemberId, { 
        isGuarantorForDefaulter 
      });
    } catch (error) {
      console.error("Error updating guarantor default status:", error);
    }
  }
}

export const businessRulesValidator = new BusinessRulesValidator();