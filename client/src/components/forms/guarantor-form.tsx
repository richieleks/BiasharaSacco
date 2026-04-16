import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertGuarantorSchema } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

const guarantorFormSchema = insertGuarantorSchema.omit({ guarantorMemberNumber: true }).extend({
  guarantorMemberId: z.number().min(1, "Please enter a valid member ID"),
});

type GuarantorFormData = z.infer<typeof guarantorFormSchema>;

interface GuarantorFormProps {
  loanId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function GuarantorForm({ loanId, onSuccess, onCancel }: GuarantorFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [memberIdInput, setMemberIdInput] = useState("");
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState("");

  const form = useForm<GuarantorFormData>({
    resolver: zodResolver(guarantorFormSchema),
    defaultValues: {
      loanId,
      guarantorMemberId: 0,
      guaranteeAmount: "",
      status: "pending",
    },
  });

  const { data: loanDetails } = useQuery<any>({
    queryKey: [`/api/loans/${loanId}`],
    enabled: !!loanId,
  });

  const { data: memberSavings } = useQuery<any[]>({
    queryKey: ['/api/members', loanDetails?.memberId, 'savings'],
    queryFn: async () => {
      const res = await fetch(`/api/members/${loanDetails.memberId}/savings`);
      if (!res.ok) throw new Error('Failed to fetch savings');
      return res.json();
    },
    enabled: !!loanDetails?.memberId,
  });

  const { data: existingGuarantors = [] } = useQuery<any[]>({
    queryKey: ['/api/guarantors/loan', loanId],
    queryFn: async () => {
      const res = await fetch(`/api/guarantors/loan/${loanId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch guarantors');
      return res.json();
    },
    enabled: !!loanId,
  });

  const loanAmount = parseFloat(loanDetails?.principalAmount || '0');
  const totalSavings = memberSavings?.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance || '0'), 0) || 0;
  const amountToGuarantee = Math.max(0, loanAmount - totalSavings);

  const validateMember = async () => {
    const trimmed = memberIdInput.trim();
    if (!trimmed) {
      setValidationState('invalid');
      setValidationMessage('Please enter a member ID');
      form.setValue('guarantorMemberId', 0);
      return;
    }

    setValidationState('validating');
    setValidationMessage('');

    try {
      const res = await apiRequest('POST', '/api/guarantors/validate-member', { memberNumber: trimmed });
      const data = await res.json();

      if (data.valid) {
        if (data.memberId === loanDetails?.memberId) {
          setValidationState('invalid');
          setValidationMessage('The loan applicant cannot be their own guarantor');
          form.setValue('guarantorMemberId', 0);
          return;
        }

        const alreadyAdded = existingGuarantors.some((g: any) => g.guarantorMemberId === data.memberId);
        if (alreadyAdded) {
          setValidationState('invalid');
          setValidationMessage('This member is already a guarantor for this loan');
          form.setValue('guarantorMemberId', 0);
          return;
        }

        setValidationState('valid');
        setValidationMessage('Member ID verified');
        form.setValue('guarantorMemberId', data.memberId);
      } else {
        setValidationState('invalid');
        setValidationMessage(data.message || 'Invalid member ID');
        form.setValue('guarantorMemberId', 0);
      }
    } catch (error: any) {
      let msg = 'Failed to validate member ID';
      try {
        const parts = error.message?.split(': ');
        if (parts && parts.length > 1) {
          const parsed = JSON.parse(parts.slice(1).join(': '));
          msg = parsed.message || msg;
        }
      } catch {}
      setValidationState('invalid');
      setValidationMessage(msg);
      form.setValue('guarantorMemberId', 0);
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: GuarantorFormData) => {
      await apiRequest('POST', '/api/guarantors', data);
    },
    onSuccess: () => {
      setFormError(null);
      toast({ title: "Success",
        description: "Guarantor request sent successfully", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/loan', loanId] });
      onSuccess();
    },
    onError: (error) => {
      let errorMsg = "Failed to add guarantor";
      try {
        const parts = error.message?.split(': ');
        if (parts && parts.length > 1) {
          const parsed = JSON.parse(parts.slice(1).join(': '));
          errorMsg = parsed.message || parsed.error || errorMsg;
        } else if (error.message) {
          errorMsg = error.message;
        }
      } catch {
        if (error.message) errorMsg = error.message;
      }
      setFormError(errorMsg);
    },
  });

  const handleSubmit = (data: GuarantorFormData) => {
    setFormError(null);
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Add Guarantor</h3>
        <p className="text-sm text-muted-foreground">
          Enter the member ID of the person you want to add as a guarantor for this loan.
        </p>
      </div>

      {loanAmount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-300">Loan Amount:</span>
            <span className="font-medium">{formatCurrency(loanAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-300">Member Savings:</span>
            <span className="font-medium text-emerald-700">{formatCurrency(totalSavings)}</span>
          </div>
          <div className="flex justify-between border-t border-blue-200 dark:border-blue-800 pt-1 mt-1">
            <span className="font-medium text-blue-900">Amount to Guarantee:</span>
            <span className="font-bold text-blue-900">{formatCurrency(amountToGuarantee)}</span>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <FormLabel>Member ID</FormLabel>
            <div className="flex gap-2">
              <Input
                placeholder="Enter member ID (e.g. MEM-001)"
                value={memberIdInput}
                onChange={(e) => {
                  setMemberIdInput(e.target.value);
                  if (validationState !== 'idle') {
                    setValidationState('idle');
                    setValidationMessage('');
                    form.setValue('guarantorMemberId', 0);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    validateMember();
                  }
                }}
                className={
                  validationState === 'valid' ? 'border-green-500 focus-visible:ring-green-500' :
                  validationState === 'invalid' ? 'border-red-500 focus-visible:ring-red-500' : ''
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={validateMember}
                disabled={validationState === 'validating' || !memberIdInput.trim()}
              >
                {validationState === 'validating' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
            {validationMessage && (
              <div className={`flex items-center gap-1.5 text-sm ${
                validationState === 'valid' ? 'text-green-600' : 'text-red-600'
              }`}>
                {validationState === 'valid' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                )}
                {validationMessage}
              </div>
            )}
          </div>

          <FormField
            control={form.control}
            name="guaranteeAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guarantee Amount (UGX)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1000"
                    placeholder="Enter amount in UGX"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <div className="text-xs text-muted-foreground">
                  Amount this member will guarantee for the loan
                </div>
              </FormItem>
            )}
          />

          {formError && (
            <div className="p-4 bg-red-50 dark:bg-red-950/50 border-2 border-red-400 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{formError}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={mutation.isPending || validationState !== 'valid' || !form.watch('guaranteeAmount')}
              className="flex-1"
            >
              {mutation.isPending ? "Sending Request..." : "Send Guarantor Request"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}