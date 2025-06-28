import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MetricsGrid from "@/components/dashboard/metrics-grid";
import RecentTransactions from "@/components/dashboard/recent-transactions";
import QuickActions from "@/components/dashboard/quick-actions";
import PendingApprovals from "@/components/dashboard/pending-approvals";
import MemberApprovals from "@/components/dashboard/member-approvals";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";

export default function Dashboard() {
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

  return (
    <>
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
            <p className="text-slate-600 mt-1">Welcome back, here's what's happening at your SACCO today.</p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button className="sacco-gradient text-white hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Metrics */}
      <MetricsGrid />

      {/* Member Approvals Section */}
      <div className="mb-8">
        <MemberApprovals />
      </div>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transactions - Takes 2/3 of the space */}
        <div className="lg:col-span-2">
          <RecentTransactions />
        </div>

        {/* Sidebar with Quick Actions and Pending Approvals */}
        <div className="space-y-6">
          <QuickActions />
          <PendingApprovals />
        </div>
      </div>
    </>
  );
}
