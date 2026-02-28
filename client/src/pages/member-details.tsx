import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import { type Member, type MemberWithDetails } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Edit, User, Phone, Mail, MapPin, Calendar, CreditCard, Building,
  Users, Eye, FileText, Calculator, DollarSign, TrendingUp, Banknote, Shield,
  Briefcase, Heart, Clock, Hash, Wallet, PiggyBank, ChevronRight, Activity
} from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";

const updateMemberSchema = z.object({
  memberNumber: z.string().optional(),
  fullName: z.string().optional(),
  idNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
  department: z.string().optional(),
  section: z.string().optional(),
  termsOfService: z.enum(["permanent", "temporary", "contract", "ex-staff"]).optional(),
  averageNetPay: z.string().optional(),
  staffAccountNumber: z.string().optional(),
  monthlySavings: z.string().optional(),
  accountNumber: z.string().optional(),
  branch: z.string().optional(),
  shareContribution: z.string().optional(),
  numberOfShares: z.number().optional(),
  beneficiaryName: z.string().optional(),
  beneficiaryRelationship: z.string().optional(),
  beneficiaryContact: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  status: z.enum(["pending", "active", "inactive", "suspended", "rejected"]).optional(),
  joinDate: z.string().optional(),
});

type UpdateMemberData = z.infer<typeof updateMemberSchema>;

const shareCapitalSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => parseFloat(val) > 0, "Amount must be greater than zero"),
  description: z.string().optional(),
});

type ShareCapitalData = z.infer<typeof shareCapitalSchema>;

function formatDate(dateStr: string | null | undefined, formatStr: string = 'PP') {
  if (!dateStr) return 'N/A';
  try { return format(new Date(dateStr), formatStr); } catch { return 'N/A'; }
}

