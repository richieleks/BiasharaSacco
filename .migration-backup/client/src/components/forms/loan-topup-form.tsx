import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpCircle, Loader2, AlertCircle, Info, FileText, Plus, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import GuarantorForm from "./guarantor-form";
import GuarantorList from "../guarantor/guarantor-list";
import LoanDocumentUpload from "./loan-document-upload";
import type { LoanTypeWithTerms } from "@shared/schema";

const topUpSchema = z.object({
  originalLoanId: z.string().min(1, "Select a loan to top up"),
  topUpAmount: z.string().min(1, "Additional amount is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  termMonths: z.string().min(1, "Term is required"),
  loanType: z.string().optional(),
  purpose: z.string().min(1, "Purpose is required"),
});

type TopUpFormData = z.infer<typeof topUpSchema>;

interface LoanTopUpFormProps {
  onSuccess: () => void;
}

export default function LoanTopUpForm({ onSuccess }: LoanTopUpFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [currentLoanId, setCurrentLoanId] = useState<number | null>(null);
  const [showGuarantorForm, setShowGuarantorForm] = useState(false);
  const [savedTopUpPrincipal, setSavedTopUpPrincipal] = useState(0);
  const [applicationStep, setApplicationStep] = useState<'documents' | 'guarantors' | 'complete'>('documents');

  const { data: activeLoans = [], isLoading: loadingLoans } = useQuery<any[]>({
    queryKey: ['/api/loans/active-for-topup'],
  });

  const { data: loanGuarantors = [] } = useQuery<any[]>({
    queryKey: ['/api/guarantors/loan', currentLoanId],
    queryFn: async () => {
      const res = await fetch(`/api/guarantors/loan/${currentLoanId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentLoanId,
  });

  const { data: loanTypes = [] } = useQuery<LoanTypeWithTerms[]>({
    queryKey: ['/api/loan-types/active'],
    queryFn: async () => {
      const response = await fetch('/api/loan-types/active');
      if (!response.ok) throw new Error('Failed to fetch loan types');
      return response.json();
    },
  });

  const { data: savingsAccounts = [] } = useQuery<any[]>({
    queryKey: ['/api/savings/my-accounts'],
  });

  const { data: systemConfig } = useQuery<any>({
    queryKey: ['/api/system/settings/public'],
  });

  const loanToSavingsRatio = systemConfig?.loanToSavingsRatio || 2.5;
  const activeSavings = savingsAccounts.find((acc: any) => acc.status === 'active');
  const totalSavingsBalance = activeSavings ? parseFloat(activeSavings.balance || '0') : 0;
  const maxLoanBySavings = totalSavingsBalance * loanToSavingsRatio;

  const form = useForm<TopUpFormData>({
    resolver: zodResolver(topUpSchema),
    defaultValues: {
      originalLoanId: "",
      topUpAmount: "",
      interestRate: "12.00",
      termMonths: "12",
      loanType: "",
      purpose: "",
    },
  });

  const selectedLoanId = form.watch('originalLoanId');
  const selectedLoan = activeLoans.find((l: any) => l.id.toString() === selectedLoanId);
  const matchedLoanType = selectedLoan ? loanTypes.find(lt => lt.name === selectedLoan.loanType) : null;
  const minRepaymentsRequired = matchedLoanType?.minRepaymentsForTopUp ?? 3;

  const loanTypeMinAmount = parseFloat(matchedLoanType?.minAmount || '0');
  const loanTypeMaxAmount = parseFloat(matchedLoanType?.maxAmount || '0');
  const loanTypeMinTerm = matchedLoanType?.minTerm || 1;
  const loanTypeMaxTerm = matchedLoanType?.maxTerm || 60;
  const loanTypeInterestRate = matchedLoanType?.interestRate || '12.00';
  const outstandingBalance = selectedLoan ? parseFloat(selectedLoan.outstandingBalance || '0') : 0;
  const maxTopUpAmount = loanTypeMaxAmount > 0 ? Math.max(0, loanTypeMaxAmount - outstandingBalance) : 0;

  useEffect(() => {
    if (selectedLoan) {
      form.setValue('loanType', selectedLoan.loanType || '');
      if (matchedLoanType) {
        form.setValue('interestRate', loanTypeInterestRate.toString());
        const currentTerm = parseInt(form.getValues('termMonths') || '0');
        if (currentTerm < loanTypeMinTerm || currentTerm > loanTypeMaxTerm) {
          form.setValue('termMonths', loanTypeMaxTerm.toString());
        }
        const effectiveMaxTopUp = loanTypeMaxAmount > 0 ? Math.max(0, loanTypeMaxAmount - outstandingBalance) : 0;
        if (effectiveMaxTopUp > 0) {
          const savingsLimit = totalSavingsBalance * loanToSavingsRatio;
          const maxBySavings = savingsLimit > 0 ? Math.max(0, savingsLimit - outstandingBalance) : effectiveMaxTopUp;
          const defaultAmount = Math.floor(Math.min(effectiveMaxTopUp, maxBySavings));
          form.setValue('topUpAmount', defaultAmount > 0 ? defaultAmount.toString() : '');
        }
      }
    }
  }, [selectedLoanId, matchedLoanType, loanTypeInterestRate, loanTypeMinTerm, loanTypeMaxTerm, loanTypeMaxAmount, outstandingBalance, totalSavingsBalance, loanToSavingsRatio, form]);

  const topUpAmount = parseFloat(form.watch('topUpAmount') || '0');
  const totalNewPrincipal = outstandingBalance + topUpAmount;
  const annualRate = parseFloat(form.watch('interestRate') || '0');
  const termMonths = parseInt(form.watch('termMonths') || '0');

  useEffect(() => {
    if (!matchedLoanType || !selectedLoan) {
      setValidationErrors([]);
      return;
    }

    const errors: string[] = [];

    if (topUpAmount > 0) {
      if (maxTopUpAmount > 0 && topUpAmount > maxTopUpAmount) {
        errors.push(`Top-up amount (${formatCurrency(topUpAmount)}) exceeds the maximum allowed of ${formatCurrency(maxTopUpAmount)} (loan limit ${formatCurrency(loanTypeMaxAmount)} minus outstanding balance ${formatCurrency(outstandingBalance)})`);
      }
      if (loanTypeMinAmount > 0 && totalNewPrincipal < loanTypeMinAmount) {
        errors.push(`Total loan amount (${formatCurrency(totalNewPrincipal)}) is below the minimum of ${formatCurrency(loanTypeMinAmount)} for this loan type`);
      }
      if (maxLoanBySavings > 0 && totalNewPrincipal > maxLoanBySavings) {
        errors.push(`Total loan amount (${formatCurrency(totalNewPrincipal)}) exceeds your savings-based limit of ${formatCurrency(maxLoanBySavings)} (${loanToSavingsRatio}x your savings of ${formatCurrency(totalSavingsBalance)})`);
      }
    }

    if (termMonths > 0) {
      if (termMonths < loanTypeMinTerm) {
        errors.push(`Repayment period (${termMonths} months) is below the minimum of ${loanTypeMinTerm} months`);
      }
      if (termMonths > loanTypeMaxTerm) {
        errors.push(`Repayment period (${termMonths} months) exceeds the maximum of ${loanTypeMaxTerm} months`);
      }
    }

    setValidationErrors(errors);
    if (errors.length > 0) setServerErrors([]);
  }, [topUpAmount, totalNewPrincipal, termMonths, matchedLoanType, selectedLoan, loanTypeMinAmount, loanTypeMaxAmount, loanTypeMinTerm, loanTypeMaxTerm, maxTopUpAmount, outstandingBalance, maxLoanBySavings, loanToSavingsRatio, totalSavingsBalance]);

  const calculateMonthlyPayment = () => {
    if (totalNewPrincipal <= 0 || annualRate <= 0 || termMonths <= 0) return 0;

    const interestMethod = matchedLoanType?.interestType || 'reducing_balance';
    const decimalRate = annualRate / 100;
    const timeInYears = termMonths / 12;

    switch (interestMethod) {
      case 'simple': {
        const totalInterest = totalNewPrincipal * decimalRate * timeInYears;
        return (totalNewPrincipal + totalInterest) / termMonths;
      }
      case 'compound': {
        const compFreq = matchedLoanType?.compoundingFrequency || 'monthly';
        let n = 12;
        if (compFreq === 'quarterly') n = 4;
        if (compFreq === 'annually') n = 1;
        const compoundAmount = totalNewPrincipal * Math.pow(1 + decimalRate / n, n * timeInYears);
        return compoundAmount / termMonths;
      }
      case 'reducing_balance':
      default: {
        const monthlyRate = decimalRate / 12;
        return (totalNewPrincipal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
      }
    }
  };

  const monthlyPayment = calculateMonthlyPayment();

  const mutation = useMutation({
    mutationFn: async (data: TopUpFormData) => {
      const response = await apiRequest('POST', '/api/loans/topup', {
        originalLoanId: parseInt(data.originalLoanId),
        topUpAmount: data.topUpAmount,
        loanType: data.loanType,
        interestRate: data.interestRate,
        termMonths: parseInt(data.termMonths),
        purpose: data.purpose,
      });
      return response;
    },
    onSuccess: async (response: any) => {
      const loanData = await response.json();
      setServerErrors([]);
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/my-loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/active-for-topup'] });

      const requiresGuarantor = matchedLoanType?.requiresGuarantor ?? matchedLoanType?.requires_guarantor ?? true;
      const savingsCoverLoan = totalSavingsBalance >= totalNewPrincipal && totalNewPrincipal > 0;
      const needsGuarantors = requiresGuarantor && !savingsCoverLoan;

      if (loanData?.id) {
        setCurrentLoanId(loanData.id);
        setSavedTopUpPrincipal(totalNewPrincipal);
        setApplicationStep('documents');
        toast({ title: "Top-Up Application Created",
          description: "Please upload the required documents to proceed.", variant: "success" });
      } else {
        toast({ title: "Success",
          description: "Loan top-up application submitted successfully.", variant: "success" });
        form.reset();
        onSuccess();
      }
    },
    onError: async (error: any) => {
      const errors: string[] = [];
      try {
        if (error.message) {
          const parts = error.message.split(': ');
          if (parts.length > 1) {
            const errorData = JSON.parse(parts.slice(1).join(': '));
            if (errorData.violations && Array.isArray(errorData.violations)) {
              errors.push(...errorData.violations);
            }
            if (errorData.message) {
              errors.push(errorData.message);
            }
          } else {
            errors.push(error.message);
          }
        }
      } catch {
        errors.push(error.message || "Failed to submit top-up application");
      }
      setServerErrors(errors.length > 0 ? errors : ["Failed to submit top-up application"]);
    },
  });

  const handleSubmit = (data: TopUpFormData) => {
    if (validationErrors.length > 0) return;
    setServerErrors([]);
    mutation.mutate(data);
  };

  if (loadingLoans) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-slate-500" />
        <span className="ml-2 text-slate-500 dark:text-slate-400">Loading your active loans...</span>
      </div>
    );
  }

  if (currentLoanId) {
    const requiresGuarantor = matchedLoanType?.requiresGuarantor ?? matchedLoanType?.requires_guarantor ?? true;
    const savingsCoverLoan = totalSavingsBalance >= savedTopUpPrincipal && savedTopUpPrincipal > 0;
    const needsGuarantors = requiresGuarantor && !savingsCoverLoan;

    const steps = [
      { key: 'documents', label: 'Upload Documents' },
      ...(needsGuarantors ? [{ key: 'guarantors', label: 'Add Guarantors' }] : []),
      { key: 'complete', label: 'Complete' },
    ];
    const currentStepIndex = steps.findIndex(s => s.key === applicationStep);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Top-Up Application Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-1 mb-6">
              {steps.map((step, idx) => (
                <div key={step.key} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    idx < currentStepIndex ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                    idx === currentStepIndex ? 'bg-primary text-primary-foreground' :
                    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {idx < currentStepIndex ? <CheckCircle className="h-3.5 w-3.5" /> : null}
                    <span>{step.label}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-6 h-0.5 ${idx < currentStepIndex ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              ))}
            </div>

            {applicationStep === 'documents' && (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Your top-up application has been created. Please upload the required documents to proceed.
                </p>
                <LoanDocumentUpload
                  loanId={currentLoanId}
                  guarantors={needsGuarantors ? loanGuarantors : []}
                  requiresGuarantors={false}
                  onComplete={() => {
                    if (needsGuarantors) {
                      setApplicationStep('guarantors');
                    } else {
                      setApplicationStep('complete');
                    }
                  }}
                />
              </>
            )}

            {applicationStep === 'guarantors' && needsGuarantors && (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Documents uploaded. Now add guarantors since your savings ({formatCurrency(totalSavingsBalance)}) do not fully cover the loan amount ({formatCurrency(savedTopUpPrincipal)}).
                </p>
                <GuarantorList loanId={currentLoanId} />
                <div className="mt-4">
                  {!showGuarantorForm ? (
                    <Button onClick={() => setShowGuarantorForm(true)} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Guarantor
                    </Button>
                  ) : (
                    <GuarantorForm
                      loanId={currentLoanId}
                      onSuccess={() => {
                        setShowGuarantorForm(false);
                        queryClient.invalidateQueries({ queryKey: ['/api/guarantors/loan', currentLoanId] });
                      }}
                      onCancel={() => setShowGuarantorForm(false)}
                    />
                  )}
                </div>
                {loanGuarantors.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-sm mb-2">Guarantor Documents (optional)</h4>
                      <LoanDocumentUpload
                        loanId={currentLoanId}
                        guarantors={loanGuarantors}
                        requiresGuarantors={true}
                      />
                    </div>
                  </div>
                )}
                <Button
                  className="w-full mt-4"
                  onClick={() => setApplicationStep('complete')}
                >
                  Complete Application
                </Button>
              </>
            )}

            {applicationStep === 'complete' && (
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Application Complete
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {needsGuarantors
                    ? "Your top-up application with documents and guarantors has been submitted. It will go through the standard approval process."
                    : "Your top-up application with documents has been submitted. It is now ready for review by the loan committee."}
                </p>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setCurrentLoanId(null);
                setApplicationStep('documents');
                form.reset();
                onSuccess();
              }}
              className="w-full mt-4"
            >
              Return to Loans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeLoans.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Eligible Loans</h3>
          <p className="text-slate-500 dark:text-slate-400">
            You don't have any active or disbursed loans that can be topped up.
            Only loans with an active status are eligible for a top-up.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpCircle className="h-5 w-5" />
          Loan Top-Up Application
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Request additional funds on an existing active loan. The outstanding balance will be combined with the new amount into a single loan.
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="originalLoanId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Loan to Top Up</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an active loan..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeLoans.map((loan: any) => (
                        <SelectItem key={loan.id} value={loan.id.toString()}>
                          {loan.loanNumber} - {loan.loanType} - Outstanding: {formatCurrency(loan.outstandingBalance || '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedLoan && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                <h4 className="font-medium text-sm text-blue-800 dark:text-blue-300">Current Loan Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-blue-600">Loan Number:</span>
                    <span className="ml-1 font-medium text-blue-900">{selectedLoan.loanNumber}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Type:</span>
                    <span className="ml-1 font-medium text-blue-900 capitalize">{selectedLoan.loanType}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Original Amount:</span>
                    <span className="ml-1 font-medium text-blue-900">{formatCurrency(selectedLoan.principalAmount || '0')}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Outstanding Balance:</span>
                    <span className="ml-1 font-medium text-blue-900">{formatCurrency(outstandingBalance)}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Interest Rate:</span>
                    <span className="ml-1 font-medium text-blue-900">{(parseFloat(selectedLoan.interestRate || '0') * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Status:</span>
                    <span className="ml-1 font-medium text-blue-900 capitalize">{selectedLoan.status}</span>
                  </div>
                </div>
                {minRepaymentsRequired > 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800 text-sm text-blue-700">
                    <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                    This loan type requires at least <strong>{minRepaymentsRequired}</strong> repayment(s) before a top-up can be requested.
                  </div>
                )}
              </div>
            )}

            {matchedLoanType && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                <h4 className="font-medium text-sm text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Loan Type Rules ({matchedLoanType.displayName || matchedLoanType.name})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Interest Rate:</span>
                    <span className="ml-1 font-medium text-slate-800 dark:text-slate-200">{parseFloat(loanTypeInterestRate).toFixed(1)}% p.a.</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Term Range:</span>
                    <span className="ml-1 font-medium text-slate-800 dark:text-slate-200">{loanTypeMinTerm} - {loanTypeMaxTerm} months</span>
                  </div>
                  {loanTypeMinAmount > 0 && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Min Amount:</span>
                      <span className="ml-1 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(loanTypeMinAmount)}</span>
                    </div>
                  )}
                  {loanTypeMaxAmount > 0 && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Max Loan Amount:</span>
                      <span className="ml-1 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(loanTypeMaxAmount)}</span>
                    </div>
                  )}
                  {maxTopUpAmount > 0 && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Max Top-Up Amount:</span>
                      <span className="ml-1 font-bold text-emerald-700">{formatCurrency(maxTopUpAmount)}</span>
                    </div>
                  )}
                  {loanTypeMaxAmount > 0 && maxTopUpAmount <= 0 && (
                    <div className="sm:col-span-2 text-amber-700 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                      Outstanding balance already meets or exceeds the loan limit. No top-up available.
                    </div>
                  )}
                  {matchedLoanType.interestType && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Interest Method:</span>
                      <span className="ml-1 font-medium text-slate-800 dark:text-slate-200 capitalize">{matchedLoanType.interestType.replace('_', ' ')}</span>
                    </div>
                  )}
                  {totalSavingsBalance > 0 && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Savings-Based Limit:</span>
                      <span className="ml-1 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(maxLoanBySavings)} ({loanToSavingsRatio}x savings)</span>
                    </div>
                  )}
                  {matchedLoanType.processingFee && parseFloat(matchedLoanType.processingFee) > 0 && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Processing Fee:</span>
                      <span className="ml-1 font-medium text-slate-800 dark:text-slate-200">{parseFloat(matchedLoanType.processingFee).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="topUpAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Amount (UGX)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter additional amount"
                      min={1}
                      max={maxTopUpAmount > 0 ? maxTopUpAmount : undefined}
                      {...field}
                    />
                  </FormControl>
                  {matchedLoanType && (
                    <p className="text-xs text-muted-foreground">
                      {loanTypeMaxAmount > 0
                        ? `Maximum top-up amount: ${formatCurrency(maxTopUpAmount)} (loan limit ${formatCurrency(loanTypeMaxAmount)} - outstanding ${formatCurrency(outstandingBalance)})`
                        : 'No maximum amount limit for this loan type'}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {validationErrors.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/50 border-2 border-red-400 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <h4 className="font-semibold text-red-700 text-sm">Validation Errors</h4>
                </div>
                <ul className="list-disc pl-6 space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i} className="text-sm text-red-700 font-medium">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {serverErrors.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/50 border-2 border-red-400 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <h4 className="font-semibold text-red-700 text-sm">Submission Errors</h4>
                </div>
                <ul className="list-disc pl-6 space-y-1">
                  {serverErrors.map((error, i) => (
                    <li key={i} className="text-sm text-red-700 font-medium">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedLoan && topUpAmount > 0 && validationErrors.length === 0 && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 rounded-lg space-y-2">
                <h4 className="font-medium text-sm text-emerald-800">New Loan Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-emerald-600">Outstanding Balance:</span>
                    <span className="ml-1 font-medium text-emerald-900">{formatCurrency(outstandingBalance)}</span>
                  </div>
                  <div>
                    <span className="text-emerald-600">Additional Amount:</span>
                    <span className="ml-1 font-medium text-emerald-900">{formatCurrency(topUpAmount)}</span>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-emerald-200">
                    <span className="text-emerald-700 font-semibold">Total New Loan:</span>
                    <span className="ml-1 font-bold text-emerald-900 text-lg">{formatCurrency(totalNewPrincipal)}</span>
                  </div>
                  {monthlyPayment > 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-emerald-600">Estimated Monthly Payment:</span>
                      <span className="ml-1 font-medium text-emerald-900">{formatCurrency(monthlyPayment)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} readOnly disabled className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Set by loan type, cannot be changed</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="termMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repayment Period (Months)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={loanTypeMinTerm}
                        max={loanTypeMaxTerm}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {loanTypeMinTerm} to {loanTypeMaxTerm} months
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose of Top-Up</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain why you need additional funds..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300 text-sm">
                Your current loan will be settled and replaced by a new loan for the combined total amount.
                The top-up request will go through the standard approval process before disbursement.
              </AlertDescription>
            </Alert>

            <Button
              type="submit"
              className="w-full sacco-gradient text-white hover:opacity-90"
              disabled={mutation.isPending || !selectedLoan || validationErrors.length > 0}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  Submit Top-Up Request
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
