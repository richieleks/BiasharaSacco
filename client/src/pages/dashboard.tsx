import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import RoleBasedDashboard from "@/components/dashboard/role-based-dashboard";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { userRole, hasPermission } = useRBAC();

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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to Biashara SACCO Management System
          </p>
          <p className="text-sm text-muted-foreground capitalize mt-1">
            {userRole} Portal
          </p>
        </div>
        {hasPermission('read', 'reports') && (
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
            {hasPermission('create', 'transactions') && (
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Quick Action
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Role-Based Dashboard Content */}
      <RoleBasedDashboard />
    </div>
  );
}