function InfoRow({ icon: Icon, label, value, className = "" }: { icon?: any; label: string; value: string | number | null | undefined; className?: string }) {
  return (
    <div className={`flex items-start gap-3 py-2.5 ${className}`}>
      {Icon && <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{value || 'Not provided'}</p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, subtext }: { icon: any; label: string; value: string | number; color: string; subtext?: string }) {
  const colorMap: Record<string, string> = {
    green: "from-emerald-500 to-emerald-600 shadow-emerald-200",
    blue: "from-blue-500 to-blue-600 shadow-blue-200",
    orange: "from-amber-500 to-amber-600 shadow-amber-200",
    purple: "from-violet-500 to-violet-600 shadow-violet-200",
  };
  return (
    <div className="relative overflow-hidden rounded-xl bg-white border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-gradient-to-br ${colorMap[color] || colorMap.blue} p-2.5 shadow-lg`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5 truncate">{value}</p>
          {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

export default function MemberDetails() {
  const [match, params] = useRoute("/members/:id");
  const [, setLocation] = useLocation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isShareCapitalDialogOpen, setIsShareCapitalDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStaff = ['admin', 'manager', 'committee', 'teller', 'treasurer'].includes(user?.role || '');

  const memberId = params?.id;

  const { data: member, isLoading: memberLoading } = useQuery<MemberWithDetails>({
    queryKey: ['/api/members', memberId],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}`);
      if (!response.ok) throw new Error('Failed to fetch member details');
      return response.json();
    },
    enabled: !!memberId,
  });

  const { data: savingsAccounts } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'savings'],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}/savings`);
      if (!response.ok) throw new Error('Failed to fetch savings accounts');
      return response.json();
    },
    enabled: !!memberId,
  });

  const { data: loans } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'loans'],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}/loans`);
      if (!response.ok) throw new Error('Failed to fetch loans');
      return response.json();
    },
    enabled: !!memberId,
  });

  const { data: transactions } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'transactions'],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}/transactions`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: !!memberId,
  });

  const form = useForm<UpdateMemberData>({
    resolver: zodResolver(updateMemberSchema),
  });

  if (member && form.getValues().memberNumber !== member.memberNumber) {
    form.reset({
      memberNumber: member.memberNumber || "",
      fullName: member.fullName || "",
      idNumber: member.idNumber || "",
      dateOfBirth: member.dateOfBirth || "",
      gender: member.gender || "male",
      phoneNumber: member.phoneNumber || "",
      address: member.address || "",
      maritalStatus: member.maritalStatus || "single",
      department: member.department || "",
      section: member.section || "",
      termsOfService: member.termsOfService || "permanent",
      averageNetPay: member.averageNetPay?.toString() || "",
      staffAccountNumber: member.staffAccountNumber || "",
      monthlySavings: member.monthlySavings?.toString() || "",
      accountNumber: member.accountNumber || "",
      branch: member.branch || "",
      shareContribution: member.shareContribution?.toString() || "",
      numberOfShares: member.numberOfShares || 4,
      beneficiaryName: member.beneficiaryName || "",
      beneficiaryRelationship: member.beneficiaryRelationship || "",
      beneficiaryContact: member.beneficiaryContact || "",
      nextOfKinName: member.nextOfKinName || "",
      nextOfKinPhone: member.nextOfKinPhone || "",
      status: member.status || "active",
      joinDate: member.joinDate ? new Date(member.joinDate).toISOString().split('T')[0] : "",
    });
  }

  const updateMemberMutation = useMutation({
    mutationFn: async (data: UpdateMemberData) => {
      return await apiRequest("PATCH", `/api/members/${memberId}`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Member updated successfully" });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update member", variant: "destructive" });
    },
  });

  const shareCapitalForm = useForm<ShareCapitalData>({
    resolver: zodResolver(shareCapitalSchema),
    defaultValues: { amount: "", description: "" },
  });

  const shareCapitalMutation = useMutation({
    mutationFn: async (data: ShareCapitalData) => {
      const response = await apiRequest("POST", `/api/members/${memberId}/share-capital`, data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Share Capital Posted", description: data.message });
      setIsShareCapitalDialogOpen(false);
      shareCapitalForm.reset({ amount: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to post share capital", variant: "destructive" });
    },
  });

  if (!match || !memberId) {
    setLocation("/members");
    return null;
  }

  if (memberLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="text-sm text-slate-500">Loading member details...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="rounded-full bg-slate-100 p-4">
          <User className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-lg font-medium text-slate-700">Member not found</p>
        <Button variant="outline" onClick={() => setLocation("/members")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Members
        </Button>
      </div>
    );
  }

  const memberName = member.fullName || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || 'Member';
  const initials = memberName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const totalSavings = Array.isArray(savingsAccounts) ? savingsAccounts.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance || '0'), 0) : 0;
  const shareExpected = parseFloat(member.shareContribution || "20000") * (member.numberOfShares || 4);
  const sharePaid = parseFloat(member.shareCapital || "0");
  const shareRemaining = Math.max(0, shareExpected - sharePaid);

  const recentTransactions = Array.isArray(transactions)
    ? [...transactions].sort((a: any, b: any) => new Date(b.transactionDate || b.createdAt || 0).getTime() - new Date(a.transactionDate || a.createdAt || 0).getTime()).slice(0, 15)
    : [];

  return (
    <div className="space-y-6 page-container animate-fade-in">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/members")} className="text-slate-500 hover:text-slate-800">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Members
        </Button>
        <ChevronRight className="h-4 w-4 text-slate-300" />
        <span className="text-sm text-slate-500 truncate">{memberName}</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-blue-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-60" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl sm:text-3xl font-bold border border-white/20 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{memberName}</h1>
              <Badge className={`w-fit text-xs font-semibold ${
                member.status === 'active' ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30' :
                member.status === 'inactive' ? 'bg-slate-400/20 text-slate-300 border-slate-400/30' :
                member.status === 'suspended' ? 'bg-red-400/20 text-red-300 border-red-400/30' :
                'bg-amber-400/20 text-amber-300 border-amber-400/30'
              } border capitalize`}>
                {member.status || 'pending'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                {member.memberNumber}
              </span>
              {member.phoneNumber && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {member.phoneNumber}
                </span>
              )}
              {member.department && (
                <span className="flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5" />
                  {member.department}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Joined {formatDate(member.joinDate || member.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button size="sm" variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-0" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            {isAdmin && (
              <Button size="sm" variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-0" onClick={() => setIsShareCapitalDialogOpen(true)}>
                <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                Post Shares
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={PiggyBank}
          label="Total Savings"
          value={formatCurrency(totalSavings)}
          color="green"
          subtext={`${Array.isArray(savingsAccounts) ? savingsAccounts.length : 0} account(s)`}
        />
        <StatCard
          icon={Banknote}
          label="Active Loans"
          value={Array.isArray(loans) ? loans.filter((l: any) => ['active', 'approved', 'disbursed'].includes(l.status)).length : 0}
          color="orange"
          subtext={`${Array.isArray(loans) ? loans.length : 0} total`}
        />
        <StatCard
          icon={Activity}
          label="Transactions"
          value={Array.isArray(transactions) ? transactions.length : 0}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Share Capital"
          value={formatCurrency(sharePaid)}
          color="purple"
          subtext={member.isPaidUp ? 'Fully paid' : `${Math.round((sharePaid / shareExpected) * 100)}% of target`}
        />
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-full inline-flex sm:grid sm:grid-cols-5 h-auto gap-1 bg-slate-100/80 p-1 rounded-xl min-w-max sm:min-w-0">
            <TabsTrigger value="personal" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 px-4 sm:px-3">Personal</TabsTrigger>
            <TabsTrigger value="financial" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 px-4 sm:px-3">Financial</TabsTrigger>
            <TabsTrigger value="savings" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 px-4 sm:px-3">Savings</TabsTrigger>
            <TabsTrigger value="loans" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 px-4 sm:px-3">Loans</TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 px-4 sm:px-3">History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="personal" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="rounded-md bg-blue-50 p-1.5"><User className="h-3.5 w-3.5 text-blue-600" /></div>
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow icon={User} label="Full Name" value={memberName} />
                  <InfoRow icon={Hash} label="Member Number" value={member.memberNumber} />
                  <InfoRow icon={Shield} label="ID Number" value={member.idNumber} />
                  <InfoRow icon={Calendar} label="Date of Birth" value={member.dateOfBirth} />
                  <InfoRow label="Gender" value={member.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : null} />
                  <InfoRow label="Marital Status" value={member.maritalStatus ? member.maritalStatus.charAt(0).toUpperCase() + member.maritalStatus.slice(1) : null} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="rounded-md bg-green-50 p-1.5"><Phone className="h-3.5 w-3.5 text-green-600" /></div>
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow icon={Phone} label="Phone" value={member.phoneNumber} />
                  <InfoRow icon={Mail} label="Email" value={member.email || member.user?.email} />
                </div>
                <InfoRow icon={MapPin} label="Address" value={member.address} />
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="rounded-md bg-amber-50 p-1.5"><Briefcase className="h-3.5 w-3.5 text-amber-600" /></div>
                  Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow icon={Building} label="Department" value={member.department} />
                  <InfoRow label="Section" value={member.section} />
                  <InfoRow icon={Briefcase} label="Terms of Service" value={member.termsOfService ? member.termsOfService.charAt(0).toUpperCase() + member.termsOfService.slice(1) : null} />
                  <InfoRow icon={CreditCard} label="Staff Account" value={member.staffAccountNumber} />
                </div>
                <InfoRow icon={Wallet} label="Average Net Pay" value={member.averageNetPay ? formatCurrency(member.averageNetPay) : null} />
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="rounded-md bg-rose-50 p-1.5"><Heart className="h-3.5 w-3.5 text-rose-600" /></div>
                  Next of Kin & Beneficiary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow icon={Users} label="Next of Kin" value={member.nextOfKinName} />
                  <InfoRow icon={Phone} label="Kin Phone" value={member.nextOfKinPhone} />
                  <InfoRow icon={Heart} label="Beneficiary" value={member.beneficiaryName} />
                  <InfoRow label="Relationship" value={member.beneficiaryRelationship} />
                </div>
                <InfoRow icon={Phone} label="Beneficiary Contact" value={member.beneficiaryContact} />
              </CardContent>
            </Card>
          </div>

          {(member.approvedBy || member.approvalComments) && (
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="rounded-md bg-violet-50 p-1.5"><Shield className="h-3.5 w-3.5 text-violet-600" /></div>
                  Membership Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow label="Approved By" value={member.approvedBy} />
                  <InfoRow icon={Calendar} label="Approval Date" value={formatDate(member.approvedAt)} />
                </div>
                {member.approvalComments && <InfoRow label="Comments" value={member.approvalComments} />}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="financial" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="rounded-md bg-green-50 p-1.5"><Wallet className="h-3.5 w-3.5 text-green-600" /></div>
                  Savings Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow icon={PiggyBank} label="Monthly Savings" value={member.monthlySavings ? formatCurrency(member.monthlySavings) : null} />
                  <InfoRow icon={CreditCard} label="Bank Account" value={member.accountNumber} />
                  <InfoRow icon={Building} label="Bank Branch" value={member.branch} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="rounded-md bg-violet-50 p-1.5"><TrendingUp className="h-3.5 w-3.5 text-violet-600" /></div>
                  Share Capital
                </CardTitle>
                <Badge className={`text-xs ${member.isPaidUp ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'} border`}>
                  {member.isPaidUp ? 'Fully Paid' : 'In Progress'}
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Per Share</p>
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(member.shareContribution || "20000")}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Shares</p>
                      <p className="text-sm font-bold text-slate-800">{member.numberOfShares || 4}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 text-center">
                      <p className="text-xs text-emerald-600 mb-1">Paid</p>
                      <p className="text-sm font-bold text-emerald-700">{formatCurrency(sharePaid)}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 text-center">
                      <p className="text-xs text-amber-600 mb-1">Remaining</p>
                      <p className="text-sm font-bold text-amber-700">{formatCurrency(shareRemaining)}</p>
                    </div>
                  </div>
                  {!member.isPaidUp && (
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (sharePaid / shareExpected) * 100)}%` }} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="savings" className="mt-4">
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <div className="rounded-md bg-green-50 p-1.5"><PiggyBank className="h-3.5 w-3.5 text-green-600" /></div>
                Savings Accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {Array.isArray(savingsAccounts) && savingsAccounts.length > 0 ? (
                <div className="space-y-3">
                  {savingsAccounts.map((account: any) => (
                    <div key={account.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors gap-2">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-100 p-2">
                          <Wallet className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{account.accountNumber}</p>
                          <p className="text-xs text-slate-500 capitalize">{account.accountType}</p>
                        </div>
                      </div>
                      <div className="sm:text-right pl-11 sm:pl-0">
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(account.balance)}</p>
                        <p className="text-xs text-slate-400">Current Balance</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PiggyBank className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No savings accounts found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans" className="mt-4">
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <div className="rounded-md bg-amber-50 p-1.5"><Banknote className="h-3.5 w-3.5 text-amber-600" /></div>
                Loan History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {Array.isArray(loans) && loans.length > 0 ? (
                <div className="space-y-3">
                  {loans.map((loan: any) => (
                    <div key={loan.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1.5">
                            <span className="font-semibold text-sm text-slate-800">{loan.loanType}</span>
                            <Badge className={`text-xs ${
                              loan.status === 'approved' || loan.status === 'active' || loan.status === 'disbursed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              loan.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                              loan.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            } border capitalize`}>
                              {loan.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mb-2.5">
                            #{loan.loanNumber} &middot; Applied {formatDate(loan.applicationDate)}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => setLocation(isStaff ? `/loans?loanId=${loan.uuid}` : `/my-loans?loanId=${loan.uuid}`)} className="h-7 text-xs rounded-lg">
                              <Eye className="mr-1 h-3 w-3" /> View
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setLocation(`/loans/${loan.uuid}/statement`)} className="h-7 text-xs rounded-lg">
                              <FileText className="mr-1 h-3 w-3" /> Statement
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setLocation(`/loans/${loan.uuid}/amortization`)} className="h-7 text-xs rounded-lg">
                              <Calculator className="mr-1 h-3 w-3" /> Schedule
                            </Button>
                          </div>
                        </div>
                        <div className="sm:text-right shrink-0">
                          <p className="text-lg font-bold text-slate-800">{formatCurrency(loan.principalAmount || loan.amount || 0)}</p>
                          <p className="text-xs text-amber-600 font-medium">
                            Outstanding: {formatCurrency(loan.outstandingBalance || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Banknote className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No loans found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <div className="rounded-md bg-blue-50 p-1.5"><Activity className="h-3.5 w-3.5 text-blue-600" /></div>
                Recent Transactions
              </CardTitle>
              <p className="text-xs text-slate-400">
                Showing last {recentTransactions.length} of {Array.isArray(transactions) ? transactions.length : 0} transactions
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {recentTransactions.length > 0 ? (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-3 px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="pb-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="pb-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Description</th>
                        <th className="pb-3 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="pb-3 px-6 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((tx: any) => {
                        const isCredit = ['deposit', 'interest_credit', 'share_capital', 'loan_disbursement'].includes(tx.transactionType);
                        return (
                          <tr key={tx.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-6 text-slate-600 whitespace-nowrap">{formatDate(tx.transactionDate || tx.createdAt)}</td>
                            <td className="py-3 px-3">
                              <Badge variant="outline" className="capitalize text-xs font-medium">
                                {(tx.transactionType || '').replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-slate-500 max-w-[200px] truncate hidden sm:table-cell">{tx.description || '-'}</td>
                            <td className={`py-3 px-3 text-right font-semibold whitespace-nowrap ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                              {isCredit ? '+' : '-'}{formatCurrency(tx.amount || '0')}
                            </td>
                            <td className="py-3 px-6 text-center">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                tx.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                tx.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                                tx.status === 'failed' ? 'bg-red-50 text-red-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {tx.status || 'unknown'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No transactions found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Member Details</DialogTitle>
            <DialogDescription>Update member information. All fields are optional.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateMemberMutation.mutate(data))} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Personal Details</h3>
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="idNumber" render={({ field }) => (
                    <FormItem><FormLabel>ID Number</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                    <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem><FormLabel>Gender</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="maritalStatus" render={({ field }) => (
                    <FormItem><FormLabel>Marital Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="single">Single</SelectItem><SelectItem value="married">Married</SelectItem><SelectItem value="divorced">Divorced</SelectItem><SelectItem value="widowed">Widowed</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Member Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="joinDate" render={({ field }) => (
                  <FormItem><FormLabel>Join Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Employment Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="section" render={({ field }) => (
                    <FormItem><FormLabel>Section</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="termsOfService" render={({ field }) => (
                    <FormItem><FormLabel>Terms of Service</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger></FormControl><SelectContent><SelectItem value="permanent">Permanent</SelectItem><SelectItem value="temporary">Temporary</SelectItem><SelectItem value="contract">Contract</SelectItem><SelectItem value="ex-staff">Ex-Staff</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="staffAccountNumber" render={({ field }) => (
                    <FormItem><FormLabel>Staff Account Number</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="averageNetPay" render={({ field }) => (
                  <FormItem><FormLabel>Average Net Pay (UGX)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Next of Kin</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="nextOfKinName" render={({ field }) => (
                    <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="nextOfKinPhone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Financial Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="monthlySavings" render={({ field }) => (
                    <FormItem><FormLabel>Monthly Savings (UGX)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="shareContribution" render={({ field }) => (
                    <FormItem><FormLabel>Share Contribution (UGX)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="numberOfShares" render={({ field }) => (
                    <FormItem><FormLabel>Number of Shares</FormLabel><FormControl><Input type="number" {...field} value={field.value || ""} onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="accountNumber" render={({ field }) => (
                    <FormItem><FormLabel>Bank Account Number</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="branch" render={({ field }) => (
                  <FormItem><FormLabel>Bank Branch</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Beneficiary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="beneficiaryName" render={({ field }) => (
                    <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="beneficiaryRelationship" render={({ field }) => (
                    <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="beneficiaryContact" render={({ field }) => (
                  <FormItem><FormLabel>Contact</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateMemberMutation.isPending}>
                  {updateMemberMutation.isPending ? "Updating..." : "Update Member"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isShareCapitalDialogOpen} onOpenChange={setIsShareCapitalDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Post Share Capital
            </DialogTitle>
            <DialogDescription>
              Post a share capital payment for {member?.fullName || 'this member'}.
              {member && (
                <span className="block mt-2 text-xs">
                  Expected: {formatCurrency(shareExpected)}
                  {" | "}Paid: {formatCurrency(sharePaid)}
                  {" | "}Remaining: {formatCurrency(shareRemaining)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...shareCapitalForm}>
            <form onSubmit={shareCapitalForm.handleSubmit((data) => shareCapitalMutation.mutate(data))} className="space-y-4">
              <FormField control={shareCapitalForm.control} name="amount" render={({ field }) => (
                <FormItem><FormLabel>Amount (UGX)</FormLabel><FormControl><Input type="number" step="0.01" min="0" placeholder="Enter amount" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={shareCapitalForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Monthly share capital installment" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsShareCapitalDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={shareCapitalMutation.isPending}>
                  {shareCapitalMutation.isPending ? "Posting..." : "Post Payment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}