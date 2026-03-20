import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, FileText, TrendingUp, Users, PiggyBank, HandCoins, Calendar, Filter, Printer, Mail, FileSpreadsheet, AlertTriangle, UserX, Clock, RefreshCw, Eye } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

interface ReportFilter {
  startDate?: Date;
  endDate?: Date;
  memberNumber?: string;
  reportType?: string;
  status?: string;
}

interface ActivityMember {
  id: number;
  memberNumber: string;
  fullName: string;
  status: string;
  lastSavingsDate: string | null;
  totalSavings: string;
  phoneNumber: string;
  joinDate: string | null;
  daysSinceLastSaving: number | null;
}

interface ActivityReport {
  summary: {
    total: number;
    active: number;
    inactive: number;
    dormant: number;
    suspended: number;
    atRisk: number;
  };
  inactiveMembers: ActivityMember[];
  dormantMembers: ActivityMember[];
  atRiskMembers: ActivityMember[];
}

function MemberActivityTab() {
  const { toast } = useToast();
  const [activityView, setActivityView] = useState<'dormant' | 'inactive' | 'at-risk'>('dormant');
  const [actPage, setActPage] = useState(1);
  const [actPageSize, setActPageSize] = useState(25);
  const qc = useQueryClient();

  const { data: activityReport, isLoading: activityLoading } = useQuery<ActivityReport>({
    queryKey: ['/api/reports/member-activity'],
  });

  const checkActivityMutation = useMutation({
    mutationFn: async () => await apiRequest("POST", "/api/members/check-activity"),
    onSuccess: () => {
      toast({ title: "Activity Check Complete", description: "Member statuses have been updated based on savings activity.", variant: "success" });
      qc.invalidateQueries({ queryKey: ['/api/reports/member-activity'] });
      qc.invalidateQueries({ queryKey: ['/api/members'] });
    },
    onError: (error: Error) => {
      toast({ title: "Check Failed", description: error.message, variant: "destructive" });
    },
  });

  const currentList = activityView === 'dormant'
    ? activityReport?.dormantMembers || []
    : activityView === 'inactive'
    ? activityReport?.inactiveMembers || []
    : activityReport?.atRiskMembers || [];

  return (
    <TabsContent value="activity" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Member Activity Report</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Members inactive for 3+ months (no savings, no running loan) become inactive. 6+ months become dormant.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => checkActivityMutation.mutate()}
          disabled={checkActivityMutation.isPending}
          data-testid="button-run-activity-check"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${checkActivityMutation.isPending ? 'animate-spin' : ''}`} />
          {checkActivityMutation.isPending ? "Checking..." : "Run Activity Check"}
        </Button>
      </div>

      {activityLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="section-card p-5">
              <Skeleton className="h-4 w-20 mb-2 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              <Skeleton className="h-8 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            </div>
          ))}
        </div>
      ) : activityReport ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="section-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100" data-testid="text-active-count">{activityReport.summary.active}</p>
            </div>
            <div
              className={`section-card p-4 cursor-pointer transition-all ${activityView === 'at-risk' ? 'ring-2 ring-amber-500' : ''}`}
              onClick={() => { setActivityView('at-risk'); setActPage(1); }}
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">At Risk</span>
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-at-risk-count">{activityReport.summary.atRisk}</p>
              <p className="text-xs text-slate-400 mt-0.5">2+ months no savings</p>
            </div>
            <div
              className={`section-card p-4 cursor-pointer transition-all ${activityView === 'inactive' ? 'ring-2 ring-orange-500' : ''}`}
              onClick={() => { setActivityView('inactive'); setActPage(1); }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inactive</span>
              </div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-inactive-count">{activityReport.summary.inactive}</p>
              <p className="text-xs text-slate-400 mt-0.5">3+ months no savings</p>
            </div>
            <div
              className={`section-card p-4 cursor-pointer transition-all ${activityView === 'dormant' ? 'ring-2 ring-red-500' : ''}`}
              onClick={() => { setActivityView('dormant'); setActPage(1); }}
            >
              <div className="flex items-center gap-2 mb-1">
                <UserX className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dormant</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-dormant-count">{activityReport.summary.dormant}</p>
              <p className="text-xs text-slate-400 mt-0.5">6+ months no savings</p>
            </div>
            <div className="section-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100" data-testid="text-total-count">{activityReport.summary.total}</p>
            </div>
          </div>

          <div className="section-card">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {activityView === 'dormant' && `Dormant Members (${currentList.length})`}
                {activityView === 'inactive' && `Inactive Members (${currentList.length})`}
                {activityView === 'at-risk' && `At-Risk Members (${currentList.length})`}
              </h4>
              <Badge variant="outline" className={
                activityView === 'dormant' ? 'border-red-200 text-red-700 dark:text-red-400' :
                activityView === 'inactive' ? 'border-orange-200 text-orange-700 dark:text-orange-400' :
                'border-amber-200 text-amber-700 dark:text-amber-400'
              }>
                {activityView === 'dormant' && '6+ months no savings'}
                {activityView === 'inactive' && '3-6 months no savings'}
                {activityView === 'at-risk' && '2-3 months no savings'}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              {currentList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <UserX className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No {activityView === 'at-risk' ? 'at-risk' : activityView} members found.</p>
                </div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Last Savings</TableHead>
                      <TableHead>Days Inactive</TableHead>
                      <TableHead className="text-right">Total Savings</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentList
                      .slice((actPage - 1) * actPageSize, actPage * actPageSize)
                      .map((m) => (
                      <TableRow key={m.id} data-testid={`row-activity-member-${m.id}`}>
                        <TableCell className="font-mono text-xs">{m.memberNumber}</TableCell>
                        <TableCell>
                          <a href={`/members/${m.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium" data-testid={`link-activity-member-${m.id}`}>
                            {m.fullName}
                          </a>
                        </TableCell>
                        <TableCell className="text-sm">{m.phoneNumber}</TableCell>
                        <TableCell className="text-sm">
                          {m.lastSavingsDate
                            ? new Date(m.lastSavingsDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : <span className="text-red-500 dark:text-red-400 text-xs">Never saved</span>
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            (m.daysSinceLastSaving || 999) >= 180 ? 'border-red-200 text-red-700 dark:text-red-400' :
                            (m.daysSinceLastSaving || 999) >= 90 ? 'border-orange-200 text-orange-700 dark:text-orange-400' :
                            'border-amber-200 text-amber-700 dark:text-amber-400'
                          }>
                            {m.daysSinceLastSaving != null ? `${m.daysSinceLastSaving} days` : 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(parseFloat(m.totalSavings || '0'))}</TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {m.joinDate ? new Date(m.joinDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {currentList.length > 0 && (
                  <Pagination
                    currentPage={actPage}
                    totalPages={Math.ceil(currentList.length / actPageSize)}
                    onPageChange={setActPage}
                    itemsPerPage={actPageSize}
                    onItemsPerPageChange={(size) => { setActPageSize(size); setActPage(1); }}
                    totalItems={currentList.length}
                  />
                )}
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </TabsContent>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function BankSchedulesTab() {
  const { toast } = useToast();
  const currentMonth = MONTHS[new Date().getMonth()];
  const [savingsMonth, setSavingsMonth] = useState(currentMonth);
  const [loanMonth, setLoanMonth] = useState(currentMonth);
  const [downloadingSavings, setDownloadingSavings] = useState(false);
  const [downloadingLoans, setDownloadingLoans] = useState(false);

  const downloadSchedule = async (type: 'savings' | 'loan', month: string) => {
    const setLoading = type === 'savings' ? setDownloadingSavings : setDownloadingLoans;
    setLoading(true);
    try {
      const endpoint = type === 'savings' ? 'savings-schedule' : 'loan-schedule';
      const response = await fetch(`/api/reports/${endpoint}?month=${encodeURIComponent(month)}`, { credentials: 'include' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(err.message);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `BIASHARA_${month.toUpperCase()}_${new Date().getFullYear()}_${type.toUpperCase()}_SCHEDULE.xlsx`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Download Started", description: `${type === 'savings' ? 'Savings' : 'Loan'} schedule for ${month} downloaded.`, variant: "success" });
    } catch (error: any) {
      toast({ title: "Download Failed", description: error.message || 'Failed to download schedule.', variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <TabsContent value="schedules" className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Bank Deduction Schedules</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Generate KCB bank transfer schedule files for monthly salary deductions. These Excel files can be submitted directly to the bank.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="section-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <PiggyBank className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Savings Deduction Schedule</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monthly savings contributions from member salaries</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600 dark:text-slate-300">Month</Label>
            <Select value={savingsMonth} onValueChange={setSavingsMonth}>
              <SelectTrigger data-testid="select-savings-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m} value={m}>{m} {new Date().getFullYear()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => downloadSchedule('savings', savingsMonth)}
            disabled={downloadingSavings}
            data-testid="button-download-savings-schedule"
          >
            {downloadingSavings ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Savings Schedule
              </>
            )}
          </Button>
        </div>

        <div className="section-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <HandCoins className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Loan Repayment Schedule</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monthly loan repayments deducted from member salaries</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600 dark:text-slate-300">Month</Label>
            <Select value={loanMonth} onValueChange={setLoanMonth}>
              <SelectTrigger data-testid="select-loan-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m} value={m}>{m} {new Date().getFullYear()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => downloadSchedule('loan', loanMonth)}
            disabled={downloadingLoans}
            data-testid="button-download-loan-schedule"
          >
            {downloadingLoans ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Loan Schedule
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="section-card p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">About Bank Schedules</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Savings schedule includes all active members with a monthly savings amount and bank account on file.</li>
              <li>Loan schedule includes all members with active/disbursed loans that have a monthly repayment amount.</li>
              <li>Files are generated in KCB bank transfer format ready for direct submission.</li>
              <li>Bank details (branch code, SACCO account, SWIFT code) can be configured in Admin Settings.</li>
            </ul>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [filters, setFilters] = useState<ReportFilter>({});
  const [rptPage, setRptPage] = useState(1);
  const [rptPageSize, setRptPageSize] = useState(25);
  const [delinqPage, setDelinqPage] = useState(1);
  const [delinqPageSize, setDelinqPageSize] = useState(25);
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: metrics, isLoading: metricsLoading } = useQuery<{
    totalMembers: number;
    totalSavings: string;
    activeLoans: string;
    repaymentRate: string;
  }>({
    queryKey: ['/api/dashboard/metrics'],
    enabled: isAuthenticated,
  });

  const reportEndpoint = activeTab === 'custom' ? selectedReport : activeTab;

  const { data: reportData, isLoading: reportLoading, refetch } = useQuery({
    queryKey: ['/api/reports', reportEndpoint, filters],
    queryFn: async () => {
      if (!reportEndpoint) return null;
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.memberNumber) params.append('memberNumber', filters.memberNumber);
      if (filters.status) params.append('status', filters.status);
      
      const res = await apiRequest('GET', `/api/reports/${reportEndpoint}?${params.toString()}`);
      return await res.json();
    },
    enabled: isAuthenticated && activeTab !== 'overview' && activeTab !== 'activity' && activeTab !== 'schedules' && !!reportEndpoint,
  });

  const reportTypes = [
    {
      id: "members",
      title: "Member Report",
      description: "Comprehensive list of all SACCO members with their status and account details",
      icon: Users,
      color: "bg-blue-100 text-blue-800 dark:text-blue-300 dark:bg-blue-900 dark:text-blue-200",
      fields: ["Member Number", "Full Name", "Status", "Department", "Join Date", "Total Savings"],
    },
    {
      id: "savings",
      title: "Savings Summary",
      description: "Overview of all savings accounts, balances, and interest calculations",
      icon: PiggyBank,
      color: "bg-green-100 text-green-800 dark:text-green-300 dark:bg-green-900 dark:text-green-200",
      fields: ["Account Number", "Member Name", "Account Type", "Balance", "Interest Earned", "Last Transaction"],
    },
    {
      id: "loans",
      title: "Loan Portfolio",
      description: "Active loans, repayment schedules, and delinquency analysis",
      icon: HandCoins,
      color: "bg-purple-100 text-purple-800 dark:text-purple-300 dark:bg-purple-900 dark:text-purple-200",
      fields: ["Loan Number", "Member", "Amount", "Balance", "Interest Rate", "Status", "Due Date"],
    },
    {
      id: "transactions",
      title: "Transaction Report",
      description: "Detailed transaction history with filters by date, type, and member",
      icon: FileText,
      color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      fields: ["Date", "Reference", "Type", "Member", "Amount", "Balance", "Description"],
    },
    {
      id: "financial",
      title: "Financial Performance",
      description: "Revenue, expenses, profit/loss, and key financial ratios",
      icon: TrendingUp,
      color: "bg-red-100 text-red-800 dark:text-red-300 dark:bg-red-900 dark:text-red-200",
      fields: ["Period", "Total Revenue", "Total Expenses", "Net Income", "Loan Portfolio", "Savings Total"],
    },
    {
      id: "audit",
      title: "Audit Trail",
      description: "Complete log of all system activities and user actions",
      icon: BarChart3,
      color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      fields: ["Timestamp", "User", "Action", "Resource", "Details", "IP Address"],
    },
  ];

  const handleGenerateReport = (reportType: string) => {
    setSelectedReport(reportType);
    setIsReportModalOpen(true);
  };

  const handleExportReport = (format: 'pdf' | 'excel' | 'csv') => {
    if (!selectedReport) return;
    
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
    if (filters.memberNumber) params.append('memberNumber', filters.memberNumber);
    if (filters.status) params.append('status', filters.status);
    
    const downloadUrl = `/api/reports/download/${selectedReport}?${params.toString()}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Downloading Report",
      description: `Your ${selectedReport} report is being downloaded as ${format.toUpperCase()}.`, variant: "success" });
    setIsReportModalOpen(false);
  };

  return (
    <div className="space-y-6 page-container animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Generate comprehensive reports and analyze SACCO performance</p>
      </div>

      {/* Tabs for different report sections */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setRptPage(1); setDelinqPage(1); }} className="space-y-6">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="activity">Member Activity</TabsTrigger>
          <TabsTrigger value="schedules">Bank Schedules</TabsTrigger>
          <TabsTrigger value="custom">Custom Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          {metricsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="section-card">
                  <div className="p-6">
                    <Skeleton className="h-4 w-24 mb-2 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                    <Skeleton className="h-8 w-32 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="section-card border-l-4 border-l-blue-500">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Total Members</p>
                      <p className="text-lg sm:text-2xl font-bold mt-1">{metrics.totalMembers}</p>
                    </div>
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="section-card border-l-4 border-l-green-500">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Total Savings</p>
                      <p className="text-lg sm:text-2xl font-bold mt-1 truncate">
                        {formatCurrency(metrics.totalSavings)}
                      </p>
                    </div>
                    <PiggyBank className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="section-card border-l-4 border-l-purple-500">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Active Loans</p>
                      <p className="text-lg sm:text-2xl font-bold mt-1 truncate">
                        {formatCurrency(metrics.activeLoans)}
                      </p>
                    </div>
                    <HandCoins className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="section-card border-l-4 border-l-yellow-500">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Repayment Rate</p>
                      <p className="text-lg sm:text-2xl font-bold mt-1">{metrics.repaymentRate}%</p>
                    </div>
                    <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Report Types Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {reportTypes.map((report) => (
              <div key={report.id} className="section-card hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${report.color}`}>
                      <report.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{report.title}</h3>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{report.description}</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setActiveTab(report.id === 'financial' ? 'financial' : 'custom');
                        setSelectedReport(report.id);
                        setRptPage(1);
                      }}
                      className="flex-1 rounded-xl"
                      variant="default"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Report
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleGenerateReport(report.id)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Members Reports Tab */}
        <TabsContent value="members" className="space-y-6">
          <div className="section-card">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Member Reports</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Generate reports for member data and activities</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Date Range</Label>
                    <div className="flex gap-2 mt-2">
                      <DatePicker
                        value={filters.startDate}
                        onChange={(date: Date | undefined) => setFilters({ ...filters, startDate: date })}
                        placeholder="Start Date"
                      />
                      <DatePicker
                        value={filters.endDate}
                        onChange={(date: Date | undefined) => setFilters({ ...filters, endDate: date })}
                        placeholder="End Date"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Member Status</Label>
                    <Select
                      value={filters.status}
                      onValueChange={(value) => setFilters({ ...filters, status: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="All Members" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Members</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => refetch()} className="rounded-xl">
                    <Filter className="w-4 h-4 mr-2" />
                    Apply Filters
                  </Button>
                  <Button variant="outline" onClick={() => setFilters({})}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {reportLoading ? (
            <div className="section-card">
              <div className="p-6">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          ) : Array.isArray(reportData) && reportData.length > 0 ? (
            <div className="section-card">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Report Results ({reportData.length} records)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </Button>
                    <Button size="sm" className="rounded-xl" onClick={() => { setSelectedReport('members'); handleGenerateReport('members'); }}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-6 overflow-x-auto">
                <Table className="table-modern">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Number</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Department</TableHead>
                      <TableHead className="hidden md:table-cell">Join Date</TableHead>
                      <TableHead>Total Savings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData
                      .slice((rptPage - 1) * rptPageSize, rptPage * rptPageSize)
                      .map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.memberNumber}</TableCell>
                        <TableCell>{row.fullName}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{row.department}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {row.joinDate ? new Date(row.joinDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>{formatCurrency(row.totalSavings)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reportData.length > 0 && (
                  <Pagination
                    currentPage={rptPage}
                    totalPages={Math.ceil(reportData.length / rptPageSize)}
                    onPageChange={setRptPage}
                    itemsPerPage={rptPageSize}
                    onItemsPerPageChange={(size) => { setRptPageSize(size); setRptPage(1); }}
                    totalItems={reportData.length}
                  />
                )}
              </div>
            </div>
          ) : reportData !== undefined ? (
            <div className="section-card">
              <div className="p-6 text-center py-8 text-slate-500 dark:text-slate-400">
                No data available for the selected criteria
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* Financial Reports Tab */}
        <TabsContent value="financial" className="space-y-6">
          {reportLoading ? (
            <div className="section-card">
              <div className="p-6">
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full bg-slate-100 dark:bg-slate-800 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          ) : reportData && !Array.isArray(reportData) ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <div className="section-card border-l-4 border-l-green-500">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Total Savings</p>
                    <p className="text-lg sm:text-2xl font-bold mt-1">{formatCurrency(reportData.savingsTotal)}</p>
                  </div>
                </div>
                <div className="section-card border-l-4 border-l-purple-500">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Loan Portfolio</p>
                    <p className="text-lg sm:text-2xl font-bold mt-1">{formatCurrency(reportData.loanPortfolio)}</p>
                  </div>
                </div>
                <div className="section-card border-l-4 border-l-blue-500">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Loan Repayments</p>
                    <p className="text-lg sm:text-2xl font-bold mt-1">{formatCurrency(reportData.revenue)}</p>
                  </div>
                </div>
                <div className="section-card border-l-4 border-l-red-500">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Disbursements</p>
                    <p className="text-lg sm:text-2xl font-bold mt-1">{formatCurrency(reportData.expenses)}</p>
                  </div>
                </div>
                <div className="section-card border-l-4 border-l-emerald-500">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Total Deposits</p>
                    <p className="text-lg sm:text-2xl font-bold mt-1">{formatCurrency(reportData.totalDeposits)}</p>
                  </div>
                </div>
                <div className="section-card border-l-4 border-l-amber-500">
                  <div className="p-4 sm:p-6">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Total Withdrawals</p>
                    <p className="text-lg sm:text-2xl font-bold mt-1">{formatCurrency(reportData.totalWithdrawals)}</p>
                  </div>
                </div>
              </div>
              <div className="section-card">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Summary</h3>
                </div>
                <div className="p-6">
                  <Table className="table-modern">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Total Members</TableCell>
                        <TableCell className="text-right">{reportData.totalMembers}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Active Loans</TableCell>
                        <TableCell className="text-right">{reportData.activeLoans}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Total Savings Held</TableCell>
                        <TableCell className="text-right">{formatCurrency(reportData.savingsTotal)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Outstanding Loan Portfolio</TableCell>
                        <TableCell className="text-right">{formatCurrency(reportData.loanPortfolio)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Total Loan Repayments</TableCell>
                        <TableCell className="text-right">{formatCurrency(reportData.revenue)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Total Disbursements</TableCell>
                        <TableCell className="text-right">{formatCurrency(reportData.expenses)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Net Position (Repayments - Disbursements)</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(reportData.netIncome)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {reportData.delinquent && (
                <div className="section-card border-t-4 border-t-red-500">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Delinquent Loans Report</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Loans that are past their due date with outstanding balances</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                          <Printer className="w-4 h-4 mr-2" />
                          Print
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                      <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-red-600">Delinquent Loans</p>
                        <p className="text-xl font-bold text-red-700 mt-1">{reportData.delinquent.count}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-red-600">Total Overdue Amount</p>
                        <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(reportData.delinquent.totalAmount)}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-red-600">Delinquency Rate</p>
                        <p className="text-xl font-bold text-red-700 mt-1">{reportData.delinquent.delinquencyRate}%</p>
                      </div>
                    </div>

                    {reportData.delinquent.loans.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table className="table-modern">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Loan #</TableHead>
                              <TableHead>Member</TableHead>
                              <TableHead className="hidden md:table-cell">Type</TableHead>
                              <TableHead>Principal</TableHead>
                              <TableHead>Outstanding</TableHead>
                              <TableHead className="hidden md:table-cell">Due Date</TableHead>
                              <TableHead>Days Overdue</TableHead>
                              <TableHead>Risk</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportData.delinquent.loans
                              .slice((delinqPage - 1) * delinqPageSize, delinqPage * delinqPageSize)
                              .map((loan: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium text-xs">{loan.loanNumber}</TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-sm">{loan.memberName}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{loan.memberNumber}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <Badge variant="outline" className="text-xs">{loan.loanType}</Badge>
                                </TableCell>
                                <TableCell>{formatCurrency(loan.principalAmount)}</TableCell>
                                <TableCell className="font-semibold text-red-600">{formatCurrency(loan.outstandingBalance)}</TableCell>
                                <TableCell className="hidden md:table-cell text-xs">
                                  {loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : '-'}
                                </TableCell>
                                <TableCell>
                                  <span className={`font-bold ${
                                    loan.daysOverdue > 90 ? 'text-red-600' :
                                    loan.daysOverdue > 30 ? 'text-orange-600' : 'text-yellow-600'
                                  }`}>
                                    {loan.daysOverdue}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    loan.riskLevel === 'critical' ? 'destructive' :
                                    loan.riskLevel === 'high' ? 'destructive' :
                                    loan.riskLevel === 'medium' ? 'default' : 'secondary'
                                  } className={`text-xs ${
                                    loan.riskLevel === 'critical' ? 'bg-red-700' :
                                    loan.riskLevel === 'high' ? 'bg-red-500' :
                                    loan.riskLevel === 'medium' ? 'bg-orange-500' : ''
                                  }`}>
                                    {loan.riskLevel}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {reportData.delinquent.loans.length > 0 && (
                          <Pagination
                            currentPage={delinqPage}
                            totalPages={Math.ceil(reportData.delinquent.loans.length / delinqPageSize)}
                            onPageChange={setDelinqPage}
                            itemsPerPage={delinqPageSize}
                            onItemsPerPageChange={(size) => { setDelinqPageSize(size); setDelinqPage(1); }}
                            totalItems={reportData.delinquent.loans.length}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-green-500" />
                        <p className="font-medium text-green-700">No delinquent loans</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">All active loans are within their repayment terms</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="section-card">
              <div className="p-6 text-center py-8 text-slate-500 dark:text-slate-400">
                No financial data available
              </div>
            </div>
          )}
        </TabsContent>

        {/* Member Activity Tab */}
        <MemberActivityTab />

        {/* Bank Schedules Tab */}
        <BankSchedulesTab />

        {/* Custom/Detail Reports Tab */}
        <TabsContent value="custom" className="space-y-6">
          <div className="section-card">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {selectedReport ? reportTypes.find(r => r.id === selectedReport)?.title || 'Report' : 'Select a Report'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedReport ? reportTypes.find(r => r.id === selectedReport)?.description : 'Choose a report from the overview tab'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedReport || ''} onValueChange={(v) => { setSelectedReport(v); setActiveTab('custom'); setRptPage(1); }}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select report..." />
                    </SelectTrigger>
                    <SelectContent>
                      {reportTypes.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {reportLoading ? (
            <div className="section-card">
              <div className="p-6">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          ) : Array.isArray(reportData) && reportData.length > 0 ? (
            <div className="section-card">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Results ({reportData.length} records)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </Button>
                    <Button size="sm" className="rounded-xl" onClick={() => selectedReport && handleGenerateReport(selectedReport)}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-6 overflow-x-auto">
                {selectedReport === 'savings' && (
                  <>
                  <Table className="table-modern">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Number</TableHead>
                        <TableHead>Member Name</TableHead>
                        <TableHead>Account Type</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead className="hidden md:table-cell">Last Transaction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData
                        .slice((rptPage - 1) * rptPageSize, rptPage * rptPageSize)
                        .map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.accountNumber}</TableCell>
                          <TableCell>{row.memberName}</TableCell>
                          <TableCell><Badge variant="secondary">{row.accountType}</Badge></TableCell>
                          <TableCell>{formatCurrency(row.balance)}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {row.lastTransaction ? new Date(row.lastTransaction).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {reportData.length > 0 && (
                    <Pagination
                      currentPage={rptPage}
                      totalPages={Math.ceil(reportData.length / rptPageSize)}
                      onPageChange={setRptPage}
                      itemsPerPage={rptPageSize}
                      onItemsPerPageChange={(size) => { setRptPageSize(size); setRptPage(1); }}
                      totalItems={reportData.length}
                    />
                  )}
                  </>
                )}
                {selectedReport === 'loans' && (
                  <>
                  <Table className="table-modern">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan Number</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead className="hidden md:table-cell">Interest Rate</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData
                        .slice((rptPage - 1) * rptPageSize, rptPage * rptPageSize)
                        .map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.loanNumber}</TableCell>
                          <TableCell>{row.memberName}</TableCell>
                          <TableCell>{formatCurrency(row.principalAmount)}</TableCell>
                          <TableCell>{formatCurrency(row.outstandingBalance)}</TableCell>
                          <TableCell className="hidden md:table-cell">{row.interestRate}</TableCell>
                          <TableCell>
                            <Badge variant={
                              row.status === 'active' || row.status === 'disbursed' ? 'default' :
                              row.status === 'completed' ? 'secondary' :
                              row.status === 'rejected' ? 'destructive' : 'outline'
                            }>
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {reportData.length > 0 && (
                    <Pagination
                      currentPage={rptPage}
                      totalPages={Math.ceil(reportData.length / rptPageSize)}
                      onPageChange={setRptPage}
                      itemsPerPage={rptPageSize}
                      onItemsPerPageChange={(size) => { setRptPageSize(size); setRptPage(1); }}
                      totalItems={reportData.length}
                    />
                  )}
                  </>
                )}
                {selectedReport === 'transactions' && (
                  <>
                  <Table className="table-modern">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="hidden md:table-cell">Member</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="hidden md:table-cell">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData
                        .slice((rptPage - 1) * rptPageSize, rptPage * rptPageSize)
                        .map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</TableCell>
                          <TableCell className="font-medium text-xs">{row.referenceNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.transactionType}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{row.memberName}</TableCell>
                          <TableCell>{formatCurrency(row.amount)}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{row.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {reportData.length > 0 && (
                    <Pagination
                      currentPage={rptPage}
                      totalPages={Math.ceil(reportData.length / rptPageSize)}
                      onPageChange={setRptPage}
                      itemsPerPage={rptPageSize}
                      onItemsPerPageChange={(size) => { setRptPageSize(size); setRptPage(1); }}
                      totalItems={reportData.length}
                    />
                  )}
                  </>
                )}
                {selectedReport === 'audit' && (
                  <>
                  <Table className="table-modern">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead className="hidden md:table-cell">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData
                        .slice((rptPage - 1) * rptPageSize, rptPage * rptPageSize)
                        .map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'}</TableCell>
                          <TableCell>{row.user}</TableCell>
                          <TableCell><Badge variant="outline">{row.action}</Badge></TableCell>
                          <TableCell>{row.resource}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs max-w-xs truncate">{row.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {reportData.length > 0 && (
                    <Pagination
                      currentPage={rptPage}
                      totalPages={Math.ceil(reportData.length / rptPageSize)}
                      onPageChange={setRptPage}
                      itemsPerPage={rptPageSize}
                      onItemsPerPageChange={(size) => { setRptPageSize(size); setRptPage(1); }}
                      totalItems={reportData.length}
                    />
                  )}
                  </>
                )}
              </div>
            </div>
          ) : selectedReport ? (
            <div className="section-card">
              <div className="p-6 text-center py-8 text-slate-500 dark:text-slate-400">
                No data available for this report
              </div>
            </div>
          ) : (
            <div className="section-card">
              <div className="p-6">
                <div className="py-16 text-center">
                  <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select a Report</h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Choose a report type from the dropdown above or from the Overview tab
                  </p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Report Generation Modal */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>
              Choose the format for your report export
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <Button
              variant="outline"
              onClick={() => handleExportReport('pdf')}
              className="flex flex-col items-center py-4 rounded-xl"
            >
              <FileText className="w-8 h-8 mb-2" />
              <span>PDF</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportReport('excel')}
              className="flex flex-col items-center py-4 rounded-xl"
            >
              <FileSpreadsheet className="w-8 h-8 mb-2" />
              <span>Excel</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportReport('csv')}
              className="flex flex-col items-center py-4 rounded-xl"
            >
              <FileText className="w-8 h-8 mb-2" />
              <span>CSV</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
