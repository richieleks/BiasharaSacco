import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/usePagination";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { formatCurrency } from "@/lib/utils";
import { Search, ArrowUp, ArrowDown, DollarSign, CreditCard, CheckCircle, Clock, X } from "lucide-react";
import type { TransactionWithDetails } from "@shared/schema";

export default function Transactions() {
  const [location] = useLocation();
  const { activeRole } = useRBAC();
  const isPersonalView = location === '/my-transactions' || activeRole === 'member';
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

  const { data: allTransactions, isLoading: transactionsLoading, error } = useQuery<any[]>({
    queryKey: isPersonalView ? ['/api/transactions/my-transactions'] : ['/api/transactions'],
    enabled: isAuthenticated,
  });

  // Filter transactions based on search query
  const filteredTransactions = (allTransactions || []).filter((transaction: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      transaction.member?.fullName?.toLowerCase().includes(query) ||
      transaction.type?.toLowerCase().includes(query) ||
      transaction.description?.toLowerCase().includes(query) ||
      transaction.status?.toLowerCase().includes(query)
    );
  });

  // Apply pagination
  const {
    currentPage,
    itemsPerPage,
    paginatedData: transactions,
    totalItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination({ data: filteredTransactions, initialItemsPerPage: 10 });

  const approveTransactionMutation = useMutation({
    mutationFn: async (transactionId: number) => {
      await apiRequest('PATCH', `/api/transactions/${transactionId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      toast({
        title: "Success",
        description: "Transaction approved successfully!",
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
        description: "Failed to approve transaction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowUp className="w-4 h-4 text-green-600" />;
      case 'withdrawal':
        return <ArrowDown className="w-4 h-4 text-red-600" />;
      case 'loan_payment':
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'loan_disbursement':
        return <DollarSign className="w-4 h-4 text-purple-600" />;
      default:
        return <DollarSign className="w-4 h-4 text-slate-600" />;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'withdrawal':
        return 'bg-red-50 text-red-700 border-red-200/50';
      case 'loan_payment':
        return 'bg-blue-50 text-blue-700 border-blue-200/50';
      case 'loan_disbursement':
        return 'bg-purple-50 text-purple-700 border-purple-200/50';
      case 'interest_credit':
        return 'bg-amber-50 text-amber-700 border-amber-200/50';
      case 'fee_charge':
        return 'bg-orange-50 text-orange-700 border-orange-200/50';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200/50';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200/50';
      case 'cancelled':
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed':
      case 'cancelled':
        return <X className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const formatTransactionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };



  if (error && isUnauthorizedError(error)) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="space-y-6 page-container animate-fade-in">
      {/* Page Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          {isPersonalView ? 'My Transactions' : 'Transactions'}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {isPersonalView 
            ? 'View your transaction history and account activity' 
            : 'View and manage all SACCO transactions'
          }
        </p>
      </div>

      {/* Search */}
      <div className="section-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search by reference number, member name, or transaction type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="section-card">
        <div className="p-6">
          {transactionsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg"></div>
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
          ) : transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="table-modern">
                <TableHeader>
                  <TableRow>
                    {!isPersonalView && <TableHead>Member</TableHead>}
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden md:table-cell">Reference</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    {!isPersonalView && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction: TransactionWithDetails) => (
                    <TableRow key={transaction.id}>
                      {!isPersonalView && (
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center">
                              <span className="text-slate-600 text-sm font-medium">
                                {transaction.member?.user?.firstName?.charAt(0)}
                                {transaction.member?.user?.lastName?.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">
                                {transaction.member?.user?.firstName} {transaction.member?.user?.lastName}
                              </p>
                              <p className="text-sm text-slate-500">{transaction.member?.memberNumber}</p>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getTransactionIcon(transaction.transactionType)}
                          <Badge variant="outline" className={getTransactionTypeColor(transaction.transactionType)}>
                            {formatTransactionType(transaction.transactionType)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell className="font-mono text-sm hidden md:table-cell">
                        {transaction.referenceNumber}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {new Date(transaction.transactionDate!).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(transaction.status || 'pending')}
                          <Badge variant="outline" className={getStatusColor(transaction.status || 'pending')}>
                            {transaction.status || 'pending'}
                          </Badge>
                        </div>
                      </TableCell>
                      {!isPersonalView && (
                        <TableCell>
                          {transaction.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => approveTransactionMutation.mutate(transaction.id)}
                              disabled={approveTransactionMutation.isPending}
                              className="sacco-success text-white hover:opacity-90 rounded-xl shadow-sm"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="section-card">
              <div className="py-16 text-center">
                <DollarSign className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No transactions found</h3>
                <p className="text-slate-500">
                  {searchQuery 
                    ? "No transactions match your search criteria." 
                    : isPersonalView 
                      ? "Your transaction history will appear here once you start making deposits, withdrawals, or loan payments."
                      : "Transactions will appear here as they are processed."
                  }
                </p>
              </div>
            </div>
          )}
        </div>
        {filteredTransactions.length > 0 && (
          <Pagination
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>
    </div>
  );
}
