import { useState } from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import MetricsGrid from "./metrics-grid";
import RecentTransactions from "./recent-transactions";
import PendingApprovals from "./pending-approvals";
import MemberApprovals from "./member-approvals";
import LoanApprovalWorkflow from "./loan-approval-workflow";
import AnalyticsCharts from "./analytics-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { 
  PiggyBank, HandCoins, ArrowUp, ArrowDown, CreditCard, TrendingUp, 
  User, Phone, Mail, MapPin, Calendar, Building, Hash, Wallet, 
  Banknote, Shield, Briefcase, Heart, Users, Activity, Eye, FileText,
  DollarSign, CheckCircle, XCircle, ClipboardList
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

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

function CommitteeApprovalActivity() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('all');

  const { data: activityData, isLoading } = useQuery<any>({
    queryKey: ['/api/loans/my-approval-activity'],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5" />
            My Approval Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const approved = activityData?.approved || [];
  const rejected = activityData?.rejected || [];
  const summary = activityData?.summary || { totalApproved: 0, totalRejected: 0, totalReviewed: 0 };

  const allActivity = [...approved, ...rejected].sort((a: any, b: any) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  const filteredActivity = activeTab === 'approved' ? approved :
    activeTab === 'rejected' ? rejected : allActivity;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" />
              My Approval Activity
            </CardTitle>
            <CardDescription>Loans you have reviewed as a committee member</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 border rounded-xl p-3 text-center">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Reviewed</p>
            <p className="text-xl font-bold mt-0.5">{summary.totalReviewed}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
            <p className="text-xs font-medium text-green-600">Approved</p>
            <p className="text-xl font-bold text-green-700 mt-0.5">{summary.totalApproved}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-xs font-medium text-red-600">Declined</p>
            <p className="text-xl font-bold text-red-700 mt-0.5">{summary.totalRejected}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full mb-4">
            <TabsTrigger value="all">All ({allActivity.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="rejected">Declined ({rejected.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {filteredActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden sm:table-cell">Amount</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead className="hidden md:table-cell">Comments</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivity.map((item: any, idx: number) => (
                  <TableRow key={`${item.action}-${item.id}-${idx}`}>
                    <TableCell className="font-medium text-xs">{item.loanNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{item.memberName}</p>
                        <p className="text-xs text-muted-foreground">{item.memberNumber}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{formatCurrency(item.principalAmount)}</TableCell>
                    <TableCell>
                      {item.action === 'approved' ? (
                        <Badge className="bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Approved
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Declined
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs max-w-[200px] truncate">
                      {item.comments || '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.date ? format(new Date(item.date), 'dd MMM yyyy') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No approval activity yet</p>
            <p className="text-sm mt-1">Loans you review will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommitteeDashboard() {
  return (
    <div className="space-y-6">
      <MetricsGrid />
      <LoanApprovalWorkflow />
      <CommitteeApprovalActivity />
      <MemberApprovals />
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

function MemberInfoRow({ icon: Icon, label, value, className = "" }: { icon?: any; label: string; value: string | number | null | undefined; className?: string }) {
  return (
    <div className={`flex items-start gap-3 py-2.5 ${className}`}>
      {Icon && <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">{value || 'Not provided'}</p>
      </div>
    </div>
  );
}

function MemberStatCard({ icon: Icon, label, value, color, subtext }: { icon: any; label: string; value: string | number; color: string; subtext?: string }) {
  const colorMap: Record<string, string> = {
    green: "from-emerald-500 to-emerald-600 shadow-emerald-200",
    blue: "from-blue-500 to-blue-600 shadow-blue-200",
    orange: "from-amber-500 to-amber-600 shadow-amber-200",
    purple: "from-violet-500 to-violet-600 shadow-violet-200",
  };
  return (
    <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-gradient-to-br ${colorMap[color] || colorMap.blue} p-2.5 shadow-lg`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">{value}</p>
          {subtext && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

function formatMemberDate(dateStr: string | null | undefined, formatStr: string = 'PP') {
  if (!dateStr) return 'N/A';
  try { return format(new Date(dateStr), formatStr); } catch { return 'N/A'; }
}

function MemberDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const memberId = user?.member?.id;
  const authMember = user?.member as any;

  const { data: freshMemberData } = useQuery<any>({
    queryKey: ['/api/members', memberId],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch member');
      return res.json();
    },
    enabled: !!memberId,
    refetchInterval: 30000,
  });

  const { data: systemConfig } = useQuery<any>({
    queryKey: ['/api/system/settings/public'],
  });

  const member = freshMemberData || authMember;

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

  const memberName = member?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Member';
  const initials = memberName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const totalSavings = savingsAccounts?.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance || '0'), 0) || 0;
  const activeLoans = memberLoans?.filter((l: any) => ['active', 'approved', 'disbursed'].includes(l.status)) || [];
  const totalOutstanding = activeLoans.reduce((sum: number, l: any) => sum + parseFloat(l.outstandingBalance || '0'), 0);
  const numberOfShares = member?.numberOfShares || 4;
  const perSharePrice = systemConfig?.sharePrice ?? parseFloat(member?.shareContribution || "20000");
  const shareExpected = perSharePrice * numberOfShares;
  const sharePaid = parseFloat(member?.shareCapital || "0");

  const recentTransactions = Array.isArray(memberTransactions)
    ? [...memberTransactions].sort((a: any, b: any) => new Date(b.transactionDate || b.createdAt || 0).getTime() - new Date(a.transactionDate || a.createdAt || 0).getTime()).slice(0, 15)
    : [];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-blue-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-60" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white dark:bg-slate-900/15 backdrop-blur-sm flex items-center justify-center text-2xl sm:text-3xl font-bold border border-white/20 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{memberName}</h1>
              <Badge className={`w-fit text-xs font-semibold ${
                member?.status === 'active' ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30' :
                member?.status === 'inactive' ? 'bg-slate-400/20 text-slate-300 border-slate-400/30' :
                member?.status === 'suspended' ? 'bg-red-400/20 text-red-300 border-red-400/30' :
                'bg-amber-400/20 text-amber-300 border-amber-400/30'
              } border capitalize`}>
                {member?.status || 'pending'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                {member?.memberNumber}
              </span>
              {member?.phoneNumber && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {member.phoneNumber}
                </span>
              )}
              {member?.department && (
                <span className="flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5" />
                  {member.department}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Joined {formatMemberDate(member?.joinDate || member?.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MemberStatCard
          icon={PiggyBank}
          label="Total Savings"
          value={formatCurrency(totalSavings)}
          color="green"
          subtext={`${Array.isArray(savingsAccounts) ? savingsAccounts.length : 0} account(s)`}
        />
        <MemberStatCard
          icon={Banknote}
          label="Active Loans"
          value={activeLoans.length}
          color="orange"
          subtext={totalOutstanding > 0 ? `${formatCurrency(totalOutstanding)} outstanding` : 'No outstanding'}
        />
        <MemberStatCard
          icon={Activity}
          label="Transactions"
          value={Array.isArray(memberTransactions) ? memberTransactions.length : 0}
          color="blue"
        />
        <MemberStatCard
          icon={TrendingUp}
          label="Share Capital"
          value={formatCurrency(sharePaid)}
          color="purple"
          subtext={member?.isPaidUp ? 'Fully paid' : `${shareExpected > 0 ? Math.round((sharePaid / shareExpected) * 100) : 0}% of target`}
        />
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-full inline-flex sm:grid sm:grid-cols-5 h-auto gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl min-w-max sm:min-w-0">
            <TabsTrigger value="personal" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:bg-slate-900 data-[state=active]:shadow-sm py-2 px-4 sm:px-3">Personal</TabsTrigger>
            <TabsTrigger value="financial" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:bg-slate-900 data-[state=active]:shadow-sm py-2 px-4 sm:px-3">Financial</TabsTrigger>
            <TabsTrigger value="savings" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:bg-slate-900 data-[state=active]:shadow-sm py-2 px-4 sm:px-3">Savings</TabsTrigger>
            <TabsTrigger value="loans" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:bg-slate-900 data-[state=active]:shadow-sm py-2 px-4 sm:px-3">Loans</TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:bg-slate-900 data-[state=active]:shadow-sm py-2 px-4 sm:px-3">History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="personal" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/50 p-1.5"><User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /></div>
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <MemberInfoRow icon={User} label="Full Name" value={memberName} />
                  <MemberInfoRow icon={Hash} label="Member Number" value={member?.memberNumber} />
                  <MemberInfoRow icon={Shield} label="ID Number" value={member?.idNumber} />
                  <MemberInfoRow icon={Calendar} label="Date of Birth" value={member?.dateOfBirth} />
                  <MemberInfoRow label="Gender" value={member?.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : null} />
                  <MemberInfoRow label="Marital Status" value={member?.maritalStatus ? member.maritalStatus.charAt(0).toUpperCase() + member.maritalStatus.slice(1) : null} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <div className="rounded-md bg-green-50 dark:bg-green-950/50 p-1.5"><Phone className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /></div>
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <MemberInfoRow icon={Phone} label="Phone" value={member?.phoneNumber} />
                  <MemberInfoRow icon={Mail} label="Email" value={member?.email || user?.email} />
                </div>
                <MemberInfoRow icon={MapPin} label="Address" value={member?.address} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/50 p-1.5"><Briefcase className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /></div>
                  Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <MemberInfoRow icon={Building} label="Department" value={member?.department} />
                  <MemberInfoRow label="Section" value={member?.section} />
                  <MemberInfoRow icon={Briefcase} label="Terms of Service" value={member?.termsOfService ? member.termsOfService.charAt(0).toUpperCase() + member.termsOfService.slice(1) : null} />
                  <MemberInfoRow icon={CreditCard} label="Staff Account" value={member?.staffAccountNumber} />
                </div>
                <MemberInfoRow icon={Wallet} label="Average Net Pay" value={member?.averageNetPay ? formatCurrency(member.averageNetPay) : null} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 p-1.5"><Heart className="h-3.5 w-3.5 text-rose-600" /></div>
                  Next of Kin & Beneficiary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <MemberInfoRow icon={Users} label="Next of Kin" value={member?.nextOfKinName} />
                  <MemberInfoRow icon={Phone} label="Kin Phone" value={member?.nextOfKinPhone} />
                  <MemberInfoRow icon={Heart} label="Beneficiary" value={member?.beneficiaryName} />
                  <MemberInfoRow label="Relationship" value={member?.beneficiaryRelationship} />
                </div>
                <MemberInfoRow icon={Phone} label="Beneficiary Contact" value={member?.beneficiaryContact} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <div className="rounded-md bg-green-50 dark:bg-green-950/50 p-1.5"><Wallet className="h-3.5 w-3.5 text-green-600" /></div>
                  Savings Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <MemberInfoRow icon={PiggyBank} label="Monthly Savings" value={member?.monthlySavings ? formatCurrency(member.monthlySavings) : null} />
                  <MemberInfoRow icon={CreditCard} label="Bank Account" value={member?.accountNumber} />
                  <MemberInfoRow icon={Building} label="Bank Branch" value={member?.branch} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <div className="rounded-md bg-violet-50 dark:bg-violet-950/50 p-1.5"><TrendingUp className="h-3.5 w-3.5 text-violet-600" /></div>
                  Share Capital
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <MemberInfoRow icon={DollarSign} label="Number of Shares" value={numberOfShares} />
                  <MemberInfoRow icon={Wallet} label="Per Share" value={formatCurrency(perSharePrice)} />
                  <MemberInfoRow icon={TrendingUp} label="Total Paid" value={formatCurrency(sharePaid)} />
                  <MemberInfoRow icon={Banknote} label="Expected Total" value={formatCurrency(shareExpected)} />
                  {shareExpected > sharePaid && (
                    <MemberInfoRow icon={Banknote} label="Balance" value={formatCurrency(shareExpected - sharePaid)} />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="savings" className="mt-4">
          <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <div className="rounded-md bg-green-50 dark:bg-green-950/50 p-1.5"><PiggyBank className="h-3.5 w-3.5 text-green-600" /></div>
                  Savings Accounts
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/50" onClick={() => setLocation('/savings')} data-testid="button-request-withdrawal-dashboard">
                    <ArrowDown className="mr-1.5 h-3.5 w-3.5" />
                    Request Withdrawal
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLocation('/savings')}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    View All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {savingsAccounts && savingsAccounts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Number</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savingsAccounts.map((acc: any) => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.accountNumber}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{acc.accountType}</Badge></TableCell>
                          <TableCell className="font-semibold text-green-600">{formatCurrency(acc.balance || '0')}</TableCell>
                          <TableCell>
                            <Badge className={acc.status === 'active' ? 'bg-green-100 text-green-800 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'}>
                              {acc.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setLocation(`/savings/${acc.uuid}/statement`)}>
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              Statement
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <PiggyBank className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No savings accounts found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans" className="mt-4">
          <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/50 p-1.5"><HandCoins className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /></div>
                  My Loans
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setLocation('/loans')}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {memberLoans && memberLoans.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Monthly</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberLoans.map((loan: any) => (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium capitalize">{loan.loanType?.displayName || loan.loanType?.replace('_', ' ') || 'Loan'}</TableCell>
                          <TableCell>{formatCurrency(loan.principalAmount || '0')}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(loan.outstandingBalance || '0')}</TableCell>
                          <TableCell>{formatCurrency(loan.monthlyPayment || '0')}</TableCell>
                          <TableCell>
                            <Badge className={
                              loan.status === 'approved' || loan.status === 'disbursed' ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' :
                              loan.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300' :
                              loan.status === 'completed' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300' :
                              loan.status === 'rejected' ? 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }>
                              {loan.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <HandCoins className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No loan records found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/50 p-1.5"><CreditCard className="h-3.5 w-3.5 text-blue-600" /></div>
                  Transaction History
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setLocation('/transactions')}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.map((txn: any) => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-sm">{new Date(txn.transactionDate || txn.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{txn.description || txn.transactionType?.replace(/_/g, ' ')}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {['deposit', 'interest_credit', 'loan_disbursement'].includes(txn.transactionType) ? (
                                <ArrowUp className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-red-600" />
                              )}
                              <span className="capitalize text-xs">{txn.transactionType?.replace(/_/g, ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell className={`font-semibold ${['deposit', 'interest_credit', 'loan_disbursement'].includes(txn.transactionType) ? 'text-green-600' : 'text-red-600'}`}>
                            {['deposit', 'interest_credit', 'loan_disbursement'].includes(txn.transactionType) ? '+' : '-'}{formatCurrency(txn.amount || '0')}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              txn.status === 'completed' ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' :
                              txn.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }>
                              {txn.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No transactions found.</p>
                </div>
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
    case 'member':
      return <MemberDashboard />;
    default:
      return <MemberDashboard />;
  }
}