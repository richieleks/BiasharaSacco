import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { Link } from 'wouter';

export default function AccountStatement() {
  const [, params] = useRoute('/savings/:id/statement');
  const accountId = params?.id || null;
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

  const { data: statementData, isLoading: statementLoading, error } = useQuery<{account: any, transactions: any[]}>({
    queryKey: ['/api/savings-accounts', accountId, 'statement'],
    queryFn: () => fetch(`/api/savings-accounts/${accountId}/statement`).then(res => res.json()),
    enabled: !!accountId && isAuthenticated,
  });

  const handleDownloadStatement = () => {
    if (!statementData) return;
    
    const { account, transactions } = statementData;
    const csvContent = [
      ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Status'],
      ...(transactions || []).map((txn: any) => [
        new Date(txn.transactionDate || txn.createdAt).toLocaleDateString(),
        txn.description || txn.transactionType,
        txn.referenceNumber || '',
        (txn.transactionType === 'withdrawal' || txn.transactionType === 'fee_charge') ? `UGX ${parseFloat(txn.amount || '0').toLocaleString()}` : '',
        (txn.transactionType === 'deposit' || txn.transactionType === 'interest_credit') ? `UGX ${parseFloat(txn.amount || '0').toLocaleString()}` : '',
        txn.status || 'completed'
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statement-${account?.accountNumber || 'account'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (error && isUnauthorizedError(error)) {
    return null; // Will redirect in useEffect
  }

  if (!accountId) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Invalid Account</h3>
          <p className="text-slate-600 mb-4">The account ID provided is not valid.</p>
          <Link href="/savings">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Savings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/savings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Savings
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Account Statement</h2>
            <p className="text-slate-600 mt-1">
              {statementData?.account ? `Account ${statementData.account.accountNumber}` : 'Loading account details...'}
            </p>
          </div>
        </div>
        {statementData && (
          <Button onClick={handleDownloadStatement} className="sacco-gradient text-white">
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
        )}
      </div>

      {/* Account Information */}
      {statementLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            </div>
          </CardContent>
        </Card>
      ) : statementData?.account ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Account Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Account Number</p>
                <p className="text-lg font-semibold text-slate-900">{statementData.account.accountNumber}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Account Holder</p>
                <p className="text-lg font-semibold text-slate-900">{statementData.account.member?.fullName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Account Type</p>
                <Badge className={
                  statementData.account.accountType === 'regular' ? 'bg-blue-100 text-blue-800' :
                  statementData.account.accountType === 'fixed_deposit' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }>
                  {statementData.account.accountType?.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Interest Rate</p>
                <p className="text-lg font-semibold text-blue-600">
                  {(parseFloat(statementData.account.interestRate || '0') * 100).toFixed(2)}% p.a.
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Current Balance</p>
                <p className="text-lg font-semibold text-green-600">
                  UGX {parseFloat(statementData.account.balance || '0').toLocaleString()}
                </p>
              </div>
            </div>

            {(() => {
              const txns = statementData.transactions || [];
              const totalDeposits = txns.filter((t: any) => t.transactionType === 'deposit' && t.status === 'completed').reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
              const totalWithdrawals = txns.filter((t: any) => t.transactionType === 'withdrawal' && t.status === 'completed').reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
              const totalInterest = txns.filter((t: any) => t.transactionType === 'interest_credit' && t.status === 'completed').reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-700">Total Deposits</p>
                    <p className="text-lg font-semibold text-green-800">UGX {totalDeposits.toLocaleString()}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-700">Total Withdrawals</p>
                    <p className="text-lg font-semibold text-red-800">UGX {totalWithdrawals.toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-700">Total Interest Earned</p>
                    <p className="text-lg font-semibold text-blue-800">UGX {totalInterest.toLocaleString()}</p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-slate-500">
              Failed to load account information
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transaction History</span>
            {statementData?.transactions && (
              <Badge variant="secondary">
                {statementData.transactions?.length || 0} transactions
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statementLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/5"></div>
                </div>
              ))}
            </div>
          ) : (statementData?.transactions && statementData.transactions.length > 0) ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(statementData?.transactions || []).map((transaction: any) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.transactionDate || transaction.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {transaction.description || transaction.transactionType}
                      </TableCell>
                      <TableCell>
                        {transaction.referenceNumber || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(transaction.transactionType === 'withdrawal' || transaction.transactionType === 'fee_charge') && (
                          <span className="text-red-600 font-medium">
                            UGX {parseFloat(transaction.amount || '0').toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {(transaction.transactionType === 'deposit' || transaction.transactionType === 'interest_credit') && (
                          <span className={transaction.transactionType === 'interest_credit' ? "text-blue-600 font-medium" : "text-green-600 font-medium"}>
                            UGX {parseFloat(transaction.amount || '0').toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                          transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }>
                          {transaction.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>No transactions found for this account</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}