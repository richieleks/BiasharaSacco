import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Clock, CheckCircle, XCircle, FileText, DollarSign, CreditCard, UserCheck, Plus, Trash2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import type { GuarantorWithDetails, MemberWithDetails } from "@shared/schema";

export default function Guarantors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'my-loans' | 'requests' | 'provided'>('my-loans');
  const [selectedGuarantor, setSelectedGuarantor] = useState<any>(null);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [selectedLoanForGuarantors, setSelectedLoanForGuarantors] = useState<any>(null);
  const [isGuarantorSelectionOpen, setIsGuarantorSelectionOpen] = useState(false);
  const [selectedGuarantors, setSelectedGuarantors] = useState<Array<{memberId: number, guaranteeAmount: string}>>([]);

  const { data: allMembers = [] } = useQuery<MemberWithDetails[]>({
    queryKey: ['/api/members'],
    enabled: !!user?.id,
  });

  const isAdmin = user?.role === 'admin';

  const { data: currentMember, isLoading: loadingMember } = useQuery<MemberWithDetails>({
    queryKey: [`/api/members/by-user/${user?.id || 'undefined'}`],
    enabled: !!user?.id && !isAdmin,
  });

  const { data: myLoans = [], isLoading: loadingMyLoans } = useQuery<any[]>({
    queryKey: ['/api/loans/my-loans'],
    enabled: !!user?.id,
  });

  const loanGuarantors = useQuery({
    queryKey: ['/api/loans/guarantors', myLoans.map(loan => loan.id)],
    queryFn: async () => {
      const guarantorPromises = myLoans.map(async (loan) => {
        const response = await fetch(`/api/guarantors/loan/${loan.id}`);
        const guarantors = await response.json();
        return { loanId: loan.id, guarantors };
      });
      const results = await Promise.all(guarantorPromises);
      return results.reduce((acc, { loanId, guarantors }) => {
        acc[loanId] = guarantors;
        return acc;
      }, {} as Record<number, any[]>);
    },
    enabled: myLoans.length > 0,
  });

  const { data: guarantorRequests = [], isLoading: loadingRequests } = useQuery<GuarantorWithDetails[]>({
    queryKey: ['/api/guarantors/pending'],
    enabled: !!user?.id,
  });

  const { data: providedGuarantees = [], isLoading: loadingProvided } = useQuery<GuarantorWithDetails[]>({
    queryKey: ['/api/guarantors/member', currentMember?.id],
    queryFn: async () => {
      const res = await fetch(`/api/guarantors/member/${currentMember!.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch provided guarantees');
      return res.json();
    },
    enabled: !!currentMember?.id,
  });

  const loansNeedingGuarantors = myLoans.filter(loan => 
    loan.status === 'pending' || (loan.status === 'approved' && !loan.guarantorsApproved)
  );

  const approveGuarantorMutation = useMutation({
    mutationFn: async ({ guarantorId, comments }: { guarantorId: number; comments: string }) => {
      await apiRequest('PATCH', `/api/guarantors/${guarantorId}/approve`, { comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/member'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/guarantors'] });
      toast({ title: "Success",
        description: "Guarantor request approved successfully!", variant: "success" });
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
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/member'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/guarantors'] });
      toast({ title: "Request Rejected",
        description: "Guarantor request rejected successfully!", variant: "warning" });
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

  const resendGuarantorMutation = useMutation({
    mutationFn: async ({ guarantorId }: { guarantorId: number }) => {
      await apiRequest('PATCH', `/api/guarantors/${guarantorId}/resend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantors/member'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/guarantors'] });
      toast({ title: "Success",
        description: "Guarantor request resent successfully!", variant: "success" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend guarantor request",
        variant: "destructive",
      });
    },
  });

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'approved':
      case 'active':
      case 'disbursed':
        return 'outline';
      case 'rejected':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved':
      case 'active':
      case 'disbursed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200/50';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
      case 'disbursed':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-amber-600" />;
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

  const addGuarantorMutation = useMutation({
    mutationFn: async ({ loanId, guarantors }: { loanId: number; guarantors: Array<{guarantorMemberId: number, guaranteeAmount: number}> }) => {
      await apiRequest('POST', `/api/loans/${loanId}/guarantors`, { guarantors });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans/guarantors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans/my-loans'] });
      toast({ title: "Success",
        description: "Guarantor requests sent successfully!", variant: "success" });
      setIsGuarantorSelectionOpen(false);
      setSelectedGuarantors([]);
      setSelectedLoanForGuarantors(null);
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
        description: error.message || "Failed to add guarantors",
        variant: "destructive",
      });
    },
  });

  const { data: loanMemberSavings } = useQuery<any[]>({
    queryKey: ['/api/members', selectedLoanForGuarantors?.memberId, 'savings'],
    queryFn: async () => {
      const res = await fetch(`/api/members/${selectedLoanForGuarantors.memberId}/savings`);
      if (!res.ok) throw new Error('Failed to fetch savings');
      return res.json();
    },
    enabled: !!selectedLoanForGuarantors?.memberId,
  });

  const loanMemberTotalSavings = loanMemberSavings?.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance || '0'), 0) || 0;

  const openGuarantorSelection = (loan: any) => {
    setSelectedLoanForGuarantors(loan);
    setSelectedGuarantors([{ memberId: 0, guaranteeAmount: '' }]);
    setIsGuarantorSelectionOpen(true);
  };

  const addGuarantorRow = () => {
    setSelectedGuarantors([...selectedGuarantors, { memberId: 0, guaranteeAmount: '' }]);
  };

  const removeGuarantorRow = (index: number) => {
    setSelectedGuarantors(selectedGuarantors.filter((_, i) => i !== index));
  };

  const updateGuarantorRow = (index: number, field: string, value: string | number) => {
    const updated = [...selectedGuarantors];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedGuarantors(updated);
  };

  const submitGuarantors = () => {
    if (!selectedLoanForGuarantors) return;
    
    const validGuarantors = selectedGuarantors.filter(g => g.memberId > 0 && g.guaranteeAmount);
    if (validGuarantors.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one guarantor with an amount",
        variant: "destructive",
      });
      return;
    }

    const guarantorData = validGuarantors.map(g => ({
      guarantorMemberId: g.memberId,
      guaranteeAmount: parseFloat(g.guaranteeAmount)
    }));

    addGuarantorMutation.mutate({
      loanId: selectedLoanForGuarantors.id,
      guarantors: guarantorData
    });
  };

  const getEligibleGuarantors = (loan: any) => {
    return allMembers.filter(member => 
      member.status === 'active' && 
      member.id !== currentMember?.id &&
      member.id !== loan.memberId
    );
  };

  if (!isAdmin && !currentMember && !loadingMember) {
    return (
      <div className="space-y-6 page-container animate-fade-in">
        <div className="section-card">
          <div className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <div className="text-lg font-medium">No Member Profile</div>
            <div className="text-muted-foreground">You need a member profile to access guarantor management.</div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin && loadingMember) {
    return (
      <div className="space-y-6 page-container animate-fade-in">
        <div className="section-card">
          <div className="py-16 text-center">
            <div className="text-muted-foreground">Loading member information...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Guarantor Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage guarantor requests and view guarantees you've provided
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1 rounded-lg bg-muted p-1">
        <Button
          variant={activeTab === 'my-loans' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('my-loans')}
          className={`flex-1 text-xs sm:text-sm ${activeTab === 'my-loans' ? 'rounded-xl' : ''}`}
        >
          <CreditCard className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
          <span className="truncate">My Loans ({loansNeedingGuarantors.length})</span>
        </Button>
        <Button
          variant={activeTab === 'requests' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('requests')}
          className={`flex-1 text-xs sm:text-sm ${activeTab === 'requests' ? 'rounded-xl' : ''}`}
        >
          <Clock className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
          <span className="truncate">Requests ({guarantorRequests.length})</span>
        </Button>
        <Button
          variant={activeTab === 'provided' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('provided')}
          className={`flex-1 text-xs sm:text-sm ${activeTab === 'provided' ? 'rounded-xl' : ''}`}
        >
          <Users className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
          <span className="truncate">Provided ({providedGuarantees.length})</span>
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'my-loans' && (
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              My Loan Applications Awaiting Guarantors ({loansNeedingGuarantors.length})
            </h3>
          </div>
          <div className="p-6">
            {loadingMyLoans || loanGuarantors.isLoading ? (
              <div className="py-16 text-center">
                <div className="text-muted-foreground">Loading your loans...</div>
              </div>
            ) : loansNeedingGuarantors.length === 0 ? (
              <div className="py-16 text-center">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="text-lg font-medium">No Loans Awaiting Guarantors</div>
                <div className="text-muted-foreground">
                  All your loan applications either have guarantors or don't require them
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {loansNeedingGuarantors.map((loan: any) => {
                  const guarantors = loanGuarantors.data?.[loan.id] || [];
                  const approvedGuarantors = guarantors.filter(g => g.status === 'approved').length;
                  const pendingGuarantors = guarantors.filter(g => g.status === 'pending').length;
                  const rejectedGuarantors = guarantors.filter(g => g.status === 'rejected').length;
                  
                  return (
                    <div key={loan.id} className="section-card border-l-4 border-l-blue-400">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-blue-600 shrink-0" />
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Loan Application #{loan.loanNumber}</h3>
                          </div>
                          <Badge variant={getStatusVariant(loan.status)} className={getStatusColor(loan.status)}>
                            {loan.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Loan Details */}
                          <div className="space-y-3">
                            <h4 className="font-medium text-slate-900 dark:text-slate-100">Loan Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Amount:</span>
                                <span className="font-medium">{formatCurrency(loan.principalAmount || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Type:</span>
                                <span className="font-medium">{loan.loanType}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Term:</span>
                                <span className="font-medium">{loan.termMonths} months</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Purpose:</span>
                                <span className="font-medium">{loan.purpose}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-300">Applied:</span>
                                <span className="font-medium">{new Date(loan.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Guarantor Status */}
                          <div className="space-y-3">
                            <h4 className="font-medium text-slate-900 dark:text-slate-100">Guarantor Status</h4>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Progress</span>
                                <span className="text-sm text-slate-600 dark:text-slate-300">
                                  {approvedGuarantors} of {guarantors.length} approved
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div 
                                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${guarantors.length ? (approvedGuarantors / guarantors.length) * 100 : 0}%` }}
                                ></div>
                              </div>
                              <div className="flex gap-4 mt-2 text-xs">
                                <span className="text-emerald-600">✓ {approvedGuarantors} Approved</span>
                                <span className="text-amber-600">⏳ {pendingGuarantors} Pending</span>
                                <span className="text-red-600">✗ {rejectedGuarantors} Rejected</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Guarantor Details */}
                        {guarantors.length > 0 && (
                          <div className="mt-6 pt-4 border-t">
                            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Guarantor Details</h4>
                            <div className="space-y-3">
                              {guarantors.map((guarantor: any) => (
                                <div key={guarantor.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                      <UserCheck className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                      <div className="font-medium">
                                        {guarantor.guarantorMember?.user?.firstName} {guarantor.guarantorMember?.user?.lastName}
                                      </div>
                                      <div className="text-sm text-slate-600 dark:text-slate-300">
                                        {guarantor.guarantorMember?.memberNumber} | 
                                        {formatCurrency(guarantor.guaranteeAmount)}
                                      </div>
                                      {guarantor.comments && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                          Comment: {guarantor.comments}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-11 sm:ml-0">
                                    {guarantor.status === 'rejected' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => resendGuarantorMutation.mutate({ guarantorId: guarantor.id })}
                                        disabled={resendGuarantorMutation.isPending}
                                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                      >
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Resend
                                      </Button>
                                    )}
                                    {getStatusIcon(guarantor.status)}
                                    <Badge variant={getStatusVariant(guarantor.status)} className={getStatusColor(guarantor.status)}>
                                      {guarantor.status}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {guarantors.length === 0 && (
                          <div className="mt-6 pt-4 border-t">
                            <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                              <UserCheck className="h-8 w-8 mx-auto mb-2 text-slate-400 dark:text-slate-500" />
                              <p>No guarantors assigned yet</p>
                              <Button 
                                onClick={() => openGuarantorSelection(loan)}
                                className="mt-3 rounded-xl"
                                size="sm"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Select Guarantors
                              </Button>
                            </div>
                          </div>
                        )}

                        {guarantors.length > 0 && (
                          <div className="mt-6 pt-4 border-t flex justify-center">
                            <Button 
                              onClick={() => openGuarantorSelection(loan)}
                              variant="outline"
                              size="sm"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add More Guarantors
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Requests for Me to Guarantee ({guarantorRequests.length})
            </h3>
          </div>
          <div className="p-6">
            {loadingRequests ? (
              <div className="py-16 text-center">
                <div className="text-muted-foreground">Loading guarantor requests...</div>
              </div>
            ) : guarantorRequests.length === 0 ? (
              <div className="py-16 text-center">
                <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="text-lg font-medium">No Pending Guarantor Requests</div>
                <div className="text-muted-foreground">
                  When members request you as a guarantor for their loans, they will appear here
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {guarantorRequests.map((request: any) => (
                  <div key={request.id} className="section-card border-l-4 border-l-amber-400">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-amber-600" />
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Loan Guarantee Request</h3>
                        </div>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200/50">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Loan Details */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-slate-900 dark:text-slate-100">Loan Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-300">Loan Number:</span>
                              <span className="font-medium">{request.loan?.loanNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-300">Applicant:</span>
                              <span className="font-medium">
                                {request.loan?.member?.user?.firstName} {request.loan?.member?.user?.lastName}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-300">Member Number:</span>
                              <span className="font-medium">{request.loan?.member?.memberNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-300">Loan Amount:</span>
                              <span className="font-medium">{formatCurrency(request.loan?.principalAmount || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-300">Loan Type:</span>
                              <span className="font-medium capitalize">{request.loan?.loanType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-300">Term:</span>
                              <span className="font-medium">{request.loan?.termMonths} months</span>
                            </div>
                          </div>
                        </div>

                        {/* Guarantee Details */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-slate-900 dark:text-slate-100">Your Guarantee</h4>
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-blue-900">Amount to Guarantee</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-900">
                              {formatCurrency(request.guaranteeAmount)}
                            </div>
                            <div className="text-sm text-blue-700 mt-1">
                              You are being asked to guarantee this amount for the loan
                            </div>
                          </div>
                          
                          <div className="text-sm text-slate-600 dark:text-slate-300">
                            <p><strong>Request Date:</strong> {new Date(request.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 mt-6 pt-4 border-t">
                        <Button
                          onClick={() => openApprovalDialog(request)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'provided' && (
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Guarantees I've Provided ({providedGuarantees.length})
            </h3>
          </div>
          <div className="p-6">
            {loadingProvided ? (
              <div className="py-16 text-center">
                <div className="text-muted-foreground">Loading guarantees...</div>
              </div>
            ) : providedGuarantees.length === 0 ? (
              <div className="py-16 text-center">
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
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          Loan for {guarantee.loan?.member?.user?.firstName} {guarantee.loan?.member?.user?.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Loan: {formatCurrency(guarantee.loan?.principalAmount || 0)} |
                          Your Guarantee: {formatCurrency(guarantee.guaranteeAmount || 0)}
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
                      <div className="flex items-center gap-2 shrink-0">
                        {getStatusIcon(guarantee.status || 'pending')}
                        <Badge variant={getStatusVariant(guarantee.status || 'pending')} className={getStatusColor(guarantee.status || 'pending')}>
                          {guarantee.status || 'pending'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-xs text-muted-foreground border-t pt-2">
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
          </div>
        </div>
      )}

      {/* Approval/Rejection Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedGuarantor ? 'Respond to Guarantee Request' : 'Guarantee Request'}
            </DialogTitle>
          </DialogHeader>
          {selectedGuarantor && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <strong>Applicant:</strong> {selectedGuarantor.loan?.member?.user?.firstName} {selectedGuarantor.loan?.member?.user?.lastName}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <strong>Guarantee Amount:</strong> {formatCurrency(selectedGuarantor.guaranteeAmount)}
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 rounded-xl"
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

      {/* Guarantor Selection Dialog */}
      <Dialog open={isGuarantorSelectionOpen} onOpenChange={setIsGuarantorSelectionOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Select Guarantors for Loan #{selectedLoanForGuarantors?.loanNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedLoanForGuarantors && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Loan Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-300">Loan Amount:</span> 
                    <span className="font-medium ml-2">{formatCurrency(selectedLoanForGuarantors.principalAmount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-300">Type:</span> 
                    <span className="font-medium ml-2">{selectedLoanForGuarantors.loanType}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-300">Member Savings:</span> 
                    <span className="font-medium ml-2 text-emerald-700">{formatCurrency(loanMemberTotalSavings)}</span>
                  </div>
                  <div>
                    <span className="text-blue-900 font-medium">Amount to Guarantee:</span> 
                    <span className="font-bold ml-2 text-blue-900">{formatCurrency(Math.max(0, parseFloat(selectedLoanForGuarantors.principalAmount || '0') - loanMemberTotalSavings))}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Select Guarantors</h4>
                  <Button onClick={addGuarantorRow} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another
                  </Button>
                </div>

                <div className="space-y-4">
                  {selectedGuarantors.map((guarantor, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 p-4 border rounded-lg">
                      <div className="flex-1">
                        <Label htmlFor={`guarantor-${index}`}>Select Member</Label>
                        <Select 
                          value={guarantor.memberId.toString()}
                          onValueChange={(value) => updateGuarantorRow(index, 'memberId', parseInt(value))}
                        >
                          <SelectTrigger id={`guarantor-${index}`}>
                            <SelectValue placeholder="Choose a member" />
                          </SelectTrigger>
                          <SelectContent>
                            {getEligibleGuarantors(selectedLoanForGuarantors).map((member) => (
                              <SelectItem key={member.id} value={member.id.toString()}>
                                {member.fullName} ({member.memberNumber})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="w-full sm:w-48">
                        <Label htmlFor={`amount-${index}`}>Guarantee Amount (UGX)</Label>
                        <Input
                          id={`amount-${index}`}
                          type="number"
                          placeholder="Enter amount"
                          value={guarantor.guaranteeAmount}
                          onChange={(e) => updateGuarantorRow(index, 'guaranteeAmount', e.target.value)}
                        />
                      </div>

                      {selectedGuarantors.length > 1 && (
                        <Button
                          onClick={() => removeGuarantorRow(index)}
                          size="icon"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 self-end shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 p-4 rounded-lg mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Total Guarantee Coverage</span>
                  </div>
                  {(() => {
                    const totalGuaranteed = selectedGuarantors.reduce((total, g) => total + (parseFloat(g.guaranteeAmount) || 0), 0);
                    const amountNeeded = Math.max(0, parseFloat(selectedLoanForGuarantors.principalAmount || '0') - loanMemberTotalSavings);
                    const coverage = amountNeeded > 0 ? (totalGuaranteed / amountNeeded) * 100 : 100;
                    return (
                      <>
                        <div className="text-2xl font-bold text-blue-900">
                          {formatCurrency(totalGuaranteed)}
                        </div>
                        <div className="text-sm text-blue-700 mt-1">
                          Amount to Guarantee: {formatCurrency(amountNeeded)} | Coverage: {Math.min(100, coverage).toFixed(1)}%
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={submitGuarantors}
                  disabled={addGuarantorMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 rounded-xl"
                >
                  {addGuarantorMutation.isPending ? (
                    <>Sending Requests...</>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Send Guarantor Requests
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsGuarantorSelectionOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
