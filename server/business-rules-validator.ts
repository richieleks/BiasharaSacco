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
      const member = await storage.getMember(memberId);
      if (!member) {
        return {
          isEligible: false,
          violations: ["Member not found"],
          warnings: []
        };
      }

      // BR-L001: Only fully paid up shareholders with active savings accounts
      if (!member.isPaidUp) {
        violations.push("Member must be fully paid up shareholder");
      }

      if (member.status !== 'active') {
        violations.push("Member must have active status");
      }

      // BR-L002: Must not be defaulter on outstanding loans
      if (member.isDefaulter) {
        violations.push("Member is currently a defaulter on outstanding loans");
      }

      // BR-L003: Must not be guarantor for defaulting borrowers
      if (member.isGuarantorForDefaulter) {
        violations.push("Member is guarantor for defaulting borrowers");
      }

      // BR-L004: Must have been member for at least 3 months
      const membershipDuration = differenceInMonths(new Date(), member.membershipStartDate || member.createdAt);
      if (membershipDuration < 3) {
        violations.push(`Member must be active for at least 3 months. Current: ${membershipDuration} months`);
      }

      // BR-L005: Savings account operated for at least 3 months
      const savingsAccounts = await storage.getSavingsAccountsByMember(memberId);
      const activeSavingsAccount = savingsAccounts.find(acc => acc.status === 'active');
      
      if (!activeSavingsAccount) {
        violations.push("Member must have an active savings account");
      } else {
        const accountDuration = differenceInMonths(new Date(), activeSavingsAccount.createdAt);
        if (accountDuration < 3) {
          violations.push(`Savings account must be operated for at least 3 months. Current: ${accountDuration} months`);
        }
      }

      // BR-L006: Cannot have pending loan applications
      const pendingLoans = await storage.getMemberPendingLoans(memberId);
      if (pendingLoans.length > 0) {
        violations.push(`Member has ${pendingLoans.length} pending loan application(s)`);
      }

      // Calculate maximum loan amount based on BR-L010: 1:2.5 savings ratio
      let maxLoanAmount = 0;
      if (activeSavingsAccount) {
        const totalSavings = parseFloat(activeSavingsAccount.balance);
        maxLoanAmount = totalSavings * 2.5; // 1:2.5 ratio
        
        if (requestedAmount > maxLoanAmount) {
          violations.push(`Requested amount (UGX ${requestedAmount.toLocaleString()}) exceeds maximum allowed (UGX ${maxLoanAmount.toLocaleString()}) based on savings ratio 1:2.5`);
        }

        // BR-L011: Check if savings gradually built up
        if (!activeSavingsAccount.isGraduallyBuiltUp) {
          warnings.push("Large lump sum deposits may require committee discretion for loan approval");
        }
      }

      return {
        isEligible: violations.length === 0,
        violations,
        warnings,
        maxLoanAmount
      };

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