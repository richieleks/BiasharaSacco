import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileText, TrendingUp, Users, PiggyBank, HandCoins } from "lucide-react";

export default function Reports() {
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

  const reportTypes = [
    {
      title: "Member Report",
      description: "Comprehensive list of all SACCO members with their status and account details",
      icon: Users,
      color: "bg-blue-100 text-blue-800",
    },
    {
      title: "Savings Summary",
      description: "Overview of all savings accounts, balances, and interest calculations",
      icon: PiggyBank,
      color: "bg-green-100 text-green-800",
    },
    {
      title: "Loan Portfolio",
      description: "Active loans, repayment schedules, and delinquency analysis",
      icon: HandCoins,
      color: "bg-purple-100 text-purple-800",
    },
    {
      title: "Transaction Report",
      description: "Detailed transaction history with filters by date, type, and member",
      icon: FileText,
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      title: "Financial Performance",
      description: "Revenue, expenses, profit/loss, and key financial ratios",
      icon: TrendingUp,
      color: "bg-red-100 text-red-800",
    },
    {
      title: "Audit Trail",
      description: "Complete log of all system activities and user actions",
      icon: BarChart3,
      color: "bg-indigo-100 text-indigo-800",
    },
  ];

  const handleGenerateReport = (reportType: string) => {
    toast({
      title: "Report Generation",
      description: `${reportType} generation started. You'll be notified when ready.`,
    });
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Reports & Analytics</h2>
            <p className="text-slate-600 mt-1">Generate comprehensive reports and analyze SACCO performance</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {metricsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-6 bg-slate-200 rounded w-1/2"></div>
                  </div>
                  <div className="w-12 h-12 bg-slate-200 rounded-lg"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Total Members</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">{metrics.totalMembers}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="text-blue-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Total Savings</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">
                    UGX {parseFloat(metrics.totalSavings).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <PiggyBank className="text-green-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Active Loans</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">
                    UGX {parseFloat(metrics.activeLoans).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <HandCoins className="text-purple-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Repayment Rate</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">{metrics.repaymentRate}%</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-yellow-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${report.color}`}>
                  <report.icon className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg">{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">{report.description}</p>
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleGenerateReport(report.title)}
                  className="flex-1 sacco-gradient text-white hover:opacity-90"
                  size="sm"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Generate
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start">
              <Download className="w-4 h-4 mr-2" />
              Export All Members (CSV)
            </Button>
            <Button variant="outline" className="justify-start">
              <Download className="w-4 h-4 mr-2" />
              Export Transactions (Excel)
            </Button>
            <Button variant="outline" className="justify-start">
              <Download className="w-4 h-4 mr-2" />
              Export Financial Summary (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
