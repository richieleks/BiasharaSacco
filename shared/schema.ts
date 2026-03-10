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
import { relations, sql } from "drizzle-orm";
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

// User storage table - supports both Replit Auth and username/password auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  username: varchar("username").unique(),
  password: varchar("password"), // Hashed password
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["admin", "manager", "committee", "teller", "member"] }).default("member"),
  authMethod: varchar("auth_method", { enum: ["replit", "local"] }).default("local"),
  mustChangePassword: boolean("must_change_password").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Members table for SACCO member profiles
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().unique(),
  userId: varchar("user_id").references(() => users.id),
  memberNumber: varchar("member_number").unique().notNull(),
  fullName: varchar("full_name").default(""),
  idNumber: varchar("id_number").unique().notNull(),
  dateOfBirth: varchar("date_of_birth").default("2000-01-01"),
  gender: varchar("gender", { enum: ["male", "female"] }).default("male"),
  phoneNumber: varchar("phone_number").notNull(),
  email: varchar("member_email"),
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
  status: varchar("status", { enum: ["pending", "active", "inactive", "dormant", "suspended", "rejected", "exited"] }).default("pending"),
  lastSavingsDate: timestamp("last_savings_date"),
  exitedAt: timestamp("exited_at"),
  exitReason: text("exit_reason"),
  exitFeeCharged: decimal("exit_fee_charged", { precision: 15, scale: 2 }),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Savings accounts table
