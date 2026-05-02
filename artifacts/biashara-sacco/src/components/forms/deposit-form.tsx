import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatCurrency } from "@/lib/utils";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
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
    queryFn: async () => {
      const res = await fetch(`/api/members/${selectedMemberId}/savings`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch savings accounts');
      return res.json();
    },
    enabled: !!selectedMemberId,
  });

  const memberOptions = useMemo(() => {
    return (members || []).map((member: any) => ({
      value: member.id.toString(),
      label: `${member.memberNumber} - ${member.fullName || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || 'Unknown'}`,
      searchText: `${member.memberNumber} ${member.fullName || ''} ${member.user?.firstName || ''} ${member.user?.lastName || ''} ${member.user?.email || ''}`.toLowerCase(),
    }));
  }, [members]);

  const selectedMemberLabel = memberOptions.find(m => m.value === selectedMemberId)?.label;

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
    form.setValue("accountId", "");
    setMemberSearchOpen(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="memberId"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Member *</FormLabel>
              <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={memberSearchOpen}
                      className={cn(
                        "w-full justify-between font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {selectedMemberLabel || "Search and select member..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command filter={(value, search) => {
                    const option = memberOptions.find(m => m.value === value);
                    if (!option) return 0;
                    return option.searchText.includes(search.toLowerCase()) ? 1 : 0;
                  }}>
                    <CommandInput placeholder="Type name or member number..." />
                    <CommandList>
                      <CommandEmpty>No member found.</CommandEmpty>
                      <CommandGroup>
                        {memberOptions.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={handleMemberChange}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedMemberId === option.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
