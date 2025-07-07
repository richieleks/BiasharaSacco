import { useRBAC } from "@/hooks/useRBAC";
import MetricsGrid from "./metrics-grid";
import RecentTransactions from "./recent-transactions";
import QuickActions from "./quick-actions";
import PendingApprovals from "./pending-approvals";
import MemberApprovals from "./member-approvals";
import LoanApprovalWorkflow from "./loan-approval-workflow";
import AnalyticsCharts from "./analytics-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";

// Role-specific dashboard components
function AdminDashboard() {
  return (
    <div className="space-y-6">
      <MetricsGrid />
      <AnalyticsCharts />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MemberApprovals />
        <LoanApprovalWorkflow />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentTransactions />
        <QuickActions />
      </div>
      <PendingApprovals />
    </div>
  );
}

function ManagerDashboard() {
  return (
    <div className="space-y-6">
      <MetricsGrid />
      <AnalyticsCharts />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LoanApprovalWorkflow />
        <MemberApprovals />
      </div>
      <RecentTransactions />
      <Card>
        <CardHeader>
          <CardTitle>Management Reports</CardTitle>
          <CardDescription>Access detailed reports and analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            View comprehensive reports on member activity, loan performance, and financial metrics.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CommitteeDashboard() {
  return (
    <div className="space-y-6">
      <MetricsGrid />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LoanApprovalWorkflow />
        <MemberApprovals />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Committee Queue</CardTitle>
          <CardDescription>Items requiring committee review</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Review and approve member applications and loan requests assigned to the committee.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TellerDashboard() {
  return (
    <div className="space-y-6">
      <MetricsGrid />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActions />
        <RecentTransactions />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Daily Operations</CardTitle>
          <CardDescription>Today's transaction summary</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Process member transactions, deposits, withdrawals, and loan disbursements.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user?.member?.fullName || 'Member'}</CardTitle>
          <CardDescription>Your personal SACCO dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Member Number</h3>
              <p className="text-2xl font-bold text-primary">{user?.member?.memberNumber}</p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Status</h3>
              <p className="text-2xl font-bold capitalize">{user?.member?.status}</p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Join Date</h3>
              <p className="text-sm">{user?.member?.joinDate ? new Date(user.member.joinDate).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="savings" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="savings">My Savings</TabsTrigger>
          <TabsTrigger value="loans">My Loans</TabsTrigger>
          <TabsTrigger value="transactions">My Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="savings">
          <Card>
            <CardHeader>
              <CardTitle>Savings Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View your savings account balance and history.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="loans">
          <Card>
            <CardHeader>
              <CardTitle>Loan Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Track your loan applications and active loans.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Review your recent transactions and activities.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function RoleBasedDashboard() {
  const { userRole, isLoading } = useRBAC();
  
  if (isLoading) {
    return <div>Loading dashboard...</div>;
  }
  
  switch (userRole) {
    case 'admin':
      return <AdminDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    case 'committee':
      return <CommitteeDashboard />;
    case 'teller':
      return <TellerDashboard />;
    case 'member':
      return <MemberDashboard />;
    default:
      return <MemberDashboard />;
  }
}