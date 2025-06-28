import { useState } from "react";
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

const withdrawalFormSchema = z.object({
  memberId: z.string().min(1, "Please select a member"),
  accountId: z.string().min(1, "Please select an account"),
  amount: z.string().min(1, "Amount is required").refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  description: z.string().optional(),
});

type WithdrawalFormData = z.infer<typeof withdrawalFormSchema>;

interface WithdrawalFormProps {
  onSuccess: () => void;
}

export default function WithdrawalForm({ onSuccess }: WithdrawalFormProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const { toast } = useToast();

  const form = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalFormSchema),
    defaultValues: {
      memberId: "",
      accountId: "",
      amount: "",
      description: "",
    },
  });

  const { data: members } = useQuery<any[]>({
    queryKey: ['/api/members'],
  });

  const { data: accounts } = useQuery<any[]>({
    queryKey: ['/api/members', selectedMemberId, 'savings'],
    enabled: !!selectedMemberId,
  });

  const withdrawalMutation = useMutation({
    mutationFn: async (data: { accountId: number; amount: string; description?: string }) => {
      await apiRequest('POST', '/api/savings/withdraw', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      onSuccess();
      toast({
        title: "Success",
        description: "Withdrawal request submitted successfully! Awaiting approval.",
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
        description: "Failed to submit withdrawal request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: WithdrawalFormData) => {
    const selectedAccount = accounts?.find((account: any) => account.id.toString() === data.accountId);
    const requestAmount = parseFloat(data.amount);
    const availableBalance = parseFloat(selectedAccount?.balance || "0");

    if (requestAmount > availableBalance) {
      toast({
        title: "Insufficient Funds",
        description: `Available balance is UGX ${availableBalance.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    withdrawalMutation.mutate({
      accountId: parseInt(data.accountId),
      amount: data.amount,
      description: data.description,
    });
  };

  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);
    form.setValue("memberId", memberId);
    form.setValue("accountId", ""); // Reset account selection
  };

  const selectedAccount = accounts?.find((account: any) => account.id.toString() === form.watch("accountId"));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="memberId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Member *</FormLabel>
              <Select onValueChange={handleMemberChange} value={field.value}>
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
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Savings Account *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!selectedMemberId}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select savings account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accounts?.map((account: any) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.accountNumber} ({account.accountType}) - UGX {parseFloat(account.balance).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedAccount && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Available Balance:</span> UGX {parseFloat(selectedAccount.balance).toLocaleString()}
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (UGX) *</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  min="1" 
                  step="0.01" 
                  max={selectedAccount ? selectedAccount.balance : undefined}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional description for this withdrawal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <span className="font-medium">Note:</span> Withdrawal requests require approval before processing.
          </p>
        </div>

        <div className="flex items-center space-x-4 pt-6 border-t border-slate-200">
          <Button type="button" variant="outline" className="flex-1" onClick={onSuccess}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={withdrawalMutation.isPending}
            className="flex-1 bg-red-600 text-white hover:bg-red-700"
          >
            {withdrawalMutation.isPending ? "Submitting..." : "Submit Withdrawal Request"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
