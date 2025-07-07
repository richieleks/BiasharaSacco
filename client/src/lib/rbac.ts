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
    { action: 'read', resource: 'roles' },
    { action: 'create', resource: 'roles' },
    { action: 'update', resource: 'roles' },
    { action: 'delete', resource: 'roles' },
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

// All available navigation items with permission requirements
export const ALL_NAVIGATION_ITEMS = [
  { name: 'Dashboard', path: '/', icon: 'LayoutDashboard', permission: { action: 'read', resource: 'dashboard' } },
  { name: 'Members', path: '/members', icon: 'Users', permission: { action: 'read', resource: 'members' } },
  { name: 'Loans', path: '/loans', icon: 'CreditCard', permission: { action: 'read', resource: 'loans' } },
  { name: 'Loan Workflow', path: '/loan-workflow', icon: 'GitBranch', permission: { action: 'approve', resource: 'loans' } },

  { name: 'Savings', path: '/savings', icon: 'PiggyBank', permission: { action: 'read', resource: 'savings' } },
  { name: 'Transactions', path: '/transactions', icon: 'Receipt', permission: { action: 'read', resource: 'transactions' } },
  { name: 'Guarantors', path: '/guarantors', icon: 'UserCheck', permission: { action: 'read', resource: 'guarantors' } },
  { name: 'Guarantor Requests', path: '/guarantor-requests', icon: 'UserCheck', permission: { action: 'create', resource: 'guarantors' } },
  { name: 'Reports', path: '/reports', icon: 'BarChart3', permission: { action: 'read', resource: 'reports' } },
  { name: 'RBAC Management', path: '/rbac-management', icon: 'ShieldCheck', permission: { action: 'read', resource: 'roles' } },
  { name: 'Settings', path: '/settings', icon: 'Settings', permission: { action: 'read', resource: 'system-settings' } },
  { name: 'Audit Logs', path: '/audit-logs', icon: 'Shield', permission: { action: 'read', resource: 'audit-logs' } },
  { name: 'Roles Matrix', path: '/roles-matrix', icon: 'Lock', permission: { action: 'read', resource: 'system-settings' } },
  { name: 'Interest Rates', path: '/interest-rates', icon: 'Percent', permission: { action: 'read', resource: 'interest-rates' } },
  { name: 'Notifications', path: '/notifications', icon: 'Bell', permission: { action: 'read', resource: 'notifications' } },
];

// Legacy navigation items by role (deprecated - use getNavigationItems function instead)
export const NAVIGATION_ITEMS: Record<UserRole, Array<{name: string, path: string, icon?: string}>> = {
  admin: ALL_NAVIGATION_ITEMS,
  manager: ALL_NAVIGATION_ITEMS,
  committee: ALL_NAVIGATION_ITEMS,
  teller: ALL_NAVIGATION_ITEMS,
  member: ALL_NAVIGATION_ITEMS,
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
  
  // Filter navigation items based on user permissions
  return ALL_NAVIGATION_ITEMS.filter(item => {
    return hasPermission(roles, item.permission.action, item.permission.resource);
  });
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