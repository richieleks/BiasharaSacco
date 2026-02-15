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

  console.log("Admin user created:", admin.id);

  console.log("Creating member profile for admin...");
  const [adminMember] = await db.insert(members).values({
    userId: admin.id,
    memberNumber: "BCS000001",
    fullName: "System Admin",
    idNumber: "ADMIN001",
    phoneNumber: "0700000000",
    role: "admin",
    status: "active",
    monthlySavings: "0",
    shareContribution: "20000",
    numberOfShares: 4,
    approvedBy: admin.id,
    approvedAt: new Date(),
    membershipStartDate: new Date(),
  }).returning();

  console.log("Member profile created:", adminMember.memberNumber);

  console.log("Assigning admin role...");
  await db.insert(memberRoles).values({
    memberId: adminMember.id,
    role: "admin",
    assignedBy: admin.id,
  });

  console.log("Creating savings account...");
  await db.insert(savingsAccounts).values({
    memberId: adminMember.id,
    accountNumber: "SAV00000001",
    accountType: "regular",
    balance: "0",
  });

  console.log("Done! Admin user created with full admin rights.");
  console.log("Login: admin / admin123");
}

main().catch(console.error).finally(() => process.exit());
