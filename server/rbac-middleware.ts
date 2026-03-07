import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export type UserRole = string;

export interface AuthRequest extends Request {
  user?: {
    id?: string;
    authMethod?: string;
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
    roles: UserRole[];
    userId: string;
    memberNumber: string;
    status: string;
  };
}

function getAuthUserId(req: AuthRequest): string | undefined {
  if (!req.user) return undefined;
  if ((req.user as any).authMethod === 'local') return (req.user as any).id;
  return req.user.claims?.sub;
}

export function requirePermission(action: string, resource: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);

      const member = await storage.getMemberByUserId(userId);
      let memberRoles: string[] = [];

      if (member) {
        memberRoles = await storage.getMemberRoles(member.id);
        if (memberRoles.length === 0) memberRoles = ['member'];
        req.member = {
          id: member.id,
          roles: memberRoles,
          userId: member.userId!,
          memberNumber: member.memberNumber,
          status: member.status!,
        };
      } else {
        const userRole = user?.role || 'member';
        memberRoles = [userRole];
        req.member = {
          id: 0,
          roles: [userRole],
          userId: userId,
          memberNumber: userRole.toUpperCase(),
          status: 'active',
        };
      }

      if (memberRoles.includes('admin') || user?.role === 'admin') {
        return next();
      }

      let hasRequiredPermission = false;
      for (const roleName of memberRoles) {
        const role = await storage.getRoleByName(roleName);
        if (role) {
          const permissions = await storage.getPermissionsByRole(role.id);
          if (permissions.some(p => p.action === action && p.resource === resource)) {
            hasRequiredPermission = true;
            break;
          }
        }
      }

      if (!hasRequiredPermission) {
        return res.status(403).json({
          message: `Access denied. Required permission: ${action} ${resource}`,
          userRoles: memberRoles
        });
      }

      next();
    } catch (error) {
      console.error("RBAC middleware error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

export function filterDataByRole() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const member = await storage.getMemberByUserId(userId);

      if (!member) {
        const userRole = user?.role || 'member';
        const staffRoles = ['admin', 'committee', 'treasurer'];
        if (staffRoles.includes(userRole)) {
          req.member = {
            id: 0,
            roles: [userRole],
            userId: userId,
            memberNumber: userRole.toUpperCase(),
            status: 'active',
          };
          return next();
        }
        return res.status(403).json({ message: "Member profile not found" });
      }

      const memberRoles = await storage.getMemberRoles(member.id);
      const roles = memberRoles.length > 0 ? memberRoles : ['member'];

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

export function filterMembersByRole(members: any[], userRoles: UserRole[], userId: string) {
  if (userRoles.some(role => ['admin', 'committee', 'treasurer'].includes(role))) {
    return members;
  }
  return members.filter(member => member.userId === userId);
}

export function filterLoansByRole(loans: any[], userRoles: UserRole[], userId: string) {
  if (userRoles.some(role => ['admin', 'committee', 'treasurer'].includes(role))) {
    return loans;
  }
  return loans.filter(loan => loan.member?.userId === userId);
}

export function filterTransactionsByRole(transactions: any[], userRoles: UserRole[], userId: string) {
  if (userRoles.some(role => ['admin', 'committee', 'treasurer'].includes(role))) {
    return transactions;
  }
  return transactions.filter(transaction => transaction.member?.userId === userId);
}
