import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Users, 
  Building2, 
  Store, 
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  FileText,
  Settings,
  Eye
} from "lucide-react";

const rolesData = [
  {
    role: 'admin',
    title: 'Admin',
    icon: Shield,
    color: 'bg-red-500',
    description: 'Complete system administration and oversight',
    permissions: [
      'All Manager permissions',
      'System configuration and settings',
      'User role management',
      'Audit log access',
      'Database maintenance',
      'Emergency override capabilities',
      'Backup and recovery operations'
    ],
    dataAccess: 'ALL data across the system',
    restrictions: 'None - Full system access'
  },
  {
    role: 'manager',
    title: 'Manager',
    icon: Building2,
    color: 'bg-purple-500',
    description: 'Senior management oversight and high-value approvals',
    permissions: [
      'All Committee permissions',
      'Final approval for loans > UGX 500,000',
      'Member suspension/reactivation',
      'Financial policy adjustments',
      'Staff performance monitoring',
      'Strategic reports and dashboards',
      'Emergency fund access',
      'Loan write-offs and restructuring'
    ],
    dataAccess: 'All member information, financial transactions, loan applications',
    restrictions: 'Cannot modify system configuration'
  },
  {
    role: 'committee',
    title: 'Committee',
    icon: Users,
    color: 'bg-blue-500',
    description: 'Policy enforcement and mid-level approvals',
    permissions: [
      'All Teller permissions',
      'Loan approval (UGX 100K - UGX 500K)',
      'Member application final approval',
      'Large withdrawal approvals (> UGX 200K)',
      'Interest rate recommendations',
      'Policy compliance monitoring',
      'Guarantor verification',
      'Loan restructuring requests'
    ],
    dataAccess: 'All member profiles, loan applications, transaction reports',
    restrictions: 'Cannot approve high-value loans or modify policies'
  },
  {
    role: 'teller',
    title: 'Teller',
    icon: Store,
    color: 'bg-green-500',
    description: 'Front-line customer service and daily operations',
    permissions: [
      'Member registration and onboarding',
      'Initial loan application processing',
      'Deposits and small withdrawals (< UGX 200K)',
      'Account balance inquiries',
      'Transaction processing',
      'Basic customer support',
      'Document verification',
      'Daily cash reconciliation'
    ],
    dataAccess: 'Member information, transaction processing, loan applications (initial review)',
    restrictions: 'Cannot approve loans > UGX 100K, access sensitive data, or override limits'
  },
  {
    role: 'member',
    title: 'Member',
    icon: User,
    color: 'bg-slate-500',
    description: 'Self-service access to personal financial information',
    permissions: [
      'View personal account balances',
      'View transaction history (own accounts)',
      'Submit loan applications',
      'Update personal contact information',
      'View loan status and payment schedule',
      'Accept/decline guarantor requests',
      'Download personal statements'
    ],
    dataAccess: 'Personal profile, own accounts, own transactions only',
    restrictions: 'Cannot view other members or access administrative functions'
  }
];

const loanApprovalWorkflow = [
  {
    amount: '< UGX 100,000',
    type: 'Emergency Loans',
    workflow: [
      { stage: 'Direct to Committee', color: 'bg-blue-500' },
      { stage: 'Committee Decision', color: 'bg-blue-500' },
      { stage: 'Immediate Disbursement', color: 'bg-green-500' }
    ]
  },
  {
    amount: 'UGX 100K - 500K',
    type: 'Standard Loans',
    workflow: [
      { stage: 'Teller Review', color: 'bg-green-500' },
      { stage: 'Committee Approval', color: 'bg-blue-500' },
      { stage: 'Disbursement', color: 'bg-green-500' }
    ]
  },
  {
    amount: '> UGX 500,000',
    type: 'High-Value Loans',
    workflow: [
      { stage: 'Teller Review', color: 'bg-green-500' },
      { stage: 'Committee Assessment', color: 'bg-blue-500' },
      { stage: 'Manager Approval', color: 'bg-purple-500' },
      { stage: 'Disbursement', color: 'bg-green-500' }
    ]
  }
];

export default function RolesMatrix() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Roles & Permissions Matrix</h1>
        <p className="text-slate-600 mt-2">
          Comprehensive overview of user roles, permissions, and system access levels
        </p>
      </div>

      {/* Role Hierarchy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Role Hierarchy</span>
          </CardTitle>
          <CardDescription>
            From highest to lowest authority level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {rolesData.map((role, index) => {
              const IconComponent = role.icon;
              return (
                <div key={role.role} className="flex items-center space-x-2">
                  <Badge variant="outline" className="flex items-center space-x-2 px-3 py-1">
                    <div className={`w-3 h-3 rounded-full ${role.color}`} />
                    <IconComponent className="w-4 h-4" />
                    <span className="font-medium">{role.title}</span>
                  </Badge>
                  {index < rolesData.length - 1 && (
                    <span className="text-slate-400 text-sm">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Role Permissions */}
      <div className="grid gap-6">
        {rolesData.map((role) => {
          const IconComponent = role.icon;
          const borderColor = role.color === 'bg-red-500' ? '#ef4444' : 
                            role.color === 'bg-purple-500' ? '#a855f7' : 
                            role.color === 'bg-blue-500' ? '#3b82f6' : 
                            role.color === 'bg-green-500' ? '#22c55e' : '#64748b';
          
          return (
            <Card key={role.role} className="border-l-4" style={{ borderLeftColor: borderColor }}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg ${role.color} flex items-center justify-center`}>
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{role.title}</h3>
                    <p className="text-slate-600 text-sm">{role.description}</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Permissions */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Permissions</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {role.permissions.map((permission, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                        <span className="text-slate-700">{permission}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Data Access */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>Data Access Level</span>
                  </h4>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                    {role.dataAccess}
                  </p>
                </div>

                <Separator />

                {/* Restrictions */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>Restrictions</span>
                  </h4>
                  <p className="text-sm text-slate-700 bg-red-50 p-3 rounded-lg border border-red-200">
                    {role.restrictions}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Loan Approval Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Loan Approval Workflow</span>
          </CardTitle>
          <CardDescription>
            Approval process based on loan amount thresholds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {loanApprovalWorkflow.map((workflow, index) => (
              <div key={index} className="bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">{workflow.type}</h4>
                  <Badge variant="outline" className="bg-white">
                    {workflow.amount}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2 overflow-x-auto">
                  {workflow.workflow.map((stage, stageIndex) => (
                    <React.Fragment key={stageIndex}>
                      <div className="flex flex-col items-center space-y-2 min-w-fit">
                        <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                        <span className="text-xs text-slate-600 text-center whitespace-nowrap">
                          {stage.stage}
                        </span>
                      </div>
                      {stageIndex < workflow.workflow.length - 1 && (
                        <div className="flex-shrink-0 w-8 h-px bg-slate-300" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Security Features</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">Role Assignment</h4>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span>Only Admins can assign/remove roles</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span>Role changes are logged in audit trail</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span>Multiple roles per user supported</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span>Highest role determines access level</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">Permission Enforcement</h4>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span>Server-side validation on all operations</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span>UI elements hidden based on permissions</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span>API endpoints protected by role middleware</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span>Database queries automatically filtered</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}