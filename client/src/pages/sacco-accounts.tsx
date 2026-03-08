import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Landmark, Plus, ArrowRightLeft, RotateCcw, Search,
  TrendingUp, TrendingDown, Wallet, Building2, PiggyBank,
  ChevronLeft, ChevronRight, DollarSign, Scale, Link2, Save, Check
} from "lucide-react";
import type { SaccoAccount, SaccoAccountMapping } from "@shared/schema";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  liability: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  equity: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  revenue: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  expense: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const ACCOUNT_TYPE_ICONS: Record<string, typeof Wallet> = {
  asset: Wallet,
  liability: Building2,
  equity: Scale,
  revenue: TrendingUp,
  expense: TrendingDown,
};

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `UGX ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function SaccoAccounts() {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();
  const canManage = hasPermission('update', 'sacco-accounts');

  const [activeTab, setActiveTab] = useState("accounts");
  const [accountFilter, setAccountFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SaccoAccount | null>(null);
  const [journalPage, setJournalPage] = useState(1);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<SaccoAccount[]>({
    queryKey: ['/api/sacco-accounts'],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/sacco-accounts/summary'],
  });

  const { data: journalData, isLoading: journalLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: ['/api/sacco-journal-entries', journalPage],
    queryFn: async () => {
      const res = await fetch(`/api/sacco-journal-entries?page=${journalPage}&limit=15`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/sacco-accounts', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-accounts/summary'] });
      setShowAccountDialog(false);
      setEditingAccount(null);
      toast({ title: "Account created", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', `/api/sacco-accounts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-accounts/summary'] });
      setShowAccountDialog(false);
      setEditingAccount(null);
      toast({ title: "Account updated", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/sacco-journal-entries', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-accounts/summary'] });
      setShowEntryDialog(false);
      toast({ title: "Journal entry recorded", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reverseEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/sacco-journal-entries/${id}/reverse`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-accounts/summary'] });
      toast({ title: "Entry reversed", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredAccounts = accounts.filter(acc => {
    if (accountFilter !== 'all' && acc.accountType !== accountFilter) return false;
    if (searchQuery && !acc.accountName.toLowerCase().includes(searchQuery.toLowerCase()) && !acc.accountCode.includes(searchQuery)) return false;
    return true;
  });

  const groupedAccounts = filteredAccounts.reduce((groups, acc) => {
    if (!groups[acc.accountType]) groups[acc.accountType] = [];
    groups[acc.accountType].push(acc);
    return groups;
  }, {} as Record<string, SaccoAccount[]>);

  const totalPages = journalData ? Math.ceil(journalData.total / 15) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Landmark className="h-7 w-7 text-primary" />
            SACCO Operational Accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the SACCO's chart of accounts, record journal entries, and track financial position
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="accounts" data-testid="tab-accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal" data-testid="tab-journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">Mappings</TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-accounts"
                />
              </div>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-account-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="asset">Assets</SelectItem>
                  <SelectItem value="liability">Liabilities</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canManage && (
              <Button onClick={() => { setEditingAccount(null); setShowAccountDialog(true); }} data-testid="button-add-account">
                <Plus className="h-4 w-4 mr-2" /> Add Account
              </Button>
            )}
          </div>

          {accountsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}><CardContent className="p-6"><div className="h-20 bg-muted animate-pulse rounded" /></CardContent></Card>
              ))}
            </div>
          ) : (
            Object.entries(ACCOUNT_TYPE_LABELS).map(([type, label]) => {
              const typeAccounts = groupedAccounts[type];
              if (!typeAccounts || typeAccounts.length === 0) {
                if (accountFilter !== 'all' && accountFilter !== type) return null;
                return null;
              }
              const TypeIcon = ACCOUNT_TYPE_ICONS[type] || Wallet;
              const typeTotal = typeAccounts.reduce((sum, a) => sum + parseFloat(a.balance || '0'), 0);
              return (
                <Card key={type} data-testid={`card-account-group-${type}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TypeIcon className="h-5 w-5" />
                        {label}
                        <Badge variant="secondary" className="ml-2">{typeAccounts.length}</Badge>
                      </CardTitle>
                      <span className="text-lg font-semibold" data-testid={`text-total-${type}`}>
                        {formatCurrency(typeTotal)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead className="hidden md:table-cell">Description</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="w-20">Status</TableHead>
                          {canManage && <TableHead className="w-16"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typeAccounts.map(acc => (
                          <TableRow key={acc.id} data-testid={`row-account-${acc.id}`}>
                            <TableCell className="font-mono text-sm font-medium">{acc.accountCode}</TableCell>
                            <TableCell className="font-medium">{acc.accountName}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[200px]">{acc.description}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(acc.balance)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={acc.isActive ? "default" : "secondary"} className="text-xs">
                                {acc.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            {canManage && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setEditingAccount(acc); setShowAccountDialog(true); }}
                                  data-testid={`button-edit-account-${acc.id}`}
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="journal" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Journal Entries</h2>
            {canManage && (
              <Button onClick={() => setShowEntryDialog(true)} data-testid="button-add-entry">
                <ArrowRightLeft className="h-4 w-4 mr-2" /> New Entry
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {journalLoading ? (
                <div className="p-6"><div className="h-40 bg-muted animate-pulse rounded" /></div>
              ) : journalData?.data.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No journal entries yet</p>
                  {canManage && <p className="text-sm mt-1">Click "New Entry" to record your first transaction</p>}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entry #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Debit Account</TableHead>
                      <TableHead>Credit Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>By</TableHead>
                      {canManage && <TableHead className="w-20"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalData?.data.map((entry: any) => (
                      <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                        <TableCell className="text-sm">{new Date(entry.entryDate).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs">{entry.entryNumber}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">{entry.debitAccountCode}</span>{" "}
                          <span className="text-sm">{entry.debitAccountName}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">{entry.creditAccountCode}</span>{" "}
                          <span className="text-sm">{entry.creditAccountName}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(entry.amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.createdByName}</TableCell>
                        {canManage && (
                          <TableCell>
                            {entry.status === 'posted' && !entry.reversedById && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Are you sure you want to reverse this entry? This will create an opposite entry to undo the effect.")) {
                                    reverseEntryMutation.mutate(entry.id);
                                  }
                                }}
                                disabled={reverseEntryMutation.isPending}
                                data-testid={`button-reverse-entry-${entry.id}`}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {journalPage} of {totalPages} ({journalData?.total} entries)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={journalPage <= 1} onClick={() => setJournalPage(p => p - 1)} data-testid="button-prev-page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={journalPage >= totalPages} onClick={() => setJournalPage(p => p + 1)} data-testid="button-next-page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4 mt-4">
          <MappingsTab accounts={accounts} canManage={canManage} />
        </TabsContent>

        <TabsContent value="summary" className="space-y-6 mt-4">
          {summaryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i}><CardContent className="p-6"><div className="h-20 bg-muted animate-pulse rounded" /></CardContent></Card>
              ))}
            </div>
          ) : summary ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SummaryCard title="Total Assets" amount={summary.totalAssets} icon={Wallet} color="blue" testId="summary-assets" />
                <SummaryCard title="Total Liabilities" amount={summary.totalLiabilities} icon={Building2} color="amber" testId="summary-liabilities" />
                <SummaryCard title="Total Equity" amount={summary.totalEquity} icon={Scale} color="emerald" testId="summary-equity" />
                <SummaryCard title="Total Revenue" amount={summary.totalRevenue} icon={TrendingUp} color="green" testId="summary-revenue" />
                <SummaryCard title="Total Expenses" amount={summary.totalExpenses} icon={TrendingDown} color="red" testId="summary-expenses" />
                <SummaryCard title="Net Income" amount={summary.netIncome} icon={DollarSign} color={summary.netIncome >= 0 ? "green" : "red"} testId="summary-net-income" />
              </div>

              <Card data-testid="card-balance-sheet">
                <CardHeader>
                  <CardTitle className="text-lg">Balance Sheet Check</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <p className="text-sm text-muted-foreground mb-1">Total Assets</p>
                      <p className="text-xl font-bold" data-testid="text-bs-assets">{formatCurrency(summary.totalAssets)}</p>
                    </div>
                    <div className="flex items-center justify-center text-2xl font-bold text-muted-foreground">=</div>
                    <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <p className="text-sm text-muted-foreground mb-1">Liabilities + Equity</p>
                      <p className="text-xl font-bold" data-testid="text-bs-liabilities-equity">
                        {formatCurrency(summary.totalLiabilities + summary.totalEquity)}
                      </p>
                    </div>
                  </div>
                  {Math.abs(summary.balanceSheetBalance) < 0.01 ? (
                    <p className="text-center text-sm text-green-600 dark:text-green-400 mt-4 font-medium">
                      Balance sheet is balanced
                    </p>
                  ) : (
                    <p className="text-center text-sm text-amber-600 dark:text-amber-400 mt-4 font-medium">
                      Difference: {formatCurrency(Math.abs(summary.balanceSheetBalance))}
                    </p>
                  )}
                </CardContent>
              </Card>

              {summary.byType && Object.entries(summary.byType).map(([type, data]: [string, any]) => (
                <Card key={type} data-testid={`card-summary-${type}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge className={ACCOUNT_TYPE_COLORS[type]}>{ACCOUNT_TYPE_LABELS[type]}</Badge>
                      <span className="ml-auto font-semibold">{formatCurrency(data.totalBalance)}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {data.accounts.map((acc: SaccoAccount) => (
                        <div key={acc.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                          <div>
                            <span className="font-mono text-xs text-muted-foreground mr-2">{acc.accountCode}</span>
                            <span className="text-sm">{acc.accountName}</span>
                          </div>
                          <span className="text-sm font-medium tabular-nums">{formatCurrency(acc.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : null}
        </TabsContent>
      </Tabs>

      <AccountDialog
        open={showAccountDialog}
        onOpenChange={setShowAccountDialog}
        account={editingAccount}
        onSubmit={(data) => {
          if (editingAccount) {
            updateAccountMutation.mutate({ id: editingAccount.id, data });
          } else {
            createAccountMutation.mutate(data);
          }
        }}
        isPending={createAccountMutation.isPending || updateAccountMutation.isPending}
      />

      <JournalEntryDialog
        open={showEntryDialog}
        onOpenChange={setShowEntryDialog}
        accounts={accounts.filter(a => a.isActive)}
        onSubmit={(data) => createEntryMutation.mutate(data)}
        isPending={createEntryMutation.isPending}
      />
    </div>
  );
}

function SummaryCard({ title, amount, icon: Icon, color, testId }: {
  title: string; amount: number; icon: any; color: string; testId: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    green: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  };
  return (
    <Card data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(amount)}</p>
          </div>
          <div className={`p-3 rounded-lg ${colorMap[color] || colorMap.blue}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountDialog({ open, onOpenChange, account, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: SaccoAccount | null;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    accountCode: '',
    accountName: '',
    accountType: 'asset',
    description: '',
    isActive: true,
  });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && account) {
      setFormData({
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        description: account.description || '',
        isActive: account.isActive,
      });
    } else if (isOpen) {
      setFormData({ accountCode: '', accountName: '', accountType: 'asset', description: '', isActive: true });
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Add New Account'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountCode">Account Code</Label>
              <Input
                id="accountCode"
                value={formData.accountCode}
                onChange={e => setFormData(p => ({ ...p, accountCode: e.target.value }))}
                placeholder="e.g. 1006"
                required
                data-testid="input-account-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type</Label>
              <Select value={formData.accountType} onValueChange={v => setFormData(p => ({ ...p, accountType: v }))}>
                <SelectTrigger data-testid="select-account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountName">Account Name</Label>
            <Input
              id="accountName"
              value={formData.accountName}
              onChange={e => setFormData(p => ({ ...p, accountName: e.target.value }))}
              placeholder="e.g. Office Equipment"
              required
              data-testid="input-account-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Brief description of this account"
              rows={2}
              data-testid="input-account-description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-account">
              {isPending ? "Saving..." : account ? "Update Account" : "Create Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JournalEntryDialog({ open, onOpenChange, accounts, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: SaccoAccount[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
  });

  const resetForm = () => {
    setFormData({
      entryDate: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
      debitAccountId: '',
      creditAccountId: '',
      amount: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.debitAccountId === formData.creditAccountId) {
      return;
    }
    onSubmit({
      ...formData,
      debitAccountId: parseInt(formData.debitAccountId),
      creditAccountId: parseInt(formData.creditAccountId),
    });
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Journal Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entryDate">Date</Label>
              <Input
                id="entryDate"
                type="date"
                value={formData.entryDate}
                onChange={e => setFormData(p => ({ ...p, entryDate: e.target.value }))}
                required
                data-testid="input-entry-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (UGX)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="1"
                value={formData.amount}
                onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                required
                data-testid="input-entry-amount"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="debitAccount">Debit Account (receives/increases)</Label>
            <Select value={formData.debitAccountId} onValueChange={v => setFormData(p => ({ ...p, debitAccountId: v }))}>
              <SelectTrigger data-testid="select-debit-account">
                <SelectValue placeholder="Select debit account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    <span className="font-mono text-xs mr-2">{acc.accountCode}</span>
                    {acc.accountName}
                    <Badge className={`ml-2 text-[10px] ${ACCOUNT_TYPE_COLORS[acc.accountType]}`}>
                      {acc.accountType}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="creditAccount">Credit Account (gives/decreases)</Label>
            <Select value={formData.creditAccountId} onValueChange={v => setFormData(p => ({ ...p, creditAccountId: v }))}>
              <SelectTrigger data-testid="select-credit-account">
                <SelectValue placeholder="Select credit account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    <span className="font-mono text-xs mr-2">{acc.accountCode}</span>
                    {acc.accountName}
                    <Badge className={`ml-2 text-[10px] ${ACCOUNT_TYPE_COLORS[acc.accountType]}`}>
                      {acc.accountType}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {formData.debitAccountId && formData.creditAccountId && formData.debitAccountId === formData.creditAccountId && (
            <p className="text-sm text-destructive">Debit and credit accounts must be different</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="What is this transaction for?"
              rows={2}
              required
              data-testid="input-entry-description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">Reference (optional)</Label>
            <Input
              id="reference"
              value={formData.reference}
              onChange={e => setFormData(p => ({ ...p, reference: e.target.value }))}
              placeholder="e.g. Invoice #, Receipt #"
              data-testid="input-entry-reference"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={isPending || !formData.debitAccountId || !formData.creditAccountId || formData.debitAccountId === formData.creditAccountId}
              data-testid="button-save-entry"
            >
              {isPending ? "Recording..." : "Record Entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  loan: "Loan Operations",
  savings: "Savings Operations",
  membership: "Membership & Shares",
  operations: "General Operations",
};

const CATEGORY_ICONS: Record<string, typeof Wallet> = {
  loan: DollarSign,
  savings: PiggyBank,
  membership: Building2,
  operations: Wallet,
};

function MappingsTab({ accounts, canManage }: { accounts: SaccoAccount[]; canManage: boolean }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDebit, setEditDebit] = useState<string>("");
  const [editCredit, setEditCredit] = useState<string>("");

  const { data: mappings = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/sacco-account-mappings'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, debitAccountId, creditAccountId }: { id: number; debitAccountId: number | null; creditAccountId: number | null }) => {
      const res = await apiRequest('PATCH', `/api/sacco-account-mappings/${id}`, { debitAccountId, creditAccountId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sacco-account-mappings'] });
      setEditingId(null);
      toast({ title: "Mapping updated", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const activeAccounts = accounts.filter(a => a.isActive);

  const groupedMappings = mappings.reduce((groups: Record<string, any[]>, m: any) => {
    if (!groups[m.category]) groups[m.category] = [];
    groups[m.category].push(m);
    return groups;
  }, {});

  const startEdit = (mapping: any) => {
    setEditingId(mapping.id);
    setEditDebit(mapping.debitAccountId?.toString() || "");
    setEditCredit(mapping.creditAccountId?.toString() || "");
  };

  const saveEdit = (id: number) => {
    updateMutation.mutate({
      id,
      debitAccountId: editDebit ? parseInt(editDebit) : null,
      creditAccountId: editCredit ? parseInt(editCredit) : null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><div className="h-24 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Fee & Rate Account Mappings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure which GL accounts are debited and credited for each type of financial operation
        </p>
      </div>

      {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
        const categoryMappings = groupedMappings[category];
        if (!categoryMappings || categoryMappings.length === 0) return null;
        const CatIcon = CATEGORY_ICONS[category] || Wallet;
        return (
          <Card key={category} data-testid={`card-mapping-group-${category}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CatIcon className="h-5 w-5 text-primary" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Fee / Rate</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead>Debit Account</TableHead>
                    <TableHead>Credit Account</TableHead>
                    {canManage && <TableHead className="w-20"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryMappings.map((mapping: any) => (
                    <TableRow key={mapping.id} data-testid={`row-mapping-${mapping.id}`}>
                      <TableCell className="font-medium text-sm">{mapping.mappingLabel}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{mapping.description}</TableCell>
                      <TableCell>
                        {editingId === mapping.id ? (
                          <Select value={editDebit} onValueChange={setEditDebit}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-edit-debit-${mapping.id}`}>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                  <span className="font-mono text-xs mr-1">{acc.accountCode}</span> {acc.accountName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : mapping.debitAccountId ? (
                          <span className="text-sm">
                            <span className="font-mono text-xs text-muted-foreground mr-1">{mapping.debitAccountCode}</span>
                            {mapping.debitAccountName}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Not mapped</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === mapping.id ? (
                          <Select value={editCredit} onValueChange={setEditCredit}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-edit-credit-${mapping.id}`}>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                  <span className="font-mono text-xs mr-1">{acc.accountCode}</span> {acc.accountName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : mapping.creditAccountId ? (
                          <span className="text-sm">
                            <span className="font-mono text-xs text-muted-foreground mr-1">{mapping.creditAccountCode}</span>
                            {mapping.creditAccountName}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Not mapped</span>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          {editingId === mapping.id ? (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveEdit(mapping.id)}
                                disabled={updateMutation.isPending}
                                data-testid={`button-save-mapping-${mapping.id}`}
                              >
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingId(null)}
                                data-testid={`button-cancel-mapping-${mapping.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(mapping)}
                              data-testid={`button-edit-mapping-${mapping.id}`}
                            >
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
