import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import NotFound from "@/pages/not-found";
import RoleBasedNavigation from "@/components/role-based-nav";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members";
import Savings from "@/pages/savings";
import Loans from "@/pages/loans";
import Transactions from "@/pages/transactions";
import Reports from "@/pages/reports";
import Guarantors from "@/pages/guarantors";
import RoleManagement from "@/pages/role-management";
import AuditLogs from "@/pages/audit-logs";
import RolesMatrixPage from "@/pages/roles-matrix";
import InterestRates from "@/pages/interest-rates";
import AmortizationDemo from "@/pages/amortization-demo";
import MemberDetails from "@/pages/member-details";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import MobileNav from "@/components/layout/mobile-nav";

function ProtectedRoute({ children, requiredPermission }: { children: React.ReactNode, requiredPermission?: { action: string, resource: string } }) {
  const { hasPermission } = useRBAC();
  
  if (requiredPermission && !hasPermission(requiredPermission.action, requiredPermission.resource)) {
    return <NotFound />;
  }
  
  return <>{children}</>;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { canAccessRoute } = useRBAC();

  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="flex">
        <div className="w-64 border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-4">
            <RoleBasedNavigation />
          </div>
        </div>
        <main className="flex-1 p-6 lg:p-8">
          <Switch>
            <Route path="/">
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </Route>
            <Route path="/members">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'members' }}>
                <Members />
              </ProtectedRoute>
            </Route>
            <Route path="/savings">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'savings' }}>
                <Savings />
              </ProtectedRoute>
            </Route>
            <Route path="/loans">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'loans' }}>
                <Loans />
              </ProtectedRoute>
            </Route>
            <Route path="/transactions">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'transactions' }}>
                <Transactions />
              </ProtectedRoute>
            </Route>
            <Route path="/guarantors">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'guarantors' }}>
                <Guarantors />
              </ProtectedRoute>
            </Route>
            <Route path="/reports">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'reports' }}>
                <Reports />
              </ProtectedRoute>
            </Route>
            <Route path="/role-management">
              <ProtectedRoute requiredPermission={{ action: 'update', resource: 'system-settings' }}>
                <RoleManagement />
              </ProtectedRoute>
            </Route>
            <Route path="/audit-logs">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'audit-logs' }}>
                <AuditLogs />
              </ProtectedRoute>
            </Route>
            <Route path="/roles-matrix">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'system-settings' }}>
                <RolesMatrixPage />
              </ProtectedRoute>
            </Route>
            <Route path="/interest-rates">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'interest-rates' }}>
                <InterestRates />
              </ProtectedRoute>
            </Route>
            <Route path="/amortization-demo">
              <ProtectedRoute>
                <AmortizationDemo />
              </ProtectedRoute>
            </Route>
            <Route path="/members/:id">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'members' }}>
                <MemberDetails />
              </ProtectedRoute>
            </Route>
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
