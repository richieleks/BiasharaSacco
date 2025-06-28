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
    roles: UserRole[]; // Changed to array of roles
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

      // Get all roles for this member
      const memberRoles = await storage.getMemberRoles(member.id);
      const roles = memberRoles.length > 0 ? memberRoles as UserRole[] : ['member' as UserRole];

      req.member = {
        id: member.id,
        roles: roles,
        userId: member.userId!,
        memberNumber: member.memberNumber,
        status: member.status!,
      };

      // Check if any of the user's roles has the required permission
      const hasRequiredPermission = roles.some(role => hasPermission(role, action, resource));
      
      if (!hasRequiredPermission) {
        return res.status(403).json({ 
          message: `Access denied. Required permission: ${action} ${resource}`,
          userRoles: roles 
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

      // Get all roles for this member
      const memberRoles = await storage.getMemberRoles(member.id);
      const roles = memberRoles.length > 0 ? memberRoles as UserRole[] : ['member' as UserRole];

      req.member = {
        id: member.id,
        roles: roles,
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
export function filterMembersByRole(members: any[], userRoles: UserRole[], userId: string) {
  // If user has admin, manager, committee, or teller role, they can see all members
  if (userRoles.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role))) {
    return members;
  }
  
  // Otherwise, they can only see their own data
  return members.filter(member => member.userId === userId);
}

export function filterLoansByRole(loans: any[], userRoles: UserRole[], userId: string) {
  // If user has admin, manager, committee, or teller role, they can see all loans
  if (userRoles.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role))) {
    return loans;
  }
  
  // Otherwise, they can only see their own loans
  return loans.filter(loan => loan.member?.userId === userId);
}

export function filterTransactionsByRole(transactions: any[], userRoles: UserRole[], userId: string) {
  // If user has admin, manager, committee, or teller role, they can see all transactions
  if (userRoles.some(role => ['admin', 'manager', 'committee', 'teller'].includes(role))) {
    return transactions;
  }
  
  // Otherwise, they can only see their own transactions
  return transactions.filter(transaction => transaction.member?.userId === userId);
}