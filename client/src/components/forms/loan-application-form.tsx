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
import { FileText, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import GuarantorForm from "./guarantor-form";
import GuarantorList from "../guarantor/guarantor-list";
import { useAuth } from "@/hooks/useAuth";

const loanApplicationSchema = z.object({
  principalAmount: z.string().min(1, "Amount is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  termMonths: z.string().min(1, "Term is required"),
  loanType: z.enum(["personal", "business", "emergency", "asset", "development"]),
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

  const { data: currentMember } = useQuery({
    queryKey: [`/api/members/by-user/${user?.id || 'undefined'}`],
    enabled: !!user?.id,
  });

  // Fetch member's savings accounts to get current balance
  const { data: savingsAccounts } = useQuery<any[]>({
    queryKey: [`/api/members/${(currentMember as any)?.id}/savings`],
    enabled: !!(currentMember as any)?.id,
  });

  // Calculate total savings balance
  const totalSavingsBalance = savingsAccounts?.reduce((total, account) => {
    return total + parseFloat(account.balance || '0');
  }, 0) || 0;

  const form = useForm<LoanApplicationData>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      loanType: "personal",
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
    if (currentMember && savingsAccounts) {
      const member = currentMember as any;
      form.setValue("averageNetPay", member.averageNetPay?.toString() || "");
      form.setValue("staffAccountNumber", member.staffAccountNumber || "");
      form.setValue("nextOfKin", member.nextOfKinName || "");
      form.setValue("nextOfKinPhone", member.nextOfKinPhone || "");
      form.setValue("currentSavings", totalSavingsBalance.toFixed(2));
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
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit loan application",
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
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select loan type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personal">Personal Loan</SelectItem>
                        <SelectItem value="business">Business Loan</SelectItem>
                        <SelectItem value="emergency">Emergency Loan</SelectItem>
                        <SelectItem value="asset">Asset Financing</SelectItem>
                        <SelectItem value="development">Development Loan</SelectItem>
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
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
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
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="12.00"
                        value={field.value}
                        onChange={field.onChange}
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Auto-populated from member profile"
                        value={field.value || ''}
                        onChange={field.onChange}
                        disabled={true}
                        className="bg-muted"
                      />
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
                    <FormLabel>Staff Account Number *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Auto-populated from member profile" 
                        value={field.value || ''}
                        onChange={field.onChange}
                        disabled={true}
                        className="bg-muted"
                      />
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
                      <Input 
                        placeholder="Auto-populated from member profile" 
                        value={field.value || ''}
                        onChange={field.onChange}
                        disabled={true}
                        className="bg-muted"
                      />
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
                      <Input 
                        placeholder="Auto-populated from member profile" 
                        value={field.value || ''}
                        onChange={field.onChange}
                        disabled={true}
                        className="bg-muted"
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Auto-calculated from savings accounts"
                        value={field.value || ''}
                        onChange={field.onChange}
                        disabled={true}
                        className="bg-muted"
                      />
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