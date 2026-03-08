import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { DollarSign, Users, TrendingUp, CheckCircle, Search, Plus, ArrowUpRight } from "lucide-react";
import type { MemberWithDetails } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

const postShareCapitalSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => parseFloat(val) > 0, "Amount must be greater than zero"),
  description: z.string().optional(),
});

type PostShareCapitalData = z.infer<typeof postShareCapitalSchema>;

export default function ShareCapital() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberWithDetails | null>(null);
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const canPost = user?.role === 'admin';

  const { data: members, isLoading } = useQuery<MemberWithDetails[]>({
    queryKey: ['/api/members'],
    refetchInterval: 30000,
  });

  const { data: transactions } = useQuery<any[]>({
    queryKey: ['/api/transactions'],
  });

  const { data: systemConfig } = useQuery<any>({
    queryKey: ['/api/system/settings/public'],
  });

  const systemSharePrice = systemConfig?.sharePrice ?? 5000;

  const shareCapitalTransactions = (transactions || []).filter(
    (t: any) => t.transactionType === 'share_capital' && t.status === 'completed'
  );

  const form = useForm<PostShareCapitalData>({
    resolver: zodResolver(postShareCapitalSchema),
    defaultValues: { amount: "", description: "" },
  });

  const postMutation = useMutation({
    mutationFn: async (data: PostShareCapitalData) => {
      if (!selectedMember) throw new Error("No member selected");
      const res = await apiRequest("POST", `/api/members/${selectedMember.uuid}/share-capital`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Share Capital Posted", description: data.message, variant: "success" });
      setIsPostDialogOpen(false);
      setSelectedMember(null);
      form.reset({ amount: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to post share capital", variant: "destructive" });
    },
  });

  const activeMembers = (members || []).filter(m => m.status === 'active');
  const filteredMembers = activeMembers.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.fullName?.toLowerCase().includes(q) ||
      m.memberNumber?.toLowerCase().includes(q) ||
      m.idNumber?.toLowerCase().includes(q);
  });

  const totalExpected = activeMembers.reduce((sum, m) =>
    sum + (systemSharePrice * (m.numberOfShares || 4)), 0);
  const totalPaid = activeMembers.reduce((sum, m) => sum + parseFloat(m.shareCapital || "0"), 0);
  const totalOutstanding = totalExpected - totalPaid;
  const fullyPaidCount = activeMembers.filter(m => m.isPaidUp).length;

  const openPostDialog = (member: MemberWithDetails) => {
    setSelectedMember(member);
    const expected = systemSharePrice * (member.numberOfShares || 4);
    const paid = parseFloat(member.shareCapital || "0");
    const balance = Math.max(0, expected - paid);
    form.reset({
      amount: balance > 0 ? balance.toString() : "",
      description: `Share capital payment - ${member.numberOfShares || 4} shares @ ${formatCurrency(systemSharePrice)} per share`,
    });
    setIsPostDialogOpen(true);
  };

  return (
    <div className="space-y-6 page-container animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Share Capital Management</h1>
        <p className="text-sm text-muted-foreground">Manage member share capital contributions and track payment status</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Members</p>
                <p className="text-lg sm:text-2xl font-bold">{activeMembers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-950/50 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Paid</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600 truncate">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-950/50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Outstanding</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600 truncate">{formatCurrency(totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Fully Paid</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-600">{fullyPaidCount} / {activeMembers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="members" className="text-xs sm:text-sm">Member Share Capital</TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Member Share Capital Status</CardTitle>
                  <CardDescription>View and manage share capital for all active members</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Loading members...</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead className="hidden sm:table-cell">Shares</TableHead>
                        <TableHead className="hidden md:table-cell text-right">Per Share</TableHead>
                        <TableHead className="hidden md:table-cell text-right">Expected</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Balance</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        {canPost && <TableHead className="text-center">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => {
                        const perShare = systemSharePrice;
                        const shares = member.numberOfShares || 4;
                        const expected = perShare * shares;
                        const paid = parseFloat(member.shareCapital || "0");
                        const balance = expected - paid;

                        return (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{member.fullName}</p>
                                <p className="text-xs text-muted-foreground">{member.memberNumber}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-center">{shares}</TableCell>
                            <TableCell className="hidden md:table-cell text-right">{formatCurrency(perShare)}</TableCell>
                            <TableCell className="hidden md:table-cell text-right">{formatCurrency(expected)}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatCurrency(paid)}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right font-medium text-orange-600">
                              {balance > 0 ? formatCurrency(balance) : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={member.isPaidUp
                                ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300'
                                : paid > 0
                                  ? 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300'
                                  : 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300'
                              }>
                                {member.isPaidUp ? 'Fully Paid' : paid > 0 ? 'Partial' : 'Unpaid'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {!member.isPaidUp && canPost && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openPostDialog(member)}
                                  className="h-8"
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" />
                                  Post
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredMembers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={canPost ? 8 : 7} className="text-center py-8 text-muted-foreground">
                            No members found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Share Capital Payment History</CardTitle>
              <CardDescription>All share capital transactions across members</CardDescription>
            </CardHeader>
            <CardContent>
              {shareCapitalTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead className="hidden md:table-cell">Reference</TableHead>
                        <TableHead className="hidden md:table-cell">Description</TableHead>
                        <TableHead className="text-right">Amount (UGX)</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shareCapitalTransactions.map((tx: any) => (
                        <TableRow key={tx.id}>
                          <TableCell className="hidden sm:table-cell">
                            {tx.createdAt ? (() => {
                              try { return format(new Date(tx.createdAt), 'PP'); }
                              catch { return 'N/A'; }
                            })() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{tx.member?.fullName || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{tx.member?.memberNumber || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground">
                            {tx.referenceNumber || '-'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {tx.description || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            +{formatCurrency(tx.amount || '0')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 text-xs">
                              {tx.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No share capital payments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isPostDialogOpen} onOpenChange={setIsPostDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Post Share Capital
            </DialogTitle>
            <DialogDescription>
              Post a share capital payment for {selectedMember?.fullName || 'member'}.
              {selectedMember && (
                <span className="block mt-2 text-xs">
                  Expected: {formatCurrency(systemSharePrice * (selectedMember.numberOfShares || 4))}
                  {" | "}Paid: {formatCurrency(selectedMember.shareCapital || "0")}
                  {" | "}Balance: {formatCurrency(Math.max(0, (systemSharePrice * (selectedMember.numberOfShares || 4)) - parseFloat(selectedMember.shareCapital || "0")))}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => postMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (UGX)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Payment description..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsPostDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={postMutation.isPending}>
                  {postMutation.isPending ? "Posting..." : "Post Payment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
