import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserCheck, CheckCircle, XCircle, Clock, DollarSign, FileText } from "lucide-react";

export default function GuarantorRequests() {
  const [selectedGuarantor, setSelectedGuarantor] = useState<any>(null);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [comments, setComments] = useState("");
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: guarantorRequests, isLoading: requestsLoading } = useQuery<any[]>({
    queryKey: ['/api/guarantors/pending'],
    enabled: isAuthenticated,
  });

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

  if (requestsLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
                <div className="h-8 bg-slate-200 rounded w-24"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Guarantor Requests</h2>
          <p className="text-slate-600 mt-1">Review and respond to loan guarantor requests</p>
        </div>
      </div>

      {/* Guarantor Requests */}
      {!guarantorRequests || guarantorRequests.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <UserCheck className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No pending guarantor requests</h3>
              <p className="text-slate-500">
                When members request you as a guarantor for their loans, they will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
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
    </>
  );
}