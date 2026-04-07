import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Printer, Download, Scale, TrendingUp, BarChart3, CheckCircle, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

function TrialBalanceTab() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/trial-balance', asOfDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/trial-balance?asOfDate=${asOfDate}`, { credentials: 'include' });
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="w-full sm:w-auto">
          <Label className="text-xs">As of Date</Label>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-full sm:w-48" />
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />Print
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : data ? (
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="text-sm font-semibold">Trial Balance as at {new Date(data.asOfDate).toLocaleDateString()}</h3>
            <Badge variant={data.isBalanced ? "default" : "destructive"} className={data.isBalanced ? "bg-green-600" : ""}>
              {data.isBalanced ? "Balanced" : `Difference: ${formatCurrency(data.difference)}`}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows?.map((row: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{row.accountCode}</TableCell>
                    <TableCell className="font-medium text-sm">{row.accountName}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs capitalize">{row.accountType}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{row.debitBalance > 0 ? formatCurrency(row.debitBalance) : '-'}</TableCell>
                    <TableCell className="text-right">{row.creditBalance > 0 ? formatCurrency(row.creditBalance) : '-'}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-slate-50 dark:bg-slate-800">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.rows?.reduce((s: number, r: any) => s + r.debitBalance, 0))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.rows?.reduce((s: number, r: any) => s + r.creditBalance, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BalanceSheetTab() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/balance-sheet', asOfDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/balance-sheet?asOfDate=${asOfDate}`, { credentials: 'include' });
      return res.json();
    },
  });

  const renderSection = (title: string, items: any[], total: number, colorClass: string) => (
    <div className="section-card">
      <div className={`px-6 py-3 border-b border-slate-100 dark:border-slate-700 border-l-4 ${colorClass}`}>
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <Table>
        <TableBody>
          {items?.map((item: any, idx: number) => (
            <TableRow key={idx}>
              <TableCell className="font-mono text-xs w-16">{item.accountCode}</TableCell>
              <TableCell className="text-sm">{item.accountName}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(item.balance)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="font-bold bg-slate-50 dark:bg-slate-800">
            <TableCell colSpan={2}>Total {title}</TableCell>
            <TableCell className="text-right">{formatCurrency(total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="w-full sm:w-auto">
          <Label className="text-xs">As of Date</Label>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-full sm:w-48" />
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />Print
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : data ? (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold">Biashara SACCO</h2>
            <h3 className="text-sm text-slate-600 dark:text-slate-300">Balance Sheet as at {new Date(data.asOfDate).toLocaleDateString()}</h3>
            {data.isBalanced ? (
              <Badge className="mt-2 bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Balanced</Badge>
            ) : (
              <Badge variant="destructive" className="mt-2"><AlertTriangle className="w-3 h-3 mr-1" />Not Balanced</Badge>
            )}
          </div>

          {renderSection("Assets", data.assets?.items, data.assets?.total, "border-l-blue-500")}
          {renderSection("Liabilities", data.liabilities?.items, data.liabilities?.total, "border-l-red-500")}
          {renderSection("Equity", data.equity?.items, data.equity?.total, "border-l-green-500")}

          <div className="section-card bg-slate-50 dark:bg-slate-800">
            <div className="p-4 flex justify-between items-center">
              <span className="font-bold text-sm">Total Liabilities & Equity</span>
              <span className="font-bold text-lg">{formatCurrency(data.totalLiabilitiesAndEquity)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IncomeStatementTab() {
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/income-statement', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/income-statement?startDate=${startDate}&endDate=${endDate}`, { credentials: 'include' });
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-44" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-44" />
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />Print
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : data ? (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold">Biashara SACCO</h2>
            <h3 className="text-sm text-slate-600 dark:text-slate-300">
              Income Statement for the period {new Date(data.startDate).toLocaleDateString()} to {new Date(data.endDate).toLocaleDateString()}
            </h3>
          </div>

          <div className="section-card">
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700 border-l-4 border-l-green-500">
              <h4 className="text-sm font-semibold">Revenue</h4>
            </div>
            <Table>
              <TableBody>
                {data.revenue?.items?.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs w-16">{item.accountCode}</TableCell>
                    <TableCell className="text-sm">{item.accountName}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                {(!data.revenue?.items || data.revenue.items.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-slate-400 text-sm py-4">No revenue recorded for this period</TableCell></TableRow>
                )}
                <TableRow className="font-bold bg-green-50 dark:bg-green-950/30">
                  <TableCell colSpan={2}>Total Revenue</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(data.revenue?.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="section-card">
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700 border-l-4 border-l-red-500">
              <h4 className="text-sm font-semibold">Expenses</h4>
            </div>
            <Table>
              <TableBody>
                {data.expenses?.items?.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs w-16">{item.accountCode}</TableCell>
                    <TableCell className="text-sm">{item.accountName}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                {(!data.expenses?.items || data.expenses.items.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-slate-400 text-sm py-4">No expenses recorded for this period</TableCell></TableRow>
                )}
                <TableRow className="font-bold bg-red-50 dark:bg-red-950/30">
                  <TableCell colSpan={2}>Total Expenses</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(data.expenses?.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className={`section-card ${data.netSurplus >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
            <div className="p-4 flex justify-between items-center">
              <span className="font-bold text-sm">{data.netSurplus >= 0 ? 'Net Surplus' : 'Net Deficit'}</span>
              <span className={`font-bold text-xl ${data.netSurplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(data.netSurplus))}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FinancialStatements() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">Financial Statements</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Standard financial reports for regulatory compliance</p>
      </div>

      <Tabs defaultValue="trial-balance" className="space-y-4">
        <TabsList className="w-full sm:w-auto flex flex-wrap">
          <TabsTrigger value="trial-balance" className="text-xs sm:text-sm flex-1 sm:flex-none">
            <Scale className="w-4 h-4 mr-1 hidden sm:inline" />Trial Balance
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="text-xs sm:text-sm flex-1 sm:flex-none">
            <BarChart3 className="w-4 h-4 mr-1 hidden sm:inline" />Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="income-statement" className="text-xs sm:text-sm flex-1 sm:flex-none">
            <TrendingUp className="w-4 h-4 mr-1 hidden sm:inline" />Income Statement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance"><TrialBalanceTab /></TabsContent>
        <TabsContent value="balance-sheet"><BalanceSheetTab /></TabsContent>
        <TabsContent value="income-statement"><IncomeStatementTab /></TabsContent>
      </Tabs>
    </div>
  );
}
