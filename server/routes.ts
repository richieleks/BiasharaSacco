import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertMemberSchema, insertSavingsAccountSchema, insertLoanSchema, insertTransactionSchema, insertGuarantorSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Type augmentation for Express Request with user claims
  type AuthRequest = Request & {
    user?: {
      claims?: {
        sub?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
      };
    };
  };
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
      
      res.json({ ...user, member });
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
  app.get('/api/dashboard/recent-transactions', isAuthenticated, async (req, res) => {
    try {
      const transactions = await storage.getRecentTransactions(10);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching recent transactions:", error);
      res.status(500).json({ message: "Failed to fetch recent transactions" });
    }
  });

  // Pending approvals
  app.get('/api/dashboard/pending-approvals', isAuthenticated, async (req, res) => {
    try {
      const approvals = await storage.getPendingApprovals();
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ message: "Failed to fetch pending approvals" });
    }
  });

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
        status: 'active',
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

  app.get('/api/members', isAuthenticated, async (req, res) => {
    try {
      const { search } = req.query;
      const members = search 
        ? await storage.searchMembers(search as string)
        : await storage.getAllMembers();
      res.json(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get('/api/members/:id', isAuthenticated, async (req, res) => {
    try {
      const member = await storage.getMember(parseInt(req.params.id));
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
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

      const loan = await storage.createLoan({
        memberId,
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

  app.get('/api/loans/pending', isAuthenticated, async (req, res) => {
    try {
      const loans = await storage.getAllPendingLoans();
      res.json(loans);
    } catch (error) {
      console.error("Error fetching pending loans:", error);
      res.status(500).json({ message: "Failed to fetch pending loans" });
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

  const httpServer = createServer(app);
  return httpServer;
}
