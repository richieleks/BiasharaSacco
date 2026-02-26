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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import DepositForm from "@/components/forms/deposit-form";
import WithdrawalForm from "@/components/forms/withdrawal-form";
import { Search, Plus, ArrowUp, ArrowDown, Wallet, PiggyBank, FileText } from "lucide-react";

export default function Savings() {
  const [location] = useLocation();
  const isPersonalView = location === '/my-savings';
  const [searchQuery, setSearchQuery] = useState("");
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

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
        return 'bg-blue-50 text-blue-700 border-blue-200/50';
      case 'fixed_deposit':
        return 'bg-green-50 text-green-700 border-green-200/50';
      case 'group':
        return 'bg-purple-50 text-purple-700 border-purple-200/50';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200/50';
      case 'closed':
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
      case 'frozen':
        return 'bg-red-50 text-red-700 border-red-200/50';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
    }
  };

  const handleViewStatement = (accountUuid: string) => {
    window.location.href = `/savings/${accountUuid}/statement`;
  };



  if (error && isUnauthorizedError(error)) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="space-y-6 page-container animate-fade-in">
      {/* Page Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {isPersonalView ? 'My Savings' : 'Savings Accounts'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isPersonalView 
                ? 'View your savings accounts and balance history' 
                : 'Manage member savings accounts and transactions'
              }
            </p>
          </div>
          {!isPersonalView && (
            <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
              <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm">
                    <ArrowUp className="w-4 h-4 mr-2" />
                    Record Deposit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Record Deposit</DialogTitle>
                    <DialogDescription>
                      Record a deposit transaction for a member's savings account
                    </DialogDescription>
                  </DialogHeader>
                  <DepositForm onSuccess={() => setIsDepositModalOpen(false)} />
                </DialogContent>
              </Dialog>

              <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 rounded-xl shadow-sm">
                    <ArrowDown className="w-4 h-4 mr-2" />
                    Withdrawal Request
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Process Withdrawal</DialogTitle>
                    <DialogDescription>
                      Process a withdrawal request from a member's savings account
                    </DialogDescription>
                  </DialogHeader>
                  <WithdrawalForm onSuccess={() => setIsWithdrawModalOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="section-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search members or account numbers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Savings Accounts */}
      {accountsLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="section-card animate-pulse">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg"></div>
                    <div>
                      <div className="h-4 bg-slate-100 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-slate-100 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="h-8 bg-slate-100 rounded w-24"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : savingsAccounts && savingsAccounts.length > 0 ? (
        <>
          <div className="space-y-4">
            {savingsAccounts.map((account: any) => (
              <div key={account.id} className="section-card hover:shadow-md hover:border-slate-300/60 transition-all duration-200">
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center shrink-0">
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
                    <div className="sm:text-right">
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
                      <Badge variant="outline" className={`border ${getAccountTypeColor(account.accountType)}`}>
                        {account.accountType?.replace('_', ' ') || 'Regular'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-sm text-slate-500">Status</div>
                      <Badge variant="outline" className={`border ${getStatusColor(account.status)}`}>
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
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewStatement(account.uuid)}
                      className="text-primary border-primary/30 hover:bg-primary/5 rounded-lg"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Statement
                    </Button>
                  </div>
                </div>
              </div>
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
        <div className="section-card">
          <div className="py-16 text-center">
            <PiggyBank className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No savings accounts found</h3>
            <p className="text-slate-500 mb-4">
              {searchQuery ? "No accounts match your search criteria." : "Savings accounts will appear here once members are added."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
