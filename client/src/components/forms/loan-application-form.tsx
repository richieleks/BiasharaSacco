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
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Plus, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import GuarantorForm from "./guarantor-form";
import GuarantorList from "../guarantor/guarantor-list";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import type { LoanTypeWithTerms } from "@shared/schema";

const loanApplicationSchema = z.object({
  principalAmount: z.string().min(1, "Amount is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  termMonths: z.string().min(1, "Term is required"),
  loanType: z.string().min(1, "Loan type is required"),
  purpose: z.string().min(1, "Purpose is required"),
  averageNetPay: z.string().optional(),
  staffNumber: z.string().optional(),
  staffAccountNumber: z.string().optional(),
  nextOfKin: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  currentSavings: z.string().optional(),
  isTopUp: z.boolean().default(false),
  previousLoanBalance: z.string().optional(),
  securityOffered: z.string().optional(),
  repaymentScheduleAttached: z.boolean().default(false),
});

type LoanApplicationData = z.infer<typeof loanApplicationSchema>;

interface LoanApplicationFormProps {
  onSuccess: () => void;
}

export default function LoanApplicationForm({ onSuccess }: LoanApplicationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showGuarantorForm, setShowGuarantorForm] = useState(false);
  const [currentLoanId, setCurrentLoanId] = useState<number | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<any>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Fetch available loan types
  const { data: loanTypes = [], isLoading: loadingLoanTypes } = useQuery<LoanTypeWithTerms[]>({
    queryKey: ['/api/loan-types/active'],
    queryFn: async () => {
      const response = await fetch('/api/loan-types/active');
      if (!response.ok) {
        throw new Error('Failed to fetch loan types');
      }
      return response.json();
    },
  });

  const { data: currentMember } = useQuery({
    queryKey: ['/api/members/by-user', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/members/by-user/${user?.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch member details');
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Check if member is approved for loan applications
  const isMemberApproved = currentMember?.status === 'active';
  const memberStatus = currentMember?.status;

  // Fetch member's savings accounts to get current balance
  const { data: savingsAccounts } = useQuery<any[]>({
    queryKey: ['/api/members', (currentMember as any)?.id, 'savings'],
    queryFn: async () => {
      const memberId = (currentMember as any)?.id;
      const response = await fetch(`/api/members/${memberId}/savings`);
      if (!response.ok) {
        throw new Error('Failed to fetch savings accounts');
      }
      return response.json();
    },
    enabled: !!(currentMember as any)?.id,
  });

  // Calculate total savings balance
  const totalSavingsBalance = savingsAccounts?.reduce((total, account) => {
    return total + parseFloat(account.balance || '0');
  }, 0) || 0;

  // Check for pending loans to disable form
  const { data: memberLoans = [] } = useQuery<any[]>({
    queryKey: ['/api/loans/member', (currentMember as any)?.id],
    queryFn: async () => {
      const memberId = (currentMember as any)?.id;
      const response = await fetch(`/api/loans/member/${memberId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch member loans');
      }
      return response.json();
    },
    enabled: !!(currentMember as any)?.id,
  });

  const hasPendingLoans = memberLoans.some(loan => loan.status === 'pending');

  const form = useForm<LoanApplicationData>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      loanType: "",
      principalAmount: "",
      interestRate: "12.00",
      termMonths: "12",
      purpose: "PERSONAL DEVELOPMENT",
      isTopUp: false,
      repaymentScheduleAttached: false,
      averageNetPay: "",
      staffNumber: "",
      staffAccountNumber: "",
      nextOfKin: "",
      nextOfKinPhone: "",
      currentSavings: "",
      previousLoanBalance: "",
      securityOffered: "",
    },
  });

  // Auto-populate form fields when member data is available
  useEffect(() => {
    if (currentMember && savingsAccounts !== undefined) {
      const member = currentMember as any;
      
      // Reset form with auto-populated values
      form.reset({
        ...form.getValues(),
        averageNetPay: member.averageNetPay?.toString() || "",
        staffAccountNumber: member.idNumber || "",
        nextOfKin: member.nextOfKinName || "",
        nextOfKinPhone: member.nextOfKinPhone || "",
        currentSavings: totalSavingsBalance.toFixed(2),
      });
    }
  }, [currentMember, savingsAccounts, totalSavingsBalance, form]);

  // Get selected loan type details
  const selectedLoanType = loanTypes.find(lt => lt.name === form.watch('loanType'));

  // Update interest rate and repayment period when loan type changes
  useEffect(() => {
    if (selectedLoanType) {
      form.setValue('interestRate', (selectedLoanType.interestRate || selectedLoanType.interest_rate || '12.00').toString());
      // Set repayment period to the loan type's maximum term
      const maxTerm = selectedLoanType.maxTerm || selectedLoanType.max_term || 12;
      form.setValue('termMonths', maxTerm.toString());
    }
  }, [selectedLoanType, form]);

  const calculateMonthlyPayment = () => {
    const principal = parseFloat(form.watch('principalAmount') || '0');
    const annualRate = parseFloat(form.watch('interestRate') || '0');
    const termMonths = parseInt(form.watch('termMonths') || '0');
    
    if (principal > 0 && annualRate > 0 && termMonths > 0 && selectedLoanType) {
      const interestType = selectedLoanType.interestType || selectedLoanType.interest_type || 'reducing_balance';
      const timeInYears = termMonths / 12;
      
      switch (interestType) {
        case 'simple':
          // Simple Interest: I = P * R * T, Monthly Payment = (P + I) / months
          const simpleInterest = principal * (annualRate / 100) * timeInYears;
          return (principal + simpleInterest) / termMonths;
          
        case 'compound':
          // Compound Interest: A = P(1 + r/n)^(nt), where n = compounding frequency
          const compoundingFrequency = selectedLoanType.compoundingFrequency || selectedLoanType.compounding_frequency || 'monthly';
          let n = 12; // default monthly
          if (compoundingFrequency === 'quarterly') n = 4;
          if (compoundingFrequency === 'annually') n = 1;
          
          const compoundAmount = principal * Math.pow(1 + (annualRate / 100) / n, n * timeInYears);
          return compoundAmount / termMonths;
          
        case 'reducing_balance':
        default:
          // Reducing Balance (EMI): PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
          const monthlyRate = annualRate / 100 / 12;
          return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
      }
    }
    return 0;
  };

  const monthlyPayment = calculateMonthlyPayment();

  // Check loan eligibility function
  const checkEligibility = async (memberId: number, amount: number, loanType?: string) => {
    if (!memberId || !amount || amount <= 0) return;
    
    setCheckingEligibility(true);
    try {
      const response = await apiRequest('POST', '/api/loans/check-eligibility', {
        memberId,
        requestedAmount: amount,
        loanType: loanType || undefined
      });
      
      const eligibilityData = await response.json();
      setEligibilityResult(eligibilityData);
    } catch (error) {
      console.error('Error checking eligibility:', error);
      setEligibilityResult(null);
    } finally {
      setCheckingEligibility(false);
    }
  };

  // Auto-check eligibility when amount or loan type changes
  useEffect(() => {
    const amount = parseFloat(form.watch('principalAmount') || '0');
    const memberId = (currentMember as any)?.id;
    const selectedLoanType = form.watch('loanType');
    
    if (memberId && amount > 0) {
      const timer = setTimeout(() => {
        checkEligibility(memberId, amount, selectedLoanType);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      setEligibilityResult(null);
    }
  }, [form.watch('principalAmount'), form.watch('loanType'), currentMember]);

  const mutation = useMutation({
    mutationFn: async (data: LoanApplicationData) => {
      if (!(currentMember as any)?.id) {
        throw new Error("Member information not available");
      }

      const principal = parseFloat(data.principalAmount);
      const annualRate = parseFloat(data.interestRate);
      const termMonths = parseInt(data.termMonths);
      
      // Calculate payment based on interest type
      let calculatedPayment = 0;
      if (selectedLoanType) {
        const interestType = selectedLoanType.interestType || selectedLoanType.interest_type || 'reducing_balance';
        const timeInYears = termMonths / 12;
        
        switch (interestType) {
          case 'simple':
            const simpleInterest = principal * (annualRate / 100) * timeInYears;
            calculatedPayment = (principal + simpleInterest) / termMonths;
            break;
            
          case 'compound':
            const compoundingFrequency = selectedLoanType.compoundingFrequency || selectedLoanType.compounding_frequency || 'monthly';
            let n = 12;
            if (compoundingFrequency === 'quarterly') n = 4;
            if (compoundingFrequency === 'annually') n = 1;
            
            const compoundAmount = principal * Math.pow(1 + (annualRate / 100) / n, n * timeInYears);
            calculatedPayment = compoundAmount / termMonths;
            break;
            
          case 'reducing_balance':
          default:
            const monthlyRate = annualRate / 100 / 12;
            calculatedPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
            break;
        }
      }

      const response = await apiRequest('POST', '/api/loans', {
        ...data,
        memberId: (currentMember as any).id,
        termMonths: termMonths,
        monthlyPayment: calculatedPayment.toFixed(2),
        outstandingBalance: data.principalAmount,
        interestType: selectedLoanType?.interestType || selectedLoanType?.interest_type || 'reducing_balance',
        compoundingFrequency: selectedLoanType?.compoundingFrequency || selectedLoanType?.compounding_frequency || 'monthly',
        requiresGuarantor: selectedLoanType?.requiresGuarantor ?? selectedLoanType?.requires_guarantor ?? true,
      });
      return response;
    },
    onSuccess: async (response) => {
      const loan = await response.json();
      toast({ title: "Success",
        description: "Loan application created. Now add guarantors before submission.", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      setCurrentLoanId(loan.id);
      form.reset();
    },
    onError: async (error) => {
      let errorMessage = "Failed to submit loan application";
      
      // Handle membership status errors specifically
      if (error.message.includes('403')) {
        try {
          const errorData = JSON.parse(error.message.split('403: ')[1]);
          if (errorData.memberStatus) {
            errorMessage = `Membership must be approved before applying for loans. Current status: ${errorData.memberStatus}`;
          } else {
            errorMessage = errorData.message || "Membership approval required";
          }
        } catch {
          errorMessage = "Membership approval required before applying for loans";
        }
      } else if (error.message.includes('400')) {
        try {
          const errorData = JSON.parse(error.message.split('400: ')[1]);
          if (errorData.violations && errorData.violations.length > 0) {
            errorMessage = errorData.violations.join('\n');
          } else if (errorData.pendingLoans) {
            errorMessage = `${errorData.message}${errorData.pendingLoanNumbers ? ` (Loan Numbers: ${errorData.pendingLoanNumbers.join(', ')})` : ''}`;
          } else {
            errorMessage = errorData.message || "Cannot apply for new loan";
          }
        } catch {
          errorMessage = error.message || "Failed to submit loan application";
        }
      } else {
        errorMessage = error.message || "Failed to submit loan application";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: LoanApplicationData) => {
    if (eligibilityResult && !eligibilityResult.isEligible) {
      toast({
        title: "Eligibility Check Failed",
        description: "Please resolve all eligibility violations before submitting your loan application.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  if (currentLoanId) {
    const requiresGuarantor = selectedLoanType?.requiresGuarantor ?? selectedLoanType?.requires_guarantor ?? true;
    const loanPrincipal = parseFloat(form.getValues('principalAmount') || '0');
    const savingsCoverLoan = totalSavingsBalance >= loanPrincipal && loanPrincipal > 0;
    const needsGuarantors = requiresGuarantor && !savingsCoverLoan;
    
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Loan Application Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            {needsGuarantors ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Your loan application has been created successfully. Now add guarantors to complete the application.
                </p>
                <GuarantorList loanId={currentLoanId} />
                <div className="mt-6">
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
              </>
            ) : (
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Application Complete
                </h3>
                <p className="text-gray-600 mb-4">
                  {savingsCoverLoan 
                    ? "Your loan application has been created successfully. Your savings fully cover this loan amount, so no guarantors are required. Your application is ready for review by the loan committee."
                    : "Your loan application has been created successfully. This loan type does not require guarantors, so your application is ready for review by the loan committee."}
                </p>
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setCurrentLoanId(null);
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

  // Show membership status warning if not approved
  if (!isMemberApproved && currentMember) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-red-700">Membership Approval Required</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Membership Not Yet Approved
            </h3>
            <p className="text-gray-600 mb-4">
              Your membership status is currently <span className="font-medium capitalize text-red-600">{memberStatus}</span>. 
              You must have an approved membership before you can apply for loans.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Next Steps:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
                <li>Wait for admin approval of your membership application</li>
                <li>Ensure all required documents have been submitted</li>
                <li>Contact SACCO administration if you have questions</li>
              </ul>
            </div>
            <Button 
              variant="outline" 
              onClick={onSuccess}
              className="w-full"
            >
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">BIASHARA SACCO SOCIETY LTD</CardTitle>
        <p className="text-center text-sm text-muted-foreground">LOAN APPLICATION FORM</p>
      </CardHeader>
      <CardContent>
        {/* Pending Loans Warning */}
        {hasPendingLoans && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <div className="text-sm text-red-800">
                <strong>Pending Loan Application:</strong> You currently have a loan application pending approval. 
                You cannot apply for a new loan until your existing application is approved or rejected.
              </div>
            </div>
          </div>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Applicant Information */}
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium text-sm mb-2">Applicant Information</h3>
              {currentMember ? (
                <div className="text-sm grid grid-cols-2 gap-4">
                  <p><strong>Name:</strong> {(currentMember as any).user?.firstName} {(currentMember as any).user?.lastName}</p>
                  <p><strong>Member Number:</strong> {(currentMember as any).memberNumber}</p>
                  <p><strong>ID Number:</strong> {(currentMember as any).idNumber}</p>
                  <p><strong>Phone:</strong> {(currentMember as any).phoneNumber}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading member information...</p>
              )}
            </div>

            {/* Auto-populated fields notice */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-sm text-blue-800 mb-1">Auto-populated Fields</h4>
              <p className="text-xs text-blue-700">
                Fields marked with * are automatically populated from your member profile and cannot be edited.
                If any information is incorrect, please update your member profile first.
              </p>
            </div>

            {/* Full-width eligibility result display at top */}
            {eligibilityResult && (
              <div className="w-full mb-6">
                {eligibilityResult.isEligible ? (
                  <Alert className="border-green-500 bg-green-50">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <AlertDescription className="text-green-900">
                      <div className="font-bold text-lg text-green-800 mb-2">✅ LOAN APPLICATION ELIGIBLE</div>
                      {eligibilityResult.maxLoanAmount && (
                        <div className="text-sm font-medium text-green-800 mb-2">
                          💰 Maximum loan amount: {formatCurrency(eligibilityResult.maxLoanAmount)}
                        </div>
                      )}
                      {eligibilityResult.warnings?.length > 0 && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="text-sm">
                            <strong className="text-yellow-800">⚠️ Important Notes:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              {eligibilityResult.warnings.map((warning: string, index: number) => (
                                <li key={index} className="text-yellow-800">{warning}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-red-500 bg-red-50">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <AlertDescription className="text-red-900">
                      <div className="font-bold text-xl mb-4">❌ LOAN APPLICATION NOT ELIGIBLE</div>
                      <div className="space-y-4">
                        <div className="font-semibold text-red-800 mb-3">You must meet the following requirements before applying:</div>
                        <div className="space-y-3">
                          {eligibilityResult.violations?.map((violation: string, index: number) => (
                            <div key={index} className="p-4 bg-white dark:bg-slate-900 border border-red-200 rounded-md shadow-sm">
                              <div className="text-sm font-medium text-red-900">{violation}</div>
                            </div>
                          )) || <div className="text-red-600">No violations data available</div>}
                        </div>
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="text-sm text-blue-800">
                            <strong>📞 Need Help?</strong> Contact the SACCO office for assistance with any of these requirements.
                          </div>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Loan Details */}
              <FormField
                control={form.control}
                name="principalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Applied For (UGX) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        min={selectedLoanType ? (selectedLoanType.minAmount || selectedLoanType.min_amount || 0) : 0}
                        max={selectedLoanType ? (selectedLoanType.maxAmount || selectedLoanType.max_amount || undefined) : undefined}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    {selectedLoanType && (
                      <p className="text-xs text-muted-foreground">
                        Allowed range: {formatCurrency(selectedLoanType.minAmount || selectedLoanType.min_amount || 0)} - 
                        {formatCurrency(selectedLoanType.maxAmount || selectedLoanType.max_amount || 0)}
                        <br />
                        {(selectedLoanType.requiresGuarantor ?? selectedLoanType.requires_guarantor ?? true) 
                          ? 'This loan type requires guarantors' 
                          : 'This loan type does not require guarantors'}
                      </p>
                    )}
                    
                    {/* Real-time eligibility check */}
                    {checkingEligibility && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking eligibility...
                      </div>
                    )}
                    
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="loanType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingLoanTypes}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingLoanTypes ? "Loading loan types..." : "Select loan type"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingLoanTypes ? (
                          <SelectItem value="_loading" disabled>
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading loan types...
                            </div>
                          </SelectItem>
                        ) : loanTypes.length === 0 ? (
                          <SelectItem value="_empty" disabled>
                            No loan types available
                          </SelectItem>
                        ) : (
                          loanTypes.map((loanType) => (
                            <SelectItem key={loanType.id} value={loanType.name}>
                              <div className="flex flex-col">
                                <span className="font-medium">{loanType.displayName || loanType.display_name || loanType.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {loanType.interestRate || loanType.interest_rate}% ({(loanType.interestType || loanType.interest_type || 'reducing_balance').replace('_', ' ')}) | 
                                  {formatCurrency(loanType.minAmount || loanType.min_amount || 0)} - 
                                  {formatCurrency(loanType.maxAmount || loanType.max_amount || 0)}
                                  {(loanType.requiresGuarantor ?? loanType.requires_guarantor ?? true) ? ' | Guarantor Required' : ' | No Guarantor Required'}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="termMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repayment Period (Months) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="12"
                          min={selectedLoanType ? (selectedLoanType.minTerm || selectedLoanType.min_term || 1) : 1}
                          max={selectedLoanType ? (selectedLoanType.maxTerm || selectedLoanType.max_term || 60) : 60}
                          value={field.value}
                          onChange={field.onChange}
                          className={selectedLoanType ? "bg-muted border-blue-200" : ""}
                        />
                        {selectedLoanType && (
                          <div className="absolute right-2 top-2 text-xs text-blue-600">Auto</div>
                        )}
                      </div>
                    </FormControl>
                    {selectedLoanType && (
                      <p className="text-xs text-muted-foreground">
                        Auto-set to maximum term ({selectedLoanType.maxTerm || selectedLoanType.max_term || 60} months). 
                        Allowed range: {selectedLoanType.minTerm || selectedLoanType.min_term || 1} - {selectedLoanType.maxTerm || selectedLoanType.max_term || 60} months
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Rate (%) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="12.00"
                          value={field.value}
                          onChange={field.onChange}
                          disabled={!!selectedLoanType}
                          className={selectedLoanType ? "bg-muted border-blue-200" : ""}
                        />
                        {selectedLoanType && (
                          <div className="absolute right-2 top-2 text-xs text-blue-600">Auto</div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Staff Information */}
              <FormField
                control={form.control}
                name="averageNetPay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Average Net Pay (for employees) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="Auto-populated from member profile"
                          value={field.value ? formatCurrency(field.value) : 'Not set in profile'}
                          onChange={field.onChange}
                          disabled={true}
                          className="bg-muted border-blue-200"
                        />
                        <div className="absolute right-2 top-2 text-xs text-blue-600">Auto</div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="staffAccountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Number *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="Auto-populated from member profile" 
                          value={field.value || 'Not set in profile'}
                          onChange={field.onChange}
                          disabled={true}
                          className="bg-muted border-blue-200"
                        />
                        <div className="absolute right-2 top-2 text-xs text-blue-600">Auto</div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Next of Kin */}
              <FormField
                control={form.control}
                name="nextOfKin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next of Kin (NOK) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="Auto-populated from member profile" 
                          value={field.value || 'Not set in profile'}
                          onChange={field.onChange}
                          disabled={true}
                          className="bg-muted border-blue-200"
                        />
                        <div className="absolute right-2 top-2 text-xs text-blue-600">Auto</div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextOfKinPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NOK Phone Number *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="Auto-populated from member profile" 
                          value={field.value || 'Not set in profile'}
                          onChange={field.onChange}
                          disabled={true}
                          className="bg-muted border-blue-200"
                        />
                        <div className="absolute right-2 top-2 text-xs text-blue-600">Auto</div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentSavings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Savings Balance *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="Auto-calculated from savings accounts"
                          value={field.value ? formatCurrency(field.value) : 'UGX 0'}
                          onChange={field.onChange}
                          disabled={true}
                          className="bg-muted border-blue-200"
                        />
                        <div className="absolute right-2 top-2 text-xs text-blue-600">Auto</div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Purpose and Security */}
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose of the Loan *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose of the loan"
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="securityOffered"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Security Offered (if any)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe any security/collateral offered"
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Monthly Payment Display */}
            {monthlyPayment > 0 && selectedLoanType && (
              <Card className="border-primary">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-sm font-medium text-muted-foreground">Monthly Repayment Amount</div>
                    <div className="text-3xl font-bold text-primary">
                      {formatCurrency(monthlyPayment)}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Calculated using{' '}
                      <span className="font-medium capitalize">
                        {(selectedLoanType.interestType || selectedLoanType.interest_type || 'reducing_balance').replace('_', ' ')}
                      </span>{' '}
                      interest method
                      {(selectedLoanType.interestType || selectedLoanType.interest_type) === 'compound' && (
                        <span className="ml-1">
                          ({selectedLoanType.compoundingFrequency || selectedLoanType.compounding_frequency || 'monthly'} compounding)
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}



            <Button 
              type="submit" 
              disabled={mutation.isPending || !currentMember || hasPendingLoans || (eligibilityResult && !eligibilityResult.isEligible)} 
              className="w-full"
            >
              {mutation.isPending 
                ? "Creating Application..." 
                : hasPendingLoans 
                  ? "Cannot Apply - Pending Loan Exists" 
                  : (eligibilityResult && !eligibilityResult.isEligible)
                    ? "Eligibility Requirements Not Met"
                    : "Create Loan Application"
              }
            </Button>
            
            {eligibilityResult && !eligibilityResult.isEligible && (
              <p className="text-sm text-red-600 text-center mt-2">
                Application cannot be submitted until all eligibility requirements are met.
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}