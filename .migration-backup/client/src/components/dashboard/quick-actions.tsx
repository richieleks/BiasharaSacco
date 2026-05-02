import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import MemberForm from "@/components/forms/member-form";
import DepositForm from "@/components/forms/deposit-form";
import LoanApplicationForm from "@/components/forms/loan-application-form";
import { UserPlus, PlusCircle, FileText, BarChart3 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function QuickActions() {
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const { toast } = useToast();

  const addMemberMutation = useMutation({
    mutationFn: async (memberData: any) => {
      await apiRequest('POST', '/api/members', memberData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      setIsMemberModalOpen(false);
      toast({ title: "Success",
        description: "Member added successfully!", variant: "success" });
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
        description: "Failed to add member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddMember = (memberData: any) => {
    addMemberMutation.mutate(memberData);
  };

  const handleGenerateReport = () => {
    toast({ title: "Report Generation",
      description: "Report generation started. You'll be notified when ready.", variant: "success" });
  };

  return (
    <>
      <div className="section-card">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick Actions</h3>
        </div>
        <div className="p-5 space-y-2.5">
          <Button
            onClick={() => setIsMemberModalOpen(true)}
            className="w-full sacco-gradient text-white hover:opacity-90 flex items-center justify-center rounded-xl h-10 text-sm font-medium shadow-sm"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add New Member
          </Button>

          <Button
            onClick={() => setIsDepositModalOpen(true)}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center rounded-xl h-10 text-sm font-medium shadow-sm"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Record Deposit
          </Button>

          <Button
            onClick={() => setIsLoanModalOpen(true)}
            className="w-full bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center rounded-xl h-10 text-sm font-medium shadow-sm"
          >
            <FileText className="w-4 h-4 mr-2" />
            Loan Application
          </Button>

          <Button
            onClick={handleGenerateReport}
            className="w-full bg-slate-700 text-white hover:bg-slate-800 flex items-center justify-center rounded-xl h-10 text-sm font-medium shadow-sm"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={isMemberModalOpen} onOpenChange={setIsMemberModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
            <DialogDescription>
              Fill in the member details to register a new member in the SACCO system.
            </DialogDescription>
          </DialogHeader>
          <MemberForm onSubmit={handleAddMember} isLoading={addMemberMutation.isPending} />
        </DialogContent>
      </Dialog>

      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Deposit</DialogTitle>
            <DialogDescription>
              Record a new deposit transaction for a member's savings account.
            </DialogDescription>
          </DialogHeader>
          <DepositForm onSuccess={() => setIsDepositModalOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isLoanModalOpen} onOpenChange={setIsLoanModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Loan Application</DialogTitle>
            <DialogDescription>
              Complete the loan application form to apply for a loan. You'll need to add guarantors after submission.
            </DialogDescription>
          </DialogHeader>
          <LoanApplicationForm onSuccess={() => setIsLoanModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
