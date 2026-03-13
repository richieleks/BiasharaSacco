import { storage } from "./storage";
import { hashPassword } from "./localAuth";
import { log } from "./vite";
import { db } from "./db";
import { roles, permissions, rolePermissions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function seedAdminUser() {
  try {
    const existingUsers = await storage.getAllUsers();
    const adminExists = existingUsers.some(u => u.role === "admin");
    
    if (!adminExists) {
      const hashedPassword = await hashPassword("NewBeginings@2026!");
      const adminId = `usr_${crypto.randomUUID()}`;
      
      await storage.upsertUser({
        id: adminId,
        username: "dleku",
        password: hashedPassword,
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        authMethod: "local",
        mustChangePassword: false,
      });
      
      log("Admin user 'dleku' created successfully");
    }
  } catch (error) {
    log(`Admin seed check: ${error}`);
  }
}

const SYSTEM_ROLES = [
  { name: "admin", displayName: "Administrator", description: "Full system access — can view and modify all data, manage roles, and configure system settings" },
  { name: "treasurer", displayName: "Treasurer", description: "Financial operations, final loan approvals (UGX 100k–500k), access to all financial reports and analytics" },
  { name: "committee", displayName: "Committee", description: "Policy enforcement, initial loan reviews, member registration, deposits/withdrawals processing" },
  { name: "teller", displayName: "Teller", description: "Transaction processing, member registration, daily operations" },
  { name: "member", displayName: "Member", description: "Self-service access to personal account information, loan applications, and statements" },
];

const SYSTEM_PERMISSIONS = [
  { resource: "dashboard", action: "read", displayName: "View Dashboard", category: "Main" },
  { resource: "members", action: "read", displayName: "View Members", category: "Main" },
  { resource: "members", action: "create", displayName: "Create Members", category: "Main" },
  { resource: "members", action: "update", displayName: "Update Members", category: "Main" },
  { resource: "members", action: "approve", displayName: "Approve Members", category: "Main" },
  { resource: "savings", action: "read", displayName: "View Savings", category: "Finance" },
  { resource: "savings", action: "create", displayName: "Create Savings", category: "Finance" },
  { resource: "savings", action: "update", displayName: "Update Savings", category: "Finance" },
  { resource: "deposits", action: "record", displayName: "Record Deposits", category: "Operations" },
  { resource: "withdrawals", action: "request", displayName: "Request/Process Withdrawals", category: "Operations" },
  { resource: "withdrawals", action: "approve", displayName: "Approve Withdrawals", category: "Operations" },
  { resource: "loans", action: "read", displayName: "View Loans", category: "Finance" },
  { resource: "loans", action: "create", displayName: "Create Loans", category: "Finance" },
  { resource: "loans", action: "update", displayName: "Update Loans", category: "Finance" },
  { resource: "loans", action: "approve", displayName: "Approve Loans", category: "Finance" },
  { resource: "loans", action: "disburse", displayName: "Disburse Loans", category: "Operations" },
  { resource: "loan-repayments", action: "record", displayName: "Record Loan Repayments", category: "Operations" },
  { resource: "loan-applications", action: "create", displayName: "Apply for Loans", category: "Operations" },
  { resource: "data-import", action: "execute", displayName: "Import Bulk Data", category: "Administration" },
  { resource: "personal-loans", action: "read", displayName: "View Personal Loans", category: "Finance" },
  { resource: "transactions", action: "read", displayName: "View Transactions", category: "Finance" },
  { resource: "transactions", action: "create", displayName: "Create Transactions", category: "Finance" },
  { resource: "personal-transactions", action: "read", displayName: "View Personal Transactions", category: "Finance" },
  { resource: "share-capital", action: "read", displayName: "View Share Capital", category: "Finance" },
  { resource: "share-capital", action: "update", displayName: "Update Share Capital", category: "Finance" },
  { resource: "guarantors", action: "read", displayName: "View Guarantors", category: "Finance" },
  { resource: "interest-rates", action: "read", displayName: "View Interest Rates", category: "Finance" },
  { resource: "interest-rates", action: "update", displayName: "Update Interest Rates", category: "Finance" },
  { resource: "interest-calculations", action: "read", displayName: "View Interest Calculations", category: "Finance" },
  { resource: "reports", action: "read", displayName: "View Reports", category: "Reports" },
  { resource: "notifications", action: "read", displayName: "View Notifications", category: "Reports" },
  { resource: "system-settings", action: "read", displayName: "View System Settings", category: "Administration" },
  { resource: "system-settings", action: "update", displayName: "Update System Settings", category: "Administration" },
  { resource: "audit-logs", action: "read", displayName: "View Audit Logs", category: "Administration" },
  { resource: "personal-dashboard", action: "read", displayName: "View Personal Dashboard", category: "Main" },
  { resource: "personal-savings", action: "read", displayName: "View Personal Savings", category: "Finance" },
  { resource: "personal-guarantors", action: "read", displayName: "View Guarantor Requests", category: "Finance" },
  { resource: "sacco-accounts", action: "read", displayName: "View SACCO Accounts", category: "Finance" },
  { resource: "sacco-accounts", action: "update", displayName: "Manage SACCO Accounts", category: "Finance" },
];

const ROLE_PERMISSION_MAP: Record<string, { action: string; resource: string }[]> = {
  admin: [
    { action: "read", resource: "dashboard" },
    { action: "read", resource: "members" },
    { action: "create", resource: "members" },
    { action: "update", resource: "members" },
    { action: "approve", resource: "members" },
    { action: "read", resource: "savings" },
    { action: "create", resource: "savings" },
    { action: "update", resource: "savings" },
    { action: "record", resource: "deposits" },
    { action: "request", resource: "withdrawals" },
    { action: "approve", resource: "withdrawals" },
    { action: "read", resource: "loans" },
    { action: "create", resource: "loans" },
    { action: "update", resource: "loans" },
    { action: "approve", resource: "loans" },
    { action: "disburse", resource: "loans" },
    { action: "record", resource: "loan-repayments" },
    { action: "create", resource: "loan-applications" },
    { action: "execute", resource: "data-import" },
    { action: "read", resource: "transactions" },
    { action: "create", resource: "transactions" },
    { action: "read", resource: "share-capital" },
    { action: "update", resource: "share-capital" },
    { action: "read", resource: "guarantors" },
    { action: "read", resource: "interest-rates" },
    { action: "update", resource: "interest-rates" },
    { action: "read", resource: "interest-calculations" },
    { action: "read", resource: "reports" },
    { action: "read", resource: "notifications" },
    { action: "read", resource: "system-settings" },
    { action: "update", resource: "system-settings" },
    { action: "read", resource: "audit-logs" },
    { action: "read", resource: "sacco-accounts" },
    { action: "update", resource: "sacco-accounts" },
  ],
  treasurer: [
    { action: "read", resource: "dashboard" },
    { action: "read", resource: "members" },
    { action: "update", resource: "members" },
    { action: "approve", resource: "members" },
    { action: "read", resource: "savings" },
    { action: "create", resource: "savings" },
    { action: "update", resource: "savings" },
    { action: "record", resource: "deposits" },
    { action: "request", resource: "withdrawals" },
    { action: "approve", resource: "withdrawals" },
    { action: "read", resource: "loans" },
    { action: "create", resource: "loans" },
    { action: "update", resource: "loans" },
    { action: "approve", resource: "loans" },
    { action: "disburse", resource: "loans" },
    { action: "record", resource: "loan-repayments" },
    { action: "create", resource: "loan-applications" },
    { action: "execute", resource: "data-import" },
    { action: "read", resource: "transactions" },
    { action: "create", resource: "transactions" },
    { action: "read", resource: "share-capital" },
    { action: "update", resource: "share-capital" },
    { action: "read", resource: "guarantors" },
    { action: "read", resource: "interest-rates" },
    { action: "update", resource: "interest-rates" },
    { action: "read", resource: "interest-calculations" },
    { action: "read", resource: "reports" },
    { action: "read", resource: "notifications" },
    { action: "read", resource: "sacco-accounts" },
    { action: "update", resource: "sacco-accounts" },
  ],
  committee: [
    { action: "read", resource: "dashboard" },
    { action: "read", resource: "members" },
    { action: "create", resource: "members" },
    { action: "update", resource: "members" },
    { action: "approve", resource: "members" },
    { action: "read", resource: "savings" },
    { action: "create", resource: "savings" },
    { action: "record", resource: "deposits" },
    { action: "request", resource: "withdrawals" },
    { action: "read", resource: "loans" },
    { action: "create", resource: "loans" },
    { action: "approve", resource: "loans" },
    { action: "record", resource: "loan-repayments" },
    { action: "create", resource: "loan-applications" },
    { action: "read", resource: "transactions" },
    { action: "create", resource: "transactions" },
    { action: "read", resource: "share-capital" },
    { action: "read", resource: "guarantors" },
    { action: "read", resource: "interest-rates" },
    { action: "read", resource: "interest-calculations" },
    { action: "read", resource: "reports" },
    { action: "read", resource: "notifications" },
    { action: "read", resource: "sacco-accounts" },
  ],
  teller: [
    { action: "read", resource: "dashboard" },
    { action: "read", resource: "members" },
    { action: "create", resource: "members" },
    { action: "read", resource: "savings" },
    { action: "create", resource: "savings" },
    { action: "record", resource: "deposits" },
    { action: "request", resource: "withdrawals" },
    { action: "record", resource: "loan-repayments" },
    { action: "read", resource: "loans" },
    { action: "read", resource: "transactions" },
    { action: "create", resource: "transactions" },
    { action: "read", resource: "share-capital" },
    { action: "read", resource: "guarantors" },
    { action: "read", resource: "notifications" },
  ],
  member: [
    { action: "read", resource: "dashboard" },
    { action: "read", resource: "personal-dashboard" },
    { action: "read", resource: "personal-loans" },
    { action: "read", resource: "personal-savings" },
    { action: "read", resource: "personal-transactions" },
    { action: "read", resource: "personal-guarantors" },
    { action: "request", resource: "withdrawals" },
    { action: "create", resource: "loan-applications" },
    { action: "read", resource: "notifications" },
    { action: "read", resource: "guarantors" },
  ],
};

export async function seedRBAC() {
  try {
    log("Ensuring RBAC roles and permissions are up to date...");

    const roleIds: Record<string, number> = {};
    for (const role of SYSTEM_ROLES) {
      const existing = await storage.getRoleByName(role.name);
      if (existing) {
        roleIds[existing.name] = existing.id;
      } else {
        const [created] = await db
          .insert(roles)
          .values({ ...role, isSystem: true })
          .returning();
        roleIds[created.name] = created.id;
        log(`  Created role '${role.name}'`);
      }
    }

    const permIds: Record<string, number> = {};
    const existingPerms = await storage.getAllPermissions();
    for (const ep of existingPerms) {
      permIds[`${ep.action}:${ep.resource}`] = ep.id;
    }
    for (const perm of SYSTEM_PERMISSIONS) {
      const key = `${perm.action}:${perm.resource}`;
      if (!permIds[key]) {
        const [created] = await db
          .insert(permissions)
          .values(perm)
          .returning();
        permIds[key] = created.id;
      }
    }

    for (const [roleName, perms] of Object.entries(ROLE_PERMISSION_MAP)) {
      const roleId = roleIds[roleName];
      if (!roleId) continue;

      const existingMappings = await storage.getRolePermissions(roleId);
      const existingPermIds = new Set(existingMappings.map(m => m.permissionId));

      const desiredPermIds = new Set(
        perms
          .map(p => permIds[`${p.action}:${p.resource}`])
          .filter((id): id is number => id !== undefined)
      );

      const missingPermIds = [...desiredPermIds].filter(id => !existingPermIds.has(id));

      if (missingPermIds.length > 0) {
        await db.insert(rolePermissions).values(
          missingPermIds.map(permissionId => ({ roleId, permissionId }))
        );
        log(`  Role '${roleName}': added ${missingPermIds.length} missing permissions`);
      }

      const stalePermIds = [...existingPermIds].filter(id => !desiredPermIds.has(id));
      if (stalePermIds.length > 0) {
        for (const permId of stalePermIds) {
          await db
            .delete(rolePermissions)
            .where(
              and(
                eq(rolePermissions.roleId, roleId),
                eq(rolePermissions.permissionId, permId)
              )
            );
        }
        log(`  Role '${roleName}': removed ${stalePermIds.length} stale permissions`);
      }
    }

    log("RBAC sync complete");
  } catch (error) {
    log(`RBAC seed error: ${error}`);
  }
}
