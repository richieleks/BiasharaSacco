export type UserRole = string;

export interface Permission {
  action: string;
  resource: string;
}

export const ALL_NAVIGATION_ITEMS = [
  { name: 'Dashboard', path: '/', icon: 'LayoutDashboard', group: 'Main', permission: { action: 'read', resource: 'dashboard' } },
  { name: 'Members', path: '/members', icon: 'Users', group: 'Main', permission: { action: 'read', resource: 'members' } },
  { name: 'Savings', path: '/savings', icon: 'PiggyBank', group: 'Finance', permission: { action: 'read', resource: 'savings' } },
  { name: 'My Savings', path: '/savings', icon: 'PiggyBank', group: 'Finance', permission: { action: 'read', resource: 'personal-savings' } },
  { name: 'Loans', path: '/loans', icon: 'CreditCard', group: 'Finance', permission: { action: 'read', resource: 'loans' } },
  { name: 'Loan Workflow', path: '/loan-workflow', icon: 'GitBranch', group: 'Finance', permission: { action: 'approve', resource: 'loans' } },
  { name: 'My Loans', path: '/my-loans', icon: 'CreditCard', group: 'Finance', permission: { action: 'read', resource: 'personal-loans' } },
  { name: 'Transactions', path: '/transactions', icon: 'Receipt', group: 'Finance', permission: { action: 'read', resource: 'transactions' } },
  { name: 'My Transactions', path: '/my-transactions', icon: 'Receipt', group: 'Finance', permission: { action: 'read', resource: 'personal-transactions' } },
  { name: 'Share Capital', path: '/share-capital', icon: 'ArrowUpRight', group: 'Finance', permission: { action: 'read', resource: 'share-capital' } },
  { name: 'Guarantors', path: '/guarantors', icon: 'UserCheck', group: 'Finance', permission: { action: 'read', resource: 'guarantors' } },
  { name: 'Interest Rates', path: '/interest-rates', icon: 'Percent', group: 'Finance', permission: { action: 'read', resource: 'interest-rates' } },
  { name: 'Interest Calculations', path: '/interest-calculations', icon: 'Calculator', group: 'Finance', permission: { action: 'read', resource: 'interest-calculations' } },
  { name: 'Reports', path: '/reports', icon: 'BarChart3', group: 'Reports', permission: { action: 'read', resource: 'reports' } },
  { name: 'Notifications', path: '/notifications', icon: 'Bell', group: 'Reports', permission: { action: 'read', resource: 'notifications' } },
  { name: 'SACCO Accounts', path: '/sacco-accounts', icon: 'Landmark', group: 'Finance', permission: { action: 'read', resource: 'sacco-accounts' } },
  { name: 'Settings', path: '/admin-settings', icon: 'Settings', group: 'Administration', permission: { action: 'update', resource: 'system-settings' } },
  { name: 'Audit Logs', path: '/audit-logs', icon: 'FileText', group: 'Administration', permission: { action: 'read', resource: 'audit-logs' } },
  { name: 'Data Import', path: '/data-import', icon: 'Upload', group: 'Administration', permission: { action: 'update', resource: 'system-settings' } },
];

export function hasPermission(_userRoles: UserRole | UserRole[], action: string, resource: string, dynamicPermissions?: Permission[]): boolean {
  if (!dynamicPermissions || dynamicPermissions.length === 0) {
    return false;
  }
  return dynamicPermissions.some(p => p.action === action && p.resource === resource);
}

export function canAccessDashboardComponent(userRoles: UserRole | UserRole[], component: string, dynamicPermissions?: Permission[]): boolean {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];

  const componentPermissions: Record<string, Permission> = {
    'metrics-grid': { action: 'read', resource: 'dashboard' },
    'recent-transactions': { action: 'read', resource: 'transactions' },
    'quick-actions': { action: 'read', resource: 'dashboard' },
    'pending-approvals': { action: 'approve', resource: 'members' },
    'member-approvals': { action: 'approve', resource: 'members' },
    'loan-approval-workflow': { action: 'approve', resource: 'loans' },
    'system-overview': { action: 'read', resource: 'system-settings' },
    'audit-logs': { action: 'read', resource: 'audit-logs' },
    'committee-queue': { action: 'approve', resource: 'loans' },
    'treasurer-queue': { action: 'approve', resource: 'loans' },
    'daily-summary': { action: 'read', resource: 'transactions' },
    'personal-summary': { action: 'read', resource: 'personal-dashboard' },
    'personal-loans': { action: 'read', resource: 'personal-loans' },
    'personal-savings': { action: 'read', resource: 'personal-savings' },
    'personal-transactions': { action: 'read', resource: 'personal-transactions' },
  };

  const perm = componentPermissions[component];
  if (!perm) return false;
  return hasPermission(roles, perm.action, perm.resource, dynamicPermissions);
}

export function getNavigationItems(userRoles: UserRole | UserRole[], dynamicPermissions?: Permission[]) {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];

  return ALL_NAVIGATION_ITEMS.filter(item =>
    hasPermission(roles, item.permission.action, item.permission.resource, dynamicPermissions)
  );
}

export function canAccessRoute(userRoles: UserRole | UserRole[], route: string, dynamicPermissions?: Permission[]): boolean {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  const navItems = getNavigationItems(roles, dynamicPermissions);
  return navItems.some(item => item.path === route);
}

export function hasAnyRole(userRoles: UserRole | UserRole[], requiredRoles: UserRole[]): boolean {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  return roles.some(role => requiredRoles.includes(role));
}

export function getHighestRole(userRoles: UserRole[]): UserRole {
  if (!userRoles || userRoles.length === 0) return 'member';
  const hierarchy: Record<string, number> = { member: 1, treasurer: 2, committee: 3, admin: 5 };
  return userRoles.reduce((highest, current) =>
    (hierarchy[current] || 1) > (hierarchy[highest] || 1) ? current : highest
  , userRoles[0]);
}

export const ROLE_HIERARCHY: Record<string, number> = {
  member: 1,
  treasurer: 2,
  committee: 3,
  admin: 5,
};

export function hasHigherRole(userRole: UserRole, compareRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] || 1) > (ROLE_HIERARCHY[compareRole] || 1);
}

export function canApproveAtStage(userRole: UserRole, stage: string): boolean {
  switch (stage) {
    case 'committee':
      return ['committee', 'admin'].includes(userRole);
    case 'treasurer':
      return ['treasurer', 'admin'].includes(userRole);
    default:
      return false;
  }
}
