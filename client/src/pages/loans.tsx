import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/usePagination";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import LoanApplicationForm from "@/components/forms/loan-application-form";
import LoanTopUpForm from "@/components/forms/loan-topup-form";
import AmortizationSchedule from "@/components/amortization-schedule";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Search, Plus, CheckCircle, XCircle, Clock, HandCoins, DollarSign, ArrowUpCircle, ChevronDown, ChevronUp, FileText, Calendar, Download, CreditCard, Percent, Hash, AlertCircle } from "lucide-react";

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200/50';
    case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    case 'disbursed': return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    case 'completed': return 'bg-slate-50 text-slate-700 border-slate-200/50';
    case 'defaulted': return 'bg-red-50 text-red-700 border-red-200/50';
    default: return 'bg-slate-50 text-slate-700 border-slate-200/50';
  }
};

const getLoanTypeColor = (type: string) => {
  switch (type) {
    case 'personal': return 'bg-blue-50 text-blue-700 border-blue-200/50';
    case 'business': return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    case 'emergency': return 'bg-red-50 text-red-700 border-red-200/50';
    case 'asset': return 'bg-purple-50 text-purple-700 border-purple-200/50';
    default: return 'bg-slate-50 text-slate-700 border-slate-200/50';
  }
};

export default function Loans() {
  const [location, setLocation] = useLocation();
  const { activeRole } = useRBAC();
  const isPersonalView = location === '/my-loans' || activeRole === 'member';
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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

  const { data: allLoans, isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: isPersonalView ? ['/api/loans/my-loans'] : ['/api/loans'],
    enabled: isAuthenticated,
  });

  const filteredLoans = (allLoans || []).filter((loan: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      loan.loanNumber?.toLowerCase().includes(query) ||
      loan.member?.fullName?.toLowerCase().includes(query) ||
      loan.loanType?.toLowerCase().includes(query) ||
      loan.status?.toLowerCase().includes(query)
    );
  });

  const {
    currentPage,
    itemsPerPage,
    paginatedData: pendingLoans,
    totalItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination({ data: filteredLoans, initialItemsPerPage: 10 });

  const approveLoanMutation = useMutation({
    mutationFn: async (loan: any) => {
      await apiRequest('PATCH', `/api/loans/${loan.uuid}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/pending'] });
      toast({ title: "Success", description: "Loan approved successfully!" });
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
      await apiRequest('PATCH', `/api/loans/${loan.uuid}/disburse`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/pending'] });
      toast({ title: "Success", description: "Loan disbursed successfully!" });
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

  const toggleLoanExpand = (loanId: number) => {
    setExpandedLoanId(expandedLoanId === loanId ? null : loanId);
  };

  if (pendingLoading) {
    return (
      <div className="space-y-6 page-container animate-fade-in">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="section-card p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg"></div>
                <div>
                  <div className="h-4 bg-slate-100 rounded-lg w-32 mb-2"></div>
                  <div className="h-3 bg-slate-100 rounded-lg w-24"></div>
                </div>
              </div>
              <div className="h-8 bg-slate-100 rounded-lg w-24"></div>
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
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {isPersonalView ? 'My Loans' : 'Loan Management'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isPersonalView 
                ? 'View your loan applications, statements and repayment schedules' 
                : 'Process loan applications and manage disbursements'
              }
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0 w-full sm:w-auto">
            <div className="section-card p-4 relative flex items-center w-full sm:w-auto">
              <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search loans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-64 border-0 bg-transparent focus-visible:ring-0"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                className="sacco-gradient text-white hover:opacity-90 rounded-xl shadow-sm flex-1 sm:flex-none"
                onClick={() => setIsApplicationModalOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{isPersonalView ? 'Apply for Loan' : 'New Loan Application'}</span>
                <span className="sm:hidden">{isPersonalView ? 'Apply' : 'New Loan'}</span>
              </Button>
              {isPersonalView && (
                <Button
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl shadow-sm flex-1 sm:flex-none"
                  onClick={() => setIsTopUpModalOpen(true)}
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
        </div>
      </div>

      <div className="section-card">
        <div className="p-6 border-b border-slate-200/60">
          <div className="flex items-center space-x-2">
            {isPersonalView ? (
              <HandCoins className="w-5 h-5 text-blue-600" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600" />
            )}
            <h3 className="text-lg font-semibold text-slate-900">
              {isPersonalView ? 'My Loan Applications' : 'Pending Loan Applications'}
            </h3>
            {pendingLoans && (
              <Badge className={isPersonalView ? "bg-blue-50 text-blue-700 border-blue-200/50" : "bg-amber-50 text-amber-700 border-amber-200/50"}>
                {pendingLoans.length}
              </Badge>
            )}
          </div>
        </div>
        <div className="p-6">
          {pendingLoans && pendingLoans.length > 0 ? (
            <div className="space-y-4">
              {pendingLoans.map((loan: any) => (
                <div key={loan.id} className="border border-slate-200/60 rounded-lg hover:shadow-sm transition-all">
                  <div
                    className={`p-6 ${isPersonalView ? 'cursor-pointer' : ''}`}
                    onClick={() => isPersonalView && toggleLoanExpand(loan.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-slate-600 text-sm font-medium">
                            {isPersonalView 
                              ? loan.loanNumber?.slice(-2) || 'LN'
                              : `${loan.member?.user?.firstName?.charAt(0) || ''}${loan.member?.user?.lastName?.charAt(0) || ''}`
                            }
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900">
                            {isPersonalView 
                              ? `${loan.loanType || 'Loan'} Application`
                              : `${loan.member?.user?.firstName || ''} ${loan.member?.user?.lastName || ''}`
                            }
                          </h3>
                          <p className="text-sm text-slate-500">Loan: {loan.loanNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center flex-wrap gap-2">
                        {loan.isTopUp && (
                          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200/50">
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
                        {isPersonalView && (
                          <div className="ml-1 text-slate-400">
                            {expandedLoanId === loan.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-slate-500">Amount</p>
                        <p className="font-medium text-slate-900">{formatCurrency(loan.principalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Interest Rate</p>
                        <p className="font-medium text-slate-900">{(parseFloat(loan.interestRate) * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Term</p>
                        <p className="font-medium text-slate-900">{loan.termMonths} months</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Monthly Payment</p>
                        <p className="font-medium text-slate-900">{formatCurrency(loan.monthlyPayment)}</p>
                      </div>
                    </div>

                    {loan.isTopUp && loan.previousLoanBalance && (
                      <div className="mb-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                        <div className="flex items-center text-sm text-violet-700">
                          <ArrowUpCircle className="w-4 h-4 mr-2" />
                          <span>Top-up loan — Previous balance of {formatCurrency(loan.previousLoanBalance)} was consolidated into this loan.</span>
                        </div>
                      </div>
                    )}

                    {isPersonalView ? (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                          {loan.status === 'pending' && loan.isTopUp ? 'Your top-up request is under review.' :
                           loan.status === 'pending' ? 'Your application is under review.' :
                           loan.status === 'approved' ? 'Your loan has been approved and is awaiting disbursement.' :
                           loan.status === 'active' || loan.status === 'disbursed' ? 'Your loan is active.' :
                           loan.status === 'rejected' ? 'Your application was not approved.' :
                           loan.status === 'completed' ? 'This loan has been fully repaid.' : ''}
                        </p>
                        {expandedLoanId !== loan.id && (
                          <span className="text-xs text-blue-600 font-medium">Click to view details</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {loan.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => approveLoanMutation.mutate(loan)}
                              disabled={approveLoanMutation.isPending}
                              className="sacco-gradient text-white hover:opacity-90 rounded-xl shadow-sm"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-200/50 text-red-700 hover:bg-red-50 rounded-xl shadow-sm">
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {loan.status === 'approved' && (
                          <Button
                            size="sm"
                            onClick={() => disburseLoanMutation.mutate(loan)}
                            disabled={disburseLoanMutation.isPending}
                            className="sacco-gradient text-white hover:opacity-90 rounded-xl shadow-sm"
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            Disburse
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {isPersonalView && expandedLoanId === loan.id && (
                    <LoanExpandedDetails loan={loan} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <HandCoins className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {isPersonalView ? 'No loan applications' : 'No pending applications'}
              </h3>
              <p className="text-slate-500">
                {isPersonalView ? 'You have not applied for any loans yet.' : 'All loan applications have been processed.'}
              </p>
            </div>
          )}
        </div>
        {filteredLoans.length > 0 && (
          <div className="p-6 border-t border-slate-200/60">
            <Pagination
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        )}
      </div>

      {(() => {
        const activeLoansData = (allLoans || []).filter((l: any) => ['approved', 'active', 'disbursed'].includes(l.status));
        const totalOutstanding = activeLoansData.reduce((sum: number, l: any) => sum + parseFloat(l.outstandingBalance || '0'), 0);
        const defaultedCount = (allLoans || []).filter((l: any) => l.status === 'defaulted').length;
        const totalLoansCount = (allLoans || []).length;
        const defaultRate = totalLoansCount > 0 ? ((defaultedCount / totalLoansCount) * 100).toFixed(1) : '0';
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="section-card p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-slate-500 text-xs sm:text-sm font-medium">Total Active Loans</p>
                  <p className="text-lg sm:text-2xl font-semibold text-slate-900 mt-1">{activeLoansData.length}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <HandCoins className="text-blue-600 h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>

            <div className="section-card p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-slate-500 text-xs sm:text-sm font-medium">Outstanding Amount</p>
                  <p className="text-lg sm:text-2xl font-semibold text-slate-900 mt-1 truncate">{formatCurrency(totalOutstanding)}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                  <DollarSign className="text-emerald-600 h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>

            <div className="section-card p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-slate-500 text-xs sm:text-sm font-medium">Default Rate</p>
                  <p className="text-lg sm:text-2xl font-semibold text-slate-900 mt-1">{defaultRate}%</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                  <XCircle className="text-red-600 h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function LoanExpandedDetails({ loan }: { loan: any }) {
  const { data: transactions, isLoading: txnLoading } = useQuery<any[]>({
    queryKey: ['/api/loans', loan.id, 'transactions'],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loan.id}/transactions`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const totalInterestAmount = (() => {
    const principal = parseFloat(loan.principalAmount || '0');
    const rate = parseFloat(loan.interestRate || '0');
    const term = parseInt(loan.termMonths || '0');
    const monthly = parseFloat(loan.monthlyPayment || '0');
    return (monthly * term) - principal;
  })();

  const totalRepayable = parseFloat(loan.principalAmount || '0') + totalInterestAmount;
  const totalPaid = totalRepayable - parseFloat(loan.outstandingBalance || '0');
  const progressPercent = totalRepayable > 0 ? Math.min((totalPaid / totalRepayable) * 100, 100) : 0;

  const handleExportStatement = () => {
    if (!transactions || transactions.length === 0) return;
    
    let runningBalance = 0;
    const rows = transactions.map((txn: any) => {
      const amount = parseFloat(txn.amount || '0');
      if (txn.transactionType === 'loan_disbursement') {
        runningBalance += amount;
      } else if (txn.transactionType === 'loan_payment') {
        runningBalance -= amount;
      }
      return [
        txn.createdAt ? format(new Date(txn.createdAt), 'yyyy-MM-dd') : 'N/A',
        txn.description || txn.transactionType || 'N/A',
        txn.transactionType === 'loan_payment' ? amount : '',
        txn.transactionType === 'loan_disbursement' ? amount : '',
        runningBalance,
        txn.status || 'completed'
      ];
    });
    
    const csvData = [['Date', 'Description', 'Payment', 'Disbursement', 'Balance', 'Status'], ...rows];
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `loan-statement-${loan.loanNumber || 'unknown'}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="border-t border-slate-200/60 bg-slate-50/50">
      <Tabs defaultValue="details" className="w-full">
        <div className="px-6 pt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Loan Details
            </TabsTrigger>
            <TabsTrigger value="statement" className="text-xs sm:text-sm">
              <CreditCard className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Loan Statement
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs sm:text-sm">
              <Calendar className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Repayment Schedule
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details" className="px-6 pb-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Principal Amount</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(loan.principalAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total Interest</span>
                  <span className="font-semibold text-amber-700">{formatCurrency(totalInterestAmount)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Total Repayable</span>
                  <span className="font-bold text-slate-900">{formatCurrency(totalRepayable)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Outstanding Balance</span>
                  <span className="font-semibold text-red-700">{formatCurrency(loan.outstandingBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Monthly Payment</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(loan.monthlyPayment)}</span>
                </div>
                {(loan.status === 'active' || loan.status === 'disbursed') && (
                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Repayment Progress</span>
                      <span>{progressPercent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Loan Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> Loan Number
                  </span>
                  <span className="font-mono text-sm text-slate-900">{loan.loanNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <HandCoins className="h-3.5 w-3.5" /> Loan Type
                  </span>
                  <span className="capitalize text-sm text-slate-900">{loan.loanType?.replace('_', ' ') || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5" /> Interest Rate
                  </span>
                  <span className="text-sm text-slate-900">{(parseFloat(loan.interestRate) * 100).toFixed(1)}% per annum</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Term
                  </span>
                  <span className="text-sm text-slate-900">{loan.termMonths} months</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Status
                  </span>
                  <Badge variant="outline" className={getStatusColor(loan.status)}>
                    {loan.status}
                  </Badge>
                </div>
                {loan.createdAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Application Date
                    </span>
                    <span className="text-sm text-slate-900">{format(new Date(loan.createdAt), 'MMM dd, yyyy')}</span>
                  </div>
                )}
                {loan.purpose && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-sm text-slate-500">Purpose</span>
                    <p className="text-sm text-slate-900 mt-1">{loan.purpose}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="statement" className="px-6 pb-6 mt-4">
          <Card className="border-slate-200/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  Transaction History
                </CardTitle>
                {transactions && transactions.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleExportStatement}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export CSV
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {txnLoading ? (
                <div className="text-center py-8 text-slate-500">Loading transactions...</div>
              ) : transactions && transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs text-right">Payment</TableHead>
                        <TableHead className="text-xs text-right">Disbursement</TableHead>
                        <TableHead className="text-xs text-right">Balance</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let runningBalance = 0;
                        return transactions.map((txn: any) => {
                          const amount = parseFloat(txn.amount || '0');
                          if (txn.transactionType === 'loan_disbursement') {
                            runningBalance += amount;
                          } else if (txn.transactionType === 'loan_payment') {
                            runningBalance -= amount;
                          }
                          return (
                            <TableRow key={txn.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {txn.createdAt ? format(new Date(txn.createdAt), 'MMM dd, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell className="text-xs">{txn.description || txn.transactionType || 'N/A'}</TableCell>
                              <TableCell className="text-xs text-right font-medium text-emerald-700">
                                {txn.transactionType === 'loan_payment' ? formatCurrency(amount) : ''}
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium text-blue-700">
                                {txn.transactionType === 'loan_disbursement' ? formatCurrency(amount) : ''}
                              </TableCell>
                              <TableCell className="text-xs text-right font-semibold">{formatCurrency(runningBalance)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={txn.status === 'completed' ? 'bg-emerald-50 text-emerald-700 text-xs' : 'text-xs'}>
                                  {txn.status || 'completed'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No transactions recorded for this loan yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="px-6 pb-6 mt-4">
          {loan.uuid ? (
            <AmortizationSchedule loan={loan} />
          ) : (
            <Card className="border-slate-200/60">
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Repayment schedule will be available once the loan is processed.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
