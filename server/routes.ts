import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { requirePermission, filterDataByRole, type AuthRequest, filterMembersByRole, filterLoansByRole, filterTransactionsByRole } from "./rbac-middleware";
import { insertMemberSchema, insertSavingsAccountSchema, insertLoanSchema, insertTransactionSchema, insertGuarantorSchema, insertNotificationSchema } from "@shared/schema";
import { z } from "zod";

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

  // Loan routes
  app.post('/api/loans', isAuthenticated, async (req: any, res) => {
    try {
      const { memberId, loanType, principalAmount, interestRate, termMonths } = req.body;
      
      // Calculate monthly payment (simple calculation)
      const monthlyInterestRate = parseFloat(interestRate) / 12 / 100;
      const monthlyPayment = (parseFloat(principalAmount) * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termMonths)) / 
        (Math.pow(1 + monthlyInterestRate, termMonths) - 1);

      // Generate unique loan number
      const loanNumber = `LN${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const loan = await storage.createLoan({
        memberId,
        loanNumber,
        loanType,
        principalAmount,
        interestRate,
        termMonths,
        monthlyPayment: monthlyPayment.toFixed(2),
        outstandingBalance: principalAmount,
        status: 'pending',
      });

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

  app.post('/api/loans/:id/approve/:stage', isAuthenticated, async (req: any, res) => {
    try {
      const { id, stage } = req.params;
      const { comments } = req.body;
      const userId = req.user?.claims?.sub;

      if (!await hasApprovalRole(userId, stage)) {
        return res.status(403).json({ message: `Access denied. ${stage} role required.` });
      }

      const loan = await storage.approveLoanAtStage(parseInt(id), stage, userId, comments);
      res.json({ message: `Loan approved at ${stage} stage`, loan });
    } catch (error) {
      console.error(`Error approving loan at ${req.params.stage} stage:`, error);
      res.status(500).json({ message: "Failed to approve loan" });
    }
  });

  app.post('/api/loans/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user?.claims?.sub;

      if (!reason?.trim()) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const loan = await storage.rejectLoan(parseInt(id), userId, reason);
      res.json({ message: "Loan rejected", loan });
    } catch (error) {
      console.error("Error rejecting loan:", error);
      res.status(500).json({ message: "Failed to reject loan" });
    }
  });

  app.get('/api/loans/:id/approval-history', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const history = await storage.getLoanApprovalHistory(parseInt(id));
      res.json(history);
    } catch (error) {
      console.error("Error fetching loan approval history:", error);
      res.status(500).json({ message: "Failed to fetch approval history" });
    }
  });

  app.patch('/api/loans/:id/approve', isAuthenticated, async (req, res) => {
    try {
      const loan = await storage.updateLoanStatus(parseInt(req.params.id), 'approved');
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
  app.get('/api/loans/:id/amortization', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const schedule = await storage.getAmortizationSchedule(parseInt(id));
      res.json(schedule);
    } catch (error) {
      console.error("Error fetching amortization schedule:", error);
      res.status(500).json({ message: "Failed to fetch amortization schedule" });
    }
  });

  app.post('/api/loans/:id/generate-amortization', isAuthenticated, requirePermission('create', 'amortization'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const schedule = await storage.generateLoanAmortization(parseInt(id));

      await storage.createAuditLog({
        userId: req.user.claims.sub,
        action: 'create',
        resource: 'amortization_schedule',
        resourceId: id,
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

  app.post('/api/loans/:id/calculate-interest', isAuthenticated, requirePermission('create', 'interest-calculations'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const result = await storage.calculateAndSaveInterest(parseInt(id));

      await storage.createAuditLog({
        userId: req.user.claims.sub,
        action: 'create',
        resource: 'interest_calculation',
        resourceId: id,
        details: `Calculated interest for loan ${id}: Monthly payment UGX ${result.monthlyPayment.toFixed(2)}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(result);
    } catch (error) {
      console.error("Error calculating interest:", error);
      res.status(500).json({ message: "Failed to calculate interest" });
    }
  });

  app.get('/api/loans/:id/interest-calculations', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const calculations = await storage.getInterestCalculations(parseInt(id));
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
  
  // Make broadcastNotification available globally for use in other parts of the application
  (global as any).broadcastNotification = broadcastNotification;

  return httpServer;
}
