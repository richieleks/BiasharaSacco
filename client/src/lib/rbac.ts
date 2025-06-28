// Role-Based Access Control (RBAC) Configuration

export type UserRole = 'admin' | 'manager' | 'committee' | 'teller' | 'member';

export interface Permission {
  action: string;
  resource: string;
}

export interface RolePermissions {
  [key: string]: Permission[];
}

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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
    { action: 'read', resource: 'system-settings' },
    { action: 'update', resource: 'system-settings' },
    { action: 'read', resource: 'audit-logs' },
  ],
  
  manager: [
    // High-level oversight and final approvals
    { action: 'read', resource: 'dashboard' },
    { action: 'read', resource: 'members' },
    { action: 'approve', resource: 'members' },
    { action: 'read', resource: 'loans' },
    { action: 'approve', resource: 'loans' }, // Final approval for high-value loans
    { action: 'reject', resource: 'loans' },
    { action: 'read', resource: 'transactions' },
    { action: 'read', resource: 'savings' },
    { action: 'read', resource: 'reports' },
    { action: 'read', resource: 'guarantors' },
  ],
  
  committee: [
    // Mid-level approvals and review
    { action: 'read', resource: 'dashboard' },
    { action: 'read', resource: 'members' },
    { action: 'approve', resource: 'members' },
    { action: 'read', resource: 'loans' },
    { action: 'approve', resource: 'loans' }, // Committee-stage approvals
    { action: 'reject', resource: 'loans' },
    { action: 'read', resource: 'transactions' },
    { action: 'read', resource: 'savings' },
    { action: 'read', resource: 'guarantors' },
    { action: 'approve', resource: 'guarantors' },
  ],
  
  teller: [
    // Front-line operations
    { action: 'read', resource: 'dashboard' },
    { action: 'read', resource: 'members' },
    { action: 'create', resource: 'members' },
    { action: 'update', resource: 'members' },
    { action: 'read', resource: 'loans' },
    { action: 'create', resource: 'loans' },
    { action: 'approve', resource: 'loans' }, // Initial loan processing
    { action: 'read', resource: 'transactions' },
    { action: 'create', resource: 'transactions' },
    { action: 'read', resource: 'savings' },
    { action: 'create', resource: 'savings' },
    { action: 'read', resource: 'guarantors' },
    { action: 'create', resource: 'guarantors' },
  ],
  
  member: [
    // Limited member access
    { action: 'read', resource: 'personal-dashboard' },
    { action: 'read', resource: 'personal-loans' },
    { action: 'create', resource: 'loan-application' },
    { action: 'read', resource: 'personal-savings' },
    { action: 'read', resource: 'personal-transactions' },
    { action: 'read', resource: 'guarantors' },
    { action: 'create', resource: 'guarantors' },
  ],
};

// Dashboard components visibility by role
export const DASHBOARD_COMPONENTS: Record<UserRole, string[]> = {
  admin: [
    'metrics-grid',
    'recent-transactions', 
    'quick-actions',
    'pending-approvals',
    'member-approvals',
    'loan-approval-workflow',
    'system-overview',
    'audit-logs'
  ],
  manager: [
    'metrics-grid',
    'recent-transactions',
    'pending-approvals',
    'loan-approval-workflow',
    'member-approvals',
    'management-reports'
  ],
  committee: [
    'metrics-grid',
    'pending-approvals',
    'loan-approval-workflow',
    'member-approvals',
    'committee-queue'
  ],
  teller: [
    'metrics-grid',
    'recent-transactions',
    'quick-actions',
    'teller-queue',
    'daily-summary'
  ],
  member: [
    'personal-summary',
    'personal-loans',
    'personal-savings',
    'personal-transactions'
  ],
};

