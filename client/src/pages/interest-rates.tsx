import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Calculator, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { InterestRate } from "@shared/schema";

const interestRateSchema = z.object({
  productType: z.enum(["normal_loan", "emergency_loan", "development_loan", "group_loan", "asset_financing"]),
  baseRate: z.string().min(1, "Base rate is required"),
  compoundingFrequency: z.enum(["daily", "monthly", "quarterly", "annually"]).default("monthly"),
  minimumAmount: z.string().optional(),
  maximumAmount: z.string().optional(),
  minimumTerm: z.coerce.number().min(1).optional(),
  maximumTerm: z.coerce.number().min(1).optional(),
});

type InterestRateFormData = z.infer<typeof interestRateSchema>;

const productTypeLabels = {
  normal_loan: "Normal Loan",
  emergency_loan: "Emergency Loan", 
  development_loan: "Development Loan",
  group_loan: "Group Loan",
  asset_financing: "Asset Financing"
};

const frequencyLabels = {
  daily: "Daily",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually"
};

export default function InterestRatesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<InterestRate | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: interestRates = [], isLoading } = useQuery({
    queryKey: ['/api/interest-rates'],
  });

  const form = useForm<InterestRateFormData>({
    resolver: zodResolver(interestRateSchema),
    defaultValues: {
      productType: "normal_loan",
      compoundingFrequency: "monthly",
      baseRate: "",
      minimumAmount: "",
      maximumAmount: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InterestRateFormData) => {
      return await apiRequest('/api/interest-rates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interest-rates'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Interest rate created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InterestRateFormData> }) => {
      return await apiRequest(`/api/interest-rates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interest-rates'] });
      setIsDialogOpen(false);
      setEditingRate(null);
      form.reset();
      toast({
        title: "Success",
        description: "Interest rate updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/interest-rates/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interest-rates'] });
      toast({
        title: "Success",
        description: "Interest rate deactivated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InterestRateFormData) => {
    if (editingRate) {
      updateMutation.mutate({ id: editingRate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (rate: InterestRate) => {
    setEditingRate(rate);
    form.reset({
      productType: rate.productType as any,
      baseRate: rate.baseRate,
      compoundingFrequency: rate.compoundingFrequency as any,
      minimumAmount: rate.minimumAmount || "",
      maximumAmount: rate.maximumAmount || "",
      minimumTerm: rate.minimumTerm || undefined,
      maximumTerm: rate.maximumTerm || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleDeactivate = (id: number) => {
    if (confirm("Are you sure you want to deactivate this interest rate?")) {
      deactivateMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 page-container animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">Interest Rate Management</h1>
        </div>
        <div className="text-center py-8">Loading interest rates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 sm:h-7 w-6 sm:w-7" />
            Interest Rate Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Configure interest rates for different loan products and savings accounts
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingRate(null);
              form.reset();
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Interest Rate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRate ? "Edit Interest Rate" : "Create Interest Rate"}
              </DialogTitle>
              <DialogDescription>
                Set up interest rates for loan products with specific terms and conditions.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="productType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select product type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(productTypeLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="baseRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Rate (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="12.50" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="compoundingFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compounding Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(frequencyLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minimumAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Amount (UGX)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="100000" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="maximumAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Amount (UGX)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="10000000" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minimumTerm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Term (Months)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="3" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="maximumTerm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Term (Months)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="60" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingRate ? "Update" : "Create"} Interest Rate
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {interestRates.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Interest Rates Found</h3>
                <p className="text-muted-foreground mb-4">
                  Start by creating interest rates for your loan products.
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Interest Rate
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {interestRates.map((rate: InterestRate) => (
              <Card key={rate.id}>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        {productTypeLabels[rate.productType as keyof typeof productTypeLabels]}
                        <Badge variant={rate.isActive ? "default" : "secondary"}>
                          {rate.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {rate.baseRate}% {frequencyLabels[rate.compoundingFrequency as keyof typeof frequencyLabels]} compounding
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEdit(rate)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeactivate(rate.id)}
                        disabled={!rate.isActive}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Amount Range</p>
                      <p className="font-medium">
                        {rate.minimumAmount && rate.maximumAmount 
                          ? `${formatCurrency(rate.minimumAmount)} - ${formatCurrency(rate.maximumAmount)}`
                          : "No limits"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Term Range</p>
                      <p className="font-medium">
                        {rate.minimumTerm && rate.maximumTerm 
                          ? `${rate.minimumTerm} - ${rate.maximumTerm} months`
                          : "Flexible"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Effective Date</p>
                      <p className="font-medium">
                        {new Date(rate.effectiveDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium">
                        {rate.expiryDate 
                          ? `Expires ${new Date(rate.expiryDate).toLocaleDateString()}`
                          : "No expiry"
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}