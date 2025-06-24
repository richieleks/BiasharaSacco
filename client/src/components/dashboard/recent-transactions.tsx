import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown, CreditCard, DollarSign } from "lucide-react";
import { Link } from "wouter";
import type { TransactionWithDetails } from "@shared/schema";

export default function RecentTransactions() {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['/api/dashboard/recent-transactions'],
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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTransactionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">Recent Transactions</CardTitle>
          <Link href="/transactions">
            <Button variant="ghost" size="sm" className="text-primary-600 hover:text-primary-700">
              View all
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center space-x-4 p-4 border-b border-slate-100 last:border-0">
                    <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                    </div>
                    <div className="h-6 bg-slate-200 rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : transactions && transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">Member</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-slate-200">
                {transactions.slice(0, 5).map((transaction: TransactionWithDetails) => (
                  <TableRow key={transaction.id} className="hover:bg-slate-50">
                    <TableCell className="py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                          <span className="text-slate-600 text-sm font-medium">
                            {transaction.member?.user?.firstName?.charAt(0)}
                            {transaction.member?.user?.lastName?.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-slate-900">
                            {transaction.member?.user?.firstName} {transaction.member?.user?.lastName}
                          </p>
                          <p className="text-sm text-slate-500">ID: {transaction.member?.memberNumber}</p>
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
                    <TableCell className="text-sm font-medium text-slate-900">
                      KSh {parseFloat(transaction.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(transaction.transactionDate!).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-slate-500">No recent transactions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
