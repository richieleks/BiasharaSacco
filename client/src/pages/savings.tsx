import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/usePagination";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DepositForm from "@/components/forms/deposit-form";
import WithdrawalForm from "@/components/forms/withdrawal-form";
import { Search, Plus, ArrowUp, ArrowDown, Wallet, PiggyBank, FileText, Download } from "lucide-react";

export default function Savings() {
  const [location] = useLocation();
  const isPersonalView = location === '/my-savings';
  const [searchQuery, setSearchQuery] = useState("");
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: allSavingsAccounts, isLoading: accountsLoading, error } = useQuery<any[]>({
    queryKey: isPersonalView ? ['/api/savings/my-savings'] : ['/api/savings-accounts'],
    enabled: isAuthenticated,
  });

  const { data: statementData, isLoading: statementLoading } = useQuery({
    queryKey: ['/api/savings-accounts', selectedAccountId, 'statement'],
    enabled: !!selectedAccountId && isStatementModalOpen,
  });

  // Filter savings accounts based on search query
  const filteredSavingsAccounts = (allSavingsAccounts || []).filter((account: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      account.accountNumber?.toLowerCase().includes(query) ||
      account.member?.fullName?.toLowerCase().includes(query) ||
      account.accountType?.toLowerCase().includes(query) ||
      account.status?.toLowerCase().includes(query)
    );
  });

  // Apply pagination
  const {
    currentPage,
    itemsPerPage,
    paginatedData: savingsAccounts,
    totalItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination({ data: filteredSavingsAccounts, initialItemsPerPage: 10 });

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'regular':
        return 'bg-blue-100 text-blue-800';
      case 'fixed_deposit':
        return 'bg-green-100 text-green-800';
      case 'group':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      case 'frozen':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewStatement = (accountId: number) => {
    setSelectedAccountId(accountId);
    setIsStatementModalOpen(true);
  };

  const handleDownloadStatement = () => {
    if (!statementData) return;
    
    const { account, transactions } = statementData;
    const csvContent = [
      ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'],
      ...(transactions || []).map((txn: any) => [
        new Date(txn.createdAt).toLocaleDateString(),
        txn.description || txn.transactionType,
        txn.referenceNumber || '',
        txn.transactionType === 'withdrawal' ? `UGX ${parseFloat(txn.amount || '0').toLocaleString()}` : '',
        txn.transactionType === 'deposit' ? `UGX ${parseFloat(txn.amount || '0').toLocaleString()}` : '',
        '' // Balance would need to be calculated
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statement-${account?.accountNumber || 'account'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (error && isUnauthorizedError(error)) {
    return null; // Will redirect in useEffect
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {isPersonalView ? 'My Savings' : 'Savings Accounts'}
            </h2>
            <p className="text-slate-600 mt-1">
              {isPersonalView 
                ? 'View your savings accounts and balance history' 
                : 'Manage member savings accounts and transactions'
              }
            </p>
          </div>
          {!isPersonalView && (
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
                <DialogTrigger asChild>
                  <Button className="sacco-success text-white hover:opacity-90">
                    <ArrowUp className="w-4 h-4 mr-2" />
                    Record Deposit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Deposit</DialogTitle>
                  </DialogHeader>
                  <DepositForm onSuccess={() => setIsDepositModalOpen(false)} />
                </DialogContent>
              </Dialog>

              <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                    <ArrowDown className="w-4 h-4 mr-2" />
                    Withdrawal Request
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Process Withdrawal</DialogTitle>
                  </DialogHeader>
                  <WithdrawalForm onSuccess={() => setIsWithdrawModalOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search members or account numbers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Savings Accounts */}
      {accountsLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                    <div>
                      <div className="h-4 bg-slate-200 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="h-8 bg-slate-200 rounded w-24"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : savingsAccounts && savingsAccounts.length > 0 ? (
        <>
          <div className="space-y-4">
            {savingsAccounts.map((account: any) => (
              <Card key={account.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                        <span className="text-slate-600 text-sm font-medium">
                          {account.member?.user?.firstName?.charAt(0)}{account.member?.user?.lastName?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">
                          {account.member?.user?.firstName} {account.member?.user?.lastName}
                        </h3>
                        <p className="text-sm text-slate-500">Member: {account.member?.memberNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-slate-900">
                        UGX {parseFloat(account.balance || '0').toLocaleString()}
                      </div>
                      <div className="text-sm text-slate-500">Current Balance</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-slate-500">Account Number</div>
                      <div className="flex items-center space-x-2">
                        <Wallet className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">
                          {account.accountNumber}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-sm text-slate-500">Account Type</div>
                      <Badge className={getAccountTypeColor(account.accountType)}>
                        {account.accountType?.replace('_', ' ') || 'Regular'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-sm text-slate-500">Status</div>
                      <Badge className={getStatusColor(account.status)}>
                        {account.status || 'active'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-sm text-slate-500">Opened</div>
                      <div className="text-sm text-slate-900">
                        {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Account Actions */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewStatement(account.id)}
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Statement
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredSavingsAccounts.length > 0 && (
            <div className="mt-6">
              <Pagination
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <PiggyBank className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No savings accounts found</h3>
            <p className="text-slate-500 mb-4">
              {searchQuery ? "No accounts match your search criteria." : "Savings accounts will appear here once members are added."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Account Statement Modal */}
      <Dialog open={isStatementModalOpen} onOpenChange={setIsStatementModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Account Statement</span>
            </DialogTitle>
            <div className="sr-only">View complete account statement with transaction history</div>
          </DialogHeader>
          
          {statementLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : statementData ? (
            <div className="space-y-4">
              {/* Account Info */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-slate-500">Account Number</div>
                      <div className="font-medium">{statementData.account?.accountNumber || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Account Type</div>
                      <div className="font-medium">{statementData.account?.accountType?.replace('_', ' ') || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Current Balance</div>
                      <div className="font-medium text-lg text-green-600">
                        UGX {parseFloat(statementData.account?.balance || '0').toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Status</div>
                      <Badge className={getStatusColor(statementData.account?.status || 'active')}>
                        {statementData.account?.status || 'active'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Transaction History</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadStatement}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              </div>

              {/* Transactions Table */}
              <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!statementData.transactions || statementData.transactions.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          No transactions found for this account
                        </TableCell>
                      </TableRow>
                    ) : (
                      (statementData.transactions || []).map((transaction: any) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {transaction.description || transaction.transactionType}
                              </div>
                              {transaction.transactionType && (
                                <div className="text-sm text-slate-500 capitalize">
                                  {transaction.transactionType.replace('_', ' ')}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {transaction.referenceNumber || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.transactionType === 'withdrawal' && (
                              <span className="text-red-600 font-medium">
                                UGX {parseFloat(transaction.amount || '0').toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.transactionType === 'deposit' && (
                              <span className="text-green-600 font-medium">
                                UGX {parseFloat(transaction.amount || '0').toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                              transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {transaction.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              Failed to load account statement
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
