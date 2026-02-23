import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { 
  hasPermission, 
  canAccessDashboardComponent, 
  getNavigationItems, 
  canAccessRoute,
  canApproveAtStage,
  type UserRole 
} from "@/lib/rbac";

export function useRBAC() {
  const { user, isLoading } = useAuth();
  
  const { data: dynamicPermissions = [] } = useQuery<any[]>({
    queryKey: ["/api/auth/permissions"],
    enabled: !!user,
  });
  
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
  
  const getHighestRole = (roles: UserRole[]): UserRole => {
    const hierarchy: Record<UserRole, number> = { member: 1, teller: 2, treasurer: 2, committee: 3, manager: 4, admin: 5 };
    return roles.reduce((highest, current) => 
      hierarchy[current] > hierarchy[highest] ? current : highest
    , 'member' as UserRole);
  };
  
  const userRole = getHighestRole(userRoles);
  
  return {
    userRole, // Keep for backward compatibility
    userRoles, // New: array of all user roles
    isLoading,
    
    // Permission checking functions - now check both hardcoded and dynamic permissions
    hasPermission: (action: string, resource: string) => {
      // First check dynamic permissions from database
      const hasDynamicPermission = dynamicPermissions.some(
        (p: any) => p.action === action && p.resource === resource
      );
      
      // If we have dynamic permissions, use them exclusively
      if (dynamicPermissions.length > 0) {
        return hasDynamicPermission;
      }
      
      // Otherwise fallback to hardcoded permissions
      return userRoles.some(role => hasPermission(role, action, resource));
    },
    
    canAccessDashboardComponent: (component: string) => 
      userRoles.some(role => canAccessDashboardComponent(role, component)),
    
    canAccessRoute: (route: string) => 
      canAccessRoute(userRoles, route, dynamicPermissions),
    
    canApproveAtStage: (stage: string) => 
      userRoles.some(role => canApproveAtStage(role, stage)),
    
    // Navigation and UI helpers - pass all user roles and dynamic permissions for proper filtering
    getNavigationItems: () => getNavigationItems(userRoles, dynamicPermissions),
    
    // Role-based content filtering
    filterContentByRole: <T>(content: T[], filter: (item: T) => boolean) => {
      return content.filter(filter);
    },
    
    // Check if user has any of the specified roles
    hasAnyRole: (roles: UserRole[]) => roles.some(role => userRoles.includes(role)),
    
    // Check if user has specific role
    hasRole: (role: UserRole) => userRoles.includes(role),
    
    // Get user's highest role level for comparison
    isHigherThan: (role: UserRole) => {
      const hierarchy: Record<UserRole, number> = { member: 1, teller: 2, treasurer: 2, committee: 3, manager: 4, admin: 5 };
      return hierarchy[userRole] > hierarchy[role];
    }
  };
}