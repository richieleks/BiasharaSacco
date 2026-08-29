import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Users, PiggyBank, Shield, Banknote, CreditCard, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRBAC } from "@/hooks/useRBAC";
import type { LoanType } from "@workspace/db";
import { createTsvRow, sanitizeTsvCell } from "@/lib/import-report";

interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulImports: number;
  failedRows?: number;
  skippedRows?: number;
  totalAmount?: number;
  failureBreakdown?: Record<string, number>;
  errors: Array<{
    row: number;
    category?: string;
    error: string;
    data?: any;
  }>;
  exceptions: Array<{
    sheet: string;
    type: string;
    detail: string;
    data?: any;
  }>;
  importedMembers: number;
  importedAccounts: number;
  importedLoans?: number;
  skippedDuplicates?: number;
  totalSheets?: number;
  processedSheets?: number;
  skippedSheets?: number;
}

const failureCategoryLabels: Record<string, string> = {
  invalid_row: 'Invalid row',
  transaction_rejected: 'Bank rejected',
  duplicate_reference: 'Duplicate reference',
  unmatched_member: 'Member not found',
  unmatched_loan: 'Loan not found',
  fully_paid_loan: 'Loan already paid',
  missing_savings_account: 'Savings account missing',
  processing_error: 'Processing error',
  file_error: 'File error',
};

