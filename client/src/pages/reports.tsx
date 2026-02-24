import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
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
import { BarChart3, Download, FileText, TrendingUp, Users, PiggyBank, HandCoins, Calendar, Filter, Printer, Mail, FileSpreadsheet, Plus } from "lucide-react";

interface ReportFilter {
  startDate?: Date;
  endDate?: Date;
  memberNumber?: string;
  reportType?: string;
  status?: string;
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [filters, setFilters] = useState<ReportFilter>({});
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

  // Fetch report data based on active tab
  const { data: reportData, isLoading: reportLoading, refetch } = useQuery({
    queryKey: ['/api/reports', activeTab, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.memberNumber) params.append('memberNumber', filters.memberNumber);
      if (filters.status) params.append('status', filters.status);
      
      return await apiRequest('GET', `/api/reports/${activeTab}?${params.toString()}`);
    },
    enabled: isAuthenticated && activeTab !== 'overview',
  });

  const reportTypes = [
    {
      id: "members",
      title: "Member Report",
      description: "Comprehensive list of all SACCO members with their status and account details",
      icon: Users,
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      fields: ["Member Number", "Full Name", "Status", "Department", "Join Date", "Total Savings"],
    },
    {
      id: "savings",
      title: "Savings Summary",
      description: "Overview of all savings accounts, balances, and interest calculations",
      icon: PiggyBank,
      color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      fields: ["Account Number", "Member Name", "Account Type", "Balance", "Interest Earned", "Last Transaction"],
    },
    {
      id: "loans",
      title: "Loan Portfolio",
      description: "Active loans, repayment schedules, and delinquency analysis",
      icon: HandCoins,
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
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
      color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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

  const generateReportMutation = useMutation({
    mutationFn: async (reportType: string) => {
      return await apiRequest('POST', '/api/reports/generate', {
        reportType,
        filters,
        format: 'pdf'
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Report Generated",
        description: "Your report has been generated successfully. Downloading now...",
      });
      // Trigger download
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateReport = (reportType: string) => {
    setSelectedReport(reportType);
    setIsReportModalOpen(true);
  };

  const handleExportReport = (format: 'pdf' | 'excel' | 'csv') => {
    if (!selectedReport) return;
    
    generateReportMutation.mutate(selectedReport);
    setIsReportModalOpen(false);
  };

  return (
    <div className="space-y-6 page-container animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Generate comprehensive reports and analyze SACCO performance</p>
      </div>

      {/* Tabs for different report sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="custom">Custom Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          {metricsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="section-card">
                  <div className="p-6">
                    <Skeleton className="h-4 w-24 mb-2 bg-slate-100 rounded-lg" />
                    <Skeleton className="h-8 w-32 bg-slate-100 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="section-card border-l-4 border-l-blue-500">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Members</p>
                      <p className="text-2xl font-bold mt-1">{metrics.totalMembers}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </div>
              </div>

              <div className="section-card border-l-4 border-l-green-500">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Savings</p>
                      <p className="text-2xl font-bold mt-1">
                        UGX {parseFloat(metrics.totalSavings).toLocaleString()}
                      </p>
                    </div>
                    <PiggyBank className="h-8 w-8 text-green-500" />
                  </div>
                </div>
              </div>

              <div className="section-card border-l-4 border-l-purple-500">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Active Loans</p>
                      <p className="text-2xl font-bold mt-1">
                        UGX {parseFloat(metrics.activeLoans).toLocaleString()}
                      </p>
                    </div>
                    <HandCoins className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
              </div>

              <div className="section-card border-l-4 border-l-yellow-500">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Repayment Rate</p>
                      <p className="text-2xl font-bold mt-1">{metrics.repaymentRate}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-yellow-500" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Report Types Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportTypes.map((report) => (
              <div key={report.id} className="section-card hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${report.color}`}>
                      <report.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{report.title}</h3>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-500 mb-4">{report.description}</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setActiveTab(report.id === 'financial' ? 'financial' : 'custom');
                        setSelectedReport(report.id);
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
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Member Reports</h3>
              <p className="text-sm text-slate-500 mt-0.5">Generate reports for member data and activities</p>
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

          {/* Report Results */}
          {reportLoading ? (
            <div className="section-card">
              <div className="p-6">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full bg-slate-100 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          ) : reportData ? (
            <div className="section-card">
              <div className="px-6 py-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Report Results</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm">
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button size="sm" className="rounded-xl">
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
                    {/* Report data would be mapped here */}
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        No data available for the selected criteria
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* Financial Reports Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="section-card">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Financial Reports</h3>
              <p className="text-sm text-slate-500 mt-0.5">Comprehensive financial analysis and reporting</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center rounded-xl">
                  <BarChart3 className="w-8 h-8 mb-2" />
                  <span>Income Statement</span>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center rounded-xl">
                  <PiggyBank className="w-8 h-8 mb-2" />
                  <span>Balance Sheet</span>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center rounded-xl">
                  <TrendingUp className="w-8 h-8 mb-2" />
                  <span>Cash Flow</span>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Custom Reports Tab */}
        <TabsContent value="custom" className="space-y-6">
          <div className="section-card">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Custom Report Builder</h3>
              <p className="text-sm text-slate-500 mt-0.5">Create custom reports based on your specific needs</p>
            </div>
            <div className="p-6">
              <div className="py-16 text-center">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Custom Report Builder</h3>
                <p className="text-slate-600 mb-4">
                  Select data fields and filters to create your custom report
                </p>
                <Button className="rounded-xl">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Report
                </Button>
              </div>
            </div>
          </div>
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
