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
import { FileText, Plus, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import GuarantorForm from "./guarantor-form";
import GuarantorList from "../guarantor/guarantor-list";
import { useAuth } from "@/hooks/useAuth";
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

  // Get selected loan type details
  const selectedLoanType = loanTypes.find(lt => lt.name === form.watch('loanType'));

  // Update interest rate when loan type changes
  useEffect(() => {
    if (selectedLoanType) {
      form.setValue('interestRate', (selectedLoanType.interestRate || selectedLoanType.interest_rate || '12.00').toString());
    }
  }, [selectedLoanType, form]);

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
        staffAccountNumber: member.staffAccountNumber || "",
        nextOfKin: member.nextOfKinName || "",
        nextOfKinPhone: member.nextOfKinPhone || "",
        currentSavings: totalSavingsBalance.toFixed(2),
      });
    }
  }, [currentMember, savingsAccounts, totalSavingsBalance, form]);

  const calculateMonthlyPayment = () => {
    const principal = parseFloat(form.watch('principalAmount') || '0');
    const rate = parseFloat(form.watch('interestRate') || '0') / 100 / 12;
    const term = parseInt(form.watch('termMonths') || '0');
    
    if (principal > 0 && rate > 0 && term > 0) {
      const payment = principal * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
      return payment;
    }
    return 0;
  };

  const monthlyPayment = calculateMonthlyPayment();

  const mutation = useMutation({
    mutationFn: async (data: LoanApplicationData) => {
      if (!(currentMember as any)?.id) {
        throw new Error("Member information not available");
      }

      const principal = parseFloat(data.principalAmount);
      const rate = parseFloat(data.interestRate) / 100 / 12;
      const term = parseInt(data.termMonths);
      const calculatedPayment = principal * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);

      const response = await apiRequest('POST', '/api/loans', {
        ...data,
        memberId: (currentMember as any).id,
        termMonths: parseInt(data.termMonths),
        monthlyPayment: calculatedPayment.toFixed(2),
        outstandingBalance: data.principalAmount,
      });
      return response;
    },
    onSuccess: async (response) => {
      const loan = await response.json();
      toast({
        title: "Success",
        description: "Loan application created. Now add guarantors before submission.",
      });
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

  const handleSubmit = (data: LoanApplicationData) => {
    mutation.mutate(data);
  };

  if (currentLoanId) {
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
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
                        Allowed range: UGX {Number(selectedLoanType.minAmount || selectedLoanType.min_amount || 0).toLocaleString()} - 
                        UGX {Number(selectedLoanType.maxAmount || selectedLoanType.max_amount || 0).toLocaleString()}
                      </p>
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
                                  {loanType.interestRate || loanType.interest_rate}% | 
                                  UGX {Number(loanType.minAmount || loanType.min_amount || 0).toLocaleString()} - 
                                  UGX {Number(loanType.maxAmount || loanType.max_amount || 0).toLocaleString()}
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
                      <Input
                        type="number"
                        placeholder="12"
                        min={selectedLoanType ? (selectedLoanType.minTerm || selectedLoanType.min_term || 1) : 1}
                        max={selectedLoanType ? (selectedLoanType.maxTerm || selectedLoanType.max_term || 60) : 60}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    {selectedLoanType && (
                      <p className="text-xs text-muted-foreground">
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
                          value={field.value ? `UGX ${parseFloat(field.value).toLocaleString()}` : 'Not set in profile'}
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
                          value={field.value ? `UGX ${parseFloat(field.value).toLocaleString()}` : 'UGX 0.00'}
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

            {/* Top-up Loan Section */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isTopUp"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>This is a top-up loan</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Check if this loan is to top up an existing loan
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch('isTopUp') && (
                <FormField
                  control={form.control}
                  name="previousLoanBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Previous Loan Balance</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="repaymentScheduleAttached"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Repayment schedule attached</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Check if you have attached a repayment schedule
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Monthly Payment Display */}
            {monthlyPayment > 0 && (
              <Card className="border-primary">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-sm font-medium text-muted-foreground">Monthly Repayment Amount</div>
                    <div className="text-3xl font-bold text-primary">
                      UGX {monthlyPayment.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button 
              type="submit" 
              disabled={mutation.isPending || !currentMember} 
              className="w-full"
            >
              {mutation.isPending ? "Creating Application..." : "Create Loan Application"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}