export const savingsAccounts = pgTable("savings_accounts", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().unique(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  accountNumber: varchar("account_number").unique().notNull(),
  accountType: varchar("account_type", { enum: ["regular", "fixed_deposit", "group"] }).default("regular"),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0.0000"),
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
  approvalStage: varchar("approval_stage", { enum: ["teller", "committee", "manager", "completed"] }).default("committee"),
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
  topUpOfLoanId: integer("top_up_of_loan_id"),
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
  uuid: uuid("uuid").defaultRandom().unique(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  savingsAccountId: integer("savings_account_id").references(() => savingsAccounts.id),
  loanId: integer("loan_id").references(() => loans.id),
  transactionType: varchar("transaction_type", { 
    enum: ["deposit", "withdrawal", "loan_payment", "loan_disbursement", "interest_credit", "fee_charge", "share_capital"] 
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
    enum: ["normal_loan", "emergency_loan", "development_loan", "group_loan", "asset_financing", "savings_regular", "savings_fixed_deposit", "savings_group"] 
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

// Financial years for interest calculations
export const financialYears = pgTable("financial_years", {
  id: serial("id").primaryKey(),
  yearLabel: varchar("year_label").notNull().unique(), // e.g., "2024-2025"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").default(false),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0.0500"), // 5% default
  status: varchar("status", { enum: ["draft", "active", "closed"] }).default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Interest calculations and accruals
export const interestCalculations = pgTable("interest_calculations", {
  id: serial("id").primaryKey(),
  financialYearId: integer("financial_year_id").references(() => financialYears.id).notNull(),
  savingsAccountId: integer("savings_account_id").references(() => savingsAccounts.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  calculationDate: date("calculation_date").notNull(),
  periodStartDate: date("period_start_date").notNull(),
  periodEndDate: date("period_end_date").notNull(),
  averageBalance: decimal("average_balance", { precision: 15, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).notNull(),
  grossInterest: decimal("gross_interest", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0.00"),
  netInterest: decimal("net_interest", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { enum: ["calculated", "approved", "posted", "paid"] }).default("calculated"),
  calculationMethod: varchar("calculation_method", { enum: ["simple", "compound", "daily_balance"] }).default("simple"),
  notes: text("notes"),
  calculatedBy: varchar("calculated_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  postedAt: timestamp("posted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Interest payment records
export const interestPayments = pgTable("interest_payments", {
  id: serial("id").primaryKey(),
  interestCalculationId: integer("interest_calculation_id").references(() => interestCalculations.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  savingsAccountId: integer("savings_account_id").references(() => savingsAccounts.id).notNull(),
  paymentAmount: decimal("payment_amount", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { enum: ["cash", "bank_transfer", "credit_to_account"] }).default("credit_to_account"),
  paymentDate: date("payment_date").notNull(),
  transactionReference: varchar("transaction_reference"),
  status: varchar("status", { enum: ["pending", "completed", "failed", "cancelled"] }).default("pending"),
  processedBy: varchar("processed_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Balance snapshots for interest calculations
export const balanceSnapshots = pgTable("balance_snapshots", {
  id: serial("id").primaryKey(),
  savingsAccountId: integer("savings_account_id").references(() => savingsAccounts.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull(),
  financialYearId: integer("financial_year_id").references(() => financialYears.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.savingsAccountId, table.snapshotDate)
]);

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

// Interest calculation history for loan calculations (separate from financial year savings interest)
export const loanInterestCalculations = pgTable("loan_interest_calculations", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").references(() => loans.id).notNull(),
  calculationType: varchar("calculation_type", { 
    enum: ["loan_interest", "compound_interest", "simple_interest", "reducing_balance"] 
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
  uuid: uuid("uuid").defaultRandom().unique(),
  loanId: integer("loan_id").references(() => loans.id).notNull(),
  guarantorMemberId: integer("guarantor_member_id").references(() => members.id).notNull(),
  guaranteeAmount: decimal("guarantee_amount", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { enum: ["pending", "approved", "rejected"] }).default("pending"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("guarantors_loan_member_unique").on(table.loanId, table.guarantorMemberId),
]);

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

// Relations for financial year interest calculations
export const interestCalculationsRelations = relations(interestCalculations, ({ one }) => ({
  financialYear: one(financialYears, {
    fields: [interestCalculations.financialYearId],
    references: [financialYears.id],
  }),
  savingsAccount: one(savingsAccounts, {
    fields: [interestCalculations.savingsAccountId],
    references: [savingsAccounts.id],
  }),
  member: one(members, {
    fields: [interestCalculations.memberId],
    references: [members.id],
  }),
}));

export const loanInterestCalculationsRelations = relations(loanInterestCalculations, ({ one }) => ({
  loan: one(loans, {
    fields: [loanInterestCalculations.loanId],
    references: [loans.id],
  }),
}));

export const financialYearsRelations = relations(financialYears, ({ many }) => ({
  interestCalculations: many(interestCalculations),
  balanceSnapshots: many(balanceSnapshots),
}));

export const interestPaymentsRelations = relations(interestPayments, ({ one }) => ({
  interestCalculation: one(interestCalculations, {
    fields: [interestPayments.interestCalculationId],
    references: [interestCalculations.id],
  }),
  member: one(members, {
    fields: [interestPayments.memberId],
    references: [members.id],
  }),
  savingsAccount: one(savingsAccounts, {
    fields: [interestPayments.savingsAccountId],
    references: [savingsAccounts.id],
  }),
}));

export const balanceSnapshotsRelations = relations(balanceSnapshots, ({ one }) => ({
  savingsAccount: one(savingsAccounts, {
    fields: [balanceSnapshots.savingsAccountId],
    references: [savingsAccounts.id],
  }),
  member: one(members, {
    fields: [balanceSnapshots.memberId],
    references: [members.id],
  }),
  financialYear: one(financialYears, {
    fields: [balanceSnapshots.financialYearId],
    references: [financialYears.id],
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

export const insertLoanInterestCalculationSchema = createInsertSchema(loanInterestCalculations).omit({
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

// Interest calculation types
export type FinancialYear = typeof financialYears.$inferSelect;
export type InsertFinancialYear = typeof financialYears.$inferInsert;

export type InterestCalculation = typeof interestCalculations.$inferSelect;
export type InsertInterestCalculation = typeof interestCalculations.$inferInsert;

export type InterestPayment = typeof interestPayments.$inferSelect;
export type InsertInterestPayment = typeof interestPayments.$inferInsert;

export type BalanceSnapshot = typeof balanceSnapshots.$inferSelect;
export type InsertBalanceSnapshot = typeof balanceSnapshots.$inferInsert;

// Insert schemas for interest calculations
export const insertFinancialYearSchema = createInsertSchema(financialYears).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavingsInterestCalculationSchema = createInsertSchema(interestCalculations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInterestPaymentSchema = createInsertSchema(interestPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBalanceSnapshotSchema = createInsertSchema(balanceSnapshots).omit({
  id: true,
  createdAt: true,
});

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
  interestRate: decimal("interest_rate", { precision: 6, scale: 3 }).notNull(), // e.g., 12.500 for 12.5%
  interestType: varchar("interest_type", { enum: ["simple", "compound", "reducing_balance"] }).default("reducing_balance"),
  compoundingFrequency: varchar("compounding_frequency", { enum: ["monthly", "quarterly", "annually"] }).default("monthly"),
  minAmount: decimal("min_amount", { precision: 12, scale: 2 }).default("0"),
  maxAmount: decimal("max_amount", { precision: 12, scale: 2 }),
  minTerm: integer("min_term").default(1), // in months
  maxTerm: integer("max_term").default(60), // in months
  gracePeriod: integer("grace_period").default(0), // in days
  lateFeeRate: decimal("late_fee_rate", { precision: 5, scale: 2 }).default("2.00"), // percentage per month
  processingFee: decimal("processing_fee", { precision: 5, scale: 2 }).default("0"), // percentage of loan amount
  acceptanceFee: decimal("acceptance_fee", { precision: 12, scale: 2 }).default("0"), // fixed amount charged on loan acceptance
  requiresGuarantor: boolean("requires_guarantor").default(true),
  guarantorRatio: decimal("guarantor_ratio", { precision: 3, scale: 2 }).default("1.50"), // 1.5x means guarantors must cover 150% of loan
  minRepaymentsForTopUp: integer("min_repayments_for_top_up").default(3),
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

// Loan Approvals table for tracking individual committee approvals
export const loanApprovals = pgTable("loan_approvals", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").notNull().references(() => loans.id),
  approvedBy: varchar("approved_by").notNull().references(() => users.id),
  stage: varchar("stage", { enum: ["committee", "treasurer"] }).notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLoanApprovalSchema = createInsertSchema(loanApprovals).omit({
  id: true,
  createdAt: true,
});

export type LoanApproval = typeof loanApprovals.$inferSelect;
export type InsertLoanApproval = typeof loanApprovals.$inferInsert;

// Member Exit Requests table - stores exit requests pending treasurer approval
export const memberExitRequests = pgTable("member_exit_requests", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  requestedAt: timestamp("requested_at").defaultNow(),
  reason: text("reason"),
  status: varchar("status", { enum: ["pending_treasurer", "approved", "rejected"] }).default("pending_treasurer"),
  exitFee: decimal("exit_fee", { precision: 15, scale: 2 }).default("0"),
  savingsUsedForLoanRepayment: boolean("savings_used_for_loan_repayment").default(false),
  loanAmountRepaid: decimal("loan_amount_repaid", { precision: 15, scale: 2 }),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  treasurerComments: text("treasurer_comments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const memberExitRequestsRelations = relations(memberExitRequests, ({ one }) => ({
  member: one(members, { fields: [memberExitRequests.memberId], references: [members.id] }),
  requestedByUser: one(users, { fields: [memberExitRequests.requestedBy], references: [users.id] }),
  approvedByUser: one(users, { fields: [memberExitRequests.approvedBy], references: [users.id] }),
  rejectedByUser: one(users, { fields: [memberExitRequests.rejectedBy], references: [users.id] }),
}));

export type MemberExitRequest = typeof memberExitRequests.$inferSelect;
export type InsertMemberExitRequest = typeof memberExitRequests.$inferInsert;

// System Settings table for persisting configuration
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  settingKey: varchar("setting_key").unique().notNull(),
  settingValue: text("setting_value").notNull(),
  settingType: varchar("setting_type", { enum: ["string", "number", "boolean", "json"] }).default("string"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// User Settings table for persisting per-user preferences
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  settingsJson: text("settings_json").notNull().default('{}'),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserSetting = typeof userSettings.$inferSelect;
export type InsertUserSetting = typeof userSettings.$inferInsert;

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

export const saccoAccounts = pgTable("sacco_accounts", {
  id: serial("id").primaryKey(),
  uuid: varchar("uuid").default(sql`gen_random_uuid()`).notNull(),
  accountCode: varchar("account_code").unique().notNull(),
  accountName: varchar("account_name").notNull(),
  accountType: varchar("account_type", {
    enum: ["asset", "liability", "equity", "revenue", "expense"]
  }).notNull(),
  parentAccountId: integer("parent_account_id"),
  description: text("description"),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isSystemAccount: boolean("is_system_account").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const saccoJournalEntries = pgTable("sacco_journal_entries", {
  id: serial("id").primaryKey(),
  uuid: varchar("uuid").default(sql`gen_random_uuid()`).notNull(),
  entryNumber: varchar("entry_number").unique().notNull(),
  entryDate: date("entry_date").notNull(),
  description: text("description").notNull(),
  reference: varchar("reference"),
  debitAccountId: integer("debit_account_id").references(() => saccoAccounts.id).notNull(),
  creditAccountId: integer("credit_account_id").references(() => saccoAccounts.id).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  status: varchar("status", { enum: ["posted", "reversed"] }).default("posted").notNull(),
  reversedById: integer("reversed_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const saccoAccountMappings = pgTable("sacco_account_mappings", {
  id: serial("id").primaryKey(),
  mappingKey: varchar("mapping_key").unique().notNull(),
  mappingLabel: varchar("mapping_label").notNull(),
  category: varchar("category", {
    enum: ["loan", "savings", "membership", "operations"]
  }).notNull(),
  description: text("description"),
  debitAccountId: integer("debit_account_id").references(() => saccoAccounts.id),
  creditAccountId: integer("credit_account_id").references(() => saccoAccounts.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSaccoAccountSchema = createInsertSchema(saccoAccounts).omit({
  id: true,
  uuid: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSaccoJournalEntrySchema = createInsertSchema(saccoJournalEntries).omit({
  id: true,
  uuid: true,
  createdAt: true,
});

export const insertSaccoAccountMappingSchema = createInsertSchema(saccoAccountMappings).omit({
  id: true,
  updatedAt: true,
});

export type SaccoAccount = typeof saccoAccounts.$inferSelect;
export type InsertSaccoAccount = z.infer<typeof insertSaccoAccountSchema>;
export type SaccoJournalEntry = typeof saccoJournalEntries.$inferSelect;
export type InsertSaccoJournalEntry = z.infer<typeof insertSaccoJournalEntrySchema>;
export type SaccoAccountMapping = typeof saccoAccountMappings.$inferSelect;
export type InsertSaccoAccountMapping = z.infer<typeof insertSaccoAccountMappingSchema>;
