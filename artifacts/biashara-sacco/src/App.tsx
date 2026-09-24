import { useState, useEffect, useCallback, useRef } from "react";
import { Switch, Route, useLocation, Redirect, Router as WouterRouter } from "wouter";
import { apiRequest, queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import Forbidden from "@/pages/forbidden";

import Landing from "@/pages/landing";
import { LoginPage } from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members";
import Savings from "@/pages/savings";
import Loans from "@/pages/loans";
import MobileNav from "@/components/layout/mobile-nav";

import Transactions from "@/pages/transactions";
import ShareCapital from "@/pages/share-capital";
import Reports from "@/pages/reports";
import Guarantors from "@/pages/guarantors";
import GuarantorRequestsPage from "@/pages/guarantor-requests";
import DataImport from "@/pages/data-import";
import ExitRequests from "@/pages/exit-requests";


import AuditLogs from "@/pages/audit-logs";
import RolesMatrixPage from "@/pages/roles-matrix";
import InterestRates from "@/pages/interest-rates";
import AmortizationDemo from "@/pages/amortization-demo";
import LoanWorkflow from "@/pages/loan-workflow";
import MemberDetails from "@/pages/member-details";
import NotificationsPage from "@/pages/notifications";
import AdminSettings from "@/pages/admin-settings";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";
import AccountStatement from "@/pages/account-statement";
import LoanStatement from "@/pages/loan-statement";
import LoanDetails from "@/pages/loan-details";
import InterestCalculations from "@/pages/interest-calculations";
import SaccoAccounts from "@/pages/sacco-accounts";
import FinancialStatements from "@/pages/financial-statements";
import Dividends from "@/pages/dividends";
import Header from "@/components/layout/header";
import CollapsibleSidebar from "@/components/layout/collapsible-sidebar";
import { QRCodeSVG } from "qrcode.react";

function ProtectedRoute({
  children,
  requiredPermission,
  requiredAnyPermission,
}: {
  children: React.ReactNode;
  requiredPermission?: { action: string; resource: string };
  requiredAnyPermission?: { action: string; resource: string }[];
}) {
  const { hasPermission, isLoading } = useRBAC();

  if (isLoading) {
    return null;
  }

  if (requiredPermission && !hasPermission(requiredPermission.action, requiredPermission.resource)) {
    return <Forbidden />;
  }

  if (
    requiredAnyPermission &&
    requiredAnyPermission.length > 0 &&
    !requiredAnyPermission.some(p => hasPermission(p.action, p.resource))
  ) {
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

function MaintenanceScreen({ announcement }: { announcement?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-amber-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 mx-auto">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-maintenance-title">
            System Under Maintenance
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            The Biashara SACCO system is currently undergoing scheduled maintenance. We apologize for the inconvenience.
          </p>
        </div>

        {announcement && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">System Announcement</p>
            <p className="text-sm text-amber-700 dark:text-amber-400" data-testid="text-maintenance-announcement">{announcement}</p>
          </div>
        )}

        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Please try again later. If this issue persists, contact your system administrator.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          data-testid="button-refresh-maintenance"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

function TwoFactorEnrollmentScreen() {
  const [setupData, setSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [enrollmentCompleted, setEnrollmentCompleted] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const startSetup = useCallback(async () => {
    setIsSettingUp(true);
    setError("");
    try {
      const res = await apiRequest('POST', '/api/auth/2fa/setup');
      const data = await res.json();
      setSetupData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate 2FA setup. Please try again.');
    } finally {
      setIsSettingUp(false);
    }
  }, []);

  useEffect(() => { startSetup(); }, [startSetup]);

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(verifyCode)) return;
    setIsVerifying(true);
    setError("");
    try {
      await apiRequest('POST', '/api/auth/2fa/verify', { code: verifyCode });
      setEnrollmentCompleted(true);
      setSetupData(null);
      setVerifyCode("");
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      if ((queryClient.getQueryData<{ mustSetup2FA?: boolean }>(['/api/auth/user']))?.mustSetup2FA) {
        setError('Two-factor authentication is enabled. Refresh to update your account status.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Two-Factor Authentication Required
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Your organization requires two-factor authentication. Set up an authenticator app to continue using the system.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          {enrollmentCompleted ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">Two-factor authentication is enabled. Updating your account...</p>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button onClick={() => window.location.reload()} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold">Refresh account status</button>
            </div>
          ) : isSettingUp ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Generating your setup code...</p>
            </div>
          ) : setupData ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator)
              </p>
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-100">
                  <QRCodeSVG value={setupData.uri} size={180} level="M" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Or enter this key manually:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg font-mono text-slate-700 dark:text-slate-300 select-all">{setupData.secret}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(setupData.secret);
                      setSecretCopied(true);
                      setTimeout(() => setSecretCopied(false), 2000);
                    }}
                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title="Copy secret key"
                  >
                    {secretCopied ? (
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Enter the 6-digit code from your app</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '')); setError(""); }}
                  className="w-full h-12 text-center text-2xl tracking-[0.5em] bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  autoFocus
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  {error}
                </div>
              )}
              <button
                onClick={handleVerify}
                disabled={isVerifying || verifyCode.length !== 6}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Verify & Enable 2FA
                  </>
                )}
              </button>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
              <button
                onClick={startSetup}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : null}
        </div>

        <div className="text-center">
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline transition-colors"
          >
            Sign out and return to login
          </button>
        </div>
      </div>
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

