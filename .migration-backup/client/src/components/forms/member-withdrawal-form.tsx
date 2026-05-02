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
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";

const memberWithdrawalSchema = z.object({
  accountId: z.string().min(1, "Please select an account"),
  amount: z.string().min(1, "Amount is required").refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  description: z.string().optional(),
});

type MemberWithdrawalData = z.infer<typeof memberWithdrawalSchema>;

interface MemberWithdrawalFormProps {
  onSuccess: () => void;
}

export default function MemberWithdrawalForm({ onSuccess }: MemberWithdrawalFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<MemberWithdrawalData>({
    resolver: zodResolver(memberWithdrawalSchema),
    defaultValues: {
      accountId: "",
      amount: "",
      description: "",
    },
  });

  const { data: accounts } = useQuery<any[]>({
    queryKey: ['/api/savings/my-savings'],
    queryFn: async () => {
      const res = await fetch('/api/savings/my-savings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      return data.data || data;
    },
    enabled: !!user,
  });

  const withdrawalMutation = useMutation({
    mutationFn: async (data: { accountId: number; amount: string; description?: string }) => {
      await apiRequest('POST', '/api/savings/withdraw', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/savings/my-savings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/my-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      onSuccess();
      toast({
        title: "Withdrawal request submitted",
        description: "Your request has been submitted and is pending approval.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit withdrawal request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: MemberWithdrawalData) => {
    const selectedAccount = accounts?.find((a: any) => a.id.toString() === data.accountId);
    const requestAmount = parseFloat(data.amount);
    const availableBalance = parseFloat(selectedAccount?.balance || "0");

    if (requestAmount > availableBalance) {
      toast({
        title: "Insufficient Funds",
        description: `Your available balance is ${formatCurrency(availableBalance)}`,
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

  const selectedAccount = accounts?.find((a: any) => a.id.toString() === form.watch("accountId"));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Savings Account *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-withdrawal-account">
                    <SelectValue placeholder="Select your savings account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accounts?.map((account: any) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.accountNumber} ({account.accountType}) - {formatCurrency(account.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedAccount && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300" data-testid="text-available-balance">
              <span className="font-medium">Available Balance:</span> {formatCurrency(selectedAccount.balance)}
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
                  placeholder="Enter amount"
                  min="1"
                  step="1"
                  max={selectedAccount ? selectedAccount.balance : undefined}
                  data-testid="input-withdrawal-amount"
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
              <FormLabel>Reason for withdrawal</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional - describe the reason for this withdrawal"
                  data-testid="input-withdrawal-description"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            <span className="font-medium">Note:</span> Withdrawal requests require approval by the SACCO administration before processing.
          </p>
        </div>

        <div className="flex items-center space-x-4 pt-6 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="outline" className="flex-1" onClick={onSuccess} data-testid="button-cancel-withdrawal">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={withdrawalMutation.isPending}
            className="flex-1 bg-red-600 text-white hover:bg-red-700"
            data-testid="button-submit-withdrawal"
          >
            {withdrawalMutation.isPending ? "Submitting..." : "Submit Withdrawal Request"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
