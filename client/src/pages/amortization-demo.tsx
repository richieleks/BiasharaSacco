import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, TrendingUp, Clock, DollarSign } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AmortizationEntry {
  paymentNumber: number;
  paymentDate: string;
  principalAmount: number;
  interestAmount: number;
  totalPayment: number;
  outstandingBalance: number;
}

interface InterestCalculationResult {
  totalInterest: number;
  monthlyPayment: number;
  totalAmount: number;
  effectiveRate: number;
}

export default function AmortizationDemo() {
  const [principal, setPrincipal] = useState("1000000");
  const [rate, setRate] = useState("12");
  const [term, setTerm] = useState("24");
  const [calculationType, setCalculationType] = useState("reducing_balance");
  const [schedule, setSchedule] = useState<AmortizationEntry[]>([]);
  const [calculation, setCalculation] = useState<InterestCalculationResult | null>(null);

  // Interest calculation functions
  const calculateSimpleInterest = (p: number, r: number, t: number) => {
    const interest = p * (r / 100) * (t / 12);
    const totalAmount = p + interest;
    return {
      totalInterest: interest,
      monthlyPayment: totalAmount / t,
      totalAmount,
      effectiveRate: r
    };
  };

  const calculateCompoundInterest = (p: number, r: number, t: number) => {
    const monthlyRate = r / 100 / 12;
    const amount = p * Math.pow(1 + monthlyRate, t);
    const interest = amount - p;
    return {
      totalInterest: interest,
      monthlyPayment: amount / t,
      totalAmount: amount,
      effectiveRate: ((amount / p) ** (1 / (t / 12)) - 1) * 100
    };
  };

  const calculateReducingBalance = (p: number, r: number, t: number) => {
    const monthlyRate = r / 100 / 12;
    if (monthlyRate === 0) {
      return {
        totalInterest: 0,
        monthlyPayment: p / t,
        totalAmount: p,
        effectiveRate: 0
      };
    }
    
    const monthlyPayment = p * (monthlyRate * Math.pow(1 + monthlyRate, t)) / (Math.pow(1 + monthlyRate, t) - 1);
    const totalAmount = monthlyPayment * t;
    
    return {
      totalInterest: totalAmount - p,
      monthlyPayment,
      totalAmount,
      effectiveRate: r
    };
  };

  const generateAmortizationSchedule = (p: number, r: number, t: number) => {
    const monthlyRate = r / 100 / 12;
    const monthlyPayment = p * (monthlyRate * Math.pow(1 + monthlyRate, t)) / (Math.pow(1 + monthlyRate, t) - 1);
    
    const schedule: AmortizationEntry[] = [];
    let remainingBalance = p;
    const startDate = new Date();

    for (let i = 1; i <= t; i++) {
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance -= principalPayment;

      if (i === t) {
        remainingBalance = 0; // Final payment adjustment
      }

      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + i);

      schedule.push({
        paymentNumber: i,
        paymentDate: paymentDate.toISOString().split('T')[0],
        principalAmount: principalPayment,
        interestAmount: interestPayment,
        totalPayment: monthlyPayment,
        outstandingBalance: Math.max(0, remainingBalance)
      });
    }

    return schedule;
  };

  const handleCalculate = () => {
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    const t = parseInt(term);

    let result: InterestCalculationResult;

    switch (calculationType) {
      case 'simple':
        result = calculateSimpleInterest(p, r, t);
        break;
      case 'compound':
        result = calculateCompoundInterest(p, r, t);
        break;
      default:
        result = calculateReducingBalance(p, r, t);
    }

    setCalculation(result);

    if (calculationType === 'reducing_balance') {
      const scheduleData = generateAmortizationSchedule(p, r, t);
      setSchedule(scheduleData);
    } else {
      setSchedule([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-7 w-7" />
        <h1 className="text-2xl font-bold">Interest Calculation & Amortization Demo</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Parameters</CardTitle>
            <CardDescription>
              Enter loan details to calculate interest and generate amortization schedule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="principal">Principal Amount (UGX)</Label>
              <Input
                id="principal"
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="1000000"
              />
            </div>

            <div>
              <Label htmlFor="rate">Annual Interest Rate (%)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="12.00"
              />
            </div>

            <div>
              <Label htmlFor="term">Term (Months)</Label>
              <Input
                id="term"
                type="number"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="24"
              />
            </div>

            <div>
              <Label>Calculation Type</Label>
              <Select value={calculationType} onValueChange={setCalculationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple Interest</SelectItem>
                  <SelectItem value="compound">Compound Interest</SelectItem>
                  <SelectItem value="reducing_balance">Reducing Balance (EMI)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCalculate} className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Interest
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {calculation && (
          <Card>
            <CardHeader>
              <CardTitle>Calculation Results</CardTitle>
              <CardDescription>
                Interest calculation breakdown and payment summary
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">Monthly Payment</span>
                  </div>
                  <p className="text-xl font-bold">UGX {calculation.monthlyPayment.toLocaleString()}</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-muted-foreground">Total Interest</span>
                  </div>
                  <p className="text-xl font-bold">UGX {calculation.totalInterest.toLocaleString()}</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                  </div>
                  <p className="text-xl font-bold">UGX {calculation.totalAmount.toLocaleString()}</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-muted-foreground">Effective Rate</span>
                  </div>
                  <p className="text-xl font-bold">{calculation.effectiveRate.toFixed(2)}%</p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Calculation Details</h4>
                <div className="text-sm space-y-1">
                  <p>Principal: UGX {parseFloat(principal).toLocaleString()}</p>
                  <p>Interest Rate: {rate}% per annum</p>
                  <p>Term: {term} months</p>
                  <p>Method: {calculationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Amortization Schedule */}
      {schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Amortization Schedule</CardTitle>
            <CardDescription>
              Detailed payment breakdown showing principal and interest for each payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Total Payment</TableHead>
                    <TableHead>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((payment, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                      <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                      <TableCell>UGX {payment.principalAmount.toLocaleString()}</TableCell>
                      <TableCell>UGX {payment.interestAmount.toLocaleString()}</TableCell>
                      <TableCell className="font-medium">UGX {payment.totalPayment.toLocaleString()}</TableCell>
                      <TableCell>UGX {payment.outstandingBalance.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Principal:</span>
                <p className="font-semibold">UGX {schedule.reduce((sum, p) => sum + p.principalAmount, 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Interest:</span>
                <p className="font-semibold">UGX {schedule.reduce((sum, p) => sum + p.interestAmount, 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Payments:</span>
                <p className="font-semibold">UGX {schedule.reduce((sum, p) => sum + p.totalPayment, 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Information */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Interest Calculation Features</CardTitle>
          <CardDescription>
            This demonstration shows the core functionality of the SACCO interest calculation system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Calculation Methods</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Simple Interest - Fixed interest on principal</li>
                <li>• Compound Interest - Interest on interest</li>
                <li>• Reducing Balance - Standard loan EMI calculation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">System Integration</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Automatic schedule generation for approved loans</li>
                <li>• Payment tracking with actual vs scheduled amounts</li>
                <li>• Early payment calculation and interest savings</li>
                <li>• Role-based access to interest rate management</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}