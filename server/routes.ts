import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupLocalAuth, hashPassword } from "./localAuth";
import passport from "passport";
import { requirePermission, filterDataByRole, type AuthRequest, filterMembersByRole, filterLoansByRole, filterTransactionsByRole } from "./rbac-middleware";
import { insertMemberSchema, insertSavingsAccountSchema, insertLoanSchema, insertTransactionSchema, insertGuarantorSchema, insertNotificationSchema, members } from "@shared/schema";
import { businessRulesValidator } from "./business-rules-validator";
import { z } from "zod";
import { db } from "./db";
import { eq } from "drizzle-orm";

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

export async function registerRoutes(app: Express): Promise<Server> {
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
      role: 'admin' | 'manager' | 'committee' | 'teller' | 'member';
      userId: string;
      memberNumber: string;
      status: string;
    };
  }
  // Auth middleware
  await setupAuth(app);
  await setupLocalAuth();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // Handle both Replit and local auth users
      const userId = getUserId(req)!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has a member profile
      const member = await storage.getMemberByUserId(userId);
      
      // Remove password from user object
      const { password, ...userWithoutPassword } = user as typeof user & { password?: string };
      
      if (member) {
        const roles = await storage.getMemberRoles(member.id);
        
        if (member.user && (member.user as any).password) {
          const { password: _, ...memberUserWithoutPassword } = member.user as any;
          member.user = memberUserWithoutPassword as typeof member.user;
        }
        
        res.json({
          ...userWithoutPassword,
          member: {
            ...member,
            roles: roles.length > 0 ? roles : [member.role || 'member']
          }
        });
      } else {
        res.json({
          ...userWithoutPassword,
          member: null,
          isAdmin: user.role === 'admin',
        });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get current user's permissions
  app.get('/api/auth/permissions', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      // Handle both Replit and local auth users
      const userId = getUserId(req)!;
      const member = await storage.getMemberByUserId(userId);
      const user = await storage.getUser(userId);
      
      // Get all roles for this member - also check user.role for staff without member profiles
      let roleNames: string[];
      if (member) {
        const memberRoles = await storage.getMemberRoles(member.id);
        roleNames = memberRoles.length > 0 ? memberRoles : ['member'];
      } else if (user?.role) {
        roleNames = [user.role];
      } else {
        return res.json([]);
      }
      
      // Get all permissions for all user's roles
      const allPermissions: any[] = [];
      
      for (const roleName of roleNames) {
        const role = await storage.getRoleByName(roleName);
        if (role) {
          const permissions = await storage.getPermissionsByRole(role.id);
          allPermissions.push(...permissions);
        }
      }
      
      // Remove duplicates
      const uniquePermissions = Array.from(
        new Map(allPermissions.map(p => [`${p.action}-${p.resource}`, p])).values()
      );
      
      res.json(uniquePermissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
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

      const member = await storage.getMemberByUserId(userId);
      if (member) {
        const memberUpdates: any = {};
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
      const { password, ...userWithoutPassword } = user as typeof user & { password?: string };
      const updatedMember = await storage.getMemberByUserId(userId);
      if (updatedMember) {
        const roles = await storage.getMemberRoles(updatedMember.id);
        if (updatedMember.user && (updatedMember.user as any).password) {
          const { password: _, ...memberUserWithoutPassword } = updatedMember.user as any;
          updatedMember.user = memberUserWithoutPassword as typeof updatedMember.user;
        }
        res.json({
          ...userWithoutPassword,
          member: {
            ...updatedMember,
            roles: roles.length > 0 ? roles : [updatedMember.role || 'member']
          }
        });
      } else {
        res.json({ ...userWithoutPassword, member: null });
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Local auth login endpoint
  app.post('/api/auth/login', 
    (req, res, next) => {
      passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) {
          return res.status(500).json({ message: "Authentication error" });
        }
        if (!user) {
          return res.status(401).json({ message: info?.message || "Invalid username or password" });
        }
        req.logIn(user, (err) => {
          if (err) {
            return res.status(500).json({ message: "Login error" });
          }
          const { password: _, ...safeUser } = user;
          return res.json({ message: "Login successful", user: safeUser, mustChangePassword: user.mustChangePassword || false });
        });
      })(req, res, next);
    }
  );

  // Create admin user endpoint (protected - only existing admins can create new users)
  app.post('/api/auth/create-user', isAuthenticated, requirePermission('create', 'users'), async (req: AuthRequest, res) => {
    try {
      const { username, password, email, firstName, lastName, role } = req.body;
      
      // Validate input
      if (!username || !password || !email) {
        return res.status(400).json({ message: "Username, password, and email are required" });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Generate a unique user ID
      const userId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create the user
      const newUser = await storage.upsertUser({
        id: userId,
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        authMethod: 'local',
        role: role || 'member'
      });

      // If role is 'member', also create a member profile with member number
      let memberProfile = null;
      if (role === 'member') {
        const allMembers = await storage.getAllMembers();
        const pendingMembers = await storage.getPendingMembers();
        const totalCount = allMembers.length + pendingMembers.length;
        const memberNumber = `BCS${String(totalCount + 1).padStart(6, '0')}`;
        
        const fullName = `${firstName || ''} ${lastName || ''}`.trim();
        
        memberProfile = await storage.createMember({
          memberNumber,
          userId: newUser.id,
          fullName: fullName || username,
          idNumber: username,
          phoneNumber: '',
          address: '',
          role: 'member',
          status: 'active',
          joinDate: new Date(),
          approvedBy: getUserId(req),
          approvedAt: new Date(),
          membershipStartDate: new Date(),
        } as any);

        await storage.addMemberRole(memberProfile.id, 'member', getUserId(req) || userId);

        const accountNumber = `SAV${String(memberProfile.id).padStart(8, '0')}`;
        await storage.createSavingsAccount({
          memberId: memberProfile.id,
          accountNumber,
          accountType: 'regular',
          balance: '0.00',
        });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = newUser;
      
      res.status(201).json({ 
        message: "User created successfully", 
        user: userWithoutPassword,
        member: memberProfile
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.get('/api/auth/users', isAuthenticated, requirePermission('read', 'users'), async (req: AuthRequest, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithRoles = await Promise.all(allUsers.map(async ({ password, ...u }: any) => {
        const member = await storage.getMemberByUserId(u.id);
        const roles = member ? await storage.getMemberRoles(member.id) : [u.role || 'member'];
        return { ...u, roles, memberId: member?.id || null };
      }));
      res.json(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/auth/users/:id', isAuthenticated, requirePermission('update', 'users'), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { username, email, firstName, lastName, role, roles, password } = req.body;

      const updateData: any = {};
      if (username) updateData.username = username;
      if (email) updateData.email = email;
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      const primaryRole = role || (Array.isArray(roles) && roles.length > 0 ? roles[0] : undefined);
      if (primaryRole) updateData.role = primaryRole;
      if (password) {
        updateData.password = await hashPassword(password);
      }

      const updatedUser = await storage.updateUser(id, updateData);

      if (Array.isArray(roles) && roles.length > 0) {
        const member = await storage.getMemberByUserId(id);
        if (member) {
          await storage.replaceMemberRoles(member.id, roles, getUserId(req) || id);
          await storage.updateMember(member.id, { role: primaryRole });
        }
      }

      const { password: _, ...userWithoutPassword } = updatedUser as any;
      const member = await storage.getMemberByUserId(id);
      const memberRoles = member ? await storage.getMemberRoles(member.id) : [primaryRole || updatedUser.role];
      res.json({ ...userWithoutPassword, roles: memberRoles, memberId: member?.id || null });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post('/api/auth/users/:id/reset-password', isAuthenticated, requirePermission('update', 'users'), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const tempPassword = 'changeme123';
      const hashedPassword = await hashPassword(tempPassword);
      await storage.updateUser(id, { password: hashedPassword, mustChangePassword: true });
      res.json({ message: "Password reset successfully. User must change password on next login.", tempPassword });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post('/api/auth/change-password', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!user.mustChangePassword && currentPassword) {
        const bcrypt = await import('bcryptjs');
        const isValid = await bcrypt.compare(currentPassword, user.password || '');
        if (!isValid) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
      }
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(userId, { password: hashedPassword, mustChangePassword: false });
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.delete('/api/auth/users/:id', isAuthenticated, requirePermission('delete', 'users'), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const requestingUserId = getUserId(req);
      
      if (id === requestingUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Update user settings
  app.patch('/api/auth/settings', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const settings = req.body;
      
      // Validate settings structure (you could add more validation here)
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

      // In a real application, you'd save these to a user_settings table
      // For now, we'll just return success
      res.json({ 
        message: "Settings updated successfully", 
        settings: validSettings 
      });
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
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
        smtpServer: "smtp.gmail.com",
        smtpPort: 587,
        emailFromAddress: "noreply@biasharasacco.com",
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

      res.json({ ...defaults, ...settingsMap });
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      res.status(500).json({ message: "Failed to fetch admin settings" });
    }
  });

  // Update admin settings (persisted in system_settings table)
  app.patch('/api/admin/settings', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const settings = req.body;
      const userId = getUserId(req);

      const numberFields = ['maxLoanAmount', 'maxLoanTerm', 'defaultInterestRate', 'sessionTimeout', 'maxLoginAttempts', 'smtpPort', 'minimumSavingsBalance', 'loanToSavingsRatio', 'membershipDurationMonths', 'minLoanApprovers', 'logRetentionDays', 'entranceFee', 'sharePrice'];
      const booleanFields = ['maintenanceMode', 'twoFactorRequired', 'emailEnabled', 'systemNotifications', 'memberNotifications', 'loanNotifications', 'autoBackupEnabled'];

      for (const [key, value] of Object.entries(settings)) {
        let type = 'string';
        if (numberFields.includes(key)) type = 'number';
        else if (booleanFields.includes(key)) type = 'boolean';

        await storage.upsertSystemSetting(key, String(value), type, undefined, userId);
      }

      res.json({ message: "Admin settings updated successfully", settings });
    } catch (error) {
      console.error("Error updating admin settings:", error);
      res.status(500).json({ message: "Failed to update admin settings" });
    }
  });

  // Public endpoint to fetch specific system settings (for member form)
  app.get('/api/system/settings/public', isAuthenticated, async (req, res) => {
    try {
      const entranceFeeSetting = await storage.getSystemSetting('entranceFee');
      const sharePriceSetting = await storage.getSystemSetting('sharePrice');
      const loanToSavingsRatioSetting = await storage.getSystemSetting('loanToSavingsRatio');
      const minLoanApproversSetting = await storage.getSystemSetting('minLoanApprovers');

      res.json({
        entranceFee: entranceFeeSetting ? parseFloat(entranceFeeSetting.settingValue) : 15000,
        sharePrice: sharePriceSetting ? parseFloat(sharePriceSetting.settingValue) : 5000,
        loanToSavingsRatio: loanToSavingsRatioSetting ? parseFloat(loanToSavingsRatioSetting.settingValue) : 2.5,
        minLoanApprovers: minLoanApproversSetting ? parseInt(minLoanApproversSetting.settingValue) : 2,
      });
    } catch (error) {
      console.error("Error fetching public settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Dashboard metrics
  app.get('/api/dashboard/metrics', isAuthenticated, async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Dashboard analytics API
  app.get('/api/dashboard/analytics', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const analytics = await storage.getDashboardAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics data' });
    }
  });

  // Recent transactions
  app.get('/api/dashboard/recent-transactions', isAuthenticated, filterDataByRole(), async (req: any, res) => {
    try {
      const allTransactions = await storage.getRecentTransactions(50); // Get more to filter
      // Filter transactions based on user role
      const filteredTransactions = filterTransactionsByRole(allTransactions, req.member?.roles || ['member'], req.member?.userId || '');
      res.json(filteredTransactions.slice(0, 10)); // Return top 10 after filtering
    } catch (error) {
      console.error("Error fetching recent transactions:", error);
      res.status(500).json({ message: "Failed to fetch recent transactions" });
    }
  });

  // Pending approvals
  app.get('/api/dashboard/pending-approvals', isAuthenticated, filterDataByRole(), async (req: any, res) => {
    try {
      const approvals = await storage.getPendingApprovals();
      
      // Filter approvals based on user roles
      const userRoles = req.member?.roles || ['member'];
      let filteredApprovals: any = { loanApplications: [], withdrawalRequests: [] };
      
      if (userRoles.some((role: string) => ['admin', 'manager', 'committee', 'teller'].includes(role))) {
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
      
      res.json(filteredApprovals);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ message: "Failed to fetch pending approvals" });
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
    if (user?.role && ['admin', 'manager', 'committee', 'teller', 'treasurer'].includes(user.role)) return true;
    
    const member = await storage.getMemberByUserId(userId);
    if (!member) return false;
    
    const roles = await storage.getMemberRoles(member.id);
    return roles.some(role => ['admin', 'manager', 'committee', 'teller', 'treasurer'].includes(role));
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
    
    const member = await storage.getMemberByUserId(userId);
    const roles = member ? await storage.getMemberRoles(member.id) : [];
    if (roles.length === 0 && member?.role) roles.push(member.role);
    if (roles.length === 0 && user?.role) roles.push(user.role);
    
    if (requiredRole === 'committee') {
      return roles.includes('committee') && !roles.includes('admin');
    }
    if (requiredRole === 'treasurer' || requiredRole === 'teller') {
      return roles.includes('treasurer') || roles.includes('teller') || roles.includes('admin');
    }
    if (requiredRole === 'manager') {
      return roles.includes('manager') || roles.includes('admin');
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
      const isStaff = currentUser?.role === 'admin' || currentRoles.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role));
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
      res.status(201).json(member);
    } catch (error) {
      console.error("Error creating member:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create member" });
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
      res.json(pendingMembers);
    } catch (error) {
      console.error("Error fetching pending members:", error);
      res.status(500).json({ message: "Failed to fetch pending members" });
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

      res.json({ message: "Member approved successfully", member });
    } catch (error) {
      console.error("Error approving member:", error);
      res.status(500).json({ message: "Failed to approve member" });
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
      res.json({ message: "Member application rejected", member });
    } catch (error) {
      console.error("Error rejecting member:", error);
      res.status(500).json({ message: "Failed to reject member" });
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

      res.json(member);
    } catch (error) {
      console.error("Error fetching member:", error);
      res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  app.get('/api/members', isAuthenticated, filterDataByRole(), async (req: any, res) => {
    try {
      const { search } = req.query;
      const allMembers = search 
        ? await storage.searchMembers(search as string)
        : await storage.getAllMembers();
      
      // Filter members based on user roles
      const filteredMembers = filterMembersByRole(allMembers, req.member?.roles || ['member'], req.member?.userId || '');
      res.json(filteredMembers);
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
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
      
      const validRoles = ['admin', 'manager', 'committee', 'teller', 'member'];
      if (!roles.every(role => validRoles.includes(role))) {
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
      
      res.json({ success: true, roles });
    } catch (error) {
      console.error("Error updating member roles:", error);
      res.status(500).json({ message: "Failed to update member roles" });
    }
  });

  // Get member roles
  app.get('/api/members/:id/roles', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.id);
      const roles = await storage.getMemberRoles(memberId);
      res.json(roles);
    } catch (error) {
      console.error("Error fetching member roles:", error);
      res.status(500).json({ message: "Failed to fetch member roles" });
    }
  });

  app.get('/api/members/:id', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.id);

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
      // 2. Staff (teller, committee, manager, admin) can view any member data
      const isStaff = isUserAdmin || effectiveRoles.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role));
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

      res.json(member);
    } catch (error) {
      console.error("Error fetching member:", error);
      res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  app.get('/api/members/by-user/:userId', isAuthenticated, async (req: any, res) => {
    try {
      let userId = req.params.userId;
      
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
      res.json(member);
    } catch (error) {
      console.error("Error fetching member by user:", error);
      res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  // Post share capital for a member (admin only)
  app.post('/api/members/:id/share-capital', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.id);
      const { amount, description } = req.body;

      const requestingUser = await storage.getUser(getUserId(req)!);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return res.status(403).json({ message: "Only administrators can post share capital" });
      }

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Amount must be greater than zero" });
      }

      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      const paymentAmount = parseFloat(amount);
      const currentShareCapital = parseFloat(member.shareCapital || "0");
      const newShareCapital = currentShareCapital + paymentAmount;
      const sharePriceSetting = await storage.getSystemSetting('sharePrice');
      const perSharePrice = sharePriceSetting ? parseFloat(sharePriceSetting.settingValue) : 5000;
      const expectedTotal = perSharePrice * (member.numberOfShares || 4);
      const isPaidUp = newShareCapital >= expectedTotal;

      const referenceNumber = `SHR${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const transaction = await storage.createTransaction({
        memberId,
        transactionType: 'share_capital',
        amount: amount.toString(),
        referenceNumber,
        description: description || 'Share capital payment',
        status: 'completed',
        processedBy: getUserId(req),
      });

      await storage.updateMember(memberId, {
        shareCapital: newShareCapital.toString(),
        isPaidUp,
        isFullyPaidShareholder: isPaidUp,
      });

      res.json({
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
      res.status(500).json({ message: "Failed to post share capital" });
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
      const isStaff = isUpdatingAdmin || effectiveRoles.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role));
      const isOwnRecord = requestingMember?.id === memberId;

      if (!isStaff && !isOwnRecord) {
        return res.status(403).json({ message: "Access denied - insufficient permissions" });
      }

      if (updates.joinDate && typeof updates.joinDate === 'string') {
        updates.joinDate = new Date(updates.joinDate);
      }

      const updatedMember = await storage.updateMember(memberId, updates);
      
      // Log the action
      if (requestingMember) {
        await storage.createAuditLog({
          userId: getUserId(req)!,
          action: 'update',
          resource: 'member',
          resourceId: memberId.toString(),
          details: `Updated member profile: ${updatedMember.memberNumber}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      broadcastDataUpdate(['/api/members', '/api/dashboard']);
      res.json(updatedMember);
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(500).json({ message: "Failed to update member" });
    }
  });

  // Savings account routes
  app.get('/api/members/:id/savings', isAuthenticated, async (req, res) => {
    try {
      const accounts = await storage.getSavingsAccountsByMember(await storage.resolveMemberId(req.params.id));
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching savings accounts:", error);
      res.status(500).json({ message: "Failed to fetch savings accounts" });
    }
  });

  app.post('/api/savings/deposit', isAuthenticated, async (req, res) => {
    try {
      const { accountId, amount, description } = req.body;
      
      // Update account balance
      await storage.updateSavingsAccountBalance(accountId, amount, 'add');
      
      // Create transaction record
      const account = await storage.getSavingsAccount(accountId);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      const referenceNumber = `DEP${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      const transaction = await storage.createTransaction({
        memberId: account.memberId,
        savingsAccountId: accountId,
        transactionType: 'deposit',
        amount,
        referenceNumber,
        description: description || 'Savings deposit',
        status: 'completed',
        processedBy: getUserId(req),
      });

      broadcastDataUpdate(['/api/savings', '/api/transactions', '/api/dashboard']);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing deposit:", error);
      res.status(500).json({ message: "Failed to process deposit" });
    }
  });

  app.post('/api/savings/withdraw', isAuthenticated, async (req, res) => {
    try {
      const { accountId, amount, description } = req.body;
      
      const referenceNumber = `WDR${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      const transaction = await storage.createTransaction({
        memberId: (await storage.getSavingsAccount(accountId))!.memberId,
        savingsAccountId: accountId,
        transactionType: 'withdrawal',
        amount,
        referenceNumber,
        description: description || 'Savings withdrawal',
        status: 'pending', // Requires approval
        processedBy: getUserId(req),
      });

      broadcastDataUpdate(['/api/savings', '/api/transactions', '/api/dashboard']);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Loan eligibility check endpoint  
  app.post('/api/loans/check-eligibility', isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, requestedAmount, loanType } = req.body;
      
      if (!memberId || !requestedAmount) {
        return res.status(400).json({ message: "Member ID and requested amount are required" });
      }
      
      const eligibilityResult = await businessRulesValidator.checkLoanEligibility(memberId, requestedAmount, loanType);
      res.json(eligibilityResult);
    } catch (error) {
      console.error("Error checking loan eligibility:", error);
      res.status(500).json({ message: "Failed to check loan eligibility" });
    }
  });

  // Loan routes
  app.post('/api/loans', isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, loanType, principalAmount, interestRate, termMonths } = req.body;
      
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

      const loan = await storage.createLoan({
        memberId,
        loanNumber,
        loanType,
        principalAmount,
        interestRate: decimalInterestRate.toFixed(4),
        termMonths,
        monthlyPayment: monthlyPayment.toFixed(2),
        outstandingBalance: principalAmount,
        status: 'pending',
        approvalStage: 'committee',
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
          const hasStaffRole = roles.some(role => ['admin', 'manager', 'committee', 'treasurer', 'teller'].includes(role));
          
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

      broadcastDataUpdate(['/api/loans', '/api/loans/approval', '/api/dashboard', '/api/loans/my-loans']);
      res.status(201).json(loan);
    } catch (error) {
      console.error("Error creating loan:", error);
      res.status(500).json({ message: "Failed to create loan" });
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
      res.json(activeLoans);
    } catch (error) {
      console.error("Error fetching active loans for topup:", error);
      res.status(500).json({ message: "Failed to fetch active loans" });
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
      const additionalAmount = parseFloat(topUpAmount);
      const totalNewPrincipal = outstandingBalance + additionalAmount;

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
        const totalSavings = parseFloat(activeSavingsAccount.balance);
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
          const maxTopUpAllowed = maxAmount - outstandingBalance;
          if (additionalAmount > maxTopUpAllowed) {
            return res.status(400).json({
              message: `Top-up amount (${additionalAmount.toLocaleString()}) exceeds the maximum allowed of ${Math.max(0, maxTopUpAllowed).toLocaleString()} (loan limit ${maxAmount.toLocaleString()} minus outstanding balance ${outstandingBalance.toLocaleString()})`
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
      const topUpActiveLoanTypes = await storage.getActiveLoanTypes();
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

      const topUpLoan = await storage.createLoan({
        memberId: member.id,
        loanNumber,
        loanType: loanType || originalLoan.loanType,
        principalAmount: totalNewPrincipal.toFixed(2),
        interestRate: decimalInterestRate.toFixed(4),
        termMonths,
        monthlyPayment: monthlyPayment.toFixed(2),
        outstandingBalance: totalNewPrincipal.toFixed(2),
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
          const hasStaffRole = roles.some(role => ['admin', 'manager', 'committee', 'treasurer', 'teller'].includes(role));
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

      res.status(201).json(topUpLoan);
    } catch (error) {
      console.error("Error creating loan top-up:", error);
      res.status(500).json({ message: "Failed to create loan top-up" });
    }
  });

  // Get all loans
  app.get('/api/loans', isAuthenticated, filterDataByRole(), async (req: any, res) => {
    try {
      const allLoans = await storage.getAllLoans();
      // Filter loans based on user role
      const filteredLoans = filterLoansByRole(allLoans, req.member?.roles || ['member'], req.member?.userId || '');
      res.json(filteredLoans);
    } catch (error) {
      console.error("Error fetching loans:", error);
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  app.get('/api/loans/pending', isAuthenticated, filterDataByRole(), async (req: any, res) => {
    try {
      const allLoans = await storage.getAllPendingLoans();
      // Filter loans based on user role
      const filteredLoans = filterLoansByRole(allLoans, req.member?.roles || ['member'], req.member?.userId || '');
      res.json(filteredLoans);
    } catch (error) {
      console.error("Error fetching pending loans:", error);
      res.status(500).json({ message: "Failed to fetch pending loans" });
    }
  });

  app.get('/api/loans/member/:id', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.id);
      const loans = await storage.getLoansByMember(memberId);
      res.json(loans);
    } catch (error) {
      console.error("Error fetching member loans:", error);
      res.status(500).json({ message: "Failed to fetch member loans" });
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
      const loans = await storage.getLoansByMember(member.id);
      res.json(loans);
    } catch (error) {
      console.error("Error fetching personal loans:", error);
      res.status(500).json({ message: "Failed to fetch personal loans" });
    }
  });

  // Get specific loan by ID
  app.get('/api/loans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const loanId = await storage.resolveLoanId(req.params.id);

      const loan = await storage.getLoan(loanId);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }

      res.json(loan);
    } catch (error) {
      console.error("Error fetching loan:", error);
      res.status(500).json({ message: "Failed to fetch loan" });
    }
  });

  // Get loan transactions/statement
  app.get('/api/loans/:id/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const loanId = await storage.resolveLoanId(req.params.id);

      const transactions = await storage.getTransactionsByLoan(loanId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching loan transactions:", error);
      res.status(500).json({ message: "Failed to fetch loan transactions" });
    }
  });

  // Advanced loan approval endpoints
  app.get('/api/loans/approval/:stage', isAuthenticated, async (req: any, res) => {
    try {
      const { stage } = req.params;
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

      const canViewCommittee = userRoles.includes('committee') || userRoles.includes('treasurer') || userRoles.includes('teller') || userRoles.includes('admin');
      const canViewTreasurer = userRoles.includes('treasurer') || userRoles.includes('teller') || userRoles.includes('admin');

      if (stage === 'committee' && !canViewCommittee) {
        return res.status(403).json({ message: "Committee, treasurer, or admin role required to view committee loans" });
      }
      if (stage === 'treasurer' && !canViewTreasurer) {
        return res.status(403).json({ message: "Treasurer or admin role required to view treasurer loans" });
      }
      
      const loans = await storage.getLoansForApproval(stage, userRoles[0] || 'member');
      res.json(loans);
    } catch (error) {
      console.error("Error fetching loans for approval:", error);
      res.status(500).json({ message: "Failed to fetch loans for approval" });
    }
  });

  app.post('/api/loans/:uuid/approve/:stage', isAuthenticated, async (req: any, res) => {
    try {
      const { uuid, stage } = req.params;
      const { comments } = req.body;
      const userId = getUserId(req)!;

      if (!await hasApprovalRole(userId, stage)) {
        return res.status(403).json({ message: `Access denied. Only users with the ${stage} role can approve loans at this stage.` });
      }

      const loanByUuid = await storage.getLoanByUuid(uuid);
      if (!loanByUuid) {
        return res.status(404).json({ message: "Loan not found" });
      }

      if (stage === 'committee') {
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
          }

          broadcastDataUpdate(['/api/loans/approval', '/api/loans', '/api/dashboard', '/api/loans/my-loans']);

          res.json({ 
            message: `Loan fully approved at committee stage (${approvalCount}/${minApprovers} approvals)`, 
            loan,
            approvalCount,
            minApprovers
          });
        } else {
          broadcastDataUpdate(['/api/loans/approval', '/api/loans']);

          res.json({ 
            message: `Your approval has been recorded (${approvalCount}/${minApprovers} approvals needed). Waiting for more committee approvals.`, 
            loan: loanByUuid,
            approvalCount,
            minApprovers
          });
        }
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
        
        broadcastDataUpdate(['/api/loans/approval', '/api/loans', '/api/dashboard', '/api/loans/my-loans']);
        res.json({ message: `Loan approved at ${stage} stage`, loan });
      }
    } catch (error) {
      console.error(`Error approving loan at ${req.params.stage} stage:`, error);
      res.status(500).json({ message: "Failed to approve loan" });
    }
  });

  app.post('/api/loans/:uuid/reject', isAuthenticated, async (req: any, res) => {
    try {
      const { uuid } = req.params;
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
      broadcastDataUpdate(['/api/loans/approval', '/api/loans', '/api/dashboard', '/api/loans/my-loans']);
      res.json({ message: "Loan rejected", loan });
    } catch (error) {
      console.error("Error rejecting loan:", error);
      res.status(500).json({ message: "Failed to reject loan" });
    }
  });

  app.get('/api/loans/my-approval-activity', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const approvals = await storage.getLoanApprovalsByUser(userId);
      const rejections = await storage.getLoansRejectedByUser(userId);

      const approvedList = approvals.map((a: any) => ({
        id: a.id,
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

      res.json({
        approved: approvedList,
        rejected: rejectedList,
        summary: {
          totalApproved: approvedList.length,
          totalRejected: rejectedList.length,
          totalReviewed: approvedList.length + rejectedList.length,
        }
      });
    } catch (error) {
      console.error("Error fetching approval activity:", error);
      res.status(500).json({ message: "Failed to fetch approval activity" });
    }
  });

  app.get('/api/loans/:loanId/approvals', isAuthenticated, async (req: any, res) => {
    try {
      const loanId = parseInt(req.params.loanId);
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

      res.json({
        approvals: approvalsWithUsers,
        approvalCount: approvals.length,
        minApprovers,
        isFullyApproved: approvals.length >= minApprovers,
      });
    } catch (error) {
      console.error("Error fetching loan approvals:", error);
      res.status(500).json({ message: "Failed to fetch loan approvals" });
    }
  });

  app.get('/api/loans/:uuid/approval-history', isAuthenticated, async (req, res) => {
    try {
      const { uuid } = req.params;
      const loan = await storage.getLoanByUuid(uuid);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      const history = await storage.getLoanApprovalHistory(loan.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching loan approval history:", error);
      res.status(500).json({ message: "Failed to fetch approval history" });
    }
  });

  app.patch('/api/loans/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const loanId = await storage.resolveLoanId(req.params.id);
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
      res.json(loan);
    } catch (error) {
      console.error("Error approving loan:", error);
      res.status(500).json({ message: "Failed to approve loan" });
    }
  });

  app.patch('/api/loans/:id/disburse', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const user = await storage.getUser(userId);
      const member = await storage.getMemberByUserId(userId);
      const roles = member ? await storage.getMemberRoles(member.id) : [];
      if (roles.length === 0 && member?.role) roles.push(member.role);
      if (roles.length === 0 && user?.role) roles.push(user.role);

      const isTreasurer = roles.includes('treasurer') || roles.includes('teller');
      if (!isTreasurer) {
        return res.status(403).json({ message: "Only users with the treasurer role can disburse loans." });
      }

      const loanId = await storage.resolveLoanId(req.params.id);
      const loanDetails = await storage.getLoan(loanId);
      const loan = await storage.updateLoanStatus(loanId, 'disbursed');
      
      const referenceNumber = `DIS${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      if (loanDetails?.isTopUp && loanDetails?.topUpOfLoanId) {
        const originalLoan = await storage.getLoan(loanDetails.topUpOfLoanId);
        const previousBalance = loanDetails.previousLoanBalance || originalLoan?.outstandingBalance || '0';
        
        if (parseFloat(previousBalance) > 0) {
          await storage.updateLoanBalance(loanDetails.topUpOfLoanId, previousBalance);
        }
        
        await storage.updateLoanStatus(loanDetails.topUpOfLoanId, 'completed');
        
        const settleRef = `STL${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        await storage.createTransaction({
          memberId: loan.memberId,
          loanId: loanDetails.topUpOfLoanId,
          transactionType: 'loan_payment',
          amount: previousBalance,
          referenceNumber: settleRef,
          description: `Loan settled via top-up - ${originalLoan?.loanNumber || 'N/A'} replaced by ${loan.loanNumber}`,
          status: 'completed',
          processedBy: getUserId(req),
        });
      }

      await storage.createTransaction({
        memberId: loan.memberId,
        loanId: loan.id,
        transactionType: 'loan_disbursement',
        amount: loan.principalAmount,
        referenceNumber,
        description: `${loanDetails?.isTopUp ? 'Top-up loan' : 'Loan'} disbursement - ${loan.loanNumber}`,
        status: 'completed',
        processedBy: getUserId(req),
      });

      broadcastDataUpdate(['/api/loans', '/api/loans/approval', '/api/transactions', '/api/dashboard', '/api/savings', '/api/loans/my-loans']);
      res.json(loan);
    } catch (error) {
      console.error("Error disbursing loan:", error);
      res.status(500).json({ message: "Failed to disburse loan" });
    }
  });

  app.post('/api/loans/:id/payment', isAuthenticated, async (req, res) => {
    try {
      const { amount, description } = req.body;
      const loanId = await storage.resolveLoanId(req.params.id);
      
      // Update loan balance
      await storage.updateLoanBalance(loanId, amount);
      
      // Create payment transaction
      const loan = await storage.getLoan(loanId);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }

      const referenceNumber = `PAY${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      const transaction = await storage.createTransaction({
        memberId: loan.memberId!,
        loanId,
        transactionType: 'loan_payment',
        amount,
        referenceNumber,
        description: description || `Loan payment - ${loan.loanNumber}`,
        status: 'completed',
        processedBy: getUserId(req),
      });

      broadcastDataUpdate(['/api/loans', '/api/transactions', '/api/dashboard', '/api/savings', '/api/loans/my-loans']);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing loan payment:", error);
      res.status(500).json({ message: "Failed to process loan payment" });
    }
  });

  app.get('/api/members/:id/loans', isAuthenticated, async (req, res) => {
    try {
      const loans = await storage.getLoansByMember(await storage.resolveMemberId(req.params.id));
      res.json(loans);
    } catch (error) {
      console.error("Error fetching member loans:", error);
      res.status(500).json({ message: "Failed to fetch member loans" });
    }
  });

  app.get('/api/savings/my-savings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Member record not found" });
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
      res.json(accountsWithMember);
    } catch (error) {
      console.error("Error fetching personal savings:", error);
      res.status(500).json({ message: "Failed to fetch personal savings" });
    }
  });

  app.get('/api/transactions/my-transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req)!;
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Member record not found" });
      }
      const transactions = await storage.getTransactionsByMember(member.id);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching personal transactions:", error);
      res.status(500).json({ message: "Failed to fetch personal transactions" });
    }
  });

  // Savings account routes
  app.get('/api/savings-accounts', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      // Get user's member record to check their roles
      const savingsUser = await storage.getUser(userId);
      const requestingMember = await storage.getMemberByUserId(userId);
      const isSavingsAdmin = savingsUser?.role === 'admin';

      // Get user's roles for permission checking - also check user.role directly for staff without member profiles
      const roleNames = requestingMember ? await storage.getMemberRoles(requestingMember.id) : [];
      const effectiveRoles = roleNames.length > 0 ? roleNames : (savingsUser?.role ? [savingsUser.role] : []);

      // Access control: staff can see all accounts, members see only their own
      const isStaff = isSavingsAdmin || effectiveRoles.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role));

      let savingsAccounts;
      if (isStaff) {
        // Staff can see all savings accounts
        savingsAccounts = await storage.getAllSavingsAccounts();
      } else if (requestingMember) {
        // Members can only see their own accounts
        savingsAccounts = await storage.getSavingsAccountsByMember(requestingMember.id);
      } else {
        savingsAccounts = [];
      }

      res.json(savingsAccounts);
    } catch (error) {
      console.error("Error fetching savings accounts:", error);
      res.status(500).json({ message: "Failed to fetch savings accounts" });
    }
  });

  // Transaction routes
  app.get('/api/transactions', isAuthenticated, async (req, res) => {
    try {
      const { limit } = req.query;
      const transactions = await storage.getRecentTransactions(limit ? parseInt(limit as string) : undefined);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get('/api/members/:id/transactions', isAuthenticated, async (req, res) => {
    try {
      const transactions = await storage.getTransactionsByMember(await storage.resolveMemberId(req.params.id));
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching member transactions:", error);
      res.status(500).json({ message: "Failed to fetch member transactions" });
    }
  });

  app.get('/api/savings-accounts/:id/statement', isAuthenticated, async (req, res) => {
    try {
      const savingsAccountId = await storage.resolveSavingsAccountId(req.params.id);
      const account = await storage.getSavingsAccount(savingsAccountId);
      
      if (!account) {
        return res.status(404).json({ message: "Savings account not found" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const result = await storage.getTransactionsBySavingsAccountPaginated(savingsAccountId, {
        startDate,
        endDate,
        page,
        limit,
      });

      res.json({
        account,
        transactions: result.transactions,
        total: result.total,
        totalDeposits: result.totalDeposits,
        totalWithdrawals: result.totalWithdrawals,
        totalInterest: result.totalInterest,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      console.error("Error fetching account statement:", error);
      res.status(500).json({ message: "Failed to fetch account statement" });
    }
  });

  app.patch('/api/transactions/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const transactionId = await storage.resolveTransactionId(req.params.id);
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.transactionType === 'withdrawal' && transaction.savingsAccountId) {
        // Process withdrawal
        await storage.updateSavingsAccountBalance(
          transaction.savingsAccountId, 
          transaction.amount, 
          'subtract'
        );
      }

      const updatedTransaction = await storage.updateTransactionStatus(transactionId, 'completed');
      res.json(updatedTransaction);
    } catch (error) {
      console.error("Error approving transaction:", error);
      res.status(500).json({ message: "Failed to approve transaction" });
    }
  });

  // Guarantor routes
  app.post('/api/guarantors', isAuthenticated, async (req: any, res) => {
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
      broadcastDataUpdate(['/api/guarantors', '/api/loans']);
      res.status(201).json(guarantor);
    } catch (error: any) {
      console.error("Error creating guarantor:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      if (error?.code === '23505' || error?.message?.includes('guarantors_loan_member_unique')) {
        return res.status(400).json({ message: "This member is already a guarantor for this loan" });
      }
      res.status(500).json({ message: "Failed to create guarantor" });
    }
  });

  // Bulk add guarantors to a loan
  app.post('/api/loans/:loanId/guarantors', isAuthenticated, async (req: any, res) => {
    try {
      const loanId = await storage.resolveLoanId(req.params.loanId);
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
      if (loanMemberTotalSavings >= loanPrincipal) {
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
      for (const guarantorData of guarantorList) {
        const guarantor = await storage.createGuarantor({
          loanId,
          guarantorMemberId: guarantorData.guarantorMemberId,
          guaranteeAmount: guarantorData.guaranteeAmount,
          status: 'pending'
        });
        createdGuarantors.push(guarantor);
      }

      broadcastDataUpdate(['/api/guarantors', '/api/loans']);
      res.status(201).json(createdGuarantors);
    } catch (error) {
      console.error("Error adding guarantors to loan:", error);
      res.status(500).json({ message: "Failed to add guarantors to loan" });
    }
  });

  app.get('/api/guarantors/loan/:loanId', isAuthenticated, async (req, res) => {
    try {
      const loanId = await storage.resolveLoanId(req.params.loanId);
      const guarantors = await storage.getGuarantorsByLoan(loanId);
      res.json(guarantors);
    } catch (error) {
      console.error("Error fetching guarantors by loan:", error);
      res.status(500).json({ message: "Failed to fetch guarantors" });
    }
  });

  // Guarantor approval endpoints
  app.patch('/api/guarantors/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const guarantorId = await storage.resolveGuarantorId(req.params.id);
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

      broadcastDataUpdate(['/api/guarantors', '/api/loans', '/api/loans/approval']);
      res.json(updatedGuarantor);
    } catch (error) {
      console.error("Error approving guarantor:", error);
      res.status(500).json({ message: "Failed to approve guarantor request" });
    }
  });

  app.patch('/api/guarantors/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const guarantorId = await storage.resolveGuarantorId(req.params.id);
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

      broadcastDataUpdate(['/api/guarantors', '/api/loans']);
      res.json(updatedGuarantor);
    } catch (error) {
      console.error("Error rejecting guarantor:", error);
      res.status(500).json({ message: "Failed to reject guarantor request" });
    }
  });

  app.patch('/api/guarantors/:id/resend', isAuthenticated, async (req: any, res) => {
    try {
      const guarantorId = await storage.resolveGuarantorId(req.params.id);
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
      res.json(updatedGuarantor);
    } catch (error) {
      console.error("Error resending guarantor request:", error);
      res.status(500).json({ message: "Failed to resend guarantor request" });
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
      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending guarantor requests:", error);
      res.status(500).json({ message: "Failed to fetch pending guarantor requests" });
    }
  });

  app.get('/api/guarantors/member/:memberId', isAuthenticated, async (req, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.memberId);
      const guarantors = await storage.getGuarantorsByMember(memberId);
      res.json(guarantors);
    } catch (error) {
      console.error("Error fetching guarantors by member:", error);
      res.status(500).json({ message: "Failed to fetch guarantors" });
    }
  });

  app.get('/api/guarantors/pending/:memberId', isAuthenticated, async (req, res) => {
    try {
      const memberId = await storage.resolveMemberId(req.params.memberId);
      const pendingRequests = await storage.getPendingGuarantorRequests(memberId);
      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending guarantor requests:", error);
      res.status(500).json({ message: "Failed to fetch pending requests" });
    }
  });

  app.patch('/api/guarantors/:id/approve', isAuthenticated, async (req, res) => {
    try {
      const guarantorId = await storage.resolveGuarantorId(req.params.id);
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
      const guarantorId = await storage.resolveGuarantorId(req.params.id);
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
      const filters = {
        userId: req.query.userId as string,
        resource: req.query.resource as string,
        action: req.query.action as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100
      };
      
      const logs = await storage.getAuditLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // RBAC Management Endpoints
  app.get('/api/rbac/roles', isAuthenticated, requirePermission('read', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roles = await storage.getAllRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get('/api/rbac/roles/:id', isAuthenticated, requirePermission('read', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roleId = parseInt(req.params.id);
      const role = await storage.getRoleById(roleId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
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
      const roleId = parseInt(req.params.id);
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
      const roleId = parseInt(req.params.id);
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
      
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
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
      const roleId = parseInt(req.params.id);
      const permissions = await storage.getPermissionsByRole(roleId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  app.put('/api/rbac/roles/:id/permissions', isAuthenticated, requirePermission('update', 'roles'), async (req: AuthRequest, res) => {
    try {
      const roleId = parseInt(req.params.id);
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
      const memberId = await storage.resolveMemberId(req.params.id);
      
      const [member] = await db
        .select({
          role: members.role
        })
        .from(members)
        .where(eq(members.id, memberId));

      if (!member) {
        res.status(404).json({ message: 'Member not found' });
        return;
      }

      const memberRolesList = await storage.getMemberRoles(memberId);
      res.json(memberRolesList);
    } catch (error) {
      console.error('Error fetching member roles:', error);
      res.status(500).json({ message: 'Failed to fetch member roles' });
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
      const { productType } = req.params;
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
      const { uuid } = req.params;
      // Get loan by UUID first to get the ID for legacy methods
      const loan = await storage.getLoanByUuid(uuid);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      const schedule = await storage.getAmortizationSchedule(loan.id);
      res.json(schedule);
    } catch (error) {
      console.error("Error fetching amortization schedule:", error);
      res.status(500).json({ message: "Failed to fetch amortization schedule" });
    }
  });

  app.post('/api/loans/:uuid/generate-amortization', isAuthenticated, requirePermission('create', 'amortization'), async (req: any, res) => {
    try {
      const { uuid } = req.params;
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
        details: `Generated amortization schedule for loan ${req.params.id}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(schedule);
    } catch (error) {
      console.error("Error generating amortization schedule:", error);
      res.status(500).json({ message: "Failed to generate amortization schedule" });
    }
  });

  app.post('/api/loans/:uuid/calculate-interest', isAuthenticated, requirePermission('create', 'interest-calculations'), async (req: any, res) => {
    try {
      const { uuid } = req.params;
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

      res.json(result);
    } catch (error) {
      console.error("Error calculating interest:", error);
      res.status(500).json({ message: "Failed to calculate interest" });
    }
  });

  app.get('/api/loans/:uuid/interest-calculations', isAuthenticated, async (req: any, res) => {
    try {
      const { uuid } = req.params;
      // Get loan by UUID first to get the ID for legacy methods
      const loan = await storage.getLoanByUuid(uuid);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      const calculations = await storage.getInterestCalculations(loan.id);
      res.json(calculations);
    } catch (error) {
      console.error("Error fetching interest calculations:", error);
      res.status(500).json({ message: "Failed to fetch interest calculations" });
    }
  });

  app.post('/api/loans/:id/early-payment-calculation', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
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
      const { isRead, type, priority, limit } = req.query;
      
      const filters: any = {};
      if (isRead !== undefined) filters.isRead = isRead === 'true';
      if (type) filters.type = type;
      if (priority) filters.priority = priority;
      if (limit) filters.limit = parseInt(limit);

      const notifications = await storage.getNotifications(userId, filters);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
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
      res.json({ count });
    } catch (error) {
      console.error("Error fetching notification count:", error);
      res.status(500).json({ message: "Failed to fetch notification count" });
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

      res.json(notification);
    } catch (error) {
      console.error("Error creating test notification:", error);
      res.status(500).json({ message: "Failed to create test notification" });
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
      
      res.status(201).json(notification);
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = user.id;
      const notificationId = parseInt(req.params.id);
      
      const notification = await storage.markNotificationAsRead(notificationId, userId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
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
      const notificationId = parseInt(req.params.id);
      
      const deleted = await storage.deleteNotification(notificationId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json({ message: "Notification deleted" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
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
      const id = parseInt(req.params.id);
      const loanType = await storage.getLoanType(id);
      if (!loanType) {
        return res.status(404).json({ message: 'Loan type not found' });
      }
      res.json(loanType);
    } catch (error) {
      console.error('Error fetching loan type:', error);
      res.status(500).json({ message: 'Failed to fetch loan type' });
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
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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

      res.json({ message: 'Loan type deleted successfully' });
    } catch (error) {
      console.error('Error deleting loan type:', error);
      res.status(500).json({ message: 'Failed to delete loan type' });
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
      const id = parseInt(req.params.id);
      const loanTerm = await storage.getLoanTerm(id);
      if (!loanTerm) {
        return res.status(404).json({ message: 'Loan term not found' });
      }
      res.json(loanTerm);
    } catch (error) {
      console.error('Error fetching loan term:', error);
      res.status(500).json({ message: 'Failed to fetch loan term' });
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
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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

      res.json({ message: 'Loan term deleted successfully' });
    } catch (error) {
      console.error('Error deleting loan term:', error);
      res.status(500).json({ message: 'Failed to delete loan term' });
    }
  });

  // Reports API endpoints
  app.get('/api/reports/:reportType', isAuthenticated, async (req: any, res) => {
    try {
      const { reportType } = req.params;
      const { startDate, endDate, memberNumber, status } = req.query;
      const userId = getUserId(req);
      const reportUser = await storage.getUser(userId!);
      const reportMember = await storage.getMemberByUserId(userId!);
      const reportRoles = reportMember ? await storage.getMemberRoles(reportMember.id) : (reportUser?.role ? [reportUser.role] : []);
      const canAccessReports = reportRoles.some((r: string) => ['admin', 'manager', 'committee', 'teller'].includes(r));
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
            if (balance <= 0) return false;
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
              loanType: l.loanType || 'personal',
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
          return res.status(400).json({ message: "Invalid report type" });
      }

      res.json(reportData);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get('/api/reports/download/:reportType', isAuthenticated, async (req: any, res) => {
    try {
      const { reportType } = req.params;
      const format = (req.query.format as string) || 'csv';
      const { startDate, endDate, memberNumber, status } = req.query;
      const userId = getUserId(req);
      const dlUser = await storage.getUser(userId!);
      const dlMember = await storage.getMemberByUserId(userId!);
      const dlRoles = dlMember ? await storage.getMemberRoles(dlMember.id) : (dlUser?.role ? [dlUser.role] : []);
      const canDl = dlRoles.some((r: string) => ['admin', 'manager', 'committee', 'teller'].includes(r));
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
            if (bal <= 0) return false;
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
          return res.status(400).json({ message: "Invalid report type" });
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
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        const colWidths = headers.map(h => {
          let maxLen = h.length;
          for (const row of rows) { const val = String(row[h] ?? ''); if (val.length > maxLen) maxLen = val.length; }
          return { wch: Math.min(maxLen + 2, 40) };
        });
        ws['!cols'] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, reportType.charAt(0).toUpperCase() + reportType.slice(1));
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        return res.send(buf);
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

      res.status(400).json({ message: "Unsupported format" });
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ message: "Failed to download report" });
    }
  });

  // Data Import API endpoints
  const multer = await import('multer');
  const upload = multer.default({ dest: 'uploads/' });
  
  app.post('/api/import/savings', isAuthenticated, requirePermission('update', 'system-settings'), upload.single('file'), async (req: any, res) => {
    try {
      const { importSavingsFromExcel } = await import('./importUtils');
      
      // Use uploaded file or fallback to attached file
      const filePath = req.file ? req.file.path : './attached_assets/savings_1772043613995.xlsx';
      const createNewMembers = req.body?.createNewMembers !== 'false';
      
      console.log('Starting import from:', filePath, '| createNewMembers:', createNewMembers);
      const result = await importSavingsFromExcel(filePath, { createNewMembers, userId: getUserId(req) });
      
      // Create audit log
      await storage.createAuditLog({
        userId: getUserId(req) || '',
        action: 'import',
        resource: 'savings_accounts',
        resourceId: 'bulk_import',
        details: `Imported ${result.importedMembers} members and ${result.importedAccounts} savings accounts. ${result.errors?.length || 0} errors.`,
      });

      broadcastDataUpdate(['/api/members', '/api/savings', '/api/transactions', '/api/dashboard']);
      res.json(result);
    } catch (error) {
      console.error('Error importing savings data:', error);
      res.status(500).json({ message: 'Failed to import savings data', error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      // Clean up uploaded file if it exists
      if (req.file) {
        const fs = await import('fs');
        try {
          await fs.promises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up uploaded file:', unlinkError);
        }
      }
    }
  });

  // Import loans from Excel
  app.post('/api/import/members', isAuthenticated, requirePermission('update', 'system-settings'), upload.single('file'), async (req: any, res) => {
    try {
      const { importMembersFromExcel } = await import('./importUtils');
      
      const filePath = req.file ? req.file.path : './attached_assets/members_1772094048114.xlsx';
      
      const updateExisting = req.body?.updateExisting === 'true';
      console.log('Starting member import from:', filePath, '| updateExisting:', updateExisting);
      const result = await importMembersFromExcel(filePath, { userId: getUserId(req), updateExisting });
      
      await storage.createAuditLog({
        userId: getUserId(req) || '',
        action: 'import',
        resource: 'members',
        resourceId: 'bulk_import',
        details: `Imported ${result.importedMembers} members and ${result.importedAccounts} savings accounts. ${result.errors?.length || 0} errors.`,
      });

      broadcastDataUpdate(['/api/members', '/api/savings', '/api/dashboard']);
      res.json(result);
    } catch (error) {
      console.error('Error importing member data:', error);
      res.status(500).json({ message: 'Failed to import member data', error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      if (req.file) {
        const fs = await import('fs');
        try {
          await fs.promises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up uploaded file:', unlinkError);
        }
      }
    }
  });

  app.post('/api/import/loans', isAuthenticated, requirePermission('update', 'system-settings'), upload.single('file'), async (req: any, res) => {
    try {
      const { importLoansFromExcel } = await import('./importUtils');
      
      const filePath = req.file ? req.file.path : '';
      const loanTypeId = req.body?.loanTypeId ? parseInt(req.body.loanTypeId) : undefined;
      
      if (!filePath) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      if (!loanTypeId) {
        return res.status(400).json({ message: 'Loan type is required. Please select a loan type before uploading.' });
      }

      console.log('Starting loan import from:', filePath, 'with loanTypeId:', loanTypeId);
      const result = await importLoansFromExcel(filePath, { userId: getUserId(req), loanTypeId });
      
      await storage.createAuditLog({
        userId: getUserId(req) || '',
        action: 'import',
        resource: 'loans',
        resourceId: 'bulk_import',
        details: `Imported ${result.importedLoans || 0} loans. ${result.errors?.length || 0} errors.`,
      });

      broadcastDataUpdate(['/api/loans', '/api/dashboard']);
      res.json(result);
    } catch (error) {
      console.error('Error importing loan data:', error);
      res.status(500).json({ message: 'Failed to import loan data', error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      // Clean up uploaded file if it exists
      if (req.file) {
        const fs = await import('fs');
        try {
          await fs.promises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up uploaded file:', unlinkError);
        }
      }
    }
  });

  // Bulk CSV import for loan repayments
  app.post('/api/import/loan-repayments', isAuthenticated, requirePermission('update', 'system-settings'), upload.single('file'), async (req: any, res) => {
    try {
      const filePath = req.file ? req.file.path : null;
      if (!filePath) return res.status(400).json({ message: 'No file uploaded' });

      const fs = await import('fs');
      let csvContent = await fs.promises.readFile(filePath, 'utf-8');
      csvContent = csvContent.replace(/^\uFEFF/, '');
      const lines = csvContent.split('\n').map(l => l.replace(/\r$/, '').trim()).filter(l => l.length > 0);

      if (lines.length < 3) {
        return res.status(400).json({ message: 'CSV file has insufficient rows' });
      }

      const loanTypeId = req.body?.loanTypeId ? parseInt(req.body.loanTypeId) : null;
      if (!loanTypeId) {
        return res.status(400).json({ message: 'Loan type is required for loan repayment imports' });
      }

      const loanType = await storage.getLoanType(loanTypeId);
      if (!loanType) {
        return res.status(400).json({ message: 'Invalid loan type selected' });
      }

      const sanitize = (val: string | undefined) =>
        (val || '').replace(/[\t\r\n\x00-\x1F\x7F\uFEFF]/g, '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
      const sanitizeAmount = (val: string | undefined) =>
        (val || '').replace(/[\t\r\n\x00-\x1F\x7F\uFEFF"'\s]/g, '').replace(/,/g, '');

      const allMembers = await storage.getAllMembers();
      const existingTxns = await storage.getRecentTransactions(10000);
      const existingRefs = new Set(existingTxns.filter((t: any) => t.referenceNumber).map((t: any) => t.referenceNumber));
      const userId = getUserId(req)!;
      const errors: any[] = [];
      let successCount = 0;
      let totalAmount = 0;
      let skippedNoMember = 0;
      let skippedNoLoan = 0;

      for (let i = 2; i < lines.length; i++) {
        try {
          const cols = lines[i].split(',').map(c => sanitize(c));
          if (cols.length < 12) { errors.push({ row: i + 1, error: 'Insufficient columns' }); continue; }

          const txStatus = cols[6].toLowerCase();
          if (txStatus && txStatus !== 'success') {
            errors.push({ row: i + 1, error: `Transaction status: ${txStatus}`, data: { account: cols[10] } });
            continue;
          }

          const remitterAccount = cols[10];
          const amount = parseFloat(sanitizeAmount(cols[9]) || '0');
          const reference = cols[7];
          const description = cols[11] || 'Loan Repayment';

          if (!remitterAccount || amount <= 0) {
            errors.push({ row: i + 1, error: 'Missing account number or invalid amount' });
            continue;
          }

          if (reference && existingRefs.has(reference)) {
            errors.push({ row: i + 1, error: `Duplicate reference: ${reference}`, data: { remitterAccount, amount } });
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
            errors.push({ row: i + 1, error: `No member found for account: ${remitterAccount}`, data: { remitterAccount, amount } });
            continue;
          }

          const activeLoans = await storage.getMemberActiveLoans(member.id);
          const matchingLoan = activeLoans.find((l: any) => 
            l.loanType === loanType.name || l.loanType === loanType.displayName || l.loanTypeId === loanTypeId
          );
          if (!matchingLoan) {
            skippedNoLoan++;
            errors.push({ row: i + 1, error: `No active ${loanType.displayName} loan for member: ${member.fullName} (${member.memberNumber})`, data: { remitterAccount, amount } });
            continue;
          }

          const loan = matchingLoan;
          const outstandingBalance = parseFloat(loan.outstandingBalance || '0');
          const repaymentAmount = Math.min(amount, outstandingBalance);

          if (repaymentAmount <= 0) {
            errors.push({ row: i + 1, error: `Loan already fully paid for ${member.fullName}`, data: { remitterAccount, amount } });
            continue;
          }

          const savingsAccounts = await storage.getSavingsAccountsByMember(member.id);
          const savingsAccount = savingsAccounts.find((s: any) => s.accountType === 'regular') || savingsAccounts[0];

          const newBalance = Math.max(0, outstandingBalance - repaymentAmount);
          await storage.updateLoanBalance(loan.id, newBalance.toFixed(2));

          if (newBalance <= 0) {
            await storage.updateLoanBalance(loan.id, '0.00');
            await storage.updateLoanStatus(loan.id, 'completed');
          }

          await storage.createTransaction({
            memberId: member.id,
            savingsAccountId: savingsAccount?.id || null,
            loanId: loan.id,
            transactionType: 'loan_payment',
            amount: repaymentAmount.toFixed(2),
            description: description,
            referenceNumber: reference,
            performedBy: userId,
            status: 'completed',
          });

          if (reference) existingRefs.add(reference);
          successCount++;
          totalAmount += repaymentAmount;
        } catch (rowError: any) {
          errors.push({ row: i + 1, error: rowError.message || 'Unknown error' });
        }
      }

      await storage.createAuditLog({
        userId,
        action: 'import',
        resource: 'loan_repayments',
        details: `Bulk loan repayment import (${loanType.displayName}): ${successCount} payments totaling UGX ${totalAmount.toLocaleString()}. ${errors.length} errors. ${skippedNoMember} unmatched accounts. ${skippedNoLoan} no matching loan.`,
      });

      broadcastDataUpdate(['/api/loans', '/api/transactions', '/api/dashboard', '/api/savings']);

      res.json({
        success: true,
        totalRows: lines.length - 2,
        successfulImports: successCount,
        totalAmount,
        skippedNoMember,
        importedMembers: 0,
        importedAccounts: 0,
        errors,
      });
    } catch (error) {
      console.error('Error importing loan repayments:', error);
      res.status(500).json({ message: 'Failed to import loan repayments', error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      if (req.file) {
        const fs = await import('fs');
        try { await fs.promises.unlink(req.file.path); } catch (e) {}
      }
    }
  });

  // Bulk CSV import for savings deposits
  app.post('/api/import/bulk-savings', isAuthenticated, requirePermission('update', 'system-settings'), upload.single('file'), async (req: any, res) => {
    try {
      const filePath = req.file ? req.file.path : null;
      if (!filePath) return res.status(400).json({ message: 'No file uploaded' });

      const fs = await import('fs');
      let csvContent = await fs.promises.readFile(filePath, 'utf-8');
      csvContent = csvContent.replace(/^\uFEFF/, '');
      const lines = csvContent.split('\n').map(l => l.replace(/\r$/, '').trim()).filter(l => l.length > 0);

      if (lines.length < 3) {
        return res.status(400).json({ message: 'CSV file has insufficient rows' });
      }

      const sanitize = (val: string | undefined) =>
        (val || '').replace(/[\t\r\n\x00-\x1F\x7F\uFEFF]/g, '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
      const sanitizeAmount = (val: string | undefined) =>
        (val || '').replace(/[\t\r\n\x00-\x1F\x7F\uFEFF"'\s]/g, '').replace(/,/g, '');

      const allMembers = await storage.getAllMembers();
      const existingTxns = await storage.getRecentTransactions(10000);
      const existingRefs = new Set(existingTxns.filter((t: any) => t.referenceNumber).map((t: any) => t.referenceNumber));
      const userId = getUserId(req)!;
      const errors: any[] = [];
      let successCount = 0;
      let totalAmount = 0;
      let skippedNoMember = 0;

      for (let i = 2; i < lines.length; i++) {
        try {
          const cols = lines[i].split(',').map(c => sanitize(c));
          if (cols.length < 12) { errors.push({ row: i + 1, error: 'Insufficient columns' }); continue; }

          const txStatus = cols[6].toLowerCase();
          if (txStatus && txStatus !== 'success') {
            errors.push({ row: i + 1, error: `Transaction status: ${txStatus}`, data: { account: cols[10] } });
            continue;
          }

          const remitterAccount = cols[10];
          const amount = parseFloat(sanitizeAmount(cols[9]) || '0');
          const reference = cols[7];
          const description = cols[11] || 'Savings Deposit';

          if (!remitterAccount || amount <= 0) {
            errors.push({ row: i + 1, error: 'Missing account number or invalid amount' });
            continue;
          }

          if (reference && existingRefs.has(reference)) {
            errors.push({ row: i + 1, error: `Duplicate reference: ${reference}`, data: { remitterAccount, amount } });
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
            errors.push({ row: i + 1, error: `No member found for account: ${remitterAccount}`, data: { remitterAccount, amount } });
            continue;
          }

          const savingsAccounts = await storage.getSavingsAccountsByMember(member.id);
          let savingsAccount = savingsAccounts.find((s: any) => s.accountType === 'regular') || savingsAccounts[0];

          if (!savingsAccount) {
            errors.push({ row: i + 1, error: `No savings account for member: ${member.fullName} (${member.memberNumber})`, data: { remitterAccount, amount } });
            continue;
          }

          await storage.updateSavingsAccountBalance(savingsAccount.id, amount.toFixed(2), 'add');

          await storage.createTransaction({
            memberId: member.id,
            savingsAccountId: savingsAccount.id,
            transactionType: 'deposit',
            amount: amount.toFixed(2),
            description: description,
            referenceNumber: reference,
            performedBy: userId,
            status: 'completed',
          });

          if (reference) existingRefs.add(reference);
          successCount++;
          totalAmount += amount;
        } catch (rowError: any) {
          errors.push({ row: i + 1, error: rowError.message || 'Unknown error' });
        }
      }

      await storage.createAuditLog({
        userId,
        action: 'import',
        resource: 'bulk_savings',
        details: `Bulk savings deposit import: ${successCount} deposits totaling UGX ${totalAmount.toLocaleString()}. ${errors.length} errors. ${skippedNoMember} unmatched accounts.`,
      });

      broadcastDataUpdate(['/api/savings', '/api/transactions', '/api/dashboard', '/api/members']);

      res.json({
        success: true,
        totalRows: lines.length - 2,
        successfulImports: successCount,
        totalAmount,
        skippedNoMember,
        importedMembers: 0,
        importedAccounts: 0,
        errors,
      });
    } catch (error) {
      console.error('Error importing bulk savings:', error);
      res.status(500).json({ message: 'Failed to import bulk savings', error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      if (req.file) {
        const fs = await import('fs');
        try { await fs.promises.unlink(req.file.path); } catch (e) {}
      }
    }
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

  app.post('/api/financial-years', isAuthenticated, async (req, res) => {
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
      res.status(201).json(financialYear);
    } catch (error) {
      console.error('Error creating financial year:', error);
      res.status(500).json({ message: 'Failed to create financial year' });
    }
  });

  app.put('/api/financial-years/:id/activate', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const financialYear = await storage.setActiveFinancialYear(id);
      res.json(financialYear);
    } catch (error) {
      console.error('Error activating financial year:', error);
      res.status(500).json({ message: 'Failed to activate financial year' });
    }
  });

  // Balance snapshots
  app.post('/api/balance-snapshots/create-all', isAuthenticated, async (req, res) => {
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

  app.post('/api/interest-calculations/calculate-all', isAuthenticated, async (req, res) => {
    try {
      const { financialYearId } = req.body;
      const calculations = await storage.calculateInterestForAllMembers(financialYearId);
      res.status(201).json(calculations);
    } catch (error) {
      console.error('Error calculating interest for all members:', error);
      res.status(500).json({ message: 'Failed to calculate interest' });
    }
  });

  app.post('/api/interest-calculations/calculate-member', isAuthenticated, async (req, res) => {
    try {
      const { memberId, financialYearId } = req.body;
      const calculation = await storage.calculateInterestForMember(memberId, financialYearId);
      res.status(201).json(calculation);
    } catch (error) {
      console.error('Error calculating interest for member:', error);
      res.status(500).json({ message: 'Failed to calculate interest for member' });
    }
  });

  app.put('/api/interest-calculations/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const approvedBy = getUserId(req)!;
      const calculation = await storage.approveInterestCalculation(id, approvedBy);
      res.json(calculation);
    } catch (error) {
      console.error('Error approving interest calculation:', error);
      res.status(500).json({ message: 'Failed to approve interest calculation' });
    }
  });

  app.put('/api/interest-calculations/approve-all', isAuthenticated, async (req: any, res) => {
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
      res.json({ approved, total: calculations.length });
    } catch (error) {
      console.error('Error approving all interest calculations:', error);
      res.status(500).json({ message: 'Failed to approve all interest calculations' });
    }
  });

  app.put('/api/interest-calculations/post-all', isAuthenticated, async (req: any, res) => {
    try {
      const { financialYearId } = req.body;
      if (!financialYearId) {
        return res.status(400).json({ message: 'Financial year is required' });
      }
      const calculations = await storage.getInterestCalculations(financialYearId);
      const approved = calculations.filter((c: any) => c.status === 'approved');
      let posted = 0;
      for (const calc of approved) {
        await storage.postInterestCalculation(calc.id);
        posted++;
      }
      res.json({ posted, total: calculations.length });
    } catch (error) {
      console.error('Error posting all interest calculations:', error);
      res.status(500).json({ message: 'Failed to post all interest calculations' });
    }
  });

  app.put('/api/interest-calculations/:id/post', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const calculation = await storage.postInterestCalculation(id);
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

  app.post('/api/interest-payments', isAuthenticated, async (req, res) => {
    try {
      const payment = await storage.createInterestPayment(req.body);
      res.status(201).json(payment);
    } catch (error) {
      console.error('Error creating interest payment:', error);
      res.status(500).json({ message: 'Failed to create interest payment' });
    }
  });

  app.put('/api/interest-payments/:id/process', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
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
      const financialYearId = parseInt(req.params.financialYearId);
      const report = await storage.generateInterestReport(financialYearId);
      res.json(report);
    } catch (error) {
      console.error('Error generating interest report:', error);
      res.status(500).json({ message: 'Failed to generate interest report' });
    }
  });

  return httpServer;
}
