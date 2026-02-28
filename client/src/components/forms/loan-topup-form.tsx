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
import { ArrowUpCircle, Loader2, AlertCircle, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
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

  const { data: activeLoans = [], isLoading: loadingLoans } = useQuery<any[]>({
    queryKey: ['/api/loans/active-for-topup'],
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
      }
    }
  }, [selectedLoan, matchedLoanType, loanTypeInterestRate, loanTypeMinTerm, loanTypeMaxTerm, form]);

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
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Loan top-up application submitted successfully. It will go through the standard approval process.",
      });
      setServerErrors([]);
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/my-loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/active-for-topup'] });
      form.reset();
      onSuccess();
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
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500">Loading your active loans...</span>
      </div>
    );
  }

  if (activeLoans.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Eligible Loans</h3>
          <p className="text-slate-500">
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
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <h4 className="font-medium text-sm text-blue-800">Current Loan Details</h4>
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
                  <div className="mt-2 pt-2 border-t border-blue-200 text-sm text-blue-700">
                    <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                    This loan type requires at least <strong>{minRepaymentsRequired}</strong> repayment(s) before a top-up can be requested.
                  </div>
                )}
              </div>
            )}

            {matchedLoanType && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <h4 className="font-medium text-sm text-slate-700 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Loan Type Rules ({matchedLoanType.displayName || matchedLoanType.name})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Interest Rate:</span>
                    <span className="ml-1 font-medium text-slate-800">{parseFloat(loanTypeInterestRate).toFixed(1)}% p.a.</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Term Range:</span>
                    <span className="ml-1 font-medium text-slate-800">{loanTypeMinTerm} - {loanTypeMaxTerm} months</span>
                  </div>
                  {loanTypeMinAmount > 0 && (
                    <div>
                      <span className="text-slate-500">Min Amount:</span>
                      <span className="ml-1 font-medium text-slate-800">{formatCurrency(loanTypeMinAmount)}</span>
                    </div>
                  )}
                  {loanTypeMaxAmount > 0 && (
                    <div>
                      <span className="text-slate-500">Max Loan Amount:</span>
                      <span className="ml-1 font-medium text-slate-800">{formatCurrency(loanTypeMaxAmount)}</span>
                    </div>
                  )}
                  {maxTopUpAmount > 0 && (
                    <div>
                      <span className="text-slate-500">Max Top-Up Amount:</span>
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
                      <span className="text-slate-500">Interest Method:</span>
                      <span className="ml-1 font-medium text-slate-800 capitalize">{matchedLoanType.interestType.replace('_', ' ')}</span>
                    </div>
                  )}
                  {totalSavingsBalance > 0 && (
                    <div>
                      <span className="text-slate-500">Savings-Based Limit:</span>
                      <span className="ml-1 font-medium text-slate-800">{formatCurrency(maxLoanBySavings)} ({loanToSavingsRatio}x savings)</span>
                    </div>
                  )}
                  {matchedLoanType.processingFee && parseFloat(matchedLoanType.processingFee) > 0 && (
                    <div>
                      <span className="text-slate-500">Processing Fee:</span>
                      <span className="ml-1 font-medium text-slate-800">{parseFloat(matchedLoanType.processingFee).toFixed(1)}%</span>
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
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-1">
                    {validationErrors.map((error, i) => (
                      <li key={i} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {serverErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-1">
                    {serverErrors.map((error, i) => (
                      <li key={i} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {selectedLoan && topUpAmount > 0 && validationErrors.length === 0 && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
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
                      <Input type="number" step="0.01" {...field} readOnly disabled className="bg-slate-100 cursor-not-allowed" />
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

            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
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
