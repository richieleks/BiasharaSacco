import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatCurrency } from "@/lib/utils";
import { useRBAC } from "@/hooks/useRBAC";

export default function PendingApprovals() {
  const { toast } = useToast();
  const { activeRole } = useRBAC();
  
  const { data: approvals, isLoading } = useQuery<{
    loanApplications: any[];
    withdrawalRequests: any[];
  }>({
    queryKey: ['/api/dashboard/pending-approvals'],
    refetchInterval: 30000,
  });

  const approveTransactionMutation = useMutation({
    mutationFn: async (transactionUuid: string) => {
      await apiRequest('PATCH', `/api/transactions/${transactionUuid}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/recent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      toast({ title: "Success",
        description: "Transaction approved successfully!", variant: "success" });
    },
    onError: (error: any) => {
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
      const message = error?.message?.includes('treasurer')
        ? "Only the treasurer can approve withdrawal requests."
        : "Failed to approve transaction. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const approveLoanMutation = useMutation({
    mutationFn: async (loan: any) => {
      await apiRequest('PATCH', `/api/loans/${loan.uuid}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/pending'] });
      toast({ title: "Success",
        description: "Loan approved successfully!", variant: "success" });
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

  const totalPending = (approvals?.loanApplications?.length || 0) + (approvals?.withdrawalRequests?.length || 0);

  return (
    <div className="section-card">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pending Approvals</h3>
        {totalPending > 0 && (
          <Badge variant="outline" className="bg-red-50 dark:bg-red-950/50 text-red-600 border-red-200/50 text-xs font-semibold">
            {totalPending}
          </Badge>
        )}
      </div>
      <div className="p-5">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-1"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                    </div>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : totalPending > 0 ? (
          <div className="space-y-3">
            {/* Loan Applications */}
            {approvals?.loanApplications?.map((loan: any) => (
              <div key={`loan-${loan.id}`} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Loan Application</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {loan.member?.user?.firstName} {loan.member?.user?.lastName} - {formatCurrency(loan.principalAmount)}
                    </p>
                  </div>
                  <Badge className="text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-950/50">Pending</Badge>
                </div>
                <Button
                  size="sm"
                  onClick={() => approveLoanMutation.mutate(loan)}
                  disabled={approveLoanMutation.isPending}
                  className="w-full sacco-success text-white hover:opacity-90"
                >
                  Approve Loan
                </Button>
              </div>
            ))}

            {/* Withdrawal Requests */}
            {approvals?.withdrawalRequests?.map((withdrawal: any) => (
              <div key={`withdrawal-${withdrawal.id}`} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Withdrawal Request</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {withdrawal.member?.user?.firstName} {withdrawal.member?.user?.lastName} - {formatCurrency(withdrawal.amount)}
                    </p>
                  </div>
                  <Badge className="text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-950/50">Pending</Badge>
                </div>
                {['admin', 'treasurer'].includes(activeRole) ? (
                  <Button
                    size="sm"
                    onClick={() => approveTransactionMutation.mutate(withdrawal.uuid)}
                    disabled={approveTransactionMutation.isPending}
                    className="w-full sacco-success text-white hover:opacity-90"
                    data-testid={`button-approve-withdrawal-${withdrawal.id}`}
                  >
                    Approve Withdrawal
                  </Button>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">Awaiting treasurer approval</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">No pending approvals</p>
          </div>
        )}

        {totalPending > 3 && (
          <Button variant="ghost" className="w-full mt-4 text-primary hover:text-primary/80 text-sm rounded-lg">
            View All Approvals
          </Button>
        )}
      </div>
    </div>
  );
}
