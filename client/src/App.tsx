import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useWebSocket } from "@/hooks/useWebSocket";
import NotFound from "@/pages/not-found";
import Forbidden from "@/pages/forbidden";

import Landing from "@/pages/landing";
import { LoginPage } from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members";
import Savings from "@/pages/savings";
import Loans from "@/pages/loans";

import Transactions from "@/pages/transactions";
import Reports from "@/pages/reports";
import Guarantors from "@/pages/guarantors";
import DataImport from "@/pages/data-import";


import AuditLogs from "@/pages/audit-logs";
import RolesMatrixPage from "@/pages/roles-matrix";
import InterestRates from "@/pages/interest-rates";
import AmortizationDemo from "@/pages/amortization-demo";
import LoanWorkflow from "@/pages/loan-workflow";
import MemberDetails from "@/pages/member-details";
import NotificationsPage from "@/pages/notifications";
import Settings from "@/pages/settings";
import AdminSettings from "@/pages/admin-settings";
import Profile from "@/pages/profile";
import AccountStatement from "@/pages/account-statement";
import LoanStatement from "@/pages/loan-statement";
import InterestCalculations from "@/pages/interest-calculations";
import Header from "@/components/layout/header";
import CollapsibleSidebar from "@/components/layout/collapsible-sidebar";

function ProtectedRoute({ children, requiredPermission }: { children: React.ReactNode, requiredPermission?: { action: string, resource: string } }) {
  const { hasPermission } = useRBAC();
  
  if (requiredPermission && !hasPermission(requiredPermission.action, requiredPermission.resource)) {
    return <Forbidden />;
  }
  
  return <>{children}</>;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { canAccessRoute } = useRBAC();
  
  // Initialize WebSocket connection for real-time notifications
  useWebSocket();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={LoginPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="flex">
        <CollapsibleSidebar />
        <main className="flex-1 p-4 lg:p-6 xl:p-8 transition-all duration-300 ease-in-out">{/* Mobile padding offset for menu button */}
          <div className="lg:hidden h-16"></div>
          <Switch>
            <Route path="/">
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </Route>
            <Route path="/dashboard">
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
            <Route path="/savings/:id/statement">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'savings' }}>
                <AccountStatement />
              </ProtectedRoute>
            </Route>
            <Route path="/loans/:id/statement">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'loans' }}>
                <LoanStatement />
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
            <Route path="/interest-calculations">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'interest-calculations' }}>
                <InterestCalculations />
              </ProtectedRoute>
            </Route>
            <Route path="/amortization-demo">
              <ProtectedRoute requiredPermission={{ action: 'create', resource: 'amortization' }}>
                <AmortizationDemo />
              </ProtectedRoute>
            </Route>
            <Route path="/loan-workflow">
              <ProtectedRoute requiredPermission={{ action: 'approve', resource: 'loans' }}>
                <LoanWorkflow />
              </ProtectedRoute>
            </Route>
            <Route path="/notifications">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'notifications' }}>
                <NotificationsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/profile">
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            </Route>
            <Route path="/settings">
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            </Route>
            <Route path="/admin-settings">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'system-settings' }}>
                <AdminSettings />
              </ProtectedRoute>
            </Route>
            <Route path="/members/:id">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'members' }}>
                <MemberDetails />
              </ProtectedRoute>
            </Route>
            <Route path="/data-import">
              <ProtectedRoute requiredPermission={{ action: 'update', resource: 'system-settings' }}>
                <DataImport />
              </ProtectedRoute>
            </Route>

            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
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
