import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown, CreditCard, DollarSign, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import type { TransactionWithDetails } from "@shared/schema";

export default function RecentTransactions() {
  const { data: transactions, isLoading } = useQuery<any[]>({
    queryKey: ['/api/dashboard/recent-transactions'],
    refetchInterval: 30000,
  });

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><ArrowUp className="w-4 h-4 text-emerald-600" /></div>;
      case 'withdrawal':
        return <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><ArrowDown className="w-4 h-4 text-red-600" /></div>;
      case 'loan_payment':
        return <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><CreditCard className="w-4 h-4 text-blue-600" /></div>;
      case 'loan_disbursement':
        return <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center"><DollarSign className="w-4 h-4 text-purple-600" /></div>;
      default:
        return <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><DollarSign className="w-4 h-4 text-slate-600" /></div>;
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
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
    }
  };

  const formatTransactionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="section-card">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900">Recent Transactions</h3>
        <Link href="/transactions">
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1.5 rounded-lg text-xs font-medium">
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
      <div className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 py-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-3.5 bg-slate-100 rounded-full w-1/3 mb-2"></div>
                  <div className="h-3 bg-slate-100 rounded-full w-1/4"></div>
                </div>
                <div className="h-5 bg-slate-100 rounded-full w-16"></div>
              </div>
            ))}
          </div>
        ) : transactions && transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="table-modern">
              <TableHeader>
                <TableRow className="border-b border-slate-100">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-6">Member</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider pr-6 hidden sm:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 5).map((transaction: TransactionWithDetails) => (
                  <TableRow key={transaction.id} className="hover:bg-slate-50/60 border-b border-slate-50 last:border-0">
                    <TableCell className="py-3.5 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                          <span className="text-slate-600 text-[11px] font-bold">
                            {transaction.member?.user?.firstName?.charAt(0)}
                            {transaction.member?.user?.lastName?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {transaction.member?.user?.firstName} {transaction.member?.user?.lastName}
                          </p>
                          <p className="text-[11px] text-slate-400">ID: {transaction.member?.memberNumber}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction.transactionType)}
                        <Badge variant="outline" className={`text-[11px] font-medium border ${getTransactionTypeColor(transaction.transactionType)}`}>
                          {formatTransactionType(transaction.transactionType)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-900">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 hidden sm:table-cell">
                      {new Date(transaction.transactionDate!).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="pr-6 hidden sm:table-cell">
                      <Badge variant="outline" className={`text-[11px] font-medium capitalize border ${getStatusColor(transaction.status || 'pending')}`}>
                        {transaction.status || 'pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <DollarSign className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">No recent transactions</p>
          </div>
        )}
      </div>
    </div>
  );
}
