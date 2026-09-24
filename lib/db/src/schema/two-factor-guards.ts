import { pgTable, text, integer, bigint, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// No secrets or account foreign keys: short-lived security coordination only.
export const twoFactorGuardsTable = pgTable("two_factor_guards", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  consumed: boolean("consumed").notNull(),
}, (table) => [index("two_factor_guards_expiry_idx").on(table.expiresAt)]);

export const insertTwoFactorGuardSchema = createInsertSchema(twoFactorGuardsTable);
export type TwoFactorGuard = typeof twoFactorGuardsTable.$inferSelect;
export type InsertTwoFactorGuard = typeof twoFactorGuardsTable.$inferInsert;