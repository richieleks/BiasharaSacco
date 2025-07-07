import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Clock, CheckCircle, XCircle, FileText, DollarSign, CreditCard, UserCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { GuarantorWithDetails, MemberWithDetails } from "@shared/schema";

export default function Guarantors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'my-loans' | 'requests' | 'provided'>('my-loans');
  const [selectedGuarantor, setSelectedGuarantor] = useState<any>(null);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [comments, setComments] = useState("");

  const { data: currentMember } = useQuery<MemberWithDetails>({
    queryKey: [`/api/members/by-user/${user?.id || 'undefined'}`],
    enabled: !!user?.id,
  });

  // Get user's own loan applications 
  const { data: myLoans = [], isLoading: loadingMyLoans } = useQuery<any[]>({
    queryKey: ['/api/loans/my-loans'],
    enabled: !!user?.id,
  });

  // Get pending guarantor requests for current user to approve/reject
  const { data: guarantorRequests = [], isLoading: loadingRequests } = useQuery<GuarantorWithDetails[]>({
    queryKey: ['/api/guarantors/pending'],
    enabled: !!user?.id,
  });

  // Get guarantees provided by current user
  const { data: providedGuarantees = [], isLoading: loadingProvided } = useQuery<GuarantorWithDetails[]>({
    queryKey: ['/api/guarantors/member', currentMember?.id],
    enabled: !!currentMember?.id,
  });

  // Filter loans that need guarantors
  const loansNeedingGuarantors = myLoans.filter(loan => 
    loan.status === 'pending' || (loan.status === 'approved' && !loan.guarantorsApproved)
  );

  const approveGuarantorMutation = useMutation({
    mutationFn: async ({ guarantorId, comments }: { guarantorId: number; comments: string }) => {
      await apiRequest('PATCH', `/api/guarantors/${guarantorId}/approve`, { comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/pending'] });
      toast({
        title: "Success",
        description: "Guarantor request approved successfully!",
      });
      setIsApprovalDialogOpen(false);
      setComments("");
      setSelectedGuarantor(null);
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
        description: error.message || "Failed to approve guarantor request",
        variant: "destructive",
      });
    },
  });

  const rejectGuarantorMutation = useMutation({
    mutationFn: async ({ guarantorId, comments }: { guarantorId: number; comments: string }) => {
      await apiRequest('PATCH', `/api/guarantors/${guarantorId}/reject`, { comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/pending'] });
      toast({
        title: "Success",
        description: "Guarantor request rejected successfully!",
      });
      setIsApprovalDialogOpen(false);
      setComments("");
      setSelectedGuarantor(null);
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
        description: error.message || "Failed to reject guarantor request",
        variant: "destructive",
      });
    },
  });

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'approved':
      case 'active':
      case 'disbursed':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
      case 'disbursed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const handleApprove = () => {
    if (selectedGuarantor) {
      approveGuarantorMutation.mutate({
        guarantorId: selectedGuarantor.id,
        comments: comments.trim()
      });
    }
  };

  const handleReject = () => {
    if (selectedGuarantor && comments.trim()) {
      rejectGuarantorMutation.mutate({
        guarantorId: selectedGuarantor.id,
        comments: comments.trim()
      });
    } else {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
    }
  };

  const openApprovalDialog = (guarantor: any) => {
    setSelectedGuarantor(guarantor);
    setComments("");
    setIsApprovalDialogOpen(true);
  };

  if (!currentMember) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading member information...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guarantor Management</h1>
          <p className="text-muted-foreground">
            Manage guarantor requests and view guarantees you've provided
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 rounded-lg bg-muted p-1">
        <Button
          variant={activeTab === 'my-loans' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('my-loans')}
          className="flex-1"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          My Loan Applications ({loansNeedingGuarantors.length})
        </Button>
        <Button
          variant={activeTab === 'requests' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('requests')}
          className="flex-1"
        >
          <Clock className="h-4 w-4 mr-2" />
          Requests to Guarantee ({guarantorRequests.length})
        </Button>
        <Button
          variant={activeTab === 'provided' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('provided')}
          className="flex-1"
        >
          <Users className="h-4 w-4 mr-2" />
          Guarantees Provided ({providedGuarantees.length})
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'my-loans' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              My Loan Applications Awaiting Guarantors ({loansNeedingGuarantors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMyLoans ? (
              <div className="text-center py-4">
                <div className="text-muted-foreground">Loading your loans...</div>
              </div>
            ) : loansNeedingGuarantors.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="text-lg font-medium">No Loans Awaiting Guarantors</div>
                <div className="text-muted-foreground">
                  All your loan applications either have guarantors or don't require them
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {loansNeedingGuarantors.map((loan: any) => (
                  <div key={loan.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-medium">
                          Loan Application #{loan.loanNumber}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Amount: UGX {Number(loan.principalAmount || 0).toLocaleString()} |
                          Type: {loan.loanType} |
                          Term: {loan.termMonths} months
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Purpose: {loan.purpose}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(loan.status)}
                        <Badge variant={getStatusVariant(loan.status)}>
                          {loan.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      Applied on: {new Date(loan.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'requests' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Requests for Me to Guarantee ({guarantorRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="text-center py-4">
                <div className="text-muted-foreground">Loading guarantor requests...</div>
              </div>
            ) : guarantorRequests.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="text-lg font-medium">No Pending Guarantor Requests</div>
                <div className="text-muted-foreground">
                  When members request you as a guarantor for their loans, they will appear here
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {guarantorRequests.map((request: any) => (
                  <Card key={request.id} className="border-l-4 border-l-amber-400">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-amber-600" />
                          <span>Loan Guarantee Request</span>
                        </div>
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Loan Details */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-slate-900">Loan Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Loan Number:</span>
                              <span className="font-medium">{request.loan?.loanNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Applicant:</span>
                              <span className="font-medium">
                                {request.loan?.member?.user?.firstName} {request.loan?.member?.user?.lastName}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Member Number:</span>
                              <span className="font-medium">{request.loan?.member?.memberNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Loan Amount:</span>
                              <span className="font-medium">UGX {Number(request.loan?.principalAmount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Loan Type:</span>
                              <span className="font-medium capitalize">{request.loan?.loanType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Term:</span>
                              <span className="font-medium">{request.loan?.termMonths} months</span>
                            </div>
                          </div>
                        </div>

                        {/* Guarantee Details */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-slate-900">Your Guarantee</h4>
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-blue-900">Amount to Guarantee</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-900">
                              UGX {Number(request.guaranteeAmount).toLocaleString()}
                            </div>
                            <div className="text-sm text-blue-700 mt-1">
                              You are being asked to guarantee this amount for the loan
                            </div>
                          </div>
                          
                          <div className="text-sm text-slate-600">
                            <p><strong>Request Date:</strong> {new Date(request.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 mt-6 pt-4 border-t">
                        <Button
                          onClick={() => openApprovalDialog(request)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve Guarantee
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openApprovalDialog(request)}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject Request
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'provided' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guarantees I've Provided ({providedGuarantees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProvided ? (
              <div className="text-center py-4">
                <div className="text-muted-foreground">Loading guarantees...</div>
              </div>
            ) : providedGuarantees.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="text-lg font-medium">No Guarantees Provided</div>
                <div className="text-muted-foreground">
                  You haven't provided any guarantees yet
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {providedGuarantees.map((guarantee: GuarantorWithDetails) => (
                  <div key={guarantee.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-medium">
                          Loan for {guarantee.loan?.member?.user?.firstName} {guarantee.loan?.member?.user?.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Loan: UGX {Number(guarantee.loan?.principalAmount || 0).toLocaleString()} |
                          Your Guarantee: UGX {Number(guarantee.guaranteeAmount || 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Loan Type: {guarantee.loan?.loanType} | 
                          Term: {guarantee.loan?.termMonths} months |
                          Status: {guarantee.loan?.status}
                        </div>
                        {guarantee.comments && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Your Comment: {guarantee.comments}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(guarantee.status || 'pending')}
                        <Badge variant={getStatusVariant(guarantee.status || 'pending')}>
                          {guarantee.status || 'pending'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-2">
                      <span>
                        Guaranteed on: {guarantee.createdAt ? new Date(guarantee.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                      {guarantee.status === 'approved' && guarantee.approvedAt && (
                        <span>
                          Approved on: {new Date(guarantee.approvedAt!).toLocaleDateString()}
                        </span>
                      )}
                      {guarantee.status === 'rejected' && guarantee.rejectedAt && (
                        <span>
                          Rejected on: {new Date(guarantee.rejectedAt!).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approval/Rejection Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedGuarantor ? 'Respond to Guarantee Request' : 'Guarantee Request'}
            </DialogTitle>
          </DialogHeader>
          {selectedGuarantor && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Applicant:</strong> {selectedGuarantor.loan?.member?.user?.firstName} {selectedGuarantor.loan?.member?.user?.lastName}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Guarantee Amount:</strong> UGX {Number(selectedGuarantor.guaranteeAmount).toLocaleString()}
                </p>
              </div>
              
              <div>
                <label htmlFor="comments" className="block text-sm font-medium mb-2">
                  Comments (optional for approval, required for rejection)
                </label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Add any comments or reasons for your decision..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={approveGuarantorMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Guarantee
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={rejectGuarantorMutation.isPending || !comments.trim()}
                  className="border-red-300 text-red-700 hover:bg-red-50 flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Request
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}