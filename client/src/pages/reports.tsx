import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-slate-600 mt-1">Generate comprehensive reports and analyze SACCO performance</p>
      </div>

      {/* Tabs for different report sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
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
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Members</p>
                      <p className="text-2xl font-bold mt-1">{metrics.totalMembers}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Savings</p>
                      <p className="text-2xl font-bold mt-1">
                        UGX {parseFloat(metrics.totalSavings).toLocaleString()}
                      </p>
                    </div>
                    <PiggyBank className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Active Loans</p>
                      <p className="text-2xl font-bold mt-1">
                        UGX {parseFloat(metrics.activeLoans).toLocaleString()}
                      </p>
                    </div>
                    <HandCoins className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-yellow-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Repayment Rate</p>
                      <p className="text-2xl font-bold mt-1">{metrics.repaymentRate}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Report Types Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportTypes.map((report) => (
              <Card key={report.id} className="hover:shadow-lg transition-all hover:-translate-y-1">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${report.color}`}>
                      <report.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">{report.description}</CardDescription>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setActiveTab(report.id === 'financial' ? 'financial' : 'custom');
                        setSelectedReport(report.id);
                      }}
                      className="flex-1"
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
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Members Reports Tab */}
        <TabsContent value="members" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Member Reports</CardTitle>
              <CardDescription>Generate reports for member data and activities</CardDescription>
            </CardHeader>
            <CardContent>
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
                  <Button onClick={() => refetch()}>
                    <Filter className="w-4 h-4 mr-2" />
                    Apply Filters
                  </Button>
                  <Button variant="outline" onClick={() => setFilters({})}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Results */}
          {reportLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : reportData ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Report Results</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button size="sm">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Number</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Join Date</TableHead>
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
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* Financial Reports Tab */}
        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Reports</CardTitle>
              <CardDescription>Comprehensive financial analysis and reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center">
                  <BarChart3 className="w-8 h-8 mb-2" />
                  <span>Income Statement</span>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center">
                  <PiggyBank className="w-8 h-8 mb-2" />
                  <span>Balance Sheet</span>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center">
                  <TrendingUp className="w-8 h-8 mb-2" />
                  <span>Cash Flow</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Reports Tab */}
        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Report Builder</CardTitle>
              <CardDescription>Create custom reports based on your specific needs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Custom Report Builder</h3>
                <p className="text-slate-600 mb-4">
                  Select data fields and filters to create your custom report
                </p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report Generation Modal */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent>
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
              className="flex flex-col items-center py-4"
            >
              <FileText className="w-8 h-8 mb-2" />
              <span>PDF</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportReport('excel')}
              className="flex flex-col items-center py-4"
            >
              <FileSpreadsheet className="w-8 h-8 mb-2" />
              <span>Excel</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportReport('csv')}
              className="flex flex-col items-center py-4"
            >
              <FileText className="w-8 h-8 mb-2" />
              <span>CSV</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
