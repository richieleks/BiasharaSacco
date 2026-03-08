import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export default function LoanStatement() {
  const [match, params] = useRoute("/loans/:id/statement");
  const [, setLocation] = useLocation();

  const { data: loan, isLoading: loanLoading } = useQuery({
    queryKey: [`/api/loans/${params?.id}`],
    enabled: !!params?.id,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/loans/${params?.id}/transactions`],
    enabled: !!params?.id,
  });

  if (loanLoading || transactionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading loan statement...</div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-lg">Loan not found</div>
        <Button onClick={() => setLocation("/loans")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Loans
        </Button>
      </div>
    );
  }

  const handleExportStatement = () => {
    if (!transactions || !Array.isArray(transactions)) {
      return;
    }
    
    const getTransactionDate = (transaction: any) => {
      if (transaction.createdAt) return new Date(transaction.createdAt);
      if (transaction.date) return new Date(transaction.date);
      return new Date();
    };

    const getTypeSortOrder = (transaction: any) => {
      if (transaction.transactionType === 'loan_disbursement' || 
          transaction.description?.toLowerCase().includes('disburs')) return 0;
      return 1;
    };

    let runningBalance = 0;
    const transactionsWithBalance = [...transactions]
      .sort((a, b) => {
        const dateA = getTransactionDate(a).getTime();
        const dateB = getTransactionDate(b).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return getTypeSortOrder(a) - getTypeSortOrder(b);
      })
      .map((transaction) => {
        const amount = parseFloat(transaction.amount || 0);
        if (transaction.transactionType === 'loan_disbursement' || 
            transaction.description?.toLowerCase().includes('disburs')) {
          runningBalance += amount;
        } else if (transaction.transactionType === 'loan_payment') {
          runningBalance -= amount;
        }
        
        return {
          ...transaction,
          runningBalance,
          displayDate: getTransactionDate(transaction)
        };
      });
    
    const csvData = [
      ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
      ...transactionsWithBalance.map((txn: any) => [
        format(txn.displayDate, 'yyyy-MM-dd'),
        txn.description || txn.transactionType || 'N/A',
        (txn.transactionType === 'loan_payment' || txn.transactionType === 'debit') ? txn.amount || 0 : '',
        (txn.transactionType === 'loan_disbursement' || txn.transactionType === 'credit') ? txn.amount || 0 : '',
        txn.runningBalance
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `loan-statement-${loan?.loanNumber || 'unknown'}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/loans")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Loan Statement</h1>
            <p className="text-muted-foreground">Loan #{loan.loanNumber}</p>
          </div>
        </div>
        <Button onClick={handleExportStatement} size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Loan Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Loan Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Principal Amount</p>
              <p className="text-lg font-semibold">{formatCurrency(loan.principalAmount || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
              <p className="text-lg font-semibold">{formatCurrency(loan.outstandingBalance || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Payment</p>
              <p className="text-lg font-semibold">{formatCurrency(loan.monthlyPayment || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>
                {loan.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions && Array.isArray(transactions) && transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 whitespace-nowrap">Date</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2 whitespace-nowrap">Debit</th>
                      <th className="text-right p-2 whitespace-nowrap">Credit</th>
                      <th className="text-right p-2 whitespace-nowrap">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const getTransactionDate = (transaction: any) => {
                        if (transaction.createdAt) return new Date(transaction.createdAt);
                        if (transaction.date) return new Date(transaction.date);
                        return new Date();
                      };

                      const getTypeSortOrder = (transaction: any) => {
                        if (transaction.transactionType === 'loan_disbursement' || 
                            transaction.description?.toLowerCase().includes('disburs')) return 0;
                        return 1;
                      };

                      let runningBalance = 0;
                      const transactionsWithBalance = [...transactions]
                        .sort((a, b) => {
                          const dateA = getTransactionDate(a).getTime();
                          const dateB = getTransactionDate(b).getTime();
                          if (dateA !== dateB) return dateA - dateB;
                          return getTypeSortOrder(a) - getTypeSortOrder(b);
                        })
                        .map((transaction) => {
                          const amount = parseFloat(transaction.amount || 0);
                          if (transaction.transactionType === 'loan_disbursement' || 
                              transaction.description?.toLowerCase().includes('disburs')) {
                            runningBalance += amount;
                          } else if (transaction.transactionType === 'loan_payment') {
                            runningBalance -= amount;
                          }
                          
                          return {
                            ...transaction,
                            runningBalance,
                            displayDate: getTransactionDate(transaction)
                          };
                        });
                      
                      return transactionsWithBalance.map((transaction: any) => (
                        <tr key={transaction.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="p-2 whitespace-nowrap">
                            {format(transaction.displayDate, 'MMM dd, yyyy')}
                          </td>
                          <td className="p-2">{transaction.description || transaction.transactionType || 'N/A'}</td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap">
                            {(transaction.transactionType === 'loan_payment' || transaction.transactionType === 'debit') ? 
                              formatCurrency(transaction.amount || 0) : ''}
                          </td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap">
                            {(transaction.transactionType === 'loan_disbursement' || transaction.transactionType === 'credit') ? 
                              formatCurrency(transaction.amount || 0) : ''}
                          </td>
                          <td className="p-2 text-right font-medium tabular-nums whitespace-nowrap">
                            {formatCurrency(transaction.runningBalance)}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {transactionsLoading ? 'Loading transactions...' : 'No transactions found for this loan'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}