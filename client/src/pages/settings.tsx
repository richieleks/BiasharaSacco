import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings as SettingsIcon, Edit, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { LoanType, LoanTypeWithTerms, LoanTerm, InsertLoanType, InsertLoanTerm } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddLoanTypeOpen, setIsAddLoanTypeOpen] = useState(false);
  const [isAddTermOpen, setIsAddTermOpen] = useState(false);
  const [selectedLoanType, setSelectedLoanType] = useState<LoanTypeWithTerms | null>(null);
  const [editingLoanType, setEditingLoanType] = useState<LoanTypeWithTerms | null>(null);
  const [editingTerm, setEditingTerm] = useState<LoanTerm | null>(null);
  const [formData, setFormData] = useState({
    approvalWorkflow: 'simple',
    interestType: 'reducing_balance',
    compoundingFrequency: 'monthly'
  });

  // Fetch loan types
  const { data: loanTypes = [], isLoading: loanTypesLoading, error: loanTypesError } = useQuery({
    queryKey: ['/api/loan-types'],
    queryFn: () => apiRequest('GET', '/api/loan-types'),
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session Expired",
          description: "Please refresh the page to continue.",
          variant: "destructive",
        });
        return false;
      }
      return failureCount < 3;
    },
  });

  // Create loan type mutation
  const createLoanTypeMutation = useMutation({
    mutationFn: (data: InsertLoanType) => apiRequest('POST', '/api/loan-types', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-types'] });
      setIsAddLoanTypeOpen(false);
      // Reset form data to defaults
      setFormData({
        approvalWorkflow: 'simple',
        interestType: 'reducing_balance',
        compoundingFrequency: 'monthly'
      });
      toast({ title: "Success", description: "Loan type created successfully" });
    },
    onError: (error) => {
      console.error('Error creating loan type:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create loan type';
      
      if (errorMessage.includes('duplicate key') || errorMessage.includes('already exists') || errorMessage.includes('unique constraint')) {
        toast({ 
          title: "Duplicate Name", 
          description: "A loan type with this name already exists. Please choose a different name.", 
          variant: "destructive" 
        });
      } else if (errorMessage.includes('constraint') || errorMessage.includes('approval_workflow')) {
        toast({ 
          title: "Validation Error", 
          description: "Please ensure all required fields are filled out correctly, especially the approval workflow.", 
          variant: "destructive" 
        });
      } else if (isUnauthorizedError(error as Error)) {
        toast({ 
          title: "Session Expired", 
          description: "Please refresh the page to continue.", 
          variant: "destructive" 
        });
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    }
  });

  // Update loan type mutation
  const updateLoanTypeMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<LoanType> & { id: number }) => 
      apiRequest('PUT', `/api/loan-types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-types'] });
      setEditingLoanType(null);
      toast({ title: "Success", description: "Loan type updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update loan type", variant: "destructive" });
    }
  });

  // Delete loan type mutation
  const deleteLoanTypeMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/loan-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-types'] });
      toast({ title: "Success", description: "Loan type deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete loan type", variant: "destructive" });
    }
  });

  // Create loan term mutation
  const createLoanTermMutation = useMutation({
    mutationFn: (data: InsertLoanTerm) => apiRequest('POST', '/api/loan-terms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-types'] });
      setIsAddTermOpen(false);
      setSelectedLoanType(null);
      toast({ title: "Success", description: "Loan term created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create loan term", variant: "destructive" });
    }
  });

  // Update loan term mutation
  const updateLoanTermMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<LoanTerm> & { id: number }) => 
      apiRequest('PUT', `/api/loan-terms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-types'] });
      setEditingTerm(null);
      toast({ title: "Success", description: "Loan term updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update loan term", variant: "destructive" });
    }
  });

  // Delete loan term mutation
  const deleteLoanTermMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/loan-terms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-types'] });
      toast({ title: "Success", description: "Loan term deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete loan term", variant: "destructive" });
    }
  });

  const handleCreateLoanType = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const htmlFormData = new FormData(e.currentTarget);
    
    const data: InsertLoanType = {
      name: htmlFormData.get('name') as string,
      displayName: htmlFormData.get('displayName') as string,
      description: htmlFormData.get('description') as string,
      interestRate: htmlFormData.get('interestRate') as string,
      interestType: formData.interestType,
      compoundingFrequency: formData.compoundingFrequency,
      minAmount: htmlFormData.get('minAmount') as string || null,
      maxAmount: htmlFormData.get('maxAmount') as string || null,
      minTerm: parseInt(htmlFormData.get('minTerm') as string),
      maxTerm: parseInt(htmlFormData.get('maxTerm') as string),
      gracePeriod: parseInt(htmlFormData.get('gracePeriod') as string) || 0,
      lateFeeRate: htmlFormData.get('lateFeeRate') as string || "0",
      processingFee: htmlFormData.get('processingFee') as string || "0",
      requiresGuarantor: htmlFormData.has('requiresGuarantor'),
      guarantorRatio: htmlFormData.get('guarantorRatio') as string || "1.50",
      approvalWorkflow: formData.approvalWorkflow,
      requiresCollateral: htmlFormData.has('requiresCollateral'),
    };

    createLoanTypeMutation.mutate(data);
  };

  const handleCreateLoanTerm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data: InsertLoanTerm = {
      loanTypeId: selectedLoanType!.id,
      termName: formData.get('termName') as string,
      termCategory: formData.get('termCategory') as any,
      description: formData.get('description') as string,
      isRequired: formData.has('isRequired'),
      sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
    };

    createLoanTermMutation.mutate(data);
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount || amount === 'null') return 'Not set';
    try {
      return `UGX ${parseFloat(amount).toLocaleString()}`;
    } catch (error) {
      console.error('Error formatting currency:', error, amount);
      return 'Invalid amount';
    }
  };

  const formatPercentage = (rate: string | null) => {
    if (!rate || rate === 'null') return 'Not set';
    try {
      return `${parseFloat(rate)}%`;
    } catch (error) {
      console.error('Error formatting percentage:', error, rate);
      return 'Invalid rate';
    }
  };

  if (loanTypesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <SettingsIcon className="w-8 h-8 text-slate-600" />
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-pulse">Loading settings...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loanTypesError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <SettingsIcon className="w-8 h-8 text-slate-600" />
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-red-600 mb-4">
              Failed to load settings. Please refresh the page or try again later.
            </div>
            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <SettingsIcon className="w-8 h-8 text-slate-600" />
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        </div>
      </div>

      <Tabs defaultValue="loan-types" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="loan-types">Loan Types</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="loan-types" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Loan Type Management</CardTitle>
                <Dialog open={isAddLoanTypeOpen} onOpenChange={setIsAddLoanTypeOpen}>
                  <DialogTrigger asChild>
                    <Button className="sacco-gradient text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Loan Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Loan Type</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateLoanType} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">System Name*</Label>
                          <Input id="name" name="name" required placeholder="normal_loan" />
                          <p className="text-xs text-slate-500 mt-1">Must be unique (used internally)</p>
                        </div>
                        <div>
                          <Label htmlFor="displayName">Display Name*</Label>
                          <Input id="displayName" name="displayName" required placeholder="Normal Loan" />
                          <p className="text-xs text-slate-500 mt-1">Shown to users</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" name="description" placeholder="Loan description..." />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="interestRate">Interest Rate (%)*</Label>
                          <Input id="interestRate" name="interestRate" type="number" step="0.01" required placeholder="12.00" />
                        </div>
                        <div>
                          <Label htmlFor="interestType">Interest Type*</Label>
                          <Select 
                            name="interestType" 
                            required 
                            value={formData.interestType}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, interestType: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="simple">Simple</SelectItem>
                              <SelectItem value="compound">Compound</SelectItem>
                              <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="compoundingFrequency">Compounding</Label>
                          <Select 
                            name="compoundingFrequency" 
                            value={formData.compoundingFrequency}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, compoundingFrequency: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annually">Annually</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="minAmount">Minimum Amount (UGX)</Label>
                          <Input id="minAmount" name="minAmount" type="number" placeholder="100000" />
                        </div>
                        <div>
                          <Label htmlFor="maxAmount">Maximum Amount (UGX)</Label>
                          <Input id="maxAmount" name="maxAmount" type="number" placeholder="10000000" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="minTerm">Min Term (months)*</Label>
                          <Input id="minTerm" name="minTerm" type="number" required defaultValue="1" />
                        </div>
                        <div>
                          <Label htmlFor="maxTerm">Max Term (months)*</Label>
                          <Input id="maxTerm" name="maxTerm" type="number" required defaultValue="60" />
                        </div>
                        <div>
                          <Label htmlFor="gracePeriod">Grace Period (days)</Label>
                          <Input id="gracePeriod" name="gracePeriod" type="number" defaultValue="0" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="lateFeeRate">Late Fee Rate (%)</Label>
                          <Input id="lateFeeRate" name="lateFeeRate" type="number" step="0.01" defaultValue="2.00" />
                        </div>
                        <div>
                          <Label htmlFor="processingFee">Processing Fee (%)</Label>
                          <Input id="processingFee" name="processingFee" type="number" step="0.01" defaultValue="0" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" id="requiresGuarantor" name="requiresGuarantor" defaultChecked />
                          <Label htmlFor="requiresGuarantor">Requires Guarantor</Label>
                        </div>
                        <div>
                          <Label htmlFor="guarantorRatio">Guarantor Ratio</Label>
                          <Input id="guarantorRatio" name="guarantorRatio" type="number" step="0.01" defaultValue="1.50" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="approvalWorkflow">Approval Workflow</Label>
                          <Select 
                            name="approvalWorkflow" 
                            value={formData.approvalWorkflow}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, approvalWorkflow: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select workflow" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="simple">Simple</SelectItem>
                              <SelectItem value="multi_stage">Multi-Stage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" id="requiresCollateral" name="requiresCollateral" />
                          <Label htmlFor="requiresCollateral">Requires Collateral</Label>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsAddLoanTypeOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createLoanTypeMutation.isPending}>
                          {createLoanTypeMutation.isPending ? "Creating..." : "Create Loan Type"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loanTypesError && (
                <div className="text-red-600 mb-4 p-4 border border-red-200 rounded">
                  <div className="font-semibold mb-2">Error loading loan types</div>
                  <div className="text-sm mb-2">
                    {isUnauthorizedError(loanTypesError as Error) ? 
                      'Authentication required. Please log in.' : 
                      'Failed to load settings. Please try again.'
                    }
                  </div>
                  <div className="text-xs text-gray-600">
                    Error details: {loanTypesError instanceof Error ? loanTypesError.message : String(loanTypesError)}
                  </div>
                  <div className="mt-3 space-x-2">
                    {isUnauthorizedError(loanTypesError as Error) ? (
                      <Button onClick={() => window.location.href = '/api/login'} size="sm">
                        Log In
                      </Button>
                    ) : (
                      <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                        Refresh Page
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="grid gap-4">

                {Array.isArray(loanTypes) && loanTypes.map((loanType: LoanTypeWithTerms) => (
                  <Card key={loanType.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-lg">{loanType.displayName}</h3>
                            <Badge variant={loanType.isActive ? "default" : "secondary"}>
                              {loanType.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500">Interest Rate:</span>
                              <br />
                              <span className="font-medium">{formatPercentage(loanType.interestRate)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Amount Range:</span>
                              <br />
                              <span className="font-medium">
                                {formatCurrency(loanType.minAmount)} - {formatCurrency(loanType.maxAmount)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Term Range:</span>
                              <br />
                              <span className="font-medium">{loanType.minTerm} - {loanType.maxTerm} months</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Terms:</span>
                              <br />
                              <span className="font-medium">{loanType.terms?.length || 0} defined</span>
                            </div>
                          </div>

                          {loanType.description && (
                            <p className="text-slate-600 mt-2 text-sm">{loanType.description}</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLoanType(loanType);
                              setIsAddTermOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Term
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingLoanType(loanType)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this loan type?')) {
                                deleteLoanTypeMutation.mutate(loanType.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {loanType.terms && loanType.terms.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-medium mb-2">Terms & Conditions:</h4>
                          <div className="space-y-2">
                            {loanType.terms.map((term) => (
                              <div key={term.id} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-sm">{term.termName}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {term.termCategory}
                                    </Badge>
                                    {term.isRequired && (
                                      <Badge variant="destructive" className="text-xs">Required</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1">{term.description}</p>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingTerm(term)}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this term?')) {
                                        deleteLoanTermMutation.mutate(term.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {(!Array.isArray(loanTypes) || loanTypes.length === 0) && !loanTypesError && !loanTypesLoading && (
                  <div className="text-center py-12">
                    <SettingsIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No loan types configured</h3>
                    <p className="text-slate-500 mb-4">Create your first loan type to get started.</p>

                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <SettingsIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">System Settings</h3>
                <p className="text-slate-500">Additional system settings will be available here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Term Dialog */}
      <Dialog open={isAddTermOpen} onOpenChange={setIsAddTermOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Term for {selectedLoanType?.displayName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLoanTerm} className="space-y-4">
            <div>
              <Label htmlFor="termName">Term Name*</Label>
              <Input id="termName" name="termName" required placeholder="Eligibility criteria" />
            </div>

            <div>
              <Label htmlFor="termCategory">Category*</Label>
              <Select name="termCategory" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eligibility">Eligibility</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                  <SelectItem value="collateral">Collateral</SelectItem>
                  <SelectItem value="repayment">Repayment</SelectItem>
                  <SelectItem value="penalty">Penalty</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description*</Label>
              <Textarea id="description" name="description" required placeholder="Detailed term description..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isRequired" name="isRequired" defaultChecked />
                <Label htmlFor="isRequired">Required Term</Label>
              </div>
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input id="sortOrder" name="sortOrder" type="number" defaultValue="0" />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsAddTermOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createLoanTermMutation.isPending}>
                {createLoanTermMutation.isPending ? "Creating..." : "Create Term"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}