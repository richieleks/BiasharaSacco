import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

const loanApplicationSchema = z.object({
  memberId: z.string().min(1, "Please select a member"),
  loanType: z.enum(["personal", "business", "emergency", "asset"]),
  principalAmount: z.string().min(1, "Amount is required").refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  interestRate: z.string().min(1, "Interest rate is required").refine((val) => parseFloat(val) > 0, "Interest rate must be greater than 0"),
  termMonths: z.string().min(1, "Term is required").refine((val) => parseInt(val) > 0, "Term must be greater than 0"),
  purpose: z.string().min(1, "Purpose is required"),
});

type LoanApplicationData = z.infer<typeof loanApplicationSchema>;

interface LoanApplicationFormProps {
  onSuccess: () => void;
}

export default function LoanApplicationForm({ onSuccess }: LoanApplicationFormProps) {
  const { toast } = useToast();

  const form = useForm<LoanApplicationData>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      memberId: "",
      loanType: "personal",
      principalAmount: "",
      interestRate: "12",
      termMonths: "12",
      purpose: "",
    },
  });

  const { data: members } = useQuery({
    queryKey: ['/api/members'],
  });

  const loanApplicationMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest('POST', '/api/loans', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/pending-approvals'] });
      onSuccess();
      toast({
        title: "Success",
        description: "Loan application submitted successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to submit loan application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: LoanApplicationData) => {
    loanApplicationMutation.mutate({
      memberId: parseInt(data.memberId),
      loanType: data.loanType,
      principalAmount: data.principalAmount,
      interestRate: (parseFloat(data.interestRate) / 100).toString(), // Convert to decimal
      termMonths: parseInt(data.termMonths),
      purpose: data.purpose,
    });
  };

  // Calculate monthly payment
  const calculateMonthlyPayment = () => {
    const principal = parseFloat(form.watch("principalAmount") || "0");
    const annualRate = parseFloat(form.watch("interestRate") || "0") / 100;
    const termMonths = parseInt(form.watch("termMonths") || "0");

    if (principal > 0 && annualRate > 0 && termMonths > 0) {
      const monthlyRate = annualRate / 12;
      const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
        (Math.pow(1 + monthlyRate, termMonths) - 1);
      return monthlyPayment;
    }
    return 0;
  };

  const monthlyPayment = calculateMonthlyPayment();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="memberId"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Member *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {members?.map((member: any) => (
                      <SelectItem key={member.id} value={member.id.toString()}>
                        {member.user?.firstName} {member.user?.lastName} ({member.memberNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="principalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Principal Amount (KSh) *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" min="1000" step="100" {...field} />
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
                <FormLabel>Annual Interest Rate (%) *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="12.0" min="1" max="50" step="0.1" {...field} />
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
                <FormLabel>Term (Months) *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="12" min="1" max="120" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Purpose of Loan *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe the purpose and intended use of this loan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {monthlyPayment > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Loan Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Principal Amount:</span>
                <span className="float-right font-medium">KSh {parseFloat(form.watch("principalAmount") || "0").toLocaleString()}</span>
              </div>
              <div>
                <span className="text-blue-700">Monthly Payment:</span>
                <span className="float-right font-medium">KSh {monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-blue-700">Total Interest:</span>
                <span className="float-right font-medium">
                  KSh {((monthlyPayment * parseInt(form.watch("termMonths") || "0")) - parseFloat(form.watch("principalAmount") || "0")).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-blue-700">Total Repayment:</span>
                <span className="float-right font-medium">
                  KSh {(monthlyPayment * parseInt(form.watch("termMonths") || "0")).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-4 pt-6 border-t border-slate-200">
          <Button type="button" variant="outline" className="flex-1" onClick={onSuccess}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loanApplicationMutation.isPending}
            className="flex-1 sacco-gradient text-white hover:opacity-90"
          >
            {loanApplicationMutation.isPending ? "Submitting..." : "Submit Application"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
