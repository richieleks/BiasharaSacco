import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertGuarantorSchema } from "@shared/schema";
import type { MemberWithDetails } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

const guarantorFormSchema = insertGuarantorSchema.omit({ guarantorMemberNumber: true }).extend({
  guarantorMemberId: z.number().min(1, "Please select a guarantor"),
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
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<GuarantorFormData>({
    resolver: zodResolver(guarantorFormSchema),
    defaultValues: {
      loanId,
      guarantorMemberId: 0,
      guaranteeAmount: "",
      status: "pending",
    },
  });

  const { data: allMembers = [] } = useQuery<MemberWithDetails[]>({
    queryKey: ['/api/members'],
  });

  const { data: currentMember } = useQuery<MemberWithDetails>({
    queryKey: [`/api/members/by-user/${user?.id || 'undefined'}`],
    enabled: !!user?.id,
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

  const existingGuarantorMemberIds = existingGuarantors.map((g: any) => g.guarantorMemberId);

  const loanAmount = parseFloat(loanDetails?.principalAmount || '0');
  const totalSavings = memberSavings?.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance || '0'), 0) || 0;
  const amountToGuarantee = Math.max(0, loanAmount - totalSavings);

  const eligibleMembers = allMembers.filter(member => 
    member.status === 'active' && 
    member.id !== currentMember?.id &&
    member.id !== loanDetails?.memberId &&
    !existingGuarantorMemberIds.includes(member.id)
  );

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

  const selectedMember = eligibleMembers.find(m => m.id === form.watch('guarantorMemberId'));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Add Guarantor</h3>
        <p className="text-sm text-muted-foreground">
          Add a guarantor for this loan application. The guarantor must have enough savings to cover the guarantee amount.
        </p>
      </div>

      {loanAmount > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-300">Loan Amount:</span>
            <span className="font-medium">{formatCurrency(loanAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-300">Member Savings:</span>
            <span className="font-medium text-emerald-700">{formatCurrency(totalSavings)}</span>
          </div>
          <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
            <span className="font-medium text-blue-900">Amount to Guarantee:</span>
            <span className="font-bold text-blue-900">{formatCurrency(amountToGuarantee)}</span>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="guarantorMemberId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Select Guarantor</FormLabel>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? `${selectedMember?.fullName || selectedMember?.memberNumber} (${selectedMember?.memberNumber})`
                          : "Search and select a member..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search members by name or number..." 
                        className="h-9" 
                      />
                      <CommandEmpty>No eligible members found.</CommandEmpty>
                      <CommandGroup>
                        {eligibleMembers.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={`${member.fullName} ${member.memberNumber}`}
                            onSelect={() => {
                              form.setValue("guarantorMemberId", member.id);
                              setOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {member.fullName || `${member.user?.firstName} ${member.user?.lastName}`}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {member.memberNumber} • {member.department || 'No Department'}
                              </span>
                            </div>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                member.id === field.value
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
                {selectedMember && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      Selected: {selectedMember.fullName} ({selectedMember.memberNumber})
                      {selectedMember.department && ` • ${selectedMember.department}`}
                    </span>
                  </div>
                )}
              </FormItem>
            )}
          />

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
            <div className="p-4 bg-red-50 border-2 border-red-400 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{formError}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={mutation.isPending || !selectedMember || !form.watch('guaranteeAmount')}
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