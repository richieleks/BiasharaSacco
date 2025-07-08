import {
  pgTable,
  text,
  varchar,
  timestamp,
  date,
  jsonb,
  index,
  decimal,
  integer,
  boolean,
  serial,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["admin", "manager", "committee", "teller", "member"] }).default("member"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Members table for SACCO member profiles
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  memberNumber: varchar("member_number").unique().notNull(),
  fullName: varchar("full_name").default(""),
  idNumber: varchar("id_number").unique().notNull(),
  dateOfBirth: varchar("date_of_birth").default("2000-01-01"),
  gender: varchar("gender", { enum: ["male", "female"] }).default("male"),
  phoneNumber: varchar("phone_number").notNull(),
  address: text("address"),
  maritalStatus: varchar("marital_status", { enum: ["single", "married", "divorced", "widowed"] }).default("single"),
  department: varchar("department").default(""),
  section: varchar("section"),
  termsOfService: varchar("terms_of_service", { enum: ["permanent", "temporary", "contract", "ex-staff"] }).default("permanent"),
  averageNetPay: decimal("average_net_pay", { precision: 15, scale: 2 }),
  staffAccountNumber: varchar("staff_account_number"),
  monthlySavings: decimal("monthly_savings", { precision: 15, scale: 2 }).default("0"),
  accountNumber: varchar("account_number"),
  branch: varchar("branch"),
  shareContribution: decimal("share_contribution", { precision: 15, scale: 2 }).default("20000"),
  numberOfShares: integer("number_of_shares").default(4),
  beneficiaryName: varchar("beneficiary_name").default(""),
  beneficiaryRelationship: varchar("beneficiary_relationship").default(""),
  beneficiaryContact: varchar("beneficiary_contact").default(""),
  nextOfKinName: varchar("next_of_kin_name"),
  nextOfKinPhone: varchar("next_of_kin_phone"),
  role: varchar("role", { enum: ["admin", "manager", "committee", "teller", "member"] }).default("member"),
  status: varchar("status", { enum: ["pending", "active", "inactive", "suspended", "rejected"] }).default("pending"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  approvalComments: text("approval_comments"),
  joinDate: timestamp("join_date").defaultNow(),
  // Business rule compliance fields
  membershipStartDate: timestamp("membership_start_date").defaultNow(),
  lastActivityDate: timestamp("last_activity_date"),
  shareCapital: decimal("share_capital", { precision: 15, scale: 2 }).default("0"),
  totalSavings: decimal("total_savings", { precision: 15, scale: 2 }).default("0"),
  isFullyPaidShareholder: boolean("is_fully_paid_shareholder").default(false),
  isActiveSaver: boolean("is_active_saver").default(false),
  isPaidUp: boolean("is_paid_up").default(false),
  hasActiveLoans: boolean("has_active_loans").default(false),
  isDefaulter: boolean("is_defaulter").default(false),
  isGuarantorForDefaulter: boolean("is_guarantor_for_defaulter").default(false),
  hasActiveLoans: boolean("has_active_loans").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Savings accounts table
export const savingsAccounts = pgTable("savings_accounts", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  accountNumber: varchar("account_number").unique().notNull(),
  accountType: varchar("account_type", { enum: ["regular", "fixed_deposit", "group"] }).default("regular"),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0.0500"),
  status: varchar("status", { enum: ["active", "closed", "frozen"] }).default("active"),
  // Business rule compliance fields
  firstDepositDate: timestamp("first_deposit_date"),
  isGraduallyBuiltUp: boolean("is_gradually_built_up").default(true), // Track if savings built gradually vs lump sum
  lastDepositDate: timestamp("last_deposit_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loans table
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().unique(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  loanNumber: varchar("loan_number").unique().notNull(),
  loanType: varchar("loan_type", { enum: ["personal", "business", "emergency", "asset", "development"] }).default("personal"),
  principalAmount: decimal("principal_amount", { precision: 15, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).notNull(),
  termMonths: integer("term_months").notNull(),
  monthlyPayment: decimal("monthly_payment", { precision: 15, scale: 2 }).notNull(),
  outstandingBalance: decimal("outstanding_balance", { precision: 15, scale: 2 }).notNull(),
  // Business rule compliance fields
  maxAllowedAmount: decimal("max_allowed_amount", { precision: 15, scale: 2 }), // Based on 1:2.5 savings ratio
  savingsToLoanRatio: decimal("savings_to_loan_ratio", { precision: 5, scale: 2 }), // Track compliance with 1:2.5 rule
  status: varchar("status", { enum: ["pending", "teller_approved", "committee_approved", "manager_approved", "approved", "rejected", "disbursed", "active", "completed", "defaulted"] }).default("pending"),
  approvalStage: varchar("approval_stage", { enum: ["teller", "committee", "manager", "completed"] }).default("teller"),
  tellerApprovedBy: varchar("teller_approved_by").references(() => users.id),
  tellerApprovedAt: timestamp("teller_approved_at"),
  tellerComments: text("teller_comments"),
  committeeApprovedBy: varchar("committee_approved_by").references(() => users.id),
  committeeApprovedAt: timestamp("committee_approved_at"),
  committeeComments: text("committee_comments"),
  managerApprovedBy: varchar("manager_approved_by").references(() => users.id),
  managerApprovedAt: timestamp("manager_approved_at"),
  managerComments: text("manager_comments"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  purpose: text("purpose"),
  // Additional fields from SACCO form
  averageNetPay: decimal("average_net_pay", { precision: 15, scale: 2 }),
  staffNumber: varchar("staff_number"),
  staffAccountNumber: varchar("staff_account_number"),
  nextOfKin: varchar("next_of_kin"),
  nextOfKinPhone: varchar("next_of_kin_phone"),
  isTopUp: boolean("is_top_up").default(false),
  previousLoanBalance: decimal("previous_loan_balance", { precision: 15, scale: 2 }),
  currentSavings: decimal("current_savings", { precision: 15, scale: 2 }),
  securityOffered: text("security_offered"),
  repaymentScheduleAttached: boolean("repayment_schedule_attached").default(false),
  applicationDate: timestamp("application_date").defaultNow(),
  approvalDate: timestamp("approval_date"),
  disbursementDate: timestamp("disbursement_date"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  savingsAccountId: integer("savings_account_id").references(() => savingsAccounts.id),
  loanId: integer("loan_id").references(() => loans.id),
  transactionType: varchar("transaction_type", { 
    enum: ["deposit", "withdrawal", "loan_payment", "loan_disbursement", "interest_credit", "fee_charge"] 
  }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description"),
  referenceNumber: varchar("reference_number").unique().notNull(),
  status: varchar("status", { enum: ["pending", "completed", "failed", "cancelled"] }).default("pending"),
  processedBy: varchar("processed_by").references(() => users.id),
  transactionDate: timestamp("transaction_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Interest rates table for different loan types and products
export const interestRates = pgTable("interest_rates", {
  id: serial("id").primaryKey(),
  productType: varchar("product_type", { 
    enum: ["normal_loan", "emergency_loan", "development_loan", "group_loan", "asset_financing"] 
  }).notNull(),
  baseRate: decimal("base_rate", { precision: 5, scale: 2 }).notNull(), // Annual interest rate
  compoundingFrequency: varchar("compounding_frequency", { 
    enum: ["daily", "monthly", "quarterly", "annually"] 
  }).default("monthly"),
  isActive: boolean("is_active").default(true),
  minimumAmount: decimal("minimum_amount", { precision: 15, scale: 2 }),
  maximumAmount: decimal("maximum_amount", { precision: 15, scale: 2 }),
  minimumTerm: integer("minimum_term"), // months
  maximumTerm: integer("maximum_term"), // months
  effectiveDate: timestamp("effective_date").defaultNow(),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Amortization schedules for loans
export const amortizationSchedules = pgTable("amortization_schedules", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").references(() => loans.id).notNull(),
  paymentNumber: integer("payment_number").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  principalAmount: decimal("principal_amount", { precision: 15, scale: 2 }).notNull(),
  interestAmount: decimal("interest_amount", { precision: 15, scale: 2 }).notNull(),
  totalPayment: decimal("total_payment", { precision: 15, scale: 2 }).notNull(),
  outstandingBalance: decimal("outstanding_balance", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { enum: ["pending", "paid", "overdue", "partial"] }).default("pending"),
  actualPaymentDate: timestamp("actual_payment_date"),
  actualAmountPaid: decimal("actual_amount_paid", { precision: 15, scale: 2 }),
  lateFee: decimal("late_fee", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Interest calculations history for transparency
export const interestCalculations = pgTable("interest_calculations", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").references(() => loans.id).notNull(),
  savingsAccountId: integer("savings_account_id").references(() => savingsAccounts.id),
  calculationType: varchar("calculation_type", { 
    enum: ["loan_interest", "savings_interest", "compound_interest", "simple_interest"] 
  }).notNull(),
  principal: decimal("principal", { precision: 15, scale: 2 }).notNull(),
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(),
  time: decimal("time", { precision: 10, scale: 4 }).notNull(), // in years or months
  compoundingPeriods: integer("compounding_periods"),
  calculatedInterest: decimal("calculated_interest", { precision: 15, scale: 2 }).notNull(),
  formula: varchar("formula", { length: 100 }),
  calculationDate: timestamp("calculation_date").defaultNow(),
  notes: text("notes"),
});

// Guarantors table
export const guarantors = pgTable("guarantors", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").references(() => loans.id).notNull(),
  guarantorMemberId: integer("guarantor_member_id").references(() => members.id).notNull(),
  guaranteeAmount: decimal("guarantee_amount", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { enum: ["pending", "approved", "rejected"] }).default("pending"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  member: one(members, {
    fields: [users.id],
    references: [members.userId],
  }),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
  savingsAccounts: many(savingsAccounts),
  loans: many(loans),
  transactions: many(transactions),
  guarantorsProvided: many(guarantors, {
    relationName: "guarantorMember",
  }),
}));

export const savingsAccountsRelations = relations(savingsAccounts, ({ one, many }) => ({
  member: one(members, {
    fields: [savingsAccounts.memberId],
    references: [members.id],
  }),
  transactions: many(transactions),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  member: one(members, {
    fields: [loans.memberId],
    references: [members.id],
  }),
  transactions: many(transactions),
  guarantors: many(guarantors),
  amortizationSchedules: many(amortizationSchedules),
  interestCalculations: many(interestCalculations),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  member: one(members, {
    fields: [transactions.memberId],
    references: [members.id],
  }),
  savingsAccount: one(savingsAccounts, {
    fields: [transactions.savingsAccountId],
    references: [savingsAccounts.id],
  }),
  loan: one(loans, {
    fields: [transactions.loanId],
    references: [loans.id],
  }),
  processedByUser: one(users, {
    fields: [transactions.processedBy],
    references: [users.id],
  }),
}));

export const guarantorsRelations = relations(guarantors, ({ one }) => ({
  loan: one(loans, {
    fields: [guarantors.loanId],
    references: [loans.id],
  }),
  guarantorMember: one(members, {
    fields: [guarantors.guarantorMemberId],
    references: [members.id],
    relationName: "guarantorMember",
  }),
}));

export const amortizationSchedulesRelations = relations(amortizationSchedules, ({ one }) => ({
  loan: one(loans, {
    fields: [amortizationSchedules.loanId],
    references: [loans.id],
  }),
}));

export const interestCalculationsRelations = relations(interestCalculations, ({ one }) => ({
  loan: one(loans, {
    fields: [interestCalculations.loanId],
    references: [loans.id],
  }),
  savingsAccount: one(savingsAccounts, {
    fields: [interestCalculations.savingsAccountId],
    references: [savingsAccounts.id],
  }),
}));

// Member roles junction table for multiple roles per member
export const memberRoles = pgTable("member_roles", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  role: varchar("role").notNull(), // admin, manager, committee, teller, member
  assignedBy: varchar("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  memberId: integer("member_id").references(() => members.id),
  action: varchar("action").notNull(), // create, update, delete, approve, reject, login, logout
  resource: varchar("resource").notNull(), // member, loan, savings, transaction, settings
  resourceId: varchar("resource_id"),
  details: text("details"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const memberRolesRelations = relations(memberRoles, ({ one }) => ({
  member: one(members, {
    fields: [memberRoles.memberId],
    references: [members.id],
  }),
  assignedByUser: one(users, {
    fields: [memberRoles.assignedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  member: one(members, {
    fields: [auditLogs.memberId],
    references: [members.id],
  }),
}));

// Insert schemas
export const insertMemberSchema = createInsertSchema(members, {
  monthlySavings: z.string(),
  shareContribution: z.string(),
  numberOfShares: z.coerce.number(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavingsAccountSchema = createInsertSchema(savingsAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanSchema = createInsertSchema(loans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertGuarantorSchema = createInsertSchema(guarantors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInterestRateSchema = createInsertSchema(interestRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAmortizationScheduleSchema = createInsertSchema(amortizationSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInterestCalculationSchema = createInsertSchema(interestCalculations).omit({
  id: true,
});

// Notifications table for real-time notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  memberId: integer("member_id").references(() => members.id),
  type: varchar("type", { 
    enum: ["loan_application", "loan_approval", "loan_rejection", "payment_due", "payment_received", 
           "member_approved", "member_rejected", "guarantor_request", "guarantor_response", 
           "transaction_completed", "system_alert", "role_changed", "account_update"] 
  }).notNull(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  priority: varchar("priority", { enum: ["low", "medium", "high", "urgent"] }).default("medium"),
  isRead: boolean("is_read").default(false),
  actionUrl: varchar("action_url"), // URL to navigate when notification is clicked
  metadata: jsonb("metadata"), // Additional data related to the notification
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// RBAC Tables
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(), // For built-in roles that can't be deleted
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  resource: varchar("resource", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }), // For grouping permissions in UI
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_permission_resource_action").on(table.resource, table.action),
]);

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_role_permission").on(table.roleId, table.permissionId),
]);

// Define relations
export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  members: many(memberRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

// Types
export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;
export type MemberRole = typeof memberRoles.$inferSelect;
export type InsertMemberRole = typeof memberRoles.$inferInsert;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;
export type InsertSavingsAccount = z.infer<typeof insertSavingsAccountSchema>;
export type SavingsAccount = typeof savingsAccounts.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loans.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertGuarantor = z.infer<typeof insertGuarantorSchema>;
export type Guarantor = typeof guarantors.$inferSelect;
export type InsertInterestRate = z.infer<typeof insertInterestRateSchema>;
export type InterestRate = typeof interestRates.$inferSelect;
export type InsertAmortizationSchedule = z.infer<typeof insertAmortizationScheduleSchema>;
export type AmortizationSchedule = typeof amortizationSchedules.$inferSelect;
export type InsertInterestCalculation = z.infer<typeof insertInterestCalculationSchema>;
export type InterestCalculation = typeof interestCalculations.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Extended types for API responses
export type MemberWithDetails = Member & {
  user?: User;
  savingsAccounts?: SavingsAccount[];
  loans?: Loan[];
  roles?: string[]; // Array of roles from member_roles table
};

export type TransactionWithDetails = Transaction & {
  member?: Member & { user?: User };
  savingsAccount?: SavingsAccount;
  loan?: Loan;
  processedByUser?: User;
};

export type LoanWithDetails = Loan & {
  member?: Member & { user?: User };
  guarantors?: GuarantorWithDetails[];
};

export type GuarantorWithDetails = Guarantor & {
  guarantorMember?: Member & { user?: User };
  loan?: LoanWithDetails;
};

// Extended types with interest calculation details
export type LoanWithAmortization = LoanWithDetails & {
  amortizationSchedules?: AmortizationSchedule[];
  interestCalculations?: InterestCalculation[];
  interestRate?: InterestRate;
};

export type AmortizationScheduleWithDetails = AmortizationSchedule & {
  loan?: Loan & { member?: Member & { user?: User } };
};

export type InterestCalculationWithDetails = InterestCalculation & {
  loan?: Loan;
  savingsAccount?: SavingsAccount;
};

export type MemberRoleDetails = {
  member: MemberWithDetails;
  roles: string[];
};

// Loan Types table for configurable loan products
export const loanTypes = pgTable("loan_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  description: text("description"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(), // e.g., 12.50 for 12.5%
  interestType: varchar("interest_type", { enum: ["simple", "compound", "reducing_balance"] }).default("reducing_balance"),
  compoundingFrequency: varchar("compounding_frequency", { enum: ["monthly", "quarterly", "annually"] }).default("monthly"),
  minAmount: decimal("min_amount", { precision: 12, scale: 2 }).default("0"),
  maxAmount: decimal("max_amount", { precision: 12, scale: 2 }),
  minTerm: integer("min_term").default(1), // in months
  maxTerm: integer("max_term").default(60), // in months
  gracePeriod: integer("grace_period").default(0), // in days
  lateFeeRate: decimal("late_fee_rate", { precision: 5, scale: 2 }).default("2.00"), // percentage per month
  processingFee: decimal("processing_fee", { precision: 5, scale: 2 }).default("0"), // percentage of loan amount
  requiresGuarantor: boolean("requires_guarantor").default(true),
  guarantorRatio: decimal("guarantor_ratio", { precision: 3, scale: 2 }).default("1.50"), // 1.5x means guarantors must cover 150% of loan
  isActive: boolean("is_active").default(true),
  approvalWorkflow: varchar("approval_workflow", { enum: ["simple", "multi_stage"] }).default("multi_stage"),
  requiresCollateral: boolean("requires_collateral").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loan Terms table for specific terms and conditions
export const loanTerms = pgTable("loan_terms", {
  id: serial("id").primaryKey(),
  loanTypeId: integer("loan_type_id").notNull().references(() => loanTypes.id, { onDelete: "cascade" }),
  termName: varchar("term_name", { length: 100 }).notNull(),
  termCategory: varchar("term_category", { enum: ["eligibility", "documentation", "collateral", "repayment", "penalty", "other"] }).notNull(),
  description: text("description").notNull(),
  isRequired: boolean("is_required").default(true),
  sortOrder: integer("sort_order").default(0), // for ordering terms in display
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for loan types and terms
export const loanTypesRelations = relations(loanTypes, ({ many }) => ({
  terms: many(loanTerms),
  loans: many(loans),
}));

export const loanTermsRelations = relations(loanTerms, ({ one }) => ({
  loanType: one(loanTypes, {
    fields: [loanTerms.loanTypeId],
    references: [loanTypes.id],
  }),
}));

// Insert schemas for loan types and terms
export const insertLoanTypeSchema = createInsertSchema(loanTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanTermSchema = createInsertSchema(loanTerms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type LoanType = typeof loanTypes.$inferSelect;
export type InsertLoanType = typeof loanTypes.$inferInsert;
export type LoanTerm = typeof loanTerms.$inferSelect;
export type InsertLoanTerm = typeof loanTerms.$inferInsert;

export type LoanTypeWithTerms = LoanType & {
  terms: LoanTerm[];
};
