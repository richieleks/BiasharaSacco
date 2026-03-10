import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  LogOut, CheckCircle, XCircle, Clock, AlertTriangle, User, Calendar,
  Banknote, PiggyBank, FileText, RefreshCw
} from "lucide-react";
import { useLocation } from "wouter";

type ExitRequest = {
  id: number;
  memberId: number;
  requestedBy: string;
  requestedAt: string;
  reason: string | null;
  status: "pending_treasurer" | "approved" | "rejected";
  exitFee: string;
  savingsUsedForLoanRepayment: boolean;
  loanAmountRepaid: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  treasurerComments: string | null;
  member: {
    id: number;
    fullName: string;
    memberNumber: string;
    totalSavings: string;
    shareCapital: string;
  } | null;
  requestedByUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string;
  } | null;
};

function statusBadge(status: ExitRequest["status"]) {
  switch (status) {
    case "pending_treasurer":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200">Pending Approval</Badge>;
    case "approved":
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200">Rejected</Badge>;
  }
}

function formatUserName(user: ExitRequest["requestedByUser"]) {
  if (!user) return "Unknown";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.username;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "N/A";
  try { return format(new Date(dateStr), "PPp"); } catch { return "N/A"; }
}

function ExitRequestCard({
  request,
  onApprove,
  onReject,
}: {
  request: ExitRequest;
  onApprove: (r: ExitRequest) => void;
  onReject: (r: ExitRequest) => void;
}) {
  const [, setLocation] = useLocation();
  const isPending = request.status === "pending_treasurer";

  return (
    <Card
      className="border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow"
      data-testid={`card-exit-request-${request.id}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                  onClick={() => setLocation(`/members/${request.memberId}`)}
                  data-testid={`link-member-${request.id}`}
                >
                  {request.member?.fullName || "Unknown Member"}
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {request.member?.memberNumber || ""}
                </span>
                {statusBadge(request.status)}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <PiggyBank className="h-3.5 w-3.5 shrink-0" />
                  <span>Savings: <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(parseFloat(request.member?.totalSavings || "0"))}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Banknote className="h-3.5 w-3.5 shrink-0" />
                  <span>Exit Fee: <span className={`font-medium ${parseFloat(request.exitFee || "0") > 0 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}`}>{parseFloat(request.exitFee || "0") > 0 ? formatCurrency(parseFloat(request.exitFee)) : "None"}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span>Requested by: <span className="font-medium text-slate-700 dark:text-slate-300">{formatUserName(request.requestedByUser)}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDate(request.requestedAt)}</span>
                </div>
              </div>

              {request.savingsUsedForLoanRepayment && request.loanAmountRepaid && (
                <div className="mt-2">
                  <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 py-2">
                    <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                      Savings will be used to repay <strong>{formatCurrency(parseFloat(request.loanAmountRepaid))}</strong> in outstanding loan balance upon approval.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {request.reason && (
                <div className="mt-2 flex items-start gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{request.reason}"</p>
                </div>
              )}

              {request.status === "approved" && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                  Approved on {formatDate(request.approvedAt)}{request.treasurerComments ? ` — "${request.treasurerComments}"` : ""}
                </p>
              )}
              {request.status === "rejected" && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Rejected on {formatDate(request.rejectedAt)}{request.rejectionReason ? ` — "${request.rejectionReason}"` : ""}
                </p>
              )}
            </div>
          </div>

          {isPending && (
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onApprove(request)}
                data-testid={`button-approve-exit-${request.id}`}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/20"
                onClick={() => onReject(request)}
                data-testid={`button-reject-exit-${request.id}`}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExitRequestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("pending_treasurer");
  const [approveTarget, setApproveTarget] = useState<ExitRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ExitRequest | null>(null);
  const [approveComments, setApproveComments] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: allRequests = [], isLoading, refetch } = useQuery<ExitRequest[]>({
    queryKey: ["/api/exit-requests"],
  });

  const pendingRequests = allRequests.filter(r => r.status === "pending_treasurer");
  const approvedRequests = allRequests.filter(r => r.status === "approved");
  const rejectedRequests = allRequests.filter(r => r.status === "rejected");

  const approveMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: number; comments: string }) =>
      await apiRequest("POST", `/api/exit-requests/${id}/approve`, { comments }),
    onSuccess: () => {
      toast({ title: "Exit Approved", description: "The member's exit has been approved and their account has been closed.", variant: "success" });
      setApproveTarget(null);
      setApproveComments("");
      queryClient.invalidateQueries({ queryKey: ["/api/exit-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error: Error) => {
      toast({ title: "Approval Failed", description: error.message || "Failed to approve exit request.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      await apiRequest("POST", `/api/exit-requests/${id}/reject`, { reason }),
    onSuccess: () => {
      toast({ title: "Exit Rejected", description: "The exit request has been rejected.", variant: "success" });
      setRejectTarget(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/exit-requests"] });
    },
    onError: (error: Error) => {
      toast({ title: "Rejection Failed", description: error.message || "Failed to reject exit request.", variant: "destructive" });
    },
  });

  const tabCounts = {
    pending_treasurer: pendingRequests.length,
    approved: approvedRequests.length,
    rejected: rejectedRequests.length,
  };

  function getTabList() {
    switch (activeTab) {
      case "pending_treasurer": return pendingRequests;
      case "approved": return approvedRequests;
      case "rejected": return rejectedRequests;
      default: return [];
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <LogOut className="h-6 w-6 text-red-600 dark:text-red-400" />
            Member Exit Requests
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Review and approve member exit requests submitted by staff.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh-exit-requests"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {pendingRequests.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>{pendingRequests.length}</strong> exit {pendingRequests.length === 1 ? "request requires" : "requests require"} your review and approval.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="pending_treasurer" data-testid="tab-pending-exit-requests" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Pending
            {tabCounts.pending_treasurer > 0 && (
              <span className="ml-1 bg-amber-500 text-white rounded-full text-xs px-1.5 py-0.5 leading-none">
                {tabCounts.pending_treasurer}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved-exit-requests" className="gap-1.5">
            <CheckCircle className="h-4 w-4" />
            Approved
            {tabCounts.approved > 0 && (
              <span className="ml-1 text-slate-500 text-xs">({tabCounts.approved})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected-exit-requests" className="gap-1.5">
            <XCircle className="h-4 w-4" />
            Rejected
            {tabCounts.rejected > 0 && (
              <span className="ml-1 text-slate-500 text-xs">({tabCounts.rejected})</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
              <span className="ml-3 text-slate-500">Loading exit requests...</span>
            </div>
          ) : getTabList().length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500">
              <LogOut className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No {activeTab === "pending_treasurer" ? "pending" : activeTab} exit requests</p>
              <p className="text-sm mt-1">
                {activeTab === "pending_treasurer"
                  ? "When staff submit exit requests, they will appear here for your review."
                  : `Previously ${activeTab} requests will appear here.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {getTabList().map(request => (
                <ExitRequestCard
                  key={request.id}
                  request={request}
                  onApprove={setApproveTarget}
                  onReject={setRejectTarget}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => { if (!open) { setApproveTarget(null); setApproveComments(""); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
              Approve Exit Request
            </DialogTitle>
            <DialogDescription>
              You are approving the exit of <strong>{approveTarget?.member?.fullName}</strong> ({approveTarget?.member?.memberNumber}). This will permanently close their account.
            </DialogDescription>
          </DialogHeader>

          {approveTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Member Savings</span>
                  <span className="font-medium">{formatCurrency(parseFloat(approveTarget.member?.totalSavings || "0"))}</span>
                </div>
                {approveTarget.savingsUsedForLoanRepayment && approveTarget.loanAmountRepaid && (
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>Loan Repayment from Savings</span>
                    <span className="font-medium">− {formatCurrency(parseFloat(approveTarget.loanAmountRepaid))}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Share Capital</span>
                  <span className="font-medium">{formatCurrency(parseFloat(approveTarget.member?.shareCapital || "0"))}</span>
                </div>
                {parseFloat(approveTarget.exitFee || "0") > 0 && (
                  <div className="flex justify-between border-t pt-2 border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400">
                    <span>Exit Fee</span>
                    <span className="font-semibold">− {formatCurrency(parseFloat(approveTarget.exitFee))}</span>
                  </div>
                )}
              </div>

              {approveTarget.savingsUsedForLoanRepayment && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
                  <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                    Outstanding loan of <strong>{formatCurrency(parseFloat(approveTarget.loanAmountRepaid || "0"))}</strong> will be settled using member's savings. The loan will be marked as completed.
                  </AlertDescription>
                </Alert>
              )}

              {approveTarget.reason && (
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Exit Reason</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{approveTarget.reason}"</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Treasurer Comments <span className="text-slate-400">(optional)</span>
                </label>
                <Textarea
                  data-testid="input-approve-comments"
                  placeholder="Add any notes for the record..."
                  value={approveComments}
                  onChange={(e) => setApproveComments(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => { setApproveTarget(null); setApproveComments(""); }}
              data-testid="button-approve-exit-cancel"
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={approveMutation.isPending}
              onClick={() => approveTarget && approveMutation.mutate({ id: approveTarget.id, comments: approveComments })}
              data-testid="button-approve-exit-confirm"
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Approval & Close Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              Reject Exit Request
            </DialogTitle>
            <DialogDescription>
              Reject the exit request for <strong>{rejectTarget?.member?.fullName}</strong>. Their account will remain active.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Rejection Reason <span className="text-slate-400">(optional)</span>
              </label>
              <Textarea
                data-testid="input-reject-reason"
                placeholder="Explain why this exit request is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => { setRejectTarget(null); setRejectReason(""); }}
              data-testid="button-reject-exit-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason })}
              data-testid="button-reject-exit-confirm"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
