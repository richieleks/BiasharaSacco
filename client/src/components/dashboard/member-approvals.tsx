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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, XCircle, User, Phone, MapPin, Calendar } from "lucide-react";
import type { MemberWithDetails } from "@shared/schema";

export default function MemberApprovals() {
  const [selectedMember, setSelectedMember] = useState<MemberWithDetails | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [comments, setComments] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if user has committee or admin role using multi-role support
  const userRoles = user?.member?.roles || (user?.member?.role ? [user.member.role] : []);
  const hasApprovalAccess = hasAnyRole(userRoles, ['committee', 'admin']);

  const { data: pendingMembers, isLoading } = useQuery<MemberWithDetails[]>({
    queryKey: ['/api/members/pending'],
    enabled: hasApprovalAccess,
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ uuid, comments }: { uuid: string; comments?: string }) => {
      await apiRequest('POST', `/api/members/${uuid}/approve`, { comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      setIsDialogOpen(false);
      setComments("");
      toast({
        title: "Member Approved",
        description: "Member application has been approved successfully!",
      });
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
        description: "Failed to approve member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ uuid, comments }: { uuid: string; comments?: string }) => {
      await apiRequest('POST', `/api/members/${uuid}/reject`, { comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      setIsDialogOpen(false);
      setComments("");
      toast({
        title: "Application Rejected",
        description: "Member application has been rejected.",
      });
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
        description: "Failed to reject member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAction = (member: MemberWithDetails, action: 'approve' | 'reject') => {
    setSelectedMember(member);
    setActionType(action);
    setIsDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedMember || !actionType) return;

    if (actionType === 'approve') {
      approveMutation.mutate({ uuid: selectedMember.uuid, comments });
    } else {
      rejectMutation.mutate({ uuid: selectedMember.uuid, comments });
    }
  };

  if (!hasApprovalAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Member Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Access denied. Committee or admin role required to view pending member applications.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Member Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading pending applications...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Pending Member Approvals
          {pendingMembers && pendingMembers.length > 0 && (
            <Badge variant="secondary">{pendingMembers.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!pendingMembers || pendingMembers.length === 0 ? (
          <p className="text-muted-foreground">No pending member applications.</p>
        ) : (
          <div className="space-y-4">
            {pendingMembers.map((member) => (
              <div key={member.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{member.fullName}</h3>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        ID: {member.idNumber}
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {member.phoneNumber}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {member.department}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Applied: {new Date(member.createdAt!).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="text-sm">
                      <p><strong>Member Number:</strong> {member.memberNumber}</p>
                      <p><strong>Monthly Savings:</strong> UGX {Number(member.monthlySavings).toLocaleString()}</p>
                      <p><strong>Share Contribution:</strong> UGX {Number(member.shareContribution).toLocaleString()}</p>
                      <p><strong>Beneficiary:</strong> {member.beneficiaryName} ({member.beneficiaryRelationship})</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction(member, 'approve')}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(member, 'reject')}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approve' ? 'Approve' : 'Reject'} Member Application
              </DialogTitle>
              <DialogDescription>
                {actionType === 'approve' 
                  ? 'Are you sure you want to approve this member application? This will activate their membership and create a savings account.'
                  : 'Are you sure you want to reject this member application? This action cannot be undone.'
                }
              </DialogDescription>
            </DialogHeader>
            
            {selectedMember && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p><strong>Name:</strong> {selectedMember.fullName}</p>
                  <p><strong>ID Number:</strong> {selectedMember.idNumber}</p>
                  <p><strong>Member Number:</strong> {selectedMember.memberNumber}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Comments {actionType === 'reject' ? '(Required)' : '(Optional)'}
                  </label>
                  <Textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder={
                      actionType === 'approve' 
                        ? "Optional approval comments..."
                        : "Please provide reason for rejection..."
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
                      (actionType === 'reject' && !comments.trim()) ||
                      approveMutation.isPending || 
                      rejectMutation.isPending
                    }
                    className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                    variant={actionType === 'reject' ? 'destructive' : 'default'}
                  >
                    {approveMutation.isPending || rejectMutation.isPending ? 'Processing...' : 
                     actionType === 'approve' ? 'Approve Member' : 'Reject Application'}
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