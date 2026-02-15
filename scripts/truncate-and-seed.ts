import { db } from "../server/db";
import { 
  users, members, savingsAccounts, loans, transactions, 
  guarantors, auditLogs, memberRoles, interestRates, 
  amortizationSchedules, interestCalculations, financialYears, 
  interestPayments, balanceSnapshots, notifications, 
  loanTypes, loanTerms, roles, permissions, rolePermissions,
  sessions
} from "../shared/schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Truncating all tables...");
  
  // Disable foreign key checks for truncation (Postgres way is to use CASCADE)
  const tables = [
    sessions,
    auditLogs,
    notifications,
    interestPayments,
    interestCalculations,
    balanceSnapshots,
    financialYears,
    amortizationSchedules,
    guarantors,
    transactions,
    loans,
    loanTerms,
    loanTypes,
    savingsAccounts,
    memberRoles,
    members,
    rolePermissions,
    permissions,
    roles,
    users
  ];

  for (const table of tables) {
    try {
      // @ts-ignore
      await db.execute(sql`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      console.log(`Truncated table`);
    } catch (error) {
      console.error(`Error truncating table:`, error);
    }
  }

  console.log("Creating admin user...");
  const hashedPassword = await bcrypt.hash("admin123", 10);
  
  const [admin] = await db.insert(users).values({
    id: "admin-user",
    username: "admin",
    password: hashedPassword,
    email: "admin@biasharasacco.com",
    firstName: "System",
    lastName: "Admin",
    role: "admin",
    authMethod: "local",
  }).returning();

  console.log("Admin user created: admin / admin123");
}

main().catch(console.error).finally(() => process.exit());
