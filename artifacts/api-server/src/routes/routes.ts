import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../storage";
import { canAccessMemberLoans, loanOwnerGuard, validateLoanGuarantees } from "../loan-security";
import { setupAuth, isAuthenticated } from "../replitAuth";
import { setupLocalAuth, hashPassword, validatePasswordComplexity, getSecuritySettings, getPasswordRequirementsText } from "../localAuth";
import passport from "passport";
import { createChallenge, verifyChallenge, authorizeDisable, personalSettingsSchema } from "../twoFactorSecurity";
import { requirePermission, filterDataByRole, type AuthRequest, filterMembersByRole, filterLoansByRole, filterTransactionsByRole, checkMaintenanceMode, clearMaintenanceModeCache } from "../rbac-middleware";
import { insertMemberSchema, insertSavingsAccountSchema, insertLoanSchema, insertTransactionSchema, insertGuarantorSchema, insertNotificationSchema, members, memberExitRequests, loans, savingsAccounts as savingsAccountsTable, transactions, interestCalculations, interestPayments, saccoAccounts, loanDocuments, guarantors } from "@workspace/db";
import { businessRulesValidator } from "../business-rules-validator";
import { sendEmail, verifyConnection, buildEmailTemplate, getEmailConfig, sendNotificationEmail } from "../email-service";
import { seedAdminUser, seedRBAC } from "../seed";
import { z } from 'zod';
import { db } from "../db";
import { users as usersTable } from "@workspace/db";
import { eq, and, inArray, sql, lt, isNull, isNotNull, or, not } from "drizzle-orm";
import ExcelJS from "exceljs";
import { parseBankImportCsv } from "../csvUtils";
import {
  calculateContractualLoanAmounts,
  splitContractualRepayment,
  type LoanInterestMethod,
} from "../loan-balance";

const validUserRoles = ['admin', 'manager', 'committee', 'member'] as const;
type UserRole = typeof validUserRoles[number];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && validUserRoles.includes(value as UserRole);
}

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

interface ImportJob {
  id: string;
  userId: string;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  stage: string;
  processedSheets: number;
  totalSheets: number;
  importedMembers: number;
  importedAccounts: number;
  result: any | null;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

type ImportFailureCategory =
  | 'invalid_row'
  | 'transaction_rejected'
  | 'duplicate_reference'
  | 'unmatched_member'
  | 'unmatched_loan'
  | 'fully_paid_loan'
  | 'missing_savings_account'
  | 'processing_error'
  | 'file_error';

interface ImportFailure {
  row: number;
  category: ImportFailureCategory;
  error: string;
  data?: Record<string, unknown>;
}

const skippedImportFailureCategories = new Set<ImportFailureCategory>([
  'transaction_rejected',
  'duplicate_reference',
  'unmatched_member',
  'unmatched_loan',
  'fully_paid_loan',
]);

function summarizeImportFailures(errors: ImportFailure[]) {
  const failureBreakdown = errors.reduce<Record<string, number>>((counts, error) => {
    counts[error.category] = (counts[error.category] || 0) + 1;
    return counts;
  }, {});

  return {
    failedRows: errors.filter(error => !skippedImportFailureCategories.has(error.category)).length,
    skippedRows: errors.filter(error => skippedImportFailureCategories.has(error.category)).length,
    failureBreakdown,
  };
}

function createImportFailureResult(message: string): {
  success: false;
  totalRows: number;
  successfulImports: number;
  failedRows: number;
  skippedRows: number;
  totalAmount: number;
  errors: ImportFailure[];
  failureBreakdown: Record<string, number>;
  importedMembers: number;
  importedAccounts: number;
} {
  const errors: ImportFailure[] = [{ row: 0, category: 'file_error', error: message }];
  return {
    success: false,
    totalRows: 0,
    successfulImports: 0,
    failedRows: 1,
    skippedRows: 0,
    totalAmount: 0,
    errors,
    failureBreakdown: { file_error: 1 },
    importedMembers: 0,
    importedAccounts: 0,
  };
}

const importJobs = new Map<string, ImportJob>();

function createImportJob(userId: string): ImportJob {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: ImportJob = {
    id,
    userId,
    status: 'uploading',
    progress: 0,
    stage: 'Uploading file...',
    processedSheets: 0,
    totalSheets: 0,
    importedMembers: 0,
    importedAccounts: 0,
    result: null,
    error: null,
    startedAt: new Date(),
    completedAt: null,
  };
  importJobs.set(id, job);
  return job;
}

function cleanupCompletedJobs() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of importJobs) {
    if (job.completedAt && job.completedAt.getTime() < cutoff) {
      importJobs.delete(id);
    } else if (!job.completedAt && job.startedAt.getTime() < cutoff - 30 * 60 * 1000) {
      importJobs.delete(id);
    }
  }
}
setInterval(cleanupCompletedJobs, 5 * 60 * 1000);

function generateDefaultPassword(fullName: string): string {
  const namePart = fullName.trim().split(/\s+/)[0] || 'Member';
  return `${namePart}@2026!`;
}

