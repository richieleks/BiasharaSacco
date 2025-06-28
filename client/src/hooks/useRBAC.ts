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
  
  // Get user role from member data or default to 'member'
  const userRole: UserRole = (user?.member?.role as UserRole) || 'member';
  
  return {
    userRole,
    isLoading,
    
    // Permission checking functions
    hasPermission: (action: string, resource: string) => 
      hasPermission(userRole, action, resource),
    
    canAccessDashboardComponent: (component: string) => 
      canAccessDashboardComponent(userRole, component),
    
    canAccessRoute: (route: string) => 
      canAccessRoute(userRole, route),
    
    canApproveAtStage: (stage: string) => 
      canApproveAtStage(userRole, stage),
    
    // Navigation and UI helpers
    getNavigationItems: () => getNavigationItems(userRole),
    
    // Role-based content filtering
    filterContentByRole: <T>(content: T[], filter: (item: T) => boolean) => {
      return content.filter(filter);
    },
    
    // Check if user has any of the specified roles
    hasAnyRole: (roles: UserRole[]) => roles.includes(userRole),
    
    // Check if user has specific role
    hasRole: (role: UserRole) => userRole === role,
    
    // Get user's role level for comparison
    isHigherThan: (role: UserRole) => {
      const hierarchy = { member: 1, teller: 2, committee: 3, manager: 4, admin: 5 };
      return hierarchy[userRole] > hierarchy[role];
    }
  };
}