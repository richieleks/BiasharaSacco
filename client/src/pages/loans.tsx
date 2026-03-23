import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { useServerPagination } from "@/hooks/useServerPagination";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LoanApplicationForm from "@/components/forms/loan-application-form";
import LoanTopUpForm from "@/components/forms/loan-topup-form";
import { formatCurrency } from "@/lib/utils";
import { Search, Plus, CheckCircle, XCircle, Clock, HandCoins, DollarSign, ArrowUpCircle, Banknote, Loader2 } from "lucide-react";

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 dark:border-amber-800/50';
    case 'approved': return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50';
    case 'disbursed': return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50';
    case 'active': return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50';
    case 'completed': return 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/50';
    case 'defaulted': return 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-800/50';
    default: return 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/50';
  }
};

const getLoanTypeColor = (type: string) => {
  const colors = [
    'bg-blue-50 dark:bg-blue-950/50 text-blue-700 border-blue-200 dark:border-blue-800/50',
    'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50',
    'bg-purple-50 dark:bg-purple-950/50 text-purple-700 border-purple-200/50',
    'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200/50 dark:border-orange-800/50',
    'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-800/50',
  ];
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = type.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function Loans() {
  const [location, setLocation] = useLocation();
  const { activeRole, userRoles, hasPermission } = useRBAC();
  const isPersonalView = location === '/my-loans' || activeRole === 'member';
  const isTreasurer = userRoles?.includes('treasurer');
  const canDisburse = hasPermission('disburse', 'loans');
  const canRecordRepayment = hasPermission('record', 'loan-repayments');
  const canApplyForLoans = hasPermission('create', 'loan-applications');
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [repaymentLoan, setRepaymentLoan] = useState<any>(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [repaymentDescription, setRepaymentDescription] = useState("");
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const {
    page,
    limit,
    search,
    setPage,
    setLimit,
    setSearch,
    buildQueryParams,
  } = useServerPagination({ initialLimit: 10 });

  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

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

  const queryParams = buildQueryParams();
  const baseUrl = isPersonalView ? '/api/loans/my-loans' : '/api/loans';
  const fullQueryParams = statusFilter && statusFilter !== 'all' 
    ? `${queryParams}&status=${statusFilter}` 
    : queryParams;

  const { data: response, isLoading: pendingLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: [baseUrl, fullQueryParams],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}?${fullQueryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch loans');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: loanStats } = useQuery<{ activeCount: number; totalOutstanding: number; defaultedCount: number; totalCount: number }>({
    queryKey: ['/api/loans/stats'],
    queryFn: async () => {
      const res = await fetch('/api/loans/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch loan stats');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const pendingLoans = response?.data || [];
  const totalItems = response?.total || 0;

  const approveLoanMutation = useMutation({
    mutationFn: async (loan: any) => {
      await apiRequest('PATCH', `/api/loans/${loan.uuid}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/stats'] });
      toast({ title: "Success", description: "Loan approved successfully!", variant: "success" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to approve loan. Please try again.", variant: "destructive" });
    },
  });

  const disburseLoanMutation = useMutation({
    mutationFn: async (loan: any) => {
      const res = await apiRequest('PATCH', `/api/loans/${loan.uuid}/disburse`);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/savings'] });
      const feeMsg = data?.feesCollected?.length > 0 
        ? ` Fees collected: ${data.feesCollected.join('; ')}.` 
        : '';
      toast({ title: "Success", description: `Loan disbursed successfully!${feeMsg}`, variant: "success" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to disburse loan. Please try again.", variant: "destructive" });
    },
  });

  const repaymentMutation = useMutation({
    mutationFn: async ({ loanUuid, amount, description }: { loanUuid: string; amount: string; description: string }) => {
      await apiRequest('POST', `/api/loans/${loanUuid}/payment`, {
        amount,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/my-loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/stats'] });
      toast({ title: "Success", description: "Loan repayment recorded successfully!", variant: "success" });
      setIsRepaymentModalOpen(false);
      setRepaymentLoan(null);
      setRepaymentAmount("");
      setRepaymentDescription("");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to record repayment. Please try again.", variant: "destructive" });
    },
  });

  const openRepaymentModal = (loan: any) => {
    setRepaymentLoan(loan);
    setRepaymentAmount(loan.monthlyPayment || '');
    setRepaymentDescription('');
    setIsRepaymentModalOpen(true);
  };

  const handleRepaymentSubmit = () => {
    if (!repaymentLoan || !repaymentAmount) return;
    const amount = parseFloat(repaymentAmount);
    const outstanding = parseFloat(repaymentLoan.outstandingBalance || '0');
    if (amount <= 0) {
      toast({ title: "Error", description: "Payment amount must be greater than zero.", variant: "destructive" });
      return;
    }
    if (amount > outstanding) {
      toast({ title: "Error", description: `Payment amount cannot exceed the outstanding balance of ${formatCurrency(outstanding)}.`, variant: "destructive" });
      return;
    }
    repaymentMutation.mutate({
      loanUuid: repaymentLoan.uuid,
      amount: amount.toFixed(2),
      description: repaymentDescription || `Loan repayment - ${repaymentLoan.loanNumber}`,
    });
  };

  if (pendingLoading) {
    return (
      <div className="space-y-6 page-container animate-fade-in">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="section-card p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg"></div>
                <div>
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-32 mb-2"></div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-lg w-24"></div>
                </div>
              </div>
              <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg w-24"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 page-container animate-fade-in">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isPersonalView ? 'My Loans' : 'Loan Management'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {isPersonalView 
                ? 'View your loan applications, statements and repayment schedules' 
                : 'Process loan applications and manage disbursements'
              }
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0 w-full sm:w-auto">
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="section-card p-4 relative flex items-center flex-1 sm:flex-none">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4" />
                <Input
                  data-testid="input-search-loans"
                  placeholder="Search loans..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 w-full sm:w-64 border-0 bg-transparent focus-visible:ring-0"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger className="w-[140px] rounded-xl border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {canApplyForLoans && (
                <Button 
                  data-testid="button-new-loan"
                  className="sacco-gradient text-white hover:opacity-90 rounded-xl shadow-sm flex-1 sm:flex-none"
                  onClick={() => setIsApplicationModalOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{isPersonalView ? 'Apply for Loan' : 'New Loan Application'}</span>
                  <span className="sm:hidden">{isPersonalView ? 'Apply' : 'New Loan'}</span>
                </Button>
              )}
              {isPersonalView && (
                <Button
                  variant="outline"
                  className="border-blue-200 dark:border-blue-800 text-blue-700 hover:bg-blue-50 dark:bg-blue-950/50 rounded-xl shadow-sm flex-1 sm:flex-none"
                  onClick={() => setIsTopUpModalOpen(true)}
                  data-testid="button-topup"
                >
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Request Top-Up</span>
                  <span className="sm:hidden">Top-Up</span>
                </Button>
              )}
            </div>
          </div>
          
          <Dialog open={isApplicationModalOpen} onOpenChange={setIsApplicationModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {isPersonalView ? 'Apply for Loan' : 'New Loan Application'}
                </DialogTitle>
                <DialogDescription>
                  {isPersonalView ? 'Submit a new loan application with your requirements' : 'Create a new loan application for a member'}
                </DialogDescription>
              </DialogHeader>
              <LoanApplicationForm onSuccess={() => setIsApplicationModalOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={isTopUpModalOpen} onOpenChange={setIsTopUpModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Loan Top-Up Request</DialogTitle>
                <DialogDescription>
                  Request additional funds on an existing active loan
                </DialogDescription>
              </DialogHeader>
              <LoanTopUpForm onSuccess={() => setIsTopUpModalOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={isRepaymentModalOpen} onOpenChange={(open) => {
            setIsRepaymentModalOpen(open);
            if (!open) {
              setRepaymentLoan(null);
              setRepaymentAmount("");
              setRepaymentDescription("");
            }
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                  Record Loan Repayment
                </DialogTitle>
                <DialogDescription>
                  Record a payment for this loan
                </DialogDescription>
              </DialogHeader>
              {repaymentLoan && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-blue-600">Loan Number:</span>
                        <span className="ml-1 font-medium text-blue-900">{repaymentLoan.loanNumber}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Member:</span>
                        <span className="ml-1 font-medium text-blue-900">{repaymentLoan.member?.fullName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Outstanding:</span>
                        <span className="ml-1 font-bold text-blue-900">{formatCurrency(repaymentLoan.outstandingBalance || '0')}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Monthly Payment:</span>
                        <span className="ml-1 font-medium text-blue-900">{formatCurrency(repaymentLoan.monthlyPayment || '0')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repayment-amount">Payment Amount (UGX)</Label>
                    <Input
                      id="repayment-amount"
                      type="number"
                      value={repaymentAmount}
                      onChange={(e) => setRepaymentAmount(e.target.value)}
                      min={1}
                      max={parseFloat(repaymentLoan.outstandingBalance || '0')}
                      placeholder="Enter payment amount"
                      data-testid="input-repayment-amount"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum: {formatCurrency(repaymentLoan.outstandingBalance || '0')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repayment-description">Description (Optional)</Label>
                    <Textarea
                      id="repayment-description"
                      value={repaymentDescription}
                      onChange={(e) => setRepaymentDescription(e.target.value)}
                      placeholder="e.g. Monthly installment, partial payment..."
                      rows={2}
                    />
                  </div>

                  {parseFloat(repaymentAmount || '0') > 0 && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 rounded-lg text-sm">
                      <div className="flex justify-between">
                        <span className="text-emerald-700">Payment Amount:</span>
                        <span className="font-medium text-emerald-900">{formatCurrency(repaymentAmount)}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-emerald-700">Balance After Payment:</span>
                        <span className="font-bold text-emerald-900">
                          {formatCurrency(Math.max(0, parseFloat(repaymentLoan.outstandingBalance || '0') - parseFloat(repaymentAmount || '0')))}
                        </span>
                      </div>
                      {parseFloat(repaymentAmount || '0') >= parseFloat(repaymentLoan.outstandingBalance || '0') && (
                        <p className="mt-2 text-emerald-800 font-medium text-xs">This payment will fully settle this loan.</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsRepaymentModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 sacco-gradient text-white hover:opacity-90"
                      onClick={handleRepaymentSubmit}
                      disabled={repaymentMutation.isPending || !repaymentAmount || parseFloat(repaymentAmount) <= 0}
                      data-testid="button-submit-repayment"
                    >
                      {repaymentMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Banknote className="mr-2 h-4 w-4" />
                          Record Payment
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="section-card">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center space-x-2">
            {isPersonalView ? (
              <HandCoins className="w-5 h-5 text-blue-600" />
            ) : (
              <HandCoins className="w-5 h-5 text-blue-600" />
            )}
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {isPersonalView ? 'My Loan Applications' : 'Loan Applications'}
            </h3>
            {pendingLoans && (
              <Badge className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 border-blue-200 dark:border-blue-800/50">
                {totalItems}
              </Badge>
            )}
          </div>
        </div>
        <div className="p-6">
          {pendingLoans && pendingLoans.length > 0 ? (
            <div className="space-y-4">
              {pendingLoans.map((loan: any) => (
                <div key={loan.id} className="border border-slate-200 dark:border-slate-700/60 rounded-lg hover:shadow-sm transition-all" data-testid={`card-loan-${loan.id}`}>
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() => loan.uuid && setLocation(`/loans/${loan.uuid}/details`)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">
                            {isPersonalView 
                              ? loan.loanNumber?.slice(-2) || 'LN'
                              : `${loan.member?.user?.firstName?.charAt(0) || ''}${loan.member?.user?.lastName?.charAt(0) || ''}`
                            }
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900 dark:text-slate-100">
                            {isPersonalView 
                              ? `${loan.loanType || 'Loan'} Application`
                              : `${loan.member?.user?.firstName || ''} ${loan.member?.user?.lastName || ''}`
                            }
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Loan: {loan.loanNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center flex-wrap gap-2">
                        {loan.isTopUp && (
                          <Badge variant="outline" className="bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/50 dark:border-violet-800/50">
                            <ArrowUpCircle className="w-3 h-3 mr-1" />
                            Top-Up
                          </Badge>
                        )}
                        <Badge variant="outline" className={getStatusColor(loan.status)}>
                          {loan.status}
                        </Badge>
                        <Badge variant="outline" className={getLoanTypeColor(loan.loanType)}>
                          {loan.loanType}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Amount</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(loan.principalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Interest Rate</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{(parseFloat(loan.interestRate) * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Term</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{loan.termMonths} months</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Monthly Payment</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(loan.monthlyPayment)}</p>
                      </div>
                    </div>

                    {loan.isTopUp && loan.previousLoanBalance && (
                      <div className="mb-3 p-3 bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 rounded-lg">
                        <div className="flex items-center text-sm text-violet-700">
                          <ArrowUpCircle className="w-4 h-4 mr-2" />
                          <span>Top-up loan — Previous balance of {formatCurrency(loan.previousLoanBalance)} was consolidated into this loan.</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                        {isPersonalView ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {loan.status === 'pending' && loan.isTopUp ? 'Your top-up request is under review.' :
                             loan.status === 'pending' ? 'Your application is under review.' :
                             loan.status === 'approved' ? 'Your loan has been approved and is awaiting disbursement.' :
                             loan.status === 'active' || loan.status === 'disbursed' ? 'Your loan is active.' :
                             loan.status === 'rejected' ? 'Your application was not approved.' :
                             loan.status === 'completed' ? 'This loan has been fully repaid.' : ''}
                          </p>
                        ) : (
                          <>
                            {loan.status === 'pending' && (
                              <p className="text-sm text-amber-600">
                                Pending committee approval
                              </p>
                            )}
                            {loan.status === 'approved' && canDisburse && (
                              <Button
                                size="sm"
                                onClick={() => disburseLoanMutation.mutate(loan)}
                                disabled={disburseLoanMutation.isPending}
                                className="sacco-gradient text-white hover:opacity-90 rounded-xl shadow-sm"
                                data-testid={`button-disburse-loan-${loan.id}`}
                              >
                                <DollarSign className="w-4 h-4 mr-1" />
                                Disburse
                              </Button>
                            )}
                            {loan.status === 'approved' && !canDisburse && (
                              <p className="text-sm text-amber-600">
                                Awaiting treasurer disbursement
                              </p>
                            )}
                          </>
                        )}
                        {!isPersonalView && canRecordRepayment && (['active', 'disbursed'].includes(loan.status)) && parseFloat(loan.outstandingBalance || '0') > 0 && (
                          <Button
                            size="sm"
                            onClick={() => openRepaymentModal(loan)}
                            variant="outline"
                            className="border-emerald-200/50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/50 rounded-xl shadow-sm"
                            data-testid={`button-repayment-loan-${loan.id}`}
                          >
                            <Banknote className="w-4 h-4 mr-1" />
                            Record Repayment
                          </Button>
                        )}
                      </div>
                      <span className="text-xs text-blue-600 font-medium">View details →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <HandCoins className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                {isPersonalView ? 'No loan applications' : 'No pending applications'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {isPersonalView ? 'You have not applied for any loans yet.' : 'All loan applications have been processed.'}
              </p>
            </div>
          )}
        </div>
        {totalItems > 0 && (
          <div className="p-6 border-t border-slate-200 dark:border-slate-700/60">
            <Pagination
              totalItems={totalItems}
              itemsPerPage={limit}
              currentPage={page}
              onPageChange={setPage}
              onItemsPerPageChange={setLimit}
            />
          </div>
        )}
      </div>

      {!loanStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="section-card p-4 sm:p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded mt-2" />
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="section-card p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">Total Active Loans</p>
                <p className="text-lg sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1" data-testid="text-active-loans-count">{loanStats.activeCount}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-950/50 rounded-lg flex items-center justify-center shrink-0">
                <HandCoins className="text-blue-600 h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>
          </div>

          <div className="section-card p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">Outstanding Amount</p>
                <p className="text-lg sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate" data-testid="text-outstanding-amount">{formatCurrency(loanStats.totalOutstanding)}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg flex items-center justify-center shrink-0">
                <DollarSign className="text-emerald-600 h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>
          </div>

          <div className="section-card p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">Default Rate</p>
                <p className="text-lg sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1" data-testid="text-default-rate">
                  {loanStats.totalCount > 0 ? ((loanStats.defaultedCount / loanStats.totalCount) * 100).toFixed(1) : '0'}%
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 dark:bg-red-950/50 rounded-lg flex items-center justify-center shrink-0">
                <XCircle className="text-red-600 h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
