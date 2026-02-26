import { useRBAC } from "@/hooks/useRBAC";
import { useQuery } from "@tanstack/react-query";
import MetricsGrid from "./metrics-grid";
import RecentTransactions from "./recent-transactions";
import PendingApprovals from "./pending-approvals";
import MemberApprovals from "./member-approvals";
import LoanApprovalWorkflow from "./loan-approval-workflow";
import AnalyticsCharts from "./analytics-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { PiggyBank, HandCoins, ArrowUp, ArrowDown, CreditCard, TrendingUp } from "lucide-react";

// Role-specific dashboard components
function AdminDashboard() {
  return (
    <div className="space-y-6">
      <MetricsGrid />
      <AnalyticsCharts />
      <MemberApprovals />
      <LoanApprovalWorkflow />
      <RecentTransactions />
      <PendingApprovals />
    </div>
  );
}

function ManagerDashboard() {
  return (
    <div className="space-y-6">
      <MetricsGrid />
      <AnalyticsCharts />
      <LoanApprovalWorkflow />
      <MemberApprovals />
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
      <LoanApprovalWorkflow />
      <MemberApprovals />
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
      <RecentTransactions />
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
  const memberId = user?.member?.id;

  const { data: savingsAccounts } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'savings'],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}/savings`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch savings');
      return res.json();
    },
    enabled: !!memberId,
    refetchInterval: 30000,
  });

  const { data: memberLoans } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'loans'],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}/loans`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch loans');
      return res.json();
    },
    enabled: !!memberId,
    refetchInterval: 30000,
  });

  const { data: memberTransactions } = useQuery<any[]>({
    queryKey: ['/api/transactions/my-transactions'],
    enabled: !!memberId,
    refetchInterval: 30000,
  });

  const totalSavings = savingsAccounts?.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance || '0'), 0) || 0;
  const activeLoansCount = memberLoans?.filter((l: any) => l.status === 'approved').length || 0;
  const totalOutstanding = memberLoans?.filter((l: any) => l.status === 'approved').reduce((sum: number, l: any) => sum + parseFloat(l.outstandingBalance || '0'), 0) || 0;
  const totalInterestEarned = memberTransactions
    ?.filter((t: any) => t.transactionType === 'interest_credit' && t.status === 'completed')
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0) || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user?.member?.fullName || 'Member'}</CardTitle>
          <CardDescription>Your personal SACCO dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-slate-500">Member Number</h3>
              <p className="text-base sm:text-xl font-bold text-primary mt-1 truncate">{user?.member?.memberNumber}</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-slate-500">Total Savings</h3>
              <p className="text-base sm:text-xl font-bold text-green-600 mt-1 truncate">UGX {totalSavings.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-slate-500">Interest Earned</h3>
              <p className="text-base sm:text-xl font-bold text-emerald-600 mt-1 truncate">UGX {totalInterestEarned.toLocaleString()}</p>
              <p className="text-xs text-slate-400">Total credited</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-slate-500">Active Loans</h3>
              <p className="text-base sm:text-xl font-bold text-yellow-600 mt-1">{activeLoansCount}</p>
              {totalOutstanding > 0 && <p className="text-xs text-slate-400 truncate">UGX {totalOutstanding.toLocaleString()} outstanding</p>}
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg col-span-2 sm:col-span-1">
              <h3 className="text-xs sm:text-sm font-medium text-slate-500">Status</h3>
              <p className="text-base sm:text-xl font-bold capitalize text-blue-600 mt-1">{user?.member?.status}</p>
              <p className="text-xs text-slate-400">{user?.member?.joinDate ? `Since ${new Date(user.member.joinDate).toLocaleDateString()}` : ''}</p>
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
              <div className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-green-600" />
                <CardTitle>Savings Accounts</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {savingsAccounts && savingsAccounts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savingsAccounts.map((acc: any) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-medium">{acc.accountNumber}</TableCell>
                        <TableCell className="capitalize">{acc.accountType}</TableCell>
                        <TableCell className="font-semibold text-green-600">UGX {parseFloat(acc.balance || '0').toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={acc.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                            {acc.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No savings accounts found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="loans">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-yellow-600" />
                <CardTitle>My Loans</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {memberLoans && memberLoans.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberLoans.map((loan: any) => (
                      <TableRow key={loan.id}>
                        <TableCell className="capitalize">{loan.loanType?.replace('_', ' ')}</TableCell>
                        <TableCell>UGX {parseFloat(loan.principalAmount || '0').toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">UGX {parseFloat(loan.outstandingBalance || '0').toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={
                            loan.status === 'approved' ? 'bg-green-100 text-green-800' :
                            loan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            loan.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-800'
                          }>
                            {loan.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No loan records found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <CardTitle>Recent Transactions</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {memberTransactions && memberTransactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberTransactions.slice(0, 10).map((txn: any) => (
                      <TableRow key={txn.id}>
                        <TableCell>{new Date(txn.transactionDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {txn.transactionType === 'deposit' && <ArrowUp className="h-4 w-4 text-green-600" />}
                            {txn.transactionType === 'withdrawal' && <ArrowDown className="h-4 w-4 text-red-600" />}
                            {txn.transactionType === 'loan_payment' && <CreditCard className="h-4 w-4 text-blue-600" />}
                            <span className="capitalize">{txn.transactionType?.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`font-semibold ${txn.transactionType === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                          {txn.transactionType === 'deposit' ? '+' : '-'}UGX {parseFloat(txn.amount || '0').toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            txn.status === 'completed' ? 'bg-green-100 text-green-800' :
                            txn.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-slate-100 text-slate-800'
                          }>
                            {txn.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No transactions found.</p>
              )}
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