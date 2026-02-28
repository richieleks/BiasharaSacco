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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { ArrowLeft, Download, FileText, Calendar, Filter, X } from 'lucide-react';
import { Link } from 'wouter';
import { formatCurrency } from '@/lib/utils';

export default function AccountStatement() {
  const [, params] = useRoute('/savings/:id/statement');
  const accountId = params?.id || null;
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

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

  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.set('page', currentPage.toString());
    params.set('limit', itemsPerPage.toString());
    if (appliedStartDate) params.set('startDate', appliedStartDate);
    if (appliedEndDate) params.set('endDate', appliedEndDate);
    return params.toString();
  };

  const { data: statementData, isLoading: statementLoading, error } = useQuery<{
    account: any;
    transactions: any[];
    total: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalInterest: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['/api/savings-accounts', accountId, 'statement', currentPage, itemsPerPage, appliedStartDate, appliedEndDate],
    queryFn: () => fetch(`/api/savings-accounts/${accountId}/statement?${buildQueryString()}`).then(res => res.json()),
    enabled: !!accountId && isAuthenticated,
  });

  const handleApplyDateFilter = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setCurrentPage(1);
  };

  const handleClearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setCurrentPage(1);
  };

  const hasDateFilter = appliedStartDate || appliedEndDate;

  const handleDownloadStatement = () => {
    if (!statementData) return;
    
    const { account, transactions } = statementData;
    const csvContent = [
      ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Status'],
      ...(transactions || []).map((txn: any) => [
        new Date(txn.transactionDate || txn.createdAt).toLocaleDateString(),
        txn.description || txn.transactionType,
        txn.referenceNumber || '',
        (txn.transactionType === 'withdrawal' || txn.transactionType === 'fee_charge') ? formatCurrency(txn.amount || '0') : '',
        (txn.transactionType === 'deposit' || txn.transactionType === 'interest_credit') ? formatCurrency(txn.amount || '0') : '',
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
    return null;
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/savings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Back to Savings</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Account Statement</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {statementData?.account ? `Account ${statementData.account.accountNumber}` : 'Loading...'}
            </p>
          </div>
        </div>
        {statementData && (
          <Button onClick={handleDownloadStatement} className="sacco-gradient text-white" size="sm">
            <Download className="w-4 h-4 mr-1.5" />
            Download CSV
          </Button>
        )}
      </div>

      {statementLoading && !statementData ? (
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
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-base">
              <FileText className="w-5 h-5" />
              <span>Account Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-600">Account Number</p>
                <p className="text-sm sm:text-lg font-semibold text-slate-900 truncate">{statementData.account.accountNumber}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-600">Account Holder</p>
                <p className="text-sm sm:text-lg font-semibold text-slate-900 truncate">{statementData.account.member?.fullName}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-600">Account Type</p>
                <Badge className={
                  statementData.account.accountType === 'regular' ? 'bg-blue-100 text-blue-800' :
                  statementData.account.accountType === 'fixed_deposit' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }>
                  {statementData.account.accountType?.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-600">Interest Rate</p>
                <p className="text-sm sm:text-lg font-semibold text-blue-600">
                  {(parseFloat(statementData.account.interestRate || '0') * 100).toFixed(2)}% p.a.
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-600">Current Balance</p>
                <p className="text-sm sm:text-lg font-semibold text-green-600">
                  {formatCurrency(statementData.account.balance || '0')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4 pt-4 border-t">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs sm:text-sm font-medium text-green-700">Total Deposits{hasDateFilter ? ' (filtered)' : ''}</p>
                <p className="text-base sm:text-lg font-semibold text-green-800">{formatCurrency(statementData.totalDeposits || 0)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs sm:text-sm font-medium text-red-700">Total Withdrawals{hasDateFilter ? ' (filtered)' : ''}</p>
                <p className="text-base sm:text-lg font-semibold text-red-800">{formatCurrency(statementData.totalWithdrawals || 0)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs sm:text-sm font-medium text-blue-700">Total Interest{hasDateFilter ? ' (filtered)' : ''}</p>
                <p className="text-base sm:text-lg font-semibold text-blue-800">{formatCurrency(statementData.totalInterest || 0)}</p>
              </div>
            </div>
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span>Transaction History</span>
              {statementData && (
                <Badge variant="secondary" className="text-xs">
                  {statementData.total || 0} total
                </Badge>
              )}
            </CardTitle>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 pt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 flex-1 w-full sm:w-auto">
              <div className="flex-1 w-full sm:w-auto">
                <Label htmlFor="startDate" className="text-xs text-slate-500 mb-1 block">From</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <Label htmlFor="endDate" className="text-xs text-slate-500 mb-1 block">To</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApplyDateFilter} disabled={!startDate && !endDate}>
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                Apply
              </Button>
              {hasDateFilter && (
                <Button size="sm" variant="outline" onClick={handleClearDateFilter}>
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {statementLoading && !statementData ? (
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
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Reference</TableHead>
                      <TableHead className="text-xs text-right">Debit</TableHead>
                      <TableHead className="text-xs text-right">Credit</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(statementData?.transactions || []).map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                          {new Date(transaction.transactionDate || transaction.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-[150px] sm:max-w-none truncate">
                          {transaction.description || transaction.transactionType}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                          {transaction.referenceNumber || '-'}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">
                          {(transaction.transactionType === 'withdrawal' || transaction.transactionType === 'fee_charge') && (
                            <span className="text-red-600 font-medium">
                              {formatCurrency(transaction.amount || '0')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">
                          {(transaction.transactionType === 'deposit' || transaction.transactionType === 'interest_credit') && (
                            <span className={transaction.transactionType === 'interest_credit' ? "text-blue-600 font-medium" : "text-green-600 font-medium"}>
                              {formatCurrency(transaction.amount || '0')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={`text-[10px] ${
                            transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                            transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {transaction.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                totalItems={statementData.total || 0}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
              />
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>{hasDateFilter ? 'No transactions found for the selected date range' : 'No transactions found for this account'}</p>
              {hasDateFilter && (
                <Button variant="link" onClick={handleClearDateFilter} className="mt-2 text-sm">
                  Clear date filter
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}