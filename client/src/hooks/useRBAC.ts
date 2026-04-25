import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useCallback, useSyncExternalStore } from "react";
import { 
  hasPermission, 
  canAccessDashboardComponent, 
  getNavigationItems, 
  canAccessRoute,
  canApproveAtStage,
  getHighestRole,
  ROLE_HIERARCHY,
  type UserRole 
} from "@/lib/rbac";

const ACTIVE_ROLE_KEY = 'biashara_active_role';
const listeners = new Set<() => void>();

let activeRoleSnapshot: UserRole = localStorage.getItem(ACTIVE_ROLE_KEY) || 'member';

function getActiveRoleSnapshot() {
  return activeRoleSnapshot;
}

function subscribeToRoleChanges(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setSharedActiveRole(role: UserRole) {
  activeRoleSnapshot = role;
  localStorage.setItem(ACTIVE_ROLE_KEY, role);
  listeners.forEach(cb => cb());
}

export function useRBAC() {
  const { user, isLoading } = useAuth();
  
  let userRoles: UserRole[] = ['member'];
  
  if (user?.member) {
    const member = user.member as any;
    if (member.roles && Array.isArray(member.roles)) {
      userRoles = member.roles as UserRole[];
    } else if (member.role) {
      userRoles = [member.role as UserRole];
    }
  } else if (user?.role === 'admin' || (user as any)?.isAdmin) {
    userRoles = ['admin'];
  } else if (user?.role) {
    userRoles = [user.role as UserRole];
  }

  const activeRole = useSyncExternalStore(subscribeToRoleChanges, getActiveRoleSnapshot);

  useEffect(() => {
    if (isLoading || !user) return;
    if (userRoles.length > 0) {
      if (!userRoles.includes(activeRole)) {
        const highest = getHighestRole(userRoles);
        setSharedActiveRole(highest);
      }
    }
  }, [JSON.stringify(userRoles), isLoading, !!user]);

  const switchRole = useCallback((role: UserRole) => {
    if (userRoles.includes(role)) {
      setSharedActiveRole(role);
    }
  }, [JSON.stringify(userRoles)]);

  const effectiveRole = userRoles.includes(activeRole) ? activeRole : getHighestRole(userRoles);
  const effectiveRoles = [effectiveRole];

  const { data: dynamicPermissions = [], isLoading: permissionsLoading } = useQuery<any[]>({
    queryKey: ["/api/auth/permissions", effectiveRole],
    queryFn: async () => {
      const res = await fetch(`/api/auth/permissions?role=${encodeURIComponent(effectiveRole)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch permissions');
      return res.json();
    },
    enabled: !!user,
  });
  
  return {
    userRole: effectiveRole,
    userRoles,
    activeRole: effectiveRole,
    switchRole,
    canSwitchRoles: userRoles.length > 1,
    isLoading: isLoading || (!!user && permissionsLoading),
    
    hasPermission: (action: string, resource: string) => {
      return dynamicPermissions.some(
        (p: any) => p.action === action && p.resource === resource
      );
    },
    
    canAccessDashboardComponent: (component: string) => 
      canAccessDashboardComponent(effectiveRoles, component, dynamicPermissions),
    
    canAccessRoute: (route: string) => 
      canAccessRoute(effectiveRoles, route, dynamicPermissions),
    
    canApproveAtStage: (stage: string) => 
      canApproveAtStage(effectiveRole, stage),
    
    getNavigationItems: () => getNavigationItems(effectiveRoles, dynamicPermissions),
    
    filterContentByRole: <T>(content: T[], filter: (item: T) => boolean) => {
      return content.filter(filter);
    },
    
    hasAnyRole: (roles: UserRole[]) => roles.some(role => userRoles.includes(role)),
    
    hasRole: (role: UserRole) => userRoles.includes(role),
    
    isHigherThan: (role: UserRole) => {
      return (ROLE_HIERARCHY[effectiveRole] || 1) > (ROLE_HIERARCHY[role] || 1);
    }
  };
}
