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
import { formatCurrency } from "@/lib/utils";

const depositFormSchema = z.object({
  memberId: z.string().min(1, "Please select a member"),
  accountId: z.string().min(1, "Please select an account"),
  amount: z.string().min(1, "Amount is required").refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  description: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositFormSchema>;

interface DepositFormProps {
  onSuccess: () => void;
}

export default function DepositForm({ onSuccess }: DepositFormProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const { toast } = useToast();

  const form = useForm<DepositFormData>({
    resolver: zodResolver(depositFormSchema),
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

  const depositMutation = useMutation({
    mutationFn: async (data: { accountId: number; amount: string; description?: string }) => {
      await apiRequest('POST', '/api/savings/deposit', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/recent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      onSuccess();
      toast({ title: "Success",
        description: "Deposit recorded successfully!", variant: "success" });
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
        description: "Failed to record deposit. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: DepositFormData) => {
    depositMutation.mutate({
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
                      {member.memberNumber} - {member.fullName || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || 'Unknown'}
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
                      {account.accountNumber} ({account.accountType}) - {formatCurrency(account.balance)}
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
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (UGX) *</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0.00" min="1" step="0.01" {...field} />
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
                <Textarea placeholder="Optional description for this deposit" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center space-x-4 pt-6 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="outline" className="flex-1" onClick={onSuccess}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={depositMutation.isPending}
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
          >
            {depositMutation.isPending ? "Recording..." : "Record Deposit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