function generateUsername(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.toLowerCase() || 'member';
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName[0]}${lastName}`.toLowerCase();
}

function getUserId(req: any): string | undefined {
  if (!req.user) return undefined;
  if (req.user.authMethod === 'local') return req.user.id;
  return req.user.claims?.sub;
}

async function generateMemberNumber(): Promise<string> {
  const allMembers = await storage.getAllMembers();
  const pendingMembers = await storage.getPendingMembers();
  const totalCount = allMembers.length + pendingMembers.length;
  return `BCS${String(totalCount + 1).padStart(6, '0')}`;
}

async function ensureMemberProfile(userId: string, options?: { roles?: string[], approvedBy?: string }): Promise<any> {
  const existing = await storage.getMemberByUserId(userId);
  if (existing) return existing;

  const user = await storage.getUser(userId);
  if (!user) return null;

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'User';
  const assignedRoles = options?.roles || [user.role || 'member'];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const memberNumber = await generateMemberNumber();
      const idNumber = `ID-${user.username || userId}`;

      const member = await storage.createMember({
        memberNumber,
        userId: user.id,
        fullName,
        idNumber,
        phoneNumber: '',
        address: '',
        role: assignedRoles[0] || 'member',
        status: 'active',
        joinDate: new Date(),
        approvedBy: options?.approvedBy || userId,
        approvedAt: new Date(),
        membershipStartDate: new Date(),
        email: user.email,
      } as any);

      for (const r of assignedRoles) {
        await storage.addMemberRole(member.id, r, options?.approvedBy || userId);
      }

      const accountNumber = `SAV${String(member.id).padStart(8, '0')}`;
      await storage.createSavingsAccount({
        memberId: member.id,
        accountNumber,
        accountType: 'regular',
        balance: '0.00',
      });

      return member;
    } catch (err: any) {
      if (attempt < 2 && err?.message?.includes('unique')) {
        continue;
      }
      const recheck = await storage.getMemberByUserId(userId);
      if (recheck) return recheck;
      console.error(`ensureMemberProfile failed for ${userId}:`, err);
      return null;
    }
  }
  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const memberLoanAccess = (select: (req: Request) => unknown) =>
    loanOwnerGuard(storage, getUserId, "member", select);
  const loanAccess = (select: (req: Request) => unknown) =>
    loanOwnerGuard(storage, getUserId, "loan", select);
  const guaranteeApprovalError = async (loan: { id: number; memberId: number; loanType: string | null; principalAmount: string }) => {
    const products = await storage.getAllLoanTypes();
    return validateLoanGuarantees(
      products.find(product => product.name === loan.loanType),
      Number(loan.principalAmount),
      loan.memberId,
      await storage.getGuarantorsByLoan(loan.id),
    );
  };
  // Extend AuthRequest type to include member data
  interface ExtendedAuthRequest extends Request {
    user?: {
      claims?: {
        sub?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
      };
    };
    member?: {
      id: number;
      role: 'admin' | 'manager' | 'committee' | 'member';
      userId: string;
      memberNumber: string;
      status: string;
    };
  }
  async function splitLoanRepayment(loan: any, paymentAmount: number, currentOutstanding: number) {
    let interestType: LoanInterestMethod = 'reducing_balance';
    let compoundingFrequency = 'monthly';
    try {
      const loanTypes = await storage.getActiveLoanTypes();
      const cfg = loanTypes.find((lt: any) => lt.name === loan?.loanType);
      if (cfg?.interestType) interestType = cfg.interestType as LoanInterestMethod;
      if (cfg?.compoundingFrequency) compoundingFrequency = cfg.compoundingFrequency;
    } catch {}
    return splitContractualRepayment({
      principal: parseFloat(loan?.principalAmount || '0'),
      annualRatePercentage: parseFloat(loan?.interestRate || '0'),
      termMonths: loan?.termMonths || 1,
      interestMethod: interestType,
      compoundingFrequency,
      monthlyPayment: parseFloat(loan?.monthlyPayment || '0'),
    }, paymentAmount, currentOutstanding);
  }

  async function postLoanRepaymentJournals(loan: any, interestPortion: number, principalPortion: number, descriptionPrefix: string, reference: string, userId: string, executor?: any, recalculate = true) {
    if (interestPortion > 0) {
      await recordJournalEntry('loan_interest_income', interestPortion, `${descriptionPrefix} (interest) - ${loan?.loanNumber || ''}`.trim(), reference, userId, executor, principalPortion <= 0 && recalculate);
    }
    if (principalPortion > 0) {
      await recordJournalEntry('loan_repayment_principal', principalPortion, `${descriptionPrefix} (principal) - ${loan?.loanNumber || ''}`.trim(), reference, userId, executor, recalculate);
    }
  }

  async function recordJournalEntry(mappingKey: string, amount: string | number, description: string, reference: string, userId: string, executor?: any, recalculate = true) {
    const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error(`Journal amount for ${mappingKey} must be a positive number`);
    }

    const entryNumber = `JE-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const entryData = {
      entryNumber,
      entryDate: new Date().toISOString().split('T')[0],
      description,
      reference,
      amount: numericAmount.toFixed(2),
      createdBy: userId,
      status: 'posted' as const,
    };
    if (executor) {
      await storage.createMappedSaccoJournalEntryInTransaction(executor, mappingKey, entryData, recalculate);
      return;
    }
    await storage.runSaccoLedgerTransaction(async (tx) => {
      await storage.createMappedSaccoJournalEntryInTransaction(tx, mappingKey, entryData);
    });
  }

  // Auth middleware
  await setupAuth(app);
  await setupLocalAuth();

  app.use('/api', checkMaintenanceMode());

  app.get('/api/system/maintenance-status', isAuthenticated, async (req: any, res) => {
    try {
      const setting = await storage.getSystemSetting('maintenanceMode');
      const isOn = setting?.settingValue === 'true';
      const announcementSetting = await storage.getSystemSetting('systemAnnouncement');
      return res.json({
        maintenanceMode: isOn,
        systemAnnouncement: announcementSetting?.settingValue || '',
      });
    } catch (error) {
      return res.json({ maintenanceMode: false, systemAnnouncement: '' });
    }
  });

  // Auth routes
  app.post('/api/auth/heartbeat', isAuthenticated, async (_req, res) => {
    return res.json({ ok: true });
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // Handle both Replit and local auth users
      const userId = getUserId(req)!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isSystemUser = (user as any).userType === 'system' || ['admin', 'manager', 'committee'].includes(user.role || '');
      const member = isSystemUser ? null : await ensureMemberProfile(userId, {
        roles: [user.role || 'member'],
      });
      
      const { password, twoFactorSecret: _tfs, ...userWithoutPassword } = user as typeof user & { password?: string; twoFactorSecret?: string };

      // This route remains available during restricted enrollment. Return the
      // current policy, not a stale serialized login result, and fail closed
      // when policy storage is unavailable.
      const twoFactorPolicy = await storage.getSystemSetting('twoFactorRequired');
      const mustSetup2FA = !user.twoFactorEnabled && twoFactorPolicy?.settingValue === 'true';
      
      if (member) {
        const freshMember = await storage.getMemberByUserId(userId);
        if (freshMember) {
          const roles = await storage.getMemberRoles(freshMember.id);
          if (freshMember.user) {
            const { password: _, twoFactorSecret: _secret, ...memberUserWithoutPassword } = freshMember.user as any;
            freshMember.user = memberUserWithoutPassword as typeof freshMember.user;
          }
          return res.json({
            ...userWithoutPassword,
            mustSetup2FA,
            member: {
              ...freshMember,
              roles: roles.length > 0 ? roles : [freshMember.role || 'member']
            }
          });
        } else {
          return res.json({ ...userWithoutPassword, mustSetup2FA, member: null, isAdmin: user.role === 'admin' });
        }
      } else {
        return res.json({ ...userWithoutPassword, mustSetup2FA, member: null, isAdmin: user.role === 'admin' });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get current user's permissions
  app.get('/api/auth/permissions', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const member = await storage.getMemberByUserId(userId);
      const user = await storage.getUser(userId);
      const requestedRole = req.query.role as string | undefined;
      
      let roleNames: string[];
      if (member) {
        const memberRoles = await storage.getMemberRoles(member.id);
        roleNames = memberRoles.length > 0 ? memberRoles : ['member'];
      } else if (user?.role) {
        roleNames = [user.role];
      } else {
        return res.json([]);
      }

      const rolesToQuery = requestedRole && roleNames.includes(requestedRole)
        ? [requestedRole]
        : roleNames;
      
      const allPermissions: any[] = [];
      
      for (const roleName of rolesToQuery) {
        const role = await storage.getRoleByName(roleName);
        if (role) {
          const permissions = await storage.getPermissionsByRole(role.id);
          allPermissions.push(...permissions);
        }
      }
      
      const uniquePermissions = Array.from(
        new Map(allPermissions.map(p => [`${p.action}-${p.resource}`, p])).values()
      );
      
      return res.json(uniquePermissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      return res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // Lightweight role metadata (e.g. dashboardType) for the current user's roles.
  // Used by the frontend to decide which dashboard layout to render for the
  // active role without needing the broader 'read:roles' permission.
  app.get('/api/auth/role-info', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const requestedRole = (req.query.name as string | undefined)?.trim();
      if (!requestedRole) {
        return res.status(400).json({ message: "Missing 'name' query parameter" });
      }

      const member = await storage.getMemberByUserId(userId);
      const user = await storage.getUser(userId);
      let roleNames: string[] = [];
      if (member) {
        const memberRoles = await storage.getMemberRoles(member.id);
        roleNames = memberRoles.length > 0 ? memberRoles : ['member'];
      } else if (user?.role) {
        roleNames = [user.role];
      }

      // Only return metadata for roles the caller actually has.
      if (!roleNames.includes(requestedRole)) {
        return res.status(403).json({ message: "Role not assigned to current user" });
      }

      const role = await storage.getRoleByName(requestedRole);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }

      return res.json({
        name: role.name,
        displayName: role.displayName,
        dashboardType: (role as any).dashboardType || 'member',
      });
    } catch (error) {
      console.error("Error fetching role info:", error);
      return res.status(500).json({ message: "Failed to fetch role info" });
    }
  });

  // Update user profile
  app.patch('/api/auth/profile', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { firstName, lastName, email, phoneNumber, address, department, section } = req.body;

      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "First name, last name, and email are required" });
      }

      await storage.upsertUser({
        id: userId,
        email,
        firstName,
        lastName,
        profileImageUrl: (req.user as any)?.claims?.profile_image_url || (req.user as any)?.profileImageUrl || null,
      });

      const currentUser = await storage.getUser(userId);
      const isSystemUser = (currentUser as any)?.userType === 'system' || ['admin', 'manager', 'committee'].includes(currentUser?.role || '');
      const member = isSystemUser ? null : await ensureMemberProfile(userId);
      if (member) {
        const memberUpdates: any = {};
        const fullName = `${firstName || ''} ${lastName || ''}`.trim();
        if (fullName) memberUpdates.fullName = fullName;
        if (email) memberUpdates.email = email;
        if (phoneNumber !== undefined) memberUpdates.phoneNumber = phoneNumber;
        if (address !== undefined) memberUpdates.address = address;
        if (department !== undefined) memberUpdates.department = department;
        if (section !== undefined) memberUpdates.section = section;
        if (Object.keys(memberUpdates).length > 0) {
          await storage.updateMember(member.id, memberUpdates);
        }
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, twoFactorSecret: _secret, ...userWithoutPassword } = user;
      const updatedMember = await storage.getMemberByUserId(userId);
      if (updatedMember) {
        const roles = await storage.getMemberRoles(updatedMember.id);
        if (updatedMember.user) {
          const { password: _, twoFactorSecret: _secret, ...memberUserWithoutPassword } = updatedMember.user as any;
          updatedMember.user = memberUserWithoutPassword as typeof updatedMember.user;
        }
        return res.json({
          ...userWithoutPassword,
          member: {
            ...updatedMember,
            roles: roles.length > 0 ? roles : [updatedMember.role || 'member']
          }
        });
      } else {
        return res.json({ ...userWithoutPassword, member: null });
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Local auth login endpoint
  app.post('/api/auth/login', 
    (req, res, next) => {
      delete (req.session as any).pendingTwoFactor;
      passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) {
          return res.status(500).json({ message: "Authentication error" });
        }
        if (!user) {
          return res.status(401).json({ message: info?.message || "Invalid username or password" });
        }

        if (user.twoFactorEnabled && !user.twoFactorSecret) {
          return res.status(401).json({ message: "Two-factor authentication is misconfigured. Contact your administrator." });
        }
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          return req.session.regenerate((error) => {
            if (error) return res.status(500).json({ message: "Authentication error" });
            (req.session as any).pendingTwoFactor = createChallenge(user.id);
            return req.session.save((saveError) => {
              if (saveError) return res.status(500).json({ message: "Authentication error" });
              return res.json({
                message: "Two-factor authentication required",
                requiresTwoFactor: true,
                username: user.username,
              });
            });
          });
        }

        return req.logIn(user, async (err) => {
          if (err) {
            return res.status(500).json({ message: "Login error" });
          }
          (req.session as any).twoFactorVerified = false;
          (req.session as any).lastActivity = Date.now();
          try {
            await storage.createAuditLog({
              userId: user.id,
              action: 'login',
              resource: 'user',
              resourceId: user.id,
              details: `User logged in: ${user.username}`,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            });
          } catch (e) {}
          const { password: _, twoFactorSecret: __, ...safeUser } = user;
          let mustSetup2FA = false;
          if (!user.twoFactorEnabled) {
            try {
              const setting = await storage.getSystemSetting('twoFactorRequired');
              if (setting?.settingValue === 'true') {
                mustSetup2FA = true;
              }
            } catch (e) {
              return res.status(503).json({ message: "Security policy is temporarily unavailable. Please try again.", code: "SECURITY_POLICY_UNAVAILABLE" });
            }
          }
          return res.json({ message: "Login successful", user: safeUser, mustChangePassword: user.mustChangePassword || false, mustSetup2FA });
        });
      })(req, res, next);
    }
  );

  app.post('/api/auth/login/2fa',
    async (req, res) => {
        try {
          const challenge = (req.session as any).pendingTwoFactor;
          if (!challenge || challenge.expiresAt <= Date.now()) {
            delete (req.session as any).pendingTwoFactor;
            return res.status(401).json({ message: "Password verification required. Please sign in again." });
          }
          const fullUser = await storage.getUser(challenge.userId);
          if (!fullUser || !fullUser.twoFactorSecret || !fullUser.twoFactorEnabled) {
            return res.status(400).json({ message: "Two-factor authentication not configured" });
          }
          if (fullUser.lockedUntil && new Date(fullUser.lockedUntil).getTime() > Date.now()) {
            return res.status(401).json({ message: "Account is locked. Please sign in again later." });
          }
          if (!['admin', 'manager', 'committee', 'treasurer'].includes(fullUser.role ?? '') && fullUser.userType !== 'system') {
            const member = await storage.getMemberByUserId(fullUser.id);
            if (member && ['inactive', 'suspended', 'rejected', 'exited'].includes(member.status ?? '')) {
              return res.status(403).json({ message: "Membership is not active. Contact your administrator." });
            }
          }
          if (!await verifyChallenge(challenge, fullUser.id, fullUser.twoFactorSecret, req.body?.code)) {
            return res.status(401).json({ message: "Invalid or expired verification challenge. Try again or sign in again." });
          }
          delete (req.session as any).pendingTwoFactor;
          const user = fullUser;
          // Passport 0.7 regenerates the session in logIn; keepSessionInfo is deliberately not used.
          return req.logIn(user, async (err) => {
            if (err) {
              return res.status(500).json({ message: "Login error" });
            }
            (req.session as any).twoFactorVerified = true;
            (req.session as any).lastActivity = Date.now();
            try {
              await storage.createAuditLog({
                userId: user.id,
                action: 'login',
                resource: 'user',
                resourceId: user.id,
                details: `User logged in via 2FA: ${user.username}`,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
              });
            } catch (e) {}
            const { password: _, twoFactorSecret: __, ...safeUser } = user;
            return res.json({ message: "Login successful", user: safeUser, mustChangePassword: user.mustChangePassword || false, mustSetup2FA: false });
          });
        } catch (error) {
          console.error("2FA login error:", error);
          return res.status(500).json({ message: "Authentication error" });
        }
    }
  );

  // Create admin user endpoint (protected - only existing admins can create new users)
  app.post('/api/auth/create-user', isAuthenticated, requirePermission('create', 'users'), async (req: AuthRequest, res) => {
    try {
      const { username, password, email, firstName, lastName, role, roles } = req.body;
      const requestedRoles: unknown[] = Array.isArray(roles) && roles.length > 0 ? roles : (role ? [role] : ['member']);
      if (!requestedRoles.every(isUserRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const assignedRoles: UserRole[] = requestedRoles;
      const primaryRole = assignedRoles[0];
      
      if (!username || !password || !email) {
        return res.status(400).json({ message: "Username, password, and email are required" });
      }

      if (assignedRoles.includes('admin') && assignedRoles.length > 1) {
        return res.status(400).json({ message: "Admin role cannot be combined with other roles" });
      }

      const secSettings = await getSecuritySettings();
      const complexityCheck = validatePasswordComplexity(password, secSettings.passwordComplexity);
      if (!complexityCheck.valid) {
        return res.status(400).json({ message: complexityCheck.message });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(password);
      
      // Generate a unique user ID
      const userId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const isSystemUser = ['admin', 'manager', 'committee'].includes(primaryRole);
      const userType = isSystemUser ? 'system' : 'member';

      // Create the user
      const newUser = await storage.upsertUser({
        id: userId,
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        authMethod: 'local',
        role: primaryRole,
        userType,
      });

      const memberProfile = isSystemUser ? null : await ensureMemberProfile(newUser.id, {
        roles: assignedRoles,
        approvedBy: getUserId(req),
      });

      // Remove password from response
      const { password: _, twoFactorSecret: _secret, ...userWithoutPassword } = newUser;
      
      return res.status(201).json({
        message: "User created successfully", 
        user: userWithoutPassword,
        member: memberProfile
      });
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.get('/api/auth/users', isAuthenticated, requirePermission('read', 'users'), async (req: AuthRequest, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithRoles = await Promise.all(allUsers.map(async ({ password, twoFactorSecret, ...u }: any) => {
        const member = await storage.getMemberByUserId(u.id);
        const roles = member ? await storage.getMemberRoles(member.id) : [u.role || 'member'];
        return { ...u, roles, memberId: member?.id || null, memberUuid: member?.uuid || null, memberNumber: (member as any)?.memberNumber || null };
      }));

      const allMembers = await storage.getAllMembers();
      const linkedUserIds = new Set(allMembers.filter((m: any) => m.userId).map((m: any) => m.userId));
      const unlinkedMembers = allMembers.filter((m: any) => !m.userId).map((m: any) => ({
        id: `unlinked-member-${m.id}`,
        username: null,
        email: null,
        firstName: (m.fullName || '').split(' ')[0] || '',
        lastName: (m.fullName || '').split(' ').slice(1).join(' ') || '',
        role: 'member',
        userType: 'member',
        roles: ['member'],
        memberId: m.id,
        memberUuid: m.uuid,
        memberNumber: m.memberNumber,
        createdAt: m.createdAt,
        lockedUntil: null,
        isUnlinked: true,
      }));

      return res.json([...usersWithRoles, ...unlinkedMembers]);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/auth/users/:id', isAuthenticated, requirePermission('update', 'users'), async (req: AuthRequest, res) => {
    try {
      const id = getRouteParam(req.params.id);
      const { username, email, firstName, lastName, role, roles, password } = req.body;

      const requestedRoles: unknown[] = Array.isArray(roles) ? roles : [];
      if (!requestedRoles.every(isUserRole) || (role !== undefined && !isUserRole(role))) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const assignedRoles: UserRole[] = requestedRoles;
      if (assignedRoles.includes('admin') && assignedRoles.length > 1) {
        return res.status(400).json({ message: "Admin role cannot be combined with other roles" });
      }

      const updateData: any = {};
      if (username) updateData.username = username;
      if (email) updateData.email = email;
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      const primaryRole: UserRole | undefined = role || (assignedRoles.length > 0 ? assignedRoles[0] : undefined);
      if (primaryRole) updateData.role = primaryRole;
      if (password) {
        const security = await getSecuritySettings();
        const validation = validatePasswordComplexity(password, security.passwordComplexity);
        if (!validation.valid) return res.status(400).json({ message: validation.message });
        updateData.password = await hashPassword(password);
      }

      const isSystemUser = primaryRole ? ['admin', 'manager', 'committee'].includes(primaryRole) : false;
      if (primaryRole) {
        updateData.userType = isSystemUser ? 'system' : 'member';
      }

      const updatedUser = await storage.updateUser(id, updateData);

      if (isSystemUser) {
        const existingMember = await storage.getMemberByUserId(id);
        if (existingMember) {
          await storage.updateMember(existingMember.id, { userId: null } as any);
          console.log(`Unlinked member profile ${existingMember.id} from system user ${id}`);
        }
      } else if (primaryRole === 'member') {
        const member = await ensureMemberProfile(id, {
          roles: assignedRoles.length > 0 ? assignedRoles : undefined,
          approvedBy: getUserId(req),
        });

        if (member) {
          const memberUpdates: any = {};
          if (firstName || lastName) {
            memberUpdates.fullName = `${firstName || updatedUser.firstName || ''} ${lastName || updatedUser.lastName || ''}`.trim();
          }
          if (email) memberUpdates.email = email;
          if (Object.keys(memberUpdates).length > 0) {
            await storage.updateMember(member.id, memberUpdates);
          }

          if (assignedRoles.length > 0) {
            await storage.replaceMemberRoles(member.id, assignedRoles, getUserId(req) || id);
          }
        }
      }

      const { password: _, twoFactorSecret: _secret, ...userWithoutPassword } = updatedUser as any;
      const updatedMember = await storage.getMemberByUserId(id);
      const memberRoles = updatedMember ? await storage.getMemberRoles(updatedMember.id) : [primaryRole || updatedUser.role];
      return res.json({ ...userWithoutPassword, roles: memberRoles, memberId: updatedMember?.id || null });
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.get('/api/auth/password-requirements', async (_req, res) => {
    try {
      const secSettings = await getSecuritySettings();
      return res.json({
        level: secSettings.passwordComplexity, 
        description: getPasswordRequirementsText(secSettings.passwordComplexity) 
      });
    } catch (error) {
      return res.json({ level: 'medium', description: getPasswordRequirementsText('medium') });
    }
  });

  app.post('/api/auth/users/:id/unlock', isAuthenticated, requirePermission('update', 'users'), async (req: AuthRequest, res) => {
    try {
      const id = getRouteParam(req.params.id);
      await storage.updateUser(id, { failedLoginAttempts: 0, lockedUntil: null });
      return res.json({ message: "User account unlocked successfully" });
    } catch (error) {
      console.error("Error unlocking user:", error);
      return res.status(500).json({ message: "Failed to unlock user" });
    }
  });

  app.post('/api/auth/users/:id/reset-password', isAuthenticated, requirePermission('update', 'users'), async (req: AuthRequest, res) => {
    try {
      const id = getRouteParam(req.params.id);
      const tempPassword = 'changeme123';
      const hashedPassword = await hashPassword(tempPassword);
      await storage.updateUser(id, { password: hashedPassword, mustChangePassword: true });

      const resetUser = await storage.getUser(id);
      await sendNotificationEmail(
        storage,
        resetUser?.email ?? undefined,
        'Your Password Has Been Reset',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Hello ${resetUser?.firstName || resetUser?.username || 'there'},</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Your Biashara SACCO account password has been reset by an administrator.</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Your temporary password is: <strong>${tempPassword}</strong></p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">For your security, you will be required to set a new password the next time you log in. If you did not expect this change, please contact your SACCO administrator.</p>`
      );

      return res.json({ message: "Password reset successfully. User must change password on next login.", tempPassword });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post('/api/auth/change-password', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const { currentPassword, newPassword } = req.body;
      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }
      const secSettings = await getSecuritySettings();
      const complexityCheck = validatePasswordComplexity(newPassword, secSettings.passwordComplexity);
      if (!complexityCheck.valid) {
        return res.status(400).json({ message: complexityCheck.message });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!user.mustChangePassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "Current password is required" });
        }
        const bcrypt = await import('bcryptjs');
        const isValid = await bcrypt.compare(currentPassword, user.password || '');
        if (!isValid) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
      }
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(userId, { password: hashedPassword, mustChangePassword: false });
      return res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      return res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post('/api/auth/2fa/setup', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "User not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.twoFactorEnabled) return res.status(409).json({ message: "Two-factor authentication is already enabled" });

      const OTPAuth = await import('otpauth');
      const secret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({
        issuer: 'Biashara SACCO',
        label: user.username || user.email || 'User',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
      });

      (req.session as any).pendingTwoFactorSetup = createChallenge(userId, secret.base32);

      return res.json({
        secret: secret.base32,
        uri: totp.toString(),
        qrData: totp.toString(),
      });
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      return res.status(500).json({ message: "Failed to set up two-factor authentication" });
    }
  });

  app.post('/api/auth/2fa/verify', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "User not authenticated" });
      const user = await storage.getUser(userId);
      const pending = (req.session as any).pendingTwoFactorSetup;
      if (!user || !pending?.secret) {
        return res.status(400).json({ message: "Two-factor authentication not set up" });
      }
      if (user.twoFactorEnabled) return res.status(409).json({ message: "Two-factor authentication is already enabled" });

      if (!await verifyChallenge(pending, userId, pending.secret, req.body?.code)) {
        return res.status(400).json({ message: "Invalid or expired verification challenge. Restart setup if necessary." });
      }

      delete (req.session as any).pendingTwoFactorSetup;
      const enrolled = await db.update(usersTable)
        .set({ twoFactorEnabled: true, twoFactorSecret: pending.secret })
        .where(and(eq(usersTable.id, userId), or(eq(usersTable.twoFactorEnabled, false), isNull(usersTable.twoFactorEnabled))))
        .returning({ id: usersTable.id });
      if (!enrolled.length) return res.status(409).json({ message: "Two-factor authentication is already enabled" });
      (req.session as any).twoFactorVerified = true;
      (req.session as any).lastActivity = Date.now();

      await sendNotificationEmail(
        storage,
        user.email,
        'Two-Factor Authentication Enabled',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Hello ${user.firstName || user.username || 'there'},</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Two-factor authentication has just been enabled on your Biashara SACCO account, adding an extra layer of security at login.</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">If you did not make this change, please contact your SACCO administrator immediately.</p>`
      );

      return res.json({ message: "Two-factor authentication enabled successfully" });
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      return res.status(500).json({ message: "Failed to verify two-factor authentication" });
    }
  });

  app.post('/api/auth/2fa/disable', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "User not authenticated" });
      const required = await storage.getSystemSetting('twoFactorRequired');
      if (required?.settingValue === 'true') return res.status(403).json({ message: "Two-factor authentication is required by SACCO policy" });
      const user = await storage.getUser(userId);
      if (!user?.twoFactorEnabled || !user.twoFactorSecret) return res.status(400).json({ message: "Two-factor authentication is not enabled" });
      if (!await authorizeDisable(userId, user.twoFactorSecret, req.body?.code)) {
        return res.status(400).json({ message: "Invalid verification code or too many attempts. Wait five minutes after repeated failures." });
      }

      await storage.updateUser(userId, { twoFactorEnabled: false, twoFactorSecret: null });
      delete (req.session as any).pendingTwoFactorSetup;
      (req.session as any).twoFactorVerified = false;

      const disabledUser = await storage.getUser(userId);
      await sendNotificationEmail(
        storage,
        disabledUser?.email,
        'Two-Factor Authentication Disabled',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Hello ${disabledUser?.firstName || disabledUser?.username || 'there'},</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Two-factor authentication has just been disabled on your Biashara SACCO account.</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">If you did not make this change, please contact your SACCO administrator immediately and secure your account.</p>`
      );

      return res.json({ message: "Two-factor authentication disabled" });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      return res.status(500).json({ message: "Failed to disable two-factor authentication" });
    }
  });

  app.delete('/api/auth/users/:id', isAuthenticated, requirePermission('delete', 'users'), async (req: AuthRequest, res) => {
    try {
      const id = getRouteParam(req.params.id);
      const requestingUserId = getUserId(req);
      
      if (id === requestingUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      await storage.deleteUser(id);
      return res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Update user settings
  app.get('/api/auth/settings', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const defaults = {
        emailNotifications: true,
        browserNotifications: true,
        smsNotifications: false,
        loanUpdates: true,
        paymentReminders: true,
        systemAlerts: true,
        theme: "system",
        language: "en",
        soundEnabled: true,
        autoLogout: 120,
      };

      const savedJson = await storage.getUserSettings(userId);
      let saved = {};
      if (savedJson) {
        try { saved = JSON.parse(savedJson); } catch { saved = {}; }
      }
      return res.json({ ...defaults, ...saved });
    } catch (error) {
      console.error("Error fetching user settings:", error);
      return res.status(500).json({ message: "Failed to fetch user settings" });
    }
  });

  app.patch('/api/auth/settings', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const parsedSettings = personalSettingsSchema.safeParse(req.body);
      if (!parsedSettings.success) {
        return res.status(400).json({ message: "Invalid settings", errors: parsedSettings.error.flatten() });
      }
      const savedJson = await storage.getUserSettings(userId);
      const savedSettings = savedJson ? personalSettingsSchema.safeParse(JSON.parse(savedJson)) : null;
      const settings = { ...(savedSettings?.success ? savedSettings.data : {}), ...parsedSettings.data };

      const validSettings = {
        emailNotifications: settings.emailNotifications ?? true,
        browserNotifications: settings.browserNotifications ?? true,
        smsNotifications: settings.smsNotifications ?? false,
        loanUpdates: settings.loanUpdates ?? true,
        paymentReminders: settings.paymentReminders ?? true,
        systemAlerts: settings.systemAlerts ?? true,
        theme: settings.theme ?? "system",
        language: settings.language ?? "en",
        soundEnabled: settings.soundEnabled ?? true,
        autoLogout: settings.autoLogout ?? 120,
      };

      await storage.upsertUserSettings(userId, JSON.stringify(validSettings));

      return res.json({
        message: "Settings updated successfully", 
        settings: validSettings 
      });
    } catch (error) {
      console.error("Error updating user settings:", error);
      return res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Get admin settings (persisted in system_settings table)
  app.get('/api/admin/settings', isAuthenticated, requirePermission('read', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const allSettings = await storage.getAllSystemSettings();
      const settingsMap: Record<string, any> = {};

      const defaults: Record<string, any> = {
        maintenanceMode: false,
        systemAnnouncement: "",
        maxLoanAmount: 5000000,
        maxLoanTerm: 24,
        defaultInterestRate: 12,
        sessionTimeout: 240,
        maxLoginAttempts: 5,
        passwordComplexity: "medium",
        twoFactorRequired: false,
        emailEnabled: true,
        emailFromAddress: "",
        emailFromName: "Biashara SACCO",
        systemNotifications: true,
        memberNotifications: true,
        loanNotifications: true,
        minimumSavingsBalance: 10000,
        loanToSavingsRatio: 2.5,
        membershipDurationMonths: 3,
        minLoanApprovers: 2,
        autoBackupEnabled: true,
        backupFrequency: "daily",
        logRetentionDays: 90,
        entranceFee: 15000,
        sharePrice: 5000,
        memberExitFee: 0,
        saccoBankBranch: '253047',
        saccoBankAccount: '2201034044',
        saccoBankName: 'BIASHARA',
        saccoSwiftCode: 'KCBLUGKA',
        saccoAddress: '7 commercial plaza',
        saccoTown: 'Kamplala Uganda',
        saccoCustomerId: 'CM920321014GLG',
        saccoCustomerDob: '20210909',
      };

      for (const setting of allSettings) {
        const type = setting.settingType;
        if (type === 'number') {
          settingsMap[setting.settingKey] = parseFloat(setting.settingValue);
        } else if (type === 'boolean') {
          settingsMap[setting.settingKey] = setting.settingValue === 'true';
        } else {
          settingsMap[setting.settingKey] = setting.settingValue;
        }
      }

      return res.json({ ...defaults, ...settingsMap });
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      return res.status(500).json({ message: "Failed to fetch admin settings" });
    }
  });

  // Update admin settings (persisted in system_settings table)
  app.patch('/api/admin/settings', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const settings = req.body;
      const userId = getUserId(req);

      const numberFields = ['maxLoanAmount', 'maxLoanTerm', 'defaultInterestRate', 'sessionTimeout', 'maxLoginAttempts', 'minimumSavingsBalance', 'loanToSavingsRatio', 'membershipDurationMonths', 'minLoanApprovers', 'logRetentionDays', 'entranceFee', 'sharePrice', 'memberExitFee'];
      const booleanFields = ['maintenanceMode', 'twoFactorRequired', 'emailEnabled', 'systemNotifications', 'memberNotifications', 'loanNotifications', 'autoBackupEnabled'];
      const enumFields: Record<string, string[]> = {
        passwordComplexity: ['low', 'medium', 'high'],
        backupFrequency: ['daily', 'weekly', 'monthly'],
      };
      const numberRanges: Record<string, { min: number; max: number }> = {
        sessionTimeout: { min: 15, max: 1440 },
        maxLoginAttempts: { min: 3, max: 10 },
        logRetentionDays: { min: 30, max: 365 },
        maxLoanTerm: { min: 1, max: 60 },
        defaultInterestRate: { min: 0, max: 100 },
        loanToSavingsRatio: { min: 1, max: 10 },
        membershipDurationMonths: { min: 1, max: 12 },
        minLoanApprovers: { min: 1, max: 10 },
      };

      const errors: string[] = [];
      for (const [key, value] of Object.entries(settings)) {
        if (enumFields[key] && !enumFields[key].includes(String(value))) {
          errors.push(`${key} must be one of: ${enumFields[key].join(', ')}`);
        }
        if (numberFields.includes(key) && numberRanges[key]) {
          const numVal = Number(value);
          if (isNaN(numVal) || numVal < numberRanges[key].min || numVal > numberRanges[key].max) {
            errors.push(`${key} must be between ${numberRanges[key].min} and ${numberRanges[key].max}`);
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: `Validation errors: ${errors.join('; ')}` });
      }

      for (const [key, value] of Object.entries(settings)) {
        let type = 'string';
        if (numberFields.includes(key)) type = 'number';
        else if (booleanFields.includes(key)) type = 'boolean';

        await storage.upsertSystemSetting(key, String(value), type, undefined, userId);
      }

      if ('maintenanceMode' in settings) {
        clearMaintenanceModeCache();
      }

      if ('autoBackupEnabled' in settings || 'backupFrequency' in settings) {
        const { restartScheduledBackups } = await import('../backup');
        restartScheduledBackups();
      }

      return res.json({ message: "Admin settings updated successfully", settings });
    } catch (error) {
      console.error("Error updating admin settings:", error);
      return res.status(500).json({ message: "Failed to update admin settings" });
    }
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  app.post('/api/admin/email/test-connection', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const config = await getEmailConfig(storage);
      const result = await verifyConnection(config);
      const userId = getUserId(req);
      if (userId) {
        try {
          await storage.createAuditLog({
            userId,
            action: 'email_test_connection',
            resource: 'system-settings',
            resourceId: 'email',
            details: `Email connection test: ${result.success ? 'success' : 'failed'}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          });
        } catch (e) {}
      }
      if (result.success) {
        return res.json({ message: 'Resend email connection successful', success: true });
      } else {
        return res.status(400).json({ message: result.error || 'Resend connection failed. Ensure the Resend integration is connected.', success: false });
      }
    } catch (error: any) {
      console.error('Email connection test error:', error);
      return res.status(500).json({ message: 'Connection test failed. Verify the Resend integration is connected.', success: false });
    }
  });

  app.post('/api/admin/email/send-test', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const { to } = req.body;
      if (!to || typeof to !== 'string' || !emailRegex.test(to)) {
        return res.status(400).json({ message: 'A valid recipient email address is required' });
      }

      const config = await getEmailConfig(storage);
      const html = buildEmailTemplate(
        'Test Email',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
          This is a test email from the Biashara SACCO Management System.
        </p>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
          If you received this message, your email configuration is working correctly with Resend.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="color:#166534;font-size:14px;margin:0;font-weight:600;">✓ Email delivery confirmed</p>
        </div>`
      );

      const result = await sendEmail(config, { to, subject: 'Biashara SACCO - Test Email', html });
      const userId = getUserId(req);
      if (userId) {
        try {
          await storage.createAuditLog({
            userId,
            action: 'email_test',
            resource: 'system-settings',
            resourceId: 'email',
            details: `Test email sent to ${to}: ${result.success ? 'delivered' : 'failed'}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          });
        } catch (e) {}
      }
      if (result.success) {
        return res.json({ message: `Test email sent to ${to}`, success: true });
      } else {
        return res.status(400).json({ message: result.error || 'Failed to send test email. Check the Resend integration and your verified sender address.', success: false });
      }
    } catch (error: any) {
      console.error('Email send-test error:', error);
      return res.status(500).json({ message: 'Failed to send test email. Please try again.', success: false });
    }
  });

  app.post('/api/admin/email/send', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const { to, subject, message, memberIds } = req.body;

      if (!subject || typeof subject !== 'string' || subject.length > 200) {
        return res.status(400).json({ message: 'A valid subject is required (max 200 characters)' });
      }
      if (!message || typeof message !== 'string' || message.length > 10000) {
        return res.status(400).json({ message: 'A valid message is required (max 10,000 characters)' });
      }

      const config = await getEmailConfig(storage);
      if (!config.emailEnabled) {
        return res.status(400).json({ message: 'Email system is disabled. Enable it in Admin Settings.' });
      }

      let recipients: string[] = [];

      if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
        if (memberIds.length > 500) {
          return res.status(400).json({ message: 'Too many recipients. Maximum 500 members per batch.' });
        }
        for (const memberId of memberIds) {
          const member = await storage.getMember(memberId);
          if (member?.email && emailRegex.test(member.email)) {
            recipients.push(member.email);
          }
        }
      } else if (to) {
        const toList = Array.isArray(to) ? to : [to];
        recipients = toList.filter((r: string) => typeof r === 'string' && emailRegex.test(r));
      }

      if (recipients.length === 0) {
        return res.status(400).json({ message: 'No valid email recipients found' });
      }

      const html = buildEmailTemplate(
        subject,
        `<div style="color:#475569;font-size:15px;line-height:1.6;">${message.replace(/\n/g, '<br>')}</div>`
      );

      let successCount = 0;
      let failCount = 0;

      for (const recipient of recipients) {
        const result = await sendEmail(config, { to: recipient, subject: `Biashara SACCO - ${subject}`, html });
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      const userId = getUserId(req);
      if (userId) {
        try {
          await storage.createAuditLog({
            userId,
            action: 'email_send',
            resource: 'system-settings',
            resourceId: 'email',
            details: `Sent email "${subject}" to ${successCount} of ${recipients.length} recipients. ${failCount} failed.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          });
        } catch (e) {}
      }

      return res.json({
        message: `Email sent to ${successCount} recipient(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
        success: successCount > 0,
        successCount,
        failCount,
      });
    } catch (error: any) {
      console.error('Email send error:', error);
      return res.status(500).json({ message: 'Failed to send email. Please try again.', success: false });
    }
  });

  app.post('/api/admin/backup', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const { createBackup } = await import('../backup');
      const result = await createBackup();
      return res.json({ message: "Backup created successfully", backup: result });
    } catch (error) {
      console.error("Error creating backup:", error);
      return res.status(500).json({ message: "Failed to create backup" });
    }
  });

  app.get('/api/admin/backups', isAuthenticated, requirePermission('read', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const { getBackupList } = await import('../backup');
      const backups = getBackupList();
      return res.json(backups);
    } catch (error) {
      console.error("Error listing backups:", error);
      return res.status(500).json({ message: "Failed to list backups" });
    }
  });

  app.get('/api/admin/backups/:filename', isAuthenticated, requirePermission('read', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const { downloadBackup } = await import('../backup');
      const filepath = downloadBackup(getRouteParam(req.params.filename));
      if (!filepath) {
        return res.status(404).json({ message: "Backup not found" });
      }
      return res.download(filepath);
    } catch (error) {
      console.error("Error downloading backup:", error);
      return res.status(500).json({ message: "Failed to download backup" });
    }
  });

  // Public endpoint to fetch specific system settings (for member form)
  app.get('/api/system/settings/public', isAuthenticated, async (req, res) => {
    try {
      const entranceFeeSetting = await storage.getSystemSetting('entranceFee');
      const sharePriceSetting = await storage.getSystemSetting('sharePrice');
      const loanToSavingsRatioSetting = await storage.getSystemSetting('loanToSavingsRatio');
      const minLoanApproversSetting = await storage.getSystemSetting('minLoanApprovers');

      return res.json({
        entranceFee: entranceFeeSetting ? parseFloat(entranceFeeSetting.settingValue) : 15000,
        sharePrice: sharePriceSetting ? parseFloat(sharePriceSetting.settingValue) : 5000,
        loanToSavingsRatio: loanToSavingsRatioSetting ? parseFloat(loanToSavingsRatioSetting.settingValue) : 2.5,
        minLoanApprovers: minLoanApproversSetting ? parseInt(minLoanApproversSetting.settingValue) : 2,
      });
    } catch (error) {
      console.error("Error fetching public settings:", error);
      return res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Dashboard metrics
  app.get('/api/dashboard/metrics', isAuthenticated, requirePermission('read', 'dashboard'), async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      return res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      return res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Dashboard analytics API
  app.get('/api/dashboard/analytics', isAuthenticated, requirePermission('read', 'dashboard'), async (req: AuthRequest, res) => {
    try {
      const months = Math.min(Math.max(parseInt(req.query.months as string) || 6, 1), 24);
      const analytics = await storage.getDashboardAnalytics(months);
      return res.json(analytics);
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error);
      return res.status(500).json({ message: 'Failed to fetch analytics data' });
    }
  });

  // Recent transactions
  app.get('/api/dashboard/recent-transactions', isAuthenticated, requirePermission('read', 'dashboard'), filterDataByRole(), async (req: any, res) => {
    try {
      const allTransactions = await storage.getRecentTransactions(50); // Get more to filter
      // Filter transactions based on user role
      const filteredTransactions = filterTransactionsByRole(allTransactions, req.member?.roles || ['member'], req.member?.userId || '');
      return res.json(filteredTransactions.slice(0, 10)); // Return top 10 after filtering
    } catch (error) {
      console.error("Error fetching recent transactions:", error);
      return res.status(500).json({ message: "Failed to fetch recent transactions" });
    }
  });

  // Pending approvals
  app.get('/api/dashboard/pending-approvals', isAuthenticated, requirePermission('read', 'dashboard'), filterDataByRole(), async (req: any, res) => {
    try {
      const approvals = await storage.getPendingApprovals();
      
      // Filter approvals based on user roles
      const userRoles = req.member?.roles || ['member'];
      let filteredApprovals: any = { loanApplications: [], withdrawalRequests: [] };
      
      if (userRoles.some((role: string) => ['admin', 'manager', 'committee', 'treasurer'].includes(role))) {
        // Staff can see all pending approvals
        filteredApprovals = approvals;
      } else {
        // Members can only see their own pending items
        const userId = req.member?.userId || '';
        filteredApprovals = {
          loanApplications: approvals.loanApplications.filter((loan: any) => loan.member?.userId === userId),
          withdrawalRequests: approvals.withdrawalRequests.filter((req: any) => req.member?.userId === userId)
        };
      }
      
      return res.json(filteredApprovals);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      return res.status(500).json({ message: "Failed to fetch pending approvals" });
    }
  });

  // Helper functions for role checking
  const isCommitteeOrAdmin = async (userId: string): Promise<boolean> => {
    const user = await storage.getUser(userId);
    if (user?.role === 'admin' || user?.role === 'committee') return true;
    
    const member = await storage.getMemberByUserId(userId);
    if (!member) return false;
    
    const roles = await storage.getMemberRoles(member.id);
    return roles.some(role => ['committee', 'admin'].includes(role));
  };

  const isStaffUser = async (userId: string): Promise<boolean> => {
    const user = await storage.getUser(userId);
    if (user?.role && ['admin', 'manager', 'committee', 'treasurer'].includes(user.role)) return true;
    
    const member = await storage.getMemberByUserId(userId);
    if (!member) return false;
    
    const roles = await storage.getMemberRoles(member.id);
    return roles.some(role => ['admin', 'manager', 'committee', 'treasurer'].includes(role));
  };

  const getUserRoleNames = async (userId: string): Promise<string[]> => {
    const user = await storage.getUser(userId);
    const member = await storage.getMemberByUserId(userId);
    
    if (member) {
      const roles = await storage.getMemberRoles(member.id);
      if (roles.length > 0) return roles;
    }
    
    if (user?.role) return [user.role];
    return ['member'];
  };

  const hasApprovalRole = async (userId: string, requiredRole: string): Promise<boolean> => {
    const user = await storage.getUser(userId);
    if (user?.role === 'admin') {
      return requiredRole !== 'committee';
    }
    
    const member = await storage.getMemberByUserId(userId);
    const roles = member ? await storage.getMemberRoles(member.id) : [];
    if (roles.length === 0 && member?.role) roles.push(member.role);
    if (roles.length === 0 && user?.role) roles.push(user.role);
    
    if (requiredRole === 'committee') {
      return roles.includes('committee');
    }
    if (requiredRole === 'treasurer') {
      return roles.includes('treasurer');
    }
    if (requiredRole === 'manager') {
      return roles.includes('manager');
    }
    
    return false;
  };

  // Member routes
  app.post('/api/members', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = getUserId(req)!;

      // Check if ID number already exists
      const existingMemberByIdNumber = await storage.getMemberByIdNumber(req.body.idNumber);
      if (existingMemberByIdNumber) {
        return res.status(400).json({ 
          message: "A member with this ID number already exists",
          field: "idNumber"
        });
      }

      // Determine if this is a staff member adding a new member or a user self-registering
      const currentUser = await storage.getUser(currentUserId);
      const currentMember = await storage.getMemberByUserId(currentUserId);
      const currentRoles = currentMember ? await storage.getMemberRoles(currentMember.id) : (currentUser?.role ? [currentUser.role] : []);
      const isStaff = currentUser?.role === 'admin' || currentRoles.some(role => ['admin', 'manager', 'committee', 'treasurer'].includes(role));
      const canAutoApprove = currentUser?.role === 'admin';

      let newUserId = currentUserId;

      if (isStaff) {
        // Admin is adding a new member - create a user account for them
        const username = req.body.username || generateUsername(req.body.fullName);
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
          return res.status(400).json({
            message: `Username "${username}" already exists. Please provide a different username.`,
            field: "username"
          });
        }
        const autoPassword = req.body.password || generateDefaultPassword(req.body.fullName);
        if (req.body.password !== undefined) {
          const security = await getSecuritySettings();
          const validation = validatePasswordComplexity(req.body.password, security.passwordComplexity);
          if (!validation.valid) return res.status(400).json({ message: validation.message });
        }
        const defaultPassword = await hashPassword(autoPassword);
        const nameParts = (req.body.fullName || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const newUser = await storage.upsertUser({
          id: `member-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          username,
          password: defaultPassword,
          email: req.body.email || `${username}@biasharasacco.com`,
          firstName,
          lastName,
          role: 'member',
          authMethod: 'local',
          mustChangePassword: true,
        });
        newUserId = newUser.id;
      } else {
        // Self-registration: check if user already has a member profile
        if (currentMember) {
          return res.status(400).json({ 
            message: "You already have a member profile",
            field: "userId"
          });
        }
      }
      
      // Generate unique member number
      const memberCount = (await storage.getAllMembers()).length;
      const memberNumber = `BCS${String(memberCount + 1).padStart(6, '0')}`;
      
      // Add the auto-generated fields to the request body before validation
      const memberData = {
        ...req.body,
        memberNumber,
        userId: newUserId,
        status: canAutoApprove ? 'active' : 'pending',
        joinDate: new Date(),
        approvedBy: canAutoApprove ? currentUserId : undefined,
        approvedAt: canAutoApprove ? new Date() : undefined,
        membershipStartDate: canAutoApprove ? new Date() : undefined,
      };

      // Remove fields that aren't part of the member schema
      delete memberData.username;
      delete memberData.password;
      delete memberData.initialDeposit;
      
      // Create member
      const member = await storage.createMember(memberData as any);

      // Assign member role
      await storage.addMemberRole(member.id, memberData.role || 'member', currentUserId);
      
      // Generate unique account number
      const accountNumber = `SAV${String(member.id).padStart(8, '0')}`;
      
      // Create default savings account
      await storage.createSavingsAccount({
        memberId: member.id,
        accountNumber,
        accountType: 'regular',
        balance: req.body.initialDeposit || '0.00',
      });

      broadcastDataUpdate(['/api/members', '/api/dashboard']);

      await sendNotificationEmail(
        storage,
        member.email,
        member.status === 'active' ? 'Welcome to Biashara SACCO' : 'Membership Application Received',
        member.status === 'active'
          ? `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${member.fullName},</p>
             <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Welcome to Biashara SACCO! Your membership is now active. Your member number is <strong>${member.memberNumber}</strong>.</p>
             <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">You can now log in to access your account, view your savings, and apply for loans.</p>`
          : `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${member.fullName},</p>
             <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Thank you for applying to join Biashara SACCO. Your application (member number <strong>${member.memberNumber}</strong>) has been received and is pending approval.</p>
             <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">We will notify you by email as soon as your application has been reviewed.</p>`
      );

      return res.status(201).json(member);
    } catch (error) {
      console.error("Error creating member:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create member" });
    }
  });

  // Get pending members for committee approval
  app.get('/api/members/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      if (!await isCommitteeOrAdmin(userId)) {
        return res.status(403).json({ message: "Access denied. Committee or admin role required." });
      }

      const pendingMembers = await storage.getPendingMembers();
      return res.json(pendingMembers);
    } catch (error) {
      console.error("Error fetching pending members:", error);
      return res.status(500).json({ message: "Failed to fetch pending members" });
    }
  });

  // Approve member application
  app.post('/api/members/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      if (!await isCommitteeOrAdmin(userId)) {
        return res.status(403).json({ message: "Access denied. Committee or admin role required." });
      }

      const { id } = req.params;
      const { comments } = req.body;
      
      const member = await storage.approveMember(await storage.resolveMemberId(id), userId, comments);
      
      // Create default savings account after approval
      const accountNumber = `SAV${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await storage.createSavingsAccount({
        memberId: member.id,
        accountNumber,
        accountType: 'regular',
        balance: '0.00',
      });

      // Create notification for member approval
      await createAndBroadcastNotification({
        type: 'member_approved',
        title: 'Membership Approved',
        message: `Congratulations! Your membership application has been approved. Welcome to Biashara SACCO! Your member number is ${member.memberNumber}.`,
        priority: 'high',
        actionUrl: '/dashboard',
        memberId: member.id,
        userId: member.userId,
        isRead: false
      });

      await sendNotificationEmail(
        storage,
        member.email,
        'Membership Approved',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${member.fullName},</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Congratulations! Your membership application has been approved. Welcome to Biashara SACCO.</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">Your member number is <strong>${member.memberNumber}</strong>. You can now log in to start saving and access member services.</p>`
      );

      return res.json({ message: "Member approved successfully", member });
    } catch (error) {
      console.error("Error approving member:", error);
      return res.status(500).json({ message: "Failed to approve member" });
    }
  });

  // Reject member application
  app.post('/api/members/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      if (!await isCommitteeOrAdmin(userId)) {
        return res.status(403).json({ message: "Access denied. Committee or admin role required." });
      }

      const { id } = req.params;
      const { comments } = req.body;
      
      const member = await storage.rejectMember(await storage.resolveMemberId(id), userId, comments);

      if (member.userId) {
        await createAndBroadcastNotification({
          type: 'member_rejected',
          title: 'Membership Application Rejected',
          message: `Your membership application has been rejected.${comments ? ` Reason: ${comments}` : ''} Please contact the SACCO office for more information.`,
          priority: 'high',
          actionUrl: '/dashboard',
          memberId: member.id,
          userId: member.userId,
          isRead: false
        });
      }

      return res.json({ message: "Member application rejected", member });
    } catch (error) {
      console.error("Error rejecting member:", error);
      return res.status(500).json({ message: "Failed to reject member" });
    }
  });

  // Get specific member by ID
  app.get('/api/members/:id', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.id);

      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      return res.json(member);
    } catch (error) {
      console.error("Error fetching member:", error);
      return res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  app.get('/api/members', isAuthenticated, filterDataByRole(), async (req: any, res) => {
    try {
      const { search, page, limit, status } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));

      if (page || limit) {
        const userRoles = req.member?.roles || ['member'];
        const isStaff = userRoles.some((role: string) => ['admin', 'committee', 'treasurer'].includes(role));

        if (isStaff) {
          const result = await storage.getMembersPaginated(pageNum, limitNum, search as string, status as string);
          return res.json(result);
        } else {
          const userId = getUserId(req);
          const member = userId ? await storage.getMemberByUserId(userId) : null;
          return res.json({ data: member ? [member] : [], total: member ? 1 : 0 });
        }
      }

      const allMembers = search 
        ? await storage.searchMembers(search as string)
        : await storage.getAllMembers();
      
      const filteredMembers = filterMembersByRole(allMembers, req.member?.roles || ['member'], req.member?.userId || '');
      return res.json(filteredMembers);
    } catch (error) {
      console.error("Error fetching members:", error);
      return res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  // Update member roles (admin only) - now supports multiple roles
  app.patch('/api/members/:id/roles', isAuthenticated, requirePermission('update', 'system-settings'), async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.id);
      const { roles } = req.body;
      const userId = getUserId(req)!;
      
      if (!Array.isArray(roles)) {
        return res.status(400).json({ message: "Roles must be an array" });
      }
      
      if (roles.includes('admin')) {
        return res.status(400).json({ message: "Admin role cannot be assigned through member roles. Use User Management instead." });
      }
      const dbRoles = await storage.getAllRoles();
      const validRoleNames = dbRoles.map(r => r.name).filter(n => n !== 'admin');
      if (!roles.every((role: string) => validRoleNames.includes(role))) {
        return res.status(400).json({ message: "Invalid role(s)" });
      }

      // Replace all roles for the member
      await storage.replaceMemberRoles(memberId, roles, userId);
      
      // Log the role change
      await storage.createAuditLog({
        userId,
        memberId,
        action: 'update',
        resource: 'member',
        resourceId: memberId.toString(),
        details: `Changed roles to: ${roles.join(', ')}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return res.json({ success: true, roles });
    } catch (error) {
      console.error("Error updating member roles:", error);
      return res.status(500).json({ message: "Failed to update member roles" });
    }
  });

  // Get member roles
  app.get('/api/members/:id/roles', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.id);
      const roles = await storage.getMemberRoles(memberId);
      return res.json(roles);
    } catch (error) {
      console.error("Error fetching member roles:", error);
      return res.status(500).json({ message: "Failed to fetch member roles" });
    }
  });

  app.get('/api/members/:id', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.id));

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      // Get user's member record to check their roles and permissions
      const requestingUser = await storage.getUser(userId);
      const requestingMember = await storage.getMemberByUserId(userId);
      
      // Admin without member profile has full access
      const isUserAdmin = requestingUser?.role === 'admin';

      // Get user's roles for permission checking - also check user.role directly for staff without member profiles
      const roleNames = requestingMember ? await storage.getMemberRoles(requestingMember.id) : [];
      const effectiveRoles = roleNames.length > 0 ? roleNames : (requestingUser?.role ? [requestingUser.role] : []);

      // Access control logic:
      // 1. Members can only view their own data
      // 2. Staff (committee, manager, admin) can view any member data
      const isStaff = isUserAdmin || effectiveRoles.some(role => ['admin', 'manager', 'committee', 'treasurer'].includes(role));
      const isOwnRecord = requestingMember?.id === memberId;

      if (!isStaff && !isOwnRecord) {
        return res.status(403).json({ message: "Access denied - insufficient permissions" });
      }

      // Fetch the member data
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Log access for audit purposes (especially for staff accessing other members' data)
      if (isStaff && !isOwnRecord) {
        await storage.createAuditLog({
          userId,
          memberId: requestingMember?.id || 0,
          action: 'view',
          resource: 'member',
          resourceId: memberId.toString(),
          details: `Viewed member profile: ${member.memberNumber}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      return res.json(member);
    } catch (error) {
      console.error("Error fetching member:", error);
      return res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  app.get('/api/members/by-user/:userId', isAuthenticated, async (req: any, res) => {
    try {
      let userId: string | undefined = getRouteParam(req.params.userId);
      
      // Handle "undefined" string from client
      if (userId === 'undefined' || !userId) {
        userId = getUserId(req);
      }
      
      if (!userId) {
        return res.status(400).json({ message: "User ID not provided" });
      }
      
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      return res.json(member);
    } catch (error) {
      console.error("Error fetching member by user:", error);
      return res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  // Post share capital for a member (admin only)
  app.post('/api/members/:id/share-capital', isAuthenticated, requirePermission('create', 'transactions'), async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.id));
      const { amount, description } = req.body;

      const requestingUser = await storage.getUser(getUserId(req)!);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return res.status(403).json({ message: "Only administrators can post share capital" });
      }

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Amount must be greater than zero" });
      }

      const paymentAmount = parseFloat(amount);
      const sharePriceSetting = await storage.getSystemSetting('sharePrice');
      const perSharePrice = sharePriceSetting ? parseFloat(sharePriceSetting.settingValue) : 5000;

      const referenceNumber = `SHR${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const { transaction, newShareCapital, isPaidUp, expectedTotal } = await storage.runSaccoLedgerTransaction(async (tx) => {
        const lockedMembers = await tx.execute(sql`SELECT * FROM ${members} WHERE ${members.id} = ${memberId} FOR UPDATE`);
        const member = lockedMembers.rows[0] as typeof members.$inferSelect | undefined;
        if (!member) throw new Error("Member not found");
        const currentShareCapital = parseFloat(member.shareCapital || "0");
        const newShareCapital = currentShareCapital + paymentAmount;
        const expectedTotal = perSharePrice * (member.numberOfShares || 4);
        const isPaidUp = newShareCapital >= expectedTotal;
        const [createdTransaction] = await tx.insert(transactions).values({
          memberId,
          transactionType: 'share_capital',
          amount: amount.toString(),
          referenceNumber,
          description: description || 'Share capital payment',
          status: 'completed',
          processedBy: getUserId(req),
        }).returning();
        await recordJournalEntry('share_capital_contribution', amount, `Share capital payment - ${member.memberNumber}`, referenceNumber, getUserId(req)!, tx);
        await tx.update(members).set({
          shareCapital: newShareCapital.toString(),
          isPaidUp,
          isFullyPaidShareholder: isPaidUp,
          updatedAt: new Date(),
        }).where(eq(members.id, memberId));
        return { transaction: createdTransaction, newShareCapital, isPaidUp, expectedTotal };
      });

      return res.json({
        transaction,
        shareCapital: newShareCapital,
        isPaidUp,
        expectedTotal,
        message: isPaidUp
          ? "Share capital posted. Member is now fully paid up."
          : `Share capital posted. UGX ${(expectedTotal - newShareCapital).toLocaleString()} remaining.`,
      });
    } catch (error) {
      console.error("Error posting share capital:", error);
      return res.status(500).json({ message: "Failed to post share capital" });
    }
  });

  app.post('/api/members/:id/waive-share-capital', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.id));
      const requestingUser = await storage.getUser(getUserId(req)!);
      if (!requestingUser?.role || !['admin', 'treasurer'].includes(requestingUser.role)) {
        return res.status(403).json({ message: "Only admin or treasurer can waive share capital" });
      }

      const member = await storage.getMember(memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });

      const { waive } = req.body;
      const waived = waive !== false;

      await storage.updateMember(memberId, {
        shareCapitalWaived: waived,
        isPaidUp: waived ? true : undefined,
        isFullyPaidShareholder: waived ? true : undefined,
      });

      return res.json({ message: waived ? "Share capital requirement waived" : "Share capital waiver removed" });
    } catch (error) {
      console.error("Error waiving share capital:", error);
      return res.status(500).json({ message: "Failed to update share capital waiver" });
    }
  });

  // Update member details
  app.patch('/api/members/:id', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.id);
      const updates = req.body;
      
      // Get requesting member for permission check
      const updatingUser = await storage.getUser(getUserId(req)!);
      const requestingMember = await storage.getMemberByUserId(getUserId(req)!);
      const isUpdatingAdmin = updatingUser?.role === 'admin';

      // Get user's roles for permission checking - also check user.role directly for staff without member profiles
      const roleNames = requestingMember ? await storage.getMemberRoles(requestingMember.id) : [];
      const effectiveRoles = roleNames.length > 0 ? roleNames : (updatingUser?.role ? [updatingUser.role] : []);

      // Access control: members can only update their own data, staff can update any
      const isStaff = isUpdatingAdmin || effectiveRoles.some(role => ['admin', 'manager', 'committee', 'treasurer'].includes(role));
      const isOwnRecord = requestingMember?.id === memberId;

      if (!isStaff && !isOwnRecord) {
        return res.status(403).json({ message: "Access denied - insufficient permissions" });
      }

      if (updates.joinDate && typeof updates.joinDate === 'string') {
        updates.joinDate = new Date(updates.joinDate);
      }

      const updatedMember = await storage.updateMember(memberId, updates);

      if (updatedMember.userId) {
        const userSyncUpdates: any = {};
        if (updates.fullName) {
          const nameParts = updates.fullName.trim().split(/\s+/);
          userSyncUpdates.firstName = nameParts[0] || '';
          userSyncUpdates.lastName = nameParts.slice(1).join(' ') || '';
        }
        if (updates.email) userSyncUpdates.email = updates.email;
        if (Object.keys(userSyncUpdates).length > 0) {
          await storage.updateUser(updatedMember.userId, userSyncUpdates);
        }
      }

      if (updates.staffAccountNumber || updates.accountNumber) {
        const accountNum = updates.staffAccountNumber || updates.accountNumber || updatedMember.staffAccountNumber || updatedMember.accountNumber;
        if (accountNum) {
          await db
            .update(loans)
            .set({ staffAccountNumber: accountNum })
            .where(eq(loans.memberId, memberId));
        }
      }
      
      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'update',
        resource: 'member',
        resourceId: memberId.toString(),
        details: `Updated member profile: ${updatedMember.memberNumber}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      broadcastDataUpdate(['/api/members', '/api/dashboard', '/api/loans']);
      return res.json(updatedMember);
    } catch (error) {
      console.error("Error updating member:", error);
      return res.status(500).json({ message: "Failed to update member" });
    }
  });

  // Helper: compute exit eligibility details for a member
  async function getExitEligibilityDetails(memberId: number) {
    const member = await storage.getMember(memberId);
    if (!member) throw new Error('Member not found');

    if (member.status === 'exited') {
      return { eligible: false, blockers: ['Member has already exited'], canUseSavingsForLoan: false, totalOutstandingLoan: 0, totalSavings: 0, exitFee: 0, member };
    }

    const savingsAccounts = await storage.getSavingsAccountsByMember(memberId);
    const actualTotalSavings = savingsAccounts.reduce((sum: number, s: any) => sum + parseFloat(s.balance || '0'), 0);

    const existingRequest = await db.select().from(memberExitRequests)
      .where(eq(memberExitRequests.memberId, memberId));
    const pendingRequest = existingRequest.find(r => r.status === 'pending_treasurer');

    const blockers: string[] = [];
    let canUseSavingsForLoan = false;
    let totalOutstandingLoan = 0;

    const activeLoans = await storage.getMemberActiveLoans(memberId);
    const runningLoans = activeLoans.filter((l: any) =>
      ['active', 'disbursed', 'approved', 'manager_approved', 'committee_approved'].includes(l.status)
    );

    if (runningLoans.length > 0) {
      totalOutstandingLoan = runningLoans.reduce((sum: number, l: any) => sum + parseFloat(l.outstandingBalance || '0'), 0);
      if (actualTotalSavings >= totalOutstandingLoan) {
        canUseSavingsForLoan = true;
      } else {
        blockers.push(`Member has ${runningLoans.length} active loan(s) with total outstanding balance of UGX ${totalOutstandingLoan.toLocaleString()} which exceeds available savings of UGX ${actualTotalSavings.toLocaleString()}`);
      }
    }

    const guaranteedLoans = await storage.getGuarantorsByMember(memberId);
    for (const g of guaranteedLoans as any[]) {
      if (g.status === 'approved' && g.loan) {
        const loan = g.loan as any;
        const loanActive = ['active', 'disbursed', 'approved', 'manager_approved', 'committee_approved'].includes(loan.status);
        if (loanActive && parseFloat(loan.outstandingBalance || '0') > 0) {
          blockers.push(`Member is a guarantor on loan ${loan.loanNumber} which has not been fully repaid (outstanding: UGX ${parseFloat(loan.outstandingBalance).toLocaleString()})`);
        }
      }
    }

    const exitFeeSetting = await storage.getSystemSetting('memberExitFee');
    const exitFee = exitFeeSetting ? parseFloat(exitFeeSetting.settingValue) : 0;

    return {
      eligible: blockers.length === 0 && !canUseSavingsForLoan,
      blockers,
      canUseSavingsForLoan,
      totalOutstandingLoan,
      totalSavings: actualTotalSavings,
      exitFee,
      pendingRequest: pendingRequest || null,
      member: {
        id: member.id,
        fullName: member.fullName,
        memberNumber: member.memberNumber,
        totalSavings: actualTotalSavings.toFixed(2),
        shareCapital: member.shareCapital,
        status: member.status,
      },
    };
  }

  // Member exit eligibility check
  app.get('/api/members/:id/exit-eligibility', isAuthenticated, requirePermission('create', 'exit-requests'), async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.id));
      const details = await getExitEligibilityDetails(memberId);
      return res.json(details);
    } catch (error: any) {
      console.error("Error checking exit eligibility:", error);
      return res.status(500).json({ message: error.message || "Failed to check exit eligibility" });
    }
  });

  // Submit member exit request (creates a pending_treasurer request)
  app.post('/api/members/:id/exit', isAuthenticated, requirePermission('create', 'exit-requests'), async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.id));
      const { reason } = req.body;
      const userId = getUserId(req)!;

      const member = await storage.getMember(memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });
      if (member.status === 'exited') return res.status(400).json({ message: "Member has already exited" });

      // Check for existing pending request
      const existingRequests = await db.select().from(memberExitRequests)
        .where(eq(memberExitRequests.memberId, memberId));
      if (existingRequests.some(r => r.status === 'pending_treasurer')) {
        return res.status(400).json({ message: "An exit request is already pending treasurer approval" });
      }

      const eligibility = await getExitEligibilityDetails(memberId);

      // Only block if there are blockers that savings cannot resolve
      if (!eligibility.eligible && !eligibility.canUseSavingsForLoan) {
        return res.status(400).json({ message: eligibility.blockers[0] || "Member is not eligible for exit" });
      }
      // If there are blockers that are NOT the savings-covers-loan case, block
      const nonSavingsBlockers = eligibility.blockers.filter(b => !b.includes('active loan'));
      if (nonSavingsBlockers.length > 0) {
        return res.status(400).json({ message: nonSavingsBlockers[0] });
      }

      // Create the exit request - requires treasurer approval
      const [exitRequest] = await db.insert(memberExitRequests).values({
        memberId,
        requestedBy: userId,
        reason: reason || null,
        status: 'pending_treasurer',
        exitFee: eligibility.exitFee > 0 ? eligibility.exitFee.toString() : '0',
        savingsUsedForLoanRepayment: eligibility.canUseSavingsForLoan,
        loanAmountRepaid: eligibility.canUseSavingsForLoan ? eligibility.totalOutstandingLoan.toString() : null,
      }).returning();

      await storage.createAuditLog({
        userId,
        memberId,
        action: 'create',
        resource: 'member-exit-request',
        resourceId: exitRequest.id.toString(),
        details: `Exit request submitted for member ${member.memberNumber}. Reason: ${reason || 'Not specified'}. ${eligibility.canUseSavingsForLoan ? `Savings will be used to repay UGX ${eligibility.totalOutstandingLoan.toLocaleString()} in loans.` : ''}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      await sendNotificationEmail(
        storage,
        member.email,
        'Exit Request Submitted',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${member.fullName},</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Your request to exit Biashara SACCO has been submitted and is now awaiting treasurer approval.</p>
         ${eligibility.canUseSavingsForLoan ? `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Note: your savings will be used to repay an outstanding loan balance of <strong>UGX ${eligibility.totalOutstandingLoan.toLocaleString()}</strong> as part of the exit.</p>` : ''}
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">We will notify you by email once your request has been processed.</p>`
      );

      broadcastDataUpdate(['/api/exit-requests', '/api/members']);
      return res.status(201).json({ message: "Exit request submitted successfully. Awaiting treasurer approval.", exitRequest });
    } catch (error: any) {
      console.error("Error submitting member exit request:", error);
      return res.status(500).json({ message: error.message || "Failed to submit exit request" });
    }
  });

  // List all exit requests (Treasurer/Admin only)
  app.get('/api/exit-requests', isAuthenticated, requirePermission('read', 'exit-requests'), async (req: any, res) => {
    try {
      const { status } = req.query;
      let query = db.select({
        id: memberExitRequests.id,
        memberId: memberExitRequests.memberId,
        requestedBy: memberExitRequests.requestedBy,
        requestedAt: memberExitRequests.requestedAt,
        reason: memberExitRequests.reason,
        status: memberExitRequests.status,
        exitFee: memberExitRequests.exitFee,
        savingsUsedForLoanRepayment: memberExitRequests.savingsUsedForLoanRepayment,
        loanAmountRepaid: memberExitRequests.loanAmountRepaid,
        approvedBy: memberExitRequests.approvedBy,
        approvedAt: memberExitRequests.approvedAt,
        rejectedBy: memberExitRequests.rejectedBy,
        rejectedAt: memberExitRequests.rejectedAt,
        rejectionReason: memberExitRequests.rejectionReason,
        treasurerComments: memberExitRequests.treasurerComments,
        createdAt: memberExitRequests.createdAt,
      }).from(memberExitRequests);

      const allRequests = await query.orderBy(memberExitRequests.createdAt);
      const filtered = status ? allRequests.filter(r => r.status === status) : allRequests;

      // Enrich with member data
      const enriched = await Promise.all(filtered.map(async (r) => {
        const member = await storage.getMember(r.memberId);
        const memberSavings = await storage.getSavingsAccountsByMember(r.memberId);
        const actualSavings = memberSavings.reduce((sum: number, s: any) => sum + parseFloat(s.balance || '0'), 0);
        const requestedByUser = await storage.getUser(r.requestedBy);
        return {
          ...r,
          member: member ? { id: member.id, uuid: member.uuid, fullName: member.fullName, memberNumber: member.memberNumber, totalSavings: actualSavings.toFixed(2), shareCapital: member.shareCapital } : null,
          requestedByUser: requestedByUser ? { id: requestedByUser.id, firstName: requestedByUser.firstName, lastName: requestedByUser.lastName, username: requestedByUser.username } : null,
        };
      }));

      return res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching exit requests:", error);
      return res.status(500).json({ message: error.message || "Failed to fetch exit requests" });
    }
  });

  // Treasurer approves an exit request - processes the actual exit
  app.post('/api/exit-requests/:id/approve', isAuthenticated, requirePermission('approve', 'exit-requests'), async (req: any, res) => {
    try {
      const requestId = parseInt(getRouteParam(req.params.id));
      const { comments } = req.body;
      const userId = getUserId(req)!;

      const [exitRequest] = await db.select().from(memberExitRequests).where(eq(memberExitRequests.id, requestId));
      if (!exitRequest) return res.status(404).json({ message: "Exit request not found" });
      if (exitRequest.status !== 'pending_treasurer') return res.status(400).json({ message: `Cannot approve a request with status: ${exitRequest.status}` });

      const member = await storage.getMember(exitRequest.memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });

      // Re-evaluate eligibility at approval time to ensure current data is used
      const currentEligibility = await getExitEligibilityDetails(exitRequest.memberId);
      // Guarantor obligations remain a hard blocker
      const guarantorBlockers = currentEligibility.blockers.filter(b => b.includes('guarantor'));
      if (guarantorBlockers.length > 0) {
        return res.status(400).json({ message: `Cannot approve: ${guarantorBlockers[0]}` });
      }

      const savingsAccounts = await storage.getSavingsAccountsByMember(exitRequest.memberId);
      const primaryAccount = savingsAccounts[0];

      // If member has active loans, re-compute current outstanding and verify savings sufficiency
      const activeLoans = await storage.getMemberActiveLoans(exitRequest.memberId);
      const runningLoans = activeLoans.filter((l: any) =>
        ['active', 'disbursed', 'approved', 'manager_approved', 'committee_approved'].includes(l.status)
      );

      let actualLoanRepayment = 0;
      const exitFeeSetting = await storage.getSystemSetting('memberExitFee');
      const exitFee = exitFeeSetting ? parseFloat(exitFeeSetting.settingValue) : 0;
      await storage.runSaccoLedgerTransaction(async (tx) => {
      if (runningLoans.length > 0) {
        actualLoanRepayment = runningLoans.reduce((sum: number, l: any) => sum + parseFloat(l.outstandingBalance || '0'), 0);
        const currentSavings = savingsAccounts.reduce((sum: number, s: any) => sum + parseFloat(s.balance || '0'), 0);
        if (currentSavings < actualLoanRepayment) {
          throw new Error(`Cannot approve: member savings (UGX ${currentSavings.toLocaleString()}) are insufficient to cover outstanding loans (UGX ${actualLoanRepayment.toLocaleString()})`);
        }

        if (primaryAccount && actualLoanRepayment > 0) {
          const repayRefNumber = `EXIT-LOAN-REPAY-${Date.now()}`;
          await tx.insert(transactions).values({
            memberId: exitRequest.memberId,
            savingsAccountId: primaryAccount.id,
            transactionType: 'withdrawal',
            amount: actualLoanRepayment.toString(),
            description: `Savings used to repay outstanding loan balance on member exit (Request #${requestId})`,
            referenceNumber: repayRefNumber,
            status: 'completed',
            processedBy: userId,
          });
          await tx.update(savingsAccountsTable).set({ balance: sql`${savingsAccountsTable.balance} - ${actualLoanRepayment.toString()}`, updatedAt: new Date() }).where(eq(savingsAccountsTable.id, primaryAccount.id));

          for (const loan of runningLoans) {
            const outstanding = parseFloat(loan.outstandingBalance || '0');
            const split = await splitLoanRepayment(loan, outstanding, outstanding);
            await tx.update(loans).set({ status: 'completed', outstandingBalance: '0', updatedAt: new Date() }).where(eq(loans.id, loan.id));
            await postLoanRepaymentJournals(loan, split.interestPortion, split.principalPortion, 'Loan settlement on member exit', repayRefNumber, userId, tx, false);
          }
        }
      }

      // Record and deduct exit fee from savings
      if (exitFee > 0 && primaryAccount) {
        const feeRefNumber = `EXIT-FEE-${Date.now()}`;
        await tx.insert(transactions).values({
          memberId: exitRequest.memberId,
          savingsAccountId: primaryAccount.id,
          transactionType: 'fee_charge',
          amount: exitFee.toString(),
          description: `Member exit fee charged on account closure`,
          referenceNumber: feeRefNumber,
          status: 'completed',
          processedBy: userId,
        });
        await tx.update(savingsAccountsTable).set({ balance: sql`${savingsAccountsTable.balance} - ${exitFee.toString()}`, updatedAt: new Date() }).where(eq(savingsAccountsTable.id, primaryAccount.id));
        await recordJournalEntry('loan_processing_fee', exitFee, 'Member exit fee', feeRefNumber, userId, tx, false);
      }

      // Mark exit request as approved
      await tx.update(memberExitRequests).set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        treasurerComments: comments || null,
        loanAmountRepaid: actualLoanRepayment > 0 ? actualLoanRepayment.toString() : null,
        savingsUsedForLoanRepayment: actualLoanRepayment > 0,
        exitFee: exitFee.toString(),
        updatedAt: new Date(),
      }).where(eq(memberExitRequests.id, requestId));

      // Update member status to exited
      await tx.update(members).set({
        status: 'exited' as any,
        exitedAt: new Date(),
        exitReason: exitRequest.reason || null,
        exitFeeCharged: exitFee > 0 ? exitFee.toString() : null,
        updatedAt: new Date(),
      } as any).where(eq(members.id, exitRequest.memberId));

      // Close all savings accounts for the exited member
      for (const account of savingsAccounts) {
        await tx.update(savingsAccountsTable).set({
          status: 'closed',
          updatedAt: new Date(),
        }).where(eq(savingsAccountsTable.id, account.id));
      }
      await storage.recalculateSaccoAccountBalancesInTransaction(tx);
      });

      await storage.createAuditLog({
        userId,
        memberId: exitRequest.memberId,
        action: 'approve',
        resource: 'member-exit-request',
        resourceId: requestId.toString(),
        details: `Treasurer approved exit for member ${member.memberNumber}. ${actualLoanRepayment > 0 ? `Savings used to repay UGX ${actualLoanRepayment.toLocaleString()} in loans.` : ''} Exit fee: UGX ${exitFee}.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      await sendNotificationEmail(
        storage,
        member.email,
        'Exit Request Approved',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${member.fullName},</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Your exit request has been approved and your Biashara SACCO membership account has been closed.</p>
         ${actualLoanRepayment > 0 ? `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">An outstanding loan balance of <strong>UGX ${actualLoanRepayment.toLocaleString()}</strong> was repaid from your savings.</p>` : ''}
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Exit fee charged: <strong>UGX ${exitFee.toLocaleString()}</strong>.</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">Thank you for being part of Biashara SACCO.</p>`
      );

      broadcastDataUpdate(['/api/exit-requests', '/api/members', '/api/dashboard', '/api/savings', '/api/transactions']);
      return res.json({ message: "Exit request approved. Member account has been closed.", exitRequest });
    } catch (error: any) {
      console.error("Error approving exit request:", error);
      return res.status(500).json({ message: error.message || "Failed to approve exit request" });
    }
  });

  // Treasurer rejects an exit request
  app.post('/api/exit-requests/:id/reject', isAuthenticated, requirePermission('approve', 'exit-requests'), async (req: any, res) => {
    try {
      const requestId = parseInt(getRouteParam(req.params.id));
      const { reason } = req.body;
      const userId = getUserId(req)!;

      const [exitRequest] = await db.select().from(memberExitRequests).where(eq(memberExitRequests.id, requestId));
      if (!exitRequest) return res.status(404).json({ message: "Exit request not found" });
      if (exitRequest.status !== 'pending_treasurer') return res.status(400).json({ message: `Cannot reject a request with status: ${exitRequest.status}` });

      await db.update(memberExitRequests).set({
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason || null,
        updatedAt: new Date(),
      }).where(eq(memberExitRequests.id, requestId));

      const member = await storage.getMember(exitRequest.memberId);
      await storage.createAuditLog({
        userId,
        memberId: exitRequest.memberId,
        action: 'reject',
        resource: 'member-exit-request',
        resourceId: requestId.toString(),
        details: `Treasurer rejected exit request for member ${member?.memberNumber}. Reason: ${reason || 'Not specified'}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      broadcastDataUpdate(['/api/exit-requests', '/api/members']);
      return res.json({ message: "Exit request rejected." });
    } catch (error: any) {
      console.error("Error rejecting exit request:", error);
      return res.status(500).json({ message: error.message || "Failed to reject exit request" });
    }
  });

  // Savings account routes
  app.get('/api/members/:id/savings', isAuthenticated, async (req, res) => {
    try {
      const accounts = await storage.getSavingsAccountsByMember(await storage.resolveMemberId(getRouteParam(req.params.id)));
      return res.json(accounts);
    } catch (error) {
      console.error("Error fetching savings accounts:", error);
      return res.status(500).json({ message: "Failed to fetch savings accounts" });
    }
  });

  app.post('/api/savings/deposit', isAuthenticated, requirePermission('record', 'deposits'), async (req, res) => {
    try {
      const { accountId, amount, description } = req.body;
      
      const account = await storage.getSavingsAccount(accountId);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      const referenceNumber = `DEP${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      const memberBeforeUpdate = await storage.getMember(account.memberId);
      const updateFields: any = {
        lastSavingsDate: new Date(),
        lastActivityDate: new Date(),
        isActiveSaver: true,
      };
      if (memberBeforeUpdate && ['inactive', 'dormant'].includes(memberBeforeUpdate.status ?? '')) {
        updateFields.status = 'active';
      }
      const transaction = await storage.runSaccoLedgerTransaction(async (tx) => {
        await tx.update(savingsAccountsTable).set({
          balance: sql`${savingsAccountsTable.balance}::numeric + ${amount}::numeric`,
          updatedAt: new Date(),
        }).where(eq(savingsAccountsTable.id, accountId));
        const [createdTransaction] = await tx.insert(transactions).values({
          memberId: account.memberId,
          savingsAccountId: accountId,
          transactionType: 'deposit',
          amount,
          referenceNumber,
          description: description || 'Savings deposit',
          status: 'completed',
          processedBy: getUserId(req),
        }).returning();
        await recordJournalEntry('member_deposit', amount, `Savings deposit - ${account.accountNumber}`, referenceNumber, getUserId(req)!, tx);
        await tx.update(members).set({
          ...updateFields,
          totalSavings: sql`(SELECT COALESCE(SUM(balance::numeric), 0) FROM savings_accounts WHERE member_id = ${account.memberId})`,
        }).where(eq(members.id, account.memberId));
        return createdTransaction;
      });

      const member = memberBeforeUpdate;
      if (member?.userId) {
        await createAndBroadcastNotification({
          type: 'transaction_completed',
          title: 'Deposit Received',
          message: `A deposit of UGX ${parseFloat(amount).toLocaleString()} has been made to your savings account.`,
          priority: 'medium',
          actionUrl: '/savings',
          memberId: account.memberId,
          userId: member.userId,
          isRead: false
        });
      }

      await sendNotificationEmail(
        storage,
        member?.email,
        'Deposit Received',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${member?.fullName || 'Member'},</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">A deposit of <strong>UGX ${parseFloat(amount).toLocaleString()}</strong> has been recorded to your savings account <strong>${account.accountNumber}</strong>.</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">Reference: ${referenceNumber}. Log in to view your updated balance.</p>`
      );

      broadcastDataUpdate(['/api/savings', '/api/transactions', '/api/dashboard', '/api/sacco-accounts', '/api/sacco-journal-entries']);
      return res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing deposit:", error);
      return res.status(500).json({ message: "Failed to process deposit" });
    }
  });

  app.post('/api/savings/withdraw', isAuthenticated, requirePermission('request', 'withdrawals'), async (req: any, res) => {
    try {
      const { accountId, amount, description } = req.body;

      const withdrawalAccount = await storage.getSavingsAccount(accountId);
      if (!withdrawalAccount) {
        return res.status(404).json({ message: "Savings account not found" });
      }

      const userId = getUserId(req)!;
      const userRecord = await storage.getUser(userId);
      const isStaff = userRecord && ['admin', 'treasurer'].includes(userRecord.role ?? '');

      if (!isStaff) {
        const member = await storage.getMemberByUserId(userId);
        if (!member || withdrawalAccount.memberId !== member.id) {
          return res.status(403).json({ message: "You can only request withdrawals from your own accounts" });
        }
      }
      
      const referenceNumber = `WDR${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      const transaction = await storage.createTransaction({
        memberId: withdrawalAccount.memberId,
        savingsAccountId: accountId,
        transactionType: 'withdrawal',
        amount,
        referenceNumber,
        description: description || 'Savings withdrawal',
        status: 'pending', // Requires approval
        processedBy: getUserId(req),
      });

      const withdrawMember = await storage.getMember(withdrawalAccount.memberId);
      if (withdrawMember?.userId) {
        await createAndBroadcastNotification({
          type: 'transaction_completed',
          title: 'Withdrawal Request Submitted',
          message: `Your withdrawal request of UGX ${parseFloat(amount).toLocaleString()} has been submitted and is pending approval.`,
          priority: 'medium',
          actionUrl: '/savings',
          memberId: withdrawalAccount.memberId,
          userId: withdrawMember.userId,
          isRead: false
        });
      }

      await sendNotificationEmail(
        storage,
        withdrawMember?.email,
        'Withdrawal Request Submitted',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${withdrawMember?.fullName || 'Member'},</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Your withdrawal request of <strong>UGX ${parseFloat(amount).toLocaleString()}</strong> from account <strong>${withdrawalAccount.accountNumber}</strong> has been submitted and is pending approval.</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">Reference: ${referenceNumber}. We will notify you once it has been processed.</p>`
      );

      broadcastDataUpdate(['/api/savings', '/api/transactions', '/api/dashboard']);
      return res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      return res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Loan eligibility check endpoint  
  app.post('/api/loans/check-eligibility', isAuthenticated, memberLoanAccess(req => req.body?.memberId), async (req: any, res) => {
    try {
      const { memberId, requestedAmount, loanType } = req.body;
      
      if (!memberId || !requestedAmount) {
        return res.status(400).json({ message: "Member ID and requested amount are required" });
      }
      
      const eligibilityResult = await businessRulesValidator.checkLoanEligibility(memberId, requestedAmount, loanType);
      return res.json(eligibilityResult);
    } catch (error) {
      console.error("Error checking loan eligibility:", error);
      return res.status(500).json({ message: "Failed to check loan eligibility" });
    }
  });

  // Loan routes
  app.post('/api/loans', isAuthenticated, memberLoanAccess(req => req.body?.memberId), async (req: any, res) => {
    try {
      const { memberId, loanType, principalAmount, interestRate, termMonths, purpose } = req.body;
      
      // Validate that the member is approved for loan applications
      const applicantMember = await storage.getMember(memberId);
      if (!applicantMember) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      if (applicantMember.status !== 'active') {
        return res.status(403).json({ 
          message: "Loan applications are only available to approved members", 
          memberStatus: applicantMember.status 
        });
      }

      // Apply business rules validation
      const eligibilityResult = await businessRulesValidator.checkLoanEligibility(
        memberId, 
        parseFloat(principalAmount),
        loanType
      );
      
      if (!eligibilityResult.isEligible) {
        return res.status(400).json({ 
          message: "Loan application does not meet eligibility requirements",
          violations: eligibilityResult.violations,
          warnings: eligibilityResult.warnings
        });
      }

      // Validate loan period (24 months max)
      const periodValidation = businessRulesValidator.validateLoanPeriod(termMonths);
      if (!periodValidation.isValid) {
        return res.status(400).json({ message: periodValidation.message });
      }
      
      // Check if member has any pending loans
      const existingPendingLoans = await storage.getMemberPendingLoans(memberId);
      if (existingPendingLoans && existingPendingLoans.length > 0) {
        return res.status(400).json({ 
          message: "Cannot apply for a new loan while you have a loan application pending approval", 
          pendingLoans: existingPendingLoans.length,
          pendingLoanNumbers: existingPendingLoans.map(loan => loan.loanNumber)
        });
      }
      
      // Convert percentage to decimal for storage (15% -> 0.15)
      const decimalInterestRate = parseFloat(interestRate) / 100;
      
      // Look up loan type configuration for interest calculation method
      const activeLoanTypes = await storage.getActiveLoanTypes();
      const loanTypeConfig = activeLoanTypes.find(lt => lt.name === loanType);
      if (!loanTypeConfig) {
        return res.status(400).json({ message: "Active loan product configuration not found" });
      }
      const interestMethod = loanTypeConfig?.interestType || 'reducing_balance';
      const principal = parseFloat(principalAmount);
      const timeInYears = termMonths / 12;
      
      let monthlyPayment: number;
      switch (interestMethod) {
        case 'simple': {
          const totalInterest = principal * decimalInterestRate * timeInYears;
          monthlyPayment = (principal + totalInterest) / termMonths;
          break;
        }
        case 'compound': {
          const compFreq = loanTypeConfig?.compoundingFrequency || 'monthly';
          let n = 12;
          if (compFreq === 'quarterly') n = 4;
          if (compFreq === 'annually') n = 1;
          const compoundAmount = principal * Math.pow(1 + decimalInterestRate / n, n * timeInYears);
          monthlyPayment = compoundAmount / termMonths;
          break;
        }
        case 'reducing_balance':
        default: {
          const monthlyInterestRate = decimalInterestRate / 12;
          monthlyPayment = (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termMonths)) / 
            (Math.pow(1 + monthlyInterestRate, termMonths) - 1);
          break;
        }
      }

      // Generate unique loan number
      const loanNumber = `LN${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const totalRepayable = calculateContractualLoanAmounts({
        principal,
        annualRatePercentage: parseFloat(interestRate),
        termMonths,
        interestMethod: interestMethod as LoanInterestMethod,
        compoundingFrequency: loanTypeConfig?.compoundingFrequency || 'monthly',
        monthlyPayment,
      }).totalRepayable;
      const initialOutstandingBalance = totalRepayable.toFixed(2);

      const loan = await storage.createLoan({
        memberId,
        loanNumber,
        loanType,
        principalAmount,
        interestRate: decimalInterestRate.toFixed(4),
        termMonths,
        monthlyPayment: monthlyPayment.toFixed(2),
        outstandingBalance: initialOutstandingBalance,
        status: 'pending',
        approvalStage: 'committee',
        purpose: purpose || null,
      });

      // Create notification for loan application
      const loanMember = await storage.getMember(memberId);
      if (loanMember) {
        await createAndBroadcastNotification({
          type: 'loan_application',
          title: 'New Loan Application Submitted',
          message: `Loan application ${loanNumber} for UGX ${Number(principalAmount).toLocaleString()} has been submitted and is pending approval.`,
          priority: 'medium',
          actionUrl: `/loans/${loan.uuid}`,
          memberId: memberId,
          userId: loanMember.userId,
          isRead: false
        });

        // Notify staff about new loan application
        const allMembers = await storage.getAllMembers();
        const staffMembers = allMembers.filter(m => m.id !== memberId); // Exclude the applicant
        for (const staffMember of staffMembers) {
          // Only notify members who have staff roles
          const roles = await storage.getMemberRoles(staffMember.id);
          const hasStaffRole = roles.some(role => ['admin', 'manager', 'committee', 'treasurer'].includes(role));
          
          if (hasStaffRole) {
            await createAndBroadcastNotification({
              type: 'loan_application',
              title: 'New Loan Application for Review',
              message: `${loanMember.fullName} has submitted a loan application for UGX ${Number(principalAmount).toLocaleString()}.`,
              priority: 'medium',
              actionUrl: `/loans`,
              memberId: staffMember.id,
              userId: staffMember.userId,
              isRead: false
            });
          }
        }
      }

      await sendNotificationEmail(
        storage,
        applicantMember.email,
        'Loan Application Received',
        `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${applicantMember.fullName},</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Your loan application <strong>${loanNumber}</strong> for <strong>UGX ${Number(principalAmount).toLocaleString()}</strong> (${loanType}, ${termMonths} months) has been received and is pending approval.</p>
         <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">We will notify you by email as your application moves through the approval stages.</p>`
      );

      broadcastDataUpdate(['/api/loans', '/api/loans/approval', '/api/dashboard', '/api/loans/my-loans']);
      return res.status(201).json(loan);
    } catch (error) {
      console.error("Error creating loan:", error);
      return res.status(500).json({ message: "Failed to create loan" });
    }
  });

  app.get('/api/loans/active-for-topup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Member record not found" });
      }
      const activeLoans = await storage.getMemberActiveLoans(member.id);
      return res.json(activeLoans);
    } catch (error) {
      console.error("Error fetching active loans for topup:", error);
      return res.status(500).json({ message: "Failed to fetch active loans" });
    }
  });

  app.post('/api/loans/topup', isAuthenticated, async (req: any, res) => {
    try {
      const { originalLoanId, topUpAmount, loanType, interestRate, termMonths, purpose } = req.body;
      const userId = getUserId(req)!;
      const member = await storage.getMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Member record not found" });
      }

      if (member.status !== 'active') {
        return res.status(403).json({ 
          message: "Loan top-ups are only available to approved members",
          memberStatus: member.status
        });
      }

      const originalLoan = await storage.getLoan(originalLoanId);
      if (!originalLoan) {
        return res.status(404).json({ message: "Original loan not found" });
      }

      if (!['approved', 'active', 'disbursed'].includes(originalLoan.status || '')) {
        return res.status(400).json({ message: "Only active/disbursed loans can be topped up" });
      }

      if (originalLoan.memberId !== member.id) {
        return res.status(403).json({ message: "You can only top up your own loans" });
      }

      const existingPendingLoans = await storage.getMemberPendingLoans(member.id);
      if (existingPendingLoans && existingPendingLoans.length > 0) {
        return res.status(400).json({
          message: "Cannot request a top-up while you have a loan application pending approval",
          pendingLoans: existingPendingLoans.length,
          pendingLoanNumbers: existingPendingLoans.map(loan => loan.loanNumber)
        });
      }

      const allLoanTypes = await storage.getAllLoanTypes();
      const matchingLoanType = allLoanTypes.find(lt => lt.name === originalLoan.loanType);
      const minRepayments = matchingLoanType?.minRepaymentsForTopUp ?? 3;

      if (minRepayments > 0) {
        const loanTransactions = await storage.getTransactionsByLoan(originalLoanId);
        const repaymentCount = loanTransactions.filter(t => t.transactionType === 'loan_payment' && t.status === 'completed').length;
        
        if (repaymentCount < minRepayments) {
          return res.status(400).json({
            message: `You must make at least ${minRepayments} repayment(s) on this loan before requesting a top-up. You have made ${repaymentCount} repayment(s) so far.`,
            requiredRepayments: minRepayments,
            currentRepayments: repaymentCount
          });
        }
      }

      const outstandingBalance = parseFloat(originalLoan.outstandingBalance || '0');
      const originalPrincipal = parseFloat(originalLoan.principalAmount || '0');
      const originalMonthlyPayment = parseFloat(originalLoan.monthlyPayment || '0');
      const originalTermMonths = parseInt(String(originalLoan.termMonths || '0'));
      const originalTotalRepayable = originalMonthlyPayment * originalTermMonths;
      const topUpActiveLoanTypes = await storage.getActiveLoanTypes();
      const origLoanTypeConfig = topUpActiveLoanTypes.find(lt => lt.name === originalLoan.loanType);
      const origInterestMethod = origLoanTypeConfig?.interestType || 'reducing_balance';
      const isOrigFixedInterest = origInterestMethod === 'simple' || origInterestMethod === 'compound';
      const remainingPrincipal = isOrigFixedInterest && originalTotalRepayable > 0
        ? outstandingBalance * (originalPrincipal / originalTotalRepayable)
        : outstandingBalance;
      const additionalAmount = parseFloat(topUpAmount);
      const totalNewPrincipal = remainingPrincipal + additionalAmount;

      if (additionalAmount <= 0) {
        return res.status(400).json({ message: "Top-up amount must be greater than zero" });
      }

      // Check savings-based eligibility for total new principal
      let loanToSavingsRatio = 2.5;
      try {
        const ratioSetting = await storage.getSystemSetting('loanToSavingsRatio');
        if (ratioSetting?.settingValue) {
          const parsed = parseFloat(ratioSetting.settingValue);
          if (!isNaN(parsed) && parsed > 0) {
            loanToSavingsRatio = parsed;
          }
        }
      } catch {}

      const savingsAccounts = await storage.getSavingsAccountsByMember(member.id);
      const activeSavingsAccount = savingsAccounts.find(acc => acc.status === 'active');
      if (activeSavingsAccount) {
      const totalSavings = parseFloat(activeSavingsAccount.balance ?? '0');
        const maxByRatio = totalSavings * loanToSavingsRatio;
        if (totalNewPrincipal > maxByRatio) {
          return res.status(400).json({
            message: `Total loan amount (UGX ${Math.round(totalNewPrincipal).toLocaleString()}) exceeds your maximum borrowing limit of UGX ${Math.round(maxByRatio).toLocaleString()} (${loanToSavingsRatio}x your savings of UGX ${Math.round(totalSavings).toLocaleString()}).`
          });
        }
      }

      if (matchingLoanType) {
        const minAmount = parseFloat(matchingLoanType.minAmount || '0');
        const maxAmount = parseFloat(matchingLoanType.maxAmount || '0');
        const minTerm = matchingLoanType.minTerm || 1;
        const maxTerm = matchingLoanType.maxTerm || 60;

        if (minAmount > 0 && totalNewPrincipal < minAmount) {
          return res.status(400).json({
            message: `Total loan amount (${totalNewPrincipal.toLocaleString()}) is below the minimum of ${minAmount.toLocaleString()} for this loan type`
          });
        }

        if (maxAmount > 0) {
          const maxTopUpAllowed = maxAmount - remainingPrincipal;
          if (additionalAmount > maxTopUpAllowed) {
            return res.status(400).json({
              message: `Top-up amount (${additionalAmount.toLocaleString()}) exceeds the maximum allowed of ${Math.max(0, maxTopUpAllowed).toLocaleString()} (loan limit ${maxAmount.toLocaleString()} minus remaining principal ${Math.round(remainingPrincipal).toLocaleString()})`
            });
          }
        }

        if (termMonths < minTerm) {
          return res.status(400).json({
            message: `Repayment period (${termMonths} months) is below the minimum of ${minTerm} months for this loan type`
          });
        }

        if (termMonths > maxTerm) {
          return res.status(400).json({
            message: `Repayment period (${termMonths} months) exceeds the maximum of ${maxTerm} months for this loan type`
          });
        }
      }

      const eligibilityResult = await businessRulesValidator.checkLoanEligibility(
        member.id,
        totalNewPrincipal
      );

      if (!eligibilityResult.isEligible) {
        return res.status(400).json({
          message: "Top-up loan does not meet eligibility requirements",
          violations: eligibilityResult.violations,
          warnings: eligibilityResult.warnings
        });
      }

      const periodValidation = businessRulesValidator.validateLoanPeriod(termMonths);
      if (!periodValidation.isValid) {
        return res.status(400).json({ message: periodValidation.message });
      }

      const resolvedInterestRate = matchingLoanType ? matchingLoanType.interestRate : interestRate;
      const decimalInterestRate = parseFloat(resolvedInterestRate) / 100;
      const topUpLoanTypeConfig = topUpActiveLoanTypes.find(lt => lt.name === loanType);
      const topUpInterestMethod = topUpLoanTypeConfig?.interestType || 'reducing_balance';
      const topUpTimeInYears = termMonths / 12;
      
      let monthlyPayment: number;
      switch (topUpInterestMethod) {
        case 'simple': {
          const totalInterest = totalNewPrincipal * decimalInterestRate * topUpTimeInYears;
          monthlyPayment = (totalNewPrincipal + totalInterest) / termMonths;
          break;
        }
        case 'compound': {
          const compFreq = topUpLoanTypeConfig?.compoundingFrequency || 'monthly';
          let n = 12;
          if (compFreq === 'quarterly') n = 4;
          if (compFreq === 'annually') n = 1;
          const compoundAmount = totalNewPrincipal * Math.pow(1 + decimalInterestRate / n, n * topUpTimeInYears);
          monthlyPayment = compoundAmount / termMonths;
          break;
        }
        case 'reducing_balance':
        default: {
          const monthlyInterestRate = decimalInterestRate / 12;
          monthlyPayment = (totalNewPrincipal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termMonths)) /
            (Math.pow(1 + monthlyInterestRate, termMonths) - 1);
          break;
        }
      }

      const loanNumber = `LN${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const topUpTotalRepayable = calculateContractualLoanAmounts({
        principal: totalNewPrincipal,
        annualRatePercentage: parseFloat(resolvedInterestRate),
        termMonths,
        interestMethod: topUpInterestMethod as LoanInterestMethod,
        compoundingFrequency: topUpLoanTypeConfig?.compoundingFrequency || 'monthly',
        monthlyPayment,
      }).totalRepayable;
      const topUpInitialOutstanding = topUpTotalRepayable.toFixed(2);

      const topUpLoan = await storage.createLoan({
        memberId: member.id,
        loanNumber,
        loanType: loanType || originalLoan.loanType,
        principalAmount: totalNewPrincipal.toFixed(2),
        interestRate: decimalInterestRate.toFixed(4),
        termMonths,
        monthlyPayment: monthlyPayment.toFixed(2),
        outstandingBalance: topUpInitialOutstanding,
        status: 'pending',
        approvalStage: 'committee',
        isTopUp: true,
        topUpOfLoanId: originalLoanId,
        previousLoanBalance: outstandingBalance.toFixed(2),
        purpose: purpose || `Top-up on loan ${originalLoan.loanNumber}`,
      });

      const loanMember = await storage.getMember(member.id);
      if (loanMember) {
        await createAndBroadcastNotification({
          type: 'loan_application',
          title: 'Loan Top-Up Application Submitted',
          message: `Top-up application ${loanNumber} for UGX ${totalNewPrincipal.toLocaleString()} (additional UGX ${additionalAmount.toLocaleString()}) on loan ${originalLoan.loanNumber} has been submitted.`,
          priority: 'medium',
          actionUrl: `/loans/${topUpLoan.uuid}`,
          memberId: member.id,
          userId: member.userId,
          isRead: false
        });

        const allMembers = await storage.getAllMembers();
        for (const staffMember of allMembers) {
          if (staffMember.id === member.id) continue;
          const roles = await storage.getMemberRoles(staffMember.id);
          const hasStaffRole = roles.some(role => ['admin', 'manager', 'committee', 'treasurer'].includes(role));
          if (hasStaffRole) {
            await createAndBroadcastNotification({
              type: 'loan_application',
              title: 'Loan Top-Up Request for Review',
              message: `${loanMember.fullName} has submitted a loan top-up request for UGX ${totalNewPrincipal.toLocaleString()} on loan ${originalLoan.loanNumber}.`,
              priority: 'medium',
              actionUrl: `/loans`,
              memberId: staffMember.id,
              userId: staffMember.userId,
              isRead: false
            });
          }
        }
      }

      return res.status(201).json(topUpLoan);
    } catch (error) {
      console.error("Error creating loan top-up:", error);
      return res.status(500).json({ message: "Failed to create loan top-up" });
    }
  });

  // Get all loans
  app.get('/api/loans', isAuthenticated, filterDataByRole(), async (req: any, res) => {
    try {
      const { search, page, limit, status } = req.query;

      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
        const statusFilter = status && typeof status === 'string' ? status : undefined;
        const userRoles = req.member?.roles || ['member'];
        const isStaff = userRoles.some((role: string) => ['admin', 'committee', 'treasurer'].includes(role));

        if (isStaff) {
          const result = await storage.getLoansPaginated(pageNum, limitNum, search as string, undefined, statusFilter);
          return res.json(result);
        } else {
          const userId = getUserId(req);
          const member = userId ? await storage.getMemberByUserId(userId) : null;
          if (member) {
            const result = await storage.getLoansPaginated(pageNum, limitNum, search as string, member.id, statusFilter);
            return res.json(result);
          }
          return res.json({ data: [], total: 0 });
        }
      }

      const allLoans = await storage.getAllLoans();
      const filteredLoans = filterLoansByRole(allLoans, req.member?.roles || ['member'], req.member?.userId || '');
      return res.json(filteredLoans);
    } catch (error) {
      console.error("Error fetching loans:", error);
      return res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  app.get('/api/loans/stats', isAuthenticated, filterDataByRole(), async (req: any, res) => {
    try {
      const userRoles = req.member?.roles || ['member'];
      const isStaff = userRoles.some((role: string) => ['admin', 'committee', 'treasurer'].includes(role));
      const scope = req.query.scope as string;

      let memberId: number | undefined;
      if (!isStaff || scope === 'personal') {
        memberId = req.member?.id;
        if (!memberId) {
          return res.json({ activeCount: 0, totalOutstanding: 0, defaultedCount: 0, totalCount: 0 });
        }
      }

      const stats = await storage.getLoanStats(memberId);
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching loan stats:", error);
      return res.status(500).json({ message: "Failed to fetch loan stats" });
    }
  });

  app.get('/api/loans/pending', isAuthenticated, filterDataByRole(), async (req: any, res) => {
    try {
      const allLoans = await storage.getAllPendingLoans();
      // Filter loans based on user role
      const filteredLoans = filterLoansByRole(allLoans, req.member?.roles || ['member'], req.member?.userId || '');
      return res.json(filteredLoans);
    } catch (error) {
      console.error("Error fetching pending loans:", error);
      return res.status(500).json({ message: "Failed to fetch pending loans" });
    }
  });

  app.post('/api/loans/:id/recall', isAuthenticated, async (req: any, res) => {
    try {
      const loanId = await storage.resolveLoanId(getRouteParam(req.params.id));
      const loan = await storage.getLoan(loanId);
      if (!loan) return res.status(404).json({ message: "Loan not found" });

      if (loan.status !== 'pending') {
        return res.status(400).json({ message: "Only pending loans can be recalled. This loan has already moved to the next stage." });
      }

      const userId = getUserId(req)!;
      const user = await storage.getUser(userId);
      const member = await storage.getMemberByUserId(userId);
      const memberRoles = member ? await storage.getMemberRoles(member.id) : (user?.role ? [user.role] : []);
      const isStaff = memberRoles.some((r: string) => ['admin', 'treasurer'].includes(r));
      const isApplicant = member && loan.memberId === member.id;

      if (!isStaff && !isApplicant) {
        return res.status(403).json({ message: "You can only recall your own loan applications" });
      }

      const { reason } = req.body;

      await storage.updateLoanStatus(loanId, 'recalled');

      await storage.createAuditLog({
        userId,
        memberId: loan.memberId || undefined,
        action: 'recall',
        resource: 'loan',
        resourceId: loanId.toString(),
        details: `Loan ${loan.loanNumber} recalled${isApplicant ? ' by applicant' : ' by staff'}. Reason: ${reason || 'Not specified'}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      if (loan.memberId) {
        const loanMember = await storage.getMember(loan.memberId);
        if (loanMember?.userId && loanMember.userId !== userId) {
          await createAndBroadcastNotification({
            type: 'loan_update',
            title: 'Loan Application Recalled',
            message: `Loan application ${loan.loanNumber} for UGX ${parseFloat(loan.principalAmount || '0').toLocaleString()} has been recalled. Reason: ${reason || 'Not specified'}`,
            priority: 'medium',
            actionUrl: '/loans',
            memberId: loan.memberId,
            userId: loanMember.userId,
            isRead: false,
          });
        }
      }

      broadcastDataUpdate(['/api/loans', '/api/loans/pending', '/api/loans/my-loans', '/api/dashboard', '/api/dashboard/pending-approvals']);
      return res.json({ message: "Loan application recalled successfully.", loan });
    } catch (error: any) {
      console.error("Error recalling loan:", error);
      return res.status(500).json({ message: error.message || "Failed to recall loan" });
    }
  });

  app.get('/api/loans/member/:id', isAuthenticated, memberLoanAccess(req => req.params.id), async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.id));
      const loans = await storage.getLoansByMember(memberId);
      return res.json(loans);
    } catch (error) {
      console.error("Error fetching member loans:", error);
      return res.status(500).json({ message: "Failed to fetch member loans" });
    }
  });

  // Personal loans endpoint - must be before :id route
  app.get('/api/loans/my-loans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.json([]);
      }

      const { search, page, limit, status } = req.query;
      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
        const statusFilter = status && typeof status === 'string' ? status : undefined;
        const result = await storage.getLoansPaginated(pageNum, limitNum, search as string, member.id, statusFilter);
        return res.json(result);
      }

      const loans = await storage.getLoansByMember(member.id);
      return res.json(loans);
    } catch (error) {
      console.error("Error fetching personal loans:", error);
      return res.status(500).json({ message: "Failed to fetch personal loans" });
    }
  });

  app.get('/api/loans/my-approval-activity', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const approvals = await storage.getLoanApprovalsByUser(userId);
      const rejections = await storage.getLoansRejectedByUser(userId);

      let pendingReviewLoans: any[] = [];
      try {
        const isCommittee = await hasApprovalRole(userId, 'committee');
        const isTreasurer = await hasApprovalRole(userId, 'treasurer');
        if (isCommittee) {
          const committeePending = await storage.getLoansForApproval('committee', 'committee');
          const notYetApproved = committeePending.filter((l: any) =>
            !approvals.some((a: any) => a.loanId === l.id)
          );
          pendingReviewLoans.push(...notYetApproved.map((l: any) => ({ ...l, _stage: 'committee' })));
        }
        if (isTreasurer) {
          const treasurerPending = await storage.getLoansForApproval('treasurer', 'treasurer');
          pendingReviewLoans.push(...treasurerPending.map((l: any) => ({ ...l, _stage: 'treasurer' })));
        }
      } catch (e) {
        console.error('Error counting pending reviews:', e);
      }
      const pendingReviewCount = pendingReviewLoans.length;

      const approvedList = approvals.map((a: any) => ({
        id: a.id,
        loanId: a.loanId || a.loan?.id,
        loanNumber: a.loan?.loanNumber || '-',
        memberName: a.loan?.member?.fullName || '-',
        memberNumber: a.loan?.member?.memberNumber || '-',
        principalAmount: a.loan?.principalAmount || '0',
        stage: a.stage,
        comments: a.comments || '',
        date: a.createdAt,
        action: 'approved',
      }));

      const rejectedList = rejections.map((l: any) => ({
        id: l.id,
        loanNumber: l.loanNumber || '-',
        memberName: l.member?.fullName || '-',
        memberNumber: l.member?.memberNumber || '-',
        principalAmount: l.principalAmount || '0',
        stage: 'committee',
        comments: l.rejectionReason || '',
        date: l.rejectedAt,
        action: 'rejected',
      }));

      const pendingList = pendingReviewLoans.map((l: any) => ({
        id: l.id,
        loanId: l.id,
        loanNumber: l.loanNumber || '-',
        memberName: l.member?.fullName || '-',
        memberNumber: l.member?.memberNumber || '-',
        principalAmount: l.principalAmount || '0',
        stage: l._stage || l.approvalStage || 'committee',
        comments: '',
        date: l.applicationDate || l.createdAt,
        action: 'pending',
      }));

      return res.json({
        approved: approvedList,
        rejected: rejectedList,
        pending: pendingList,
        summary: {
          totalApproved: approvedList.length,
          totalRejected: rejectedList.length,
          totalReviewed: approvedList.length + rejectedList.length,
          pendingReview: pendingReviewCount,
        }
      });
    } catch (error) {
      console.error("Error fetching approval activity:", error);
      return res.status(500).json({ message: "Failed to fetch approval activity" });
    }
  });

  // Get specific loan by ID
  app.get('/api/loans/:id', isAuthenticated, loanAccess(req => req.params.id), async (req: any, res) => {
    try {
      const loanId = await storage.resolveLoanId(getRouteParam(req.params.id));

      const loan = await storage.getLoan(loanId);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }

      return res.json(loan);
    } catch (error) {
      console.error("Error fetching loan:", error);
      return res.status(500).json({ message: "Failed to fetch loan" });
    }
  });

  // Get loan transactions/statement
  app.get('/api/loans/:id/transactions', isAuthenticated, loanAccess(req => req.params.id), async (req: any, res) => {
    try {
      const loanId = await storage.resolveLoanId(getRouteParam(req.params.id));

      const transactions = await storage.getTransactionsByLoan(loanId);
      return res.json(transactions);
    } catch (error) {
      console.error("Error fetching loan transactions:", error);
      return res.status(500).json({ message: "Failed to fetch loan transactions" });
    }
  });

  // Advanced loan approval endpoints
  app.get('/api/loans/approval/:stage', isAuthenticated, async (req: any, res) => {
    try {
      const stage = getRouteParam(req.params.stage);
      const userId = getUserId(req)!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const member = await storage.getMemberByUserId(userId);
      let userRoles: string[];
      if (member) {
        userRoles = await storage.getMemberRoles(member.id);
        if (userRoles.length === 0) userRoles = [member.role || 'member'];
      } else if (user?.role) {
        userRoles = [user.role];
      } else {
        return res.status(403).json({ message: "No role found" });
      }

      const canViewCommittee = userRoles.includes('committee') || userRoles.includes('treasurer') || userRoles.includes('admin');
      const canViewTreasurer = userRoles.includes('treasurer') || userRoles.includes('admin');

      if (stage === 'committee' && !canViewCommittee) {
        return res.status(403).json({ message: "Committee, treasurer, or admin role required to view committee loans" });
      }
      if (stage === 'treasurer' && !canViewTreasurer) {
        return res.status(403).json({ message: "Treasurer or admin role required to view treasurer loans" });
      }
      
      const loans = await storage.getLoansForApproval(stage, userRoles[0] || 'member');
      return res.json(loans);
    } catch (error) {
      console.error("Error fetching loans for approval:", error);
      return res.status(500).json({ message: "Failed to fetch loans for approval" });
    }
  });

  app.post('/api/loans/:uuid/approve/:stage', isAuthenticated, async (req: any, res) => {
    try {
      const uuid = getRouteParam(req.params.uuid);
      const stage = getRouteParam(req.params.stage);
      const { comments } = req.body;
      const userId = getUserId(req)!;

      if (!await hasApprovalRole(userId, stage)) {
        return res.status(403).json({ message: `Access denied. Only users with the ${stage} role can approve loans at this stage.` });
      }

      const loanByUuid = await storage.getLoanByUuid(uuid);
      if (!loanByUuid) {
        return res.status(404).json({ message: "Loan not found" });
      }

      const guaranteeError = await guaranteeApprovalError(loanByUuid);
      if (guaranteeError) return res.status(400).json({ message: guaranteeError });

      if (stage === 'committee') {
        const guarantorsList = await storage.getGuarantorsByLoan(loanByUuid.id);
        if (guarantorsList.length > 0) {
          const anyRejected = guarantorsList.some(g => g.status === 'rejected');
          if (anyRejected) {
            return res.status(400).json({
              message: "Cannot approve loan - one or more guarantors have rejected the request"
            });
          }
          const allApproved = guarantorsList.every(g => g.status === 'approved');
          if (!allApproved) {
            const pendingCount = guarantorsList.filter(g => g.status === 'pending').length;
            return res.status(400).json({
              message: `Cannot approve loan - ${pendingCount} guarantor(s) must approve before committee approval can begin`,
              pendingGuarantors: pendingCount
            });
          }
        }

        const existingApprovals = await storage.getLoanApprovals(loanByUuid.id, 'committee');
        const alreadyApproved = existingApprovals.find(a => a.approvedBy === userId);
        if (alreadyApproved) {
          return res.status(400).json({ message: "You have already approved this loan." });
        }

        await storage.addLoanApproval(loanByUuid.id, userId, 'committee', comments);

        let minApprovers = 2;
        try {
          const setting = await storage.getSystemSetting('minLoanApprovers');
          if (setting?.settingValue) {
            const parsed = parseInt(setting.settingValue);
            if (!isNaN(parsed) && parsed > 0) minApprovers = parsed;
          }
        } catch {}

        const updatedApprovals = await storage.getLoanApprovals(loanByUuid.id, 'committee');
        const approvalCount = updatedApprovals.length;

        if (approvalCount >= minApprovers) {
          const loan = await storage.approveLoanAtStage(loanByUuid.id, stage, userId, comments);
          
          const member = await storage.getMember(loan.memberId);

          if (member) {
            await createAndBroadcastNotification({
              type: 'loan_approval',
              title: `Loan Approved by Committee`,
              message: `Your loan application ${loan.loanNumber} has been approved by the committee (${approvalCount}/${minApprovers} approvals). It is now pending treasurer disbursement.`,
              priority: 'high',
              actionUrl: `/loans/${loan.uuid}`,
              memberId: loan.memberId,
              userId: member.userId,
              isRead: false
            });

            await sendNotificationEmail(
              storage,
              member.email,
              'Loan Approved by Committee',
              `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${member.fullName},</p>
               <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Good news — your loan application <strong>${loan.loanNumber}</strong> has been approved by the committee.</p>
               <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">It is now pending treasurer disbursement. We will notify you once the funds are disbursed.</p>`
            );
          }

          broadcastDataUpdate(['/api/loans/approval', '/api/loans', '/api/dashboard', '/api/loans/my-loans', '/api/savings', '/api/transactions', '/api/loans/my-approval-activity']);

          return res.json({
            message: `Loan fully approved at committee stage (${approvalCount}/${minApprovers} approvals)`, 
            loan,
            approvalCount,
            minApprovers
          });
        } else {
          broadcastDataUpdate(['/api/loans/approval', '/api/loans', '/api/loans/my-approval-activity']);

          return res.json({
            message: `Your approval has been recorded (${approvalCount}/${minApprovers} approvals needed). Waiting for more committee approvals.`, 
            loan: loanByUuid,
            approvalCount,
            minApprovers
          });
        }
      } else if (stage === 'treasurer') {
        const loanDetails = await storage.getLoan(loanByUuid.id);
        if (!loanDetails || loanDetails.status !== 'approved') {
          return res.status(400).json({ message: "Loan must be approved before treasurer can disburse" });
        }

        const referenceNumber = `DIS${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const processingFeeSetting = await storage.getSystemSetting('loanProcessingFee');
        const feePercent = processingFeeSetting ? parseFloat(processingFeeSetting.settingValue) : 1;
        const loan = await storage.runSaccoLedgerTransaction(async (tx) => {
          const [disbursedLoan] = await tx.update(loans).set({ status: 'disbursed', updatedAt: new Date() })
            .where(eq(loans.id, loanByUuid.id)).returning();
          if (loanDetails.isTopUp && loanDetails.topUpOfLoanId) {
          const originalLoan = await storage.getLoan(loanDetails.topUpOfLoanId);
          const previousBalance = loanDetails.previousLoanBalance || originalLoan?.outstandingBalance || '0';
          const prevBalanceNum = parseFloat(previousBalance);
          const prevOutstandingNum = parseFloat(originalLoan?.outstandingBalance || '0');
          if (prevBalanceNum > 0) {
            await tx.update(loans).set({ outstandingBalance: previousBalance, updatedAt: new Date() }).where(eq(loans.id, loanDetails.topUpOfLoanId));
          }
          await tx.update(loans).set({ status: 'completed', updatedAt: new Date() }).where(eq(loans.id, loanDetails.topUpOfLoanId));
          const settleRef = `STL${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
          const topUpSplit1 = prevBalanceNum > 0 && originalLoan
            ? await splitLoanRepayment(originalLoan, prevBalanceNum, prevOutstandingNum)
            : { interestPortion: 0, principalPortion: prevBalanceNum, balanceReduction: prevBalanceNum };
          await tx.insert(transactions).values({
            memberId: disbursedLoan.memberId,
            loanId: loanDetails.topUpOfLoanId,
            transactionType: 'loan_payment',
            amount: previousBalance,
            referenceNumber: settleRef,
            description: `Loan settled via top-up - ${originalLoan?.loanNumber || 'N/A'} replaced by ${disbursedLoan.loanNumber}`,
            status: 'completed',
            metadata: JSON.stringify({
              interest: topUpSplit1.interestPortion,
              principalRepyt: topUpSplit1.principalPortion,
              balanceReduction: topUpSplit1.balanceReduction,
              source: 'topup_settlement'
            }),
          });
          if (prevBalanceNum > 0 && originalLoan) {
            await postLoanRepaymentJournals(originalLoan, topUpSplit1.interestPortion, topUpSplit1.principalPortion, 'Loan settlement via top-up', settleRef, userId, tx, false);
          }
        }

        await tx.insert(transactions).values({
          memberId: disbursedLoan.memberId,
          loanId: disbursedLoan.id,
          transactionType: 'loan_disbursement',
          amount: disbursedLoan.principalAmount,
          referenceNumber,
          description: `${loanDetails.isTopUp ? 'Top-up loan' : 'Loan'} disbursement - ${disbursedLoan.loanNumber}`,
          status: 'completed',
        });
        await recordJournalEntry('loan_disbursement', disbursedLoan.principalAmount, `Loan disbursement - ${disbursedLoan.loanNumber}`, referenceNumber, userId, tx, feePercent <= 0);

        if (feePercent > 0) {
            const feeAmount = (parseFloat(disbursedLoan.principalAmount) * feePercent / 100).toFixed(2);
            const feeRef = `FEE${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
            await tx.insert(transactions).values({
              memberId: disbursedLoan.memberId,
              loanId: disbursedLoan.id,
              transactionType: 'loan_payment',
              amount: feeAmount,
              referenceNumber: feeRef,
              description: `Loan processing fee (${feePercent}%) - ${disbursedLoan.loanNumber}`,
              status: 'completed',
            });
            await recordJournalEntry('loan_processing_fee', feeAmount, `Loan processing fee - ${disbursedLoan.loanNumber}`, feeRef, userId, tx);
        }
        return disbursedLoan;
        });

        const disburseMember = await storage.getMember(loan.memberId);
        if (disburseMember?.userId) {
          await createAndBroadcastNotification({
            type: 'loan_disbursement',
            title: 'Loan Disbursed',
            message: `Your loan ${loan.loanNumber} of UGX ${parseFloat(loan.principalAmount).toLocaleString()} has been disbursed. Please check your account.`,
            priority: 'high',
            actionUrl: `/loans/${loan.uuid}/details`,
            memberId: loan.memberId,
            userId: disburseMember.userId,
            isRead: false,
          });
        }

        await sendNotificationEmail(
          storage,
          disburseMember?.email,
          'Loan Disbursed',
          `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${disburseMember?.fullName || 'Member'},</p>
           <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Your loan <strong>${loan.loanNumber}</strong> of <strong>UGX ${parseFloat(loan.principalAmount).toLocaleString()}</strong> has been disbursed.</p>
           <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">Please check your account. Reference: ${referenceNumber}.</p>`
        );

        broadcastDataUpdate(['/api/loans/approval', '/api/loans', '/api/dashboard', '/api/loans/my-loans', '/api/savings', '/api/transactions', '/api/loans/my-approval-activity']);
        return res.json({ message: `Loan ${loan.loanNumber} disbursed successfully`, loan });
      } else {
        const loan = await storage.approveLoanAtStage(loanByUuid.id, stage, userId, comments);

        const member = await storage.getMember(loan.memberId);
        if (member) {
          await createAndBroadcastNotification({
            type: 'loan_approval',
            title: `Loan Approved at ${stage.charAt(0).toUpperCase() + stage.slice(1)} Stage`,
            message: `Your loan application ${loan.loanNumber} has been approved at the ${stage} stage. ${loan.status === 'approved' ? 'Loan is now fully approved!' : 'Moving to next approval stage.'}`,
            priority: loan.status === 'approved' ? 'high' : 'medium',
            actionUrl: `/loans/${loan.uuid}`,
            memberId: loan.memberId,
            userId: member.userId,
            isRead: false
          });
        }
        
        broadcastDataUpdate(['/api/loans/approval', '/api/loans', '/api/dashboard', '/api/loans/my-loans', '/api/loans/my-approval-activity']);
        return res.json({ message: `Loan approved at ${stage} stage`, loan });
      }
    } catch (error) {
      console.error(`Error approving loan at ${getRouteParam(req.params.stage)} stage:`, error);
      return res.status(500).json({ message: "Failed to approve loan" });
    }
  });

  app.post('/api/loans/:uuid/reject', isAuthenticated, async (req: any, res) => {
    try {
      const uuid = getRouteParam(req.params.uuid);
      const { reason } = req.body;
      const userId = getUserId(req)!;

      if (!reason?.trim()) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      // Get loan by UUID first to get the ID for legacy methods
      const loanByUuid = await storage.getLoanByUuid(uuid);
      if (!loanByUuid) {
        return res.status(404).json({ message: "Loan not found" });
      }

      const loan = await storage.rejectLoan(loanByUuid.id, userId, reason);

      const loanMember = await storage.getMember(loan.memberId);
      if (loanMember?.userId) {
        await createAndBroadcastNotification({
          type: 'loan_rejection',
          title: 'Loan Application Rejected',
          message: `Your loan application ${loan.loanNumber} has been rejected. Reason: ${reason}`,
          priority: 'high',
          actionUrl: '/loans',
          memberId: loan.memberId,
          userId: loanMember.userId,
          isRead: false
        });
      }

      broadcastDataUpdate(['/api/loans/approval', '/api/loans', '/api/dashboard', '/api/loans/my-loans', '/api/loans/my-approval-activity']);
      return res.json({ message: "Loan rejected", loan });
    } catch (error) {
      console.error("Error rejecting loan:", error);
      return res.status(500).json({ message: "Failed to reject loan" });
    }
  });

  app.get('/api/loans/:loanId/approvals', isAuthenticated, loanAccess(req => req.params.loanId), async (req: any, res) => {
    try {
      const loanId = parseInt(getRouteParam(req.params.loanId));
      const approvals = await storage.getLoanApprovals(loanId, 'committee');
      
      let minApprovers = 2;
      try {
        const setting = await storage.getSystemSetting('minLoanApprovers');
        if (setting?.settingValue) {
          const parsed = parseInt(setting.settingValue);
          if (!isNaN(parsed) && parsed > 0) minApprovers = parsed;
        }
      } catch {}

      const approvalsWithUsers = await Promise.all(
        approvals.map(async (a) => {
          const user = await storage.getUser(a.approvedBy);
          return {
            ...a,
            approverName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          };
        })
      );

      return res.json({
        approvals: approvalsWithUsers,
        approvalCount: approvals.length,
        minApprovers,
        isFullyApproved: approvals.length >= minApprovers,
      });
    } catch (error) {
      console.error("Error fetching loan approvals:", error);
      return res.status(500).json({ message: "Failed to fetch loan approvals" });
    }
  });

  app.get('/api/loans/:uuid/approval-history', isAuthenticated, loanAccess(req => req.params.uuid), async (req, res) => {
    try {
      const uuid = getRouteParam(req.params.uuid);
      const loan = await storage.getLoanByUuid(uuid);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      const history = await storage.getLoanApprovalHistory(loan.id);
      return res.json(history);
    } catch (error) {
      console.error("Error fetching loan approval history:", error);
      return res.status(500).json({ message: "Failed to fetch approval history" });
    }
  });

  app.patch('/api/loans/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const loanId = await storage.resolveLoanId(getRouteParam(req.params.id));
      const userId = getUserId(req)!;
      
      const loanDetails = await storage.getLoan(loanId);
      if (!loanDetails) {
        return res.status(404).json({ message: "Loan not found" });
      }

      if (loanDetails.status === 'pending') {
        return res.status(403).json({ 
          message: "Pending loans must be approved through the committee approval workflow on the dashboard." 
        });
      }

      if (!await hasApprovalRole(userId, loanDetails.approvalStage || 'committee')) {
        return res.status(403).json({ message: "You do not have permission to approve this loan." });
      }

      const guaranteeError = await guaranteeApprovalError(loanDetails);
      if (guaranteeError) return res.status(400).json({ message: guaranteeError });

      const guarantors = await storage.getGuarantorsByLoan(loanId);
      if (guarantors.length > 0) {
        const allApproved = guarantors.every(g => g.status === 'approved');
        const anyRejected = guarantors.some(g => g.status === 'rejected');
        
        if (anyRejected) {
          return res.status(400).json({ 
            message: "Cannot approve loan - one or more guarantors have rejected the request" 
          });
        }
        
        if (!allApproved) {
          const pendingCount = guarantors.filter(g => g.status === 'pending').length;
          return res.status(400).json({ 
            message: `Cannot approve loan - ${pendingCount} guarantor(s) must approve before formal approval can begin`,
            pendingGuarantors: pendingCount
          });
        }
      }

      const loan = await storage.updateLoanStatus(loanId, 'approved');
      return res.json(loan);
    } catch (error) {
      console.error("Error approving loan:", error);
      return res.status(500).json({ message: "Failed to approve loan" });
    }
  });

  app.patch('/api/loans/:id/disburse', isAuthenticated, requirePermission('disburse', 'loans'), async (req: any, res) => {
    try {
      const userId = getUserId(req)!;

      const loanId = await storage.resolveLoanId(getRouteParam(req.params.id));
      const loanDetails = await storage.getLoan(loanId);
      if (!loanDetails || loanDetails.status !== 'approved') {
        return res.status(400).json({ message: 'Loan must be approved before disbursement' });
      }
      const referenceNumber = `DIS${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const loanTypeInfo = await storage.getLoanTypeByName(loanDetails.loanType || '');
      const feesCollected: string[] = [];
      const loan = await storage.runSaccoLedgerTransaction(async (tx) => {
        const lockedLoans = await tx.execute(sql`SELECT * FROM ${loans} WHERE ${loans.id} = ${loanId} FOR UPDATE`);
        const loan = lockedLoans.rows[0] as typeof loans.$inferSelect | undefined;
        if (!loan || loan.status !== 'approved') throw new Error('Loan must be approved before disbursement');
        await tx.update(loans).set({ status: 'disbursed', updatedAt: new Date() }).where(eq(loans.id, loanId));
      if (loan.isTopUp && loan.topUpOfLoanId) {
        const originalLoan = await storage.getLoan(loan.topUpOfLoanId!);
        const previousBalance = loanDetails.previousLoanBalance || originalLoan?.outstandingBalance || '0';
        const prevBalanceNum = parseFloat(previousBalance);
        const prevOutstandingNum = parseFloat(originalLoan?.outstandingBalance || '0');

        if (prevBalanceNum > 0) {
          await tx.update(loans).set({ outstandingBalance: previousBalance, updatedAt: new Date() }).where(eq(loans.id, loan.topUpOfLoanId));
        }

        await tx.update(loans).set({ status: 'completed', updatedAt: new Date() }).where(eq(loans.id, loan.topUpOfLoanId));

        const settleRef = `STL${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const topUpSplit2 = prevBalanceNum > 0 && originalLoan
          ? await splitLoanRepayment(originalLoan, prevBalanceNum, prevOutstandingNum)
          : { interestPortion: 0, principalPortion: prevBalanceNum, balanceReduction: prevBalanceNum };
        await tx.insert(transactions).values({
          memberId: loan.memberId,
          loanId: loanDetails.topUpOfLoanId,
          transactionType: 'loan_payment',
          amount: previousBalance,
          referenceNumber: settleRef,
          description: `Loan settled via top-up - ${originalLoan?.loanNumber || 'N/A'} replaced by ${loan.loanNumber}`,
          status: 'completed',
          processedBy: getUserId(req),
          metadata: JSON.stringify({
            interest: topUpSplit2.interestPortion,
            principalRepyt: topUpSplit2.principalPortion,
            balanceReduction: topUpSplit2.balanceReduction,
            source: 'topup_settlement'
          }),
        });
        if (prevBalanceNum > 0 && originalLoan) {
          await postLoanRepaymentJournals(originalLoan, topUpSplit2.interestPortion, topUpSplit2.principalPortion, 'Loan settlement via top-up', settleRef, userId, tx, false);
        }
      }

      await tx.insert(transactions).values({
        memberId: loan.memberId,
        loanId: loan.id,
        transactionType: 'loan_disbursement',
        amount: loan.principalAmount,
        referenceNumber,
        description: `${loanDetails?.isTopUp ? 'Top-up loan' : 'Loan'} disbursement - ${loan.loanNumber}`,
        status: 'completed',
        processedBy: getUserId(req),
      });
      await recordJournalEntry('loan_disbursement', loan.principalAmount, `Loan disbursement - ${loan.loanNumber}`, referenceNumber, userId, tx, false);

      const acceptanceFee = parseFloat(loanTypeInfo?.acceptanceFee || '0');
      const processingFeeRate = parseFloat(loanTypeInfo?.processingFee || '0');
      const processingFeeAmount = processingFeeRate > 0 ? (processingFeeRate / 100) * parseFloat(loan.principalAmount || '0') : 0;
      const savingsRows = await tx.execute(sql`SELECT * FROM ${savingsAccountsTable} WHERE ${savingsAccountsTable.memberId} = ${loan.memberId} ORDER BY ${savingsAccountsTable.id} FOR UPDATE`);
      const primarySavings = (savingsRows.rows as any[]).find(s => s.account_type === 'regular') || savingsRows.rows[0] as any;
      const applicableFees = primarySavings ? [acceptanceFee, processingFeeAmount].filter(fee => fee > 0) : [];
      let remainingSavings = parseFloat(primarySavings?.balance || '0');
      for (const [index, fee] of applicableFees.entries()) {
        if (remainingSavings < fee) continue;
        remainingSavings -= fee;
        const isAcceptance = index === 0 && acceptanceFee > 0;
        const feeRef = isAcceptance ? `ACCFEE-${loan.loanNumber}` : `PROCFEE-${loan.loanNumber}`;
        const feeLabel = isAcceptance ? 'Loan acceptance fee' : `Loan processing fee (${processingFeeRate}%)`;
        await tx.update(savingsAccountsTable).set({ balance: remainingSavings.toFixed(2), updatedAt: new Date() }).where(eq(savingsAccountsTable.id, primarySavings.id));
        await tx.insert(transactions).values({ memberId: loan.memberId, savingsAccountId: primarySavings.id, loanId: loan.id, transactionType: 'fee_charge', amount: fee.toFixed(2), description: `${feeLabel} for ${loan.loanNumber}`, referenceNumber: feeRef, transactionDate: new Date(), status: 'completed', processedBy: userId });
        await recordJournalEntry('loan_processing_fee', fee, `${feeLabel} - ${loan.loanNumber}`, feeRef, userId, tx, false);
        feesCollected.push(`${isAcceptance ? 'Acceptance fee' : `Processing fee (${processingFeeRate}%)`}: UGX ${fee.toLocaleString()}`);
      }
      await storage.recalculateSaccoAccountBalancesInTransaction(tx);
      return loan;
      });

      const disburseMember = await storage.getMember(loan.memberId);
      if (disburseMember?.userId) {
        const feeNote = feesCollected.length > 0 ? ` Fees deducted from savings: ${feesCollected.join(', ')}.` : '';
        await createAndBroadcastNotification({
          type: 'loan_approval',
          title: 'Loan Disbursed',
          message: `Your loan ${loan.loanNumber} of UGX ${parseFloat(loan.principalAmount).toLocaleString()} has been disbursed.${feeNote} Please check your account.`,
          priority: 'high',
          actionUrl: '/loans',
          memberId: loan.memberId,
          userId: disburseMember.userId,
          isRead: false
        });
      }

      {
        const feeNote = feesCollected.length > 0 ? `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Fees deducted from your savings: ${feesCollected.join(', ')}.</p>` : '';
        await sendNotificationEmail(
          storage,
          disburseMember?.email,
          'Loan Disbursed',
          `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${disburseMember?.fullName || 'Member'},</p>
           <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Your loan <strong>${loan.loanNumber}</strong> of <strong>UGX ${parseFloat(loan.principalAmount).toLocaleString()}</strong> has been disbursed.</p>
           ${feeNote}
           <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">Please check your account. Reference: ${referenceNumber}.</p>`
        );
      }

      broadcastDataUpdate(['/api/loans', '/api/loans/approval', '/api/transactions', '/api/dashboard', '/api/savings', '/api/loans/my-loans', '/api/sacco-accounts', '/api/sacco-journal-entries']);
      return res.json({ ...loan, feesCollected });
    } catch (error) {
      console.error("Error disbursing loan:", error);
      return res.status(500).json({ message: "Failed to disburse loan" });
    }
  });

  app.post('/api/loans/:id/payment', isAuthenticated, requirePermission('record', 'loan-repayments'), async (req, res) => {
    try {
      const { amount, description } = req.body;
      const loanId = await storage.resolveLoanId(getRouteParam(req.params.id));
      
      const paymentAmount = parseFloat(amount);
      if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ message: "Payment amount must be a valid positive number" });
      }
      const referenceNumber = `PAY${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const transaction = await storage.runSaccoLedgerTransaction(async (tx) => {
        const lockedLoans = await tx.execute(sql`SELECT * FROM ${loans} WHERE ${loans.id} = ${loanId} FOR UPDATE`);
        const loanBefore = lockedLoans.rows[0] as typeof loans.$inferSelect | undefined;
        if (!loanBefore) throw new Error("Loan not found");
        const currentOutstanding = parseFloat(loanBefore.outstandingBalance || '0');
        const effectivePayment = Math.min(paymentAmount, currentOutstanding);
        if (effectivePayment <= 0) throw new Error("Loan is already fully paid");
        const { interestPortion, principalPortion, balanceReduction } =
          await splitLoanRepayment(loanBefore, effectivePayment, currentOutstanding);
        const newOutstanding = Math.max(0, currentOutstanding - balanceReduction);
        await tx.update(loans).set({
          outstandingBalance: newOutstanding.toFixed(2),
          status: newOutstanding <= 0 ? 'completed' : loanBefore.status,
          updatedAt: new Date(),
        }).where(eq(loans.id, loanId));
        const [createdTransaction] = await tx.insert(transactions).values({
          memberId: loanBefore.memberId!,
          loanId,
          transactionType: 'loan_payment',
          amount: effectivePayment.toFixed(2),
          referenceNumber,
          description: description || `Loan payment - ${loanBefore.loanNumber}`,
          status: 'completed',
          processedBy: getUserId(req),
          metadata: JSON.stringify({
            interest: interestPortion,
            principalRepyt: principalPortion,
            balanceReduction,
            source: 'manual_payment'
          }),
        }).returning();
        await postLoanRepaymentJournals(
          loanBefore,
          interestPortion,
          principalPortion,
          'Loan payment',
          referenceNumber,
          getUserId(req)!,
          tx,
        );
        return createdTransaction;
      });
      const loan = await storage.getLoan(loanId);
      if (!loan) return res.status(404).json({ message: "Loan not found" });

      const paymentMember = await storage.getMember(loan.memberId!);
      if (paymentMember && ['inactive', 'dormant'].includes(paymentMember.status ?? '')) {
        await db.update(members).set({
          status: 'active' as any,
          lastActivityDate: new Date(),
          isActiveSaver: true,
          updatedAt: new Date(),
        }).where(eq(members.id, loan.memberId!));
      } else if (paymentMember) {
        await db.update(members).set({
          lastActivityDate: new Date(),
        }).where(eq(members.id, loan.memberId!));
      }

      if (paymentMember?.userId) {
        await createAndBroadcastNotification({
          type: 'payment_received',
          title: 'Loan Payment Recorded',
          message: `A payment of UGX ${parseFloat(amount).toLocaleString()} has been recorded for your loan ${loan.loanNumber}. Outstanding balance: UGX ${parseFloat(loan.outstandingBalance || '0').toLocaleString()}.`,
          priority: 'medium',
          actionUrl: '/loans',
          memberId: loan.memberId!,
          userId: paymentMember.userId,
          isRead: false
        });
      }

      broadcastDataUpdate(['/api/loans', '/api/transactions', '/api/dashboard', '/api/savings', '/api/loans/my-loans', '/api/sacco-accounts', '/api/sacco-journal-entries']);
      return res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing loan payment:", error);
      return res.status(500).json({ message: "Failed to process loan payment" });
    }
  });

  app.get('/api/members/:id/loans', isAuthenticated, memberLoanAccess(req => req.params.id), async (req, res) => {
    try {
      const loans = await storage.getLoansByMember(await storage.resolveMemberId(getRouteParam(req.params.id)));
      return res.json(loans);
    } catch (error) {
      console.error("Error fetching member loans:", error);
      return res.status(500).json({ message: "Failed to fetch member loans" });
    }
  });

  app.get('/api/savings/my-savings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Member record not found" });
      }

      const { search, page, limit } = req.query;
      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
        const result = await storage.getSavingsAccountsPaginated(pageNum, limitNum, search as string, member.id);
        return res.json(result);
      }

      const savingsAccounts = await storage.getSavingsAccountsByMember(member.id);
      const accountsWithMember = savingsAccounts.map(account => ({
        ...account,
        member: {
          id: member.id,
          fullName: member.fullName,
          memberNumber: member.memberNumber,
          user: member.user ? { firstName: member.user.firstName, lastName: member.user.lastName } : undefined,
        },
      }));
      return res.json(accountsWithMember);
    } catch (error) {
      console.error("Error fetching personal savings:", error);
      return res.status(500).json({ message: "Failed to fetch personal savings" });
    }
  });

  app.get('/api/transactions/my-transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Member record not found" });
      }

      const { search, page, limit } = req.query;
      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
        const result = await storage.getTransactionsPaginated(pageNum, limitNum, search as string, member.id);
        return res.json(result);
      }

      const transactions = await storage.getTransactionsByMember(member.id);
      return res.json(transactions);
    } catch (error) {
      console.error("Error fetching personal transactions:", error);
      return res.status(500).json({ message: "Failed to fetch personal transactions" });
    }
  });

  // Savings account routes
  app.get('/api/savings-accounts', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const savingsUser = await storage.getUser(userId);
      const requestingMember = await storage.getMemberByUserId(userId);
      const isSavingsAdmin = savingsUser?.role === 'admin';

      const roleNames = requestingMember ? await storage.getMemberRoles(requestingMember.id) : [];
      const effectiveRoles = roleNames.length > 0 ? roleNames : (savingsUser?.role ? [savingsUser.role] : []);

      const isStaff = isSavingsAdmin || effectiveRoles.some(role => ['admin', 'manager', 'committee', 'treasurer'].includes(role));

      const { search, page, limit } = req.query;

      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));

        if (isStaff) {
          const result = await storage.getSavingsAccountsPaginated(pageNum, limitNum, search as string);
          return res.json(result);
        } else if (requestingMember) {
          const result = await storage.getSavingsAccountsPaginated(pageNum, limitNum, search as string, requestingMember.id);
          return res.json(result);
        }
        return res.json({ data: [], total: 0 });
      }

      let savingsAccounts;
      if (isStaff) {
        savingsAccounts = await storage.getAllSavingsAccounts();
      } else if (requestingMember) {
        savingsAccounts = await storage.getSavingsAccountsByMember(requestingMember.id);
      } else {
        savingsAccounts = [];
      }

      return res.json(savingsAccounts);
    } catch (error) {
      console.error("Error fetching savings accounts:", error);
      return res.status(500).json({ message: "Failed to fetch savings accounts" });
    }
  });

  // Transaction routes
  app.get('/api/transactions', isAuthenticated, async (req, res) => {
    try {
      const { search, page, limit } = req.query;

      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
        const result = await storage.getTransactionsPaginated(pageNum, limitNum, search as string);
        return res.json(result);
      }

      const transactions = await storage.getRecentTransactions(limit ? parseInt(limit as string) : undefined);
      return res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get('/api/members/:id/transactions', isAuthenticated, async (req, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.id));
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);

      const allTransactions = await storage.getTransactionsByMember(memberId);
      const total = allTransactions.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedTransactions = allTransactions.slice(offset, offset + limit);

      const [savingsInt] = await db
        .select({ total: sql<string>`COALESCE(sum(CAST(${transactions.amount} AS decimal)), 0)` })
        .from(transactions)
        .where(and(
          eq(transactions.memberId, memberId),
          eq(transactions.transactionType, 'interest_credit'),
          eq(transactions.status, 'completed')
        ));

      const [calcInt] = await db
        .select({ total: sql<string>`COALESCE(sum(${interestCalculations.grossInterest}::numeric), 0)` })
        .from(interestCalculations)
        .where(and(
          eq(interestCalculations.memberId, memberId),
          sql`${interestCalculations.status} IN ('posted', 'paid')`
        ));

      const totalInterestPaid = (parseFloat(savingsInt?.total || '0') + parseFloat(calcInt?.total || '0')).toFixed(2);

      return res.json({
        transactions: paginatedTransactions,
        total,
        page,
        totalPages,
        totalInterestPaid,
      });
    } catch (error) {
      console.error("Error fetching member transactions:", error);
      return res.status(500).json({ message: "Failed to fetch member transactions" });
    }
  });

  app.get('/api/savings-accounts/:id/statement', isAuthenticated, async (req, res) => {
    try {
      const savingsAccountId = await storage.resolveSavingsAccountId(getRouteParam(req.params.id));
      const account = await storage.getSavingsAccount(savingsAccountId);
      
      if (!account) {
        return res.status(404).json({ message: "Savings account not found" });
      }

      const exportAll = req.query.export === 'true';
      const page = exportAll ? 1 : (parseInt(req.query.page as string) || 1);
      const limit = exportAll ? 1_000_000 : Math.min(parseInt(req.query.limit as string) || 25, 100);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const result = await storage.getTransactionsBySavingsAccountPaginated(savingsAccountId, {
        startDate,
        endDate,
        page,
        limit,
      });

      const activeFinancialYear = await storage.getActiveFinancialYear();
      const fyInterestRate = activeFinancialYear?.interestRate || null;

      const allInterestCalcs = await db
        .select({
          totalPosted: sql<string>`COALESCE(SUM(CASE WHEN ${interestCalculations.status} IN ('posted', 'paid') THEN ${interestCalculations.grossInterest}::numeric ELSE 0 END), 0)`,
          totalAll: sql<string>`COALESCE(SUM(${interestCalculations.grossInterest}::numeric), 0)`,
        })
        .from(interestCalculations)
        .where(eq(interestCalculations.savingsAccountId, savingsAccountId));
      const totalInterestEarned = parseFloat(allInterestCalcs[0]?.totalPosted || '0');
      const totalInterestCalculated = parseFloat(allInterestCalcs[0]?.totalAll || '0');

      return res.json({
        account,
        transactions: result.transactions,
        total: result.total,
        totalDeposits: result.totalDeposits,
        totalWithdrawals: result.totalWithdrawals,
        totalInterest: totalInterestEarned > 0 ? totalInterestEarned : result.totalInterest,
        totalInterestCalculated,
        financialYearInterestRate: fyInterestRate,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      console.error("Error fetching account statement:", error);
      return res.status(500).json({ message: "Failed to fetch account statement" });
    }
  });

  app.patch('/api/transactions/:id/approve', isAuthenticated, requirePermission('approve', 'withdrawals'), async (req: any, res) => {
    try {
      const transactionId = await storage.resolveTransactionId(getRouteParam(req.params.id));
      const updatedTransaction = await storage.runSaccoLedgerTransaction(async (tx) => {
        const [transaction] = await tx.select().from(transactions)
          .where(eq(transactions.id, transactionId))
          .for('update');
        if (!transaction) throw new Error("Transaction not found");
        if (transaction.status !== 'pending') throw new Error(`Transaction is already ${transaction.status}`);

        if (transaction.transactionType === 'withdrawal' && transaction.savingsAccountId) {
          const [account] = await tx.select().from(savingsAccountsTable)
            .where(eq(savingsAccountsTable.id, transaction.savingsAccountId))
            .for('update');
          if (!account) throw new Error("Savings account not found");
          if (parseFloat(account.balance || '0') < parseFloat(transaction.amount)) {
            throw new Error("Insufficient savings balance");
          }
          await tx.update(savingsAccountsTable).set({
            balance: sql`${savingsAccountsTable.balance}::numeric - ${transaction.amount}::numeric`,
            updatedAt: new Date(),
          }).where(eq(savingsAccountsTable.id, transaction.savingsAccountId));
          await recordJournalEntry('member_withdrawal', transaction.amount, `Savings withdrawal approved - Ref: ${transaction.referenceNumber}`, transaction.referenceNumber || `WDR-${transactionId}`, getUserId(req)!, tx);
          await tx.update(members).set({
            totalSavings: sql`(SELECT COALESCE(SUM(balance::numeric), 0) FROM savings_accounts WHERE member_id = ${transaction.memberId})`,
          }).where(eq(members.id, transaction.memberId));
        }

        const [completed] = await tx.update(transactions).set({ status: 'completed' })
          .where(eq(transactions.id, transactionId))
          .returning();
        return completed;
      });
      return res.json(updatedTransaction);
    } catch (error) {
      console.error("Error approving transaction:", error);
      return res.status(500).json({ message: "Failed to approve transaction" });
    }
  });

  // Eligible guarantors — returns active members with basic info for guarantor selection
  app.get('/api/guarantors/eligible-members', isAuthenticated, async (req: any, res) => {
    try {
      const allMembers = await storage.getAllMembers();
      const eligible = allMembers
        .filter((m: any) => m.status === 'active')
        .map((m: any) => ({
          id: m.id,
          uuid: m.uuid,
          memberNumber: m.memberNumber,
          fullName: m.fullName,
          status: m.status,
          totalSavings: m.totalSavings,
        }));
      return res.json(eligible);
    } catch (error) {
      console.error("Error fetching eligible guarantors:", error);
      return res.status(500).json({ message: "Failed to fetch eligible guarantors" });
    }
  });

  app.post('/api/guarantors/validate-member', isAuthenticated, async (req: any, res) => {
    try {
      const { memberNumber } = req.body;
      if (!memberNumber || typeof memberNumber !== 'string') {
        return res.status(400).json({ valid: false, message: 'Member ID is required' });
      }
      const allMembers = await storage.getAllMembers();
      const member = allMembers.find((m: any) => m.memberNumber === memberNumber.trim());
      if (!member) {
        return res.status(404).json({ valid: false, message: 'No member found with this ID' });
      }
      if (member.status !== 'active') {
        return res.status(400).json({ valid: false, message: 'This member is not eligible to be a guarantor' });
      }
      return res.json({ valid: true, memberId: member.id, memberNumber: member.memberNumber });
    } catch (error) {
      console.error("Error validating guarantor member:", error);
      return res.status(500).json({ valid: false, message: "Failed to validate member" });
    }
  });

  // Guarantor routes
  app.post('/api/guarantors', isAuthenticated, loanAccess(req => req.body?.loanId), async (req: any, res) => {
    try {
      const validatedData = insertGuarantorSchema.parse(req.body);
      
      const guarantorMember = await storage.getMember(validatedData.guarantorMemberId);
      if (!guarantorMember) {
        return res.status(404).json({ message: "Guarantor member not found" });
      }
      
      if (guarantorMember.status !== 'active') {
        return res.status(400).json({ 
          message: "Only approved/active members can serve as guarantors",
          memberStatus: guarantorMember.status 
        });
      }

      const existingGuarantors = await storage.getGuarantorsByLoan(validatedData.loanId);
      const alreadyGuarantor = existingGuarantors.find(
        g => g.guarantorMemberId === validatedData.guarantorMemberId
      );
      if (alreadyGuarantor) {
        return res.status(400).json({ 
          message: `${guarantorMember.fullName || 'This member'} is already a guarantor for this loan` 
        });
      }

      const guaranteeAmount = parseFloat(validatedData.guaranteeAmount || '0');
      if (guaranteeAmount > 0) {
        const guarantorSavings = await storage.getSavingsAccountsByMember(validatedData.guarantorMemberId);
        const guarantorTotalSavings = guarantorSavings.reduce((sum, acc) => sum + parseFloat(acc.balance || '0'), 0);
        if (guarantorTotalSavings < guaranteeAmount) {
          return res.status(400).json({ 
            message: `${guarantorMember.fullName || 'This member'} has insufficient savings (${Math.round(guarantorTotalSavings).toLocaleString()} UGX) to guarantee ${Math.round(guaranteeAmount).toLocaleString()} UGX`,
            guarantorSavings: guarantorTotalSavings,
            guaranteeAmount
          });
        }
      }
      
      const guarantor = await storage.createGuarantor(validatedData);

      const gLoan = await storage.getLoan(validatedData.loanId);
      const gLoanApplicant = gLoan ? await storage.getMember(gLoan.memberId) : null;
      if (guarantorMember.userId) {
        await createAndBroadcastNotification({
          type: 'guarantor_request',
          title: 'Guarantor Request',
          message: `${gLoanApplicant?.fullName || 'A member'} has requested you to guarantee their loan ${gLoan?.loanNumber || ''} for UGX ${parseFloat(validatedData.guaranteeAmount || '0').toLocaleString()}.`,
          priority: 'high',
          actionUrl: '/guarantor-requests',
          memberId: guarantorMember.id,
          userId: guarantorMember.userId,
          isRead: false
        });
      }

      broadcastDataUpdate(['/api/guarantors', '/api/loans']);
      return res.status(201).json(guarantor);
    } catch (error: any) {
      console.error("Error creating guarantor:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      if (error?.code === '23505' || error?.message?.includes('guarantors_loan_member_unique')) {
        return res.status(400).json({ message: "This member is already a guarantor for this loan" });
      }
      return res.status(500).json({ message: "Failed to create guarantor" });
    }
  });

  // Bulk add guarantors to a loan
  app.post('/api/loans/:loanId/guarantors', isAuthenticated, loanAccess(req => req.params.loanId), async (req: any, res) => {
    try {
      const loanId = await storage.resolveLoanId(getRouteParam(req.params.loanId));
      const { guarantors: guarantorList } = req.body;

      if (!Array.isArray(guarantorList) || guarantorList.length === 0) {
        return res.status(400).json({ message: "At least one guarantor is required" });
      }

      // Validate loan exists and belongs to user or user has permission
      const loan = await storage.getLoan(loanId);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }

      const loanMemberSavings = await storage.getSavingsAccountsByMember(loan.memberId);
      const loanMemberTotalSavings = loanMemberSavings.reduce((sum, acc) => sum + parseFloat(acc.balance || '0'), 0);
      const loanPrincipal = parseFloat(loan.principalAmount || '0');
      const product = (await storage.getAllLoanTypes()).find(type => type.name === loan.loanType);
      if (!product) return res.status(400).json({ message: "Loan product configuration not found" });
      if (!product.requiresGuarantor && loanMemberTotalSavings >= loanPrincipal) {
        return res.status(400).json({ message: "Member's savings fully cover this loan. No guarantors are required." });
      }

      const invalidGuarantors = [];
      for (const guarantorData of guarantorList) {
        const guarantorMember = await storage.getMember(guarantorData.guarantorMemberId);
        if (!guarantorMember) {
          invalidGuarantors.push(`Member ID ${guarantorData.guarantorMemberId} not found`);
        } else if (guarantorMember.status !== 'active') {
          invalidGuarantors.push(`${guarantorMember.fullName || guarantorMember.memberNumber} is not an active member (status: ${guarantorMember.status})`);
        } else {
          const gSavings = await storage.getSavingsAccountsByMember(guarantorData.guarantorMemberId);
          const gTotalSavings = gSavings.reduce((sum, acc) => sum + parseFloat(acc.balance || '0'), 0);
          const gAmount = parseFloat(guarantorData.guaranteeAmount || '0');
          if (gAmount > 0 && gTotalSavings < gAmount) {
            invalidGuarantors.push(`${guarantorMember.fullName || guarantorMember.memberNumber} has insufficient savings (${Math.round(gTotalSavings).toLocaleString()} UGX) to guarantee ${Math.round(gAmount).toLocaleString()} UGX`);
          }
        }
      }

      if (invalidGuarantors.length > 0) {
        return res.status(400).json({ 
          message: "Only approved/active members can serve as guarantors",
          invalidGuarantors 
        });
      }

      const createdGuarantors = [];
      const loanApplicant = await storage.getMember(loan.memberId);
      for (const guarantorData of guarantorList) {
        const guarantor = await storage.createGuarantor({
          loanId,
          guarantorMemberId: guarantorData.guarantorMemberId,
          guaranteeAmount: guarantorData.guaranteeAmount,
          status: 'pending'
        });
        createdGuarantors.push(guarantor);

        const gMember = await storage.getMember(guarantorData.guarantorMemberId);
        if (gMember?.userId) {
          await createAndBroadcastNotification({
            type: 'guarantor_request',
            title: 'Guarantor Request',
            message: `${loanApplicant?.fullName || 'A member'} has requested you to guarantee their loan ${loan.loanNumber} for UGX ${parseFloat(guarantorData.guaranteeAmount || '0').toLocaleString()}.`,
            priority: 'high',
            actionUrl: '/guarantor-requests',
            memberId: gMember.id,
            userId: gMember.userId,
            isRead: false
          });
        }
      }

      broadcastDataUpdate(['/api/guarantors', '/api/loans']);
      return res.status(201).json(createdGuarantors);
    } catch (error) {
      console.error("Error adding guarantors to loan:", error);
      return res.status(500).json({ message: "Failed to add guarantors to loan" });
    }
  });

  app.get('/api/guarantors/loan/:loanId', isAuthenticated, loanAccess(req => req.params.loanId), async (req, res) => {
    try {
      const loanId = await storage.resolveLoanId(getRouteParam(req.params.loanId));
      const guarantors = await storage.getGuarantorsByLoan(loanId);
      return res.json(guarantors);
    } catch (error) {
      console.error("Error fetching guarantors by loan:", error);
      return res.status(500).json({ message: "Failed to fetch guarantors" });
    }
  });

  // Guarantor approval endpoints
  app.patch('/api/guarantors/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const guarantorId = await storage.resolveGuarantorId(getRouteParam(req.params.id));
      const { comments } = req.body;
      const userId = getUserId(req)!;

      // Get the guarantor and verify the current user is the guarantor
      const guarantor = await storage.getGuarantor(guarantorId);
      if (!guarantor) {
        return res.status(404).json({ message: "Guarantor request not found" });
      }

      // Verify the current user is the guarantor member
      const guarantorMember = await storage.getMemberByUserId(userId);
      if (!guarantorMember || guarantorMember.id !== guarantor.guarantorMemberId) {
        return res.status(403).json({ message: "You can only approve your own guarantor requests" });
      }

      if (guarantor.status !== 'pending') {
        return res.status(400).json({ message: "Guarantor request has already been processed" });
      }

      const updatedGuarantor = await storage.updateGuarantorStatus(guarantorId, 'approved', comments);
      
      await storage.createAuditLog({
        userId,
        action: 'approve',
        resource: 'guarantor',
        resourceId: guarantorId.toString(),
        details: `Approved guarantor request for UGX ${guarantor.guaranteeAmount}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      const gApprovedLoan = await storage.getLoan(guarantor.loanId);
      const gApprovedLoanMember = gApprovedLoan ? await storage.getMember(gApprovedLoan.memberId) : null;
      if (gApprovedLoanMember?.userId) {
        await createAndBroadcastNotification({
          type: 'guarantor_response',
          title: 'Guarantor Approved',
          message: `${guarantorMember?.fullName || 'A guarantor'} has approved to guarantee your loan ${gApprovedLoan?.loanNumber || ''} for UGX ${parseFloat(guarantor.guaranteeAmount || '0').toLocaleString()}.`,
          priority: 'medium',
          actionUrl: '/loans',
          memberId: gApprovedLoanMember.id,
          userId: gApprovedLoanMember.userId,
          isRead: false
        });
      }

      broadcastDataUpdate(['/api/guarantors', '/api/loans', '/api/loans/approval']);
      return res.json(updatedGuarantor);
    } catch (error) {
      console.error("Error approving guarantor:", error);
      return res.status(500).json({ message: "Failed to approve guarantor request" });
    }
  });

  app.patch('/api/guarantors/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const guarantorId = await storage.resolveGuarantorId(getRouteParam(req.params.id));
      const { comments } = req.body;
      const userId = getUserId(req)!;

      if (!comments?.trim()) {
        return res.status(400).json({ message: "Comments are required for rejection" });
      }

      // Get the guarantor and verify the current user is the guarantor
      const guarantor = await storage.getGuarantor(guarantorId);
      if (!guarantor) {
        return res.status(404).json({ message: "Guarantor request not found" });
      }

      // Verify the current user is the guarantor member
      const guarantorMember = await storage.getMemberByUserId(userId!);
      if (!guarantorMember || guarantorMember.id !== guarantor.guarantorMemberId) {
        return res.status(403).json({ message: "You can only reject your own guarantor requests" });
      }

      if (guarantor.status !== 'pending') {
        return res.status(400).json({ message: "Guarantor request has already been processed" });
      }

      const updatedGuarantor = await storage.updateGuarantorStatus(guarantorId, 'rejected', comments);
      
      await storage.createAuditLog({
        userId,
        action: 'reject',
        resource: 'guarantor',
        resourceId: guarantorId.toString(),
        details: `Rejected guarantor request: ${comments}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      const gRejectedLoan = await storage.getLoan(guarantor.loanId);
      const gRejectedLoanMember = gRejectedLoan ? await storage.getMember(gRejectedLoan.memberId) : null;
      if (gRejectedLoanMember?.userId) {
        await createAndBroadcastNotification({
          type: 'guarantor_response',
          title: 'Guarantor Declined',
          message: `${guarantorMember?.fullName || 'A guarantor'} has declined to guarantee your loan ${gRejectedLoan?.loanNumber || ''}. Reason: ${comments}. You may need to find a replacement guarantor.`,
          priority: 'high',
          actionUrl: '/loans',
          memberId: gRejectedLoanMember.id,
          userId: gRejectedLoanMember.userId,
          isRead: false
        });
      }

      broadcastDataUpdate(['/api/guarantors', '/api/loans']);
      return res.json(updatedGuarantor);
    } catch (error) {
      console.error("Error rejecting guarantor:", error);
      return res.status(500).json({ message: "Failed to reject guarantor request" });
    }
  });

  app.patch('/api/guarantors/:id/resend', isAuthenticated, async (req: any, res) => {
    try {
      const guarantorId = await storage.resolveGuarantorId(getRouteParam(req.params.id));
      const userId = getUserId(req)!;

      const guarantor = await storage.getGuarantor(guarantorId);
      if (!guarantor) {
        return res.status(404).json({ message: "Guarantor request not found" });
      }

      if (guarantor.status !== 'rejected') {
        return res.status(400).json({ message: "Only rejected guarantor requests can be resent" });
      }

      const loan = await storage.getLoan(guarantor.loanId);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }

      const member = await storage.getMemberByUserId(userId);
      if (!member || member.id !== loan.memberId) {
        return res.status(403).json({ message: "Only the loan applicant can resend guarantor requests" });
      }

      const updatedGuarantor = await storage.updateGuarantorStatus(guarantorId, 'pending');
      
      await storage.createAuditLog({
        userId,
        action: 'resend',
        resource: 'guarantor',
        resourceId: guarantorId.toString(),
        details: `Resent guarantor request to member ${guarantor.guarantorMemberId}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      broadcastDataUpdate(['/api/guarantors', '/api/loans']);
      return res.json(updatedGuarantor);
    } catch (error) {
      console.error("Error resending guarantor request:", error);
      return res.status(500).json({ message: "Failed to resend guarantor request" });
    }
  });

  // Get pending guarantor requests for the current user
  app.get('/api/guarantors/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const guarantorUser = await storage.getUser(userId!);
      const member = await storage.getMemberByUserId(userId!);
      
      if (!member) {
        if (guarantorUser?.role === 'admin') {
          return res.json([]);
        }
        return res.status(404).json({ message: "Member not found" });
      }

      const pendingRequests = await storage.getPendingGuarantorRequests(member.id);
      return res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending guarantor requests:", error);
      return res.status(500).json({ message: "Failed to fetch pending guarantor requests" });
    }
  });

  app.get('/api/guarantors/member/:memberId', isAuthenticated, memberLoanAccess(req => req.params.memberId), async (req, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.memberId));
      const guarantors = await storage.getGuarantorsByMember(memberId);
      res.json(guarantors);
    } catch (error) {
      console.error("Error fetching guarantors by member:", error);
      res.status(500).json({ message: "Failed to fetch guarantors" });
    }
  });

  app.get('/api/guarantors/pending/:memberId', isAuthenticated, memberLoanAccess(req => req.params.memberId), async (req, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.memberId));
      const pendingRequests = await storage.getPendingGuarantorRequests(memberId);
      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending guarantor requests:", error);
      res.status(500).json({ message: "Failed to fetch pending requests" });
    }
  });

  app.patch('/api/guarantors/:id/approve', isAuthenticated, async (req, res) => {
    try {
      const guarantorId = await storage.resolveGuarantorId(getRouteParam(req.params.id));
      const { comments } = req.body;
      const guarantor = await storage.updateGuarantorStatus(guarantorId, 'approved', comments);
      broadcastDataUpdate(['/api/guarantors', '/api/loans', '/api/loans/approval']);
      res.json(guarantor);
    } catch (error) {
      console.error("Error approving guarantor:", error);
      res.status(500).json({ message: "Failed to approve guarantor" });
    }
  });

  app.patch('/api/guarantors/:id/reject', isAuthenticated, async (req, res) => {
    try {
      const guarantorId = await storage.resolveGuarantorId(getRouteParam(req.params.id));
      const { comments } = req.body;
      const guarantor = await storage.updateGuarantorStatus(guarantorId, 'rejected', comments);
      broadcastDataUpdate(['/api/guarantors', '/api/loans']);
      res.json(guarantor);
    } catch (error) {
      console.error("Error rejecting guarantor:", error);
      res.status(500).json({ message: "Failed to reject guarantor" });
    }
  });

  // Audit logs endpoint (admin only)
  app.get('/api/audit-logs', isAuthenticated, requirePermission('read', 'audit-logs'), async (req: any, res) => {
    try {
      const { search, page, limit, resource, action } = req.query;

      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
        const result = await storage.getAuditLogsPaginated(pageNum, limitNum, search as string, resource as string, action as string);
        return res.json(result);
      }

      const filters = {
        userId: req.query.userId as string,
        resource: req.query.resource as string,
        action: req.query.action as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100
      };
      
      const logs = await storage.getAuditLogs(filters);
      return res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // RBAC Management Endpoints
  app.get('/api/rbac/roles', isAuthenticated, requirePermission('read', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roles = await storage.getAllRoles();
      const rolesWithPermissions = await Promise.all(
        roles.map(async (role) => {
          const permissions = await storage.getPermissionsByRole(role.id);
          return { ...role, permissions };
        })
      );
      res.json(rolesWithPermissions);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get('/api/rbac/roles/:id', isAuthenticated, requirePermission('read', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roleId = parseInt(getRouteParam(req.params.id));
      const role = await storage.getRoleById(roleId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      return res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      return res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  app.post('/api/rbac/roles', isAuthenticated, requirePermission('create', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roleData = req.body;
      const role = await storage.createRole(roleData);
      
      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'create',
        resource: 'role',
        resourceId: role.id.toString(),
        details: `Created role: ${role.name}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json(role);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.put('/api/rbac/roles/:id', isAuthenticated, requirePermission('update', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roleId = parseInt(getRouteParam(req.params.id));
      const updates = req.body;
      const role = await storage.updateRole(roleId, updates);
      
      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'update',
        resource: 'role',
        resourceId: role.id.toString(),
        details: `Updated role: ${role.name}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json(role);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete('/api/rbac/roles/:id', isAuthenticated, requirePermission('delete', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roleId = parseInt(getRouteParam(req.params.id));
      const role = await storage.getRoleById(roleId);
      
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      if (role.isSystem) {
        return res.status(400).json({ message: "Cannot delete system roles" });
      }
      
      await storage.deleteRole(roleId);
      
      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'delete',
        resource: 'role',
        resourceId: roleId.toString(),
        details: `Deleted role: ${role.name}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      return res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      return res.status(500).json({ message: "Failed to delete role" });
    }
  });

  app.get('/api/rbac/permissions', isAuthenticated, requirePermission('read', 'roles'), async (req: AuthRequest, res) => {
    try {
      const permissions = await storage.getAllPermissions();
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.get('/api/rbac/roles/:id/permissions', isAuthenticated, requirePermission('read', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roleId = parseInt(getRouteParam(req.params.id));
      const permissions = await storage.getPermissionsByRole(roleId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  app.put('/api/rbac/roles/:id/permissions', isAuthenticated, requirePermission('update', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roleId = parseInt(getRouteParam(req.params.id));
      const { permissionIds } = req.body;
      
      await storage.assignPermissionsToRole(roleId, permissionIds);
      
      const role = await storage.getRoleById(roleId);
      
      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'update',
        resource: 'role-permissions',
        resourceId: roleId.toString(),
        details: `Updated permissions for role: ${role?.name}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json({ message: "Permissions updated successfully" });
    } catch (error) {
      console.error("Error updating role permissions:", error);
      res.status(500).json({ message: "Failed to update role permissions" });
    }
  });

  // Member Role Management API routes
  app.get('/api/members/:id/roles', isAuthenticated, requirePermission('read', 'members'), async (req: AuthRequest, res) => {
    try {
      const memberId = await storage.resolveMemberId(getRouteParam(req.params.id));
      
      const [member] = await db
        .select({
          role: members.role
        })
        .from(members)
        .where(eq(members.id, memberId));

      if (!member) {
        return res.status(404).json({ message: 'Member not found' });
        return;
      }

      const memberRolesList = await storage.getMemberRoles(memberId);
      return res.json(memberRolesList);
    } catch (error) {
      console.error('Error fetching member roles:', error);
      return res.status(500).json({ message: 'Failed to fetch member roles' });
    }
  });



  // Interest rate management routes
  app.post('/api/interest-rates', isAuthenticated, requirePermission('create', 'interest-rates'), async (req: any, res) => {
    try {
      const { productType, baseRate, compoundingFrequency, minimumAmount, maximumAmount, minimumTerm, maximumTerm } = req.body;
      
      const rate = await storage.createInterestRate({
        productType,
        baseRate,
        compoundingFrequency,
        minimumAmount,
        maximumAmount,
        minimumTerm,
        maximumTerm,
        isActive: true
      });

      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'create',
        resource: 'interest_rate',
        resourceId: rate.id.toString(),
        details: `Created interest rate for ${productType} at ${baseRate}%`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(rate);
    } catch (error) {
      console.error("Error creating interest rate:", error);
      res.status(500).json({ message: "Failed to create interest rate" });
    }
  });

  app.get('/api/interest-rates', isAuthenticated, requirePermission('read', 'interest-rates'), async (req: any, res) => {
    try {
      const rates = await storage.getActiveInterestRates();
      res.json(rates);
    } catch (error) {
      console.error("Error fetching interest rates:", error);
      res.status(500).json({ message: "Failed to fetch interest rates" });
    }
  });

  app.get('/api/interest-rates/product/:productType', isAuthenticated, async (req: any, res) => {
    try {
      const productType = getRouteParam(req.params.productType);
      const rate = await storage.getInterestRateByProduct(productType);
      res.json(rate);
    } catch (error) {
      console.error("Error fetching interest rate:", error);
      res.status(500).json({ message: "Failed to fetch interest rate" });
    }
  });

  // Amortization schedule routes
  app.get('/api/loans/:uuid/amortization', isAuthenticated, async (req: any, res) => {
    try {
      const uuid = getRouteParam(req.params.uuid);
      // Get loan by UUID first to get the ID for legacy methods
      const loan = await storage.getLoanByUuid(uuid);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      const schedule = await storage.getAmortizationSchedule(loan.id);
      return res.json(schedule);
    } catch (error) {
      console.error("Error fetching amortization schedule:", error);
      return res.status(500).json({ message: "Failed to fetch amortization schedule" });
    }
  });

  app.post('/api/loans/:uuid/generate-amortization', isAuthenticated, requirePermission('create', 'amortization'), async (req: any, res) => {
    try {
      const uuid = getRouteParam(req.params.uuid);
      // Get loan by UUID first to get the ID for legacy methods
      const loan = await storage.getLoanByUuid(uuid);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      const schedule = await storage.generateLoanAmortization(loan.id);

      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'create',
        resource: 'amortization_schedule',
        resourceId: uuid,
        details: `Generated amortization schedule for loan ${uuid}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.json(schedule);
    } catch (error) {
      console.error("Error generating amortization schedule:", error);
      return res.status(500).json({ message: "Failed to generate amortization schedule" });
    }
  });

  app.post('/api/loans/:uuid/calculate-interest', isAuthenticated, requirePermission('create', 'interest-calculations'), async (req: any, res) => {
    try {
      const uuid = getRouteParam(req.params.uuid);
      // Get loan by UUID first to get the ID for legacy methods
      const loan = await storage.getLoanByUuid(uuid);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      const result = await storage.calculateAndSaveInterest(loan.id);

      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'create',
        resource: 'interest_calculation',
        resourceId: uuid,
        details: `Calculated interest for loan ${uuid}: Monthly payment UGX ${result.monthlyPayment.toFixed(2)}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.json(result);
    } catch (error) {
      console.error("Error calculating interest:", error);
      return res.status(500).json({ message: "Failed to calculate interest" });
    }
  });

  app.get('/api/loans/:uuid/interest-calculations', isAuthenticated, async (req: any, res) => {
    try {
      const uuid = getRouteParam(req.params.uuid);
      // Get loan by UUID first to get the ID for legacy methods
      const loan = await storage.getLoanByUuid(uuid);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      const calculations = await storage.getInterestCalculations(loan.id);
      return res.json(calculations);
    } catch (error) {
      console.error("Error fetching interest calculations:", error);
      return res.status(500).json({ message: "Failed to fetch interest calculations" });
    }
  });

  app.post('/api/loans/:id/early-payment-calculation', isAuthenticated, async (req: any, res) => {
    try {
      const id = getRouteParam(req.params.id);
      const { paymentDate, amount } = req.body;
      
      const result = await storage.calculateEarlyPaymentSavings(
        await storage.resolveLoanId(id), 
        new Date(paymentDate), 
        parseFloat(amount)
      );

      res.json(result);
    } catch (error) {
      console.error("Error calculating early payment savings:", error);
      res.status(500).json({ message: "Failed to calculate early payment savings" });
    }
  });

  app.get('/api/payments/overdue', isAuthenticated, requirePermission('read', 'payments'), async (req: any, res) => {
    try {
      const overduePayments = await storage.getOverduePayments();
      res.json(overduePayments);
    } catch (error) {
      console.error("Error fetching overdue payments:", error);
      res.status(500).json({ message: "Failed to fetch overdue payments" });
    }
  });

  app.get('/api/payments/upcoming', isAuthenticated, requirePermission('read', 'payments'), async (req: any, res) => {
    try {
      const { days = 30 } = req.query;
      const upcomingPayments = await storage.getUpcomingPayments(parseInt(days as string));
      res.json(upcomingPayments);
    } catch (error) {
      console.error("Error fetching upcoming payments:", error);
      res.status(500).json({ message: "Failed to fetch upcoming payments" });
    }
  });

  // Notification API routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = user.id;
      const { isRead, type, priority, limit, page, search } = req.query;

      if (page || (limit && !isRead && !type && !priority)) {
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
        const result = await storage.getNotificationsPaginated(userId, pageNum, limitNum);
        return res.json(result);
      }
      
      const filters: any = {};
      if (isRead !== undefined) filters.isRead = isRead === 'true';
      if (type) filters.type = type;
      if (priority) filters.priority = priority;
      if (limit) filters.limit = parseInt(limit);

      const notifications = await storage.getNotifications(userId, filters);
      return res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get('/api/notifications/count', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = user.id;
      const count = await storage.getUnreadNotificationCount(userId);
      return res.json({ count });
    } catch (error) {
      console.error("Error fetching notification count:", error);
      return res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  // Test notification endpoint for demonstration
  app.post('/api/notifications/test', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = user.id;
      const member = await storage.getMemberByUserId(userId);
      
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      const notification = await storage.createNotification({
        type: 'system_alert',
        title: 'System Test Notification',
        message: 'This demonstrates the real-time notifications system with WebSocket support, filtering, and comprehensive management features.',
        priority: 'high',
        actionUrl: '/notifications',
        memberId: member.id,
        userId: userId,
        isRead: false
      });

      // Broadcast to WebSocket clients
      broadcastNotification(notification);

      return res.json(notification);
    } catch (error) {
      console.error("Error creating test notification:", error);
      return res.status(500).json({ message: "Failed to create test notification" });
    }
  });

  app.post('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = user.id;
      const validatedData = insertNotificationSchema.parse({
        ...req.body,
        userId
      });

      const notification = await storage.createNotification(validatedData);
      
      // Broadcast notification via WebSocket
      broadcastNotification(notification);
      
      return res.status(201).json(notification);
    } catch (error) {
      console.error("Error creating notification:", error);
      return res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = user.id;
      const notificationId = parseInt(getRouteParam(req.params.id));
      
      const notification = await storage.markNotificationAsRead(notificationId, userId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      return res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch('/api/notifications/read-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete('/api/notifications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = user.id;
      const notificationId = parseInt(getRouteParam(req.params.id));
      
      const deleted = await storage.deleteNotification(notificationId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      return res.json({ message: "Notification deleted" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      return res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Create HTTP server and WebSocket server
  const httpServer = createServer(app);
  
  // WebSocket server for real-time notifications
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients with their user IDs
  const clients = new Map<string, WebSocket>();
  
  wss.on('connection', (ws: WebSocket, request) => {
    console.log('WebSocket connection established');
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'authenticate' && data.userId) {
          // Store the connection with user ID
          clients.set(data.userId, ws);
          console.log(`User ${data.userId} authenticated via WebSocket`);
          
          ws.send(JSON.stringify({
            type: 'authenticated',
            message: 'WebSocket connection authenticated'
          }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      // Remove connection from clients map
      const entries = Array.from(clients.entries());
      for (const [userId, client] of entries) {
        if (client === ws) {
          clients.delete(userId);
          console.log(`User ${userId} disconnected from WebSocket`);
          break;
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  // Function to broadcast notifications to specific users
  function broadcastNotification(notification: any) {
    const client = clients.get(notification.userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
    }
  }

  // Function to broadcast data changes to ALL connected clients for real-time updates
  function broadcastDataUpdate(queryKeys: string[], excludeUserId?: string) {
    for (const [userId, client] of clients.entries()) {
      if (excludeUserId && userId === excludeUserId) continue;
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'data_update',
          queryKeys
        }));
      }
    }
  }
  
  // Helper function to create and broadcast notifications
  async function createAndBroadcastNotification(notificationData: any) {
    try {
      const notification = await storage.createNotification(notificationData);
      broadcastNotification(notification);
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }
  
  // Make functions available globally
  (global as any).broadcastNotification = broadcastNotification;
  (global as any).broadcastDataUpdate = broadcastDataUpdate;

  // Loan Types API endpoints
  app.get('/api/loan-types', isAuthenticated, requirePermission('read', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const loanTypes = await storage.getAllLoanTypes();
      res.json(loanTypes);
    } catch (error) {
      console.error('Error fetching loan types:', error);
      res.status(500).json({ message: 'Failed to fetch loan types' });
    }
  });

  // Public endpoint for active loan types (for loan applications)
  app.get('/api/loan-types/active', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const activeLoanTypes = await storage.getActiveLoanTypes();
      res.json(activeLoanTypes);
    } catch (error) {
      console.error('Error fetching active loan types:', error);
      res.status(500).json({ message: 'Failed to fetch active loan types' });
    }
  });

  app.get('/api/loan-types/:id', isAuthenticated, requirePermission('read', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const loanType = await storage.getLoanType(id);
      if (!loanType) {
        return res.status(404).json({ message: 'Loan type not found' });
      }
      return res.json(loanType);
    } catch (error) {
      console.error('Error fetching loan type:', error);
      return res.status(500).json({ message: 'Failed to fetch loan type' });
    }
  });

  app.post('/api/loan-types', isAuthenticated, requirePermission('create', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const body = { ...req.body };
      if (body.interestCalculationMethod && !body.interestType) {
        body.interestType = body.interestCalculationMethod;
        delete body.interestCalculationMethod;
      }
      if (body.minTermMonths !== undefined && body.minTerm === undefined) {
        body.minTerm = body.minTermMonths;
        delete body.minTermMonths;
      }
      if (body.maxTermMonths !== undefined && body.maxTerm === undefined) {
        body.maxTerm = body.maxTermMonths;
        delete body.maxTermMonths;
      }
      if (body.requiresGuarantors !== undefined && body.requiresGuarantor === undefined) {
        body.requiresGuarantor = body.requiresGuarantors;
        delete body.requiresGuarantors;
      }
      if (body.maxGuarantors !== undefined) {
        delete body.maxGuarantors;
      }
      if (body.processingFeePercentage !== undefined && body.processingFee === undefined) {
        body.processingFee = body.processingFeePercentage;
        delete body.processingFeePercentage;
      }
      const loanType = await storage.createLoanType(body);
      
      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req) || '',
        action: 'create',
        resource: 'loan_type',
        resourceId: loanType.id.toString(),
        details: `Created loan type: ${loanType.displayName}`,
      });

      res.status(201).json(loanType);
    } catch (error) {
      console.error('Error creating loan type:', error);
      res.status(500).json({ message: 'Failed to create loan type' });
    }
  });

  app.put('/api/loan-types/:id', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const body = { ...req.body };
      if (body.interestCalculationMethod && !body.interestType) {
        body.interestType = body.interestCalculationMethod;
        delete body.interestCalculationMethod;
      }
      if (body.minTermMonths !== undefined && body.minTerm === undefined) {
        body.minTerm = body.minTermMonths;
        delete body.minTermMonths;
      }
      if (body.maxTermMonths !== undefined && body.maxTerm === undefined) {
        body.maxTerm = body.maxTermMonths;
        delete body.maxTermMonths;
      }
      if (body.requiresGuarantors !== undefined && body.requiresGuarantor === undefined) {
        body.requiresGuarantor = body.requiresGuarantors;
        delete body.requiresGuarantors;
      }
      if (body.maxGuarantors !== undefined) {
        delete body.maxGuarantors;
      }
      if (body.processingFeePercentage !== undefined && body.processingFee === undefined) {
        body.processingFee = body.processingFeePercentage;
        delete body.processingFeePercentage;
      }
      const loanType = await storage.updateLoanType(id, body);
      
      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req) || '',
        action: 'update',
        resource: 'loan_type',
        resourceId: id.toString(),
        details: `Updated loan type: ${loanType.displayName}`,
      });

      res.json(loanType);
    } catch (error) {
      console.error('Error updating loan type:', error);
      res.status(500).json({ message: 'Failed to update loan type' });
    }
  });

  app.delete('/api/loan-types/:id', isAuthenticated, requirePermission('delete', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const loanType = await storage.getLoanType(id);
      if (!loanType) {
        return res.status(404).json({ message: 'Loan type not found' });
      }

      const success = await storage.deleteLoanType(id);
      if (!success) {
        return res.status(500).json({ message: 'Failed to delete loan type' });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req) || '',
        action: 'delete',
        resource: 'loan_type',
        resourceId: id.toString(),
        details: `Deleted loan type: ${loanType.displayName}`,
      });

      return res.json({ message: 'Loan type deleted successfully' });
    } catch (error) {
      console.error('Error deleting loan type:', error);
      return res.status(500).json({ message: 'Failed to delete loan type' });
    }
  });

  // Loan Terms API endpoints
  app.get('/api/loan-terms', isAuthenticated, requirePermission('read', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const { loanTypeId } = req.query;
      if (loanTypeId) {
        const terms = await storage.getLoanTermsByType(parseInt(loanTypeId as string));
        res.json(terms);
      } else {
        res.status(400).json({ message: 'loanTypeId query parameter is required' });
      }
    } catch (error) {
      console.error('Error fetching loan terms:', error);
      res.status(500).json({ message: 'Failed to fetch loan terms' });
    }
  });

  app.get('/api/loan-terms/:id', isAuthenticated, requirePermission('read', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const loanTerm = await storage.getLoanTerm(id);
      if (!loanTerm) {
        return res.status(404).json({ message: 'Loan term not found' });
      }
      return res.json(loanTerm);
    } catch (error) {
      console.error('Error fetching loan term:', error);
      return res.status(500).json({ message: 'Failed to fetch loan term' });
    }
  });

  app.post('/api/loan-terms', isAuthenticated, requirePermission('create', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const loanTerm = await storage.createLoanTerm(req.body);
      
      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req) || '',
        action: 'create',
        resource: 'loan_term',
        resourceId: loanTerm.id.toString(),
        details: `Created loan term: ${loanTerm.termName}`,
      });

      res.status(201).json(loanTerm);
    } catch (error) {
      console.error('Error creating loan term:', error);
      res.status(500).json({ message: 'Failed to create loan term' });
    }
  });

  app.put('/api/loan-terms/:id', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const loanTerm = await storage.updateLoanTerm(id, req.body);
      
      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req) || '',
        action: 'update',
        resource: 'loan_term',
        resourceId: id.toString(),
        details: `Updated loan term: ${loanTerm.termName}`,
      });

      res.json(loanTerm);
    } catch (error) {
      console.error('Error updating loan term:', error);
      res.status(500).json({ message: 'Failed to update loan term' });
    }
  });

  app.delete('/api/loan-terms/:id', isAuthenticated, requirePermission('delete', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const loanTerm = await storage.getLoanTerm(id);
      if (!loanTerm) {
        return res.status(404).json({ message: 'Loan term not found' });
      }

      const success = await storage.deleteLoanTerm(id);
      if (!success) {
        return res.status(500).json({ message: 'Failed to delete loan term' });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req) || '',
        action: 'delete',
        resource: 'loan_term',
        resourceId: id.toString(),
        details: `Deleted loan term: ${loanTerm.termName}`,
      });

      return res.json({ message: 'Loan term deleted successfully' });
    } catch (error) {
      console.error('Error deleting loan term:', error);
      return res.status(500).json({ message: 'Failed to delete loan term' });
    }
  });

  // Helper: sanitize cell value to prevent Excel formula injection
  function sanitizeCell(value: string): string {
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
      return "'" + value;
    }
    return value;
  }

  // Helper: get SACCO bank schedule settings
  async function getBankScheduleSettings() {
    const keys = ['saccoBankBranch', 'saccoBankAccount', 'saccoBankName', 'saccoSwiftCode', 'saccoAddress', 'saccoTown', 'saccoCustomerId', 'saccoCustomerDob'];
    const defaults: Record<string, string> = {
      saccoBankBranch: '253047',
      saccoBankAccount: '2201034044',
      saccoBankName: 'BIASHARA',
      saccoSwiftCode: 'KCBLUGKA',
      saccoAddress: '7 commercial plaza',
      saccoTown: 'Kamplala Uganda',
      saccoCustomerId: 'CM920321014GLG',
      saccoCustomerDob: '20210909',
    };
    const result = { ...defaults };
    for (const key of keys) {
      const setting = await storage.getSystemSetting(key);
      if (setting) result[key] = setting.settingValue;
    }
    return result;
  }

  // Helper: generate KCB bank schedule Excel workbook
  async function generateBankScheduleWorkbook(
    rows: Array<{ accountNumber: string; name: string; amount: number }>,
    sheetName: string,
    detailsPrefix: string,
    bankSettings: Record<string, string>,
    month: string
  ): Promise<Buffer> {
    const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const safeMonth = validMonths.includes(month) ? month : validMonths[new Date().getMonth()];

    const header = [
      '', 'SRC_BRANCH', 'DR_ACC', 'AC_NAME', 'CURR', 'AMOUNT',
      'DEST_BRANCH', 'CR_AC_NO', 'AC_NAME', 'CR_CURR', 'DETAILS_OF_PYT',
      'PAYMENT_TYPE', 'SWIFT_CODE', 'ORDERING_CUST_ADDRESS', 'ORDERING_CUST_TOWN',
      'ORDERING_CUST_IDNO', 'ORDERING_CUST_DOB'
    ];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);
    ws.addRow(header);

    for (const row of rows) {
      if (!row.accountNumber || row.amount <= 0) continue;
      ws.addRow([
        'P',
        parseInt(bankSettings.saccoBankBranch) || bankSettings.saccoBankBranch,
        sanitizeCell(row.accountNumber),
        sanitizeCell(row.name),
        'UGX',
        Math.round(row.amount),
        parseInt(bankSettings.saccoBankBranch) || bankSettings.saccoBankBranch,
        sanitizeCell(bankSettings.saccoBankAccount),
        sanitizeCell(bankSettings.saccoBankName),
        'UGX',
        `${safeMonth} ${detailsPrefix}`,
        'IT',
        sanitizeCell(bankSettings.saccoSwiftCode),
        sanitizeCell(bankSettings.saccoAddress),
        sanitizeCell(bankSettings.saccoTown),
        sanitizeCell(bankSettings.saccoCustomerId),
        sanitizeCell(bankSettings.saccoCustomerDob),
      ]);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // Download savings deduction schedule (Excel)
  app.get('/api/reports/savings-schedule', isAuthenticated, requirePermission('download', 'schedules'), async (req: any, res) => {
    try {
      const bankSettings = await getBankScheduleSettings();
      const month = (req.query.month as string) || new Date().toLocaleString('en-US', { month: 'short' });

      const activeMembers = await db.select().from(members)
        .where(inArray(members.status, ['active', 'inactive']));

      const rows = activeMembers
        .filter(m => parseFloat(m.monthlySavings || '0') > 0 && (m.accountNumber || m.staffAccountNumber))
        .map(m => ({
          accountNumber: m.accountNumber || m.staffAccountNumber || '',
          name: m.fullName || '',
          amount: parseFloat(m.monthlySavings || '0'),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const safeMonth = validMonths.includes(month) ? month : validMonths[new Date().getMonth()];
      const fileName = `BIASHARA_${safeMonth.toUpperCase()}_${new Date().getFullYear()}_SAVINGS_SCHEDULE.xlsx`;
      const buffer = await generateBankScheduleWorkbook(rows, `${safeMonth.toUpperCase()} SAVINGS`, 'Savings Deduction', bankSettings, safeMonth);

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error: any) {
      console.error('Error generating savings schedule:', error);
      res.status(500).json({ message: error.message || 'Failed to generate savings schedule' });
    }
  });

  // Download loan repayment schedule (Excel)
  app.get('/api/reports/loan-schedule', isAuthenticated, requirePermission('download', 'schedules'), async (req: any, res) => {
    try {
      const bankSettings = await getBankScheduleSettings();
      const month = (req.query.month as string) || new Date().toLocaleString('en-US', { month: 'short' });

      const activeLoans = await db.select({
        loanId: loans.id,
        loanNumber: loans.loanNumber,
        monthlyPayment: loans.monthlyPayment,
        outstandingBalance: loans.outstandingBalance,
        memberId: loans.memberId,
      }).from(loans)
        .where(inArray(loans.status, ['active', 'disbursed']));

      const rows: Array<{ accountNumber: string; name: string; amount: number }> = [];

      for (const loan of activeLoans) {
        const payment = parseFloat(loan.monthlyPayment || '0');
        if (payment <= 0) continue;

        const member = await storage.getMember(loan.memberId);
        if (!member) continue;

        const accountNumber = member.accountNumber || member.staffAccountNumber;
        if (!accountNumber) continue;

        rows.push({
          accountNumber,
          name: member.fullName || '',
          amount: payment,
        });
      }

      rows.sort((a, b) => a.name.localeCompare(b.name));

      const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const safeMonth = validMonths.includes(month) ? month : validMonths[new Date().getMonth()];
      const fileName = `BIASHARA_${safeMonth.toUpperCase()}_${new Date().getFullYear()}_LOAN_SCHEDULE.xlsx`;
      const buffer = await generateBankScheduleWorkbook(rows, `${safeMonth.toUpperCase()} LOAN`, 'Loan Deduction', bankSettings, safeMonth);

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error: any) {
      console.error('Error generating loan schedule:', error);
      res.status(500).json({ message: error.message || 'Failed to generate loan schedule' });
    }
  });

  // Member activity report
  app.get('/api/reports/member-activity', isAuthenticated, requirePermission('read', 'reports'), async (req: any, res) => {
    try {
      const allMembers = await db.select().from(members)
        .where(not(inArray(members.status, ['pending', 'rejected', 'exited'])));

      const savingsTotals = await db
        .select({
          memberId: savingsAccountsTable.memberId,
          total: sql<string>`COALESCE(SUM(${savingsAccountsTable.balance}::numeric), 0)`,
        })
        .from(savingsAccountsTable)
        .groupBy(savingsAccountsTable.memberId);
      const savingsMap = new Map(savingsTotals.map(s => [s.memberId, s.total]));

      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const activeCount = allMembers.filter(m => m.status === 'active').length;
      const inactiveCount = allMembers.filter(m => m.status === 'inactive').length;
      const dormantCount = allMembers.filter(m => m.status === 'dormant').length;
      const suspendedCount = allMembers.filter(m => m.status === 'suspended').length;

      const mapMember = (m: typeof allMembers[0]) => ({
        id: m.id,
        uuid: m.uuid,
        memberNumber: m.memberNumber,
        fullName: m.fullName,
        status: m.status,
        lastSavingsDate: m.lastSavingsDate,
        totalSavings: savingsMap.get(m.id) || '0',
        phoneNumber: m.phoneNumber,
        joinDate: m.joinDate,
        daysSinceLastSaving: m.lastSavingsDate
          ? Math.floor((now.getTime() - new Date(m.lastSavingsDate).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      });

      const inactiveMembers = allMembers
        .filter(m => m.status === 'inactive')
        .map(mapMember);

      const dormantMembers = allMembers
        .filter(m => m.status === 'dormant')
        .map(mapMember);

      const twoMonthsAgo = new Date(now);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const atRiskMembers = allMembers
        .filter(m => {
          if (m.status !== 'active') return false;
          const baseline = m.lastSavingsDate
            ? new Date(m.lastSavingsDate)
            : m.joinDate
            ? new Date(m.joinDate)
            : m.membershipStartDate
            ? new Date(m.membershipStartDate)
            : m.createdAt
            ? new Date(m.createdAt)
            : null;
          if (!baseline) return false;
          return baseline < twoMonthsAgo;
        })
        .map(mapMember);

      res.json({
        summary: {
          total: allMembers.length,
          active: activeCount,
          inactive: inactiveCount,
          dormant: dormantCount,
          suspended: suspendedCount,
          atRisk: atRiskMembers.length,
        },
        inactiveMembers,
        dormantMembers,
        atRiskMembers,
      });
    } catch (error: any) {
      console.error('Error fetching member activity report:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch member activity report' });
    }
  });

  app.get('/api/reports/reconciliation', isAuthenticated, requirePermission('read', 'reports'), async (req: any, res) => {
    try {
      const accountSums = await db
        .select({
          memberId: savingsAccountsTable.memberId,
          accountCount: sql<number>`COUNT(*)::int`,
          actualTotal: sql<string>`COALESCE(SUM(${savingsAccountsTable.balance}::numeric), 0)`,
        })
        .from(savingsAccountsTable)
        .groupBy(savingsAccountsTable.memberId);

      const allMembers = await db
        .select({
          id: members.id,
          uuid: members.uuid,
          fullName: members.fullName,
          memberNumber: members.memberNumber,
          totalSavings: members.totalSavings,
        })
        .from(members)
        .where(not(inArray(members.status, ['rejected', 'exited'])));

      const [operationalControlTotals, controlAccounts] = await Promise.all([
        db.execute(sql`
          SELECT
            (SELECT COALESCE(SUM(balance::numeric), 0) FROM savings_accounts WHERE status <> 'closed') AS savings,
            (SELECT COALESCE(SUM(share_capital::numeric), 0) FROM members WHERE status NOT IN ('rejected', 'exited')) AS shares,
            (SELECT COALESCE(SUM(outstanding_balance::numeric), 0) FROM loans WHERE status IN ('approved', 'active', 'disbursed', 'defaulted')) AS loans
        `),
        db.select().from(saccoAccounts).where(inArray(saccoAccounts.accountCode, ['1003', '2001', '2002'])),
      ]);
      const controlRows = (operationalControlTotals as any).rows || operationalControlTotals;
      const operationalTotals = controlRows[0] || {};
      const controlDefinitions = [
        { key: 'savings', label: 'Member Savings', accountCode: '2001' },
        { key: 'shares', label: 'Share Capital', accountCode: '2002' },
        { key: 'loans', label: 'Loan Portfolio', accountCode: '1003' },
      ];
      const controlReconciliation = controlDefinitions.map((definition) => {
        const account = controlAccounts.find((candidate) => candidate.accountCode === definition.accountCode);
        const operationalBalance = parseFloat(operationalTotals[definition.key] || '0');
        const journalBalance = parseFloat(account?.balance || '0');
        const difference = Math.round((journalBalance - operationalBalance) * 100) / 100;
        return {
          ...definition,
          operationalBalance: operationalBalance.toFixed(2),
          journalBalance: journalBalance.toFixed(2),
          difference: difference.toFixed(2),
          status: account && Math.abs(difference) < 0.01 ? 'matched' : 'discrepancy',
          message: account ? undefined : `Control account ${definition.accountCode} is not configured`,
        };
      });

      const accountMap = new Map(accountSums.map(a => [a.memberId, a]));

      const loanPaymentSums = await db
        .select({
          memberId: transactions.memberId,
          totalRepaid: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'loan_payment' AND ${transactions.status} = 'completed' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
          totalDisbursed: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'loan_disbursement' AND ${transactions.status} = 'completed' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
          txnCount: sql<number>`COUNT(*)::int`,
        })
        .from(transactions)
        .where(isNotNull(transactions.memberId))
        .groupBy(transactions.memberId);
      const loanTxMap = new Map(loanPaymentSums.map(t => [t.memberId, t]));

      const discrepancies: any[] = [];
      const matched: any[] = [];
      let totalDiscrepancyAmount = 0;

      for (const m of allMembers) {
        const acctData = accountMap.get(m.id);
        const actualTotal = parseFloat(acctData?.actualTotal || '0');
        const cachedTotal = parseFloat(m.totalSavings || '0');
        const difference = Math.round((cachedTotal - actualTotal) * 100) / 100;
        const loanTx = loanTxMap.get(m.id);
        const totalRepaid = parseFloat(loanTx?.totalRepaid || '0');
        const totalDisbursed = parseFloat(loanTx?.totalDisbursed || '0');

        const record = {
          accountId: m.id,
          accountNumber: acctData ? `${acctData.accountCount} account(s)` : 'No account',
          memberId: m.id,
          memberName: m.fullName || 'Unknown',
          memberNumber: m.memberNumber || '',
          currentBalance: cachedTotal.toFixed(2),
          totalCredits: actualTotal.toFixed(2),
          totalDebits: totalDisbursed.toFixed(2),
          expectedBalance: actualTotal.toFixed(2),
          difference: difference.toFixed(2),
          transactionCount: loanTx?.txnCount || 0,
          totalRepaid: totalRepaid.toFixed(2),
          status: Math.abs(difference) < 0.01 ? 'matched' : 'discrepancy',
        };

        if (Math.abs(difference) >= 0.01) {
          discrepancies.push(record);
          totalDiscrepancyAmount += Math.abs(difference);
        } else {
          matched.push(record);
        }
      }

      discrepancies.sort((a, b) => Math.abs(parseFloat(b.difference)) - Math.abs(parseFloat(a.difference)));

      res.json({
        summary: {
          totalAccounts: allMembers.length,
          matchedAccounts: matched.length,
          discrepancyAccounts: discrepancies.length,
          totalDiscrepancyAmount: totalDiscrepancyAmount.toFixed(2),
          controlDiscrepancies: controlReconciliation.filter((item) => item.status === 'discrepancy').length,
          reconciliationDate: new Date().toISOString(),
        },
        controlAccounts: controlReconciliation,
        discrepancies,
        matched,
      });
    } catch (error: any) {
      console.error('Error generating reconciliation report:', error);
      res.status(500).json({ message: error.message || 'Failed to generate reconciliation report' });
    }
  });

  app.post('/api/admin/run-seed', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      await seedAdminUser();
      await seedRBAC();
      await storage.seedDefaultSaccoAccounts();
      await storage.seedDefaultAccountMappings();
      await storage.upsertSystemSetting('seedCompleted', 'true');

      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'execute',
        resource: 'system-seed',
        details: 'Manual system seed executed: roles, permissions, default accounts, and account mappings synced.',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: "System seed completed successfully. Roles, permissions, and default accounts have been synced." });
    } catch (error: any) {
      console.error('Error running seed:', error);
      res.status(500).json({ message: error.message || 'Failed to run system seed' });
    }
  });

  app.post('/api/admin/sync-savings-totals', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const result = await storage.syncAllMemberTotalSavings();
      res.json({ message: `Successfully synced total savings for ${result.updated} members`, ...result });
    } catch (error: any) {
      console.error('Error syncing savings totals:', error);
      res.status(500).json({ message: error.message || 'Failed to sync savings totals' });
    }
  });

  app.post('/api/admin/recalculate-sacco-balances', isAuthenticated, requirePermission('update', 'sacco-accounts'), async (req: any, res) => {
    try {
      const result = await storage.recalculateSaccoAccountBalances();
      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'update',
        resource: 'sacco-account-balances',
        details: `${result.message}. Trial balance debits: ${result.totalDebits.toFixed(2)}, credits: ${result.totalCredits.toFixed(2)}, difference: ${result.difference.toFixed(2)}.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error recalculating SACCO balances:', error);
      res.status(500).json({ message: error.message || 'Failed to recalculate balances' });
    }
  });

  app.get('/api/reports/:reportType', isAuthenticated, async (req: any, res, next) => {
    const financialStatementTypes = ['trial-balance', 'balance-sheet', 'income-statement'];
    const reportType = getRouteParam(req.params.reportType);
    if (financialStatementTypes.includes(reportType)) {
      return next();
    }
    try {
      const { startDate, endDate, memberNumber, status } = req.query;
      const userId = getUserId(req);
      const reportUser = await storage.getUser(userId!);
      const reportMember = await storage.getMemberByUserId(userId!);
      const reportRoles = reportMember ? await storage.getMemberRoles(reportMember.id) : (reportUser?.role ? [reportUser.role] : []);
      const canAccessReports = reportRoles.some((r: string) => ['admin', 'manager', 'committee', 'treasurer'].includes(r));
      if (!canAccessReports) {
        return res.status(403).json({ message: "Access denied" });
      }

      let reportData;
      switch (reportType) {
        case 'members': {
          const allMembers = await storage.getAllMembers();
          let filtered = allMembers;
          if (status && status !== 'all') {
            filtered = filtered.filter((m: any) => m.status === status);
          }
          if (startDate) {
            const start = new Date(startDate as string);
            filtered = filtered.filter((m: any) => new Date(m.joinDate || m.createdAt) >= start);
          }
          if (endDate) {
            const end = new Date(endDate as string);
            filtered = filtered.filter((m: any) => new Date(m.joinDate || m.createdAt) <= end);
          }
          const memberReports = [];
          for (const m of filtered) {
            const savings = await storage.getSavingsAccountsByMember(m.id);
            const totalSavings = savings.reduce((sum: number, s: any) => sum + parseFloat(s.balance || '0'), 0);
            memberReports.push({
              memberNumber: m.memberNumber,
              fullName: m.fullName || `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim(),
              status: m.status,
              department: m.department || '-',
              joinDate: m.joinDate || m.createdAt,
              totalSavings: totalSavings.toFixed(2),
            });
          }
          reportData = memberReports;
          break;
        }
          
        case 'savings': {
          const allSavings = await storage.getAllSavingsAccounts();
          const savingsReports = [];
          for (const s of allSavings) {
            const member = await storage.getMember(s.memberId);
            const txns = await storage.getTransactionsBySavingsAccount(s.id);
            const lastTxn = txns.length > 0 ? txns[0] : null;
            savingsReports.push({
              accountNumber: s.accountNumber,
              memberName: member?.fullName || `${member?.user?.firstName || ''} ${member?.user?.lastName || ''}`.trim() || '-',
              accountType: s.accountType || 'regular',
              balance: s.balance,
              interestEarned: '0.00',
              lastTransaction: lastTxn ? lastTxn.createdAt : null,
            });
          }
          reportData = savingsReports;
          break;
        }
          
        case 'loans': {
          const allLoans = await storage.getAllLoans();
          let filtered = allLoans;
          if (status && status !== 'all') {
            filtered = filtered.filter((l: any) => l.status === status);
          }
          const loanReports = filtered.map((l: any) => ({
            loanNumber: l.loanNumber,
            memberName: l.member?.fullName || `${l.member?.user?.firstName || ''} ${l.member?.user?.lastName || ''}`.trim() || '-',
            principalAmount: l.principalAmount,
            outstandingBalance: l.outstandingBalance,
            interestRate: l.interestRate ? (parseFloat(l.interestRate) * 100).toFixed(1) + '%' : '-',
            status: l.status,
            termMonths: l.termMonths,
            createdAt: l.createdAt,
          }));
          reportData = loanReports;
          break;
        }
          
        case 'transactions': {
          let txns = await storage.getRecentTransactions(500);
          if (startDate) {
            const start = new Date(startDate as string);
            txns = txns.filter((t: any) => new Date(t.createdAt) >= start);
          }
          if (endDate) {
            const end = new Date(endDate as string);
            txns = txns.filter((t: any) => new Date(t.createdAt) <= end);
          }
          reportData = txns.map((t: any) => ({
            date: t.createdAt,
            referenceNumber: t.referenceNumber || '-',
            transactionType: t.transactionType,
            memberName: t.member?.fullName || `${t.member?.user?.firstName || ''} ${t.member?.user?.lastName || ''}`.trim() || '-',
            amount: t.amount,
            status: t.status,
            description: t.description || '-',
          }));
          break;
        }
          
        case 'financial': {
          const allSavingsAccts = await storage.getAllSavingsAccounts();
          const totalSavings = allSavingsAccts.reduce((sum: number, s: any) => sum + parseFloat(s.balance || '0'), 0);
          const allLoansData = await storage.getAllLoans();
          const loanPortfolio = allLoansData
            .filter((l: any) => ['active', 'disbursed', 'approved'].includes(l.status))
            .reduce((sum: number, l: any) => sum + parseFloat(l.outstandingBalance || '0'), 0);
          const allTxns = await storage.getRecentTransactions(10000);
          const totalInterestIncome = allTxns
            .filter((t: any) => t.transactionType === 'loan_payment')
            .reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
          const totalDisbursements = allTxns
            .filter((t: any) => t.transactionType === 'loan_disbursement')
            .reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);

          const now = new Date();
          const activeLoans = allLoansData.filter((l: any) => ['active', 'disbursed'].includes(l.status));
          const delinquentLoans = activeLoans.filter((l: any) => {
            const balance = parseFloat(l.outstandingBalance || '0');
            if (balance <= 1.00) return false;
            if (l.dueDate && new Date(l.dueDate) < now) return true;
            if (l.disbursementDate && l.termMonths) {
              const maturity = new Date(l.disbursementDate);
              maturity.setMonth(maturity.getMonth() + l.termMonths);
              if (maturity < now) return true;
            }
            return false;
          });
          const delinquentList = delinquentLoans.map((l: any) => {
            const balance = parseFloat(l.outstandingBalance || '0');
            const principal = parseFloat(l.principalAmount || '0');
            let daysOverdue = 0;
            if (l.dueDate) {
              daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(l.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
            } else if (l.disbursementDate && l.termMonths) {
              const maturity = new Date(l.disbursementDate);
              maturity.setMonth(maturity.getMonth() + l.termMonths);
              daysOverdue = Math.max(0, Math.floor((now.getTime() - maturity.getTime()) / (1000 * 60 * 60 * 24)));
            }
            let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
            if (daysOverdue > 180) riskLevel = 'critical';
            else if (daysOverdue > 90) riskLevel = 'high';
            else if (daysOverdue > 30) riskLevel = 'medium';

            return {
              loanNumber: l.loanNumber,
              memberName: l.member?.fullName || `${l.member?.user?.firstName || ''} ${l.member?.user?.lastName || ''}`.trim() || '-',
              memberNumber: l.member?.memberNumber || '-',
              principalAmount: principal.toFixed(2),
              outstandingBalance: balance.toFixed(2),
              dueDate: l.dueDate || null,
              disbursementDate: l.disbursementDate || null,
              daysOverdue,
              riskLevel,
              loanType: l.loanType || 'normal_loan',
              interestRate: l.interestRate ? (parseFloat(l.interestRate) * 100).toFixed(1) + '%' : '-',
            };
          }).sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

          const totalDelinquentAmount = delinquentLoans.reduce((sum: number, l: any) => sum + parseFloat(l.outstandingBalance || '0'), 0);

          reportData = {
            revenue: totalInterestIncome.toFixed(2),
            expenses: totalDisbursements.toFixed(2),
            netIncome: (totalInterestIncome - totalDisbursements).toFixed(2),
            loanPortfolio: loanPortfolio.toFixed(2),
            savingsTotal: totalSavings.toFixed(2),
            totalMembers: (await storage.getAllMembers()).length,
            activeLoans: activeLoans.length,
            totalDeposits: allTxns.filter((t: any) => t.transactionType === 'deposit').reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0).toFixed(2),
            totalWithdrawals: allTxns.filter((t: any) => t.transactionType === 'withdrawal').reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0).toFixed(2),
            delinquent: {
              count: delinquentLoans.length,
              totalAmount: totalDelinquentAmount.toFixed(2),
              delinquencyRate: activeLoans.length > 0 ? ((delinquentLoans.length / activeLoans.length) * 100).toFixed(1) : '0.0',
              loans: delinquentList,
            },
          };
          break;
        }
          
        case 'audit': {
          const auditLogs = await storage.getAuditLogs({ limit: 200 });
          reportData = auditLogs.map((log: any) => ({
            timestamp: log.timestamp,
            user: log.user?.username || log.userId || '-',
            action: log.action,
            resource: log.resource,
            details: log.details || '-',
            ipAddress: log.ipAddress || '-',
          }));
          break;
        }
          
        default:
          return res.status(400).json({ message: 'Unsupported report type' });
      }

      return res.json(reportData);
    } catch (error) {
      console.error("Error generating report:", error);
      return res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get('/api/reports/download/:reportType', isAuthenticated, async (req: any, res) => {
    try {
      const reportType = getRouteParam(req.params.reportType);
      const format = (req.query.format as string) || 'csv';
      const { startDate, endDate, memberNumber, status } = req.query;
      const userId = getUserId(req);
      const dlUser = await storage.getUser(userId!);
      const dlMember = await storage.getMemberByUserId(userId!);
      const dlRoles = dlMember ? await storage.getMemberRoles(dlMember.id) : (dlUser?.role ? [dlUser.role] : []);
      const canDl = dlRoles.some((r: string) => ['admin', 'manager', 'committee', 'treasurer'].includes(r));
      if (!canDl) return res.status(403).json({ message: "Access denied" });

      let rows: Record<string, any>[] = [];
      let headers: string[] = [];
      const filename = `${reportType}_report_${new Date().toISOString().slice(0,10)}`;

      switch (reportType) {
        case 'members': {
          const allMembers = await storage.getAllMembers();
          let filtered = allMembers;
          if (status && status !== 'all') filtered = filtered.filter((m: any) => m.status === status);
          if (startDate) { const s = new Date(startDate as string); filtered = filtered.filter((m: any) => new Date(m.joinDate || m.createdAt) >= s); }
          if (endDate) { const e = new Date(endDate as string); filtered = filtered.filter((m: any) => new Date(m.joinDate || m.createdAt) <= e); }
          headers = ['Member Number', 'Full Name', 'Status', 'Department', 'Join Date', 'Total Savings'];
          for (const m of filtered) {
            const savings = await storage.getSavingsAccountsByMember(m.id);
            const totalSavings = savings.reduce((sum: number, s: any) => sum + parseFloat(s.balance || '0'), 0);
            rows.push({
              'Member Number': m.memberNumber,
              'Full Name': m.fullName || `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim(),
              'Status': m.status,
              'Department': m.department || '',
              'Join Date': m.joinDate ? new Date(m.joinDate).toLocaleDateString() : '',
              'Total Savings': totalSavings.toFixed(2),
            });
          }
          break;
        }
        case 'savings': {
          const allSavings = await storage.getAllSavingsAccounts();
          headers = ['Account Number', 'Member Name', 'Account Type', 'Balance', 'Last Transaction'];
          for (const s of allSavings) {
            const member = await storage.getMember(s.memberId);
            const txns = await storage.getTransactionsBySavingsAccount(s.id);
            rows.push({
              'Account Number': s.accountNumber,
              'Member Name': member?.fullName || '',
              'Account Type': s.accountType || 'regular',
              'Balance': s.balance,
              'Last Transaction': txns.length > 0 && txns[0].createdAt ? new Date(txns[0].createdAt).toLocaleDateString() : '',
            });
          }
          break;
        }
        case 'loans': {
          const allLoans = await storage.getAllLoans();
          let filtered = allLoans;
          if (status && status !== 'all') filtered = filtered.filter((l: any) => l.status === status);
          headers = ['Loan Number', 'Member Name', 'Principal Amount', 'Outstanding Balance', 'Interest Rate', 'Term (Months)', 'Status', 'Created Date'];
          rows = filtered.map((l: any) => ({
            'Loan Number': l.loanNumber,
            'Member Name': l.member?.fullName || '',
            'Principal Amount': l.principalAmount,
            'Outstanding Balance': l.outstandingBalance,
            'Interest Rate': l.interestRate ? (parseFloat(l.interestRate) * 100).toFixed(1) + '%' : '',
            'Term (Months)': l.termMonths,
            'Status': l.status,
            'Created Date': l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '',
          }));
          break;
        }
        case 'transactions': {
          let txns = await storage.getRecentTransactions(500);
          if (startDate) { const s = new Date(startDate as string); txns = txns.filter((t: any) => new Date(t.createdAt) >= s); }
          if (endDate) { const e = new Date(endDate as string); txns = txns.filter((t: any) => new Date(t.createdAt) <= e); }
          headers = ['Date', 'Reference Number', 'Transaction Type', 'Member Name', 'Amount', 'Description'];
          rows = txns.map((t: any) => ({
            'Date': t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
            'Reference Number': t.referenceNumber || '',
            'Transaction Type': t.transactionType,
            'Member Name': t.member?.fullName || '',
            'Amount': t.amount,
            'Description': t.description || '',
          }));
          break;
        }
        case 'financial': {
          const allSavingsAccts = await storage.getAllSavingsAccounts();
          const totalSavings = allSavingsAccts.reduce((sum: number, s: any) => sum + parseFloat(s.balance || '0'), 0);
          const allLoansData = await storage.getAllLoans();
          const activeLoansData = allLoansData.filter((l: any) => ['active', 'disbursed'].includes(l.status));
          const loanPortfolio = allLoansData.filter((l: any) => ['active', 'disbursed', 'approved'].includes(l.status)).reduce((sum: number, l: any) => sum + parseFloat(l.outstandingBalance || '0'), 0);
          const allTxns = await storage.getRecentTransactions(10000);
          const totalRepayments = allTxns.filter((t: any) => t.transactionType === 'loan_payment').reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
          const totalDisbursements = allTxns.filter((t: any) => t.transactionType === 'loan_disbursement').reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
          const totalDeposits = allTxns.filter((t: any) => t.transactionType === 'deposit').reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
          const totalWithdrawals = allTxns.filter((t: any) => t.transactionType === 'withdrawal').reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
          headers = ['Metric', 'Value'];
          rows = [
            { 'Metric': 'Total Members', 'Value': (await storage.getAllMembers()).length },
            { 'Metric': 'Active Loans', 'Value': activeLoansData.length },
            { 'Metric': 'Total Savings', 'Value': totalSavings.toFixed(2) },
            { 'Metric': 'Loan Portfolio', 'Value': loanPortfolio.toFixed(2) },
            { 'Metric': 'Loan Repayments', 'Value': totalRepayments.toFixed(2) },
            { 'Metric': 'Disbursements', 'Value': totalDisbursements.toFixed(2) },
            { 'Metric': 'Net Position', 'Value': (totalRepayments - totalDisbursements).toFixed(2) },
            { 'Metric': 'Total Deposits', 'Value': totalDeposits.toFixed(2) },
            { 'Metric': 'Total Withdrawals', 'Value': totalWithdrawals.toFixed(2) },
          ];

          const now = new Date();
          const delinquentLoans = activeLoansData.filter((l: any) => {
            const bal = parseFloat(l.outstandingBalance || '0');
            if (bal <= 1.00) return false;
            if (l.dueDate && new Date(l.dueDate) < now) return true;
            if (l.disbursementDate && l.termMonths) { const m = new Date(l.disbursementDate); m.setMonth(m.getMonth() + l.termMonths); if (m < now) return true; }
            return false;
          });
          if (delinquentLoans.length > 0) {
            rows.push({ 'Metric': '', 'Value': '' });
            rows.push({ 'Metric': 'DELINQUENT LOANS', 'Value': '' });
            rows.push({ 'Metric': 'Delinquent Count', 'Value': delinquentLoans.length });
            rows.push({ 'Metric': 'Total Delinquent Amount', 'Value': delinquentLoans.reduce((s: number, l: any) => s + parseFloat(l.outstandingBalance || '0'), 0).toFixed(2) });
            rows.push({ 'Metric': 'Delinquency Rate', 'Value': activeLoansData.length > 0 ? ((delinquentLoans.length / activeLoansData.length) * 100).toFixed(1) + '%' : '0%' });
          }
          break;
        }
        case 'audit': {
          const auditLogs = await storage.getAuditLogs({ limit: 200 });
          headers = ['Timestamp', 'User', 'Action', 'Resource', 'Details', 'IP Address'];
          rows = auditLogs.map((log: any) => ({
            'Timestamp': log.timestamp ? new Date(log.timestamp).toLocaleString() : '',
            'User': log.user?.username || log.userId || '',
            'Action': log.action,
            'Resource': log.resource,
            'Details': log.details || '',
            'IP Address': log.ipAddress || '',
          }));
          break;
        }
        default:
          return res.status(400).json({ message: 'Unsupported report type' });
      }

      if (format === 'csv') {
        const escapeCsv = (val: any) => {
          const str = String(val ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        const csvLines = [headers.map(escapeCsv).join(',')];
        for (const row of rows) {
          csvLines.push(headers.map(h => escapeCsv(row[h])).join(','));
        }
        const csvContent = csvLines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send(csvContent);
      } else if (format === 'excel') {
        const sheetTitle = reportType.charAt(0).toUpperCase() + reportType.slice(1);
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet(sheetTitle);
        ws.addRow(headers);
        for (const row of rows) {
          ws.addRow(headers.map((h: string) => row[h] ?? ''));
        }
        headers.forEach((h: string, i: number) => {
          let maxLen = h.length;
          for (const row of rows) { const val = String(row[h] ?? ''); if (val.length > maxLen) maxLen = val.length; }
          ws.getColumn(i + 1).width = Math.min(maxLen + 2, 40);
        });
        const buf = await wb.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        return res.send(Buffer.from(buf));
      } else if (format === 'pdf') {
        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ size: 'A4', layout: headers.length > 5 ? 'landscape' : 'portrait', margin: 40 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        doc.pipe(res);

        const reportTitle = reportType.charAt(0).toUpperCase() + reportType.slice(1) + ' Report';
        doc.fontSize(18).font('Helvetica-Bold').text('Biashara SACCO', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(14).font('Helvetica').text(reportTitle, { align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(9).fillColor('#666666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#000000');

        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const colCount = headers.length;
        const colWidth = pageWidth / colCount;
        const startX = doc.page.margins.left;
        let y = doc.y;

        const drawHeaderRow = () => {
          const rowHeight = 22;
          doc.rect(startX, y, pageWidth, rowHeight).fill('#1a365d');
          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
          for (let i = 0; i < headers.length; i++) {
            const text = headers[i].length > 30 ? headers[i].substring(0, 28) + '..' : headers[i];
            doc.text(text, startX + (i * colWidth) + 3, y + 6, { width: colWidth - 6, lineBreak: false });
          }
          doc.fillColor('#000000');
          y += rowHeight;
        };

        drawHeaderRow();
        for (let i = 0; i < rows.length; i++) {
          const values = headers.map(h => String(rows[i][h] ?? ''));
          const rowHeight = 22;
          if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 20) {
            doc.addPage();
            y = doc.page.margins.top;
            drawHeaderRow();
          }
          const bgColor = i % 2 === 0 ? '#f8fafc' : '#ffffff';
          doc.rect(startX, y, pageWidth, rowHeight).fill(bgColor);
          doc.fillColor('#333333').font('Helvetica').fontSize(7.5);
          for (let j = 0; j < values.length; j++) {
            const text = values[j];
            const truncated = text.length > 30 ? text.substring(0, 28) + '..' : text;
            doc.text(truncated, startX + (j * colWidth) + 3, y + 6, { width: colWidth - 6, lineBreak: false });
          }
          doc.fillColor('#000000');
          y += rowHeight;
        }

        doc.moveDown(1);
        y = doc.y;
        if (y > doc.page.height - 60) { doc.addPage(); y = doc.page.margins.top; }
        doc.fontSize(8).fillColor('#999999').text(`Total Records: ${rows.length}`, startX, y);

        doc.end();
        return;
      }

      return res.status(400).json({ message: "Unsupported format" });
    } catch (error) {
      console.error("Error downloading report:", error);
      return res.status(500).json({ message: "Failed to download report" });
    }
  });

  // Data Import API endpoints
  const multer = await import('multer');
  const upload = multer.default({ dest: 'uploads/' });

  const loanDocUpload = multer.default({
    dest: 'uploads/loan-documents/',
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, Word documents, and images (JPEG/PNG) are allowed'));
      }
    },
  });

  const canAccessLoanDocs = async (userId: string, loanId: number): Promise<boolean> => {
    const loan = await storage.getLoan(loanId);
    return !!loan && await canAccessMemberLoans(storage, userId, loan.memberId);
  };

  app.post('/api/loans/:id/documents', isAuthenticated, loanAccess(req => req.params.id), loanDocUpload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Authentication required' });
      const loanId = parseInt(getRouteParam(req.params.id));
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid loan ID' });

      if (!(await canAccessLoanDocs(userId, loanId))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { documentType, guarantorId } = req.body;

      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      if (!documentType || !['loan_application', 'provident_commitment', 'guarantor_guarantee'].includes(documentType)) {
        return res.status(400).json({ message: 'Invalid document type' });
      }

      const [loan] = await db.select().from(loans).where(eq(loans.id, loanId));
      if (!loan) return res.status(404).json({ message: 'Loan not found' });

      if (documentType === 'guarantor_guarantee' && guarantorId) {
        const gId = parseInt(guarantorId);
        if (isNaN(gId)) return res.status(400).json({ message: 'Invalid guarantor ID' });
        const [guarantor] = await db.select().from(guarantors).where(eq(guarantors.id, gId));
        if (!guarantor || guarantor.loanId !== loanId) {
          return res.status(400).json({ message: 'Invalid guarantor for this loan' });
        }
      }

      const [doc] = await db.insert(loanDocuments).values({
        loanId,
        guarantorId: guarantorId ? parseInt(guarantorId) : null,
        documentType,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: userId,
      }).returning();

      return res.json(doc);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/loans/:id/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Authentication required' });
      const loanId = parseInt(getRouteParam(req.params.id));
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid loan ID' });

      if (!(await canAccessLoanDocs(userId, loanId))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const docs = await db.select().from(loanDocuments).where(eq(loanDocuments.loanId, loanId));
      return res.json(docs);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/loans/documents/:docId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Authentication required' });
      const docId = parseInt(getRouteParam(req.params.docId));
      if (isNaN(docId)) return res.status(400).json({ message: 'Invalid document ID' });

      const [doc] = await db.select().from(loanDocuments).where(eq(loanDocuments.id, docId));
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      if (!(await canAccessLoanDocs(userId, doc.loanId))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const fs = await import('fs');
      try { fs.unlinkSync(doc.filePath); } catch {}

      await db.delete(loanDocuments).where(eq(loanDocuments.id, docId));
      return res.json({ message: 'Document deleted' });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/loans/documents/:docId/download', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Authentication required' });
      const docId = parseInt(getRouteParam(req.params.docId));
      if (isNaN(docId)) return res.status(400).json({ message: 'Invalid document ID' });

      const [doc] = await db.select().from(loanDocuments).where(eq(loanDocuments.id, docId));
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      if (!(await canAccessLoanDocs(userId, doc.loanId))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const path = await import('path');
      return res.download(path.resolve(doc.filePath), doc.originalName);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/loans/documents/:docId/view', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Authentication required' });
      const docId = parseInt(getRouteParam(req.params.docId));
      if (isNaN(docId)) return res.status(400).json({ message: 'Invalid document ID' });

      const [doc] = await db.select().from(loanDocuments).where(eq(loanDocuments.id, docId));
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      if (!(await canAccessLoanDocs(userId, doc.loanId))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const path = await import('path');
      const resolved = path.resolve(doc.filePath);
      const mime = doc.mimeType || 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
      return res.sendFile(resolved);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/import/status/:jobId', isAuthenticated, (req: any, res) => {
    const job = importJobs.get(getRouteParam(req.params.jobId));
    if (!job) {
      return res.status(404).json({ message: 'Import job not found' });
    }
    const currentUserId = getUserId(req);
    if (job.userId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    return res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      processedSheets: job.processedSheets,
      totalSheets: job.totalSheets,
      importedMembers: job.importedMembers,
      importedAccounts: job.importedAccounts,
      result: job.result,
      error: job.error,
    });
  });

  app.post('/api/import/savings', isAuthenticated, requirePermission('execute', 'import-savings'), upload.single('file'), async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required' });
    const job = createImportJob(userId);
    const filePath = req.file ? req.file.path : './attached_assets/savings_1772043613995.xlsx';
    const createNewMembers = req.body?.createNewMembers !== 'false';

    (async () => {
      try {
        const { importSavingsFromExcel } = await import('../importUtils');
        job.status = 'processing';
        job.stage = 'Processing file...';
        job.progress = 5;

        console.log('Starting import from:', filePath, '| createNewMembers:', createNewMembers);
        const result = await importSavingsFromExcel(filePath, { createNewMembers, userId, onJournalEntry: recordJournalEntry, onProgress: (info: any) => {
          if (info.totalSheets) job.totalSheets = info.totalSheets;
          if (info.processedSheets !== undefined) job.processedSheets = info.processedSheets;
          if (info.importedMembers !== undefined) job.importedMembers = info.importedMembers;
          if (info.importedAccounts !== undefined) job.importedAccounts = info.importedAccounts;
          if (info.stage) job.stage = info.stage;
          if (job.totalSheets > 0) {
            job.progress = Math.min(95, Math.round((job.processedSheets / job.totalSheets) * 95));
          }
        }});

        await storage.createAuditLog({
          userId: userId || '',
          action: 'import',
          resource: 'savings_accounts',
          resourceId: 'bulk_import',
          details: `Imported ${result.importedMembers} members and ${result.importedAccounts} savings accounts. ${result.errors?.length || 0} errors.`,
        });

        broadcastDataUpdate(['/api/members', '/api/savings', '/api/transactions', '/api/dashboard', '/api/sacco-accounts', '/api/sacco-journal-entries']);
        job.status = 'complete';
        job.progress = 100;
        job.stage = 'Complete!';
        job.result = result;
        job.completedAt = new Date();
      } catch (error) {
        console.error('Error importing savings data:', error);
        job.status = 'error';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.stage = 'Failed';
        job.completedAt = new Date();
      } finally {
        if (req.file) {
          const fs = await import('fs');
          try { await fs.promises.unlink(req.file.path); } catch (e) {}
        }
      }
    })();
    return res.json({ jobId: job.id, message: 'Import started' });
  });

  app.post('/api/import/members', isAuthenticated, requirePermission('execute', 'import-members'), upload.single('file'), async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required' });
    const job = createImportJob(userId);
    const filePath = req.file ? req.file.path : './attached_assets/members_1772094048114.xlsx';
    const updateExisting = req.body?.updateExisting === 'true';

    (async () => {
      try {
        const { importMembersFromExcel } = await import('../importUtils');
        job.status = 'processing';
        job.stage = 'Processing members...';
        job.progress = 5;

        console.log('Starting member import from:', filePath, '| updateExisting:', updateExisting);
        const result = await importMembersFromExcel(filePath, { userId, updateExisting });

        await storage.createAuditLog({
          userId: userId || '',
          action: 'import',
          resource: 'members',
          resourceId: 'bulk_import',
          details: `Imported ${result.importedMembers} members and ${result.importedAccounts} savings accounts. ${result.errors?.length || 0} errors.`,
        });

        broadcastDataUpdate(['/api/members', '/api/savings', '/api/dashboard']);
        job.status = 'complete';
        job.progress = 100;
        job.stage = 'Complete!';
        job.result = result;
        job.completedAt = new Date();
      } catch (error) {
        console.error('Error importing member data:', error);
        job.status = 'error';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.stage = 'Failed';
        job.completedAt = new Date();
      } finally {
        if (req.file) {
          const fs = await import('fs');
          try { await fs.promises.unlink(req.file.path); } catch (e) {}
        }
      }
    })();
    return res.json({ jobId: job.id, message: 'Import started' });
  });

  app.post('/api/import/loans', isAuthenticated, requirePermission('execute', 'import-loans'), upload.single('file'), async (req: any, res) => {
    const filePath = req.file ? req.file.path : '';
    const loanTypeId = req.body?.loanTypeId ? parseInt(req.body.loanTypeId) : undefined;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    if (!filePath) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const job = createImportJob(userId);
    (async () => {
      try {
        const { importLoansFromExcel } = await import('../importUtils');
        job.status = 'processing';
        job.stage = 'Processing loans...';
        job.progress = 5;

        console.log('Starting loan import from:', filePath, 'with loanTypeId:', loanTypeId || 'auto-detect');
        const result = await importLoansFromExcel(filePath, { userId, loanTypeId, onJournalEntry: recordJournalEntry });

        await storage.createAuditLog({
          userId: userId || '',
          action: 'import',
          resource: 'loans',
          resourceId: 'bulk_import',
          details: `Imported ${result.importedLoans || 0} loans. ${result.errors?.length || 0} errors.`,
        });

        broadcastDataUpdate(['/api/loans', '/api/dashboard', '/api/sacco-accounts', '/api/sacco-journal-entries']);
        job.status = 'complete';
        job.progress = 100;
        job.stage = 'Complete!';
        job.result = result;
        job.completedAt = new Date();
      } catch (error) {
        console.error('Error importing loan data:', error);
        job.status = 'error';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.stage = 'Failed';
        job.completedAt = new Date();
      } finally {
        if (req.file) {
          const fs = await import('fs');
          try { await fs.promises.unlink(req.file.path); } catch (e) {}
        }
      }
    })();
    return res.json({ jobId: job.id, message: 'Import started' });
  });

  app.post('/api/import/loan-repayments', isAuthenticated, requirePermission('execute', 'import-loan-repayments'), upload.single('file'), async (req: any, res) => {
    const filePath = req.file ? req.file.path : null;
    if (!filePath) return res.status(400).json({ message: 'No file uploaded' });

    const cleanupFile = async () => {
      if (req.file) {
        const fs = await import('fs');
        try { await fs.promises.unlink(filePath!); } catch (e) {}
      }
    };

    const loanTypeId = req.body?.loanTypeId ? parseInt(req.body.loanTypeId) : null;
    if (!loanTypeId) { await cleanupFile(); return res.status(400).json({ message: 'Loan type is required for loan repayment imports' }); }

    const loanType = await storage.getLoanType(loanTypeId);
    if (!loanType) { await cleanupFile(); return res.status(400).json({ message: 'Invalid loan type selected' }); }

    const userId = getUserId(req);
    if (!userId) { await cleanupFile(); return res.status(401).json({ message: 'Authentication required' }); }
    const job = createImportJob(userId);
    (async () => {
      try {
        job.status = 'processing';
        job.stage = 'Processing loan repayments...';
        job.progress = 5;

        const fs = await import('fs');
        const csvContent = await fs.promises.readFile(filePath, 'utf-8');
        let lines: string[][];
        try {
          lines = parseBankImportCsv(csvContent);
        } catch (parseError) {
          const message = parseError instanceof Error ? parseError.message : 'Invalid CSV syntax';
          const result = createImportFailureResult(`CSV parsing failed: ${message}`);
          job.status = 'error';
          job.error = result.errors[0].error;
          job.stage = 'Failed';
          job.result = result;
          job.completedAt = new Date();
          return;
        }

        if (lines.length < 3) {
          const result = createImportFailureResult('CSV file has insufficient rows');
          job.status = 'error';
          job.error = result.errors[0].error;
          job.stage = 'Failed';
          job.result = result;
          job.completedAt = new Date();
          return;
        }

        const sanitize = (val: string | undefined) =>
          (val || '').replace(/[\t\r\n\x00-\x1F\x7F\uFEFF]/g, '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
        const sanitizeAmount = (val: string | undefined) =>
          (val || '').replace(/[\t\r\n\x00-\x1F\x7F\uFEFF"'\s]/g, '').replace(/,/g, '');

        const allMembers = await storage.getAllMembers();
        const existingTxns = await storage.getRecentTransactions(10000);
        const existingRefs = new Set(existingTxns.filter((t: any) => t.referenceNumber).map((t: any) => t.referenceNumber));
        const userId = getUserId(req)!;
        const errors: ImportFailure[] = [];
        let successCount = 0;
        let totalAmount = 0;
        let skippedNoMember = 0;
        let skippedNoLoan = 0;
        const totalRows = lines.length - 2;

        for (let i = 2; i < lines.length; i++) {
          try {
            const cols = lines[i].map(c => sanitize(c));
             if (cols.length < 12) {
               errors.push({ row: i + 1, category: 'invalid_row', error: 'Insufficient columns' });
               continue;
             }

            const txStatus = cols[6].toLowerCase();
            if (txStatus && txStatus !== 'success') {
               errors.push({
                 row: i + 1,
                 category: 'transaction_rejected',
                 error: `Transaction status: ${txStatus}`,
                 data: { remitterAccount: cols[10], reference: cols[7], amount: cols[9] },
               });
              continue;
            }

            const remitterAccount = cols[10];
            const amount = parseFloat(sanitizeAmount(cols[9]) || '0');
            const reference = cols[7];
            const description = cols[11] || 'Loan Repayment';

            if (!remitterAccount || amount <= 0) {
               errors.push({
                 row: i + 1,
                 category: 'invalid_row',
                 error: 'Missing account number or invalid amount',
                 data: { remitterAccount, reference, amount: cols[9], description },
               });
              continue;
            }

            if (reference && existingRefs.has(reference)) {
               errors.push({
                 row: i + 1,
                 category: 'duplicate_reference',
                 error: `Duplicate reference: ${reference}`,
                 data: { remitterAccount, reference, amount, description },
               });
              continue;
            }

            const member = allMembers.find((m: any) => {
              const staffAcc = sanitize(m.staffAccountNumber);
              const accNum = sanitize(m.accountNumber);
              const idNum = sanitize(m.idNumber);
              return (staffAcc && staffAcc === remitterAccount) ||
                (accNum && accNum === remitterAccount) ||
                (idNum && idNum === remitterAccount);
            });

            if (!member) {
              skippedNoMember++;
               errors.push({
                 row: i + 1,
                 category: 'unmatched_member',
                 error: `No member found for account: ${remitterAccount}`,
                 data: { remitterAccount, reference, amount, description },
               });
              continue;
            }

            const activeLoans = await storage.getMemberActiveLoans(member.id);
            const matchingLoan = activeLoans.find((l: any) => 
              (l.loanType === loanType.name || l.loanType === loanType.displayName || l.loanTypeId === loanTypeId)
              && (l.status === 'active' || l.status === 'disbursed')
            );
            if (!matchingLoan) {
              skippedNoLoan++;
               errors.push({
                 row: i + 1,
                 category: 'unmatched_loan',
                 error: `No active ${loanType.displayName} loan for member: ${member.fullName} (${member.memberNumber})`,
                 data: { remitterAccount, memberNumber: member.memberNumber, reference, amount, description },
               });
              continue;
            }

            const loan = matchingLoan;
            const outstandingBalance = parseFloat(loan.outstandingBalance || '0');
            const repaymentAmount = Math.min(amount, outstandingBalance);

            if (repaymentAmount <= 0) {
               errors.push({
                 row: i + 1,
                 category: 'fully_paid_loan',
                 error: `Loan already fully paid for ${member.fullName}`,
                 data: { remitterAccount, memberNumber: member.memberNumber, reference, amount, description },
               });
              continue;
            }

            const savingsAccounts = await storage.getSavingsAccountsByMember(member.id);
            const savingsAccount = savingsAccounts.find((s: any) => s.accountType === 'regular') || savingsAccounts[0];

            const importRef = reference || `IMP-LR-${Date.now()}-${i}`;
            const split = await splitLoanRepayment(loan, repaymentAmount, outstandingBalance);
            await storage.runSaccoLedgerTransaction(async (tx) => {
              const newBalance = Math.max(0, outstandingBalance - split.balanceReduction);
              await tx.update(loans).set({
                outstandingBalance: newBalance.toFixed(2),
                status: newBalance <= 0 ? 'completed' : loan.status,
                updatedAt: new Date(),
              }).where(eq(loans.id, loan.id));
              await tx.insert(transactions).values({
                memberId: member.id, savingsAccountId: savingsAccount?.id || null, loanId: loan.id,
                transactionType: 'loan_payment', amount: repaymentAmount.toFixed(2), description,
                referenceNumber: importRef, processedBy: userId, status: 'completed',
                metadata: JSON.stringify({ interest: split.interestPortion, principalRepyt: split.principalPortion, balanceReduction: split.balanceReduction, source: 'repayment_import' }),
              });
              await postLoanRepaymentJournals(loan, split.interestPortion, split.principalPortion, `Imported loan repayment - ${member.memberNumber}`, importRef, userId, tx);
              if (['inactive', 'dormant'].includes(member.status ?? '')) {
                await tx.update(members).set({
                status: 'active' as any,
                lastActivityDate: new Date(),
                isActiveSaver: true,
                updatedAt: new Date(),
                }).where(eq(members.id, member.id));
              }
            });

            if (reference) existingRefs.add(reference);
            successCount++;
            totalAmount += repaymentAmount;
          } catch (rowError: any) {
             errors.push({
               row: i + 1,
               category: 'processing_error',
               error: rowError.message || 'Unknown error',
             });
          }
          job.progress = Math.min(95, Math.round(((i - 1) / totalRows) * 95));
          job.stage = `Processing row ${i - 1} of ${totalRows}...`;
        }

        await storage.createAuditLog({
          userId,
          action: 'import',
          resource: 'loan_repayments',
          details: `Bulk loan repayment import (${loanType.displayName}): ${successCount} payments totaling UGX ${totalAmount.toLocaleString()}. ${errors.length} errors. ${skippedNoMember} unmatched accounts. ${skippedNoLoan} no matching loan.`,
        });

        broadcastDataUpdate(['/api/loans', '/api/transactions', '/api/dashboard', '/api/savings', '/api/sacco-accounts', '/api/sacco-journal-entries']);

        job.status = 'complete';
        job.progress = 100;
        job.stage = 'Complete!';
        const failureSummary = summarizeImportFailures(errors);
        job.result = {
          success: errors.length === 0,
          totalRows,
          successfulImports: successCount,
          totalAmount,
          skippedNoMember,
          importedMembers: 0,
          importedAccounts: 0,
          skippedNoLoan,
          skippedDuplicates: errors.filter(error => error.category === 'duplicate_reference').length,
          ...failureSummary,
          errors,
        };
        job.completedAt = new Date();
      } catch (error) {
        console.error('Error importing loan repayments:', error);
        job.status = 'error';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.stage = 'Failed';
        job.completedAt = new Date();
      } finally {
        if (req.file) {
          const fs = await import('fs');
          try { await fs.promises.unlink(filePath); } catch (e) {}
        }
      }
    })();
    return res.json({ jobId: job.id, message: 'Import started' });
  });

  app.post('/api/import/bulk-savings', isAuthenticated, requirePermission('execute', 'import-bulk-savings'), upload.single('file'), async (req: any, res) => {
    const filePath = req.file ? req.file.path : null;
    if (!filePath) return res.status(400).json({ message: 'No file uploaded' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required' });
    const job = createImportJob(userId);
    (async () => {
      try {
        job.status = 'processing';
        job.stage = 'Processing savings deposits...';
        job.progress = 5;

        const fs = await import('fs');
        const csvContent = await fs.promises.readFile(filePath, 'utf-8');
        let lines: string[][];
        try {
          lines = parseBankImportCsv(csvContent);
        } catch (parseError) {
          const message = parseError instanceof Error ? parseError.message : 'Invalid CSV syntax';
          const result = createImportFailureResult(`CSV parsing failed: ${message}`);
          job.status = 'error';
          job.error = result.errors[0].error;
          job.stage = 'Failed';
          job.result = result;
          job.completedAt = new Date();
          return;
        }

        if (lines.length < 3) {
          const result = createImportFailureResult('CSV file has insufficient rows');
          job.status = 'error';
          job.error = result.errors[0].error;
          job.stage = 'Failed';
          job.result = result;
          job.completedAt = new Date();
          return;
        }

        const sanitize = (val: string | undefined) =>
          (val || '').replace(/[\t\r\n\x00-\x1F\x7F\uFEFF]/g, '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
        const sanitizeAmount = (val: string | undefined) =>
          (val || '').replace(/[\t\r\n\x00-\x1F\x7F\uFEFF"'\s]/g, '').replace(/,/g, '');

        const allMembers = await storage.getAllMembers();
        const existingTxns = await storage.getRecentTransactions(10000);
        const existingRefs = new Set(existingTxns.filter((t: any) => t.referenceNumber).map((t: any) => t.referenceNumber));
        const userId = getUserId(req)!;
        const errors: ImportFailure[] = [];
        let successCount = 0;
        let totalAmount = 0;
        let skippedNoMember = 0;
        const totalRows = lines.length - 2;

        for (let i = 2; i < lines.length; i++) {
          try {
            const cols = lines[i].map(c => sanitize(c));
             if (cols.length < 12) {
               errors.push({ row: i + 1, category: 'invalid_row', error: 'Insufficient columns' });
               continue;
             }

            const txStatus = cols[6].toLowerCase();
            if (txStatus && txStatus !== 'success') {
               errors.push({
                 row: i + 1,
                 category: 'transaction_rejected',
                 error: `Transaction status: ${txStatus}`,
                 data: { remitterAccount: cols[10], reference: cols[7], amount: cols[9] },
               });
              continue;
            }

            const remitterAccount = cols[10];
            const amount = parseFloat(sanitizeAmount(cols[9]) || '0');
            const reference = cols[7];
            const description = cols[11] || 'Savings Deposit';

            if (!remitterAccount || amount <= 0) {
               errors.push({
                 row: i + 1,
                 category: 'invalid_row',
                 error: 'Missing account number or invalid amount',
                 data: { remitterAccount, reference, amount: cols[9], description },
               });
              continue;
            }

            if (reference && existingRefs.has(reference)) {
               errors.push({
                 row: i + 1,
                 category: 'duplicate_reference',
                 error: `Duplicate reference: ${reference}`,
                 data: { remitterAccount, reference, amount, description },
               });
              continue;
            }

            const member = allMembers.find((m: any) => {
              const staffAcc = sanitize(m.staffAccountNumber);
              const accNum = sanitize(m.accountNumber);
              const idNum = sanitize(m.idNumber);
              return (staffAcc && staffAcc === remitterAccount) ||
                (accNum && accNum === remitterAccount) ||
                (idNum && idNum === remitterAccount);
            });

            if (!member) {
              skippedNoMember++;
               errors.push({
                 row: i + 1,
                 category: 'unmatched_member',
                 error: `No member found for account: ${remitterAccount}`,
                 data: { remitterAccount, reference, amount, description },
               });
              continue;
            }

            const savingsAccounts = await storage.getSavingsAccountsByMember(member.id);
            let savingsAccount = savingsAccounts.find((s: any) => s.accountType === 'regular') || savingsAccounts[0];

            if (!savingsAccount) {
               errors.push({
                 row: i + 1,
                 category: 'missing_savings_account',
                 error: `No savings account for member: ${member.fullName} (${member.memberNumber})`,
                 data: { remitterAccount, memberNumber: member.memberNumber, reference, amount, description },
               });
              continue;
            }

            const importUpdateFields: any = {
              lastSavingsDate: new Date(),
              lastActivityDate: new Date(),
              isActiveSaver: true,
            };
            if (['inactive', 'dormant'].includes(member.status ?? '')) {
              importUpdateFields.status = 'active';
            }
            const importRef = reference || `IMP-SD-${Date.now()}-${i}`;
            await storage.runSaccoLedgerTransaction(async (tx) => {
              await tx.update(savingsAccountsTable).set({
                balance: sql`${savingsAccountsTable.balance} + ${amount.toFixed(2)}`,
                updatedAt: new Date(),
              }).where(eq(savingsAccountsTable.id, savingsAccount.id));
              await tx.insert(transactions).values({
                memberId: member.id, savingsAccountId: savingsAccount.id, transactionType: 'deposit',
                amount: amount.toFixed(2), description, referenceNumber: importRef,
                processedBy: userId, status: 'completed',
              });
              await tx.update(members).set(importUpdateFields).where(eq(members.id, member.id));
              await recordJournalEntry('member_deposit', amount, `Imported savings deposit - ${member.memberNumber}`, importRef, userId, tx);
            });

            if (reference) existingRefs.add(reference);
            successCount++;
            totalAmount += amount;
          } catch (rowError: any) {
             errors.push({
               row: i + 1,
               category: 'processing_error',
               error: rowError.message || 'Unknown error',
             });
          }
          job.progress = Math.min(95, Math.round(((i - 1) / totalRows) * 95));
          job.stage = `Processing row ${i - 1} of ${totalRows}...`;
        }

        await storage.createAuditLog({
          userId,
          action: 'import',
          resource: 'bulk_savings',
          details: `Bulk savings deposit import: ${successCount} deposits totaling UGX ${totalAmount.toLocaleString()}. ${errors.length} errors. ${skippedNoMember} unmatched accounts.`,
        });

        broadcastDataUpdate(['/api/savings', '/api/transactions', '/api/dashboard', '/api/members', '/api/sacco-accounts', '/api/sacco-journal-entries']);

        job.status = 'complete';
        job.progress = 100;
        job.stage = 'Complete!';
        const failureSummary = summarizeImportFailures(errors);
        job.result = {
          success: errors.length === 0,
          totalRows,
          successfulImports: successCount,
          totalAmount,
          skippedNoMember,
          importedMembers: 0,
          importedAccounts: 0,
          skippedDuplicates: errors.filter(error => error.category === 'duplicate_reference').length,
          ...failureSummary,
          errors,
        };
        job.completedAt = new Date();
      } catch (error) {
        console.error('Error importing bulk savings:', error);
        job.status = 'error';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.stage = 'Failed';
        job.completedAt = new Date();
      } finally {
        if (req.file) {
          const fs = await import('fs');
          try { await fs.promises.unlink(filePath); } catch (e) {}
        }
      }
    })();
    return res.json({ jobId: job.id, message: 'Import started' });
  });

  // ===== INTEREST CALCULATIONS ROUTES =====

  // Financial Years management
  app.get('/api/financial-years', isAuthenticated, async (req, res) => {
    try {
      const financialYears = await storage.getAllFinancialYears();
      res.json(financialYears);
    } catch (error) {
      console.error('Error fetching financial years:', error);
      res.status(500).json({ message: 'Failed to fetch financial years' });
    }
  });

  app.get('/api/financial-years/active', isAuthenticated, async (req, res) => {
    try {
      const activeYear = await storage.getActiveFinancialYear();
      res.json(activeYear);
    } catch (error) {
      console.error('Error fetching active financial year:', error);
      res.status(500).json({ message: 'Failed to fetch active financial year' });
    }
  });

  app.post('/api/financial-years', isAuthenticated, requirePermission('create', 'financial-years'), async (req, res) => {
    try {
      const { yearLabel, startDate, endDate } = req.body;

      const existingYears = await storage.getAllFinancialYears();

      const labelMatch = existingYears.find((fy: any) => fy.yearLabel === yearLabel);
      if (labelMatch) {
        return res.status(400).json({ message: `A financial year with the label "${yearLabel}" already exists` });
      }

      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      const overlapMatch = existingYears.find((fy: any) => {
        const fyStart = new Date(fy.startDate);
        const fyEnd = new Date(fy.endDate);
        return newStart <= fyEnd && newEnd >= fyStart;
      });
      if (overlapMatch) {
        return res.status(400).json({ message: `Date range overlaps with existing financial year "${overlapMatch.yearLabel}" (${overlapMatch.startDate} to ${overlapMatch.endDate})` });
      }

      const financialYear = await storage.createFinancialYear(req.body);
      return res.status(201).json(financialYear);
    } catch (error) {
      console.error('Error creating financial year:', error);
      return res.status(500).json({ message: 'Failed to create financial year' });
    }
  });

  app.put('/api/financial-years/:id/activate', isAuthenticated, requirePermission('create', 'financial-years'), async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const financialYear = await storage.setActiveFinancialYear(id);
      res.json(financialYear);
    } catch (error) {
      console.error('Error activating financial year:', error);
      res.status(500).json({ message: 'Failed to activate financial year' });
    }
  });

  // Balance snapshots
  app.post('/api/balance-snapshots/create-all', isAuthenticated, requirePermission('create', 'balance-snapshots'), async (req, res) => {
    try {
      const { financialYearId, snapshotDate } = req.body;
      const snapshots = await storage.createBalanceSnapshotsForAllAccounts(financialYearId, snapshotDate);
      res.status(201).json(snapshots);
    } catch (error) {
      console.error('Error creating balance snapshots:', error);
      res.status(500).json({ message: 'Failed to create balance snapshots' });
    }
  });

  // Interest calculations
  app.get('/api/interest-calculations', isAuthenticated, async (req, res) => {
    try {
      const financialYearId = req.query.financialYearId ? parseInt(req.query.financialYearId as string) : undefined;
      const calculations = await storage.getInterestCalculations(financialYearId);
      res.json(calculations);
    } catch (error) {
      console.error('Error fetching interest calculations:', error);
      res.status(500).json({ message: 'Failed to fetch interest calculations' });
    }
  });

  app.post('/api/interest-calculations/calculate-all', isAuthenticated, requirePermission('create', 'interest-calculations'), async (req, res) => {
    try {
      const { financialYearId } = req.body;
      const calculations = await storage.calculateInterestForAllMembers(financialYearId);
      res.status(201).json(calculations);
    } catch (error) {
      console.error('Error calculating interest for all members:', error);
      res.status(500).json({ message: 'Failed to calculate interest' });
    }
  });

  app.post('/api/interest-calculations/calculate-member', isAuthenticated, requirePermission('create', 'interest-calculations'), async (req, res) => {
    try {
      const { memberId, financialYearId } = req.body;
      const calculation = await storage.calculateInterestForMember(memberId, financialYearId);
      res.status(201).json(calculation);
    } catch (error) {
      console.error('Error calculating interest for member:', error);
      res.status(500).json({ message: 'Failed to calculate interest for member' });
    }
  });

  app.put('/api/interest-calculations/:id/approve', isAuthenticated, requirePermission('post', 'interest-calculations'), async (req: any, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const approvedBy = getUserId(req)!;
      const calculation = await storage.approveInterestCalculation(id, approvedBy);
      res.json(calculation);
    } catch (error) {
      console.error('Error approving interest calculation:', error);
      res.status(500).json({ message: 'Failed to approve interest calculation' });
    }
  });

  app.put('/api/interest-calculations/approve-all', isAuthenticated, requirePermission('post', 'interest-calculations'), async (req: any, res) => {
    try {
      const { financialYearId } = req.body;
      if (!financialYearId) {
        return res.status(400).json({ message: 'Financial year is required' });
      }
      const approvedBy = getUserId(req)!;
      const calculations = await storage.getInterestCalculations(financialYearId);
      const pending = calculations.filter((c: any) => c.status === 'calculated');
      let approved = 0;
      for (const calc of pending) {
        await storage.approveInterestCalculation(calc.id, approvedBy);
        approved++;
      }
      return res.json({ approved, total: calculations.length });
    } catch (error) {
      console.error('Error approving all interest calculations:', error);
      return res.status(500).json({ message: 'Failed to approve all interest calculations' });
    }
  });

  app.put('/api/interest-calculations/post-all', isAuthenticated, requirePermission('post', 'interest-calculations'), async (req: any, res) => {
    try {
      const { financialYearId } = req.body;
      if (!financialYearId) {
        return res.status(400).json({ message: 'Financial year is required' });
      }
      const calculations = await storage.getInterestCalculations(financialYearId);
      const approved = calculations.filter((c: any) => c.status === 'approved');
      let posted = 0;
      for (const calc of approved) {
        await storage.runSaccoLedgerTransaction(async (tx) => {
          const locked = await tx.execute(sql`SELECT * FROM ${interestCalculations} WHERE ${interestCalculations.id} = ${calc.id} FOR UPDATE`);
          const current = locked.rows[0] as typeof interestCalculations.$inferSelect | undefined;
          if (!current || current.status !== 'approved') return;
          const amount = parseFloat(current.grossInterest || '0');
          const [postedCalculation] = await tx.update(interestCalculations).set({ status: 'posted', postedAt: new Date(), updatedAt: new Date() })
            .where(eq(interestCalculations.id, current.id)).returning();
          if (amount <= 0) return;
          const referenceNumber = `INT${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
          await tx.insert(interestPayments).values({ interestCalculationId: postedCalculation.id, memberId: postedCalculation.memberId, savingsAccountId: postedCalculation.savingsAccountId, paymentAmount: postedCalculation.grossInterest, paymentMethod: 'credit_to_account', paymentDate: new Date().toISOString().split('T')[0], transactionReference: referenceNumber, status: 'completed', processedBy: getUserId(req)! });
          await tx.update(savingsAccountsTable).set({ balance: sql`${savingsAccountsTable.balance} + ${postedCalculation.grossInterest}`, updatedAt: new Date() }).where(eq(savingsAccountsTable.id, postedCalculation.savingsAccountId));
          await tx.update(members).set({ totalSavings: sql`(SELECT COALESCE(SUM(balance::numeric), 0) FROM savings_accounts WHERE member_id = ${postedCalculation.memberId})` }).where(eq(members.id, postedCalculation.memberId));
          await tx.insert(transactions).values({ memberId: postedCalculation.memberId, savingsAccountId: postedCalculation.savingsAccountId, transactionType: 'interest_credit', amount: postedCalculation.grossInterest, referenceNumber, description: `Interest credit - ${postedCalculation.calculationMethod} method`, status: 'completed', processedBy: getUserId(req)! });
          await recordJournalEntry('savings_interest_accrual', amount, `Savings interest accrual - member ${postedCalculation.memberId}`, referenceNumber, getUserId(req)!, tx, false);
          await recordJournalEntry('savings_interest_credit', amount, `Savings interest credited - member ${postedCalculation.memberId}`, referenceNumber, getUserId(req)!, tx);
        });
        posted++;
      }
      return res.json({ posted, total: calculations.length });
    } catch (error) {
      console.error('Error posting all interest calculations:', error);
      return res.status(500).json({ message: 'Failed to post all interest calculations' });
    }
  });

  app.put('/api/interest-calculations/:id/post', isAuthenticated, requirePermission('post', 'interest-calculations'), async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const processedBy = getUserId(req)!;
      const calculation = await storage.runSaccoLedgerTransaction(async (tx) => {
        const locked = await tx.execute(sql`SELECT * FROM ${interestCalculations} WHERE ${interestCalculations.id} = ${id} FOR UPDATE`);
        const current = locked.rows[0] as typeof interestCalculations.$inferSelect | undefined;
        if (!current) throw new Error('Interest calculation not found');
        if (current.status !== 'approved') throw new Error(`Only approved interest calculations can be posted (current status: ${current.status})`);
        const amount = parseFloat(current.grossInterest || '0');
        const [posted] = await tx.update(interestCalculations).set({ status: 'posted', postedAt: new Date(), updatedAt: new Date() })
          .where(eq(interestCalculations.id, id)).returning();
        if (amount > 0) {
          const referenceNumber = `INT${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
          await tx.insert(interestPayments).values({
            interestCalculationId: posted.id, memberId: posted.memberId, savingsAccountId: posted.savingsAccountId,
            paymentAmount: posted.grossInterest, paymentMethod: 'credit_to_account',
            paymentDate: new Date().toISOString().split('T')[0], transactionReference: referenceNumber,
            status: 'completed', processedBy,
          });
          await tx.update(savingsAccountsTable).set({ balance: sql`${savingsAccountsTable.balance} + ${posted.grossInterest}`, updatedAt: new Date() })
            .where(eq(savingsAccountsTable.id, posted.savingsAccountId));
          await tx.update(members).set({ totalSavings: sql`(SELECT COALESCE(SUM(balance::numeric), 0) FROM savings_accounts WHERE member_id = ${posted.memberId})` })
            .where(eq(members.id, posted.memberId));
          await tx.insert(transactions).values({
            memberId: posted.memberId, savingsAccountId: posted.savingsAccountId, transactionType: 'interest_credit',
            amount: posted.grossInterest, referenceNumber, description: `Interest credit - ${posted.calculationMethod} method`,
            status: 'completed', processedBy,
          });
          await recordJournalEntry('savings_interest_accrual', amount, `Savings interest accrual - member ${posted.memberId}`, referenceNumber, processedBy, tx, false);
          await recordJournalEntry('savings_interest_credit', amount, `Savings interest credited - member ${posted.memberId}`, referenceNumber, processedBy, tx);
        }
        return posted;
      });

      try {
        const member = await storage.getMember(calculation.memberId);
        const amount = parseFloat(calculation.grossInterest || '0');
        await sendNotificationEmail(
          storage,
          member?.email,
          'Interest Credited to Your Savings',
          `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${member?.fullName || 'Member'},</p>
           <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">Savings interest of <strong>UGX ${amount.toLocaleString()}</strong> has been credited to your account.</p>
           <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">Log in to view your updated savings balance and interest earned.</p>`
        );
      } catch (emailErr) {
        req.log.warn({ err: emailErr }, 'Interest credit email skipped');
      }

      res.json(calculation);
    } catch (error) {
      console.error('Error posting interest calculation:', error);
      res.status(500).json({ message: 'Failed to post interest calculation' });
    }
  });

  // Interest payments
  app.get('/api/interest-payments', isAuthenticated, async (req, res) => {
    try {
      const financialYearId = req.query.financialYearId ? parseInt(req.query.financialYearId as string) : undefined;
      const payments = await storage.getInterestPayments(financialYearId);
      res.json(payments);
    } catch (error) {
      console.error('Error fetching interest payments:', error);
      res.status(500).json({ message: 'Failed to fetch interest payments' });
    }
  });

  app.post('/api/interest-payments', isAuthenticated, requirePermission('post', 'interest-calculations'), async (req, res) => {
    try {
      const payment = await storage.createInterestPayment(req.body);
      res.status(201).json(payment);
    } catch (error) {
      console.error('Error creating interest payment:', error);
      res.status(500).json({ message: 'Failed to create interest payment' });
    }
  });

  app.put('/api/interest-payments/:id/process', isAuthenticated, requirePermission('post', 'interest-calculations'), async (req: any, res) => {
    try {
      const id = parseInt(getRouteParam(req.params.id));
      const processedBy = getUserId(req)!;
      const payment = await storage.processInterestPayment(id, processedBy);
      res.json(payment);
    } catch (error) {
      console.error('Error processing interest payment:', error);
      res.status(500).json({ message: 'Failed to process interest payment' });
    }
  });

  // Interest reports
  app.get('/api/interest-reports/:financialYearId', isAuthenticated, async (req, res) => {
    try {
      const financialYearId = parseInt(getRouteParam(req.params.financialYearId));
      const report = await storage.generateInterestReport(financialYearId);
      res.json(report);
    } catch (error) {
      console.error('Error generating interest report:', error);
      res.status(500).json({ message: 'Failed to generate interest report' });
    }
  });

  // ==================== SACCO Operational Accounts ====================

  app.get('/api/sacco-accounts', isAuthenticated, requirePermission('read', 'sacco-accounts'), async (req: any, res) => {
    try {
      const { type, active } = req.query;
      const filters: any = {};
      if (type) filters.accountType = type;
      if (active !== undefined) filters.isActive = active === 'true';
      const accounts = await storage.getSaccoAccounts(filters);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching SACCO accounts:", error);
      res.status(500).json({ message: "Failed to fetch SACCO accounts" });
    }
  });

  app.get('/api/sacco-accounts/summary', isAuthenticated, requirePermission('read', 'sacco-accounts'), async (req: any, res) => {
    try {
      const summary = await storage.getSaccoAccountsSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching SACCO accounts summary:", error);
      res.status(500).json({ message: "Failed to fetch accounts summary" });
    }
  });

  app.get('/api/sacco-accounts/:id', isAuthenticated, requirePermission('read', 'sacco-accounts'), async (req: any, res) => {
    try {
      const account = await storage.getSaccoAccount(parseInt(getRouteParam(req.params.id)));
      if (!account) return res.status(404).json({ message: "Account not found" });
      return res.json(account);
    } catch (error) {
      console.error("Error fetching SACCO account:", error);
      return res.status(500).json({ message: "Failed to fetch account" });
    }
  });

  app.get('/api/sacco-accounts/:id/statement', isAuthenticated, requirePermission('read', 'sacco-accounts'), async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      const statement = await storage.getSaccoAccountStatement(
        parseInt(getRouteParam(req.params.id)),
        startDate as string,
        endDate as string
      );
      res.json(statement);
    } catch (error) {
      console.error("Error fetching account statement:", error);
      res.status(500).json({ message: "Failed to fetch account statement" });
    }
  });

  app.post('/api/sacco-accounts', isAuthenticated, requirePermission('update', 'sacco-accounts'), async (req: any, res) => {
    try {
      const { accountCode, accountName, accountType, description } = req.body;
      if (!accountCode || !accountName || !accountType) {
        return res.status(400).json({ message: "Missing required fields: accountCode, accountName, accountType" });
      }
      const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
      if (!validTypes.includes(accountType)) {
        return res.status(400).json({ message: `Invalid account type. Must be one of: ${validTypes.join(', ')}` });
      }
      const account = await storage.createSaccoAccount({ accountCode, accountName, accountType, description });
      return res.status(201).json(account);
    } catch (error: any) {
      console.error("Error creating SACCO account:", error);
      if (error?.code === '23505') {
        return res.status(400).json({ message: "An account with this code already exists" });
      }
      return res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.patch('/api/sacco-accounts/:id', isAuthenticated, requirePermission('update', 'sacco-accounts'), async (req: any, res) => {
    try {
      if (Object.prototype.hasOwnProperty.call(req.body, 'balance')) {
        return res.status(400).json({ message: "Account balances can only be changed by posted journal entries" });
      }
      const account = await storage.updateSaccoAccount(parseInt(getRouteParam(req.params.id)), req.body);
      return res.json(account);
    } catch (error) {
      console.error("Error updating SACCO account:", error);
      return res.status(500).json({ message: "Failed to update account" });
    }
  });

  app.get('/api/sacco-journal-entries', isAuthenticated, requirePermission('read', 'sacco-accounts'), async (req: any, res) => {
    try {
      const { page, limit, accountId, startDate, endDate } = req.query;
      const entries = await storage.getSaccoJournalEntries({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        accountId: accountId ? parseInt(accountId) : undefined,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json(entries);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  app.post('/api/sacco-journal-entries', isAuthenticated, requirePermission('update', 'sacco-accounts'), async (req: any, res) => {
    try {
      const { entryDate, description, reference, debitAccountId, creditAccountId, amount } = req.body;
      if (!entryDate || !description || !debitAccountId || !creditAccountId || !amount) {
        return res.status(400).json({ message: "Missing required fields: entryDate, description, debitAccountId, creditAccountId, amount" });
      }
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
      }
      if (debitAccountId === creditAccountId) {
        return res.status(400).json({ message: "Debit and credit accounts must be different" });
      }

      const userId = getUserId(req)!;
      const entryNumber = `JE${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const entry = await storage.createSaccoJournalEntry({
        entryNumber,
        entryDate,
        description,
        reference: reference || null,
        debitAccountId: parseInt(debitAccountId),
        creditAccountId: parseInt(creditAccountId),
        amount: amount.toString(),
        createdBy: userId,
        status: 'posted',
      });

      await storage.createAuditLog({
        userId,
        action: 'create',
        resource: 'sacco-journal-entry',
        resourceId: entry.id.toString(),
        details: `Created journal entry ${entryNumber}: ${req.body.description}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      broadcastDataUpdate(['/api/sacco-accounts', '/api/sacco-journal-entries', '/api/sacco-accounts/summary']);
      return res.status(201).json(entry);
    } catch (error: any) {
      console.error("Error creating journal entry:", error);
      return res.status(500).json({ message: error.message || "Failed to create journal entry" });
    }
  });

  app.post('/api/sacco-journal-entries/:id/reverse', isAuthenticated, requirePermission('update', 'sacco-accounts'), async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const journalEntryId = getRouteParam(req.params.id);
      const reversal = await storage.reverseSaccoJournalEntry(parseInt(journalEntryId), userId);

      await storage.createAuditLog({
        userId,
        action: 'update',
        resource: 'sacco-journal-entry',
        resourceId: reversal.id.toString(),
        details: `Reversed journal entry ${journalEntryId}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      broadcastDataUpdate(['/api/sacco-accounts', '/api/sacco-journal-entries', '/api/sacco-accounts/summary']);
      res.json(reversal);
    } catch (error: any) {
      console.error("Error reversing journal entry:", error);
      res.status(500).json({ message: error.message || "Failed to reverse journal entry" });
    }
  });

  // ==================== SACCO Account Mappings ====================

  app.get('/api/sacco-account-mappings', isAuthenticated, requirePermission('read', 'sacco-accounts'), async (req: any, res) => {
    try {
      const mappings = await storage.getSaccoAccountMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching account mappings:", error);
      res.status(500).json({ message: "Failed to fetch account mappings" });
    }
  });

  app.patch('/api/sacco-account-mappings/:id', isAuthenticated, requirePermission('update', 'sacco-accounts'), async (req: any, res) => {
    try {
      const { debitAccountId, creditAccountId } = req.body;
      const parsedDebit = debitAccountId ? parseInt(debitAccountId) : null;
      const parsedCredit = creditAccountId ? parseInt(creditAccountId) : null;
      if (debitAccountId && (isNaN(parsedDebit!) || parsedDebit! <= 0)) {
        return res.status(400).json({ message: "Invalid debit account ID" });
      }
      if (creditAccountId && (isNaN(parsedCredit!) || parsedCredit! <= 0)) {
        return res.status(400).json({ message: "Invalid credit account ID" });
      }
      const mapping = await storage.updateSaccoAccountMapping(parseInt(getRouteParam(req.params.id)), {
        debitAccountId: parsedDebit,
        creditAccountId: parsedCredit,
      });

      const userId = getUserId(req)!;
      await storage.createAuditLog({
        userId,
        action: 'update',
        resource: 'sacco-account-mapping',
        resourceId: mapping.id.toString(),
        details: `Updated account mapping: ${mapping.mappingKey}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json(mapping);
    } catch (error) {
      console.error("Error updating account mapping:", error);
      return res.status(500).json({ message: "Failed to update account mapping" });
    }
  });

  // Member activity status check - marks inactive (3 months no savings + no running loans) and dormant (6 months)
  async function runMemberActivityCheck(): Promise<{ inactivated: number; dormanted: number; reactivated: number; checked: number }> {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const activeMembers = await db.select().from(members)
      .where(inArray(members.status, ['active', 'inactive', 'dormant']));

    let inactivated = 0;
    let dormanted = 0;
    let reactivated = 0;

    for (const member of activeMembers) {
      const baselineDate = member.lastSavingsDate
        ? new Date(member.lastSavingsDate)
        : member.joinDate
        ? new Date(member.joinDate)
        : member.membershipStartDate
        ? new Date(member.membershipStartDate)
        : member.createdAt
        ? new Date(member.createdAt)
        : null;

      if (!baselineDate) continue;

      const activeLoans = await storage.getMemberActiveLoans(member.id);
      const hasRunningLoans = activeLoans.some((l: any) =>
        ['active', 'disbursed'].includes(l.status) && parseFloat(l.outstandingBalance || '0') > 0
      );

      let newStatus: string | null = null;

      if (baselineDate < sixMonthsAgo) {
        if (!hasRunningLoans && member.status !== 'dormant') {
          newStatus = 'dormant';
          dormanted++;
        }
      } else if (baselineDate < threeMonthsAgo) {
        if (!hasRunningLoans && member.status !== 'inactive') {
          newStatus = 'inactive';
          inactivated++;
        }
      } else {
        if ((member.status === 'inactive' || member.status === 'dormant')) {
          newStatus = 'active';
          reactivated++;
        }
      }

      if (newStatus && newStatus !== member.status) {
        await db.update(members).set({
          status: newStatus as any,
          isActiveSaver: newStatus === 'active',
          updatedAt: new Date(),
        }).where(eq(members.id, member.id));
      }
    }

    return { inactivated, dormanted, reactivated, checked: activeMembers.length };
  }

  // Auto-run activity check on server startup (non-blocking)
  setTimeout(async () => {
    try {
      const result = await runMemberActivityCheck();
      console.log(`[activity-check] Startup check: ${result.checked} members checked, ${result.inactivated} inactivated, ${result.dormanted} set dormant, ${result.reactivated} reactivated`);
    } catch (error) {
      console.error('[activity-check] Startup check failed:', error);
    }
  }, 5000);

  // Schedule daily activity check (every 24 hours)
  setInterval(async () => {
    try {
      const result = await runMemberActivityCheck();
      console.log(`[activity-check] Daily check: ${result.checked} members checked, ${result.inactivated} inactivated, ${result.dormanted} set dormant, ${result.reactivated} reactivated`);
    } catch (error) {
      console.error('[activity-check] Daily check failed:', error);
    }
  }, 24 * 60 * 60 * 1000);

  // Manual trigger for activity check (admin/treasurer)
  app.post('/api/members/check-activity', isAuthenticated, requirePermission('update', 'members'), async (req: any, res) => {
    try {
      const result = await runMemberActivityCheck();
      const userId = getUserId(req)!;

      await storage.createAuditLog({
        userId,
        action: 'update',
        resource: 'member-activity-check',
        details: `Manual activity check: ${result.checked} members checked, ${result.inactivated} inactivated, ${result.dormanted} set dormant, ${result.reactivated} reactivated`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      broadcastDataUpdate(['/api/members', '/api/dashboard', '/api/reports/member-activity']);
      res.json({ message: 'Activity check completed', ...result });
    } catch (error: any) {
      console.error('Error running activity check:', error);
      res.status(500).json({ message: error.message || 'Failed to run activity check' });
    }
  });

  setTimeout(async () => {
    try {
      const result = await storage.syncAllMemberTotalSavings();
      console.log(`[savings-sync] Startup sync: updated total_savings for ${result.updated} members`);
    } catch (error) {
      console.error('[savings-sync] Startup sync failed:', error);
    }
  }, 8000);

  setTimeout(async () => {
    try {
      await storage.recalculateSaccoAccountBalances();
      console.log('[sacco-accounts] Startup: recalculated all SACCO account balances from journal entries');
    } catch (error) {
      console.error('[sacco-accounts] Startup recalculation failed:', error);
    }
  }, 12000);

  async function autoCompletePaidLoans(source: string = 'manual') {
    const result = await db.update(loans)
      .set({ status: 'completed' as any, outstandingBalance: '0' })
      .where(
        and(
          inArray(loans.status, ['active', 'disbursed', 'approved']),
          sql`CAST(${loans.outstandingBalance} AS numeric) <= 1.00`
        )
      )
      .returning({ id: loans.id, loanNumber: loans.loanNumber });
    if (result.length > 0) {
      console.log(`[loan-autocomplete] ${source}: auto-completed ${result.length} loan(s) with zero/negative balance: ${result.map(l => l.loanNumber).join(', ')}`);
    }
    return result;
  }

  setTimeout(async () => {
    try {
      await autoCompletePaidLoans('Startup');
    } catch (error) {
      console.error('[loan-autocomplete] Startup check failed:', error);
    }
  }, 10000);

  setInterval(async () => {
    try {
      await autoCompletePaidLoans('Daily');
    } catch (error) {
      console.error('[loan-autocomplete] Daily check failed:', error);
    }
  }, 24 * 60 * 60 * 1000);

  app.post('/api/admin/auto-complete-loans', isAuthenticated, requirePermission('update', 'system-settings'), async (req: any, res) => {
    try {
      const result = await autoCompletePaidLoans('Manual');
      await storage.createAuditLog({
        userId: getUserId(req)!,
        action: 'update',
        resource: 'loans',
        details: `Manual loan auto-complete: ${result.length} loan(s) completed${result.length > 0 ? ': ' + result.map(l => l.loanNumber).join(', ') : ''}`,
      });
      broadcastDataUpdate(['/api/loans', '/api/dashboard', '/api/reports']);
      res.json({ completed: result.length, loans: result.map(l => l.loanNumber) });
    } catch (error) {
      console.error('Error running loan auto-complete:', error);
      res.status(500).json({ message: 'Failed to run loan auto-complete' });
    }
  });

  const { startScheduledBackups } = await import('../backup');
  startScheduledBackups();

  return httpServer;
}
