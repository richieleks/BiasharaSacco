import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, DollarSign, CheckCircle, Clock, AlertCircle, Calculator, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AmortizationScheduleWithDetails, LoanWithDetails } from "@shared/schema";

interface AmortizationScheduleProps {
  loan: LoanWithDetails;
}

const paymentSchema = z.object({
  actualAmount: z.string().min(1, "Payment amount is required"),
  paymentDate: z.string().min(1, "Payment date is required"),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export default function AmortizationSchedule({ loan }: AmortizationScheduleProps) {
  const [selectedPayment, setSelectedPayment] = useState<AmortizationScheduleWithDetails | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ['/api/loans', loan.id, 'amortization'],
  });

  const { data: interestCalculations = [] } = useQuery({
    queryKey: ['/api/loans', loan.id, 'interest-calculations'],
  });

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      actualAmount: "",
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  const generateScheduleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/loans/${loan.id}/generate-amortization`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans', loan.id, 'amortization'] });
      toast({
        title: "Success",
        description: "Amortization schedule generated successfully",
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

  const calculateInterestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/loans/${loan.id}/calculate-interest`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans', loan.id, 'interest-calculations'] });
      toast({
        title: "Interest Calculated",
        description: `Monthly payment: UGX ${data.monthlyPayment.toFixed(2)}`,
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

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PaymentFormData }) => {
      return await apiRequest(`/api/amortization/${id}/payment`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans', loan.id, 'amortization'] });
      setIsPaymentDialogOpen(false);
      setSelectedPayment(null);
      form.reset();
      toast({
        title: "Success",
        description: "Payment recorded successfully",
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

  const onSubmitPayment = (data: PaymentFormData) => {
    if (selectedPayment) {
      recordPaymentMutation.mutate({ id: selectedPayment.id, data });
    }
  };

  const handleRecordPayment = (payment: AmortizationScheduleWithDetails) => {
    setSelectedPayment(payment);
    form.reset({
      actualAmount: payment.totalPayment,
      paymentDate: new Date().toISOString().split('T')[0],
    });
    setIsPaymentDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'overdue':
        return 'destructive';
      case 'partial':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const totalScheduled = schedule.reduce((sum: number, payment: AmortizationScheduleWithDetails) => 
    sum + Number(payment.totalPayment), 0);
  const totalPaid = schedule.reduce((sum: number, payment: AmortizationScheduleWithDetails) => 
    sum + Number(payment.actualAmountPaid || 0), 0);
  const totalPrincipal = schedule.reduce((sum: number, payment: AmortizationScheduleWithDetails) => 
    sum + Number(payment.principalAmount), 0);
  const totalInterest = schedule.reduce((sum: number, payment: AmortizationScheduleWithDetails) => 
    sum + Number(payment.interestAmount), 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">Loading amortization schedule...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Scheduled</p>
                <p className="text-2xl font-bold">UGX {totalScheduled.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">UGX {totalPaid.toLocaleString()}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Principal</p>
                <p className="text-2xl font-bold">UGX {totalPrincipal.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Interest</p>
                <p className="text-2xl font-bold text-orange-600">UGX {totalInterest.toLocaleString()}</p>
              </div>
              <Calculator className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {schedule.length === 0 && (
          <Button 
            onClick={() => generateScheduleMutation.mutate()}
            disabled={generateScheduleMutation.isPending}
          >
            <Calculator className="h-4 w-4 mr-2" />
            Generate Schedule
          </Button>
        )}
        
        <Button 
          variant="outline"
          onClick={() => calculateInterestMutation.mutate()}
          disabled={calculateInterestMutation.isPending}
        >
          <Calculator className="h-4 w-4 mr-2" />
          Calculate Interest
        </Button>
        
        {schedule.length > 0 && (
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Schedule
          </Button>
        )}
      </div>

      {/* Schedule Table */}
      {schedule.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Payment Schedule</CardTitle>
            <CardDescription>
              Detailed breakdown of loan payments over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Total Payment</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((payment: AmortizationScheduleWithDetails) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.paymentNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {new Date(payment.paymentDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        UGX {Number(payment.principalAmount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        UGX {Number(payment.interestAmount).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        UGX {Number(payment.totalPayment).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        UGX {Number(payment.outstandingBalance).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusVariant(payment.status)}
                          className="flex items-center gap-1 w-fit"
                        >
                          {getStatusIcon(payment.status)}
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.status === 'pending' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRecordPayment(payment)}
                          >
                            Record Payment
                          </Button>
                        )}
                        {payment.status === 'paid' && payment.actualPaymentDate && (
                          <div className="text-xs text-muted-foreground">
                            Paid {new Date(payment.actualPaymentDate).toLocaleDateString()}
                            <br />
                            UGX {Number(payment.actualAmountPaid).toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Schedule Generated</h3>
              <p className="text-muted-foreground mb-4">
                Generate an amortization schedule to view payment details.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interest Calculations */}
      {interestCalculations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Interest Calculations</CardTitle>
            <CardDescription>
              History of interest calculations for this loan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {interestCalculations.map((calc: any, index: number) => (
                <div key={calc.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{calc.calculationType}</p>
                    <p className="text-sm text-muted-foreground">
                      {calc.formula} - {calc.notes}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(calc.calculationDate).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">UGX {Number(calc.calculatedInterest).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      Rate: {calc.rate}% | Time: {calc.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Recording Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record actual payment for payment #{selectedPayment?.paymentNumber}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitPayment)} className="space-y-4">
              <FormField
                control={form.control}
                name="actualAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount (UGX)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="Enter payment amount" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsPaymentDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={recordPaymentMutation.isPending}
                >
                  Record Payment
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}