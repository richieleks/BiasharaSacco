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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUp, ArrowDown, DollarSign, CreditCard, CheckCircle, Clock, X } from "lucide-react";
import type { TransactionWithDetails } from "@shared/schema";

export default function Transactions() {
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

  const { data: transactions, isLoading: transactionsLoading, error } = useQuery<any[]>({
    queryKey: ['/api/transactions', { limit: 50 }],
    enabled: isAuthenticated,
  });

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
        return 'bg-green-100 text-green-800';
      case 'withdrawal':
        return 'bg-red-100 text-red-800';
      case 'loan_payment':
        return 'bg-blue-100 text-blue-800';
      case 'loan_disbursement':
        return 'bg-purple-100 text-purple-800';
      case 'interest_credit':
        return 'bg-yellow-100 text-yellow-800';
      case 'fee_charge':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const filteredTransactions = transactions?.filter((transaction: TransactionWithDetails) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      transaction.referenceNumber.toLowerCase().includes(query) ||
      transaction.member?.user?.firstName?.toLowerCase().includes(query) ||
      transaction.member?.user?.lastName?.toLowerCase().includes(query) ||
      transaction.member?.memberNumber?.toLowerCase().includes(query) ||
      transaction.transactionType.toLowerCase().includes(query)
    );
  });

  if (error && isUnauthorizedError(error)) {
    return null; // Will redirect in useEffect
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Transactions</h2>
            <p className="text-slate-600 mt-1">View and manage all SACCO transactions</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search by reference number, member name, or transaction type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                      <div>
                        <div className="h-4 bg-slate-200 rounded w-32 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-24"></div>
                      </div>
                    </div>
                    <div className="h-8 bg-slate-200 rounded w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTransactions && filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction: TransactionWithDetails) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
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
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getTransactionIcon(transaction.transactionType)}
                          <Badge className={getTransactionTypeColor(transaction.transactionType)}>
                            {formatTransactionType(transaction.transactionType)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        UGX {parseFloat(transaction.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {transaction.referenceNumber}
                      </TableCell>
                      <TableCell>
                        {new Date(transaction.transactionDate!).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(transaction.status || 'pending')}
                          <Badge className={getStatusColor(transaction.status || 'pending')}>
                            {transaction.status || 'pending'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {transaction.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => approveTransactionMutation.mutate(transaction.id)}
                            disabled={approveTransactionMutation.isPending}
                            className="sacco-success text-white hover:opacity-90"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No transactions found</h3>
              <p className="text-slate-500">
                {searchQuery ? "No transactions match your search criteria." : "Transactions will appear here as they are processed."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
