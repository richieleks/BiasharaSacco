import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import LoanApplicationForm from "@/components/forms/loan-application-form";
import { Search, Plus, CheckCircle, XCircle, Clock, HandCoins, DollarSign } from "lucide-react";

export default function Loans() {
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
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

  const { data: pendingLoans, isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: ['/api/loans/pending'],
    enabled: isAuthenticated,
  });

  const approveLoanMutation = useMutation({
    mutationFn: async (loanId: number) => {
      await apiRequest('PATCH', `/api/loans/${loanId}/approve`);
    },
    onSuccess: () => {
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
    mutationFn: async (loanId: number) => {
      await apiRequest('PATCH', `/api/loans/${loanId}/disburse`);
    },
    onSuccess: () => {
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
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'disbursed':
        return 'bg-green-100 text-green-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'defaulted':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLoanTypeColor = (type: string) => {
    switch (type) {
      case 'personal':
        return 'bg-blue-100 text-blue-800';
      case 'business':
        return 'bg-green-100 text-green-800';
      case 'emergency':
        return 'bg-red-100 text-red-800';
      case 'asset':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (pendingLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                  <div>
                    <div className="h-4 bg-slate-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-24"></div>
                  </div>
                </div>
                <div className="h-8 bg-slate-200 rounded w-24"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Loan Management</h2>
            <p className="text-slate-600 mt-1">Process loan applications and manage disbursements</p>
          </div>
          <Dialog open={isApplicationModalOpen} onOpenChange={setIsApplicationModalOpen}>
            <DialogTrigger asChild>
              <Button className="sacco-gradient text-white hover:opacity-90 mt-4 sm:mt-0">
                <Plus className="w-4 h-4 mr-2" />
                New Loan Application
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Loan Application</DialogTitle>
              </DialogHeader>
              <LoanApplicationForm onSuccess={() => setIsApplicationModalOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pending Loans Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span>Pending Loan Applications</span>
            {pendingLoans && (
              <Badge className="bg-yellow-100 text-yellow-800">
                {pendingLoans.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingLoans && pendingLoans.length > 0 ? (
            <div className="space-y-4">
              {pendingLoans.map((loan: any) => (
                <div key={loan.id} className="border border-slate-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <span className="text-slate-600 text-sm font-medium">
                          {loan.member?.user?.firstName?.charAt(0)}{loan.member?.user?.lastName?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">
                          {loan.member?.user?.firstName} {loan.member?.user?.lastName}
                        </h3>
                        <p className="text-sm text-slate-500">Loan: {loan.loanNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(loan.status)}>
                        {loan.status}
                      </Badge>
                      <Badge className={getLoanTypeColor(loan.loanType)}>
                        {loan.loanType}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-slate-500">Amount</p>
                      <p className="font-medium text-slate-900">
                        UGX {parseFloat(loan.principalAmount).toLocaleString()}
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
                        UGX {parseFloat(loan.monthlyPayment).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    {loan.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveLoanMutation.mutate(loan.id)}
                          disabled={approveLoanMutation.isPending}
                          className="sacco-success text-white hover:opacity-90"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {loan.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => disburseLoanMutation.mutate(loan.id)}
                        disabled={disburseLoanMutation.isPending}
                        className="sacco-gradient text-white hover:opacity-90"
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Disburse
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <HandCoins className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No pending applications</h3>
              <p className="text-slate-500">All loan applications have been processed.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Loans Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Total Active Loans</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">0</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <HandCoins className="text-blue-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Outstanding Amount</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">UGX 0</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-green-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Default Rate</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">0%</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="text-red-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
