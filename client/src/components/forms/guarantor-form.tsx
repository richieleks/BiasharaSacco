import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertGuarantorSchema } from "@shared/schema";
import type { MemberWithDetails } from "@shared/schema";

const guarantorFormSchema = insertGuarantorSchema.extend({
  guarantorMemberNumber: z.string().min(1, "Guarantor is required"),
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
  const [selectedMember, setSelectedMember] = useState<MemberWithDetails | null>(null);

  const form = useForm<GuarantorFormData>({
    resolver: zodResolver(guarantorFormSchema),
    defaultValues: {
      loanId,
      guarantorMemberId: 0,
      guaranteeAmount: "",
      status: "pending",
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['/api/members'],
  });

  const mutation = useMutation({
    mutationFn: async (data: GuarantorFormData) => {
      const member = members.find((m: MemberWithDetails) => m.memberNumber === data.guarantorMemberNumber);
      if (!member) {
        throw new Error("Invalid guarantor member number");
      }

      const guarantorData = {
        ...data,
        guarantorMemberId: member.id,
      };

      await apiRequest('/api/guarantors', {
        method: 'POST',
        body: JSON.stringify(guarantorData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Guarantor request sent successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/loan', loanId] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add guarantor",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: GuarantorFormData) => {
    mutation.mutate(data);
  };

  const handleMemberNumberChange = (memberNumber: string) => {
    const member = members.find((m: MemberWithDetails) => m.memberNumber === memberNumber);
    if (member) {
      setSelectedMember(member);
      form.setValue('guarantorMemberId', member.id);
    } else {
      setSelectedMember(null);
      form.setValue('guarantorMemberId', 0);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Add Guarantor</h3>
        <p className="text-sm text-muted-foreground">
          Add a guarantor for this loan application. The guarantor must be an existing member and must approve the request.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="guarantorMemberNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guarantor Member Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter member number"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleMemberNumberChange(e.target.value);
                    }}
                  />
                </FormControl>
                <FormMessage />
                {selectedMember && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedMember.user?.firstName} {selectedMember.user?.lastName}
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
                <FormLabel>Guarantee Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={mutation.isPending || !selectedMember}
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