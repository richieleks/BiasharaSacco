import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, addMonths } from "date-fns";
import {
  ArrowLeft, DollarSign, FileText, Calendar, Download, CreditCard,
  Percent, Hash, HandCoins, Clock, AlertCircle, ArrowUpCircle, Calculator,
  Users, CheckCircle, XCircle, Ban, Paperclip, Trash2, RefreshCw, Eye,
} from "lucide-react";

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 dark:border-amber-800/50';
    case 'approved': return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50';
    case 'disbursed': return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50';
    case 'active': return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50';
    case 'completed': return 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/50';
    case 'recalled': return 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50';
    case 'defaulted': return 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-800/50';
    default: return 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/50';
  }
};

export default function LoanDetails() {
  const [, params] = useRoute("/loans/:id/details");
  const [, setLocation] = useLocation();
  const { activeRole } = useRBAC();
  const loanId = params?.id;
  const backPath = activeRole === 'member' ? '/my-loans' : '/loans';

  const { toast } = useToast();
  const qc = useQueryClient();
  const [stmtPage, setStmtPage] = useState(1);
  const [stmtPageSize, setStmtPageSize] = useState(25);
  const [schedPage, setSchedPage] = useState(1);
  const [schedPageSize, setSchedPageSize] = useState(25);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [showWriteoffDialog, setShowWriteoffDialog] = useState(false);
  const [writeoffReason, setWriteoffReason] = useState('');
  const [showRestructureDialog, setShowRestructureDialog] = useState(false);
  const [restructureRate, setRestructureRate] = useState('');
  const [restructureTerm, setRestructureTerm] = useState('');
  const [restructureReason, setRestructureReason] = useState('');

  const writeoffMutation = useMutation({
    mutationFn: async ({ loanId, reason }: { loanId: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/loans/${loanId}/write-off`, { reason });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/loans', loanId] });
      setShowWriteoffDialog(false);
      setWriteoffReason('');
      toast({ title: "Write-Off Requested", description: "The write-off request has been submitted for approval", variant: "success" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const restructureMutation = useMutation({
    mutationFn: async ({ loanId, newRate, newTerm, reason }: { loanId: number; newRate: string; newTerm: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/loans/${loanId}/restructure`, { newRate, newTerm, reason });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/loans', loanId] });
      qc.invalidateQueries({ queryKey: ['/api/loans', loanId, 'restructure-history'] });
      setShowRestructureDialog(false);
      setRestructureRate('');
      setRestructureTerm('');
      setRestructureReason('');
      toast({ title: "Restructure Requested", description: "The restructure request has been submitted for approval", variant: "success" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: restructureHistory = [] } = useQuery<any[]>({
    queryKey: ['/api/loans', loanId, 'restructure-history'],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/restructure-history`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!loanId,
  });

  const { data: loan, isLoading } = useQuery<any>({
    queryKey: ['/api/loans', loanId],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}`);
      if (!res.ok) throw new Error('Failed to fetch loan');
      return res.json();
    },
    enabled: !!loanId,
  });

  const computedRestructurePayment = useMemo(() => {
    const bal = parseFloat(loan?.outstandingBalance || '0');
    const rate = parseFloat(restructureRate || '0');
    const term = parseInt(restructureTerm || '0');
    if (bal <= 0 || term <= 0) return 0;
    const mr = rate / 100 / 12;
    if (mr > 0) return Math.ceil(bal * (mr * Math.pow(1 + mr, term)) / (Math.pow(1 + mr, term) - 1));
    return Math.ceil(bal / term);
  }, [loan?.outstandingBalance, restructureRate, restructureTerm]);

  const { data: transactions = [], isLoading: txnLoading } = useQuery<any[]>({
    queryKey: ['/api/loans', loanId, 'transactions'],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/transactions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!loanId,
  });

  const { data: guarantors = [] } = useQuery<any[]>({
    queryKey: ['/api/guarantors/loan', loan?.id],
    queryFn: async () => {
      const res = await fetch(`/api/guarantors/loan/${loan.id}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!loan?.id,
  });

  const { data: loanDocuments = [] } = useQuery<any[]>({
    queryKey: ['/api/loans', loan?.id, 'documents'],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loan.id}/documents`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!loan?.id,
  });

  const { data: loanTypes = [] } = useQuery<any[]>({
    queryKey: ['/api/loan-types/active'],
    queryFn: async () => {
      const res = await fetch('/api/loan-types/active');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const principal = parseFloat(loan?.principalAmount || '0');
  const monthlyPayment = parseFloat(loan?.monthlyPayment || '0');
  const termMonths = parseInt(loan?.termMonths || '0');
  const interestRate = parseFloat(loan?.interestRate || '0');

  const totalInterestAmount = (monthlyPayment * termMonths) - principal;
  const totalRepayable = monthlyPayment * termMonths;
  const outstandingBalance = parseFloat(loan?.outstandingBalance || '0');

  const loanTypeConfigForProgress = loanTypes?.find((lt: any) => lt.name === loan?.loanType);
  const interestMethodForProgress = loanTypeConfigForProgress?.interestType || loanTypeConfigForProgress?.interest_type || 'reducing_balance';
  const isFixedInterest = interestMethodForProgress === 'simple' || interestMethodForProgress === 'compound';
  const progressTotal = isFixedInterest ? totalRepayable : principal;
  const amountPaid = progressTotal - outstandingBalance;
  const progressPercent = progressTotal > 0 ? Math.min((amountPaid / progressTotal) * 100, 100) : 0;

  const loanTypeConfig = useMemo(() => {
    if (!loan || !loanTypes.length) return null;
    return loanTypes.find((lt: any) => lt.name === loan.loanType) || null;
  }, [loan, loanTypes]);

  const interestMethod = loanTypeConfig?.interestType || loanTypeConfig?.interest_type || 'reducing_balance';

  const repaymentSchedule = useMemo(() => {
    if (!loan || !principal || !monthlyPayment || !termMonths) return [];

    const startDate = loan.disbursementDate ? new Date(loan.disbursementDate) : 
                      loan.applicationDate ? new Date(loan.applicationDate) :
                      loan.approvalDate ? new Date(loan.approvalDate) : 
                      loan.createdAt ? new Date(loan.createdAt) : new Date();
    const schedule: Array<{
      month: number;
      dueDate: Date;
      payment: number;
      principalPortion: number;
      interestPortion: number;
      balance: number;
    }> = [];

    if (interestMethod === 'simple') {
      const totalInterest = principal * interestRate * (termMonths / 12);
      const monthlyInterest = totalInterest / termMonths;
      const monthlyPrincipal = principal / termMonths;
      let balance = principal;

      for (let i = 1; i <= termMonths; i++) {
        const isLast = i === termMonths;
        const principalPortion = isLast ? balance : Math.round(monthlyPrincipal * 100) / 100;
        balance = Math.max(0, balance - principalPortion);
        const dueDate = addMonths(startDate, i);

        schedule.push({
          month: i,
          dueDate,
          payment: principalPortion + monthlyInterest,
          principalPortion,
          interestPortion: monthlyInterest,
          balance,
        });
      }
    } else if (interestMethod === 'compound') {
      const compFreq = loanTypeConfig?.compoundingFrequency || loanTypeConfig?.compounding_frequency || 'monthly';
      let n = 12;
      if (compFreq === 'quarterly') n = 4;
      if (compFreq === 'annually') n = 1;
      const timeInYears = termMonths / 12;
      const totalAmount = principal * Math.pow(1 + interestRate / n, n * timeInYears);
      const totalInterest = totalAmount - principal;
      const monthlyInterest = totalInterest / termMonths;
      const monthlyPrincipal = principal / termMonths;
      let balance = principal;

      for (let i = 1; i <= termMonths; i++) {
        const isLast = i === termMonths;
        const principalPortion = isLast ? balance : Math.round(monthlyPrincipal * 100) / 100;
        balance = Math.max(0, balance - principalPortion);
        const dueDate = addMonths(startDate, i);

        schedule.push({
          month: i,
          dueDate,
          payment: principalPortion + monthlyInterest,
          principalPortion,
          interestPortion: monthlyInterest,
          balance,
        });
      }
    } else {
      const monthlyRate = interestRate / 12;
      let balance = principal;

      for (let i = 1; i <= termMonths; i++) {
        const interestPortion = balance * monthlyRate;
        const principalPortion = Math.min(monthlyPayment - interestPortion, balance);
        balance = Math.max(0, balance - principalPortion);
        const dueDate = addMonths(startDate, i);
        const isLast = i === termMonths;

        schedule.push({
          month: i,
          dueDate,
          payment: isLast ? principalPortion + interestPortion : monthlyPayment,
          principalPortion,
          interestPortion,
          balance: isLast ? 0 : balance,
        });
      }
    }

    return schedule;
  }, [loan, principal, monthlyPayment, termMonths, interestRate, interestMethod, loanTypeConfig]);

  const sortedTransactions = useMemo(() => {
    return (transactions || []).slice().sort((a: any, b: any) => {
      const dateA = new Date(a.transactionDate || a.createdAt || a.date || 0).getTime();
      const dateB = new Date(b.transactionDate || b.createdAt || b.date || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      const orderA = a.transactionType === 'loan_disbursement' ? 0 : 1;
      const orderB = b.transactionType === 'loan_disbursement' ? 0 : 1;
      return orderA - orderB;
    });
  }, [transactions]);

  const statementEntries = useMemo(() => {
    if (!sortedTransactions || sortedTransactions.length === 0) return [];

    const entries: Array<{
      date: string;
      details: string;
      amtDebited: number;
      principalRepyt: number;
      interest: number;
      balance: number;
    }> = [];

    let runningBalance = 0;
    let repaymentIdx = 0;

    sortedTransactions.forEach((txn: any) => {
      const amount = parseFloat(txn.amount || '0');
      const dateStr = (txn.transactionDate || txn.createdAt)
        ? format(new Date(txn.transactionDate || txn.createdAt), 'd-MMM-yy')
        : 'N/A';

      let meta: any = null;
      if (txn.metadata) {
        try { meta = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata; } catch {}
      }
      const isImported = meta?.source === 'excel_import';

      if (txn.transactionType === 'loan_disbursement') {
        if (isImported) {
          const metaBalance = meta.balance != null ? meta.balance : null;
          runningBalance = metaBalance != null ? metaBalance : (runningBalance + (meta.amtDebited ?? amount));
          entries.push({
            date: dateStr,
            details: txn.description || 'LOAN AMOUNT DISBURSED',
            amtDebited: meta.amtDebited ?? amount,
            principalRepyt: meta.principalRepyt ?? 0,
            interest: meta.interest ?? 0,
            balance: runningBalance,
          });
        } else {
          runningBalance += amount;
          entries.push({
            date: dateStr,
            details: 'LOAN AMOUNT DISBURSED',
            amtDebited: amount,
            principalRepyt: 0,
            interest: 0,
            balance: runningBalance,
          });
        }
      } else if (txn.transactionType === 'loan_payment') {
        if (isImported) {
          runningBalance = meta.balance ?? 0;
          entries.push({
            date: dateStr,
            details: txn.description || 'LOAN REPAYMENT',
            amtDebited: meta.amtDebited ?? 0,
            principalRepyt: meta.principalRepyt ?? 0,
            interest: meta.interest ?? 0,
            balance: runningBalance,
          });
        } else {
          let principalPortion = amount;
          let interestPortion = 0;

          if (repaymentSchedule.length > 0 && repaymentIdx < repaymentSchedule.length) {
            const scheduleEntry = repaymentSchedule[repaymentIdx];
            principalPortion = scheduleEntry.principalPortion;
            interestPortion = scheduleEntry.interestPortion;
            repaymentIdx++;
          } else if (interestRate > 0 && termMonths > 0) {
            const monthlyRate = interestRate / 12;
            interestPortion = runningBalance * monthlyRate;
            principalPortion = amount - interestPortion;
            if (principalPortion < 0) {
              interestPortion = amount;
              principalPortion = 0;
            }
          }

          runningBalance = Math.max(0, runningBalance - principalPortion);
          entries.push({
            date: dateStr,
            details: txn.description || 'LOAN REPAYMENT',
            amtDebited: 0,
            principalRepyt: principalPortion,
            interest: interestPortion,
            balance: runningBalance,
          });
        }
      }
    });

    return entries;
  }, [sortedTransactions, repaymentSchedule, interestRate, termMonths]);

  if (isLoading) {
    return (
      <div className="space-y-6 page-container animate-fade-in">
        <div className="section-card p-6 animate-pulse">
          <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-48 mb-4"></div>
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-32 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-20 mb-2"></div>
                <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-28"></div>
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
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">Loan not found</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">The loan you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => setLocation(backPath)} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Button>
        </div>
      </div>
    );
  }

  const escapeCsv = (val: any) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportStatement = () => {
    if (statementEntries.length === 0) return;

    const header = ['POSTING DATE', 'DETAILS', 'AMT DEBITED', 'PRINCIPLE REPYT', 'INTEREST', 'BALANCE'];
    const rows = statementEntries.map(e => [
      e.date,
      e.details,
      e.amtDebited > 0 ? e.amtDebited.toFixed(2) : '',
      e.principalRepyt > 0 ? e.principalRepyt.toFixed(2) : '',
      e.interest > 0 ? e.interest.toFixed(2) : '',
      e.balance.toFixed(2),
    ]);

    const csvData = [header, ...rows];
    const csvContent = csvData.map(row => row.map(escapeCsv).join(',')).join('\n');
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
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Loan Details
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {loan.member?.fullName && <span className="font-medium text-slate-700 dark:text-slate-300">{loan.member.fullName} — </span>}
              {loan.loanNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {loan.isTopUp && (
            <Badge variant="outline" className="bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/50 dark:border-violet-800/50">
              <ArrowUpCircle className="w-3 h-3 mr-1" />
              Top-Up
            </Badge>
          )}
          <Badge variant="outline" className={getStatusColor(loan.status)}>
            {loan.status}
          </Badge>
          <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/50 capitalize">
            {loan.loanType?.replace('_', ' ') || 'Loan'}
          </Badge>
        </div>
        {['active', 'disbursed', 'defaulted'].includes(loan.status) && activeRole !== 'member' && parseFloat(loan.outstandingBalance) > 1 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={() => setShowRestructureDialog(true)}>
              <RefreshCw className="w-4 h-4 mr-1" />Restructure
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setShowWriteoffDialog(true)}>
              <Ban className="w-4 h-4 mr-1" />Write Off
            </Button>
          </div>
        )}
      </div>

      {loan.status === 'rejected' && (
        <div
          className="mt-3 p-4 rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40"
          data-testid="banner-loan-rejected"
        >
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-semibold text-sm text-red-800 dark:text-red-300">
                  Loan Application Rejected
                </p>
                {loan.rejectedAt && (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    {format(new Date(loan.rejectedAt), 'PPP')}
                  </p>
                )}
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1.5 whitespace-pre-wrap break-words">
                <span className="font-medium">Reason: </span>
                {loan.rejectionReason || 'No reason was provided.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="text-base truncate pr-8">{previewDoc?.originalName}</DialogTitle>
            <DialogDescription className="flex items-center justify-between gap-2">
              <span className="text-xs">
                {previewDoc?.mimeType}
                {previewDoc?.fileSize ? ` | ${(previewDoc.fileSize / 1024).toFixed(0)} KB` : ''}
              </span>
              {previewDoc && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/loans/documents/${previewDoc.id}/download`, '_blank')}
                  data-testid="button-download-from-preview"
                >
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900">
            {previewDoc && (() => {
              const url = `/api/loans/documents/${previewDoc.id}/view`;
              const mime = previewDoc.mimeType || '';
              if (mime.startsWith('image/')) {
                return (
                  <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                    <img src={url} alt={previewDoc.originalName} className="max-w-full max-h-full object-contain" />
                  </div>
                );
              }
              if (mime === 'application/pdf' || mime.startsWith('text/')) {
                return <iframe src={url} title={previewDoc.originalName} className="w-full h-full border-0" />;
              }
              return (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Preview is not available for this file type ({mime || 'unknown'}).
                  </p>
                  <Button onClick={() => window.open(url, '_blank')} variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" /> Open in new tab
                  </Button>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWriteoffDialog} onOpenChange={setShowWriteoffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write Off Loan</DialogTitle>
            <DialogDescription>
              Submit a write-off request for loan {loan.loanNumber}. Outstanding balance: {formatCurrency(loan.outstandingBalance)}. This requires admin approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Reason for Write-Off</Label>
              <Textarea placeholder="Provide justification for writing off this loan..." value={writeoffReason} onChange={(e) => setWriteoffReason(e.target.value)} rows={3} />
            </div>
            <Button className="w-full" variant="destructive" disabled={!writeoffReason.trim() || writeoffMutation.isPending}
              onClick={() => writeoffMutation.mutate({ loanId: loan.id, reason: writeoffReason })}>
              {writeoffMutation.isPending ? 'Submitting...' : 'Submit Write-Off Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRestructureDialog} onOpenChange={setShowRestructureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restructure Loan</DialogTitle>
            <DialogDescription>
              Propose new terms for loan {loan.loanNumber}. Outstanding balance: {formatCurrency(loan.outstandingBalance)}. This requires admin approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>New Interest Rate (%)</Label>
                <Input type="number" step="0.01" min="0" placeholder="e.g. 12" value={restructureRate} onChange={(e) => setRestructureRate(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Current: {(parseFloat(loan.interestRate || '0') * 100).toFixed(1)}%</p>
              </div>
              <div>
                <Label>New Term (months)</Label>
                <Input type="number" min="1" placeholder="e.g. 24" value={restructureTerm} onChange={(e) => setRestructureTerm(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Current: {loan.termMonths} months</p>
              </div>
            </div>
            {computedRestructurePayment > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800/50">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Estimated New Monthly Payment</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{formatCurrency(computedRestructurePayment)}</p>
                <p className="text-xs text-blue-500 dark:text-blue-400">Current: {formatCurrency(loan.monthlyPayment)}</p>
              </div>
            )}
            <div>
              <Label>Reason for Restructuring</Label>
              <Textarea placeholder="Explain why this loan needs restructuring..." value={restructureReason} onChange={(e) => setRestructureReason(e.target.value)} rows={3} />
            </div>
            <Button className="w-full" disabled={!restructureRate || !restructureTerm || !restructureReason.trim() || restructureMutation.isPending}
              onClick={() => restructureMutation.mutate({ loanId: loan.id, newRate: restructureRate, newTerm: restructureTerm, reason: restructureReason })}>
              {restructureMutation.isPending ? 'Submitting...' : 'Submit Restructure Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="section-card p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Principal Amount</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(loan.principalAmount)}</p>
        </div>
        <div className="section-card p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Outstanding Balance</p>
          <p className="text-lg font-bold text-red-700 mt-1">{formatCurrency(loan.outstandingBalance)}</p>
        </div>
        <div className="section-card p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Monthly Payment</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(loan.monthlyPayment)}</p>
        </div>
        <div className="section-card p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Term</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{loan.termMonths} months</p>
        </div>
      </div>

      {(loan.status === 'active' || loan.status === 'disbursed') && (
        <div className="section-card p-4">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300 mb-2">
            <span>Repayment Progress</span>
            <span className="font-semibold">{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
            <div
              className="bg-emerald-500 h-3 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
            <span>Paid: {formatCurrency(amountPaid)}</span>
            <span>{isFixedInterest ? 'Total Repayable' : 'Principal'}: {formatCurrency(progressTotal)}</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="details" className="text-xs sm:text-sm flex-shrink-0">
            <FileText className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Details
          </TabsTrigger>
          <TabsTrigger value="statement" className="text-xs sm:text-sm flex-shrink-0">
            <CreditCard className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Statement
          </TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs sm:text-sm flex-shrink-0">
            <Calendar className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Schedule
          </TabsTrigger>
          {loanDocuments.length > 0 && (
            <TabsTrigger value="documents" className="text-xs sm:text-sm flex-shrink-0">
              <Paperclip className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Docs ({loanDocuments.length})
            </TabsTrigger>
          )}
          {guarantors.length > 0 && (
            <TabsTrigger value="guarantors" className="text-xs sm:text-sm flex-shrink-0">
              <Users className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Guarantors
            </TabsTrigger>
          )}
          {restructureHistory.length > 0 && (
            <TabsTrigger value="restructures" className="text-xs sm:text-sm flex-shrink-0">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Restructures ({restructureHistory.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200 dark:border-slate-700/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Principal Amount</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(loan.principalAmount)}</span>
                </div>
                {loan.isTopUp && loan.previousLoanBalance && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <ArrowUpCircle className="h-3.5 w-3.5" /> Previous Loan Balance
                      </span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{formatCurrency(loan.previousLoanBalance)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <ArrowUpCircle className="h-3.5 w-3.5" /> Top-Up Amount
                      </span>
                      <span className="font-semibold text-blue-700">
                        {formatCurrency(Math.max(0, parseFloat(loan.principalAmount) - parseFloat(loan.previousLoanBalance)))}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Total Interest</span>
                  <span className="font-semibold text-amber-700">{formatCurrency(totalInterestAmount)}</span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Total Repayable</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalRepayable)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Outstanding Balance</span>
                  <span className="font-semibold text-red-700">{formatCurrency(loan.outstandingBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Monthly Payment</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(loan.monthlyPayment)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Loan Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> Loan Number
                  </span>
                  <span className="font-mono text-sm text-slate-900 dark:text-slate-100">{loan.loanNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <HandCoins className="h-3.5 w-3.5" /> Loan Type
                  </span>
                  <span className="capitalize text-sm text-slate-900 dark:text-slate-100">{loan.loanType?.replace('_', ' ') || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5" /> Interest Rate
                  </span>
                  <span className="text-sm text-slate-900 dark:text-slate-100">{(parseFloat(loan.interestRate) * 100).toFixed(1)}% per annum</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Term
                  </span>
                  <span className="text-sm text-slate-900 dark:text-slate-100">{loan.termMonths} months</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Status
                  </span>
                  <Badge variant="outline" className={getStatusColor(loan.status)}>
                    {loan.status}
                  </Badge>
                </div>
                {(loan.applicationDate || loan.createdAt) && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Application Date
                    </span>
                    <span className="text-sm text-slate-900 dark:text-slate-100">{format(new Date(loan.applicationDate || loan.createdAt), 'MMM dd, yyyy')}</span>
                  </div>
                )}
                {loan.purpose && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Purpose</span>
                    <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">{loan.purpose}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {loan.isTopUp && loan.previousLoanBalance && (
            <div className="mt-4 p-4 bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 rounded-lg">
              <div className="flex items-center text-sm text-violet-700">
                <ArrowUpCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>This is a top-up loan. Previous balance of {formatCurrency(loan.previousLoanBalance)} was consolidated into this loan.</span>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="statement" className="mt-4">
          <Card className="border-slate-200 dark:border-slate-700/60">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  Loan Statement
                </CardTitle>
                {statementEntries.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleExportStatement}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download Statement
                  </Button>
                )}
              </div>
              {loan && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {loan.member?.fullName && <span className="font-medium">{loan.member.fullName}</span>}
                  {loan.loanNumber && <span> &mdash; {loan.loanNumber}</span>}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {txnLoading ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">Loading statement...</div>
              ) : statementEntries.length > 0 ? (
                <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-800 dark:bg-slate-900 hover:bg-slate-800 dark:hover:bg-slate-900">
                        <TableHead className="text-xs font-bold text-white whitespace-nowrap">POSTING DATE</TableHead>
                        <TableHead className="text-xs font-bold text-white">DETAILS</TableHead>
                        <TableHead className="text-xs font-bold text-white text-right whitespace-nowrap">AMT DEBITED</TableHead>
                        <TableHead className="text-xs font-bold text-white text-right whitespace-nowrap">PRINCIPLE REPYT</TableHead>
                        <TableHead className="text-xs font-bold text-white text-right whitespace-nowrap">INTEREST</TableHead>
                        <TableHead className="text-xs font-bold text-white text-right whitespace-nowrap">BALANCE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const startIdx = (stmtPage - 1) * stmtPageSize;
                        const pageItems = statementEntries.slice(startIdx, startIdx + stmtPageSize);
                        return pageItems.map((entry, idx) => (
                          <TableRow key={idx} className={entry.amtDebited > 0 ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                            <TableCell className="text-xs whitespace-nowrap">{entry.date}</TableCell>
                            <TableCell className="text-xs font-medium">{entry.details}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums whitespace-nowrap">
                              {entry.amtDebited > 0 ? formatCurrency(entry.amtDebited) : ''}
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums whitespace-nowrap">
                              {entry.principalRepyt > 0 ? formatCurrency(entry.principalRepyt) : ''}
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums whitespace-nowrap">
                              {entry.interest > 0 ? formatCurrency(entry.interest) : ''}
                            </TableCell>
                            <TableCell className="text-xs text-right font-semibold tabular-nums whitespace-nowrap">{formatCurrency(entry.balance)}</TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  totalItems={statementEntries.length}
                  itemsPerPage={stmtPageSize}
                  currentPage={stmtPage}
                  onPageChange={(p) => setStmtPage(p)}
                  onItemsPerPageChange={(s) => { setStmtPageSize(s); setStmtPage(1); }}
                />
                </>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No transactions recorded for this loan yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          {repaymentSchedule.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-slate-200 dark:border-slate-700/60">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total Repayable</p>
                    <p className="text-lg font-bold">{formatCurrency(totalRepayable)}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-700/60">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total Interest</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(totalInterestAmount)}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-700/60">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Monthly Payment</p>
                    <p className="text-lg font-bold text-blue-700">{formatCurrency(monthlyPayment)}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-700/60">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Term</p>
                    <p className="text-lg font-bold">{termMonths} months</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200 dark:border-slate-700/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-blue-600" />
                        Repayment Schedule
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Detailed breakdown of {termMonths} monthly payments at {(interestRate * 100).toFixed(1)}% per annum ({interestMethod.replace(/_/g, ' ')})
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const rows = repaymentSchedule.map(p => [
                          p.month,
                          format(p.dueDate, 'yyyy-MM-dd'),
                          p.payment.toFixed(0),
                          p.principalPortion.toFixed(0),
                          p.interestPortion.toFixed(0),
                          p.balance.toFixed(0),
                        ]);
                        const csvData = [['#', 'Due Date', 'Payment', 'Principal', 'Interest', 'Balance'], ...rows];
                        const csvContent = csvData.map(row => row.map(v => escapeCsv(v)).join(',')).join('\n');
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
                        {repaymentSchedule
                          .slice((schedPage - 1) * schedPageSize, schedPage * schedPageSize)
                          .map((row) => (
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
                  <Pagination
                    totalItems={repaymentSchedule.length}
                    itemsPerPage={schedPageSize}
                    currentPage={schedPage}
                    onPageChange={(p) => setSchedPage(p)}
                    onItemsPerPageChange={(s) => { setSchedPageSize(s); setSchedPage(1); }}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-slate-200 dark:border-slate-700/60">
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Repayment schedule will be available once the loan is processed.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {loanDocuments.length > 0 && (
          <TabsContent value="documents" className="mt-4">
            <Card className="border-slate-200 dark:border-slate-700/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Loan Documents ({loanDocuments.length})
                </CardTitle>
                <CardDescription>
                  Documents submitted with this loan application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loanDocuments.map((doc: any) => {
                    const typeLabels: Record<string, string> = {
                      loan_application: 'Signed Loan Application',
                      provident_commitment: 'Provident Commitment',
                      guarantor_guarantee: 'Guarantor Guarantee',
                    };
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-blue-100 dark:bg-blue-950/50 rounded-full flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{doc.originalName}</p>
                            <p className="text-xs text-muted-foreground">
                              {typeLabels[doc.documentType] || doc.documentType}
                              {doc.fileSize && ` | ${(doc.fileSize / 1024).toFixed(0)} KB`}
                              {doc.createdAt && ` | ${format(new Date(doc.createdAt), 'MMM d, yyyy')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewDoc(doc)}
                            title="View"
                            data-testid={`button-view-doc-${doc.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/api/loans/documents/${doc.id}/download`, '_blank')}
                            title="Download"
                            data-testid={`button-download-doc-${doc.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {guarantors.length > 0 && (
          <TabsContent value="guarantors" className="mt-4">
            <Card className="border-slate-200 dark:border-slate-700/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Guarantors ({guarantors.length})
                </CardTitle>
                <CardDescription>
                  Members who guaranteed this loan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Total Guaranteed</span>
                      <div className="font-semibold">
                        {formatCurrency(guarantors.reduce((sum: number, g: any) => sum + parseFloat(g.guaranteeAmount || '0'), 0))}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Approved</span>
                      <div className="font-semibold text-emerald-700">
                        {guarantors.filter((g: any) => g.status === 'approved').length} of {guarantors.length}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Status</span>
                      <div>
                        <Badge variant={guarantors.every((g: any) => g.status === 'approved') ? 'default' : 'secondary'}>
                          {guarantors.every((g: any) => g.status === 'approved') ? 'All Approved' : 'Pending Approvals'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {guarantors.map((guarantor: any) => {
                    const statusIcon = guarantor.status === 'approved' 
                      ? <CheckCircle className="h-4 w-4 text-emerald-600" />
                      : guarantor.status === 'rejected'
                      ? <XCircle className="h-4 w-4 text-red-600" />
                      : <Clock className="h-4 w-4 text-amber-600" />;

                    const statusColor = guarantor.status === 'approved'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50'
                      : guarantor.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-800/50'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 dark:border-amber-800/50';

                    return (
                      <div key={guarantor.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-100 dark:bg-blue-950/50 rounded-full flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {guarantor.guarantorMember?.user?.firstName || ''} {guarantor.guarantorMember?.user?.lastName || ''}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {guarantor.guarantorMember?.memberNumber}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <div className="font-semibold text-sm">{formatCurrency(guarantor.guaranteeAmount)}</div>
                            {guarantor.comments && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 max-w-[150px] truncate">{guarantor.comments}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {statusIcon}
                            <Badge variant="outline" className={statusColor}>
                              {guarantor.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {restructureHistory.length > 0 && (
          <TabsContent value="restructures" className="mt-4">
            <Card className="border-slate-200 dark:border-slate-700/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Restructure History ({restructureHistory.length})
                </CardTitle>
                <CardDescription>
                  Previous and pending restructure requests for this loan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {restructureHistory.map((rs: any) => {
                    const statusColor = rs.status === 'approved'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50'
                      : rs.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-800/50'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';

                    return (
                      <div key={rs.id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={statusColor}>{rs.status}</Badge>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {rs.createdAt ? format(new Date(rs.createdAt), 'MMM dd, yyyy') : ''}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-xs">Balance at Request</span>
                            <div className="font-semibold">{formatCurrency(rs.originalBalance)}</div>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-xs">New Rate</span>
                            <div className="font-semibold">{(parseFloat(rs.newRate) * 100).toFixed(1)}%</div>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-xs">New Term</span>
                            <div className="font-semibold">{rs.newTerm} months</div>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-xs">New Payment</span>
                            <div className="font-semibold text-blue-600">{formatCurrency(rs.newMonthlyPayment)}</div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{rs.reason}</p>
                        {rs.rejectionReason && (
                          <p className="text-xs text-red-600 dark:text-red-400">Rejection: {rs.rejectionReason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
