import { useAuth } from "./useAuth";
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
  
  // Get user roles from member data - now supports multiple roles
  const userRoles: UserRole[] = (user?.member?.roles as UserRole[]) || ['member'];
  
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
    
    // Permission checking functions - now check all roles
    hasPermission: (action: string, resource: string) => 
      userRoles.some(role => hasPermission(role, action, resource)),
    
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