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
  role: varchar("role", { enum: ["admin", "teller", "member"] }).default("member"),
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
  phoneNumber: varchar("phone_number").notNull(),
  address: text("address"),
  maritalStatus: varchar("marital_status", { enum: ["single", "married", "divorced", "widowed"] }).default("single"),
  department: varchar("department").default(""),
  section: varchar("section"),
  termsOfService: varchar("terms_of_service", { enum: ["permanent", "temporary", "contract", "ex-staff"] }).default("permanent"),
  monthlySavings: decimal("monthly_savings", { precision: 15, scale: 2 }).default("0"),
  accountNumber: varchar("account_number"),
  branch: varchar("branch"),
  shareContribution: decimal("share_contribution", { precision: 15, scale: 2 }).default("20000"),
  numberOfShares: integer("number_of_shares").default(4),
  beneficiaryName: varchar("beneficiary_name").default(""),
  beneficiaryRelationship: varchar("beneficiary_relationship").default(""),
  beneficiaryContact: varchar("beneficiary_contact").default(""),
  status: varchar("status", { enum: ["active", "inactive", "suspended"] }).default("active"),
  joinDate: timestamp("join_date").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loans table
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  loanNumber: varchar("loan_number").unique().notNull(),
  loanType: varchar("loan_type", { enum: ["personal", "business", "emergency", "asset", "development"] }).default("personal"),
  principalAmount: decimal("principal_amount", { precision: 15, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).notNull(),
  termMonths: integer("term_months").notNull(),
  monthlyPayment: decimal("monthly_payment", { precision: 15, scale: 2 }).notNull(),
  outstandingBalance: decimal("outstanding_balance", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { enum: ["pending", "approved", "disbursed", "active", "completed", "defaulted"] }).default("pending"),
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
  loanNumber: true,
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
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

// Extended types for API responses
export type MemberWithDetails = Member & {
  user?: User;
  savingsAccounts?: SavingsAccount[];
  loans?: Loan[];
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
  loan?: Loan;
};
