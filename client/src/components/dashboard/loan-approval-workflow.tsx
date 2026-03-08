import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { hasAnyRole } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, User, DollarSign, Calendar, FileText, AlertTriangle, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { LoanWithDetails } from "@shared/schema";

interface ApprovalAction {
  loan: LoanWithDetails;
  stage: string;
  action: 'approve' | 'reject';
}

export default function LoanApprovalWorkflow() {
  const [selectedAction, setSelectedAction] = useState<ApprovalAction | null>(null);
  const [comments, setComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("committee");
  const { toast } = useToast();
  const { user } = useAuth();

  const userRoles = user?.member?.roles || (user?.member?.role ? [user.member.role] : (user?.role ? [user.role] : []));
  const mappedRoles = userRoles.map((role: any) => role === 'teller' ? 'treasurer' : role);
  const isAdmin = hasAnyRole(mappedRoles as any, ['admin']);
  const canAccessTreasurer = hasAnyRole(mappedRoles as any, ['treasurer']);
  const canViewTreasurer = hasAnyRole(mappedRoles as any, ['treasurer', 'admin']);
  const canAccessCommittee = hasAnyRole(mappedRoles as any, ['committee']);
  const canApproveCommittee = hasAnyRole(mappedRoles as any, ['committee']) && !isAdmin;
  const canViewCommittee = hasAnyRole(mappedRoles as any, ['committee', 'treasurer', 'admin']);

  useState(() => {
    const primaryRole = (user?.member?.role || user?.role) as string | undefined;
    if (primaryRole === 'committee') setActiveTab('committee');
    else if (primaryRole && (primaryRole === 'treasurer' || primaryRole === 'teller')) setActiveTab('treasurer');
  });

  // Fetch loans for each approval stage
  const { data: committeeLoans, isLoading: committeeLoading } = useQuery<LoanWithDetails[]>({
    queryKey: ['/api/loans/approval/committee'],
    enabled: canViewCommittee,
    refetchInterval: 30000,
  });

  const { data: treasurerLoans, isLoading: treasurerLoading } = useQuery<LoanWithDetails[]>({
    queryKey: ['/api/loans/approval/treasurer'],
    enabled: canViewTreasurer,
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ loan, stage, comments }: { loan: any; stage: string; comments?: string }) => {
      const response = await apiRequest('POST', `/api/loans/${loan.uuid}/approve/${stage}`, { comments });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans/approval'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      setIsDialogOpen(false);
      setComments("");
      toast({ title: "Approval Recorded",
        description: data.message || `Loan has been approved at ${selectedAction?.stage} stage.`, variant: "success" });
    },
    onError: (error: any) => {
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
        description: "Failed to approve loan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ loan, reason }: { loan: any; reason: string }) => {
      await apiRequest('POST', `/api/loans/${loan.uuid}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans/approval'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      setIsDialogOpen(false);
      setRejectionReason("");
      toast({ title: "Loan Rejected",
        description: "Loan application has been rejected.", variant: "warning" });
    },
    onError: (error: any) => {
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
        description: "Failed to reject loan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAction = (loan: LoanWithDetails, stage: string, action: 'approve' | 'reject') => {
    setSelectedAction({ loan, stage, action });
    setIsDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedAction) return;

    if (selectedAction.action === 'approve') {
      approveMutation.mutate({ 
        loan: selectedAction.loan, 
        stage: selectedAction.stage, 
        comments 
      });
    } else {
      rejectMutation.mutate({ 
        loan: selectedAction.loan, 
        reason: rejectionReason 
      });
    }
  };

  const getStatusBadge = (status: string, stage: string) => {
    const badges: Record<string, { variant: any; text: string; icon: any }> = {
      'pending': { variant: 'secondary', text: 'Pending Committee Review', icon: Clock },
      'committee_approved': { variant: 'default', text: 'Committee Approved', icon: CheckCircle },
      'approved': { variant: 'default', text: 'Approved - Awaiting Disbursement', icon: CheckCircle },
      'disbursed': { variant: 'default', text: 'Disbursed', icon: CheckCircle },
      'rejected': { variant: 'destructive', text: 'Rejected', icon: XCircle },
    };

    const config = badges[status] || { variant: 'secondary', text: status, icon: Clock };
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <IconComponent className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const LoanCard = ({ loan, stage, canApprove }: { loan: LoanWithDetails; stage: string; canApprove: boolean }) => {
    const { data: approvalData } = useQuery<{ approvals: any[]; approvalCount: number; minApprovers: number; isFullyApproved: boolean }>({
      queryKey: ['/api/loans', loan.id, 'approvals'],
      queryFn: async () => {
        const res = await fetch(`/api/loans/${loan.id}/approvals`, { credentials: 'include' });
        return res.json();
      },
      enabled: stage === 'committee',
      refetchInterval: 15000,
    });

    const currentUserAlreadyApproved = approvalData?.approvals?.some(
      (a: any) => a.approvedBy === user?.id
    );

    return (
      <div key={loan.id} className="border rounded-lg p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{loan.member?.fullName}</h3>
              {getStatusBadge(loan.status!, loan.approvalStage!)}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Loan #{loan.loanNumber}
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {formatCurrency(loan.principalAmount)}
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {loan.loanType} ({loan.termMonths} months)
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Applied: {new Date(loan.applicationDate!).toLocaleDateString()}
              </div>
            </div>

            <div className="text-sm">
              <p><strong>Purpose:</strong> {loan.purpose || 'Not specified'}</p>
              <p><strong>Monthly Payment:</strong> {formatCurrency(loan.monthlyPayment)}</p>
              {loan.averageNetPay && (
                <p><strong>Average Net Pay:</strong> {formatCurrency(loan.averageNetPay)}</p>
              )}
            </div>

            {stage === 'committee' && approvalData && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded">
                <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">
                    Committee Approvals: {approvalData.approvalCount}/{approvalData.minApprovers}
                  </span>
                </div>
                {approvalData.approvals.length > 0 && (
                  <div className="mt-1 text-xs text-blue-700 space-y-0.5">
                    {approvalData.approvals.map((a: any, i: number) => (
                      <p key={i}>✓ {a.approverName} — {new Date(a.createdAt).toLocaleDateString()}</p>
                    ))}
                  </div>
                )}
                {currentUserAlreadyApproved && (
                  <p className="text-xs text-blue-600 mt-1 font-medium">You have already approved this loan.</p>
                )}
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              {loan.committeeApprovedAt && (
                <p>✓ Committee reviewed: {new Date(loan.committeeApprovedAt).toLocaleDateString()}</p>
              )}
              {loan.tellerApprovedAt && (
                <p>✓ Treasurer approved: {new Date(loan.tellerApprovedAt).toLocaleDateString()}</p>
              )}
              {loan.managerApprovedAt && (
                <p>✓ Admin approved: {new Date(loan.managerApprovedAt).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {canApprove && !currentUserAlreadyApproved && (
            <div className="flex gap-2 ml-4">
              <Button
                size="sm"
                onClick={() => handleAction(loan, stage, 'approve')}
                className="bg-green-600 hover:bg-green-700"
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAction(loan, stage, 'reject')}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}

          {canApprove && currentUserAlreadyApproved && (
            <div className="ml-4">
              <Badge variant="outline" className="text-green-700 border-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                Approved
              </Badge>
            </div>
          )}
        </div>

        {parseFloat(loan.principalAmount) > 500000 && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">High-value loan - requires careful risk assessment</span>
          </div>
        )}
      </div>
    );
  };

  if (!canViewTreasurer && !canViewCommittee) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loan Approval Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Access denied. You need treasurer or committee role to view loan approvals.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Approval Workflow</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="committee" disabled={!canViewCommittee}>
              Committee Review
              {committeeLoans && committeeLoans.length > 0 && (
                <Badge variant="secondary" className="ml-2">{committeeLoans.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="treasurer" disabled={!canViewTreasurer}>
              Treasurer Disbursement
              {treasurerLoans && treasurerLoans.length > 0 && (
                <Badge variant="secondary" className="ml-2">{treasurerLoans.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="committee" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Detailed evaluation of loan request, risk assessment, and approval of terms and conditions
              </div>
              {committeeLoading ? (
                <p>Loading committee review queue...</p>
              ) : !committeeLoans || committeeLoans.length === 0 ? (
                <p className="text-muted-foreground">No loans pending committee review.</p>
              ) : (
                <div className="space-y-4">
                  {committeeLoans.map(loan => (
                    <LoanCard 
                      key={loan.id} 
                      loan={loan} 
                      stage="committee" 
                      canApprove={canApproveCommittee} 
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="treasurer" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Disburse approved funds to member accounts
              </div>
              {treasurerLoading ? (
                <p>Loading treasurer approval queue...</p>
              ) : !treasurerLoans || treasurerLoans.length === 0 ? (
                <p className="text-muted-foreground">No loans pending treasurer approval.</p>
              ) : (
                <div className="space-y-4">
                  {treasurerLoans.map(loan => (
                    <LoanCard 
                      key={loan.id} 
                      loan={loan} 
                      stage="treasurer" 
                      canApprove={canAccessTreasurer} 
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedAction?.action === 'approve' ? 'Approve' : 'Reject'} Loan Application
              </DialogTitle>
              <DialogDescription>
                {selectedAction?.action === 'approve' 
                  ? `Approve this loan at the ${selectedAction.stage} stage. This will move it to the next approval level.`
                  : 'Reject this loan application. This action cannot be undone and will notify the applicant.'
                }
              </DialogDescription>
            </DialogHeader>
            
            {selectedAction && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p><strong>Applicant:</strong> {selectedAction.loan.member?.fullName}</p>
                  <p><strong>Loan Number:</strong> {selectedAction.loan.loanNumber}</p>
                  <p><strong>Amount:</strong> {formatCurrency(selectedAction.loan.principalAmount)}</p>
                  <p><strong>Type:</strong> {selectedAction.loan.loanType}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {selectedAction.action === 'approve' ? 'Comments (Optional)' : 'Rejection Reason (Required)'}
                  </label>
                  <Textarea
                    value={selectedAction.action === 'approve' ? comments : rejectionReason}
                    onChange={(e) => {
                      if (selectedAction.action === 'approve') {
                        setComments(e.target.value);
                      } else {
                        setRejectionReason(e.target.value);
                      }
                    }}
                    placeholder={
                      selectedAction.action === 'approve' 
                        ? "Optional comments about the approval..."
                        : "Please provide detailed reason for rejection..."
                    }
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmAction}
                    disabled={
                      (selectedAction.action === 'reject' && !rejectionReason.trim()) ||
                      approveMutation.isPending || 
                      rejectMutation.isPending
                    }
                    className={selectedAction.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                    variant={selectedAction.action === 'reject' ? 'destructive' : 'default'}
                  >
                    {approveMutation.isPending || rejectMutation.isPending ? 'Processing...' : 
                     selectedAction.action === 'approve' ? `Approve at ${selectedAction.stage} Stage` : 'Reject Application'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}