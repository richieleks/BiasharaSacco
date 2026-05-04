import {
  users,
  members,
  savingsAccounts,
  loans,
  transactions,
  guarantors,
  auditLogs,
  memberRoles,
  interestRates,
  amortizationSchedules,
  interestCalculations,
  financialYears,
  interestPayments,
  balanceSnapshots,
  notifications,
  loanTypes,
  loanTerms,
  systemSettings,
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
  type InterestRate,
  type InsertInterestRate,
  type AmortizationSchedule,
  type InsertAmortizationSchedule,
  type AmortizationScheduleWithDetails,
  type InterestCalculation,
  type InsertInterestCalculation,
  type InterestCalculationWithDetails,
  type FinancialYear,
  type InsertFinancialYear,
  type InterestPayment,
  type InsertInterestPayment,
  type BalanceSnapshot,
  type InsertBalanceSnapshot,
  type Notification,
  type InsertNotification,
  type LoanType,
  type InsertLoanType,
  type LoanTypeWithTerms,
  type LoanTerm,
  type InsertLoanTerm,
  roles,
  permissions,
  rolePermissions,
  type Role,
  type InsertRole,
  type Permission,
  type InsertPermission,
  type RolePermission,
  type InsertRolePermission,
  type SystemSetting,
  userSettings,
  loanApprovals,
  type LoanApproval,
  saccoAccounts,
  saccoJournalEntries,
  saccoAccountMappings,
  type SaccoAccount,
  type InsertSaccoAccount,
  type SaccoJournalEntry,
  type InsertSaccoJournalEntry,
  type SaccoAccountMapping,
} from "@workspace/db";
import InterestCalculator, { type InterestCalculationResult } from "./interest-calculator";
import { db } from "./db";
import { eq, ne, desc, sql, like, ilike, or, and, gte, lte, count, getTableColumns, inArray } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<{ username: string; email: string; firstName: string; lastName: string; role: string }>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Member operations
  createMember(member: InsertMember & { memberNumber: string }): Promise<Member>;
  getMember(id: number): Promise<MemberWithDetails | undefined>;
  getMemberByNumber(memberNumber: string): Promise<MemberWithDetails | undefined>;
  getMemberByIdNumber(idNumber: string): Promise<MemberWithDetails | undefined>;
  getMemberByUserId(userId: string): Promise<MemberWithDetails | undefined>;
  updateMember(id: number, updates: Partial<InsertMember>): Promise<Member>;
  getAllMembers(): Promise<MemberWithDetails[]>;
  getMembersCount(): Promise<number>;
  searchMembers(query: string): Promise<MemberWithDetails[]>;
  getPendingMembers(): Promise<MemberWithDetails[]>;
  getMembersPaginated(page: number, limit: number, search?: string, status?: string): Promise<{ data: MemberWithDetails[]; total: number }>;
  approveMember(id: number, approvedBy: string, comments?: string): Promise<Member>;
  rejectMember(id: number, approvedBy: string, comments?: string): Promise<Member>;

  // Savings account operations
  createSavingsAccount(account: InsertSavingsAccount): Promise<SavingsAccount>;
  getSavingsAccount(id: number): Promise<SavingsAccount | undefined>;
  getSavingsAccountsByMember(memberId: number): Promise<SavingsAccount[]>;
  updateSavingsAccountBalance(id: number, amount: string, operation: 'add' | 'subtract'): Promise<SavingsAccount>;
  syncMemberTotalSavings(memberId: number): Promise<void>;
  syncAllMemberTotalSavings(): Promise<{ updated: number }>;
  getAllSavingsAccounts(): Promise<SavingsAccount[]>;
  getSavingsAccountsPaginated(page: number, limit: number, search?: string, memberId?: number): Promise<{ data: any[]; total: number }>;

  // Loan operations
  createLoan(loan: InsertLoan): Promise<Loan>;
  getLoan(id: number): Promise<LoanWithDetails | undefined>;
  getLoanByUuid(uuid: string): Promise<LoanWithDetails | undefined>;
  getLoansByMember(memberId: number): Promise<LoanWithDetails[]>;
  updateLoanStatus(id: number, status: string): Promise<Loan>;
  updateLoanBalance(id: number, amount: string): Promise<Loan>;
  getAllPendingLoans(): Promise<LoanWithDetails[]>;
  
  // Advanced loan approval workflow
  getLoansForApproval(stage: string, userRole: string): Promise<LoanWithDetails[]>;
  approveLoanAtStage(loanId: number, stage: string, approvedBy: string, comments?: string): Promise<Loan>;
  rejectLoan(loanId: number, rejectedBy: string, reason: string): Promise<Loan>;
  getLoanApprovalHistory(loanId: number): Promise<any>;
  addLoanApproval(loanId: number, approvedBy: string, stage: string, comments?: string): Promise<LoanApproval>;
  getLoanApprovals(loanId: number, stage: string): Promise<LoanApproval[]>;
  calculateRequiredApprovalStage(loanAmount: number, loanType: string): Promise<string>;

  getMemberActiveLoans(memberId: number): Promise<LoanWithDetails[]>;
  getAllLoans(): Promise<LoanWithDetails[]>;
  getLoansPaginated(page: number, limit: number, search?: string, memberId?: number, status?: string): Promise<{ data: LoanWithDetails[]; total: number }>;
  getLoanStats(memberId?: number): Promise<{ activeCount: number; totalOutstanding: number; defaultedCount: number; totalCount: number }>;

  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransaction(id: number): Promise<TransactionWithDetails | undefined>;
  getTransactionsByMember(memberId: number): Promise<TransactionWithDetails[]>;
  getTransactionsByLoan(loanId: number): Promise<TransactionWithDetails[]>;
  getRecentTransactions(limit?: number): Promise<TransactionWithDetails[]>;
  getAllTransactions(): Promise<TransactionWithDetails[]>;
  getTransactionsPaginated(page: number, limit: number, search?: string, memberId?: number): Promise<{ data: TransactionWithDetails[]; total: number }>;
  updateTransactionStatus(id: number, status: string): Promise<Transaction>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    totalMembers: number;
    totalSavings: string;
    activeLoans: string;
    repaymentRate: string;
    memberChange: string;
    savingsChange: string;
    loansChange: string;
    repaymentChange: string;
    newMembersThisMonth: number;
    pendingLoans: number;
    totalTransactionsThisMonth: number;
    totalInterestPaid: string;
  }>;
  
  getDashboardAnalytics(months?: number): Promise<{
    loanDistribution: Array<{ name: string; value: number }>;
    monthlyTransactions: Array<{ month: string; deposits: number; withdrawals: number; loanPayments: number }>;
    memberGrowth: Array<{ month: string; newMembers: number }>;
    savingsVsLoans: Array<{ month: string; totalSavings: number; totalLoans: number }>;
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
  
  // RBAC operations
  getAllRoles(): Promise<Role[]>;
  getRoleById(id: number): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: number, updates: Partial<InsertRole>): Promise<Role>;
  deleteRole(id: number): Promise<void>;
  
  getAllPermissions(): Promise<Permission[]>;
  getPermissionsByRole(roleId: number): Promise<Permission[]>;
  assignPermissionsToRole(roleId: number, permissionIds: number[]): Promise<void>;
  getRolePermissions(roleId: number): Promise<RolePermission[]>;
  getMemberPermissions(memberId: number): Promise<Permission[]>;

  // Interest rate management
  createInterestRate(rate: InsertInterestRate): Promise<InterestRate>;
  getInterestRate(id: number): Promise<InterestRate | undefined>;
  getActiveInterestRates(): Promise<InterestRate[]>;
  getInterestRateByProduct(productType: string): Promise<InterestRate | undefined>;
  updateInterestRate(id: number, updates: Partial<InsertInterestRate>): Promise<InterestRate>;
  deactivateInterestRate(id: number): Promise<InterestRate>;

  // Amortization schedule operations
  createAmortizationSchedule(schedules: InsertAmortizationSchedule[]): Promise<AmortizationSchedule[]>;
  getAmortizationSchedule(loanId: number): Promise<AmortizationScheduleWithDetails[]>;
  updateSchedulePayment(id: number, actualAmount: string, paymentDate: Date): Promise<AmortizationSchedule>;
  getOverduePayments(): Promise<AmortizationScheduleWithDetails[]>;
  getUpcomingPayments(days: number): Promise<AmortizationScheduleWithDetails[]>;

  // Interest calculation operations
  createInterestCalculation(calculation: InsertInterestCalculation): Promise<InterestCalculation>;
  calculateAndSaveInterest(loanId: number): Promise<InterestCalculationResult>;

  // Advanced loan calculations
  generateLoanAmortization(loanId: number): Promise<AmortizationSchedule[]>;
  recalculateLoanSchedule(loanId: number, newRate?: number): Promise<AmortizationSchedule[]>;
  calculateEarlyPaymentSavings(loanId: number, paymentDate: Date, amount: number): Promise<{
    interestSaved: number;
    newBalance: number;
    revisedSchedule: AmortizationSchedule[];
  }>;

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
  getAuditLogsPaginated(page: number, limit: number, search?: string, resource?: string, action?: string): Promise<{ data: any[]; total: number }>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string, filters?: {
    isRead?: boolean;
    type?: string;
    priority?: string;
    limit?: number;
  }): Promise<Notification[]>;
  getNotificationsPaginated(userId: string, page: number, limit: number): Promise<{ data: Notification[]; total: number }>;
  markNotificationAsRead(id: number, userId: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: number, userId: string): Promise<boolean>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Loan Types operations
  createLoanType(loanType: InsertLoanType): Promise<LoanType>;
  getLoanType(id: number): Promise<LoanTypeWithTerms | undefined>;
  getLoanTypeByName(name: string): Promise<LoanTypeWithTerms | undefined>;
  getAllLoanTypes(): Promise<LoanTypeWithTerms[]>;
  getActiveLoanTypes(): Promise<LoanTypeWithTerms[]>;
  updateLoanType(id: number, updates: Partial<InsertLoanType>): Promise<LoanType>;
  deleteLoanType(id: number): Promise<boolean>;

  // Loan Terms operations
  createLoanTerm(loanTerm: InsertLoanTerm): Promise<LoanTerm>;
  getLoanTerm(id: number): Promise<LoanTerm | undefined>;
  getLoanTermsByType(loanTypeId: number): Promise<LoanTerm[]>;
  updateLoanTerm(id: number, updates: Partial<InsertLoanTerm>): Promise<LoanTerm>;
  deleteLoanTerm(id: number): Promise<boolean>;

  // Interest calculations operations
  createFinancialYear(financialYear: InsertFinancialYear): Promise<FinancialYear>;
  getFinancialYear(id: number): Promise<FinancialYear | undefined>;
  getAllFinancialYears(): Promise<FinancialYear[]>;
  getActiveFinancialYear(): Promise<FinancialYear | undefined>;
  updateFinancialYear(id: number, updates: Partial<InsertFinancialYear>): Promise<FinancialYear>;
  setActiveFinancialYear(id: number): Promise<FinancialYear>;

  createBalanceSnapshot(snapshot: InsertBalanceSnapshot): Promise<BalanceSnapshot>;
  getBalanceSnapshots(savingsAccountId: number, financialYearId?: number): Promise<BalanceSnapshot[]>;
  createBalanceSnapshotsForAllAccounts(financialYearId: number, snapshotDate: string): Promise<BalanceSnapshot[]>;

  calculateInterestForMember(memberId: number, financialYearId: number): Promise<InterestCalculation>;
  calculateInterestForAllMembers(financialYearId: number): Promise<InterestCalculation[]>;
  getInterestCalculations(financialYearId?: number): Promise<InterestCalculation[]>;
  getInterestCalculationsByMember(memberId: number): Promise<InterestCalculation[]>;
  approveInterestCalculation(id: number, approvedBy: string): Promise<InterestCalculation>;
  postInterestCalculation(id: number): Promise<InterestCalculation>;

  createInterestPayment(payment: InsertInterestPayment): Promise<InterestPayment>;
  getInterestPayments(financialYearId?: number): Promise<InterestPayment[]>;
  getInterestPaymentsByMember(memberId: number): Promise<InterestPayment[]>;
  processInterestPayment(id: number, processedBy: string): Promise<InterestPayment>;

  generateInterestReport(financialYearId: number): Promise<any>;

  resolveMemberId(idOrUuid: string): Promise<number>;
  resolveLoanId(idOrUuid: string): Promise<number>;
  resolveSavingsAccountId(idOrUuid: string): Promise<number>;
  resolveTransactionId(idOrUuid: string): Promise<number>;
  resolveGuarantorId(idOrUuid: string): Promise<number>;

  // System Settings operations
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  getAllSystemSettings(): Promise<SystemSetting[]>;
  upsertSystemSetting(key: string, value: string, type?: string, description?: string, updatedBy?: string): Promise<SystemSetting>;

  // User Settings operations
  getUserSettings(userId: string): Promise<string | null>;
  upsertUserSettings(userId: string, settingsJson: string): Promise<void>;

  // SACCO Operational Accounts
  getSaccoAccounts(filters?: { accountType?: string; isActive?: boolean }): Promise<SaccoAccount[]>;
  getSaccoAccount(id: number): Promise<SaccoAccount | undefined>;
  createSaccoAccount(data: InsertSaccoAccount): Promise<SaccoAccount>;
  updateSaccoAccount(id: number, data: Partial<InsertSaccoAccount>): Promise<SaccoAccount>;
  getSaccoJournalEntries(filters?: { page?: number; limit?: number; accountId?: number; startDate?: string; endDate?: string }): Promise<{ data: any[]; total: number }>;
  getSaccoJournalEntry(id: number): Promise<any>;
  createSaccoJournalEntry(data: InsertSaccoJournalEntry): Promise<SaccoJournalEntry>;
  reverseSaccoJournalEntry(id: number, userId: string): Promise<SaccoJournalEntry>;
  getSaccoAccountStatement(accountId: number, startDate?: string, endDate?: string): Promise<any[]>;
  getSaccoAccountsSummary(): Promise<any>;
  seedDefaultSaccoAccounts(): Promise<void>;
  getSaccoAccountMappings(): Promise<SaccoAccountMapping[]>;
  updateSaccoAccountMapping(id: number, data: { debitAccountId?: number | null; creditAccountId?: number | null }): Promise<SaccoAccountMapping>;
  seedDefaultAccountMappings(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: string, data: Partial<{ username: string; email: string; firstName: string; lastName: string; role: string }>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.update(members).set({ userId: null }).where(eq(members.userId, id));
    await db.delete(users).where(eq(users.id, id));
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

  async getMembersCount(): Promise<number> {
    const result = await db.$count(members);
    return result;
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

  async getSavingsAccountsByMember(memberId: number): Promise<SavingsAccount[]> {
    return await db
      .select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.memberId, memberId));
  }

  async getAllMembers(): Promise<MemberWithDetails[]> {
    const results = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(ne(members.status, 'exited'))
      .orderBy(desc(members.createdAt));

    const membersWithDetails = await Promise.all(
      results.map(async (result) => {
        const roles = await this.getMemberRoles(result.members.id);
        return {
          ...result.members,
          user: result.users || undefined,
          roles
        };
      })
    );

    return membersWithDetails;
  }

  async searchMembers(query: string): Promise<MemberWithDetails[]> {
    const results = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(
        and(
          ne(members.status, 'exited'),
          or(
            like(members.fullName, `%${query}%`),
            like(members.memberNumber, `%${query}%`),
            like(members.idNumber, `%${query}%`)
          )
        )
      )
      .orderBy(desc(members.createdAt));

    const membersWithDetails = await Promise.all(
      results.map(async (result) => {
        const roles = await this.getMemberRoles(result.members.id);
        return {
          ...result.members,
          user: result.users || undefined,
          roles
        };
      })
    );

    return membersWithDetails;
  }

  async getMembersPaginated(page: number, limit: number, search?: string, status?: string): Promise<{ data: MemberWithDetails[]; total: number }> {
    const conditions: any[] = [];
    if (status && status !== 'all') {
      conditions.push(eq(members.status, status));
    } else {
      conditions.push(ne(members.status, 'exited'));
    }
    if (search) {
      conditions.push(
        or(
          ilike(members.fullName, `%${search}%`),
          ilike(members.memberNumber, `%${search}%`),
          ilike(members.phoneNumber, `%${search}%`),
          ilike(members.department, `%${search}%`)
        )
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ value: count() })
      .from(members)
      .where(whereClause);

    const offset = (page - 1) * limit;
    const results = await db
      .select()
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(whereClause)
      .orderBy(desc(members.createdAt))
      .limit(limit)
      .offset(offset);

    const data = await Promise.all(
      results.map(async (result) => {
        const roles = await this.getMemberRoles(result.members.id);
        return { ...result.members, user: result.users || undefined, roles };
      })
    );

    return { data, total: Number(countResult.value) };
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
    
    // Automatically create a savings account for the approved member
    try {
      // Check if member already has a savings account
      const existingAccounts = await this.getSavingsAccountsByMember(member.id);
      
      if (existingAccounts.length === 0) {
        // Generate account number
        const accountCount = await db.$count(savingsAccounts);
        const accountNumber = `SAV${String(accountCount + 1).padStart(8, '0')}`;
        
        // Create regular savings account with initial balance of 0
        await this.createSavingsAccount({
          memberId: member.id,
          accountNumber,
          accountType: 'regular',
          balance: '0',
        });
        
        console.log(`Created savings account ${accountNumber} for member ${member.memberNumber}`);
      }
    } catch (error) {
      console.error('Error creating savings account for approved member:', error);
      // Don't fail the approval if account creation fails
    }
    
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
      .select({
        ...getTableColumns(savingsAccounts),
        member: {
          id: members.id,
          fullName: members.fullName,
          memberNumber: members.memberNumber,
          idNumber: members.idNumber,
        }
      })
      .from(savingsAccounts)
      .leftJoin(members, eq(savingsAccounts.memberId, members.id))
      .where(eq(savingsAccounts.id, id));
    return account || undefined;
  }

  async getAllSavingsAccounts(): Promise<any[]> {
    const results = await db
      .select()
      .from(savingsAccounts)
      .leftJoin(members, eq(savingsAccounts.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .orderBy(desc(savingsAccounts.createdAt));

    return results.map(result => ({
      ...result.savings_accounts,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
    }));
  }

  async getSavingsAccountsPaginated(page: number, limit: number, search?: string, memberId?: number): Promise<{ data: any[]; total: number }> {
    const conditions: any[] = [];
    if (memberId) {
      conditions.push(eq(savingsAccounts.memberId, memberId));
    }
    if (search) {
      conditions.push(
        or(
          ilike(savingsAccounts.accountNumber, `%${search}%`),
          ilike(members.fullName, `%${search}%`),
          ilike(members.memberNumber, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ value: count() })
      .from(savingsAccounts)
      .leftJoin(members, eq(savingsAccounts.memberId, members.id))
      .where(whereClause);

    const offset = (page - 1) * limit;
    const results = await db
      .select()
      .from(savingsAccounts)
      .leftJoin(members, eq(savingsAccounts.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(whereClause)
      .orderBy(desc(savingsAccounts.createdAt))
      .limit(limit)
      .offset(offset);

    const data = results.map(result => ({
      ...result.savings_accounts,
      member: result.members ? { ...result.members, user: result.users || undefined } : undefined,
    }));

    return { data, total: Number(countResult.value) };
  }

  async syncMemberTotalSavings(memberId: number): Promise<void> {
    try {
      const [result] = await db
        .select({ total: sql<string>`COALESCE(SUM(${savingsAccounts.balance}::numeric), 0)` })
        .from(savingsAccounts)
        .where(eq(savingsAccounts.memberId, memberId));
      await db.update(members)
        .set({ totalSavings: result.total || '0' })
        .where(eq(members.id, memberId));
    } catch (err) {
      console.error(`Failed to sync total_savings for member ${memberId}:`, err);
    }
  }

  async syncAllMemberTotalSavings(): Promise<{ updated: number }> {
    const totals = await db
      .select({
        memberId: savingsAccounts.memberId,
        total: sql<string>`COALESCE(SUM(${savingsAccounts.balance}::numeric), 0)`,
      })
      .from(savingsAccounts)
      .groupBy(savingsAccounts.memberId);

    const savingsMap = new Map(totals.map(t => [t.memberId, t.total || '0']));

    const allMembers = await db.select({ id: members.id }).from(members);
    let updated = 0;
    for (const m of allMembers) {
      const total = savingsMap.get(m.id) || '0';
      await db.update(members)
        .set({ totalSavings: total })
        .where(eq(members.id, m.id));
      updated++;
    }
    return { updated };
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
    this.syncMemberTotalSavings(account.memberId);
    return account;
  }

  async updateSavingsAccountBalanceDirect(id: number, balance: string): Promise<SavingsAccount> {
    const [account] = await db
      .update(savingsAccounts)
      .set({
        balance: balance,
        updatedAt: new Date(),
      })
      .where(eq(savingsAccounts.id, id))
      .returning();
    this.syncMemberTotalSavings(account.memberId);
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

  async getLoanByUuid(uuid: string): Promise<LoanWithDetails | undefined> {
    const [loan] = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(loans.uuid, uuid));

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

  async getMemberPendingLoans(memberId: number): Promise<LoanWithDetails[]> {
    const results = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(
        and(
          eq(loans.memberId, memberId),
          eq(loans.status, 'pending')
        )
      )
      .orderBy(desc(loans.createdAt));

    return results.map(result => ({
      ...result.loans,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
    }));
  }

  async getMemberActiveLoans(memberId: number): Promise<LoanWithDetails[]> {
    const results = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(
        and(
          eq(loans.memberId, memberId),
          sql`${loans.status} IN ('approved', 'active', 'disbursed')`
        )
      )
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

    if (parseFloat(loan.outstandingBalance || '0') <= 0) {
      const [completed] = await db
        .update(loans)
        .set({
          status: 'completed',
          outstandingBalance: '0',
          updatedAt: new Date(),
        })
        .where(eq(loans.id, id))
        .returning();
      return completed;
    }

    return loan;
  }

  async getAllLoans(): Promise<LoanWithDetails[]> {
    const results = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .orderBy(desc(loans.createdAt));

    return results.map(result => ({
      ...result.loans,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
    }));
  }

  async getLoansPaginated(page: number, limit: number, search?: string, memberId?: number, status?: string): Promise<{ data: LoanWithDetails[]; total: number }> {
    const conditions: any[] = [];
    if (memberId) {
      conditions.push(eq(loans.memberId, memberId));
    }
    if (status) {
      conditions.push(eq(loans.status, status));
    }
    if (search) {
      conditions.push(
        or(
          ilike(members.fullName, `%${search}%`),
          ilike(members.memberNumber, `%${search}%`),
          ilike(loans.loanType, `%${search}%`),
          ilike(loans.status, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ value: count() })
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .where(whereClause);

    const offset = (page - 1) * limit;
    const results = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(whereClause)
      .orderBy(desc(loans.createdAt))
      .limit(limit)
      .offset(offset);

    const data = results.map(result => ({
      ...result.loans,
      member: result.members ? { ...result.members, user: result.users || undefined } : undefined,
    }));

    return { data, total: Number(countResult.value) };
  }

  async getLoanStats(memberId?: number): Promise<{ activeCount: number; totalOutstanding: number; defaultedCount: number; totalCount: number }> {
    const conditions: any[] = [];
    if (memberId) {
      conditions.push(eq(loans.memberId, memberId));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await db
      .select({
        totalCount: count(),
        activeCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} IN ('approved', 'active', 'disbursed'))`,
        totalOutstanding: sql<number>`COALESCE(SUM(CASE WHEN ${loans.status} IN ('approved', 'active', 'disbursed') THEN ${loans.outstandingBalance}::numeric ELSE 0 END), 0)`,
        defaultedCount: sql<number>`COUNT(*) FILTER (WHERE ${loans.status} = 'defaulted')`,
      })
      .from(loans)
      .where(whereClause);

    return {
      activeCount: Number(result.activeCount),
      totalOutstanding: Number(result.totalOutstanding),
      defaultedCount: Number(result.defaultedCount),
      totalCount: Number(result.totalCount),
    };
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
    
    if (stage === 'committee') {
      whereCondition = and(
        eq(loans.status, 'pending'),
        eq(loans.approvalStage, 'committee')
      );
    } else if (stage === 'treasurer') {
      whereCondition = eq(loans.status, 'approved');
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

    let mapped = results.map(result => ({
      ...result.loans,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
    }));

    if (stage === 'committee' && mapped.length > 0) {
      const loanIds = mapped.map(l => l.id);
      const allGuarantors = await db
        .select()
        .from(guarantors)
        .where(inArray(guarantors.loanId, loanIds));

      const byLoan = new Map<number, typeof allGuarantors>();
      for (const g of allGuarantors) {
        const arr = byLoan.get(g.loanId) || [];
        arr.push(g);
        byLoan.set(g.loanId, arr);
      }

      mapped = mapped.filter(loan => {
        const gs = byLoan.get(loan.id) || [];
        if (gs.length === 0) return true;
        return gs.every(g => g.status === 'approved');
      });
    }

    return mapped;
  }

  async approveLoanAtStage(loanId: number, stage: string, approvedBy: string, comments?: string): Promise<Loan> {
    const currentTime = new Date();
    let updateData: any = {};

    if (stage === 'committee') {
      updateData = {
        status: 'approved',
        approvalStage: 'completed',
        committeeApprovedBy: approvedBy,
        committeeApprovedAt: currentTime,
        committeeComments: comments,
      };
    } else if (stage === 'manager') {
      updateData = {
        status: 'approved',
        approvalStage: 'completed',
        managerApprovedBy: approvedBy,
        managerApprovedAt: currentTime,
        managerComments: comments,
      };
    } else if (stage === 'treasurer') {
      updateData = {
        status: 'approved',
        approvalStage: 'completed',
      };
    }

    const [loan] = await db
      .update(loans)
      .set(updateData)
      .where(eq(loans.id, loanId))
      .returning();
    
    return loan;
  }

  async addLoanApproval(loanId: number, approvedBy: string, stage: string, comments?: string): Promise<LoanApproval> {
    const [approval] = await db
      .insert(loanApprovals)
      .values({ loanId, approvedBy, stage, comments })
      .returning();
    return approval;
  }

  async getLoanApprovals(loanId: number, stage: string): Promise<LoanApproval[]> {
    return await db
      .select()
      .from(loanApprovals)
      .where(and(eq(loanApprovals.loanId, loanId), eq(loanApprovals.stage, stage)))
      .orderBy(loanApprovals.createdAt);
  }

  async getLoanApprovalsByUser(userId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(loanApprovals)
      .leftJoin(loans, eq(loanApprovals.loanId, loans.id))
      .leftJoin(members, eq(loans.memberId, members.id))
      .where(eq(loanApprovals.approvedBy, userId))
      .orderBy(desc(loanApprovals.createdAt));
    return results.map(r => ({
      ...r.loan_approvals,
      loan: r.loans ? { ...r.loans, member: r.members || undefined } : undefined,
    }));
  }

  async getLoansRejectedByUser(userId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .where(eq(loans.rejectedBy, userId))
      .orderBy(desc(loans.rejectedAt));
    return results.map(r => ({
      ...r.loans,
      member: r.members || undefined,
    }));
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

  async getTransactionsBySavingsAccount(savingsAccountId: number): Promise<TransactionWithDetails[]> {
    const results = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .where(eq(transactions.savingsAccountId, savingsAccountId))
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

  async getTransactionsBySavingsAccountPaginated(
    savingsAccountId: number,
    options: { startDate?: Date; endDate?: Date; page: number; limit: number }
  ): Promise<{ transactions: TransactionWithDetails[]; total: number; totalDeposits: number; totalWithdrawals: number; totalInterest: number }> {
    const conditions = [eq(transactions.savingsAccountId, savingsAccountId)];
    if (options.startDate) {
      conditions.push(gte(transactions.transactionDate, options.startDate));
    }
    if (options.endDate) {
      const endOfDay = new Date(options.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(transactions.transactionDate, endOfDay));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ value: count() })
      .from(transactions)
      .where(whereClause!);

    const [summaryResult] = await db
      .select({
        totalDeposits: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} IN ('deposit') AND ${transactions.status} = 'completed' THEN CAST(${transactions.amount} AS DECIMAL) ELSE 0 END), 0)`,
        totalWithdrawals: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} IN ('withdrawal', 'fee_charge') AND ${transactions.status} = 'completed' THEN CAST(${transactions.amount} AS DECIMAL) ELSE 0 END), 0)`,
        totalInterest: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'interest_credit' AND ${transactions.status} = 'completed' THEN CAST(${transactions.amount} AS DECIMAL) ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(whereClause!);

    const offset = (options.page - 1) * options.limit;
    const results = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .where(whereClause!)
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
      .limit(options.limit)
      .offset(offset);

    const mappedTransactions = results.map(result => ({
      ...result.transactions,
      member: result.members ? {
        ...result.members,
        user: result.users || undefined,
      } : undefined,
      savingsAccount: result.savings_accounts || undefined,
      loan: result.loans || undefined,
    }));

    return {
      transactions: mappedTransactions,
      total: countResult?.value || 0,
      totalDeposits: parseFloat(summaryResult?.totalDeposits || '0'),
      totalWithdrawals: parseFloat(summaryResult?.totalWithdrawals || '0'),
      totalInterest: parseFloat(summaryResult?.totalInterest || '0'),
    };
  }

  async getTransactionsByLoan(loanId: number): Promise<TransactionWithDetails[]> {
    const results = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .where(eq(transactions.loanId, loanId))
      .orderBy(desc(transactions.transactionDate));

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

  async getAllTransactions(): Promise<TransactionWithDetails[]> {
    return this.getRecentTransactions(10000);
  }

  async getTransactionsPaginated(page: number, limit: number, search?: string, memberId?: number): Promise<{ data: TransactionWithDetails[]; total: number }> {
    const conditions: any[] = [];
    if (memberId) {
      conditions.push(eq(transactions.memberId, memberId));
    }
    if (search) {
      conditions.push(
        or(
          ilike(transactions.referenceNumber, `%${search}%`),
          ilike(transactions.transactionType, `%${search}%`),
          ilike(transactions.description, `%${search}%`),
          ilike(members.fullName, `%${search}%`),
          ilike(members.memberNumber, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ value: count() })
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .where(whereClause);

    const offset = (page - 1) * limit;
    const results = await db
      .select()
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(savingsAccounts, eq(transactions.savingsAccountId, savingsAccounts.id))
      .leftJoin(loans, eq(transactions.loanId, loans.id))
      .where(whereClause)
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    const data = results.map(result => ({
      ...result.transactions,
      member: result.members ? { ...result.members, user: result.users || undefined } : undefined,
      savingsAccount: result.savings_accounts || undefined,
      loan: result.loans || undefined,
    }));

    return { data, total: Number(countResult.value) };
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
    memberChange: string;
    savingsChange: string;
    loansChange: string;
    repaymentChange: string;
    newMembersThisMonth: number;
    pendingLoans: number;
    totalTransactionsThisMonth: number;
    totalInterestPaid: string;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [memberCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(members)
      .where(sql`${members.status} != 'exited'`);

    const [lastMonthMembers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(members)
      .where(and(eq(members.status, 'active'), sql`${members.createdAt} < ${startOfMonth}`));

    const [savingsTotal] = await db
      .select({ total: sql<string>`COALESCE(sum(balance), '0')` })
      .from(savingsAccounts)
      .where(eq(savingsAccounts.status, 'active'));

    const [loansTotal] = await db
      .select({ total: sql<string>`COALESCE(sum(outstanding_balance), '0')` })
      .from(loans)
      .where(sql`${loans.status} IN ('approved', 'active', 'disbursed')`);

    const [pendingLoansCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loans)
      .where(eq(loans.status, 'pending'));

    const [newMembersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(members)
      .where(and(eq(members.status, 'active'), sql`${members.createdAt} >= ${startOfMonth}`));

    const [txnCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(sql`${transactions.transactionDate} >= ${startOfMonth}`);

    const [interestTotal] = await db
      .select({ total: sql<string>`COALESCE(sum(amount), '0')` })
      .from(transactions)
      .where(and(
        eq(transactions.transactionType, 'interest_credit'),
        eq(transactions.status, 'completed')
      ));

    // Repayment rate: 100% unless there are loans behind on scheduled payments
    // Compare expected principal repaid by now vs actual principal repaid (both principal-based for consistency)
    const activeLoansData = await db
      .select({
        id: loans.id,
        principalAmount: loans.principalAmount,
        outstandingBalance: loans.outstandingBalance,
        termMonths: loans.termMonths,
        disbursementDate: loans.disbursementDate,
        approvedAt: loans.approvalDate,
        createdAt: loans.createdAt,
      })
      .from(loans)
      .where(sql`${loans.status} IN ('active', 'disbursed')`);

    let totalExpectedPrincipalByNow = 0;
    let totalActualPrincipalRepaid = 0;

    for (const loan of activeLoansData) {
      const startDate = loan.disbursementDate || loan.approvedAt || loan.createdAt || new Date();
      const monthsElapsed = Math.max(0, Math.floor(
        (Date.now() - new Date(startDate).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
      ));
      const principal = parseFloat(loan.principalAmount?.toString() || '0');
      const term = loan.termMonths || 1;
      const monthlyPrincipal = principal / term;

      const expectedPrincipalByNow = Math.min(monthlyPrincipal * monthsElapsed, principal);
      const actualPrincipalRepaid = principal - parseFloat(loan.outstandingBalance?.toString() || '0');

      totalExpectedPrincipalByNow += expectedPrincipalByNow;
      totalActualPrincipalRepaid += Math.max(0, actualPrincipalRepaid);
    }

    const repaymentRate = activeLoansData.length === 0
      ? '100.0'
      : totalExpectedPrincipalByNow > 0
        ? Math.min((totalActualPrincipalRepaid / totalExpectedPrincipalByNow) * 100, 100).toFixed(1)
        : '100.0';

    const currentMembers = memberCount?.count || 0;
    const prevMembers = lastMonthMembers?.count || 0;
    const memberChangeVal = prevMembers > 0 ? (((currentMembers - prevMembers) / prevMembers) * 100).toFixed(1) : (currentMembers > 0 ? '100' : '0');

    return {
      totalMembers: currentMembers,
      totalSavings: savingsTotal?.total || '0',
      activeLoans: loansTotal?.total || '0',
      repaymentRate,
      memberChange: memberChangeVal,
      savingsChange: '0',
      loansChange: '0',
      repaymentChange: '0',
      newMembersThisMonth: newMembersCount?.count || 0,
      pendingLoans: pendingLoansCount?.count || 0,
      totalTransactionsThisMonth: txnCount?.count || 0,
      totalInterestPaid: interestTotal?.total || '0',
    };
  }

  async getDashboardAnalytics(periodMonths: number = 6): Promise<{
    loanDistribution: Array<{ name: string; value: number }>;
    monthlyTransactions: Array<{ month: string; deposits: number; withdrawals: number; loanPayments: number }>;
    memberGrowth: Array<{ month: string; newMembers: number }>;
    savingsVsLoans: Array<{ month: string; totalSavings: number; totalLoans: number }>;
  }> {
    const lookbackMonths = Math.min(Math.max(periodMonths, 1), 24);

    // Loan distribution by type
    const loanDistribution = await db
      .select({
        loanType: loans.loanType,
        total: sql<number>`sum(principal_amount)::numeric`,
      })
      .from(loans)
      .where(inArray(loans.status, ['approved', 'active', 'disbursed']))
      .groupBy(loans.loanType);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    const useYearMonth = lookbackMonths > 12;

    const transactionTrends = await db
      .select({
        month: useYearMonth
          ? sql<string>`to_char(created_at, 'Mon YY')`
          : sql<string>`to_char(created_at, 'Mon')`,
        transactionType: transactions.transactionType,
        total: sql<number>`sum(amount)::numeric`,
      })
      .from(transactions)
      .where(
        and(
          sql`created_at >= ${startDate}`,
          eq(transactions.status, 'completed')
        )
      )
      .groupBy(useYearMonth
        ? sql`to_char(created_at, 'Mon YY'), transaction_type`
        : sql`to_char(created_at, 'Mon'), transaction_type`)
      .orderBy(sql`min(created_at)`);

    const monthlyData = new Map<string, any>();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    for (let i = lookbackMonths - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const monthLabel = useYearMonth
        ? `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
        : monthNames[d.getMonth()];
      monthlyData.set(monthLabel, {
        month: monthLabel,
        deposits: 0,
        withdrawals: 0,
        loanPayments: 0,
      });
    }

    transactionTrends.forEach(trend => {
      const monthData = monthlyData.get(trend.month);
      if (monthData) {
        if (trend.transactionType === 'deposit') monthData.deposits = trend.total;
        if (trend.transactionType === 'withdrawal') monthData.withdrawals = trend.total;
        if (trend.transactionType === 'loan_payment') monthData.loanPayments = trend.total;
      }
    });

    const memberGrowthRaw = await db
      .select({
        month: useYearMonth
          ? sql<string>`to_char(created_at, 'Mon YY')`
          : sql<string>`to_char(created_at, 'Mon')`,
        count: sql<number>`count(*)::integer`,
      })
      .from(members)
      .where(sql`created_at >= ${startDate}`)
      .groupBy(useYearMonth
        ? sql`to_char(created_at, 'Mon YY')`
        : sql`to_char(created_at, 'Mon')`)
      .orderBy(sql`min(created_at)`);

    const memberGrowthMap = new Map<string, number>();
    for (let i = lookbackMonths - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const label = useYearMonth
        ? `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
        : monthNames[d.getMonth()];
      memberGrowthMap.set(label, 0);
    }
    memberGrowthRaw.forEach(row => {
      if (memberGrowthMap.has(row.month)) {
        memberGrowthMap.set(row.month, row.count || 0);
      }
    });

    const savingsByMonth = await db
      .select({
        month: useYearMonth
          ? sql<string>`to_char(t.created_at, 'Mon YY')`
          : sql<string>`to_char(t.created_at, 'Mon')`,
        deposits: sql<number>`COALESCE(sum(CASE WHEN t.transaction_type = 'deposit' THEN t.amount ELSE 0 END), 0)::numeric`,
        withdrawals: sql<number>`COALESCE(sum(CASE WHEN t.transaction_type = 'withdrawal' THEN t.amount ELSE 0 END), 0)::numeric`,
      })
      .from(sql`transactions t`)
      .where(
        and(
          sql`t.created_at >= ${startDate}`,
          sql`t.status = 'completed'`,
          sql`t.transaction_type IN ('deposit', 'withdrawal')`
        )
      )
      .groupBy(useYearMonth
        ? sql`to_char(t.created_at, 'Mon YY')`
        : sql`to_char(t.created_at, 'Mon')`)
      .orderBy(sql`min(t.created_at)`);

    const loanDisbursementsByMonth = await db
      .select({
        month: useYearMonth
          ? sql<string>`to_char(disbursement_date, 'Mon YY')`
          : sql<string>`to_char(disbursement_date, 'Mon')`,
        total: sql<number>`COALESCE(sum(principal_amount), 0)::numeric`,
      })
      .from(loans)
      .where(
        and(
          sql`disbursement_date >= ${startDate}`,
          inArray(loans.status, ['approved', 'active', 'disbursed', 'closed'])
        )
      )
      .groupBy(useYearMonth
        ? sql`to_char(disbursement_date, 'Mon YY')`
        : sql`to_char(disbursement_date, 'Mon')`)
      .orderBy(sql`min(disbursement_date)`);

    const savingsMap = new Map<string, number>();
    const loansMap = new Map<string, number>();
    savingsByMonth.forEach(row => {
      const net = parseFloat(row.deposits?.toString() || '0') - parseFloat(row.withdrawals?.toString() || '0');
      savingsMap.set(row.month, net);
    });
    loanDisbursementsByMonth.forEach(row => {
      loansMap.set(row.month, parseFloat(row.total?.toString() || '0'));
    });

    const [currentSavingsTotal] = await db
      .select({ total: sql<number>`COALESCE(sum(balance), 0)::numeric` })
      .from(savingsAccounts);
    const [currentLoansTotal] = await db
      .select({ total: sql<number>`COALESCE(sum(outstanding_balance), 0)::numeric` })
      .from(loans);

    let runningSavings = parseFloat(currentSavingsTotal?.total?.toString() || '0');
    let runningLoans = parseFloat(currentLoansTotal?.total?.toString() || '0');

    const savingsVsLoansTimeline: Array<{ month: string; totalSavings: number; totalLoans: number }> = [];
    const orderedLabels: string[] = [];
    for (let i = lookbackMonths - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const label = useYearMonth
        ? `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
        : monthNames[d.getMonth()];
      orderedLabels.push(label);
    }

    const savingsDeltas: number[] = [];
    const loansDeltas: number[] = [];
    for (const label of orderedLabels) {
      savingsDeltas.push(savingsMap.get(label) || 0);
      loansDeltas.push(loansMap.get(label) || 0);
    }

    const totalSavingsDelta = savingsDeltas.reduce((a, b) => a + b, 0);
    const totalLoansDelta = loansDeltas.reduce((a, b) => a + b, 0);
    let baseSavings = runningSavings - totalSavingsDelta;
    let baseLoans = runningLoans - totalLoansDelta;

    for (let i = 0; i < orderedLabels.length; i++) {
      baseSavings += savingsDeltas[i];
      baseLoans += loansDeltas[i];
      savingsVsLoansTimeline.push({
        month: orderedLabels[i],
        totalSavings: Math.max(0, baseSavings),
        totalLoans: Math.max(0, baseLoans),
      });
    }

    const monthlyTransactions = Array.from(monthlyData.values()).map(item => ({
      month: item.month,
      deposits: parseFloat(item.deposits?.toString() || '0'),
      withdrawals: parseFloat(item.withdrawals?.toString() || '0'),
      loanPayments: parseFloat(item.loanPayments?.toString() || '0'),
    }));

    return {
      loanDistribution: loanDistribution.map(item => ({
        name: (item.loanType || 'Unknown').replace(/_/g, ' '),
        value: parseFloat(item.total?.toString() || '0'),
      })),
      monthlyTransactions,
      memberGrowth: Array.from(memberGrowthMap.entries()).map(([month, newMembers]) => ({
        month,
        newMembers,
      })),
      savingsVsLoans: savingsVsLoansTimeline.map(item => ({
        month: item.month,
        totalSavings: parseFloat(item.totalSavings?.toString() || '0'),
        totalLoans: parseFloat(item.totalLoans?.toString() || '0'),
      })),
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
      .where(and(eq(guarantors.guarantorMemberId, memberId), eq(guarantors.status, 'approved')));

    const detailedResults = await Promise.all(
      results.map(async (result) => {
        let loanWithDetails = null;
        if (result.loans) {
          loanWithDetails = await this.getLoan(result.loans.id);
        }
        return {
          ...result.guarantors,
          guarantorMember: result.members ? {
            ...result.members,
            user: result.users || undefined,
          } : undefined,
          loan: loanWithDetails || result.loans || undefined,
        };
      })
    );
    return detailedResults;
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

    // Fetch loan details with member information for each result
    const detailedResults = await Promise.all(
      results.map(async (result) => {
        let loanWithDetails = null;
        if (result.loans) {
          loanWithDetails = await this.getLoan(result.loans.id);
        }
        
        return {
          ...result.guarantors,
          guarantorMember: result.members ? {
            ...result.members,
            user: result.users || undefined,
          } : undefined,
          loan: loanWithDetails || undefined,
        };
      })
    );

    return detailedResults;
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

    return results.map(r => {
      const { password, twoFactorSecret, ...safeUser } = r.user || {} as any;
      return {
        ...r.log,
        user: r.user ? safeUser : undefined,
        member: r.member || undefined,
      };
    });
  }

  async getAuditLogsPaginated(page: number, limit: number, search?: string, resource?: string, action?: string): Promise<{ data: any[]; total: number }> {
    const conditions: any[] = [];
    if (search) {
      conditions.push(
        or(
          ilike(auditLogs.action, `%${search}%`),
          ilike(auditLogs.resource, `%${search}%`),
          ilike(auditLogs.details, `%${search}%`),
          ilike(users.username, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`)
        )
      );
    }
    if (resource) {
      conditions.push(eq(auditLogs.resource, resource));
    }
    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ value: count() })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause);

    const offset = (page - 1) * limit;
    const results = await db
      .select({ log: auditLogs, user: users, member: members })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(members, eq(auditLogs.memberId, members.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const data = results.map(r => {
      const { password, twoFactorSecret, ...safeUser } = r.user || {} as any;
      return {
        ...r.log,
        user: r.user ? safeUser : undefined,
        member: r.member || undefined,
      };
    });

    return { data, total: Number(countResult.value) };
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

  // RBAC operations implementation
  async getAllRoles(): Promise<Role[]> {
    return await db
      .select()
      .from(roles)
      .orderBy(roles.name);
  }

  async getRoleById(id: number): Promise<Role | undefined> {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, id));
    return role;
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, name));
    return role;
  }

  async createRole(roleData: InsertRole): Promise<Role> {
    const [role] = await db
      .insert(roles)
      .values(roleData)
      .returning();
    return role;
  }

  async updateRole(id: number, updates: Partial<InsertRole>): Promise<Role> {
    const [role] = await db
      .update(roles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return role;
  }

  async deleteRole(id: number): Promise<void> {
    await db.delete(roles).where(eq(roles.id, id));
  }

  async getAllPermissions(): Promise<Permission[]> {
    return await db
      .select()
      .from(permissions)
      .orderBy(permissions.category, permissions.resource, permissions.action);
  }

  async getPermissionsByRole(roleId: number): Promise<Permission[]> {
    const result = await db
      .select({
        permission: permissions,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    
    return result.map(r => r.permission);
  }

  async assignPermissionsToRole(roleId: number, permissionIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete existing permissions
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      
      // Insert new permissions
      if (permissionIds.length > 0) {
        await tx.insert(rolePermissions).values(
          permissionIds.map(permissionId => ({
            roleId,
            permissionId,
          }))
        );
      }
    });
  }

  async getRolePermissions(roleId: number): Promise<RolePermission[]> {
    return await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
  }

  async getMemberPermissions(memberId: number): Promise<Permission[]> {
    // Get all roles for the member
    const memberRolesData = await db
      .select({ roleId: memberRoles.role })
      .from(memberRoles)
      .where(eq(memberRoles.memberId, memberId));
    
    // Get role IDs from the new roles table for each role name
    const roleIds: number[] = [];
    for (const { roleId } of memberRolesData) {
      const role = await this.getRoleByName(roleId);
      if (role) {
        roleIds.push(role.id);
      }
    }
    
    if (roleIds.length === 0) return [];
    
    // Get all permissions for these roles
    const result = await db
      .selectDistinct({
        permission: permissions,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(sql`${rolePermissions.roleId} IN (${sql.join(roleIds, sql`, `)})`);
    
    return result.map(r => r.permission);
  }

  // Interest rate management
  async createInterestRate(rateData: InsertInterestRate): Promise<InterestRate> {
    const [rate] = await db
      .insert(interestRates)
      .values(rateData)
      .returning();
    return rate;
  }

  async getInterestRate(id: number): Promise<InterestRate | undefined> {
    const [rate] = await db
      .select()
      .from(interestRates)
      .where(eq(interestRates.id, id));
    return rate;
  }

  async getActiveInterestRates(): Promise<InterestRate[]> {
    return await db
      .select()
      .from(interestRates)
      .where(eq(interestRates.isActive, true))
      .orderBy(interestRates.productType);
  }

  async getInterestRateByProduct(productType: string): Promise<InterestRate | undefined> {
    const [rate] = await db
      .select()
      .from(interestRates)
      .where(
        and(
          eq(interestRates.productType, productType as any),
          eq(interestRates.isActive, true)
        )
      )
      .orderBy(desc(interestRates.effectiveDate));
    return rate;
  }

  async updateInterestRate(id: number, updates: Partial<InsertInterestRate>): Promise<InterestRate> {
    const [rate] = await db
      .update(interestRates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(interestRates.id, id))
      .returning();
    return rate;
  }

  async deactivateInterestRate(id: number): Promise<InterestRate> {
    const [rate] = await db
      .update(interestRates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(interestRates.id, id))
      .returning();
    return rate;
  }

  // Amortization schedule operations
  async createAmortizationSchedule(schedules: InsertAmortizationSchedule[]): Promise<AmortizationSchedule[]> {
    return await db
      .insert(amortizationSchedules)
      .values(schedules)
      .returning();
  }

  async getAmortizationSchedule(loanId: number): Promise<AmortizationScheduleWithDetails[]> {
    const results = await db
      .select()
      .from(amortizationSchedules)
      .leftJoin(loans, eq(amortizationSchedules.loanId, loans.id))
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(amortizationSchedules.loanId, loanId))
      .orderBy(amortizationSchedules.paymentNumber);

    return results.map(result => ({
      ...result.amortization_schedules,
      loan: result.loans ? {
        ...result.loans,
        member: result.members ? {
          ...result.members,
          user: result.users || undefined,
        } : undefined,
      } : undefined,
    }));
  }

  async updateSchedulePayment(id: number, actualAmount: string, paymentDate: Date): Promise<AmortizationSchedule> {
    const [schedule] = await db
      .update(amortizationSchedules)
      .set({
        actualAmountPaid: actualAmount,
        actualPaymentDate: paymentDate,
        status: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(amortizationSchedules.id, id))
      .returning();
    return schedule;
  }

  async getOverduePayments(): Promise<AmortizationScheduleWithDetails[]> {
    const results = await db
      .select()
      .from(amortizationSchedules)
      .leftJoin(loans, eq(amortizationSchedules.loanId, loans.id))
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(
        and(
          eq(amortizationSchedules.status, 'pending'),
          sql`${amortizationSchedules.paymentDate} < NOW()`
        )
      )
      .orderBy(amortizationSchedules.paymentDate);

    return results.map(result => ({
      ...result.amortization_schedules,
      loan: result.loans ? {
        ...result.loans,
        member: result.members ? {
          ...result.members,
          user: result.users || undefined,
        } : undefined,
      } : undefined,
    }));
  }

  async getUpcomingPayments(days: number): Promise<AmortizationScheduleWithDetails[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const results = await db
      .select()
      .from(amortizationSchedules)
      .leftJoin(loans, eq(amortizationSchedules.loanId, loans.id))
      .leftJoin(members, eq(loans.memberId, members.id))
      .leftJoin(users, eq(members.userId, users.id))
      .where(
        and(
          eq(amortizationSchedules.status, 'pending'),
          sql`${amortizationSchedules.paymentDate} BETWEEN NOW() AND ${futureDate}`
        )
      )
      .orderBy(amortizationSchedules.paymentDate);

    return results.map(result => ({
      ...result.amortization_schedules,
      loan: result.loans ? {
        ...result.loans,
        member: result.members ? {
          ...result.members,
          user: result.users || undefined,
        } : undefined,
      } : undefined,
    }));
  }

  // Interest calculation operations
  async createInterestCalculation(calculation: InsertInterestCalculation): Promise<InterestCalculation> {
    const [calc] = await db
      .insert(interestCalculations)
      .values(calculation)
      .returning();
    return calc;
  }

  async calculateAndSaveInterest(loanId: number): Promise<InterestCalculationResult> {
    const loan = await this.getLoan(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }

    const loanType = loan.loanType ?? 'normal_loan';
    const interestRate = await this.getInterestRateByProduct(loanType);
    const rate = interestRate ? Number(interestRate.baseRate) : InterestCalculator.getRecommendedRate(loanType, Number(loan.principalAmount));

    const result = InterestCalculator.calculateReducingBalancePayment(
      Number(loan.principalAmount),
      rate,
      loan.termMonths
    );

    // Save calculation record
    await this.createInterestCalculation(
      InterestCalculator.createCalculationRecord(
        loanId,
        'reducing_balance',
        Number(loan.principalAmount),
        rate,
        loan.termMonths / 12,
        result,
        'PMT = P * [r(1+r)^n] / [(1+r)^n - 1]',
        `Calculated for ${loanType} loan`
      )
    );

    return {
      totalInterest: result * loan.termMonths - Number(loan.principalAmount),
      monthlyPayment: result,
      totalAmount: result * loan.termMonths,
      effectiveRate: rate
    };
  }

  // Advanced loan calculations
  async generateLoanAmortization(loanId: number): Promise<AmortizationSchedule[]> {
    const loan = await this.getLoan(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }

    const loanTypeName = loan.loanType ?? 'normal_loan';
    const interestRate = await this.getInterestRateByProduct(loanTypeName);
    const rate = interestRate ? Number(interestRate.baseRate) : InterestCalculator.getRecommendedRate(loanTypeName, Number(loan.principalAmount));

    const activeLoanTypes = await this.getActiveLoanTypes();
    const loanTypeConfig = activeLoanTypes.find(lt => lt.name === loanTypeName);
    const interestType = (loanTypeConfig?.interestType as 'simple' | 'compound' | 'reducing_balance') || 'reducing_balance';
    const compoundingFrequency = loanTypeConfig?.compoundingFrequency || 'monthly';

    const outstanding = Number(loan.outstandingBalance || 0);
    const principal = Number(loan.principalAmount);
    const schedulePrincipal = (outstanding > 0 && outstanding < principal) ? outstanding : principal;

    const scheduleData = InterestCalculator.generateAmortizationSchedule(
      loanId,
      schedulePrincipal,
      rate,
      loan.termMonths,
      loan.disbursementDate || new Date(),
      'monthly',
      interestType,
      compoundingFrequency
    );

    return await this.createAmortizationSchedule(scheduleData);
  }

  async recalculateLoanSchedule(loanId: number, newRate?: number): Promise<AmortizationSchedule[]> {
    const loan = await this.getLoan(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }

    await db.delete(amortizationSchedules).where(eq(amortizationSchedules.loanId, loanId));

    const loanTypeName = loan.loanType ?? 'normal_loan';
    const rate = newRate || InterestCalculator.getRecommendedRate(loanTypeName, Number(loan.principalAmount));

    const activeLoanTypes = await this.getActiveLoanTypes();
    const loanTypeConfig = activeLoanTypes.find(lt => lt.name === loanTypeName);
    const interestType = (loanTypeConfig?.interestType as 'simple' | 'compound' | 'reducing_balance') || 'reducing_balance';
    const compoundingFrequency = loanTypeConfig?.compoundingFrequency || 'monthly';

    const outstanding = Number(loan.outstandingBalance || 0);
    const principal = Number(loan.principalAmount);
    const schedulePrincipal = (outstanding > 0 && outstanding < principal) ? outstanding : principal;

    const scheduleData = InterestCalculator.generateAmortizationSchedule(
      loanId,
      schedulePrincipal,
      rate,
      loan.termMonths,
      loan.disbursementDate || new Date(),
      'monthly',
      interestType,
      compoundingFrequency
    );

    return await this.createAmortizationSchedule(scheduleData);
  }

  async calculateEarlyPaymentSavings(loanId: number, paymentDate: Date, amount: number): Promise<{
    interestSaved: number;
    newBalance: number;
    revisedSchedule: AmortizationSchedule[];
  }> {
    const loan = await this.getLoan(loanId);
    const schedule = await this.getAmortizationSchedule(loanId);
    
    if (!loan || !schedule.length) {
      throw new Error('Loan or schedule not found');
    }

    // Calculate current outstanding balance at payment date
    const unpaidSchedule = schedule.filter(s => s.status === 'pending' && new Date(s.paymentDate) <= paymentDate);
    const currentBalance = unpaidSchedule.reduce((total, payment) => total + Number(payment.outstandingBalance), 0);

    // Calculate new balance after early payment
    const newBalance = Math.max(0, currentBalance - amount);

    // Calculate interest saved (simplified calculation)
    const remainingSchedule = schedule.filter(s => s.status === 'pending' && new Date(s.paymentDate) > paymentDate);
    const originalInterest = remainingSchedule.reduce((total, payment) => total + Number(payment.interestAmount), 0);

    // If paying off completely, save all remaining interest
    const interestSaved = newBalance === 0 ? originalInterest : originalInterest * (amount / currentBalance);

    // Generate revised schedule if needed
    let revisedSchedule: AmortizationSchedule[] = [];
    if (newBalance > 0) {
      const remainingTerm = remainingSchedule.length;
      const interestRate = await this.getInterestRateByProduct(loan.loanType ?? 'normal_loan');
      const rate = interestRate ? Number(interestRate.baseRate) : 12;

      const newScheduleData = InterestCalculator.generateAmortizationSchedule(
        loanId,
        newBalance,
        rate,
        remainingTerm,
        paymentDate
      );

      revisedSchedule = await this.createAmortizationSchedule(newScheduleData);
    }

    return {
      interestSaved,
      newBalance,
      revisedSchedule
    };
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  async getNotifications(userId: string, filters?: {
    isRead?: boolean;
    type?: string;
    priority?: string;
    limit?: number;
  }): Promise<Notification[]> {
    let conditions = [eq(notifications.userId, userId)];

    if (filters?.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead));
    }
    if (filters?.type) {
      conditions.push(eq(notifications.type, filters.type as any));
    }
    if (filters?.priority) {
      conditions.push(eq(notifications.priority, filters.priority as any));
    }

    const query = db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .$dynamic();

    if (filters?.limit) {
      return await query.limit(filters.limit);
    }

    return await query;
  }

  async getNotificationsPaginated(userId: string, page: number, limit: number): Promise<{ data: Notification[]; total: number }> {
    const [countResult] = await db
      .select({ value: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));

    const offset = (page - 1) * limit;
    const data = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total: Number(countResult.value) };
  }

  async markNotificationAsRead(id: number, userId: string): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ 
        isRead: true,
        readAt: new Date()
      })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ 
        isRead: true,
        readAt: new Date()
      })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
  }

  async deleteNotification(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return Number(result[0]?.count || 0);
  }

  // Loan Types operations
  async createLoanType(loanTypeData: InsertLoanType): Promise<LoanType> {
    const [loanType] = await db
      .insert(loanTypes)
      .values(loanTypeData)
      .returning();
    return loanType;
  }

  async getLoanType(id: number): Promise<LoanTypeWithTerms | undefined> {
    const [loanType] = await db
      .select()
      .from(loanTypes)
      .where(eq(loanTypes.id, id));

    if (!loanType) return undefined;

    const terms = await this.getLoanTermsByType(id);
    
    return {
      ...loanType,
      terms,
    };
  }

  async getLoanTypeByName(name: string): Promise<LoanTypeWithTerms | undefined> {
    const [loanType] = await db
      .select()
      .from(loanTypes)
      .where(eq(loanTypes.name, name));

    if (!loanType) return undefined;

    const terms = await this.getLoanTermsByType(loanType.id);
    
    return {
      ...loanType,
      terms,
    };
  }

  async getAllLoanTypes(): Promise<LoanTypeWithTerms[]> {
    const allTypes = await db
      .select()
      .from(loanTypes)
      .orderBy(loanTypes.displayName);

    const typesWithTerms = await Promise.all(
      allTypes.map(async (type) => {
        const terms = await this.getLoanTermsByType(type.id);
        return {
          ...type,
          terms,
        };
      })
    );

    return typesWithTerms;
  }

  async getActiveLoanTypes(): Promise<LoanTypeWithTerms[]> {
    const activeTypes = await db
      .select()
      .from(loanTypes)
      .where(eq(loanTypes.isActive, true))
      .orderBy(loanTypes.displayName);

    const typesWithTerms = await Promise.all(
      activeTypes.map(async (type) => {
        const terms = await this.getLoanTermsByType(type.id);
        return {
          ...type,
          terms,
        };
      })
    );

    return typesWithTerms;
  }

  async updateLoanType(id: number, updates: Partial<InsertLoanType>): Promise<LoanType> {
    const [updated] = await db
      .update(loanTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(loanTypes.id, id))
      .returning();
    return updated;
  }

  async deleteLoanType(id: number): Promise<boolean> {
    try {
      await db.delete(loanTypes).where(eq(loanTypes.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting loan type:', error);
      return false;
    }
  }

  // Loan Terms operations
  async createLoanTerm(loanTermData: InsertLoanTerm): Promise<LoanTerm> {
    const [loanTerm] = await db
      .insert(loanTerms)
      .values(loanTermData)
      .returning();
    return loanTerm;
  }

  async getLoanTerm(id: number): Promise<LoanTerm | undefined> {
    const [loanTerm] = await db
      .select()
      .from(loanTerms)
      .where(eq(loanTerms.id, id));
    return loanTerm || undefined;
  }

  async getLoanTermsByType(loanTypeId: number): Promise<LoanTerm[]> {
    const terms = await db
      .select()
      .from(loanTerms)
      .where(eq(loanTerms.loanTypeId, loanTypeId))
      .orderBy(loanTerms.sortOrder, loanTerms.termName);
    return terms;
  }

  async updateLoanTerm(id: number, updates: Partial<InsertLoanTerm>): Promise<LoanTerm> {
    const [updated] = await db
      .update(loanTerms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(loanTerms.id, id))
      .returning();
    return updated;
  }

  async deleteLoanTerm(id: number): Promise<boolean> {
    try {
      await db.delete(loanTerms).where(eq(loanTerms.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting loan term:', error);
      return false;
    }
  }

  // ===== INTEREST CALCULATIONS METHODS =====

  async createFinancialYear(financialYear: InsertFinancialYear): Promise<FinancialYear> {
    const [year] = await db
      .insert(financialYears)
      .values(financialYear)
      .returning();
    return year;
  }

  async getFinancialYear(id: number): Promise<FinancialYear | undefined> {
    const [year] = await db
      .select()
      .from(financialYears)
      .where(eq(financialYears.id, id));
    return year;
  }

  async getAllFinancialYears(): Promise<FinancialYear[]> {
    return await db
      .select()
      .from(financialYears)
      .orderBy(desc(financialYears.startDate));
  }

  async getActiveFinancialYear(): Promise<FinancialYear | undefined> {
    const [year] = await db
      .select()
      .from(financialYears)
      .where(eq(financialYears.isActive, true));
    return year;
  }

  async updateFinancialYear(id: number, updates: Partial<InsertFinancialYear>): Promise<FinancialYear> {
    const [year] = await db
      .update(financialYears)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(financialYears.id, id))
      .returning();
    return year;
  }

  async setActiveFinancialYear(id: number): Promise<FinancialYear> {
    // First, deactivate all other financial years
    await db
      .update(financialYears)
      .set({ isActive: false, updatedAt: new Date() });
    
    // Then activate the specified one
    const [year] = await db
      .update(financialYears)
      .set({ isActive: true, status: 'active', updatedAt: new Date() })
      .where(eq(financialYears.id, id))
      .returning();
    return year;
  }

  async createBalanceSnapshot(snapshot: InsertBalanceSnapshot): Promise<BalanceSnapshot> {
    const [balanceSnapshot] = await db
      .insert(balanceSnapshots)
      .values(snapshot)
      .returning();
    return balanceSnapshot;
  }

  async getBalanceSnapshots(savingsAccountId: number, financialYearId?: number): Promise<BalanceSnapshot[]> {
    const conditions = [eq(balanceSnapshots.savingsAccountId, savingsAccountId)];
    if (financialYearId) {
      conditions.push(eq(balanceSnapshots.financialYearId, financialYearId));
    }
    
    return await db
      .select()
      .from(balanceSnapshots)
      .where(and(...conditions))
      .orderBy(balanceSnapshots.snapshotDate);
  }

  async createBalanceSnapshotsForAllAccounts(financialYearId: number, snapshotDate: string): Promise<BalanceSnapshot[]> {
    // Get all active savings accounts
    const accounts = await db
      .select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.status, 'active'));

    const snapshots = [];
    for (const account of accounts) {
      try {
        const snapshot = await this.createBalanceSnapshot({
          savingsAccountId: account.id,
          memberId: account.memberId,
          snapshotDate,
          balance: account.balance ?? '0.00',
          financialYearId,
        });
        snapshots.push(snapshot);
      } catch (error) {
        console.error(`Error creating snapshot for account ${account.accountNumber}:`, error);
      }
    }
    
    return snapshots;
  }

  async calculateInterestForMember(memberId: number, financialYearId: number): Promise<InterestCalculation> {
    const financialYear = await this.getFinancialYear(financialYearId);
    if (!financialYear) {
      throw new Error('Financial year not found');
    }

    const existingCalcs = await db
      .select()
      .from(interestCalculations)
      .where(and(
        eq(interestCalculations.memberId, memberId),
        eq(interestCalculations.financialYearId, financialYearId)
      ));
    if (existingCalcs.length > 0) {
      throw new Error(`Interest already calculated for this member in financial year ${financialYear.yearLabel}`);
    }

    const accounts = await this.getSavingsAccountsByMember(memberId);
    if (accounts.length === 0) {
      throw new Error('No savings accounts found for member');
    }

    const account = accounts[0];

    const fyStartDate = financialYear.startDate;
    const fyEndDate = financialYear.endDate;

    const depositResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total_deposits
      FROM transactions
      WHERE member_id = ${memberId}
        AND savings_account_id = ${account.id}
        AND transaction_type = 'deposit'
        AND status = 'completed'
        AND transaction_date >= ${fyStartDate}::date
        AND transaction_date < ${fyEndDate}::date + interval '1 day'
    `);
    const depositRows = (depositResult as any).rows || depositResult;
    const totalDeposits = parseFloat(depositRows[0]?.total_deposits || '0');

    const interestRate = parseFloat(financialYear.interestRate ?? '0.0500');
    const grossInterest = totalDeposits * interestRate;
    const netInterest = grossInterest;

    const calculation = {
      financialYearId,
      savingsAccountId: account.id,
      memberId,
      calculationDate: new Date().toISOString().split('T')[0],
      periodStartDate: financialYear.startDate,
      periodEndDate: financialYear.endDate,
      averageBalance: totalDeposits.toString(),
      interestRate: financialYear.interestRate ?? '0.0500',
      grossInterest: grossInterest.toString(),
      taxAmount: '0',
      netInterest: netInterest.toString(),
      status: 'calculated' as const,
      calculationMethod: 'simple' as const,
      notes: `Interest on savings deposits for FY ${financialYear.yearLabel}. Total deposits: UGX ${totalDeposits.toLocaleString()}`,
    };

    const [result] = await db
      .insert(interestCalculations)
      .values(calculation)
      .returning();
    
    return result;
  }

  async calculateInterestForAllMembers(financialYearId: number): Promise<InterestCalculation[]> {
    const members = await this.getAllMembers();
    const calculations = [];

    for (const member of members) {
      if (member.status === 'active') {
        try {
          const calculation = await this.calculateInterestForMember(member.id, financialYearId);
          calculations.push(calculation);
        } catch (error) {
          console.error(`Error calculating interest for member ${member.memberNumber}:`, error);
        }
      }
    }

    return calculations;
  }

  async getInterestCalculations(financialYearId?: number): Promise<any[]> {
    const baseQuery = db
      .select({
        calculation: interestCalculations,
        memberName: members.fullName,
        memberNumber: members.memberNumber,
      })
      .from(interestCalculations)
      .leftJoin(members, eq(interestCalculations.memberId, members.id));
    
    const results = financialYearId
      ? await baseQuery.where(eq(interestCalculations.financialYearId, financialYearId))
      : await baseQuery.orderBy(desc(interestCalculations.createdAt));

    return results.map(r => ({
      ...r.calculation,
      memberName: r.memberName,
      memberNumber: r.memberNumber,
    }));
  }

  async getInterestCalculationsByMember(memberId: number): Promise<InterestCalculation[]> {
    return await db
      .select()
      .from(interestCalculations)
      .where(eq(interestCalculations.memberId, memberId))
      .orderBy(desc(interestCalculations.createdAt));
  }

  async approveInterestCalculation(id: number, approvedBy: string): Promise<InterestCalculation> {
    const [calculation] = await db
      .update(interestCalculations)
      .set({ 
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(interestCalculations.id, id))
      .returning();
    return calculation;
  }

  async postInterestCalculation(id: number): Promise<InterestCalculation> {
    const [calculation] = await db
      .update(interestCalculations)
      .set({ 
        status: 'posted',
        postedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(interestCalculations.id, id))
      .returning();

    if (calculation && parseFloat(calculation.grossInterest) > 0) {
      const today = new Date().toISOString().split('T')[0];
      const refNumber = `INT${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const [payment] = await db
        .insert(interestPayments)
        .values({
          interestCalculationId: calculation.id,
          memberId: calculation.memberId,
          savingsAccountId: calculation.savingsAccountId,
          paymentAmount: calculation.grossInterest,
          paymentMethod: 'credit_to_account',
          paymentDate: today,
          transactionReference: refNumber,
          status: 'completed',
          processedBy: calculation.calculatedBy,
        })
        .returning();

      await db
        .update(savingsAccounts)
        .set({
          balance: sql`${savingsAccounts.balance} + ${calculation.grossInterest}`,
          updatedAt: new Date()
        })
        .where(eq(savingsAccounts.id, calculation.savingsAccountId));
      this.syncMemberTotalSavings(calculation.memberId);

      await this.createTransaction({
        memberId: calculation.memberId,
        savingsAccountId: calculation.savingsAccountId,
        transactionType: 'interest_credit',
        amount: calculation.grossInterest,
        referenceNumber: refNumber,
        description: `Interest credit - ${calculation.calculationMethod} method`,
        status: 'completed',
        processedBy: calculation.calculatedBy,
      });
    }

    return calculation;
  }

  async createInterestPayment(payment: InsertInterestPayment): Promise<InterestPayment> {
    const [result] = await db
      .insert(interestPayments)
      .values(payment)
      .returning();
    return result;
  }

  async getInterestPayments(financialYearId?: number): Promise<any[]> {
    if (financialYearId) {
      const results = await db
        .select({
          payment: interestPayments,
          calculation: interestCalculations,
          memberName: members.fullName,
          memberNumber: members.memberNumber,
        })
        .from(interestPayments)
        .leftJoin(interestCalculations, eq(interestPayments.interestCalculationId, interestCalculations.id))
        .leftJoin(members, eq(interestPayments.memberId, members.id))
        .where(eq(interestCalculations.financialYearId, financialYearId))
        .orderBy(desc(interestPayments.createdAt));
      
      return results.map(r => ({
        ...r.payment,
        transactionReference: r.payment.transactionReference,
        memberName: r.memberName,
        memberNumber: r.memberNumber,
      }));
    }
    
    const results = await db
      .select({
        payment: interestPayments,
        memberName: members.fullName,
        memberNumber: members.memberNumber,
      })
      .from(interestPayments)
      .leftJoin(members, eq(interestPayments.memberId, members.id))
      .orderBy(desc(interestPayments.createdAt));

    return results.map(r => ({
      ...r.payment,
      transactionReference: r.payment.transactionReference,
      memberName: r.memberName,
      memberNumber: r.memberNumber,
    }));
  }

  async getInterestPaymentsByMember(memberId: number): Promise<InterestPayment[]> {
    const results = await db
      .select()
      .from(interestPayments)
      .where(eq(interestPayments.memberId, memberId))
      .orderBy(desc(interestPayments.createdAt));

    return results.map(r => ({
      ...r,
      transactionReference: r.transactionReference
    }));
  }

  async processInterestPayment(id: number, processedBy: string): Promise<InterestPayment> {
    const [payment] = await db
      .update(interestPayments)
      .set({ 
        status: 'completed',
        processedBy,
        updatedAt: new Date()
      })
      .where(eq(interestPayments.id, id))
      .returning();

    // Credit the amount to the member's savings account
    if (payment.paymentMethod === 'credit_to_account') {
      await db
        .update(savingsAccounts)
        .set({
          balance: sql`${savingsAccounts.balance} + ${payment.paymentAmount}`,
          updatedAt: new Date()
        })
        .where(eq(savingsAccounts.id, payment.savingsAccountId));
      this.syncMemberTotalSavings(payment.memberId);

      // Create a transaction record
      await this.createTransaction({
        memberId: payment.memberId,
        savingsAccountId: payment.savingsAccountId,
        transactionType: 'interest_credit',
        amount: payment.paymentAmount,
        description: `Interest payment for Financial Year`,
        referenceNumber: payment.transactionReference || `INT-${Date.now()}`,
        status: 'completed',
        processedBy,
        transactionDate: new Date(),
      });
    }

    return payment;
  }

  async generateInterestReport(financialYearId: number): Promise<any> {
    const financialYear = await this.getFinancialYear(financialYearId);
    const calculations = await this.getInterestCalculations(financialYearId);
    const payments = await this.getInterestPayments(financialYearId);

    const totalGrossInterest = calculations.reduce((sum, calc) => 
      sum + parseFloat(calc.grossInterest), 0);
    const totalTaxAmount = calculations.reduce((sum, calc) => 
      sum + parseFloat(calc.taxAmount ?? '0'), 0);
    const totalNetInterest = calculations.reduce((sum, calc) => 
      sum + parseFloat(calc.netInterest), 0);
    const totalPaid = payments.reduce((sum, payment) => 
      sum + parseFloat(payment.paymentAmount), 0);

    return {
      financialYear,
      summary: {
        totalMembers: calculations.length,
        totalGrossInterest,
        totalTaxAmount,
        totalNetInterest,
        totalPaid,
        pendingPayments: totalNetInterest - totalPaid,
      },
      calculations,
      payments,
    };
  }
  async resolveMemberId(idOrUuid: string): Promise<number> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrUuid)) {
      const [member] = await db.select({ id: members.id }).from(members).where(eq(members.uuid, idOrUuid));
      if (!member) throw new Error('Member not found');
      return member.id;
    }
    const numericId = parseInt(idOrUuid, 10);
    if (isNaN(numericId)) throw new Error('Invalid member identifier');
    return numericId;
  }

  async resolveLoanId(idOrUuid: string): Promise<number> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrUuid)) {
      const [loan] = await db.select({ id: loans.id }).from(loans).where(eq(loans.uuid, idOrUuid));
      if (!loan) throw new Error('Loan not found');
      return loan.id;
    }
    const numericId = parseInt(idOrUuid, 10);
    if (isNaN(numericId)) throw new Error('Invalid loan identifier');
    return numericId;
  }

  async resolveSavingsAccountId(idOrUuid: string): Promise<number> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrUuid)) {
      const [account] = await db.select({ id: savingsAccounts.id }).from(savingsAccounts).where(eq(savingsAccounts.uuid, idOrUuid));
      if (!account) throw new Error('Savings account not found');
      return account.id;
    }
    const numericId = parseInt(idOrUuid, 10);
    if (isNaN(numericId)) throw new Error('Invalid savings account identifier');
    return numericId;
  }

  async resolveTransactionId(idOrUuid: string): Promise<number> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrUuid)) {
      const [txn] = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.uuid, idOrUuid));
      if (!txn) throw new Error('Transaction not found');
      return txn.id;
    }
    const numericId = parseInt(idOrUuid, 10);
    if (isNaN(numericId)) throw new Error('Invalid transaction identifier');
    return numericId;
  }

  async resolveGuarantorId(idOrUuid: string): Promise<number> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrUuid)) {
      const [g] = await db.select({ id: guarantors.id }).from(guarantors).where(eq(guarantors.uuid, idOrUuid));
      if (!g) throw new Error('Guarantor not found');
      return g.id;
    }
    const numericId = parseInt(idOrUuid, 10);
    if (isNaN(numericId)) throw new Error('Invalid guarantor identifier');
    return numericId;
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key));
    return setting || undefined;
  }

  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }

  async upsertSystemSetting(key: string, value: string, type?: string, description?: string, updatedBy?: string): Promise<SystemSetting> {
    const existing = await this.getSystemSetting(key);
    if (existing) {
      const [updated] = await db.update(systemSettings)
        .set({ settingValue: value, settingType: type || existing.settingType, description: description || existing.description, updatedBy: updatedBy || existing.updatedBy, updatedAt: new Date() })
        .where(eq(systemSettings.settingKey, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(systemSettings)
        .values({ settingKey: key, settingValue: value, settingType: type || 'string', description, updatedBy })
        .returning();
      return created;
    }
  }

  async getUserSettings(userId: string): Promise<string | null> {
    const [result] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return result ? result.settingsJson : null;
  }

  async upsertUserSettings(userId: string, settingsJson: string): Promise<void> {
    const existing = await this.getUserSettings(userId);
    if (existing !== null) {
      await db.update(userSettings)
        .set({ settingsJson, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings)
        .values({ userId, settingsJson });
    }
  }

  async getSaccoAccounts(filters?: { accountType?: string; isActive?: boolean }): Promise<SaccoAccount[]> {
    const conditions = [];
    if (filters?.accountType) {
      conditions.push(eq(saccoAccounts.accountType, filters.accountType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(saccoAccounts.isActive, filters.isActive));
    }
    return db.select().from(saccoAccounts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(saccoAccounts.accountCode);
  }

  async getSaccoAccount(id: number): Promise<SaccoAccount | undefined> {
    const [account] = await db.select().from(saccoAccounts).where(eq(saccoAccounts.id, id));
    return account;
  }

  async createSaccoAccount(data: InsertSaccoAccount): Promise<SaccoAccount> {
    const [account] = await db.insert(saccoAccounts).values(data).returning();
    return account;
  }

  async updateSaccoAccount(id: number, data: Partial<InsertSaccoAccount>): Promise<SaccoAccount> {
    const [account] = await db.update(saccoAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(saccoAccounts.id, id))
      .returning();
    return account;
  }

  async getSaccoJournalEntries(filters?: { page?: number; limit?: number; accountId?: number; startDate?: string; endDate?: string }): Promise<{ data: any[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 25;
    const offset = (page - 1) * limit;

    const conditions = [];
    conditions.push(eq(saccoJournalEntries.status, 'posted'));
    if (filters?.accountId) {
      conditions.push(or(
        eq(saccoJournalEntries.debitAccountId, filters.accountId),
        eq(saccoJournalEntries.creditAccountId, filters.accountId)
      )!);
    }
    if (filters?.startDate) {
      conditions.push(gte(saccoJournalEntries.entryDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(saccoJournalEntries.entryDate, filters.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const debitAccount = db.select().from(saccoAccounts).as('debit_acc');
    const creditAccount = db.select().from(saccoAccounts).as('credit_acc');

    const entries = await db
      .select({
        entry: saccoJournalEntries,
        debitAccountName: sql<string>`(SELECT account_name FROM sacco_accounts WHERE id = ${saccoJournalEntries.debitAccountId})`,
        debitAccountCode: sql<string>`(SELECT account_code FROM sacco_accounts WHERE id = ${saccoJournalEntries.debitAccountId})`,
        creditAccountName: sql<string>`(SELECT account_name FROM sacco_accounts WHERE id = ${saccoJournalEntries.creditAccountId})`,
        creditAccountCode: sql<string>`(SELECT account_code FROM sacco_accounts WHERE id = ${saccoJournalEntries.creditAccountId})`,
        createdByName: sql<string>`(SELECT COALESCE(first_name || ' ' || last_name, username) FROM users WHERE id = ${saccoJournalEntries.createdBy})`,
      })
      .from(saccoJournalEntries)
      .where(whereClause)
      .orderBy(desc(saccoJournalEntries.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(saccoJournalEntries)
      .where(whereClause);

    return {
      data: entries.map(e => ({
        ...e.entry,
        debitAccountName: e.debitAccountName,
        debitAccountCode: e.debitAccountCode,
        creditAccountName: e.creditAccountName,
        creditAccountCode: e.creditAccountCode,
        createdByName: e.createdByName,
      })),
      total: totalResult?.count || 0,
    };
  }

  async getSaccoJournalEntry(id: number): Promise<any> {
    const [entry] = await db
      .select({
        entry: saccoJournalEntries,
        debitAccountName: sql<string>`(SELECT account_name FROM sacco_accounts WHERE id = ${saccoJournalEntries.debitAccountId})`,
        creditAccountName: sql<string>`(SELECT account_name FROM sacco_accounts WHERE id = ${saccoJournalEntries.creditAccountId})`,
      })
      .from(saccoJournalEntries)
      .where(eq(saccoJournalEntries.id, id));
    if (!entry) return undefined;
    return { ...entry.entry, debitAccountName: entry.debitAccountName, creditAccountName: entry.creditAccountName };
  }

  async createSaccoJournalEntry(data: InsertSaccoJournalEntry): Promise<SaccoJournalEntry> {
    return await db.transaction(async (tx) => {
      const [debitAccount] = await tx.select().from(saccoAccounts).where(eq(saccoAccounts.id, data.debitAccountId));
      const [creditAccount] = await tx.select().from(saccoAccounts).where(eq(saccoAccounts.id, data.creditAccountId));
      if (!debitAccount || !creditAccount) throw new Error("Invalid account IDs");

      const amount = parseFloat(data.amount);
      if (isNaN(amount) || amount <= 0) throw new Error("Amount must be a positive number");
      if (data.debitAccountId === data.creditAccountId) throw new Error("Debit and credit accounts must be different");

      const debitDelta = ['asset', 'expense'].includes(debitAccount.accountType) ? amount : -amount;
      const creditDelta = ['liability', 'equity', 'revenue'].includes(creditAccount.accountType) ? amount : -amount;

      await tx.update(saccoAccounts)
        .set({ balance: sql`(${saccoAccounts.balance}::numeric + ${debitDelta})::decimal(15,2)`, updatedAt: new Date() })
        .where(eq(saccoAccounts.id, data.debitAccountId));

      await tx.update(saccoAccounts)
        .set({ balance: sql`(${saccoAccounts.balance}::numeric + ${creditDelta})::decimal(15,2)`, updatedAt: new Date() })
        .where(eq(saccoAccounts.id, data.creditAccountId));

      const [entry] = await tx.insert(saccoJournalEntries).values(data).returning();
      return entry;
    });
  }

  async reverseSaccoJournalEntry(id: number, userId: string): Promise<SaccoJournalEntry> {
    return await db.transaction(async (tx) => {
      const [original] = await tx.select().from(saccoJournalEntries).where(eq(saccoJournalEntries.id, id));
      if (!original) throw new Error("Journal entry not found");
      if (original.status === 'reversed') throw new Error("Entry is already reversed");

      await tx.update(saccoJournalEntries)
        .set({ status: 'reversed' })
        .where(eq(saccoJournalEntries.id, id));

      const [debitAccount] = await tx.select().from(saccoAccounts).where(eq(saccoAccounts.id, original.creditAccountId));
      const [creditAccount] = await tx.select().from(saccoAccounts).where(eq(saccoAccounts.id, original.debitAccountId));
      if (!debitAccount || !creditAccount) throw new Error("Original accounts no longer exist");

      const amount = parseFloat(original.amount);
      const debitDelta = ['asset', 'expense'].includes(debitAccount.accountType) ? amount : -amount;
      const creditDelta = ['liability', 'equity', 'revenue'].includes(creditAccount.accountType) ? amount : -amount;

      await tx.update(saccoAccounts)
        .set({ balance: sql`(${saccoAccounts.balance}::numeric + ${debitDelta})::decimal(15,2)`, updatedAt: new Date() })
        .where(eq(saccoAccounts.id, original.creditAccountId));

      await tx.update(saccoAccounts)
        .set({ balance: sql`(${saccoAccounts.balance}::numeric + ${creditDelta})::decimal(15,2)`, updatedAt: new Date() })
        .where(eq(saccoAccounts.id, original.debitAccountId));

      const reversalNumber = `REV-${original.entryNumber}`;
      const [reversal] = await tx.insert(saccoJournalEntries).values({
        entryNumber: reversalNumber,
        entryDate: new Date().toISOString().split('T')[0],
        description: `Reversal of ${original.entryNumber}: ${original.description}`,
        reference: original.reference,
        debitAccountId: original.creditAccountId,
        creditAccountId: original.debitAccountId,
        amount: original.amount,
        createdBy: userId,
        status: 'posted',
        reversedById: id,
      }).returning();

      return reversal;
    });
  }

  async getSaccoAccountStatement(accountId: number, startDate?: string, endDate?: string): Promise<any[]> {
    const conditions = [
      or(
        eq(saccoJournalEntries.debitAccountId, accountId),
        eq(saccoJournalEntries.creditAccountId, accountId)
      )!,
      eq(saccoJournalEntries.status, 'posted'),
    ];
    if (startDate) conditions.push(gte(saccoJournalEntries.entryDate, startDate));
    if (endDate) conditions.push(lte(saccoJournalEntries.entryDate, endDate));

    const entries = await db
      .select({
        entry: saccoJournalEntries,
        debitAccountName: sql<string>`(SELECT account_name FROM sacco_accounts WHERE id = ${saccoJournalEntries.debitAccountId})`,
        creditAccountName: sql<string>`(SELECT account_name FROM sacco_accounts WHERE id = ${saccoJournalEntries.creditAccountId})`,
      })
      .from(saccoJournalEntries)
      .where(and(...conditions))
      .orderBy(saccoJournalEntries.entryDate, saccoJournalEntries.createdAt);

    return entries.map(e => ({
      ...e.entry,
      debitAccountName: e.debitAccountName,
      creditAccountName: e.creditAccountName,
    }));
  }

  async getSaccoAccountsSummary(): Promise<any> {
    const accounts = await db.select().from(saccoAccounts).where(eq(saccoAccounts.isActive, true));
    const summary: Record<string, { count: number; totalBalance: number; accounts: SaccoAccount[] }> = {};
    for (const acc of accounts) {
      if (!summary[acc.accountType]) {
        summary[acc.accountType] = { count: 0, totalBalance: 0, accounts: [] };
      }
      summary[acc.accountType].count++;
      summary[acc.accountType].totalBalance += parseFloat(acc.balance || '0');
      summary[acc.accountType].accounts.push(acc);
    }
    const totalAssets = summary['asset']?.totalBalance || 0;
    const totalLiabilities = summary['liability']?.totalBalance || 0;
    const totalEquity = summary['equity']?.totalBalance || 0;
    const totalRevenue = summary['revenue']?.totalBalance || 0;
    const totalExpenses = summary['expense']?.totalBalance || 0;
    return {
      byType: summary,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      balanceSheetBalance: totalAssets - totalLiabilities - totalEquity,
    };
  }

  async seedDefaultSaccoAccounts(): Promise<void> {
    const existing = await db.select({ count: count() }).from(saccoAccounts);
    if (existing[0]?.count > 0) return;

    const defaults: InsertSaccoAccount[] = [
      { accountCode: '1001', accountName: 'Cash at Bank', accountType: 'asset', description: 'Main SACCO bank account', isSystemAccount: true },
      { accountCode: '1002', accountName: 'Petty Cash', accountType: 'asset', description: 'Office petty cash', isSystemAccount: true },
      { accountCode: '1003', accountName: 'Loan Portfolio', accountType: 'asset', description: 'Total outstanding loans to members', isSystemAccount: true },
      { accountCode: '1004', accountName: 'Fixed Assets', accountType: 'asset', description: 'Office equipment, furniture, and fixtures', isSystemAccount: true },
      { accountCode: '1005', accountName: 'Accounts Receivable', accountType: 'asset', description: 'Amounts owed to the SACCO', isSystemAccount: true },
      { accountCode: '2001', accountName: 'Member Savings', accountType: 'liability', description: 'Total member savings deposits held', isSystemAccount: true },
      { accountCode: '2002', accountName: 'Member Share Capital', accountType: 'liability', description: 'Total member share capital contributions', isSystemAccount: true },
      { accountCode: '2003', accountName: 'Accounts Payable', accountType: 'liability', description: 'Amounts owed by the SACCO', isSystemAccount: true },
      { accountCode: '2004', accountName: 'Interest Payable on Savings', accountType: 'liability', description: 'Accrued interest owed to members on savings', isSystemAccount: true },
      { accountCode: '3001', accountName: 'Statutory Reserve Fund', accountType: 'equity', description: 'Mandatory reserve as required by regulations', isSystemAccount: true },
      { accountCode: '3002', accountName: 'General Reserve Fund', accountType: 'equity', description: 'Retained earnings for SACCO growth', isSystemAccount: true },
      { accountCode: '3003', accountName: 'Emergency Fund', accountType: 'equity', description: 'Fund for emergency situations and contingencies', isSystemAccount: true },
      { accountCode: '4001', accountName: 'Interest on Loans', accountType: 'revenue', description: 'Interest income earned from member loans', isSystemAccount: true },
      { accountCode: '4002', accountName: 'Loan Processing Fees', accountType: 'revenue', description: 'Fees charged for processing loan applications', isSystemAccount: true },
      { accountCode: '4003', accountName: 'Membership Entry Fees', accountType: 'revenue', description: 'One-time fees from new member registration', isSystemAccount: true },
      { accountCode: '4004', accountName: 'Late Payment Penalties', accountType: 'revenue', description: 'Penalties charged for late loan repayments', isSystemAccount: true },
      { accountCode: '4005', accountName: 'Other Income', accountType: 'revenue', description: 'Miscellaneous income sources', isSystemAccount: true },
      { accountCode: '5001', accountName: 'Salaries & Wages', accountType: 'expense', description: 'Staff compensation and benefits', isSystemAccount: true },
      { accountCode: '5002', accountName: 'Office Rent', accountType: 'expense', description: 'Rental expenses for office space', isSystemAccount: true },
      { accountCode: '5003', accountName: 'Utilities', accountType: 'expense', description: 'Electricity, water, and internet costs', isSystemAccount: true },
      { accountCode: '5004', accountName: 'Stationery & Supplies', accountType: 'expense', description: 'Office supplies and printing materials', isSystemAccount: true },
      { accountCode: '5005', accountName: 'Transport & Travel', accountType: 'expense', description: 'Travel and transportation expenses', isSystemAccount: true },
      { accountCode: '5006', accountName: 'Audit & Legal Fees', accountType: 'expense', description: 'External audit and legal consultation fees', isSystemAccount: true },
      { accountCode: '5007', accountName: 'Insurance', accountType: 'expense', description: 'Insurance premiums for SACCO assets', isSystemAccount: true },
      { accountCode: '5008', accountName: 'Depreciation', accountType: 'expense', description: 'Depreciation of fixed assets', isSystemAccount: true },
      { accountCode: '5009', accountName: 'Bank Charges', accountType: 'expense', description: 'Bank transaction fees and charges', isSystemAccount: true },
      { accountCode: '5010', accountName: 'Other Expenses', accountType: 'expense', description: 'Miscellaneous operational expenses', isSystemAccount: true },
    ];

    for (const acc of defaults) {
      await db.insert(saccoAccounts).values(acc);
    }
  }

  async getSaccoAccountMappings(): Promise<SaccoAccountMapping[]> {
    const mappings = await db.select({
      mapping: saccoAccountMappings,
      debitAccountCode: sql<string>`da.account_code`,
      debitAccountName: sql<string>`da.account_name`,
      creditAccountCode: sql<string>`ca.account_code`,
      creditAccountName: sql<string>`ca.account_name`,
    })
    .from(saccoAccountMappings)
    .leftJoin(sql`sacco_accounts da`, sql`da.id = ${saccoAccountMappings.debitAccountId}`)
    .leftJoin(sql`sacco_accounts ca`, sql`ca.id = ${saccoAccountMappings.creditAccountId}`)
    .orderBy(saccoAccountMappings.category, saccoAccountMappings.mappingLabel);

    return mappings.map(m => ({
      ...m.mapping,
      debitAccountCode: m.debitAccountCode,
      debitAccountName: m.debitAccountName,
      creditAccountCode: m.creditAccountCode,
      creditAccountName: m.creditAccountName,
    })) as any;
  }

  async updateSaccoAccountMapping(id: number, data: { debitAccountId?: number | null; creditAccountId?: number | null }): Promise<SaccoAccountMapping> {
    const [mapping] = await db.update(saccoAccountMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(saccoAccountMappings.id, id))
      .returning();
    return mapping;
  }

  async seedDefaultAccountMappings(): Promise<void> {
    const existing = await db.select().from(saccoAccountMappings).limit(1);
    if (existing.length > 0) return;

    const allAccounts = await db.select().from(saccoAccounts);
    const byCode = (code: string) => allAccounts.find(a => a.accountCode === code)?.id || null;

    const defaults = [
      { mappingKey: 'loan_disbursement', mappingLabel: 'Loan Disbursement', category: 'loan' as const, description: 'When a loan is disbursed to a member', debitAccountId: byCode('1003'), creditAccountId: byCode('1001') },
      { mappingKey: 'loan_repayment_principal', mappingLabel: 'Loan Repayment (Principal)', category: 'loan' as const, description: 'Principal portion of loan repayment received', debitAccountId: byCode('1001'), creditAccountId: byCode('1003') },
      { mappingKey: 'loan_interest_income', mappingLabel: 'Loan Interest Income', category: 'loan' as const, description: 'Interest earned from member loans', debitAccountId: byCode('1001'), creditAccountId: byCode('4001') },
      { mappingKey: 'loan_processing_fee', mappingLabel: 'Loan Processing Fee', category: 'loan' as const, description: 'Fees charged for processing loan applications', debitAccountId: byCode('2001'), creditAccountId: byCode('4002') },
      { mappingKey: 'late_payment_penalty', mappingLabel: 'Late Payment Penalty', category: 'loan' as const, description: 'Penalties charged for overdue loan repayments', debitAccountId: byCode('1005'), creditAccountId: byCode('4004') },
      { mappingKey: 'member_deposit', mappingLabel: 'Member Savings Deposit', category: 'savings' as const, description: 'When a member deposits into their savings account', debitAccountId: byCode('1001'), creditAccountId: byCode('2001') },
      { mappingKey: 'member_withdrawal', mappingLabel: 'Member Savings Withdrawal', category: 'savings' as const, description: 'When a member withdraws from their savings account', debitAccountId: byCode('2001'), creditAccountId: byCode('1001') },
      { mappingKey: 'savings_interest_accrual', mappingLabel: 'Savings Interest Accrual', category: 'savings' as const, description: 'Interest accrued and payable to members on savings', debitAccountId: byCode('5010'), creditAccountId: byCode('2004') },
      { mappingKey: 'share_capital_contribution', mappingLabel: 'Share Capital Contribution', category: 'membership' as const, description: 'When a member buys shares in the SACCO', debitAccountId: byCode('1001'), creditAccountId: byCode('2002') },
      { mappingKey: 'membership_entry_fee', mappingLabel: 'Membership Entry Fee', category: 'membership' as const, description: 'One-time registration fee for new members', debitAccountId: byCode('1001'), creditAccountId: byCode('4003') },
      { mappingKey: 'bank_charges', mappingLabel: 'Bank Charges', category: 'operations' as const, description: 'Fees charged by the bank for transactions', debitAccountId: byCode('5009'), creditAccountId: byCode('1001') },
      { mappingKey: 'salary_payment', mappingLabel: 'Staff Salary Payment', category: 'operations' as const, description: 'Monthly salary and wage payments to staff', debitAccountId: byCode('5001'), creditAccountId: byCode('1001') },
      { mappingKey: 'rent_payment', mappingLabel: 'Office Rent Payment', category: 'operations' as const, description: 'Monthly rent payment for office space', debitAccountId: byCode('5002'), creditAccountId: byCode('1001') },
      { mappingKey: 'utility_payment', mappingLabel: 'Utility Payment', category: 'operations' as const, description: 'Electricity, water, internet bills', debitAccountId: byCode('5003'), creditAccountId: byCode('1001') },
    ];

    for (const mapping of defaults) {
      await db.insert(saccoAccountMappings).values(mapping);
    }
  }
}

export const storage = new DatabaseStorage();