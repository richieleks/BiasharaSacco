import {
  users,
  members,
  savingsAccounts,
  loans,
  transactions,
  guarantors,
  type User,
  type UpsertUser,
  type Member,
  type InsertMember,
  type SavingsAccount,
  type InsertSavingsAccount,
  type Loan,
  type InsertLoan,
  type Transaction,
  type InsertTransaction,
  type Guarantor,
  type InsertGuarantor,
  type MemberWithDetails,
  type TransactionWithDetails,
  type LoanWithDetails,
  type GuarantorWithDetails,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, like } from "drizzle-orm";

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Member operations
  createMember(member: InsertMember): Promise<Member>;
  getMember(id: number): Promise<MemberWithDetails | undefined>;
  getMemberByNumber(memberNumber: string): Promise<MemberWithDetails | undefined>;
  getMemberByUserId(userId: string): Promise<MemberWithDetails | undefined>;
  updateMember(id: number, updates: Partial<InsertMember>): Promise<Member>;
  getAllMembers(): Promise<MemberWithDetails[]>;
  searchMembers(query: string): Promise<MemberWithDetails[]>;

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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
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
    return user;
  }

  async createMember(memberData: InsertMember): Promise<Member> {
    // Generate member number
    const memberCount = await db.select({ count: sql<number>`count(*)` }).from(members);
    const memberNumber = `BIS${String(memberCount[0].count + 1).padStart(6, '0')}`;

    const [member] = await db
      .insert(members)
      .values({
        ...memberData,
        memberNumber,
      })
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
    const result = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .orderBy(desc(members.createdAt));

    return result.map(row => ({
      ...row.members,
      user: row.users || undefined,
    }));
  }

  async searchMembers(query: string): Promise<MemberWithDetails[]> {
    const result = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(
        or(
          like(members.memberNumber, `%${query}%`),
          like(members.idNumber, `%${query}%`),
          like(members.phoneNumber, `%${query}%`),
          like(users.firstName, `%${query}%`),
          like(users.lastName, `%${query}%`),
          like(users.email, `%${query}%`)
        )
      )
      .orderBy(desc(members.createdAt));

    return result.map(row => ({
      ...row.members,
      user: row.users || undefined,
    }));
  }

  async createSavingsAccount(accountData: InsertSavingsAccount): Promise<SavingsAccount> {
    // Generate account number
    const accountCount = await db.select({ count: sql<number>`count(*)` }).from(savingsAccounts);
    const accountNumber = `SAV${String(accountCount[0].count + 1).padStart(8, '0')}`;

    const [account] = await db
      .insert(savingsAccounts)
      .values({
        ...accountData,
        accountNumber,
      })
      .returning();
    return account;
  }

  async getSavingsAccount(id: number): Promise<SavingsAccount | undefined> {
    const [account] = await db.select().from(savingsAccounts).where(eq(savingsAccounts.id, id));
    return account;
  }

  async getSavingsAccountsByMember(memberId: number): Promise<SavingsAccount[]> {
    return await db.select().from(savingsAccounts).where(eq(savingsAccounts.memberId, memberId));
  }

  async updateSavingsAccountBalance(id: number, amount: string, operation: 'add' | 'subtract'): Promise<SavingsAccount> {
    const account = await this.getSavingsAccount(id);
    if (!account) throw new Error('Account not found');

    const currentBalance = parseFloat(account.balance || '0');
    const changeAmount = parseFloat(amount);
    const newBalance = operation === 'add' 
      ? currentBalance + changeAmount 
      : currentBalance - changeAmount;

    if (newBalance < 0) {
      throw new Error('Insufficient funds');
    }

    const [updatedAccount] = await db
      .update(savingsAccounts)
      .set({ 
        balance: newBalance.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(savingsAccounts.id, id))
      .returning();
    
    return updatedAccount;
  }

  async createLoan(loanData: InsertLoan): Promise<Loan> {
    // Generate loan number
    const loanCount = await db.select({ count: sql<number>`count(*)` }).from(loans);
    const loanNumber = `LN${String(loanCount[0].count + 1).padStart(8, '0')}`;

    const [loan] = await db
      .insert(loans)
      .values({
        ...loanData,
        loanNumber,
        outstandingBalance: loanData.principalAmount,
      })
      .returning();
    return loan;
  }

  async getLoan(id: number): Promise<LoanWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(loans.id, id));

    if (!result) return undefined;

    return {
      ...result.loans,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
    };
  }

  async getLoansByMember(memberId: number): Promise<LoanWithDetails[]> {
    const result = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(loans.memberId, memberId))
      .orderBy(desc(loans.createdAt));

    return result.map(row => ({
      ...row.loans,
      member: row.members ? {
        ...row.members,
        user: row.users || undefined,
      } : undefined,
    }));
  }

  async updateLoanStatus(id: number, status: string): Promise<Loan> {
    const [loan] = await db
      .update(loans)
      .set({ 
        status: status as any,
        updatedAt: new Date(),
        ...(status === 'approved' ? { approvalDate: new Date() } : {}),
        ...(status === 'disbursed' ? { disbursementDate: new Date() } : {}),
      })
      .where(eq(loans.id, id))
      .returning();
    return loan;
  }

  async updateLoanBalance(id: number, amount: string): Promise<Loan> {
    const loan = await db.select().from(loans).where(eq(loans.id, id));
    if (!loan[0]) throw new Error('Loan not found');

    const currentBalance = parseFloat(loan[0].outstandingBalance);
    const paymentAmount = parseFloat(amount);
    const newBalance = Math.max(0, currentBalance - paymentAmount);

    const [updatedLoan] = await db
      .update(loans)
      .set({ 
        outstandingBalance: newBalance.toFixed(2),
        updatedAt: new Date(),
        ...(newBalance === 0 ? { status: 'completed' } : {}),
      })
      .where(eq(loans.id, id))
      .returning();
    
    return updatedLoan;
  }

  async getAllPendingLoans(): Promise<LoanWithDetails[]> {
    const result = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(loans.status, 'pending'))
      .orderBy(desc(loans.applicationDate));

    return result.map(row => ({
      ...row.loans,
      member: row.members ? {
        ...row.members,
        user: row.users || undefined,
      } : undefined,
    }));
  }

  async createTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    // Generate reference number
    const transactionCount = await db.select({ count: sql<number>`count(*)` }).from(transactions);
    const referenceNumber = `TXN${Date.now()}${String(transactionCount[0].count + 1).padStart(4, '0')}`;

    const [transaction] = await db
      .insert(transactions)
      .values({
        ...transactionData,
        referenceNumber,
      })
      .returning();
    return transaction;
  }

  async getTransaction(id: number): Promise<TransactionWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .where(eq(transactions.id, id));

    if (!result) return undefined;

    return {
      ...result.transactions,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
      savingsAccount: result.savings_accounts || undefined,
      loan: result.loans || undefined,
    };
  }

  async getTransactionsByMember(memberId: number): Promise<TransactionWithDetails[]> {
    const result = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .where(eq(transactions.memberId, memberId))
      .orderBy(desc(transactions.transactionDate));

    return result.map(row => ({
      ...row.transactions,
      member: row.members ? {
        ...row.members,
        user: row.users || undefined,
      } : undefined,
      savingsAccount: row.savings_accounts || undefined,
      loan: row.loans || undefined,
    }));
  }

  async getRecentTransactions(limit = 10): Promise<TransactionWithDetails[]> {
    const result = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .orderBy(desc(transactions.transactionDate))
      .limit(limit);

    return result.map(row => ({
      ...row.transactions,
      member: row.members ? {
        ...row.members,
        user: row.users || undefined,
      } : undefined,
      savingsAccount: row.savings_accounts || undefined,
      loan: row.loans || undefined,
    }));
  }

  async updateTransactionStatus(id: number, status: string): Promise<Transaction> {
    const [transaction] = await db
      .update(transactions)
      .set({ status: status as any })
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
      .select({ total: sql<string>`COALESCE(SUM(balance), 0)` })
      .from(savingsAccounts)
      .where(eq(savingsAccounts.status, 'active'));

    const [loansTotal] = await db
      .select({ total: sql<string>`COALESCE(SUM(outstanding_balance), 0)` })
      .from(loans)
      .where(eq(loans.status, 'active'));

    // Calculate repayment rate
    const [totalLoans] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loans)
      .where(and(eq(loans.status, 'active'), sql`due_date < NOW()`));

    const [paidLoans] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loans)
      .where(eq(loans.status, 'completed'));

    const totalLoansCount = (totalLoans as any)?.[0]?.count || 0;
    const paidLoansCount = (paidLoans as any)?.[0]?.count || 0;
    
    const repaymentRate = (totalLoansCount + paidLoansCount) > 0 
      ? ((paidLoansCount / (totalLoansCount + paidLoansCount)) * 100).toFixed(1)
      : '100.0';

    return {
      totalMembers: (memberCount as any)?.[0]?.count || 0,
      totalSavings: (savingsTotal as any)?.[0]?.total || '0',
      activeLoans: (loansTotal as any)?.[0]?.total || '0',
      repaymentRate: repaymentRate + '%',
    };
  }

  async getPendingApprovals(): Promise<{
    loanApplications: LoanWithDetails[];
    withdrawalRequests: TransactionWithDetails[];
  }> {
    const loanApplications = await this.getAllPendingLoans();
    
    const withdrawalResult = await db
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
      .orderBy(desc(transactions.transactionDate));

    const withdrawalRequests = withdrawalResult.map(row => ({
      ...row.transactions,
      member: row.members ? {
        ...row.members,
        user: row.users || undefined,
      } : undefined,
      savingsAccount: row.savings_accounts || undefined,
    }));

    return {
      loanApplications,
      withdrawalRequests,
    };
  }

  // Guarantor operations
  async createGuarantor(guarantorData: InsertGuarantor): Promise<Guarantor> {
    const [guarantor] = await db
      .insert(guarantors)
      .values(guarantorData)
      .returning();
    return guarantor;
  }

  async getGuarantor(id: number): Promise<GuarantorWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(guarantors)
      .leftJoin(members, eq(guarantors.guarantorMemberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(loans, eq(guarantors.loanId, loans.id))
      .where(eq(guarantors.id, id));

    if (!result) return undefined;

    return {
      ...result.guarantors,
      guarantorMember: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
      loan: result.loans || undefined,
    };
  }

  async getGuarantorsByLoan(loanId: number): Promise<GuarantorWithDetails[]> {
    const results = await db
      .select()
      .from(guarantors)
      .leftJoin(members, eq(guarantors.guarantorMemberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(guarantors.loanId, loanId))
      .orderBy(guarantors.createdAt);

    return results.map(result => ({
      ...result.guarantors,
      guarantorMember: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
    }));
  }

  async getGuarantorsByMember(memberId: number): Promise<GuarantorWithDetails[]> {
    const results = await db
      .select()
      .from(guarantors)
      .leftJoin(loans, eq(guarantors.loanId, loans.id))
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(guarantors.guarantorMemberId, memberId))
      .orderBy(desc(guarantors.createdAt));

    return results.map(result => ({
      ...result.guarantors,
      loan: result.loans ? {
        ...result.loans,
        member: result.members ? {
          ...result.members,
          user: result.users || undefined,
        } : undefined,
      } : undefined,
    }));
  }

  async updateGuarantorStatus(id: number, status: string, comments?: string): Promise<Guarantor> {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === 'approved') {
      updateData.approvedAt = new Date();
    } else if (status === 'rejected') {
      updateData.rejectedAt = new Date();
    }
    
    if (comments) {
      updateData.comments = comments;
    }

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
      .leftJoin(loans, eq(guarantors.loanId, loans.id))
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(and(
        eq(guarantors.guarantorMemberId, memberId),
        eq(guarantors.status, 'pending')
      ))
      .orderBy(desc(guarantors.createdAt));

    return results.map(result => ({
      ...result.guarantors,
      loan: result.loans ? {
        ...result.loans,
        member: result.members ? {
          ...result.members,
          user: result.users || undefined,
        } : undefined,
      } : undefined,
    }));
  }
}

export const storage = new DatabaseStorage();
