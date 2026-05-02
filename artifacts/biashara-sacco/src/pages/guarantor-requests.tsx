import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Clock, MessageSquare, ShieldCheck, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import type { GuarantorWithDetails } from "@workspace/db";

export default function GuarantorRequestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [comments, setComments] = useState("");

  const { data: pendingRequests = [], isLoading } = useQuery<GuarantorWithDetails[]>({
    queryKey: ['/api/guarantors/pending'],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ guarantorId, comments }: { guarantorId: number; comments?: string }) => {
      await apiRequest('PATCH', `/api/guarantors/${guarantorId}/approve`, { comments });
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Guarantor request approved", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      setActioningId(null);
      setComments("");
    },
    onError: (error: any) => {
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
      toast({ title: "Rejected", description: "Guarantor request rejected" });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      setActioningId(null);
      setComments("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/')} data-testid="button-back-dashboard">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Guarantor Requests
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Review and respond to requests from members who need you as a guarantor</p>
          </div>
        </div>

        <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/50 p-1.5">
                <Clock className="h-3.5 w-3.5 text-yellow-600" />
              </div>
              Pending Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <ShieldCheck className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No pending guarantor requests</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">When a member requests you as a guarantor, it will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request: GuarantorWithDetails) => (
                  <div key={request.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-testid={`card-guarantor-request-${request.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          Loan Request from {request.loan?.member?.user?.firstName} {request.loan?.member?.user?.lastName}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                          <div>Member: {request.loan?.member?.memberNumber}</div>
                          <div>Loan Amount: {formatCurrency(request.loan?.principalAmount)} | Term: {request.loan?.termMonths} months</div>
                          <div className="font-medium text-slate-700 dark:text-slate-300">
                            Your Guarantee: {formatCurrency(request.guaranteeAmount)}
                          </div>
                        </div>
                      </div>
                      <Badge className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400">
                        Pending
                      </Badge>
                    </div>

                    {actioningId === request.id ? (
                      <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                        <div>
                          <Label htmlFor={`comments-${request.id}`} className="text-sm text-slate-700 dark:text-slate-300">Comments (Optional)</Label>
                          <Textarea
                            id={`comments-${request.id}`}
                            placeholder="Add your comments..."
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            className="mt-1"
                            data-testid={`input-guarantor-comments-${request.id}`}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate({ guarantorId: request.id, comments })}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="flex-1 sacco-success text-white"
                            data-testid={`button-approve-guarantor-${request.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate({ guarantorId: request.id, comments })}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="flex-1"
                            data-testid={`button-reject-guarantor-${request.id}`}
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
                            data-testid={`button-cancel-guarantor-${request.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActioningId(request.id)}
                          className="flex-1"
                          data-testid={`button-respond-guarantor-${request.id}`}
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
      </div>
    </div>
  );
}
