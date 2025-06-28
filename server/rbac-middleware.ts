import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export type UserRole = 'admin' | 'manager' | 'committee' | 'teller' | 'member';

export interface AuthRequest extends Request {
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
    role: UserRole;
    userId: string;
    memberNumber: string;
    status: string;
  };
}

// RBAC middleware to check permissions
export function requirePermission(action: string, resource: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get member data to check role
      const member = await storage.getMemberByUserId(req.user.claims.sub);
      if (!member) {
        return res.status(403).json({ message: "Member profile not found" });
      }

      req.member = {
        id: member.id,
        role: (member.role as UserRole) || 'member',
        userId: member.userId!,
        memberNumber: member.memberNumber,
        status: member.status!,
      };

      // Check if user has required permission
      if (!hasPermission(req.member.role, action, resource)) {
        return res.status(403).json({ 
          message: `Access denied. Required permission: ${action} ${resource}`,
          userRole: req.member.role 
        });
      }

      next();
    } catch (error) {
      console.error("RBAC middleware error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

// Role-based data filtering middleware
export function filterDataByRole() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const member = await storage.getMemberByUserId(req.user.claims.sub);
      if (!member) {
        return res.status(403).json({ message: "Member profile not found" });
      }

      req.member = {
        id: member.id,
        role: (member.role as UserRole) || 'member',
        userId: member.userId!,
        memberNumber: member.memberNumber,
        status: member.status!,
      };

      next();
    } catch (error) {
      console.error("Data filtering middleware error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

// Permission checking function
function hasPermission(userRole: UserRole, action: string, resource: string): boolean {
  const rolePermissions: Record<UserRole, Array<{action: string, resource: string}>> = {
    admin: [
      // Full system access
      { action: 'read', resource: 'dashboard' },
      { action: 'read', resource: 'members' },
      { action: 'create', resource: 'members' },
      { action: 'update', resource: 'members' },
      { action: 'approve', resource: 'members' },
      { action: 'reject', resource: 'members' },
      { action: 'read', resource: 'loans' },
      { action: 'create', resource: 'loans' },
      { action: 'approve', resource: 'loans' },
      { action: 'reject', resource: 'loans' },
      { action: 'read', resource: 'transactions' },
      { action: 'create', resource: 'transactions' },
      { action: 'read', resource: 'savings' },
      { action: 'create', resource: 'savings' },
      { action: 'read', resource: 'reports' },
      { action: 'read', resource: 'guarantors' },
      { action: 'create', resource: 'guarantors' },
      { action: 'approve', resource: 'guarantors' },
    ],
    
    manager: [
      { action: 'read', resource: 'dashboard' },
      { action: 'read', resource: 'members' },
      { action: 'approve', resource: 'members' },
      { action: 'read', resource: 'loans' },
      { action: 'approve', resource: 'loans' },
      { action: 'reject', resource: 'loans' },
      { action: 'read', resource: 'transactions' },
      { action: 'read', resource: 'savings' },
      { action: 'read', resource: 'reports' },
      { action: 'read', resource: 'guarantors' },
    ],
    
    committee: [
      { action: 'read', resource: 'dashboard' },
      { action: 'read', resource: 'members' },
      { action: 'approve', resource: 'members' },
      { action: 'read', resource: 'loans' },
      { action: 'approve', resource: 'loans' },
      { action: 'reject', resource: 'loans' },
      { action: 'read', resource: 'transactions' },
      { action: 'read', resource: 'savings' },
      { action: 'read', resource: 'guarantors' },
      { action: 'approve', resource: 'guarantors' },
    ],
    
    teller: [
      { action: 'read', resource: 'dashboard' },
      { action: 'read', resource: 'members' },
      { action: 'create', resource: 'members' },
      { action: 'update', resource: 'members' },
      { action: 'read', resource: 'loans' },
      { action: 'create', resource: 'loans' },
      { action: 'approve', resource: 'loans' },
      { action: 'read', resource: 'transactions' },
      { action: 'create', resource: 'transactions' },
      { action: 'read', resource: 'savings' },
      { action: 'create', resource: 'savings' },
      { action: 'read', resource: 'guarantors' },
      { action: 'create', resource: 'guarantors' },
    ],
    
    member: [
      { action: 'read', resource: 'personal-dashboard' },
      { action: 'read', resource: 'personal-loans' },
      { action: 'create', resource: 'loan-application' },
      { action: 'read', resource: 'personal-savings' },
      { action: 'read', resource: 'personal-transactions' },
      { action: 'read', resource: 'guarantors' },
      { action: 'create', resource: 'guarantors' },
    ],
  };

  const permissions = rolePermissions[userRole] || [];
  return permissions.some(permission => 
    permission.action === action && permission.resource === resource
  );
}

// Data filtering functions for different roles
export function filterMembersByRole(members: any[], userRole: UserRole, userId: string) {
  switch (userRole) {
    case 'member':
      // Members can only see their own data
      return members.filter(member => member.userId === userId);
    case 'teller':
    case 'committee':
    case 'manager':
    case 'admin':
      // Staff can see all members
      return members;
    default:
      return [];
  }
}

export function filterLoansByRole(loans: any[], userRole: UserRole, userId: string) {
  switch (userRole) {
    case 'member':
      // Members can only see their own loans
      return loans.filter(loan => loan.member?.userId === userId);
    case 'teller':
    case 'committee':
    case 'manager':
    case 'admin':
      // Staff can see all loans
      return loans;
    default:
      return [];
  }
}

export function filterTransactionsByRole(transactions: any[], userRole: UserRole, userId: string) {
  switch (userRole) {
    case 'member':
      // Members can only see their own transactions
      return transactions.filter(transaction => transaction.member?.userId === userId);
    case 'teller':
    case 'committee':
    case 'manager':
    case 'admin':
      // Staff can see all transactions
      return transactions;
    default:
      return [];
  }
}