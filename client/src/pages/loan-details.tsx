import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useRBAC } from "@/hooks/useRBAC";
import { format, addMonths } from "date-fns";
import {
  ArrowLeft, DollarSign, FileText, Calendar, Download, CreditCard,
  Percent, Hash, HandCoins, Clock, AlertCircle, ArrowUpCircle, Calculator,
} from "lucide-react";

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200/50';
    case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    case 'disbursed': return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    case 'completed': return 'bg-slate-50 text-slate-700 border-slate-200/50';
    case 'defaulted': return 'bg-red-50 text-red-700 border-red-200/50';
    default: return 'bg-slate-50 text-slate-700 border-slate-200/50';
  }
};

export default function LoanDetails() {
  const [, params] = useRoute("/loans/:id/details");
  const [, setLocation] = useLocation();
  const { activeRole } = useRBAC();
  const loanId = params?.id;
  const backPath = activeRole === 'member' ? '/my-loans' : '/loans';

  const { data: loan, isLoading } = useQuery<any>({
    queryKey: ['/api/loans', loanId],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}`);
      if (!res.ok) throw new Error('Failed to fetch loan');
      return res.json();
    },
    enabled: !!loanId,
  });

  const { data: transactions = [], isLoading: txnLoading } = useQuery<any[]>({
    queryKey: ['/api/loans', loanId, 'transactions'],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/transactions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!loanId,
  });

  const principal = parseFloat(loan?.principalAmount || '0');
  const monthlyPayment = parseFloat(loan?.monthlyPayment || '0');
  const termMonths = parseInt(loan?.termMonths || '0');
  const interestRate = parseFloat(loan?.interestRate || '0');

  const totalInterestAmount = (monthlyPayment * termMonths) - principal;
  const totalRepayable = principal + totalInterestAmount;
  const outstandingBalance = parseFloat(loan?.outstandingBalance || '0');
  const principalPaid = principal - outstandingBalance;
  const progressPercent = principal > 0 ? Math.min((principalPaid / principal) * 100, 100) : 0;

  const repaymentSchedule = useMemo(() => {
    if (!loan || !principal || !monthlyPayment || !termMonths) return [];

    const startDate = loan.disbursedAt ? new Date(loan.disbursedAt) : 
                      loan.approvedAt ? new Date(loan.approvedAt) : 
                      loan.createdAt ? new Date(loan.createdAt) : new Date();
    const monthlyRate = interestRate / 12;
    const schedule: Array<{
      month: number;
      dueDate: Date;
      payment: number;
      principalPortion: number;
      interestPortion: number;
      balance: number;
    }> = [];

    let balance = principal;
    const totalMonthlyPayment = monthlyPayment;

    for (let i = 1; i <= termMonths; i++) {
      const interestPortion = balance * monthlyRate;
      const principalPortion = Math.min(totalMonthlyPayment - interestPortion, balance);
      balance = Math.max(0, balance - principalPortion);
      const dueDate = addMonths(startDate, i);

      schedule.push({
        month: i,
        dueDate,
        payment: i === termMonths ? principalPortion + interestPortion : totalMonthlyPayment,
        principalPortion: i === termMonths ? balance + principalPortion : principalPortion,
        interestPortion,
        balance: i === termMonths ? 0 : balance,
      });

      if (i === termMonths) {
        schedule[i - 1].balance = 0;
      }
    }

    return schedule;
  }, [loan, principal, monthlyPayment, termMonths, interestRate]);

  if (isLoading) {
    return (
      <div className="space-y-6 page-container animate-fade-in">
        <div className="section-card p-6 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-48 mb-4"></div>
          <div className="h-4 bg-slate-100 rounded w-32 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 bg-slate-100 rounded w-20 mb-2"></div>
                <div className="h-5 bg-slate-100 rounded w-28"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="space-y-6 page-container animate-fade-in">
        <div className="section-card p-6 text-center py-16">
          <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Loan not found</h3>
          <p className="text-slate-500 mb-4">The loan you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => setLocation(backPath)} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Button>
        </div>
      </div>
    );
  }

  const handleExportStatement = () => {
    if (!transactions || transactions.length === 0) return;

    let runningBalance = 0;
    const rows = transactions.map((txn: any) => {
      const amount = parseFloat(txn.amount || '0');
      if (txn.transactionType === 'loan_disbursement') runningBalance += amount;
      else if (txn.transactionType === 'loan_payment') runningBalance -= amount;
      return [
        txn.createdAt ? format(new Date(txn.createdAt), 'yyyy-MM-dd') : 'N/A',
        txn.description || txn.transactionType || 'N/A',
        txn.transactionType === 'loan_payment' ? amount : '',
        txn.transactionType === 'loan_disbursement' ? amount : '',
        runningBalance,
        txn.status || 'completed',
      ];
    });

    const csvData = [['Date', 'Description', 'Payment', 'Disbursement', 'Balance', 'Status'], ...rows];
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `loan-statement-${loan.loanNumber || 'unknown'}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setLocation(backPath)} className="rounded-xl">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Loan Details
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{loan.loanNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {loan.isTopUp && (
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200/50">
              <ArrowUpCircle className="w-3 h-3 mr-1" />
              Top-Up
            </Badge>
          )}
          <Badge variant="outline" className={getStatusColor(loan.status)}>
            {loan.status}
          </Badge>
          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200/50 capitalize">
            {loan.loanType?.replace('_', ' ') || 'Loan'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="section-card p-4">
          <p className="text-xs text-slate-500 font-medium">Principal Amount</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(loan.principalAmount)}</p>
        </div>
        <div className="section-card p-4">
          <p className="text-xs text-slate-500 font-medium">Outstanding Balance</p>
          <p className="text-lg font-bold text-red-700 mt-1">{formatCurrency(loan.outstandingBalance)}</p>
        </div>
        <div className="section-card p-4">
          <p className="text-xs text-slate-500 font-medium">Monthly Payment</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(loan.monthlyPayment)}</p>
        </div>
        <div className="section-card p-4">
          <p className="text-xs text-slate-500 font-medium">Term</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{loan.termMonths} months</p>
        </div>
      </div>

      {(loan.status === 'active' || loan.status === 'disbursed') && (
        <div className="section-card p-4">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>Repayment Progress</span>
            <span className="font-semibold">{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className="bg-emerald-500 h-3 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Paid: {formatCurrency(principalPaid)}</span>
            <span>Principal: {formatCurrency(principal)}</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details" className="text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Loan Details
          </TabsTrigger>
          <TabsTrigger value="statement" className="text-xs sm:text-sm">
            <CreditCard className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Loan Statement
          </TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Repayment Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Principal Amount</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(loan.principalAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total Interest</span>
                  <span className="font-semibold text-amber-700">{formatCurrency(totalInterestAmount)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Total Repayable</span>
                  <span className="font-bold text-slate-900">{formatCurrency(totalRepayable)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Outstanding Balance</span>
                  <span className="font-semibold text-red-700">{formatCurrency(loan.outstandingBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Monthly Payment</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(loan.monthlyPayment)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Loan Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> Loan Number
                  </span>
                  <span className="font-mono text-sm text-slate-900">{loan.loanNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <HandCoins className="h-3.5 w-3.5" /> Loan Type
                  </span>
                  <span className="capitalize text-sm text-slate-900">{loan.loanType?.replace('_', ' ') || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5" /> Interest Rate
                  </span>
                  <span className="text-sm text-slate-900">{(parseFloat(loan.interestRate) * 100).toFixed(1)}% per annum</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Term
                  </span>
                  <span className="text-sm text-slate-900">{loan.termMonths} months</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Status
                  </span>
                  <Badge variant="outline" className={getStatusColor(loan.status)}>
                    {loan.status}
                  </Badge>
                </div>
                {loan.createdAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Application Date
                    </span>
                    <span className="text-sm text-slate-900">{format(new Date(loan.createdAt), 'MMM dd, yyyy')}</span>
                  </div>
                )}
                {loan.purpose && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-sm text-slate-500">Purpose</span>
                    <p className="text-sm text-slate-900 mt-1">{loan.purpose}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {loan.isTopUp && loan.previousLoanBalance && (
            <div className="mt-4 p-4 bg-violet-50 border border-violet-200 rounded-lg">
              <div className="flex items-center text-sm text-violet-700">
                <ArrowUpCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>This is a top-up loan. Previous balance of {formatCurrency(loan.previousLoanBalance)} was consolidated into this loan.</span>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="statement" className="mt-4">
          <Card className="border-slate-200/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  Transaction History
                </CardTitle>
                {transactions && transactions.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleExportStatement}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export CSV
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {txnLoading ? (
                <div className="text-center py-8 text-slate-500">Loading transactions...</div>
              ) : transactions && transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs text-right">Payment</TableHead>
                        <TableHead className="text-xs text-right">Disbursement</TableHead>
                        <TableHead className="text-xs text-right">Balance</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let runningBalance = 0;
                        return transactions.map((txn: any) => {
                          const amount = parseFloat(txn.amount || '0');
                          if (txn.transactionType === 'loan_disbursement') runningBalance += amount;
                          else if (txn.transactionType === 'loan_payment') runningBalance -= amount;
                          return (
                            <TableRow key={txn.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {txn.createdAt ? format(new Date(txn.createdAt), 'MMM dd, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell className="text-xs">{txn.description || txn.transactionType || 'N/A'}</TableCell>
                              <TableCell className="text-xs text-right font-medium text-emerald-700">
                                {txn.transactionType === 'loan_payment' ? formatCurrency(amount) : ''}
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium text-blue-700">
                                {txn.transactionType === 'loan_disbursement' ? formatCurrency(amount) : ''}
                              </TableCell>
                              <TableCell className="text-xs text-right font-semibold">{formatCurrency(runningBalance)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={txn.status === 'completed' ? 'bg-emerald-50 text-emerald-700 text-xs' : 'text-xs'}>
                                  {txn.status || 'completed'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No transactions recorded for this loan yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          {repaymentSchedule.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-slate-200/60">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">Total Repayable</p>
                    <p className="text-lg font-bold">{formatCurrency(totalRepayable)}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200/60">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">Total Interest</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(totalInterestAmount)}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200/60">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">Monthly Payment</p>
                    <p className="text-lg font-bold text-blue-700">{formatCurrency(monthlyPayment)}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200/60">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">Term</p>
                    <p className="text-lg font-bold">{termMonths} months</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-blue-600" />
                        Repayment Schedule
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Detailed breakdown of {termMonths} monthly payments at {(interestRate * 100).toFixed(1)}% per annum
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const rows = repaymentSchedule.map(p => [
                          p.month,
                          format(p.dueDate, 'yyyy-MM-dd'),
                          Math.round(p.payment),
                          Math.round(p.principalPortion),
                          Math.round(p.interestPortion),
                          Math.round(p.balance),
                        ]);
                        const csvData = [['#', 'Due Date', 'Payment', 'Principal', 'Interest', 'Balance'], ...rows];
                        const csvContent = csvData.map(row => row.join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `repayment-schedule-${loan.loanNumber || 'loan'}.csv`;
                        link.click();
                        window.URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-12">#</TableHead>
                          <TableHead className="text-xs">Due Date</TableHead>
                          <TableHead className="text-xs text-right">Payment</TableHead>
                          <TableHead className="text-xs text-right">Principal</TableHead>
                          <TableHead className="text-xs text-right">Interest</TableHead>
                          <TableHead className="text-xs text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repaymentSchedule.map((row) => (
                          <TableRow key={row.month}>
                            <TableCell className="text-xs font-medium">{row.month}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{format(row.dueDate, 'MMM dd, yyyy')}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatCurrency(row.payment)}</TableCell>
                            <TableCell className="text-xs text-right text-blue-700">{formatCurrency(row.principalPortion)}</TableCell>
                            <TableCell className="text-xs text-right text-amber-700">{formatCurrency(row.interestPortion)}</TableCell>
                            <TableCell className="text-xs text-right font-semibold">{formatCurrency(row.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-slate-200/60">
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Repayment schedule will be available once the loan is processed.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