function useAutoLogout(isAuthenticated: boolean) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeartbeatRef = useRef<number>(0);
  const activeRef = useRef<boolean>(false);
  const { toast } = useToast();

  const { data: userSettings } = useQuery<{ autoLogout?: number }>({
    queryKey: ['/api/auth/settings'],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const autoLogoutMinutes = userSettings?.autoLogout || 120;

  useEffect(() => {
    if (!isAuthenticated) return;

    const HEARTBEAT_INTERVAL_MS = 60 * 1000;
    const timeoutMs = autoLogoutMinutes * 60 * 1000;
    const warningMs = Math.max(timeoutMs - 60 * 1000, Math.floor(timeoutMs * 0.9));

    const sendHeartbeat = () => {
      const now = Date.now();
      if (now - lastHeartbeatRef.current < HEARTBEAT_INTERVAL_MS) return;
      lastHeartbeatRef.current = now;
      fetch("/api/auth/heartbeat", { method: "POST", credentials: "include" }).catch(() => {});
    };

    const resetTimer = () => {
      activeRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      sendHeartbeat();
      warningRef.current = setTimeout(() => {
        toast({
          title: "Session expiring soon",
          description: "You will be signed out in 1 minute due to inactivity. Move your mouse or press a key to stay signed in.",
          variant: "destructive",
        });
      }, warningMs);
      timeoutRef.current = setTimeout(() => {
        queryClient.setQueryData(["/api/auth/user"], null);
        fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
        window.location.href = "/login?expired=1";
      }, timeoutMs);
    };

    const periodicHeartbeat = setInterval(() => {
      if (activeRef.current) {
        sendHeartbeat();
        activeRef.current = false;
      }
    }, HEARTBEAT_INTERVAL_MS);

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(event => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      clearInterval(periodicHeartbeat);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated, autoLogoutMinutes, toast]);
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { canAccessRoute } = useRBAC();
  
  useWebSocket();
  useTheme();
  useAutoLogout(isAuthenticated);

  const isAdmin = user?.role === 'admin' || (user as any)?.member?.roles?.includes('admin');

  const { data: maintenanceStatus } = useQuery<{ maintenanceMode: boolean; systemAnnouncement: string }>({
    queryKey: ['/api/system/maintenance-status'],
    enabled: isAuthenticated,
    refetchInterval: isAdmin ? 60_000 : 30_000,
  });

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

  if ((user as any)?.mustSetup2FA) {
    return <TwoFactorEnrollmentScreen />;
  }

  if (!isAdmin && maintenanceStatus?.maintenanceMode) {
    return <MaintenanceScreen announcement={maintenanceStatus.systemAnnouncement} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <PageLoadingBar />
      {isAdmin && maintenanceStatus?.maintenanceMode && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium" data-testid="banner-maintenance-active">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Maintenance mode is active — non-admin users cannot access the system
          </span>
        </div>
      )}
      <Header />
      <div className="flex">
        <CollapsibleSidebar />
        <main className="flex-1 min-w-0 p-4 lg:p-6 xl:p-8 pb-20 lg:pb-8 transition-all duration-300 ease-in-out min-h-[calc(100vh-4rem)] overflow-x-hidden">
          <div className="lg:hidden h-14"></div>
          <PageTransition>
          <Switch>
            <Route path="/">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'dashboard' }}>
                <Dashboard />
              </ProtectedRoute>
            </Route>
            <Route path="/dashboard">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'dashboard' }}>
                <Dashboard />
              </ProtectedRoute>
            </Route>
            <Route path="/members">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'members' }}>
                <Members />
              </ProtectedRoute>
            </Route>
            <Route path="/savings">
              <ProtectedRoute>
                <Savings />
              </ProtectedRoute>
            </Route>
            <Route path="/savings/statement">
              <ProtectedRoute>
                <AccountStatement />
              </ProtectedRoute>
            </Route>
            <Route path="/savings/:id/statement">
              <ProtectedRoute>
                <AccountStatement />
              </ProtectedRoute>
            </Route>
            <Route path="/loans/:id/details">
              <ProtectedRoute>
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
            <Route path="/guarantor-requests">
              <ProtectedRoute>
                <GuarantorRequestsPage />
              </ProtectedRoute>
            </Route>

            <Route path="/sacco-accounts">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'sacco-accounts' }}>
                <SaccoAccounts />
              </ProtectedRoute>
            </Route>

            <Route path="/financial-statements">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'reports' }}>
                <FinancialStatements />
              </ProtectedRoute>
            </Route>

            <Route path="/dividends">
              <ProtectedRoute requiredPermission={{ action: 'read', resource: 'reports' }}>
                <Dividends />
              </ProtectedRoute>
            </Route>

            <Route path="/reports">
              <ProtectedRoute
                requiredAnyPermission={[
                  { action: 'read', resource: 'reports' },
                  { action: 'download', resource: 'schedules' },
                ]}
              >
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
            <Route path="/exit-requests">
              <ProtectedRoute requiredPermission={{ action: 'approve', resource: 'members' }}>
                <ExitRequests />
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
              <ProtectedRoute
                requiredAnyPermission={[
                  { action: 'execute', resource: 'import-members' },
                  { action: 'execute', resource: 'import-savings' },
                  { action: 'execute', resource: 'import-loans' },
                  { action: 'execute', resource: 'import-loan-repayments' },
                  { action: 'execute', resource: 'import-bulk-savings' },
                ]}
              >
                <DataImport />
              </ProtectedRoute>
            </Route>

            <Route component={NotFound} />
          </Switch>
          </PageTransition>
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Toaster />
          <Router />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
