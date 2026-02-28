import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Clock, MessageSquare } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { GuarantorWithDetails } from "@shared/schema";

interface GuarantorRequestsProps {
  memberId: number;
}

export default function GuarantorRequests({ memberId }: GuarantorRequestsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [comments, setComments] = useState("");

  const { data: pendingRequests = [], isLoading } = useQuery<GuarantorWithDetails[]>({
    queryKey: ['/api/guarantors/pending', memberId],
    queryFn: async () => {
      const res = await fetch(`/api/guarantors/pending/${memberId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch pending requests');
      return res.json();
    },
    enabled: !!memberId,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ guarantorId, comments }: { guarantorId: number; comments?: string }) => {
      await apiRequest('PATCH', `/api/guarantors/${guarantorId}/approve`, { comments });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Guarantor request approved",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/pending', memberId] });
      setActioningId(null);
      setComments("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ guarantorId, comments }: { guarantorId: number; comments?: string }) => {
      await apiRequest('PATCH', `/api/guarantors/${guarantorId}/reject`, { comments });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Guarantor request rejected",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/pending', memberId] });
      setActioningId(null);
      setComments("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (guarantorId: number) => {
    approveMutation.mutate({ guarantorId, comments });
  };

  const handleReject = (guarantorId: number) => {
    rejectMutation.mutate({ guarantorId, comments });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Guarantor Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-muted-foreground">Loading requests...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Guarantor Requests ({pendingRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingRequests.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-muted-foreground">No pending guarantor requests</div>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request: GuarantorWithDetails) => (
              <div key={request.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="font-medium">
                      Loan Request from {request.loan?.member?.user?.firstName} {request.loan?.member?.user?.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Member: {request.loan?.member?.memberNumber} | 
                      Loan: {formatCurrency(request.loan?.principalAmount)} |
                      Guarantee: {formatCurrency(request.guaranteeAmount)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Loan Type: {request.loan?.loanType} | 
                      Term: {request.loan?.termMonths} months
                    </div>
                  </div>
                  <Badge variant="secondary">
                    Pending
                  </Badge>
                </div>

                {actioningId === request.id ? (
                  <div className="space-y-3 border-t pt-3">
                    <div>
                      <Label htmlFor={`comments-${request.id}`}>Comments (Optional)</Label>
                      <Textarea
                        id={`comments-${request.id}`}
                        placeholder="Add your comments..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(request.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActioningId(null);
                          setComments("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActioningId(request.id)}
                      className="flex-1"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Respond
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}