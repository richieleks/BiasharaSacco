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
  
  // Fetch dynamic permissions from the server
  const { data: dynamicPermissions = [] } = useQuery({
    queryKey: ["/api/auth/permissions"],
    enabled: !!user && !!user.member,
  });
  
  // Get user roles from member data - now supports multiple roles
  // Handle both the old 'role' field and new 'roles' array
  let userRoles: UserRole[] = ['member'];
  
  if (user?.member) {
    const member = user.member as any;
    if (member.roles && Array.isArray(member.roles)) {
      userRoles = member.roles as UserRole[];
    } else if (member.role) {
      userRoles = [member.role as UserRole];
    }
  }
  
  // Get highest role for backward compatibility
  const getHighestRole = (roles: UserRole[]): UserRole => {
    const hierarchy = { member: 1, teller: 2, committee: 3, manager: 4, admin: 5 };
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
      
      // If not found, check hardcoded permissions for backward compatibility
      if (!hasDynamicPermission) {
        return userRoles.some(role => hasPermission(role, action, resource));
      }
      
      return hasDynamicPermission;
    },
    
    canAccessDashboardComponent: (component: string) => 
      userRoles.some(role => canAccessDashboardComponent(role, component)),
    
    canAccessRoute: (route: string) => 
      userRoles.some(role => canAccessRoute(role, route)),
    
    canApproveAtStage: (stage: string) => 
      userRoles.some(role => canApproveAtStage(role, stage)),
    
    // Navigation and UI helpers - show items for highest role
    getNavigationItems: () => getNavigationItems(userRole),
    
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
      const hierarchy = { member: 1, teller: 2, committee: 3, manager: 4, admin: 5 };
      return hierarchy[userRole] > hierarchy[role];
    }
  };
}