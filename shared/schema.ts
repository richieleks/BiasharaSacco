import {
  pgTable,
  text,
  varchar,
  timestamp,
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
  idNumber: varchar("id_number").unique().notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  address: text("address"),
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
  loanType: varchar("loan_type", { enum: ["personal", "business", "emergency", "asset"] }).default("personal"),
  principalAmount: decimal("principal_amount", { precision: 15, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).notNull(),
  termMonths: integer("term_months").notNull(),
  monthlyPayment: decimal("monthly_payment", { precision: 15, scale: 2 }).notNull(),
  outstandingBalance: decimal("outstanding_balance", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { enum: ["pending", "approved", "disbursed", "active", "completed", "defaulted"] }).default("pending"),
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

// Insert schemas
export const insertMemberSchema = createInsertSchema(members).omit({
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
};
