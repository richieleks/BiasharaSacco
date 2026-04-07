import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Pagination } from "@/components/ui/pagination";
import { Coins, Calculator, CheckCircle, Send, Trash2, Eye, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function Dividends() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCalcDialog, setShowCalcDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState<number | null>(null);
  const [calcForm, setCalcForm] = useState({ financialYearId: '', dividendRate: '', notes: '' });
  const [membersPage, setMembersPage] = useState(1);
  const membersPageSize = 25;

  const { data: distributions, isLoading } = useQuery<any[]>({
    queryKey: ['/api/dividends'],
  });

  const { data: financialYears } = useQuery<any[]>({
    queryKey: ['/api/financial-years'],
  });

  const { data: memberDividends, isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ['/api/dividends', showMembersDialog, 'members'],
    queryFn: async () => {
      if (!showMembersDialog) return [];
      const res = await fetch(`/api/dividends/${showMembersDialog}/members`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!showMembersDialog,
  });

  const calculateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/dividends/calculate', data);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/dividends'] });
      setShowCalcDialog(false);
      setCalcForm({ financialYearId: '', dividendRate: '', notes: '' });
      toast({ title: "Dividends Calculated", description: `Calculated for ${data.memberCount} members. Total: ${formatCurrency(data.totalDividendAmount)}`, variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/dividends/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/dividends'] });
      toast({ title: "Approved", description: "Dividend distribution approved", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const distributeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/dividends/${id}/distribute`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/dividends'] });
      toast({ title: "Distributed", description: data.message, variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/dividends/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/dividends'] });
      toast({ title: "Deleted", description: "Distribution deleted", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const paginatedMembers = memberDividends?.slice((membersPage - 1) * membersPageSize, membersPage * membersPageSize) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">Dividend Management</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Calculate and distribute dividends on member share capital</p>
        </div>
        <Button onClick={() => setShowCalcDialog(true)}>
          <Calculator className="w-4 h-4 mr-2" />Calculate Dividends
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : distributions && distributions.length > 0 ? (
        <div className="space-y-4">
          {distributions.map((dist: any) => (
            <div key={dist.id} className="section-card">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">FY {dist.year_label}</h3>
                      <Badge variant={dist.status === 'distributed' ? 'default' : dist.status === 'approved' ? 'secondary' : 'outline'}
                        className={dist.status === 'distributed' ? 'bg-green-600' : dist.status === 'approved' ? 'bg-blue-600 text-white' : ''}>
                        {dist.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Rate: {(parseFloat(dist.dividend_rate) * 100).toFixed(2)}% | 
                      Members: {dist.member_count} ({dist.paid_count} paid) | 
                      By: {dist.calculated_by_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total Dividend</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(dist.total_dividend_amount)}</p>
                    <p className="text-xs text-slate-400">on {formatCurrency(dist.total_shares)} shares</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Surplus</p>
                    <p className="font-semibold text-sm">{formatCurrency(dist.total_surplus)}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Total Shares</p>
                    <p className="font-semibold text-sm">{formatCurrency(dist.total_shares)}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Rate</p>
                    <p className="font-semibold text-sm">{(parseFloat(dist.dividend_rate) * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Total Payout</p>
                    <p className="font-semibold text-sm">{formatCurrency(dist.total_dividend_amount)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => { setShowMembersDialog(dist.id); setMembersPage(1); }}>
                    <Eye className="w-4 h-4 mr-1" />View Members
                  </Button>
                  {dist.status === 'draft' && (
                    <>
                      <Button size="sm" onClick={() => approveMutation.mutate(dist.id)} disabled={approveMutation.isPending}>
                        <CheckCircle className="w-4 h-4 mr-1" />Approve
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(dist.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="w-4 h-4 mr-1" />Delete
                      </Button>
                    </>
                  )}
                  {dist.status === 'approved' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => distributeMutation.mutate(dist.id)} disabled={distributeMutation.isPending}>
                      <Send className="w-4 h-4 mr-1" />{distributeMutation.isPending ? 'Distributing...' : 'Distribute'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="section-card">
          <div className="p-8 text-center">
            <Coins className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-600 dark:text-slate-300">No dividend distributions yet</p>
            <p className="text-sm text-slate-400 mt-1">Click "Calculate Dividends" to create a new distribution</p>
          </div>
        </div>
      )}

      <Dialog open={showCalcDialog} onOpenChange={setShowCalcDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculate Dividends</DialogTitle>
            <DialogDescription>Calculate dividends on member share capital for a financial year</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Financial Year</Label>
              <Select value={calcForm.financialYearId} onValueChange={(v) => setCalcForm({ ...calcForm, financialYearId: v })}>
                <SelectTrigger><SelectValue placeholder="Select financial year" /></SelectTrigger>
                <SelectContent>
                  {financialYears?.map((fy: any) => (
                    <SelectItem key={fy.id} value={String(fy.id)}>{fy.yearLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dividend Rate (%)</Label>
              <Input type="number" step="0.01" placeholder="e.g., 10"
                value={calcForm.dividendRate}
                onChange={(e) => setCalcForm({ ...calcForm, dividendRate: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1">Percentage of share capital to pay as dividends</p>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea placeholder="AGM resolution reference, etc."
                value={calcForm.notes}
                onChange={(e) => setCalcForm({ ...calcForm, notes: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={() => calculateMutation.mutate(calcForm)} disabled={calculateMutation.isPending || !calcForm.financialYearId || !calcForm.dividendRate}>
              {calculateMutation.isPending ? 'Calculating...' : 'Calculate Dividends'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showMembersDialog} onOpenChange={(open) => { if (!open) setShowMembersDialog(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Member Dividends</DialogTitle>
            <DialogDescription>{memberDividends?.length || 0} members in this distribution</DialogDescription>
          </DialogHeader>
          {membersLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Share Capital</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Dividend</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMembers.map((md: any) => (
                      <TableRow key={md.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{md.full_name}</p>
                            <p className="text-xs text-slate-400">{md.member_number}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(md.share_capital)}</TableCell>
                        <TableCell className="text-right">{md.number_of_shares}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{formatCurrency(md.dividend_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={md.status === 'paid' ? 'default' : 'outline'} className={md.status === 'paid' ? 'bg-green-600' : ''}>
                            {md.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {memberDividends && memberDividends.length > membersPageSize && (
                <Pagination
                  currentPage={membersPage}
                  totalPages={Math.ceil(memberDividends.length / membersPageSize)}
                  onPageChange={setMembersPage}
                  itemsPerPage={membersPageSize}
                  onItemsPerPageChange={() => {}}
                  totalItems={memberDividends.length}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