export default function DataImport() {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'members' | 'savings' | 'loans' | 'loan-repayments' | 'bulk-savings'>('members');
  const [createNewMembers, setCreateNewMembers] = useState(true);
  const [updateExistingMembers, setUpdateExistingMembers] = useState(false);
  const [selectedLoanTypeId, setSelectedLoanTypeId] = useState<string>('');
  const [importProgress, setImportProgress] = useState(0);
  const [importStage, setImportStage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useRBAC();

  const { data: loanTypes } = useQuery<LoanType[]>({
    queryKey: ['/api/loan-types/active'],
    enabled: importType === 'loans' || importType === 'loan-repayments',
  });

  const canImportMembers = hasPermission('execute', 'import-members');
  const canImportSavings = hasPermission('execute', 'import-savings');
  const canImportLoans = hasPermission('execute', 'import-loans');
  const canImportLoanRepayments = hasPermission('execute', 'import-loan-repayments');
  const canImportBulkSavings = hasPermission('execute', 'import-bulk-savings');
  const canImport =
    canImportMembers ||
    canImportSavings ||
    canImportLoans ||
    canImportLoanRepayments ||
    canImportBulkSavings;

  const canDoCurrentImport =
    (importType === 'members' && canImportMembers) ||
    (importType === 'savings' && canImportSavings) ||
    (importType === 'loans' && canImportLoans) ||
    (importType === 'loan-repayments' && canImportLoanRepayments) ||
    (importType === 'bulk-savings' && canImportBulkSavings);

  useEffect(() => {
    if (!canImport) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to access the data import functionality.",
        variant: "destructive",
      });
      return;
    }
    if (!canDoCurrentImport) {
      const firstAllowed: typeof importType | null = canImportMembers
        ? 'members'
        : canImportSavings
        ? 'savings'
        : canImportLoans
        ? 'loans'
        : canImportLoanRepayments
        ? 'loan-repayments'
        : canImportBulkSavings
        ? 'bulk-savings'
        : null;
      if (firstAllowed) setImportType(firstAllowed);
    }
  }, [canImport, canDoCurrentImport, canImportMembers, canImportSavings, canImportLoans, canImportLoanRepayments, canImportBulkSavings, toast]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isImporting) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href]');
      if (target) {
        const href = target.getAttribute('href') || '';
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          e.preventDefault();
          e.stopPropagation();
          toast({
            title: "Import in Progress",
            description: "Please wait for the import to complete before navigating away.",
            variant: "destructive",
          });
        }
      }
    };
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      toast({
        title: "Import in Progress",
        description: "Please wait for the import to complete before navigating away.",
        variant: "destructive",
      });
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isImporting, toast]);

  const pollJobStatus = useCallback((jobId: string) => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    let failCount = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/import/status/${jobId}`, { credentials: 'include' });
        if (!response.ok) {
          failCount++;
          if (response.status === 404 || response.status === 403 || failCount > 30) {
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            setIsImporting(false);
            setImportStage('');
            setImportProgress(0);
            toast({ title: "Import Status Lost", description: "Could not retrieve import status. The import may still be running on the server.", variant: "destructive" });
          }
          return;
        }
        failCount = 0;
        const status = await response.json();
        setImportProgress(status.progress || 0);
        setImportStage(status.stage || 'Processing...');

        if (status.status === 'complete') {
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          setImportProgress(100);
          setImportStage('Complete!');
          setIsImporting(false);
          setImportResult(status.result);

          const data = status.result;
          if (data && data.success) {
            const successMessage = importType === 'members'
              ? `Successfully imported ${data.importedMembers} members and ${data.importedAccounts} savings accounts.`
              : importType === 'savings' 
              ? `Successfully imported ${data.importedMembers} members and ${data.importedAccounts} savings accounts.`
              : importType === 'loan-repayments'
              ? `Successfully processed ${data.successfulImports} loan repayments totaling UGX ${data.totalAmount?.toLocaleString() || 0}.`
              : importType === 'bulk-savings'
              ? `Successfully processed ${data.successfulImports} savings deposits totaling UGX ${data.totalAmount?.toLocaleString() || 0}.`
              : `Successfully imported ${data.importedLoans || 0} loan(s) from ${data.processedSheets || 1} of ${data.totalSheets || 1} sheet(s).`;
            toast({ title: "Import Successful", description: successMessage, variant: "success" });
          } else if (data) {
            toast({
              title: "Import Completed with Errors",
              description: `Imported ${data.successfulImports} records with ${data.errors?.length || 0} errors.`,
              variant: "destructive",
            });
          }

          queryClient.invalidateQueries({ queryKey: ['/api/members'] });
          queryClient.invalidateQueries({ queryKey: ['/api/savings-accounts'] });
          queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });

          setTimeout(() => { setImportProgress(0); setImportStage(''); }, 3000);
        } else if (status.status === 'error') {
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          setIsImporting(false);
          setImportStage('Failed');
          if (status.result) setImportResult(status.result);
          toast({ title: "Import Failed", description: status.error || "Unknown error occurred", variant: "destructive" });
          setImportProgress(0);
        }
      } catch {
        failCount++;
        if (failCount > 30) {
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          setIsImporting(false);
          setImportStage('');
          setImportProgress(0);
          toast({ title: "Connection Lost", description: "Lost connection while tracking import progress. The import may still be running on the server.", variant: "destructive" });
        }
      }
    };

    progressTimerRef.current = setInterval(poll, 2000);
    poll();
  }, [importType, toast, queryClient]);

  const downloadImportReport = useCallback(() => {
    if (!importResult) return;
    const lines: string[] = [];
    lines.push('BULK IMPORT FAILURE REPORT');
    lines.push(`Date: ${sanitizeTsvCell(new Date().toLocaleString())}`);
    lines.push(`File: ${sanitizeTsvCell(selectedFile?.name || 'Unknown')}`);
    lines.push(`Import Type: ${sanitizeTsvCell(importType)}`);
    lines.push('');
    lines.push('=== SUMMARY ===');
    lines.push(`Total Rows: ${importResult.totalRows}`);
    lines.push(`Successful Rows: ${importResult.successfulImports}`);
    lines.push(`Skipped Rows: ${importResult.skippedRows ?? 0}`);
    lines.push(`Failed Rows: ${importResult.failedRows ?? 0}`);
    if (importResult.totalAmount != null) lines.push(`Total Amount: UGX ${importResult.totalAmount.toLocaleString()}`);
    lines.push(`Total Sheets: ${importResult.totalSheets ?? 'N/A'}`);
    lines.push(`Processed: ${importResult.processedSheets ?? importResult.successfulImports}`);
    lines.push(`Skipped: ${importResult.skippedSheets ?? 0}`);
    lines.push(`Errors: ${importResult.errors?.length ?? 0}`);
    lines.push(`Exceptions: ${importResult.exceptions?.length ?? 0}`);
    lines.push('');

    if (importResult.failureBreakdown && Object.keys(importResult.failureBreakdown).length > 0) {
      lines.push('=== FAILURE BREAKDOWN ===');
      lines.push('Category\tCount');
      for (const [category, count] of Object.entries(importResult.failureBreakdown)) {
        lines.push(createTsvRow([category, count]));
      }
      lines.push('');
    }

    if (importResult.exceptions?.length > 0) {
      lines.push('=== EXCEPTIONS ===');
      lines.push('Sheet\tType\tDetail\tExtra Data');
      for (const ex of importResult.exceptions) {
        const extra = ex.data ? JSON.stringify(ex.data) : '';
        lines.push(createTsvRow([ex.sheet, ex.type, ex.detail, extra]));
      }
      lines.push('');
    }

    if (importResult.errors?.length > 0) {
      lines.push('=== ERRORS ===');
      lines.push('Row\tCategory\tError\tAccount\tReference\tAmount\tDescription\tData');
      for (const err of importResult.errors) {
        const extra = err.data ? JSON.stringify(err.data) : '';
        const data = err.data || {};
        lines.push(createTsvRow([
          err.row,
          err.category || 'processing_error',
          err.error,
          data.remitterAccount || data.account || '',
          data.reference || '',
          data.amount ?? '',
          data.description || '',
          extra,
        ]));
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-import-failure-report-${new Date().toISOString().slice(0, 10)}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [importResult, selectedFile, importType]);

  const importMutation = useMutation({
    mutationFn: async (): Promise<{ jobId: string }> => {
      if (!selectedFile) {
        throw new Error('Please select a file to import');
      }

      setIsImporting(true);
      setImportProgress(0);
      setImportStage('Uploading file...');
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('createNewMembers', createNewMembers.toString());
      if (importType === 'members') {
        formData.append('updateExisting', updateExistingMembers.toString());
      }
      if ((importType === 'loans' || importType === 'loan-repayments') && selectedLoanTypeId) {
        formData.append('loanTypeId', selectedLoanTypeId);
      }
      
      const endpoint = importType === 'members' ? '/api/import/members' 
        : importType === 'savings' ? '/api/import/savings' 
        : importType === 'loans' ? '/api/import/loans'
        : importType === 'loan-repayments' ? '/api/import/loan-repayments'
        : '/api/import/bulk-savings';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || `Import failed: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data: { jobId: string }) => {
      setImportStage('Processing...');
      setImportProgress(2);
      pollJobStatus(data.jobId);
    },
    onError: (error) => {
      setIsImporting(false);
      setImportProgress(0);
      setImportStage('');
      console.error("Import failed:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const isCsvImportType = importType === 'loan-repayments' || importType === 'bulk-savings';
  const isBulkTransactionImport = isCsvImportType;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const name = file.name.toLowerCase();
      if (isCsvImportType) {
        if (!name.endsWith('.csv')) {
          toast({
            title: "Invalid File Type",
            description: "Please select a CSV file (.csv)",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
          toast({
            title: "Invalid File Type",
            description: "Please select an Excel file (.xlsx or .xls)",
            variant: "destructive",
          });
          return;
        }
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to import",
        variant: "destructive",
      });
      return;
    }
    if (importType === 'loan-repayments' && !selectedLoanTypeId) {
      toast({
        title: "Loan Type Required",
        description: "Please select a loan type to apply repayments to",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate();
  };

  const handleReset = () => {
    setImportResult(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportTypeChange = (type: 'members' | 'savings' | 'loans' | 'loan-repayments' | 'bulk-savings') => {
    setImportType(type);
    setSelectedLoanTypeId('');
    handleReset();
  };

  const progressPercentage = importResult && importResult.totalRows > 0 ? 
    Math.round((importResult.successfulImports / importResult.totalRows) * 100) : 0;

  if (!canImport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Shield className="h-16 w-16 text-red-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Denied</h1>
        <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
          You don't have permission to import any type of data.
          Contact your system administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-container animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center flex-wrap gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Data Import
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 dark:border-amber-800/50">Admin Only</Badge>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Import customer data from Excel files</p>
      </div>

      {/* Import Type Selection */}
      <div className="section-card">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import Type</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Choose the type of data you want to import
          </p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {canImportMembers && (
              <button
                onClick={() => handleImportTypeChange('members')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  importType === 'members'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                data-testid="button-import-type-members"
              >
                <div className="flex items-center gap-3">
                  <Users className={`h-6 w-6 ${importType === 'members' ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500'}`} />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Members</div>
                    <div className="text-xs text-muted-foreground">Member registration data</div>
                  </div>
                </div>
              </button>
            )}

            {canImportSavings && (
              <button
                onClick={() => handleImportTypeChange('savings')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  importType === 'savings'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                data-testid="button-import-type-savings"
              >
                <div className="flex items-center gap-3">
                  <PiggyBank className={`h-6 w-6 ${importType === 'savings' ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500'}`} />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Savings Accounts</div>
                    <div className="text-xs text-muted-foreground">Savings statement data</div>
                  </div>
                </div>
              </button>
            )}

            {canImportLoans && (
              <button
                onClick={() => handleImportTypeChange('loans')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  importType === 'loans'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                data-testid="button-import-type-loans"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className={`h-6 w-6 ${importType === 'loans' ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500'}`} />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Loan Statements</div>
                    <div className="text-xs text-muted-foreground">Loan data and information</div>
                  </div>
                </div>
              </button>
            )}

            {canImportLoanRepayments && (
              <button
                onClick={() => handleImportTypeChange('loan-repayments')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  importType === 'loan-repayments'
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                data-testid="button-import-type-loan-repayments"
              >
                <div className="flex items-center gap-3">
                  <Banknote className={`h-6 w-6 ${importType === 'loan-repayments' ? 'text-green-600' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500'}`} />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Loan Repayments</div>
                    <div className="text-xs text-muted-foreground">Bulk CSV repayments</div>
                  </div>
                </div>
              </button>
            )}

            {canImportBulkSavings && (
              <button
                onClick={() => handleImportTypeChange('bulk-savings')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  importType === 'bulk-savings'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                data-testid="button-import-type-bulk-savings"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className={`h-6 w-6 ${importType === 'bulk-savings' ? 'text-emerald-600' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500'}`} />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Bulk Savings</div>
                    <div className="text-xs text-muted-foreground">CSV savings deposits</div>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Upload Card */}
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Excel File
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {importType === 'members'
                ? 'Select an Excel file containing member registration data'
                : importType === 'savings' 
                ? 'Select an Excel file containing customer savings account data'
                : importType === 'loan-repayments'
                ? 'Select a CSV file from the bank with loan repayment deductions'
                : importType === 'bulk-savings'
                ? 'Select a CSV file from the bank with savings deposit deductions'
                : 'Select an Excel file containing loan statement data'
              }
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select {isCsvImportType ? 'CSV' : 'Excel'} File</Label>
              <Input
                id="file-upload"
                type="file"
                accept={isCsvImportType ? '.csv' : '.xlsx,.xls'}
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                {isCsvImportType ? 'Supported format: .csv (bank statement export)' : 'Supported formats: .xlsx, .xls'}
              </p>
            </div>
            
            {selectedFile && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="font-medium text-blue-900">{selectedFile.name}</div>
                    <div className="text-sm text-blue-600">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Ready for import
                    </div>
                  </div>
                </div>
              </div>
            )}

            {importType === 'members' && (
              <div className="flex items-start space-x-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <Checkbox
                  id="updateExistingMembers"
                  checked={updateExistingMembers}
                  onCheckedChange={(checked) => setUpdateExistingMembers(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="updateExistingMembers" className="text-sm font-medium cursor-pointer">
                    Update existing members
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {updateExistingMembers 
                      ? "Existing members (matched by ID number) will have their details updated from the file."
                      : "Existing members will be skipped. Only new members will be imported."
                    }
                  </p>
                </div>
              </div>
            )}

            {importType === 'savings' && (
              <div className="flex items-start space-x-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <Checkbox
                  id="createNewMembers"
                  checked={createNewMembers}
                  onCheckedChange={(checked) => setCreateNewMembers(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="createNewMembers" className="text-sm font-medium cursor-pointer">
                    Create new members automatically
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {createNewMembers 
                      ? "New member profiles will be created for accounts not found in the system."
                      : "Only existing members will be matched. Accounts without a matching member will be skipped."
                    }
                  </p>
                </div>
              </div>
            )}

            {(importType === 'loans' || importType === 'loan-repayments') && (
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <Label htmlFor="loanType" className="text-sm font-medium">
                  Loan Type {importType === 'loan-repayments' && <span className="text-red-500">*</span>}
                  {importType === 'loans' && <span className="text-muted-foreground text-xs ml-1">(optional fallback)</span>}
                </Label>
                <Select value={selectedLoanTypeId} onValueChange={setSelectedLoanTypeId}>
                  <SelectTrigger id="loanType">
                    <SelectValue placeholder={importType === 'loan-repayments' 
                      ? "Select loan type to apply repayments to" 
                      : "Auto-detect from details (or select fallback)"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loanTypes && loanTypes.length > 0 ? (
                      loanTypes.map((lt) => (
                        <SelectItem key={lt.id} value={lt.id.toString()}>
                          {lt.displayName} ({lt.interestRate}% - {lt.interestType?.replace('_', ' ')})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No active loan types available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {importType === 'loan-repayments' 
                    ? "Repayments will only be applied to active loans of this type. Members without a matching loan will be skipped."
                    : "Loan types are auto-detected from the transaction details column (e.g. \"Top Up\", \"Special Loan\", \"Emergency\"). Select a type here only as a fallback if detection fails. Values are imported as-is from the Excel without recalculation."}
                </p>
              </div>
            )}

            {/* Import Button */}
            <Button 
              onClick={handleImport}
              disabled={isImporting || importMutation.isPending || !selectedFile || !canDoCurrentImport || (importType === 'loan-repayments' && !selectedLoanTypeId)}
              className="w-full rounded-xl"
            >
              {isImporting || importMutation.isPending ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Importing Data...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Start Import
                </>
              )}
            </Button>

            {(isImporting || importProgress > 0) && (
              <div className="space-y-2 mt-4">
                <Progress value={importProgress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{importStage}</span>
                  <span>{Math.round(importProgress)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions Card */}
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Import Instructions
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Follow these guidelines for successful data import
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <h4 className="font-medium mb-2">
                {importType === 'members' ? 'Members Import Format:' 
                  : importType === 'savings' ? 'Savings Import Format:' 
                  : importType === 'loan-repayments' ? 'Loan Repayments CSV Format:'
                  : importType === 'bulk-savings' ? 'Bulk Savings CSV Format:'
                  : 'Loan Import Format:'}
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {importType === 'members' ? (
                  <>
                    <li>• Column headers in the first row</li>
                    <li>• Name, ID Number, Date of Birth, Gender</li>
                    <li>• Address, Phone, Marital Status</li>
                    <li>• Department, Section, Terms of Service</li>
                    <li>• Net Pay, Staff Account, Next of Kin</li>
                    <li>• Monthly Savings, Account Number, Branch</li>
                    <li>• Shares, Beneficiary details</li>
                  </>
                ) : importType === 'savings' ? (
                  <>
                    <li>• Column headers in the first row</li>
                    <li>• Full Name, ID Number, Phone Number</li>
                    <li>• Email, Department (optional)</li>
                    <li>• Account Balance, Account Type</li>
                  </>
                ) : importType === 'loan-repayments' || importType === 'bulk-savings' ? (
                  <>
                    <li>• Bank statement CSV export format</li>
                    <li>• Row 1: Title/header (skipped)</li>
                    <li>• Row 2: Column headers (Line, Request Type, etc.)</li>
                    <li>• Key columns: Remitter Account (col 11), Transaction Amount (col 10)</li>
                    <li>• Transaction Reference (col 8), Payment Details (col 12)</li>
                    <li>• Only "Success" transactions are processed</li>
                  </>
                ) : (
                  <>
                    <li>• Account Name and Number in header rows</li>
                    <li>• Transaction history with posting dates</li>
                    <li>• Details, amounts, principal, interest columns</li>
                    <li>• Balance tracking throughout statement</li>
                  </>
                )}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">What happens during import:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {importType === 'members' ? (
                  <>
                    <li>• New member profiles are created from each row</li>
                    <li>• Duplicates detected by ID, Staff Account, or Bank Account</li>
                    <li>• Savings accounts created for members with deposit amounts</li>
                    <li>• Member numbers assigned automatically (BCS prefix)</li>
                  </>
                ) : importType === 'savings' ? (
                  <>
                    <li>• New member profiles are created automatically</li>
                    <li>• Savings accounts are set up with imported balances</li>
                    <li>• Duplicate ID numbers are automatically handled</li>
                    <li>• Invalid data rows are reported for review</li>
                  </>
                ) : importType === 'loan-repayments' ? (
                  <>
                    <li>• Members are matched by Remitter Account (staff account or bank account)</li>
                    <li>• Payment is applied to the member's first active loan</li>
                    <li>• Outstanding balance is reduced by the repayment amount</li>
                    <li>• Loans fully paid off are automatically marked as completed</li>
                    <li>• Duplicate references are skipped to prevent double-posting</li>
                  </>
                ) : importType === 'bulk-savings' ? (
                  <>
                    <li>• Members are matched by Remitter Account (staff account or bank account)</li>
                    <li>• Amount is deposited into the member's regular savings account</li>
                    <li>• Savings account balance is updated automatically</li>
                    <li>• Duplicate references are skipped to prevent double-posting</li>
                    <li>• Unmatched accounts are reported for review</li>
                  </>
                ) : (
                  <>
                    <li>• Loans are matched to existing members by account number or name</li>
                    <li>• A loan type must be selected before uploading</li>
                    <li>• Loan records are created with the selected type's settings</li>
                    <li>• Members must be imported first if they don't exist</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Import Results */}
      {importResult && (
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              Import Results
            </h3>
             <div className="flex items-center justify-between gap-3">
               <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                 {isBulkTransactionImport ? 'Detailed results for the uploaded bank transaction file' : 'Results from importing savings account data'}
               </p>
               {isBulkTransactionImport && (
                 <Button variant="outline" size="sm" onClick={downloadImportReport} className="gap-1.5 text-xs shrink-0">
                   <Download className="h-3.5 w-3.5" />
                   Download Report
                 </Button>
               )}
             </div>
          </div>
          <div className="p-6 space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
              <span className="text-xs text-muted-foreground">
                {importResult.successfulImports} of {importResult.totalRows} records processed successfully
              </span>
            </div>

             {/* Statistics Cards */}
             {isBulkTransactionImport ? (
               <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
                 <div className="text-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-blue-600">{importResult.totalRows}</div>
                   <div className="text-xs sm:text-sm text-blue-600">Total Rows</div>
                 </div>
                 <div className="text-center p-3 sm:p-4 bg-green-50 dark:bg-green-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-green-600">{importResult.successfulImports}</div>
                   <div className="text-xs sm:text-sm text-green-600">Successful</div>
                 </div>
                 <div className="text-center p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-amber-600">{importResult.skippedRows ?? 0}</div>
                   <div className="text-xs sm:text-sm text-amber-600">Skipped</div>
                 </div>
                 <div className="text-center p-3 sm:p-4 bg-red-50 dark:bg-red-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-red-600">{importResult.failedRows ?? 0}</div>
                   <div className="text-xs sm:text-sm text-red-600">Failed</div>
                 </div>
                 <div className="text-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-purple-600">UGX {(importResult.totalAmount ?? 0).toLocaleString()}</div>
                   <div className="text-xs sm:text-sm text-purple-600">Imported Amount</div>
                 </div>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
                 <div className="text-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-blue-600">{importResult.totalRows}</div>
                   <div className="text-xs sm:text-sm text-blue-600">Total Rows</div>
                 </div>
                 <div className="text-center p-3 sm:p-4 bg-green-50 dark:bg-green-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-green-600">{importResult.importedMembers}</div>
                   <div className="text-xs sm:text-sm text-green-600">New Members</div>
                 </div>
                 <div className="text-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-purple-600">{importResult.importedAccounts}</div>
                   <div className="text-xs sm:text-sm text-purple-600">Savings Accounts</div>
                 </div>
                 <div className="text-center p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-amber-600">{importResult.skippedDuplicates || 0}</div>
                   <div className="text-xs sm:text-sm text-amber-600">Duplicates Skipped</div>
                 </div>
                 <div className="text-center p-3 sm:p-4 bg-red-50 dark:bg-red-950/50 rounded-lg">
                   <div className="text-lg sm:text-2xl font-bold text-red-600">{(importResult.errors?.length || 0) - (importResult.skippedDuplicates || 0)}</div>
                   <div className="text-xs sm:text-sm text-red-600">Other Errors</div>
                 </div>
               </div>
             )}

             {isBulkTransactionImport && importResult.failureBreakdown && Object.keys(importResult.failureBreakdown).length > 0 && (
               <div className="flex flex-wrap items-center gap-2 text-xs">
                 <span className="font-medium text-slate-600 dark:text-slate-300">Failure breakdown:</span>
                 {Object.entries(importResult.failureBreakdown).map(([category, count]) => (
                   <Badge key={category} variant="outline">
                     {failureCategoryLabels[category] || category}: {count}
                   </Badge>
                 ))}
               </div>
             )}

            {importResult.totalSheets != null && (
              <div className="space-y-2">
                <Separator />
                <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Sheets Summary
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-lg font-bold">{importResult.totalSheets}</div>
                    <div className="text-xs text-muted-foreground">Total Sheets</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 dark:bg-green-950/50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">{importResult.processedSheets || 0}</div>
                    <div className="text-xs text-green-600">Processed</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-lg font-bold text-gray-500">{importResult.skippedSheets || 0}</div>
                    <div className="text-xs text-gray-500">Skipped</div>
                  </div>
                </div>
              </div>
            )}

            {importResult.exceptions && importResult.exceptions.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-orange-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Exceptions Report ({importResult.exceptions.length})
                  </h4>
                   <Button variant="outline" size="sm" onClick={downloadImportReport} className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Download Report
                  </Button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {importResult.exceptions.map((ex, index) => {
                     const typeLabels: Record<string, string> = {
                       skipped_empty: 'Empty Sheet',
                       skipped_no_structure: 'Invalid Structure',
                       skipped_no_account_name: 'Missing Account Name',
                       skipped_no_account_number: 'Missing Account Number',
                       processing_error: 'Processing Error',
                     };
                    const isError = ex.type === 'processing_error';
                    return (
                      <Alert key={index} className={isError ? '!border-red-300 dark:!border-red-700 !bg-red-50 dark:!bg-red-950/50' : '!border-orange-300 dark:!border-orange-700 !bg-orange-50 dark:!bg-orange-950/50'}>
                        <AlertDescription className={isError ? 'text-red-900 dark:text-red-300' : 'text-orange-900 dark:text-orange-300'}>
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className={`shrink-0 text-xs ${isError ? 'border-red-400 text-red-700 dark:text-red-300' : 'border-orange-400 text-orange-700 dark:text-orange-300'}`}>
                              {typeLabels[ex.type] || ex.type}
                            </Badge>
                            <div>
                              <strong>Sheet: {ex.sheet}</strong> — {ex.detail}
                              {ex.data?.accountName && <span className="ml-1 text-xs opacity-75">({ex.data.accountName})</span>}
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Errors List */}
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <h4 className="font-medium text-red-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Import Errors ({importResult.errors?.length || 0})
                </h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {(importResult.errors || []).map((error, index) => {
                    const isDuplicate = error.error?.includes('Duplicate') || error.error?.includes('already exists');
                    const isMissing = error.error?.includes('Missing');
                    return (
                      <Alert key={index} variant="destructive" className={isDuplicate ? '!border-amber-300 dark:!border-amber-700 !bg-amber-50 dark:!bg-amber-950/50 !text-amber-900 dark:!text-amber-300' : isMissing ? '!border-orange-300 dark:!border-orange-700 !bg-orange-50 dark:!bg-orange-950/50 !text-orange-900 dark:!text-orange-300' : ''}>
                        <AlertDescription>
                           <strong>Row {error.row}:</strong>{' '}
                           {error.category && (
                             <Badge variant="outline" className="mr-1 text-xs">
                               {failureCategoryLabels[error.category] || error.category}
                             </Badge>
                           )}
                           {error.error}
                           {error.data && (
                             <div className="mt-1 text-xs opacity-80">
                               {error.data.remitterAccount && <>Account: {error.data.remitterAccount} </>}
                               {error.data.reference && <>• Reference: {error.data.reference} </>}
                               {error.data.amount != null && <>• Amount: {error.data.amount}</>}
                             </div>
                           )}
                          {error.data?.matchedField && (
                            <span className="ml-1 text-xs font-medium px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-800 dark:text-amber-300">
                              matched by: {error.data.matchedField === 'idNumber' ? 'ID Number' : error.data.matchedField === 'staffAccountNumber' ? 'Staff Account' : 'Bank Account'}
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
