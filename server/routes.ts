import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { requirePermission, filterDataByRole, type AuthRequest, filterMembersByRole, filterLoansByRole, filterTransactionsByRole } from "./rbac-middleware";
import { insertMemberSchema, insertSavingsAccountSchema, insertLoanSchema, insertTransactionSchema, insertGuarantorSchema, insertNotificationSchema, members } from "@shared/schema";
import { businessRulesValidator } from "./business-rules-validator";
import { z } from "zod";
import { db } from "./db";
import { eq } from "drizzle-orm";

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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has a member profile
      const member = await storage.getMemberByUserId(userId);
      
      if (member) {
        // Get roles for the member
        const roles = await storage.getMemberRoles(member.id);
        
        // Return user with member data including roles array
        res.json({
          ...user,
          member: {
            ...member,
            roles: roles.length > 0 ? roles : ['member'] // Default to member role if no roles
          }
        });
      } else {
        res.json({ ...user, member });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get current user's permissions
  app.get('/api/auth/permissions', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.claims!.sub!;
      const member = await storage.getMemberByUserId(userId);
      
      if (!member) {
        return res.json([]); // Return empty permissions if no member profile
      }
      
      // Get all roles for this member
      const memberRoles = await storage.getMemberRoles(member.id);
      const roleNames = memberRoles.length > 0 ? memberRoles : ['member'];
      
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
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { firstName, lastName, email } = req.body;
      
      // Validate required fields
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "First name, last name, and email are required" });
      }

      // Update user profile
      const updatedUser = await storage.upsertUser({
        id: userId,
        email,
        firstName,
        lastName,
        profileImageUrl: req.user?.claims?.profile_image_url || null,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Update user settings
  app.patch('/api/auth/settings', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
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

  // Get admin settings
  app.get('/api/admin/settings', isAuthenticated, requirePermission('read', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      // In a real application, you'd fetch these from a system_settings table
      const settings = {
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
        autoBackupEnabled: true,
        backupFrequency: "daily",
        logRetentionDays: 90,
      };
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      res.status(500).json({ message: "Failed to fetch admin settings" });
    }
  });

  // Update admin settings
  app.patch('/api/admin/settings', isAuthenticated, requirePermission('update', 'system-settings'), async (req: AuthRequest, res) => {
    try {
      const settings = req.body;
      
      // In a real application, you'd update these in a system_settings table
      // For now, we'll just return success
      res.json({ 
        message: "Admin settings updated successfully", 
        settings 
      });
    } catch (error) {
      console.error("Error updating admin settings:", error);
      res.status(500).json({ message: "Failed to update admin settings" });
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
    const member = await storage.getMemberByUserId(userId);
    if (!member) return false;
    
    const roles = await storage.getMemberRoles(member.id);
    return roles.some(role => ['committee', 'admin'].includes(role));
  };

  const hasApprovalRole = async (userId: string, requiredRole: string): Promise<boolean> => {
    const member = await storage.getMemberByUserId(userId);
    if (!member) return false;
    
    const roles = await storage.getMemberRoles(member.id);
    
    // Admin can perform any approval
    if (roles.includes('admin')) return true;
    
    // Check specific role permissions
    if (requiredRole === 'teller' && roles.includes('teller')) return true;
    if (requiredRole === 'committee' && roles.includes('committee')) return true;
    if (requiredRole === 'manager' && roles.includes('manager')) return true;
    
    return false;
  };

  // Member routes
  app.post('/api/members', isAuthenticated, async (req: any, res) => {
    try {
      // Check if ID number already exists
      const existingMemberByIdNumber = await storage.getMemberByIdNumber(req.body.idNumber);
      if (existingMemberByIdNumber) {
        return res.status(400).json({ 
          message: "A member with this ID number already exists",
          field: "idNumber"
        });
      }

      // Check if user already has a member profile
      const existingMemberByUserId = await storage.getMemberByUserId(req.user?.claims?.sub);
      if (existingMemberByUserId) {
        return res.status(400).json({ 
          message: "You already have a member profile",
          field: "userId"
        });
      }
      
      // Generate unique member number
      const memberNumber = `BCS${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      // Add the auto-generated fields to the request body before validation
      const memberData = {
        ...req.body,
        memberNumber,
        userId: req.user?.claims?.sub,
        status: 'pending', // Requires committee approval
        joinDate: new Date(),
      };
      
      // Create member
      const member = await storage.createMember(memberData as any);
      
      // Generate unique account number
      const accountNumber = `SAV${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      // Create default savings account
      await storage.createSavingsAccount({
        memberId: member.id,
        accountNumber,
        accountType: 'regular',
        balance: req.body.initialDeposit || '0.00',
      });

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
      const userId = req.user?.claims?.sub;
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
      const userId = req.user?.claims?.sub;
      if (!await isCommitteeOrAdmin(userId)) {
        return res.status(403).json({ message: "Access denied. Committee or admin role required." });
      }

      const { id } = req.params;
      const { comments } = req.body;
      
      const member = await storage.approveMember(parseInt(id), userId, comments);
      
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
      const userId = req.user?.claims?.sub;
      if (!await isCommitteeOrAdmin(userId)) {
        return res.status(403).json({ message: "Access denied. Committee or admin role required." });
      }

      const { id } = req.params;
      const { comments } = req.body;
      
      const member = await storage.rejectMember(parseInt(id), userId, comments);
      res.json({ message: "Member application rejected", member });
    } catch (error) {
      console.error("Error rejecting member:", error);
      res.status(500).json({ message: "Failed to reject member" });
    }
  });

  // Get specific member by ID
  app.get('/api/members/:id', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = parseInt(req.params.id);
      if (isNaN(memberId)) {
        return res.status(400).json({ message: "Invalid member ID" });
      }

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
      const memberId = parseInt(req.params.id);
      const { roles } = req.body;
      const userId = req.user?.claims?.sub;
      
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
      const memberId = parseInt(req.params.id);
      const roles = await storage.getMemberRoles(memberId);
      res.json(roles);
    } catch (error) {
      console.error("Error fetching member roles:", error);
      res.status(500).json({ message: "Failed to fetch member roles" });
    }
  });

  app.get('/api/members/:id', isAuthenticated, async (req: AuthRequest, res) => {
    try {
      // Input validation - ensure ID is a valid positive integer
      const memberId = parseInt(req.params.id);
      if (!req.params.id || isNaN(memberId) || memberId <= 0) {
        return res.status(400).json({ message: "Invalid member ID" });
      }

      // Additional security check - prevent large integers that could cause issues
      if (memberId > Number.MAX_SAFE_INTEGER) {
        return res.status(400).json({ message: "Invalid member ID" });
      }

      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      // Get user's member record to check their roles and permissions
      const requestingMember = await storage.getMemberByUserId(userId);
      if (!requestingMember) {
        return res.status(403).json({ message: "Access denied - no member record found" });
      }

      // Get user's roles for permission checking
      const roleNames = await storage.getMemberRoles(requestingMember.id);

      // Access control logic:
      // 1. Members can only view their own data
      // 2. Staff (teller, committee, manager, admin) can view any member data
      const isStaff = roleNames.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role));
      const isOwnRecord = requestingMember.id === memberId;

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
          memberId: requestingMember.id,
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
        userId = req.user?.claims?.sub;
      }
      
      if (!userId) {
        return res.status(400).json({ message: "User ID not provided" });
      }
      
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        // Create member for authenticated user if doesn't exist
        if (userId === req.user?.claims?.sub) {
          // First create/update the user
          await storage.upsertUser({
            id: userId,
            email: req.user.claims.email,
            firstName: req.user.claims.first_name,
            lastName: req.user.claims.last_name,
            profileImageUrl: req.user.claims.profile_image_url,
          });
          
          const newMember = await storage.createMember({
            userId: userId,
            memberNumber: `M${Date.now()}`,
            fullName: `${req.user.claims.first_name || ''} ${req.user.claims.last_name || ''}`.trim() || 'Unknown',
            idNumber: '',
            dateOfBirth: '2000-01-01',
            phoneNumber: '',
            department: '',
            monthlySavings: '0',
            shareContribution: '20000',
            numberOfShares: 4,
            beneficiaryName: '',
            beneficiaryRelationship: '',
            beneficiaryContact: '',
            status: 'active',
          });
          return res.json(newMember);
        }
        return res.status(404).json({ message: "Member not found" });
      }
      res.json(member);
    } catch (error) {
      console.error("Error fetching member by user:", error);
      res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  // Update member details
  app.patch('/api/members/:id', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const updates = req.body;
      
      // Get requesting member for permission check
      const requestingMember = await storage.getMemberByUserId(req.user?.claims?.sub);
      if (!requestingMember) {
        return res.status(403).json({ message: "Access denied - no member record found" });
      }

      // Get user's roles for permission checking
      const roleNames = await storage.getMemberRoles(requestingMember.id);

      // Access control: members can only update their own data, staff can update any
      const isStaff = roleNames.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role));
      const isOwnRecord = requestingMember.id === memberId;

      if (!isStaff && !isOwnRecord) {
        return res.status(403).json({ message: "Access denied - insufficient permissions" });
      }

      // Update member
      const updatedMember = await storage.updateMember(memberId, updates);
      
      // Log the action
      if (requestingMember) {
        await storage.createAuditLog({
          userId: req.user.claims.sub,
          action: 'update',
          resource: 'member',
          resourceId: memberId.toString(),
          details: `Updated member profile: ${updatedMember.memberNumber}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.json(updatedMember);
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(500).json({ message: "Failed to update member" });
    }
  });

  // Savings account routes
  app.get('/api/members/:id/savings', isAuthenticated, async (req, res) => {
    try {
      const accounts = await storage.getSavingsAccountsByMember(parseInt(req.params.id));
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
        processedBy: (req as any).user?.claims?.sub,
      });

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
        processedBy: (req as any).user?.claims?.sub,
      });

      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Loan eligibility check endpoint  
  app.post('/api/loans/check-eligibility', isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, requestedAmount } = req.body;
      
      if (!memberId || !requestedAmount) {
        return res.status(400).json({ message: "Member ID and requested amount are required" });
      }
      
      const eligibilityResult = await businessRulesValidator.checkLoanEligibility(memberId, requestedAmount);
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
        parseFloat(principalAmount)
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
      
      // Calculate monthly payment (simple calculation)
      const monthlyInterestRate = decimalInterestRate / 12;
      const monthlyPayment = (parseFloat(principalAmount) * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termMonths)) / 
        (Math.pow(1 + monthlyInterestRate, termMonths) - 1);

      // Generate unique loan number
      const loanNumber = `LN${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const loan = await storage.createLoan({
        memberId,
        loanNumber,
        loanType,
        principalAmount,
        interestRate: decimalInterestRate.toFixed(4), // Store as decimal
        termMonths,
        monthlyPayment: monthlyPayment.toFixed(2),
        outstandingBalance: principalAmount,
        status: 'pending',
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
          const hasStaffRole = roles.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role));
          
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

      res.status(201).json(loan);
    } catch (error) {
      console.error("Error creating loan:", error);
      res.status(500).json({ message: "Failed to create loan" });
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
      const memberId = parseInt(req.params.id);
      const loans = await storage.getLoansByMember(memberId);
      res.json(loans);
    } catch (error) {
      console.error("Error fetching member loans:", error);
      res.status(500).json({ message: "Failed to fetch member loans" });
    }
  });

  // Advanced loan approval endpoints
  app.get('/api/loans/approval/:stage', isAuthenticated, async (req: any, res) => {
    try {
      const { stage } = req.params;
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get user's member record to access roles
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.status(403).json({ message: "Member record not found" });
      }
      
      const userRoles = await storage.getMemberRoles(member.id);
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
      const userId = req.user?.claims?.sub;

      if (!await hasApprovalRole(userId, stage)) {
        return res.status(403).json({ message: `Access denied. ${stage} role required.` });
      }

      // Get loan by UUID first to get the ID for legacy methods
      const loanByUuid = await storage.getLoanByUuid(uuid);
      if (!loanByUuid) {
        return res.status(404).json({ message: "Loan not found" });
      }

      const loan = await storage.approveLoanAtStage(loanByUuid.id, stage, userId, comments);
      
      // Create notification for loan approval
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
      
      res.json({ message: `Loan approved at ${stage} stage`, loan });
    } catch (error) {
      console.error(`Error approving loan at ${req.params.stage} stage:`, error);
      res.status(500).json({ message: "Failed to approve loan" });
    }
  });

  app.post('/api/loans/:uuid/reject', isAuthenticated, async (req: any, res) => {
    try {
      const { uuid } = req.params;
      const { reason } = req.body;
      const userId = req.user?.claims?.sub;

      if (!reason?.trim()) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      // Get loan by UUID first to get the ID for legacy methods
      const loanByUuid = await storage.getLoanByUuid(uuid);
      if (!loanByUuid) {
        return res.status(404).json({ message: "Loan not found" });
      }

      const loan = await storage.rejectLoan(loanByUuid.id, userId, reason);
      res.json({ message: "Loan rejected", loan });
    } catch (error) {
      console.error("Error rejecting loan:", error);
      res.status(500).json({ message: "Failed to reject loan" });
    }
  });

  app.get('/api/loans/:uuid/approval-history', isAuthenticated, async (req, res) => {
    try {
      const { uuid } = req.params;
      // Get loan by UUID first to get the ID for legacy methods
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

  app.patch('/api/loans/:id/approve', isAuthenticated, async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      
      // Check if all guarantors have approved before allowing formal approval
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

  app.patch('/api/loans/:id/disburse', isAuthenticated, async (req, res) => {
    try {
      const loan = await storage.updateLoanStatus(parseInt(req.params.id), 'disbursed');
      
      const referenceNumber = `DIS${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      // Create disbursement transaction
      await storage.createTransaction({
        memberId: loan.memberId,
        loanId: loan.id,
        transactionType: 'loan_disbursement',
        amount: loan.principalAmount,
        referenceNumber,
        description: `Loan disbursement - ${loan.loanNumber}`,
        status: 'completed',
        processedBy: (req as any).user?.claims?.sub,
      });

      res.json(loan);
    } catch (error) {
      console.error("Error disbursing loan:", error);
      res.status(500).json({ message: "Failed to disburse loan" });
    }
  });

  app.post('/api/loans/:id/payment', isAuthenticated, async (req, res) => {
    try {
      const { amount, description } = req.body;
      const loanId = parseInt(req.params.id);
      
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
        processedBy: (req as any).user?.claims?.sub,
      });

      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error processing loan payment:", error);
      res.status(500).json({ message: "Failed to process loan payment" });
    }
  });

  app.get('/api/members/:id/loans', isAuthenticated, async (req, res) => {
    try {
      const loans = await storage.getLoansByMember(parseInt(req.params.id));
      res.json(loans);
    } catch (error) {
      console.error("Error fetching member loans:", error);
      res.status(500).json({ message: "Failed to fetch member loans" });
    }
  });

  // Personal data endpoints for member dashboard
  app.get('/api/loans/my-loans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Member record not found" });
      }
      const loans = await storage.getLoansByMember(member.id);
      res.json(loans);
    } catch (error) {
      console.error("Error fetching personal loans:", error);
      res.status(500).json({ message: "Failed to fetch personal loans" });
    }
  });

  app.get('/api/savings/my-savings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const member = await storage.getMemberByUserId(userId);
      if (!member) {
        return res.status(404).json({ message: "Member record not found" });
      }
      const savingsAccounts = await storage.getSavingsAccountsByMember(member.id);
      res.json(savingsAccounts);
    } catch (error) {
      console.error("Error fetching personal savings:", error);
      res.status(500).json({ message: "Failed to fetch personal savings" });
    }
  });

  app.get('/api/transactions/my-transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
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
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      // Get user's member record to check their roles
      const requestingMember = await storage.getMemberByUserId(userId);
      if (!requestingMember) {
        return res.status(403).json({ message: "Access denied - no member record found" });
      }

      // Get user's roles for permission checking
      const roleNames = await storage.getMemberRoles(requestingMember.id);

      // Access control: staff can see all accounts, members see only their own
      const isStaff = roleNames.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role));

      let savingsAccounts;
      if (isStaff) {
        // Staff can see all savings accounts
        savingsAccounts = await storage.getAllSavingsAccounts();
      } else {
        // Members can only see their own accounts
        savingsAccounts = await storage.getSavingsAccountsByMember(requestingMember.id);
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
      const transactions = await storage.getTransactionsByMember(parseInt(req.params.id));
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching member transactions:", error);
      res.status(500).json({ message: "Failed to fetch member transactions" });
    }
  });

  app.patch('/api/transactions/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const transactionId = parseInt(req.params.id);
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
      
      // Validate that guarantor member is approved/active
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
      
      const guarantor = await storage.createGuarantor(validatedData);
      res.status(201).json(guarantor);
    } catch (error) {
      console.error("Error creating guarantor:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create guarantor" });
    }
  });

  // Bulk add guarantors to a loan
  app.post('/api/loans/:loanId/guarantors', isAuthenticated, async (req: any, res) => {
    try {
      const loanId = parseInt(req.params.loanId);
      const { guarantors: guarantorList } = req.body;

      if (!Array.isArray(guarantorList) || guarantorList.length === 0) {
        return res.status(400).json({ message: "At least one guarantor is required" });
      }

      // Validate loan exists and belongs to user or user has permission
      const loan = await storage.getLoan(loanId);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }

      // Validate all guarantor members are approved/active before creating any
      const invalidGuarantors = [];
      for (const guarantorData of guarantorList) {
        const guarantorMember = await storage.getMember(guarantorData.guarantorMemberId);
        if (!guarantorMember) {
          invalidGuarantors.push(`Member ID ${guarantorData.guarantorMemberId} not found`);
        } else if (guarantorMember.status !== 'active') {
          invalidGuarantors.push(`${guarantorMember.fullName || guarantorMember.memberNumber} is not an active member (status: ${guarantorMember.status})`);
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

      res.status(201).json(createdGuarantors);
    } catch (error) {
      console.error("Error adding guarantors to loan:", error);
      res.status(500).json({ message: "Failed to add guarantors to loan" });
    }
  });

  app.get('/api/guarantors/loan/:loanId', isAuthenticated, async (req, res) => {
    try {
      const loanId = parseInt(req.params.loanId);
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
      const guarantorId = parseInt(req.params.id);
      const { comments } = req.body;
      const userId = req.user?.claims?.sub;

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

      res.json(updatedGuarantor);
    } catch (error) {
      console.error("Error approving guarantor:", error);
      res.status(500).json({ message: "Failed to approve guarantor request" });
    }
  });

  app.patch('/api/guarantors/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const guarantorId = parseInt(req.params.id);
      const { comments } = req.body;
      const userId = req.user?.claims?.sub;

      if (!comments?.trim()) {
        return res.status(400).json({ message: "Comments are required for rejection" });
      }

      // Get the guarantor and verify the current user is the guarantor
      const guarantor = await storage.getGuarantor(guarantorId);
      if (!guarantor) {
        return res.status(404).json({ message: "Guarantor request not found" });
      }

      // Verify the current user is the guarantor member
      const guarantorMember = await storage.getMemberByUserId(userId);
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

      res.json(updatedGuarantor);
    } catch (error) {
      console.error("Error rejecting guarantor:", error);
      res.status(500).json({ message: "Failed to reject guarantor request" });
    }
  });

  // Get pending guarantor requests for the current user
  app.get('/api/guarantors/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const member = await storage.getMemberByUserId(userId);
      
      if (!member) {
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
      const memberId = parseInt(req.params.memberId);
      const guarantors = await storage.getGuarantorsByMember(memberId);
      res.json(guarantors);
    } catch (error) {
      console.error("Error fetching guarantors by member:", error);
      res.status(500).json({ message: "Failed to fetch guarantors" });
    }
  });

  app.get('/api/guarantors/pending/:memberId', isAuthenticated, async (req, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const pendingRequests = await storage.getPendingGuarantorRequests(memberId);
      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending guarantor requests:", error);
      res.status(500).json({ message: "Failed to fetch pending requests" });
    }
  });

  app.patch('/api/guarantors/:id/approve', isAuthenticated, async (req, res) => {
    try {
      const guarantorId = parseInt(req.params.id);
      const { comments } = req.body;
      const guarantor = await storage.updateGuarantorStatus(guarantorId, 'approved', comments);
      res.json(guarantor);
    } catch (error) {
      console.error("Error approving guarantor:", error);
      res.status(500).json({ message: "Failed to approve guarantor" });
    }
  });

  app.patch('/api/guarantors/:id/reject', isAuthenticated, async (req, res) => {
    try {
      const guarantorId = parseInt(req.params.id);
      const { comments } = req.body;
      const guarantor = await storage.updateGuarantorStatus(guarantorId, 'rejected', comments);
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
        userId: req.user?.claims?.sub!,
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
        userId: req.user?.claims?.sub!,
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
        userId: req.user?.claims?.sub!,
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
        userId: req.user?.claims?.sub!,
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
      const memberId = parseInt(req.params.id);
      
      const [member] = await db
        .select({
          roles: members.roles
        })
        .from(members)
        .where(eq(members.id, memberId));

      if (!member) {
        res.status(404).json({ message: 'Member not found' });
        return;
      }

      res.json(member.roles || []);
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
        userId: req.user.claims.sub,
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
        userId: req.user.claims.sub,
        action: 'create',
        resource: 'amortization_schedule',
        resourceId: uuid,
        details: `Generated amortization schedule for loan ${id}`,
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
        userId: req.user.claims.sub,
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
        parseInt(id), 
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete('/api/notifications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  
  // Make broadcastNotification available globally for use in other parts of the application
  (global as any).broadcastNotification = broadcastNotification;

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
      const loanType = await storage.createLoanType(req.body);
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub || '',
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
      const loanType = await storage.updateLoanType(id, req.body);
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub || '',
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
        userId: req.user?.claims?.sub || '',
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
        userId: req.user?.claims?.sub || '',
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
        userId: req.user?.claims?.sub || '',
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
        userId: req.user?.claims?.sub || '',
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
      const userId = req.user?.claims?.sub;
      const permissions = await storage.getUserPermissions(userId);
      
      // Check if user has reports permission
      const canViewReports = permissions.some(p => p.resource === 'reports' && p.action === 'read');
      if (!canViewReports) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get report data based on type
      let reportData;
      switch (reportType) {
        case 'members':
          const filters: any = {};
          if (status && status !== 'all') filters.status = status;
          if (startDate) filters.startDate = new Date(startDate);
          if (endDate) filters.endDate = new Date(endDate);
          
          // For now, return empty data
          reportData = [];
          break;
          
        case 'savings':
          reportData = [];
          break;
          
        case 'loans':
          reportData = [];
          break;
          
        case 'transactions':
          reportData = [];
          break;
          
        case 'financial':
          reportData = {
            revenue: 0,
            expenses: 0,
            netIncome: 0,
            loanPortfolio: 0,
            savingsTotal: 0
          };
          break;
          
        case 'audit':
          const member = await storage.getMemberByUserId(userId);
          const canViewAuditLogs = permissions.some(p => p.resource === 'audit-logs' && p.action === 'read');
          if (!canViewAuditLogs) {
            return res.status(403).json({ message: "Access denied to audit logs" });
          }
          reportData = [];
          break;
          
        default:
          return res.status(400).json({ message: "Invalid report type" });
      }

      res.json(reportData);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Generate and export reports
  app.post('/api/reports/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { reportType, filters, format } = req.body;
      const userId = req.user?.claims?.sub;
      const permissions = await storage.getUserPermissions(userId);
      
      // Check if user has reports permission
      const canViewReports = permissions.some(p => p.resource === 'reports' && p.action === 'read');
      if (!canViewReports) {
        return res.status(403).json({ message: "Access denied" });
      }

      // For now, return a placeholder response
      // In a real implementation, this would generate the actual report file
      res.json({
        message: `${reportType} report generated in ${format} format`,
        downloadUrl: `/api/reports/download/${reportType}.${format}`
      });
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  return httpServer;
}
