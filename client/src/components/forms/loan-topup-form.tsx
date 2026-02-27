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
import { ArrowUpCircle, Loader2, AlertCircle } from "lucide-react";
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

  useEffect(() => {
    if (selectedLoan) {
      form.setValue('loanType', selectedLoan.loanType || '');
      const matchingType = loanTypes.find(lt => lt.name === selectedLoan.loanType);
      if (matchingType) {
        form.setValue('interestRate', (matchingType.interestRate || '12.00').toString());
        const maxTerm = matchingType.maxTerm || 12;
        form.setValue('termMonths', maxTerm.toString());
      }
    }
  }, [selectedLoan, loanTypes, form]);

  const topUpAmount = parseFloat(form.watch('topUpAmount') || '0');
  const outstandingBalance = selectedLoan ? parseFloat(selectedLoan.outstandingBalance || '0') : 0;
  const totalNewPrincipal = outstandingBalance + topUpAmount;
  const annualRate = parseFloat(form.watch('interestRate') || '0');
  const termMonths = parseInt(form.watch('termMonths') || '0');

  const calculateMonthlyPayment = () => {
    if (totalNewPrincipal > 0 && annualRate > 0 && termMonths > 0) {
      const monthlyRate = annualRate / 100 / 12;
      return totalNewPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
    }
    return 0;
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
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/my-loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/active-for-topup'] });
      form.reset();
      onSuccess();
    },
    onError: async (error: any) => {
      let errorMessage = "Failed to submit top-up application";
      try {
        if (error.message) {
          const parts = error.message.split(': ');
          if (parts.length > 1) {
            const errorData = JSON.parse(parts.slice(1).join(': '));
            errorMessage = errorData.message || errorMessage;
            if (errorData.violations) {
              errorMessage += ': ' + errorData.violations.join(', ');
            }
          } else {
            errorMessage = error.message;
          }
        }
      } catch {
        errorMessage = error.message || errorMessage;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: TopUpFormData) => {
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

            <FormField
              control={form.control}
              name="topUpAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Amount (UGX)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter additional amount" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedLoan && topUpAmount > 0 && (
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
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
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
                      <Input type="number" max={24} {...field} />
                    </FormControl>
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
              disabled={mutation.isPending || !selectedLoan}
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
