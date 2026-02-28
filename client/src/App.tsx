import { useState, useEffect, useCallback } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
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
import ShareCapital from "@/pages/share-capital";
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
import AdminSettings from "@/pages/admin-settings";
import Profile from "@/pages/profile";
import AccountStatement from "@/pages/account-statement";
import LoanStatement from "@/pages/loan-statement";
import LoanDetails from "@/pages/loan-details";
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

function PageLoadingBar() {
  const [location] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setIsDone(false);

    const doneTimer = setTimeout(() => {
      setIsDone(true);
    }, 400);

    const hideTimer = setTimeout(() => {
      setIsLoading(false);
    }, 700);

    return () => {
      clearTimeout(doneTimer);
      clearTimeout(hideTimer);
    };
  }, [location]);

  if (!isLoading) return null;

  return (
    <div className={`top-loading-bar ${isDone ? 'top-loading-bar-done' : ''}`} />
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [displayKey, setDisplayKey] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (location !== displayKey) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayKey(location);
        setIsTransitioning(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location, displayKey]);

  return (
    <div
      key={displayKey}
      className="page-transition"
      style={{ opacity: isTransitioning ? 0.6 : 1, transition: 'opacity 0.15s ease' }}
    >
      {children}
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6">
          <svg className="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <div className="loading-dots flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
      </div>
      <p className="mt-4 text-sm text-slate-400 font-medium">Loading your workspace...</p>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { canAccessRoute } = useRBAC();
  
  useWebSocket();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={LoginPage} />
        <Route>{() => <Redirect to="/login" />}</Route>
      </Switch>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <PageLoadingBar />
      <Header />
      <div className="flex">
        <CollapsibleSidebar />
        <main className="flex-1 p-4 lg:p-6 xl:p-8 transition-all duration-300 ease-in-out min-h-[calc(100vh-4rem)]">
          <div className="lg:hidden h-14"></div>
          <PageTransition>
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
            <Route path="/loans/:id/details">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'personal-loans' }}>
                <LoanDetails />
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
            <Route path="/my-loans">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'personal-loans' }}>
                <Loans />
              </ProtectedRoute>
            </Route>
            <Route path="/transactions">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'transactions' }}>
                <Transactions />
              </ProtectedRoute>
            </Route>
            <Route path="/my-transactions">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'personal-transactions' }}>
                <Transactions />
              </ProtectedRoute>
            </Route>
            <Route path="/share-capital">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'share-capital' }}>
                <ShareCapital />
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
          </PageTransition>
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
