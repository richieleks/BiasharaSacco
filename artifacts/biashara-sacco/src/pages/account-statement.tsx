import { useState, useEffect, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import {
  Card,
  CardContent,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Pagination } from '@/components/ui/pagination';
import { ArrowLeft, Download, FileText, Search, Calendar, ChevronsUpDown, Check } from 'lucide-react';
import { Link } from 'wouter';
import { formatCurrency, cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

// Classify every savings-ledger transaction type as Money In (credit) or Money Out (debit).
// Covers all transaction types so no statement row is left blank.
const MONEY_IN_TYPES = ['deposit', 'interest_credit', 'share_capital', 'loan_disbursement'];
const MONEY_OUT_TYPES = ['withdrawal', 'fee_charge', 'loan_payment', 'membership_fee'];
const isMoneyIn = (type: string) => MONEY_IN_TYPES.includes(type);
const isMoneyOut = (type: string) => MONEY_OUT_TYPES.includes(type);

type PeriodOption = 'current_month' | 'last_2_months' | 'last_3_months' | 'last_6_months' | 'user_defined';

function getDateRange(period: PeriodOption): { start: string; end: string } {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const startDate = new Date(today);

  switch (period) {
    case 'current_month':
      startDate.setDate(1);
      break;
    case 'last_2_months':
      startDate.setMonth(startDate.getMonth() - 2);
      startDate.setDate(1);
      break;
    case 'last_3_months':
      startDate.setMonth(startDate.getMonth() - 3);
      startDate.setDate(1);
      break;
    case 'last_6_months':
      startDate.setMonth(startDate.getMonth() - 6);
      startDate.setDate(1);
      break;
    default:
      return { start: '', end: '' };
  }
  return { start: startDate.toISOString().split('T')[0], end };
}

export default function AccountStatement() {
  const [, params] = useRoute('/savings/:id/statement');
  const urlAccountId = params?.id || null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const [selectedAccountId, setSelectedAccountId] = useState<string>(urlAccountId || '');
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [period, setPeriod] = useState<PeriodOption | ''>('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [filterApplied, setFilterApplied] = useState(false);
  const [keyword, setKeyword] = useState('');

  const isUserDefined = period === 'user_defined';

  useEffect(() => {
    if (urlAccountId && urlAccountId !== selectedAccountId) {
      setSelectedAccountId(urlAccountId);
    }
  }, [urlAccountId]);

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

  const { data: allAccounts = [], isLoading: accountsLoading } = useQuery<any[]>({
    queryKey: ['/api/savings-accounts'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/savings-accounts');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId || !allAccounts.length) return null;
    return allAccounts.find((a: any) =>
      String(a.id) === String(selectedAccountId) || String(a.uuid) === String(selectedAccountId)
    ) || null;
  }, [selectedAccountId, allAccounts]);

  const accountsList = useMemo(() => {
    if (!selectedAccount) return allAccounts;
    const ownerMemberId = selectedAccount.memberId;
    if (!ownerMemberId) return allAccounts;
    return allAccounts.filter((a: any) => a.memberId === ownerMemberId);
  }, [allAccounts, selectedAccount]);

  const handleAccountSelect = (account: any) => {
    const id = account.uuid || account.id;
    setSelectedAccountId(String(id));
    setAccountSearchOpen(false);
    setFilterApplied(false);
    setPeriod('');
    setCustomStartDate('');
    setCustomEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setCurrentPage(1);
    setKeyword('');
    setLocation(`/savings/${id}/statement`);
  };

  const handlePeriodChange = (value: string) => {
    const p = value as PeriodOption;
    setPeriod(p);

    if (p !== 'user_defined') {
      const { start, end } = getDateRange(p);
      setCustomStartDate(start);
      setCustomEndDate(end);
      setAppliedStartDate(start);
      setAppliedEndDate(end);
      setFilterApplied(true);
      setCurrentPage(1);
    } else {
      setCustomStartDate('');
      setCustomEndDate('');
      setFilterApplied(false);
    }
  };

  const handleSearch = () => {
    if (isUserDefined) {
      if (!customStartDate && !customEndDate) return;
      setAppliedStartDate(customStartDate);
      setAppliedEndDate(customEndDate);
    }
    setFilterApplied(true);
    setCurrentPage(1);
  };

  const buildQueryString = () => {
    const qp = new URLSearchParams();
    qp.set('page', currentPage.toString());
    qp.set('limit', itemsPerPage.toString());
    if (appliedStartDate) qp.set('startDate', appliedStartDate);
    if (appliedEndDate) qp.set('endDate', appliedEndDate);
    return qp.toString();
  };

  const effectiveAccountId = selectedAccountId || urlAccountId;

  const { data: statementData, isLoading: statementLoading } = useQuery<{
    account: any;
    transactions: any[];
    total: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalInterest: number;
    totalInterestCalculated: number;
    financialYearInterestRate: string | null;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['/api/savings-accounts', effectiveAccountId, 'statement', currentPage, itemsPerPage, appliedStartDate, appliedEndDate],
    queryFn: () => fetch(`/api/savings-accounts/${effectiveAccountId}/statement?${buildQueryString()}`).then(res => res.json()),
    enabled: !!effectiveAccountId && isAuthenticated && filterApplied,
  });

  const filteredTransactions = useMemo(() => {
    if (!statementData?.transactions) return [];
    if (!keyword.trim()) return statementData.transactions;
    const lower = keyword.toLowerCase();
    return statementData.transactions.filter((t: any) =>
      (t.description || '').toLowerCase().includes(lower) ||
      (t.referenceNumber || '').toLowerCase().includes(lower) ||
      (t.transactionType || '').toLowerCase().includes(lower)
    );
  }, [statementData?.transactions, keyword]);

  const runningBalances = useMemo(() => {
    if (!filteredTransactions.length) return [];
    let totalCredits = 0;
    let totalDebits = 0;
    (statementData?.transactions || []).forEach((t: any) => {
      const amt = parseFloat(t.amount || '0');
      if (isMoneyIn(t.transactionType)) {
        totalCredits += amt;
      } else {
        totalDebits += amt;
      }
    });
    const currentBalance = parseFloat(statementData?.account?.balance || '0');
    const periodStartBal = currentBalance - totalCredits + totalDebits;

    let balance = periodStartBal;
    return filteredTransactions.map((t: any) => {
      const amt = parseFloat(t.amount || '0');
      if (isMoneyIn(t.transactionType)) {
        balance += amt;
      } else {
        balance -= amt;
      }
      return balance;
    });
  }, [filteredTransactions, statementData]);

  const periodStartBalance = useMemo(() => {
    if (!statementData?.transactions?.length) return 0;
    const currentBalance = parseFloat(statementData?.account?.balance || '0');
    let totalCredits = 0;
    let totalDebits = 0;
    (statementData.transactions || []).forEach((t: any) => {
      const amt = parseFloat(t.amount || '0');
      if (isMoneyIn(t.transactionType)) {
        totalCredits += amt;
      } else {
        totalDebits += amt;
      }
    });
    return currentBalance - totalCredits + totalDebits;
  }, [statementData]);

  const escapeCsv = (val: any) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const [exporting, setExporting] = useState(false);

  const handleDownloadStatement = async () => {
    if (!statementData || !effectiveAccountId) return;
    setExporting(true);
    try {
      const qp = new URLSearchParams();
      qp.set('export', 'true');
      if (appliedStartDate) qp.set('startDate', appliedStartDate);
      if (appliedEndDate) qp.set('endDate', appliedEndDate);
      const res = await fetch(`/api/savings-accounts/${effectiveAccountId}/statement?${qp.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch all transactions');
      const allData = await res.json();

      const allTxns: any[] = allData.transactions || [];
      const currentBalance = parseFloat(allData.account?.balance || '0');
      let totalCredits = 0;
      let totalDebits = 0;
      allTxns.forEach((t: any) => {
        const amt = parseFloat(t.amount || '0');
        if (isMoneyIn(t.transactionType)) {
          totalCredits += amt;
        } else {
          totalDebits += amt;
        }
      });
      const startBal = currentBalance - totalCredits + totalDebits;
      let bal = startBal;
      const balances = allTxns.map((t: any) => {
        const amt = parseFloat(t.amount || '0');
        if (isMoneyIn(t.transactionType)) {
          bal += amt;
        } else {
          bal -= amt;
        }
        return bal;
      });

      const csvContent = [
        ['Transaction Date', 'Value Date', 'Transaction Details', 'Money Out', 'Money In', 'Ledger Balance'],
        ...allTxns.map((txn: any, idx: number) => {
          const isDebit = isMoneyOut(txn.transactionType);
          const isCredit = isMoneyIn(txn.transactionType);
          return [
            new Date(txn.transactionDate || txn.createdAt).toLocaleDateString(),
            new Date(txn.transactionDate || txn.createdAt).toLocaleDateString(),
            txn.description || txn.transactionType,
            isDebit ? parseFloat(txn.amount || '0').toFixed(0) : '',
            isCredit ? parseFloat(txn.amount || '0').toFixed(0) : '',
            balances[idx]?.toFixed(0) || ''
          ];
        })
      ].map(row => row.map(escapeCsv).join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement-${allData.account?.accountNumber || 'account'}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: 'Export failed', description: 'Could not download the full statement.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const accountDisplayLabel = useMemo(() => {
    if (selectedAccount) {
      const memberName = selectedAccount.member?.fullName || selectedAccount.memberName || '';
      return `${selectedAccount.accountNumber} | ${formatCurrency(selectedAccount.balance || '0')}${memberName ? ` - ${memberName}` : ''}`;
    }
    if (statementData?.account) {
      const a = statementData.account;
      const memberName = a.member?.fullName || '';
      return `${a.accountNumber} | ${formatCurrency(a.balance || '0')}${memberName ? ` - ${memberName}` : ''}`;
    }
    return '';
  }, [selectedAccount, statementData]);

  const periodEndBalance = statementData?.account ? parseFloat(statementData.account.balance || '0') : 0;
  const totalMoneyOut = statementData?.totalWithdrawals || 0;
  const totalMoneyIn = statementData?.totalDeposits || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/savings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Back to Savings</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">Account Statement</h2>
        </div>
        {statementData && (
          <Button onClick={handleDownloadStatement} className="sacco-gradient text-white" size="sm" disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Download CSV'}</span>
            <span className="sm:hidden">{exporting ? '...' : 'CSV'}</span>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-3">
              <Label className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-1 block">Account *</Label>
              <Popover open={accountSearchOpen} onOpenChange={setAccountSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={accountSearchOpen}
                    className="w-full h-10 justify-between text-left font-normal text-sm truncate"
                  >
                    <span className="truncate">
                      {accountDisplayLabel || (accountsLoading ? 'Loading accounts...' : 'Select account...')}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command filter={(value, search) => {
                    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                    return 0;
                  }}>
                    <CommandInput placeholder="Search by account number or member name..." />
                    <CommandList>
                      <CommandEmpty>No accounts found.</CommandEmpty>
                      <CommandGroup className="max-h-[250px] overflow-y-auto">
                        {accountsList.map((account: any) => {
                          const acctId = String(account.uuid || account.id);
                          const memberName = account.member?.fullName || account.memberName || '';
                          const label = `${account.accountNumber} | ${formatCurrency(account.balance || '0')}${memberName ? ` - ${memberName}` : ''}`;
                          return (
                            <CommandItem
                              key={acctId}
                              value={`${account.accountNumber} ${memberName} ${account.memberNumber || ''}`}
                              onSelect={() => handleAccountSelect(account)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", String(selectedAccountId) === acctId ? "opacity-100" : "opacity-0")} />
                              <span className="truncate text-sm">{label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="lg:col-span-3">
              <Label className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-1 block">Period *</Label>
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Please Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Current Month</SelectItem>
                  <SelectItem value="last_2_months">Last 2 Months</SelectItem>
                  <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                  <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                  <SelectItem value="user_defined">User Defined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Label className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-1 block">From</Label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                disabled={!isUserDefined}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                  "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "[color-scheme:light] dark:[color-scheme:dark]"
                )}
              />
            </div>

            <div className="lg:col-span-2">
              <Label className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-1 block">To</Label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                disabled={!isUserDefined}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                  "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "[color-scheme:light] dark:[color-scheme:dark]"
                )}
              />
            </div>

            <div className="lg:col-span-2 flex gap-2">
              {isUserDefined && (
                <Button
                  onClick={handleSearch}
                  disabled={!customStartDate && !customEndDate}
                  className="h-10 flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                >
                  <Search className="w-4 h-4 mr-1.5" />
                  Search
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!effectiveAccountId ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">Select an Account</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Choose a savings account from the dropdown above to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !filterApplied ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">Select a Period</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Choose a period from the dropdown above to generate the account statement. Select "User Defined" to specify custom dates.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : statementLoading && !statementData ? (
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative flex-shrink-0 w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Enter keyword"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-6 flex-1 justify-end">
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Balance At Period Start</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(periodStartBalance)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Balance At Period End</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(periodEndBalance)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Money Out</p>
                    <p className="text-sm font-bold text-red-600">{formatCurrency(totalMoneyOut)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Money In</p>
                    <p className="text-sm font-bold text-green-600">{formatCurrency(totalMoneyIn)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {filteredTransactions.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-teal-500 hover:bg-teal-500">
                          <TableHead className="text-white text-xs font-semibold">Transaction Date</TableHead>
                          <TableHead className="text-white text-xs font-semibold">Value Date</TableHead>
                          <TableHead className="text-white text-xs font-semibold">Transaction Details</TableHead>
                          <TableHead className="text-white text-xs font-semibold text-right">Money Out</TableHead>
                          <TableHead className="text-white text-xs font-semibold text-right">Money In</TableHead>
                          <TableHead className="text-white text-xs font-semibold text-right">Ledger Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.map((transaction: any, idx: number) => {
                          const isDebit = isMoneyOut(transaction.transactionType);
                          const isCredit = isMoneyIn(transaction.transactionType);
                          return (
                            <TableRow key={transaction.id} className="border-b">
                              <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                                {new Date(transaction.transactionDate || transaction.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                                {new Date(transaction.transactionDate || transaction.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm">
                                {transaction.description || transaction.transactionType?.replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm">
                                {isDebit && (
                                  <span className="text-red-600 font-medium">
                                    {formatCurrency(transaction.amount || '0')}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm">
                                {isCredit && (
                                  <span className="text-green-600 font-medium">
                                    {formatCurrency(transaction.amount || '0')}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm font-medium">
                                {formatCurrency(runningBalances[idx] || 0)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-3">
                    <Pagination
                      totalItems={statementData?.total || 0}
                      itemsPerPage={itemsPerPage}
                      currentPage={currentPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
                    />
                  </div>
                </>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">NO RECORDS FOUND</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
