import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/usePagination";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import LoanApplicationForm from "@/components/forms/loan-application-form";
import LoanTopUpForm from "@/components/forms/loan-topup-form";
import { formatCurrency } from "@/lib/utils";
import { Search, Plus, CheckCircle, XCircle, Clock, HandCoins, DollarSign, ArrowUpCircle } from "lucide-react";

export default function Loans() {
  const [location, setLocation] = useLocation();
  const isPersonalView = location === '/my-loans';
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  const { data: allLoans, isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: isPersonalView ? ['/api/loans/my-loans'] : ['/api/loans'],
    enabled: isAuthenticated,
  });

  // Filter loans based on search query
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

  // Apply pagination
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
      toast({
        title: "Success",
        description: "Loan approved successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
        description: "Failed to approve loan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const disburseLoanMutation = useMutation({
    mutationFn: async (loan: any) => {
      await apiRequest('PATCH', `/api/loans/${loan.uuid}/disburse`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/pending'] });
      toast({
        title: "Success",
        description: "Loan disbursed successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
        description: "Failed to disburse loan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200/50';
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'disbursed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'completed':
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
      case 'defaulted':
        return 'bg-red-50 text-red-700 border-red-200/50';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
    }
  };

  const getLoanTypeColor = (type: string) => {
    switch (type) {
      case 'personal':
        return 'bg-blue-50 text-blue-700 border-blue-200/50';
      case 'business':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'emergency':
        return 'bg-red-50 text-red-700 border-red-200/50';
      case 'asset':
        return 'bg-purple-50 text-purple-700 border-purple-200/50';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
    }
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
      {/* Page Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {isPersonalView ? 'My Loans' : 'Loan Management'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isPersonalView 
                ? 'View your loan applications and payment history' 
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

      {/* Loans Section */}
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
                <div key={loan.id} className="border border-slate-200/60 rounded-lg p-6 hover:shadow-sm transition-all">
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
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-slate-500">Amount</p>
                      <p className="font-medium text-slate-900">
                        {formatCurrency(loan.principalAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Interest Rate</p>
                      <p className="font-medium text-slate-900">
                        {(parseFloat(loan.interestRate) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Term</p>
                      <p className="font-medium text-slate-900">{loan.termMonths} months</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Monthly Payment</p>
                      <p className="font-medium text-slate-900">
                        {formatCurrency(loan.monthlyPayment)}
                      </p>
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
                    <div className="flex space-x-3">
                      <p className="text-sm text-slate-500">
                        {loan.status === 'pending' && loan.isTopUp ? 'Your top-up request is under review.' :
                         loan.status === 'pending' ? 'Your application is under review.' :
                         loan.status === 'approved' ? 'Your loan has been approved and is awaiting disbursement.' :
                         loan.status === 'active' || loan.status === 'disbursed' ? 'Your loan is active.' :
                         loan.status === 'rejected' ? 'Your application was not approved.' :
                         loan.status === 'completed' ? 'This loan has been fully repaid.' : ''}
                      </p>
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

      {/* Active Loans Summary */}
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
