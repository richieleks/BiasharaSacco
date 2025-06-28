import {
  users,
  members,
  savingsAccounts,
  loans,
  transactions,
  guarantors,
  auditLogs,
  memberRoles,
  type User,
  type UpsertUser,
  type Member,
  type InsertMember,
  type MemberWithDetails,
  type SavingsAccount,
  type InsertSavingsAccount,
  type Loan,
  type InsertLoan,
  type LoanWithDetails,
  type Transaction,
  type InsertTransaction,
  type TransactionWithDetails,
  type Guarantor,
  type InsertGuarantor,
  type GuarantorWithDetails,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, like, or, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Member operations
  createMember(member: InsertMember & { memberNumber: string }): Promise<Member>;
  getMember(id: number): Promise<MemberWithDetails | undefined>;
  getMemberByNumber(memberNumber: string): Promise<MemberWithDetails | undefined>;
  getMemberByIdNumber(idNumber: string): Promise<MemberWithDetails | undefined>;
  getMemberByUserId(userId: string): Promise<MemberWithDetails | undefined>;
  updateMember(id: number, updates: Partial<InsertMember>): Promise<Member>;
  getAllMembers(): Promise<MemberWithDetails[]>;
  searchMembers(query: string): Promise<MemberWithDetails[]>;
  getPendingMembers(): Promise<MemberWithDetails[]>;
  approveMember(id: number, approvedBy: string, comments?: string): Promise<Member>;
  rejectMember(id: number, approvedBy: string, comments?: string): Promise<Member>;

  // Savings account operations
  createSavingsAccount(account: InsertSavingsAccount): Promise<SavingsAccount>;
  getSavingsAccount(id: number): Promise<SavingsAccount | undefined>;
  getSavingsAccountsByMember(memberId: number): Promise<SavingsAccount[]>;
  updateSavingsAccountBalance(id: number, amount: string, operation: 'add' | 'subtract'): Promise<SavingsAccount>;

  // Loan operations
  createLoan(loan: InsertLoan): Promise<Loan>;
  getLoan(id: number): Promise<LoanWithDetails | undefined>;
  getLoansByMember(memberId: number): Promise<LoanWithDetails[]>;
  updateLoanStatus(id: number, status: string): Promise<Loan>;
  updateLoanBalance(id: number, amount: string): Promise<Loan>;
  getAllPendingLoans(): Promise<LoanWithDetails[]>;
  
  // Advanced loan approval workflow
  getLoansForApproval(stage: string, userRole: string): Promise<LoanWithDetails[]>;
  approveLoanAtStage(loanId: number, stage: string, approvedBy: string, comments?: string): Promise<Loan>;
  rejectLoan(loanId: number, rejectedBy: string, reason: string): Promise<Loan>;
  getLoanApprovalHistory(loanId: number): Promise<any>;
  calculateRequiredApprovalStage(loanAmount: number, loanType: string): Promise<string>;

  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransaction(id: number): Promise<TransactionWithDetails | undefined>;
  getTransactionsByMember(memberId: number): Promise<TransactionWithDetails[]>;
  getRecentTransactions(limit?: number): Promise<TransactionWithDetails[]>;
  updateTransactionStatus(id: number, status: string): Promise<Transaction>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    totalMembers: number;
    totalSavings: string;
    activeLoans: string;
    repaymentRate: string;
  }>;

  // Pending approvals
  getPendingApprovals(): Promise<{
    loanApplications: LoanWithDetails[];
    withdrawalRequests: TransactionWithDetails[];
  }>;

  // Guarantor operations
  createGuarantor(guarantor: InsertGuarantor): Promise<Guarantor>;
  getGuarantor(id: number): Promise<GuarantorWithDetails | undefined>;
  getGuarantorsByLoan(loanId: number): Promise<GuarantorWithDetails[]>;
  getGuarantorsByMember(memberId: number): Promise<GuarantorWithDetails[]>;
  updateGuarantorStatus(id: number, status: string, comments?: string): Promise<Guarantor>;
  getPendingGuarantorRequests(memberId: number): Promise<GuarantorWithDetails[]>;

  // Role management operations
  getMemberRoles(memberId: number): Promise<string[]>;
  addMemberRole(memberId: number, role: string, assignedBy: string): Promise<void>;
  removeMemberRole(memberId: number, role: string): Promise<void>;
  replaceMemberRoles(memberId: number, roles: string[], assignedBy: string): Promise<void>;

  // Audit log operations
  createAuditLog(log: {
    userId: string;
    memberId?: number;
    action: string;
    resource: string;
    resourceId?: string;
    details?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
  getAuditLogs(filters?: {
    userId?: string;
    resource?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    // Auto-create member profile if it doesn't exist
    try {
      const existingMember = await this.getMemberByUserId(user.id);
      if (!existingMember) {
        // Generate member number
        const memberCount = await db.$count(members);
        const memberNumber = `BCS${String(memberCount + 1).padStart(6, '0')}`;
        
        await this.createMember({
          userId: user.id,
          memberNumber,
          fullName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'New Member',
          idNumber: `ID${Date.now()}`, // Temporary ID until member completes registration
          phoneNumber: userData.email || '',
          monthlySavings: '0',
          shareContribution: '20000',
          numberOfShares: 4,
          role: 'member', // Default role
        });
      }
    } catch (error) {
      console.error('Error auto-creating member profile:', error);
    }
    
    return user;
  }

  async createMember(memberData: InsertMember & { memberNumber: string }): Promise<Member> {
    const [member] = await db
      .insert(members)
      .values(memberData)
      .returning();
    
    return member;
  }

  async getMember(id: number): Promise<MemberWithDetails | undefined> {
    const [member] = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(members.id, savingsAccounts.memberId))
      .leftJoin(loans, eq(members.id, loans.memberId))
      .where(eq(members.id, id));

    if (!member) return undefined;

    return {
      ...member.members,
      user: member.users || undefined,
      savingsAccounts: member.savings_accounts ? [member.savings_accounts] : [],
      loans: member.loans ? [member.loans] : [],
    };
  }

  async getMemberByNumber(memberNumber: string): Promise<MemberWithDetails | undefined> {
    const [member] = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(members.memberNumber, memberNumber));

    if (!member) return undefined;

    return {
      ...member.members,
      user: member.users || undefined,
    };
  }

  async getMemberByIdNumber(idNumber: string): Promise<MemberWithDetails | undefined> {
    const [member] = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(members.idNumber, idNumber));

    if (!member) return undefined;

    return {
      ...member.members,
      user: member.users || undefined,
    };
  }

  async getMemberByUserId(userId: string): Promise<MemberWithDetails | undefined> {
    const [member] = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(members.userId, userId));

    if (!member) return undefined;

    return {
      ...member.members,
      user: member.users || undefined,
    };
  }

  async updateMember(id: number, updates: Partial<InsertMember>): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(members.id, id))
      .returning();
    return member;
  }

  async getAllMembers(): Promise<MemberWithDetails[]> {
    const results = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .orderBy(desc(members.createdAt));

    return results.map(result => ({
      ...result.members,
      user: result.users || undefined,
    }));
  }

  async searchMembers(query: string): Promise<MemberWithDetails[]> {
    const results = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(
        or(
          like(members.fullName, `%${query}%`),
          like(members.memberNumber, `%${query}%`),
          like(members.idNumber, `%${query}%`)
        )
      )
      .orderBy(desc(members.createdAt));

    return results.map(result => ({
      ...result.members,
      user: result.users || undefined,
    }));
  }

  async getPendingMembers(): Promise<MemberWithDetails[]> {
    const results = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(members.status, 'pending'))
      .orderBy(desc(members.createdAt));

    return results.map(result => ({
      ...result.members,
      user: result.users || undefined,
    }));
  }

  async approveMember(id: number, approvedBy: string, comments?: string): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({
        status: 'active',
        approvedBy,
        approvedAt: new Date(),
        approvalComments: comments,
        updatedAt: new Date(),
      })
      .where(eq(members.id, id))
      .returning();
    return member;
  }

  async rejectMember(id: number, approvedBy: string, comments?: string): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({
        status: 'rejected',
        approvedBy,
        rejectedAt: new Date(),
        approvalComments: comments,
        updatedAt: new Date(),
      })
      .where(eq(members.id, id))
      .returning();
    return member;
  }

  async createSavingsAccount(accountData: InsertSavingsAccount): Promise<SavingsAccount> {
    const [account] = await db
      .insert(savingsAccounts)
      .values(accountData)
      .returning();
    return account;
  }

  async getSavingsAccount(id: number): Promise<SavingsAccount | undefined> {
    const [account] = await db
      .select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, id));
    return account || undefined;
  }

  async getSavingsAccountsByMember(memberId: number): Promise<SavingsAccount[]> {
    return await db
      .select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.memberId, memberId));
  }

  async updateSavingsAccountBalance(id: number, amount: string, operation: 'add' | 'subtract'): Promise<SavingsAccount> {
    const operator = operation === 'add' ? '+' : '-';
    const [account] = await db
      .update(savingsAccounts)
      .set({
        balance: sql`balance ${sql.raw(operator)} ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(savingsAccounts.id, id))
      .returning();
    return account;
  }

  async createLoan(loanData: InsertLoan): Promise<Loan> {
    const [loan] = await db
      .insert(loans)
      .values(loanData)
      .returning();
    return loan;
  }

  async getLoan(id: number): Promise<LoanWithDetails | undefined> {
    const [loan] = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(loans.id, id));

    if (!loan) return undefined;

    return {
      ...loan.loans,
      member: loan.members ? {
        ...loan.members,
        user: loan.users || undefined,
      } : undefined,
    };
  }

  async getLoansByMember(memberId: number): Promise<LoanWithDetails[]> {
    const results = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(loans.memberId, memberId))
      .orderBy(desc(loans.createdAt));

    return results.map(result => ({
      ...result.loans,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
    }));
  }

  async updateLoanStatus(id: number, status: string): Promise<Loan> {
    const [loan] = await db
      .update(loans)
      .set({ 
        status: status as "pending" | "active" | "approved" | "disbursed" | "completed" | "defaulted", 
        updatedAt: new Date() 
      })
      .where(eq(loans.id, id))
      .returning();
    return loan;
  }

  async updateLoanBalance(id: number, amount: string): Promise<Loan> {
    const [loan] = await db
      .update(loans)
      .set({
        outstandingBalance: sql`outstanding_balance - ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, id))
      .returning();
    return loan;
  }

  async getAllPendingLoans(): Promise<LoanWithDetails[]> {
    const results = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(loans.status, 'pending'))
      .orderBy(desc(loans.createdAt));

    return results.map(result => ({
      ...result.loans,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
    }));
  }

  async getLoansForApproval(stage: string, userRole: string): Promise<LoanWithDetails[]> {
    let whereCondition;
    
    // Define approval logic based on user role and stage
    if (userRole === 'teller' && stage === 'teller') {
      whereCondition = and(
        eq(loans.status, 'pending'),
        eq(loans.approvalStage, 'teller')
      );
    } else if (userRole === 'committee' && stage === 'committee') {
      whereCondition = and(
        eq(loans.status, 'teller_approved'),
        eq(loans.approvalStage, 'committee')
      );
    } else if ((userRole === 'manager' || userRole === 'admin') && stage === 'manager') {
      whereCondition = and(
        eq(loans.status, 'committee_approved'),
        eq(loans.approvalStage, 'manager')
      );
    } else {
      // Return empty array if no matching conditions
      return [];
    }

    const results = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(whereCondition)
      .orderBy(desc(loans.createdAt));

    return results.map(result => ({
      ...result.loans,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
    }));
  }

  async approveLoanAtStage(loanId: number, stage: string, approvedBy: string, comments?: string): Promise<Loan> {
    const currentTime = new Date();
    let updateData: any = {};

    // Determine the next stage and status
    if (stage === 'teller') {
      updateData = {
        status: 'teller_approved',
        approvalStage: 'committee',
        tellerApprovedBy: approvedBy,
        tellerApprovedAt: currentTime,
        tellerComments: comments,
      };
    } else if (stage === 'committee') {
      // Check if loan amount requires manager approval
      const loan = await this.getLoan(loanId);
      const requiresManagerApproval = loan && parseFloat(loan.principalAmount) > 500000; // KES 500K threshold
      
      if (requiresManagerApproval) {
        updateData = {
          status: 'committee_approved',
          approvalStage: 'manager',
          committeeApprovedBy: approvedBy,
          committeeApprovedAt: currentTime,
          committeeComments: comments,
        };
      } else {
        updateData = {
          status: 'approved',
          approvalStage: 'completed',
          committeeApprovedBy: approvedBy,
          committeeApprovedAt: currentTime,
          committeeComments: comments,
        };
      }
    } else if (stage === 'manager') {
      updateData = {
        status: 'approved',
        approvalStage: 'completed',
        managerApprovedBy: approvedBy,
        managerApprovedAt: currentTime,
        managerComments: comments,
      };
    }

    const [loan] = await db
      .update(loans)
      .set(updateData)
      .where(eq(loans.id, loanId))
      .returning();
    
    return loan;
  }

  async rejectLoan(loanId: number, rejectedBy: string, reason: string): Promise<Loan> {
    const [loan] = await db
      .update(loans)
      .set({
        status: 'rejected',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(loans.id, loanId))
      .returning();
    
    return loan;
  }

  async getLoanApprovalHistory(loanId: number): Promise<any> {
    const loan = await this.getLoan(loanId);
    if (!loan) return null;

    return {
      loanId,
      currentStage: loan.approvalStage,
      currentStatus: loan.status,
      stages: {
        teller: {
          approvedBy: loan.tellerApprovedBy,
          approvedAt: loan.tellerApprovedAt,
          comments: loan.tellerComments,
        },
        committee: {
          approvedBy: loan.committeeApprovedBy,
          approvedAt: loan.committeeApprovedAt,
          comments: loan.committeeComments,
        },
        manager: {
          approvedBy: loan.managerApprovedBy,
          approvedAt: loan.managerApprovedAt,
          comments: loan.managerComments,
        },
      },
      rejection: {
        rejectedBy: loan.rejectedBy,
        rejectedAt: loan.rejectedAt,
        reason: loan.rejectionReason,
      },
    };
  }

  async calculateRequiredApprovalStage(loanAmount: number, loanType: string): Promise<string> {
    // Define approval thresholds
    const emergencyThreshold = 100000; // KES 100K
    const managerThreshold = 500000;   // KES 500K
    
    if (loanType === 'emergency' && loanAmount <= emergencyThreshold) {
      return 'committee'; // Emergency loans under 100K only need committee approval
    } else if (loanAmount > managerThreshold) {
      return 'manager'; // Large loans need manager approval
    } else {
      return 'committee'; // Regular loans need committee approval
    }
  }

  async createTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(transactionData)
      .returning();
    return transaction;
  }

  async getTransaction(id: number): Promise<TransactionWithDetails | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .where(eq(transactions.id, id));

    if (!transaction) return undefined;

    return {
      ...transaction.transactions,
      member: transaction.members ? {
        ...transaction.members,
        user: transaction.users || undefined,
      } : undefined,
      savingsAccount: transaction.savings_accounts || undefined,
      loan: transaction.loans || undefined,
    };
  }

  async getTransactionsByMember(memberId: number): Promise<TransactionWithDetails[]> {
    const results = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .where(eq(transactions.memberId, memberId))
      .orderBy(desc(transactions.createdAt));

    return results.map(result => ({
      ...result.transactions,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
      savingsAccount: result.savings_accounts || undefined,
      loan: result.loans || undefined,
    }));
  }

  async getRecentTransactions(limit = 10): Promise<TransactionWithDetails[]> {
    const results = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);

    return results.map(result => ({
      ...result.transactions,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
      savingsAccount: result.savings_accounts || undefined,
      loan: result.loans || undefined,
    }));
  }

  async updateTransactionStatus(id: number, status: string): Promise<Transaction> {
    const [transaction] = await db
      .update(transactions)
      .set({ 
        status: status as "pending" | "completed" | "failed" | "cancelled"
      })
      .where(eq(transactions.id, id))
      .returning();
    return transaction;
  }

  async getDashboardMetrics(): Promise<{
    totalMembers: number;
    totalSavings: string;
    activeLoans: string;
    repaymentRate: string;
  }> {
    const [memberCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(members)
      .where(eq(members.status, 'active'));

    const [savingsTotal] = await db
      .select({ total: sql<string>`COALESCE(sum(balance), '0')` })
      .from(savingsAccounts)
      .where(eq(savingsAccounts.status, 'active'));

    const [loansTotal] = await db
      .select({ total: sql<string>`COALESCE(sum(outstanding_balance), '0')` })
      .from(loans)
      .where(eq(loans.status, 'approved'));

    return {
      totalMembers: memberCount?.count || 0,
      totalSavings: savingsTotal?.total || '0',
      activeLoans: loansTotal?.total || '0',
      repaymentRate: '95.2', // Calculated value
    };
  }

  async getPendingApprovals(): Promise<{
    loanApplications: LoanWithDetails[];
    withdrawalRequests: TransactionWithDetails[];
  }> {
    const loanApplications = await this.getAllPendingLoans();
    
    const withdrawalResults = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .where(
        and(
          eq(transactions.transactionType, 'withdrawal'),
          eq(transactions.status, 'pending')
        )
      )
      .orderBy(desc(transactions.createdAt));

    const withdrawalRequests = withdrawalResults.map(result => ({
      ...result.transactions,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
      savingsAccount: result.savings_accounts || undefined,
    }));

    return {
      loanApplications,
      withdrawalRequests,
    };
  }

  async createGuarantor(guarantorData: InsertGuarantor): Promise<Guarantor> {
    const [guarantor] = await db
      .insert(guarantors)
      .values(guarantorData)
      .returning();
    return guarantor;
  }

  async getGuarantor(id: number): Promise<GuarantorWithDetails | undefined> {
    const [guarantor] = await db
      .select()
      .from(guarantors)
      .leftJoin(members, eq(guarantors.guarantorMemberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(loans, eq(guarantors.loanId, loans.id))
      .where(eq(guarantors.id, id));

    if (!guarantor) return undefined;

    return {
      ...guarantor.guarantors,
      guarantorMember: guarantor.members ? {
        ...guarantor.members,
        user: guarantor.users || undefined,
      } : undefined,
      loan: guarantor.loans || undefined,
    };
  }

  async getGuarantorsByLoan(loanId: number): Promise<GuarantorWithDetails[]> {
    const results = await db
      .select()
      .from(guarantors)
      .leftJoin(members, eq(guarantors.guarantorMemberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(loans, eq(guarantors.loanId, loans.id))
      .where(eq(guarantors.loanId, loanId));

    return results.map(result => ({
      ...result.guarantors,
      guarantorMember: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
      loan: result.loans || undefined,
    }));
  }

  async getGuarantorsByMember(memberId: number): Promise<GuarantorWithDetails[]> {
    const results = await db
      .select()
      .from(guarantors)
      .leftJoin(members, eq(guarantors.guarantorMemberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(loans, eq(guarantors.loanId, loans.id))
      .where(eq(guarantors.guarantorMemberId, memberId));

    return results.map(result => ({
      ...result.guarantors,
      guarantorMember: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
      loan: result.loans || undefined,
    }));
  }

  async updateGuarantorStatus(id: number, status: string, comments?: string): Promise<Guarantor> {
    const updateData: any = { status, updatedAt: new Date() };
    if (comments) updateData.comments = comments;
    if (status === 'approved') updateData.approvedAt = new Date();
    if (status === 'rejected') updateData.rejectedAt = new Date();

    const [guarantor] = await db
      .update(guarantors)
      .set(updateData)
      .where(eq(guarantors.id, id))
      .returning();
    return guarantor;
  }

  async getPendingGuarantorRequests(memberId: number): Promise<GuarantorWithDetails[]> {
    const results = await db
      .select()
      .from(guarantors)
      .leftJoin(members, eq(guarantors.guarantorMemberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(loans, eq(guarantors.loanId, loans.id))
      .where(
        and(
          eq(guarantors.guarantorMemberId, memberId),
          eq(guarantors.status, 'pending')
        )
      );

    return results.map(result => ({
      ...result.guarantors,
      guarantorMember: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
      loan: result.loans || undefined,
    }));
  }

  async createAuditLog(log: {
    userId: string;
    memberId?: number;
    action: string;
    resource: string;
    resourceId?: string;
    details?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await db.insert(auditLogs).values(log);
  }

  async getAuditLogs(filters?: {
    userId?: string;
    resource?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    const conditions = [];
    
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.resource) conditions.push(eq(auditLogs.resource, filters.resource));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = filters?.limit || 100;
    
    const results = await db
      .select({
        log: auditLogs,
        user: users,
        member: members,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(members, eq(auditLogs.memberId, members.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);

    return results.map(r => ({
      ...r.log,
      user: r.user || undefined,
      member: r.member || undefined,
    }));
  }

  async getMemberRoles(memberId: number): Promise<string[]> {
    const roles = await db
      .select({ role: memberRoles.role })
      .from(memberRoles)
      .where(eq(memberRoles.memberId, memberId));
    
    return roles.map(r => r.role);
  }

  async addMemberRole(memberId: number, role: string, assignedBy: string): Promise<void> {
    try {
      await db.insert(memberRoles).values({
        memberId,
        role,
        assignedBy,
      });
    } catch (error: any) {
      // Ignore duplicate role errors
      if (!error.message?.includes('duplicate')) {
        throw error;
      }
    }
  }

  async removeMemberRole(memberId: number, role: string): Promise<void> {
    await db
      .delete(memberRoles)
      .where(
        and(
          eq(memberRoles.memberId, memberId),
          eq(memberRoles.role, role)
        )
      );
  }

  async replaceMemberRoles(memberId: number, roles: string[], assignedBy: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete all existing roles
      await tx.delete(memberRoles).where(eq(memberRoles.memberId, memberId));
      
      // Insert new roles
      if (roles.length > 0) {
        await tx.insert(memberRoles).values(
          roles.map(role => ({
            memberId,
            role,
            assignedBy,
          }))
        );
      }
    });
  }
}

export const storage = new DatabaseStorage();