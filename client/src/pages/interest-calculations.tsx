import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import { Calculator, Calendar, DollarSign, FileText, TrendingUp, Users, Download, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface FinancialYear {
  id: number;
  yearLabel: string;
  startDate: string;
  endDate: string;
  interestRate: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InterestCalculation {
  id: number;
  financialYearId: number;
  savingsAccountId: number;
  memberId: number;
  memberName?: string;
  memberNumber?: string;
  calculationDate: string;
  periodStartDate: string;
  periodEndDate: string;
  averageBalance: string;
  interestRate: string;
  grossInterest: string;
  taxAmount: string;
  netInterest: string;
  status: 'calculated' | 'approved' | 'posted';
  calculationMethod: string;
  notes: string;
  approvedBy?: string;
  approvedAt?: string;
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface InterestPayment {
  id: number;
  interestCalculationId: number;
  memberId: number;
  memberName?: string;
  memberNumber?: string;
  savingsAccountId: number;
  paymentAmount: string;
  paymentMethod: 'credit_to_account' | 'cash' | 'bank_transfer';
  status: 'pending' | 'completed' | 'failed';
  processedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export default function InterestCalculations() {
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<number | null>(null);
  const [newFinancialYearData, setNewFinancialYearData] = useState({
    yearLabel: '',
    startDate: '',
    endDate: '',
    interestRate: '',
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch financial years
  const { data: financialYears = [], isLoading: financialYearsLoading } = useQuery<FinancialYear[]>({
    queryKey: ['/api/financial-years'],
  });

  // Fetch active financial year
  const { data: activeFinancialYear } = useQuery<FinancialYear>({
    queryKey: ['/api/financial-years/active'],
  });

  // Fetch interest calculations
  const { data: calculations = [], isLoading: calculationsLoading } = useQuery<InterestCalculation[]>({
    queryKey: ['/api/interest-calculations', selectedFinancialYear],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/interest-calculations${selectedFinancialYear ? `?financialYearId=${selectedFinancialYear}` : ''}`);
      return res.json();
    },
  });

  // Fetch interest payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<InterestPayment[]>({
    queryKey: ['/api/interest-payments', selectedFinancialYear],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/interest-payments${selectedFinancialYear ? `?financialYearId=${selectedFinancialYear}` : ''}`);
      return res.json();
    },
  });

  // Create financial year mutation
  const createFinancialYearMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/financial-years', data),
    onSuccess: () => {
      toast({ title: 'Success',
        description: 'Financial year created successfully', variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-years'] });
      setIsCreateDialogOpen(false);
      setNewFinancialYearData({ yearLabel: '', startDate: '', endDate: '', interestRate: '' });
    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to create financial year';
      toast({
        title: 'Duplicate or Overlap Detected',
        description: msg,
        variant: 'destructive',
      });
    },
  });

  // Activate financial year mutation
  const activateFinancialYearMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PUT', `/api/financial-years/${id}/activate`),
    onSuccess: () => {
      toast({ title: 'Success',
        description: 'Financial year activated successfully', variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-years'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-years/active'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to activate financial year',
        variant: 'destructive',
      });
    },
  });

  // Calculate interest for all members mutation
  const calculateAllInterestMutation = useMutation({
    mutationFn: (financialYearId: number) => apiRequest('POST', '/api/interest-calculations/calculate-all', { financialYearId }),
    onSuccess: () => {
      toast({ title: 'Success',
        description: 'Interest calculations completed for all members', variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/interest-calculations'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to calculate interest',
        variant: 'destructive',
      });
    },
  });

  // Create balance snapshots mutation
  const createSnapshotsMutation = useMutation({
    mutationFn: (data: { financialYearId: number; snapshotDate: string }) => 
      apiRequest('POST', '/api/balance-snapshots/create-all', data),
    onSuccess: () => {
      toast({ title: 'Success',
        description: 'Balance snapshots created for all accounts', variant: "success" });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create balance snapshots',
        variant: 'destructive',
      });
    },
  });

  // Approve interest calculation mutation
  const approveCalculationMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PUT', `/api/interest-calculations/${id}/approve`),
    onSuccess: () => {
      toast({ title: 'Success',
        description: 'Interest calculation approved', variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/interest-calculations'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to approve calculation',
        variant: 'destructive',
      });
    },
  });

  // Post interest calculation mutation
  const postCalculationMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PUT', `/api/interest-calculations/${id}/post`),
    onSuccess: () => {
      toast({ title: 'Success',
        description: 'Interest calculation posted', variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/interest-calculations'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to post calculation',
        variant: 'destructive',
      });
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: (financialYearId: number) => apiRequest('PUT', '/api/interest-calculations/approve-all', { financialYearId }),
    onSuccess: (data: any) => {
      toast({ title: 'Success',
        description: `Approved ${data.approved} interest calculations`, variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/interest-calculations'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to approve all calculations',
        variant: 'destructive',
      });
    },
  });

  const postAllMutation = useMutation({
    mutationFn: (financialYearId: number) => apiRequest('PUT', '/api/interest-calculations/post-all', { financialYearId }),
    onSuccess: (data: any) => {
      toast({ title: 'Success',
        description: `Posted ${data.posted} interest calculations and credited member accounts`, variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/interest-calculations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/interest-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/savings'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to post all calculations',
        variant: 'destructive',
      });
    },
  });

  const handleCreateFinancialYear = () => {
    if (!newFinancialYearData.yearLabel || !newFinancialYearData.startDate || !newFinancialYearData.endDate || !newFinancialYearData.interestRate) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    if (financialYears && Array.isArray(financialYears)) {
      const labelExists = financialYears.some((fy: any) => fy.yearLabel === newFinancialYearData.yearLabel);
      if (labelExists) {
        toast({
          title: 'Duplicate Financial Year',
          description: `A financial year with the label "${newFinancialYearData.yearLabel}" already exists`,
          variant: 'destructive',
        });
        return;
      }

      const newStart = new Date(newFinancialYearData.startDate);
      const newEnd = new Date(newFinancialYearData.endDate);
      const overlap = financialYears.find((fy: any) => {
        const fyStart = new Date(fy.startDate);
        const fyEnd = new Date(fy.endDate);
        return newStart <= fyEnd && newEnd >= fyStart;
      });
      if (overlap) {
        toast({
          title: 'Overlapping Dates',
          description: `Date range overlaps with "${(overlap as any).yearLabel}" (${(overlap as any).startDate} to ${(overlap as any).endDate})`,
          variant: 'destructive',
        });
        return;
      }
    }

    createFinancialYearMutation.mutate({
      ...newFinancialYearData,
      interestRate: (parseFloat(newFinancialYearData.interestRate) / 100).toString(),
      status: 'draft',
      isActive: false,
    });
  };

  const handleCreateSnapshots = () => {
    if (!selectedFinancialYear) {
      toast({
        title: 'Error',
        description: 'Please select a financial year',
        variant: 'destructive',
      });
      return;
    }

    const snapshotDate = new Date().toISOString().split('T')[0];
    createSnapshotsMutation.mutate({
      financialYearId: selectedFinancialYear,
      snapshotDate,
    });
  };

  const handleCalculateAllInterest = () => {
    if (!selectedFinancialYear) {
      toast({
        title: 'Error',
        description: 'Please select a financial year',
        variant: 'destructive',
      });
      return;
    }

    calculateAllInterestMutation.mutate(selectedFinancialYear);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'calculated':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Calculated</Badge>;
      case 'approved':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'posted':
        return <Badge variant="destructive"><TrendingUp className="w-3 h-3 mr-1" />Posted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPercentage = (rate: string) => {
    return `${(parseFloat(rate) * 100).toFixed(2)}%`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interest Calculations</h1>
          <p className="text-muted-foreground">
            Manage financial years and calculate interest on savings accounts
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Financial Year
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Financial Year</DialogTitle>
              <DialogDescription>
                Create a new financial year for interest calculations
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="yearLabel">Year Label</Label>
                <Input
                  id="yearLabel"
                  placeholder="e.g., FY 2024-2025"
                  value={newFinancialYearData.yearLabel}
                  onChange={(e) => setNewFinancialYearData(prev => ({ ...prev, yearLabel: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newFinancialYearData.startDate}
                    onChange={(e) => setNewFinancialYearData(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={newFinancialYearData.endDate}
                    onChange={(e) => setNewFinancialYearData(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="interestRate">Interest Rate (%)</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.001"
                  placeholder="e.g., 8.5"
                  value={newFinancialYearData.interestRate}
                  onChange={(e) => setNewFinancialYearData(prev => ({ ...prev, interestRate: e.target.value }))}
                />
              </div>
              <Button 
                onClick={handleCreateFinancialYear}
                disabled={createFinancialYearMutation.isPending}
                className="w-full"
              >
                {createFinancialYearMutation.isPending ? 'Creating...' : 'Create Financial Year'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Financial Years Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Financial Years</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financialYears.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Financial Year</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeFinancialYear ? activeFinancialYear.yearLabel : 'None'}
            </div>
            {activeFinancialYear && (
              <p className="text-xs text-muted-foreground">
                Rate: {formatPercentage(activeFinancialYear.interestRate)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calculations</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calculations.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financial-years" className="space-y-4">
        <TabsList>
          <TabsTrigger value="financial-years">Financial Years</TabsTrigger>
          <TabsTrigger value="calculations">Interest Calculations</TabsTrigger>
          <TabsTrigger value="payments">Interest Payments</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="financial-years" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Years</CardTitle>
              <CardDescription>
                Manage financial years for interest calculations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {financialYearsLoading ? (
                  <div>Loading financial years...</div>
                ) : financialYears.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No financial years</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      Get started by creating a new financial year.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {financialYears.map((year: FinancialYear) => (
                      <div
                        key={year.id}
                        className={`p-4 border rounded-lg ${
                          year.isActive ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{year.yearLabel}</h3>
                            <p className="text-sm text-muted-foreground">
                              {year.startDate} to {year.endDate} • Rate: {formatPercentage(year.interestRate)}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant={year.isActive ? 'default' : 'secondary'}>
                                {year.isActive ? 'Active' : year.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!year.isActive && (
                              <Button
                                size="sm"
                                onClick={() => activateFinancialYearMutation.mutate(year.id)}
                                disabled={activateFinancialYearMutation.isPending}
                              >
                                Activate
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedFinancialYear(year.id)}
                            >
                              Select
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interest Calculations</CardTitle>
              <CardDescription>
                View and manage interest calculations for the selected financial year
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <Select
                    value={selectedFinancialYear?.toString() || ""}
                    onValueChange={(value) => setSelectedFinancialYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select financial year" />
                    </SelectTrigger>
                    <SelectContent>
                      {financialYears.map((year: FinancialYear) => (
                        <SelectItem key={year.id} value={year.id.toString()}>
                          {year.yearLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedFinancialYear && calculations.length > 0 && (
                    <div className="flex gap-2">
                      {calculations.some((c: InterestCalculation) => c.status === 'calculated') && (
                        <Button
                          size="sm"
                          onClick={() => approveAllMutation.mutate(selectedFinancialYear)}
                          disabled={approveAllMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {approveAllMutation.isPending ? 'Approving...' : `Approve All (${calculations.filter((c: InterestCalculation) => c.status === 'calculated').length})`}
                        </Button>
                      )}
                      {calculations.some((c: InterestCalculation) => c.status === 'approved') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => postAllMutation.mutate(selectedFinancialYear)}
                          disabled={postAllMutation.isPending}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          {postAllMutation.isPending ? 'Posting...' : `Post All (${calculations.filter((c: InterestCalculation) => c.status === 'approved').length})`}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {calculationsLoading ? (
                  <div>Loading calculations...</div>
                ) : calculations.length === 0 ? (
                  <div className="text-center py-8">
                    <Calculator className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No calculations found</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {selectedFinancialYear ? 'No calculations for this financial year.' : 'Select a financial year to view calculations.'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Member No.</TableHead>
                          <TableHead>Average Balance</TableHead>
                          <TableHead>Interest Rate</TableHead>
                          <TableHead>Interest Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calculations.map((calc: InterestCalculation) => (
                          <TableRow key={calc.id}>
                            <TableCell className="font-medium">{calc.memberName || 'Unknown'}</TableCell>
                            <TableCell>{calc.memberNumber || calc.memberId}</TableCell>
                            <TableCell>{formatCurrency(calc.averageBalance)}</TableCell>
                            <TableCell>{formatPercentage(calc.interestRate)}</TableCell>
                            <TableCell>{formatCurrency(calc.grossInterest)}</TableCell>
                            <TableCell>{getStatusBadge(calc.status)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {calc.status === 'calculated' && (
                                  <Button
                                    size="sm"
                                    onClick={() => approveCalculationMutation.mutate(calc.id)}
                                    disabled={approveCalculationMutation.isPending}
                                  >
                                    Approve
                                  </Button>
                                )}
                                {calc.status === 'approved' && (
                                  <Button
                                    size="sm"
                                    onClick={() => postCalculationMutation.mutate(calc.id)}
                                    disabled={postCalculationMutation.isPending}
                                  >
                                    Post
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interest Payments</CardTitle>
              <CardDescription>
                Track interest payments to members
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div>Loading payments...</div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No payments found</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Interest payments will appear here once calculations are posted.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Member No.</TableHead>
                        <TableHead>Payment Amount</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment: InterestPayment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.memberName || 'Unknown'}</TableCell>
                          <TableCell>{payment.memberNumber || payment.memberId}</TableCell>
                          <TableCell>{formatCurrency(payment.paymentAmount)}</TableCell>
                          <TableCell className="capitalize">{payment.paymentMethod.replace('_', ' ')}</TableCell>
                          <TableCell>
                            <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interest Operations</CardTitle>
              <CardDescription>
                Perform bulk operations for interest calculations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Create Balance Snapshots</CardTitle>
                    <CardDescription>
                      Take snapshots of all savings account balances for the selected financial year
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={handleCreateSnapshots}
                      disabled={!selectedFinancialYear || createSnapshotsMutation.isPending}
                      className="w-full"
                    >
                      {createSnapshotsMutation.isPending ? 'Creating Snapshots...' : 'Create Balance Snapshots'}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Calculate Interest for All Members</CardTitle>
                    <CardDescription>
                      Calculate interest for all active members in the selected financial year
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={handleCalculateAllInterest}
                      disabled={!selectedFinancialYear || calculateAllInterestMutation.isPending}
                      className="w-full"
                    >
                      {calculateAllInterestMutation.isPending ? 'Calculating...' : 'Calculate All Interest'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}