// Navigation items by role
export const NAVIGATION_ITEMS: Record<UserRole, Array<{name: string, path: string, icon?: string}>> = {
  admin: [
    { name: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
    { name: 'Members', path: '/members', icon: 'Users' },
    { name: 'Loans', path: '/loans', icon: 'CreditCard' },
    { name: 'Loan Workflow', path: '/loan-workflow', icon: 'GitBranch' },
    { name: 'Savings', path: '/savings', icon: 'PiggyBank' },
    { name: 'Transactions', path: '/transactions', icon: 'Receipt' },
    { name: 'Guarantors', path: '/guarantors', icon: 'UserCheck' },
    { name: 'Reports', path: '/reports', icon: 'BarChart3' },
    { name: 'Role Management', path: '/role-management', icon: 'UserCog' },
    { name: 'Audit Logs', path: '/audit-logs', icon: 'Shield' },
    { name: 'Roles Matrix', path: '/roles-matrix', icon: 'Lock' },
    { name: 'Settings', path: '/settings', icon: 'Settings' },
  ],
  manager: [
    { name: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
    { name: 'Members', path: '/members', icon: 'Users' },
    { name: 'Loans', path: '/loans', icon: 'CreditCard' },
    { name: 'Loan Workflow', path: '/loan-workflow', icon: 'GitBranch' },
    { name: 'Savings', path: '/savings', icon: 'PiggyBank' },
    { name: 'Transactions', path: '/transactions', icon: 'Receipt' },
    { name: 'Reports', path: '/reports', icon: 'BarChart3' },
  ],
  committee: [
    { name: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
    { name: 'Members', path: '/members', icon: 'Users' },
    { name: 'Loans', path: '/loans', icon: 'CreditCard' },
    { name: 'Loan Workflow', path: '/loan-workflow', icon: 'GitBranch' },
    { name: 'Savings', path: '/savings', icon: 'PiggyBank' },
    { name: 'Guarantors', path: '/guarantors', icon: 'UserCheck' },
  ],
  teller: [
    { name: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
    { name: 'Members', path: '/members', icon: 'Users' },
    { name: 'Loans', path: '/loans', icon: 'CreditCard' },
    { name: 'Loan Workflow', path: '/loan-workflow', icon: 'GitBranch' },
    { name: 'Savings', path: '/savings', icon: 'PiggyBank' },
    { name: 'Transactions', path: '/transactions', icon: 'Receipt' },
  ],
  member: [
    { name: 'My Dashboard', path: '/', icon: 'LayoutDashboard' },
    { name: 'My Loans', path: '/my-loans', icon: 'CreditCard' },
    { name: 'My Savings', path: '/my-savings', icon: 'PiggyBank' },
    { name: 'My Transactions', path: '/my-transactions', icon: 'Receipt' },
    { name: 'Guarantors', path: '/guarantors', icon: 'UserCheck' },
  ],
};

// Utility functions for RBAC - Updated to handle multiple roles
export function hasPermission(userRoles: UserRole | UserRole[], action: string, resource: string): boolean {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  
  return roles.some(role => {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.some(permission => 
      permission.action === action && permission.resource === resource
    );
  });
}

export function canAccessDashboardComponent(userRoles: UserRole | UserRole[], component: string): boolean {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  
  return roles.some(role => {
    const allowedComponents = DASHBOARD_COMPONENTS[role] || [];
    return allowedComponents.includes(component);
  });
}

export function getNavigationItems(userRoles: UserRole | UserRole[]) {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  
  // Get the highest role for navigation (admin > manager > committee > teller > member)
  const highestRole = roles.reduce((highest, current) => {
    return ROLE_HIERARCHY[current] > ROLE_HIERARCHY[highest] ? current : highest;
  }, roles[0]);
  
  return NAVIGATION_ITEMS[highestRole] || [];
}

export function canAccessRoute(userRoles: UserRole | UserRole[], route: string): boolean {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  const navItems = getNavigationItems(roles);
  return navItems.some(item => item.path === route);
}

// Helper function to check if user has any of the specified roles
export function hasAnyRole(userRoles: UserRole | UserRole[], requiredRoles: UserRole[]): boolean {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  return roles.some(role => requiredRoles.includes(role));
}

// Helper function to get the highest role for display purposes
export function getHighestRole(userRoles: UserRole[]): UserRole {
  if (!userRoles || userRoles.length === 0) return 'member';
  
  return userRoles.reduce((highest, current) => {
    return ROLE_HIERARCHY[current] > ROLE_HIERARCHY[highest] ? current : highest;
  }, userRoles[0]);
}

// Role hierarchy for escalation
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  member: 1,
  teller: 2,
  committee: 3,
  manager: 4,
  admin: 5,
};

export function hasHigherRole(userRole: UserRole, compareRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] > ROLE_HIERARCHY[compareRole];
}

export function canApproveAtStage(userRole: UserRole, stage: string): boolean {
  switch (stage) {
    case 'teller':
      return hasPermission(userRole, 'approve', 'loans') && ['teller', 'committee', 'manager', 'admin'].includes(userRole);
    case 'committee':
      return hasPermission(userRole, 'approve', 'loans') && ['committee', 'manager', 'admin'].includes(userRole);
    case 'manager':
      return hasPermission(userRole, 'approve', 'loans') && ['manager', 'admin'].includes(userRole);
    default:
      return false;
  }
}