import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DepositForm from "@/components/forms/deposit-form";
import WithdrawalForm from "@/components/forms/withdrawal-form";
import { Search, Plus, ArrowUp, ArrowDown, Wallet, PiggyBank } from "lucide-react";

export default function Savings() {
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

  const { data: members, isLoading: membersLoading, error } = useQuery<any[]>({
    queryKey: ['/api/members', searchQuery],
    enabled: isAuthenticated,
  });

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

  if (error && isUnauthorizedError(error)) {
    return null; // Will redirect in useEffect
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Savings Accounts</h2>
            <p className="text-slate-600 mt-1">Manage member savings accounts and transactions</p>
          </div>
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
      {membersLoading ? (
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
      ) : members && members.length > 0 ? (
        <div className="space-y-6">
          {members.filter((member: any) => member.savingsAccounts?.length > 0).map((member: any) => (
            <Card key={member.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                      <span className="text-slate-600 text-sm font-medium">
                        {member.user?.firstName?.charAt(0)}{member.user?.lastName?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {member.user?.firstName} {member.user?.lastName}
                      </CardTitle>
                      <p className="text-sm text-slate-500">Member: {member.memberNumber}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {member.savingsAccounts?.map((account: any) => (
                    <div key={account.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Wallet className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-900">
                            {account.accountNumber}
                          </span>
                        </div>
                        <Badge className={getStatusColor(account.status)}>
                          {account.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Type:</span>
                          <Badge className={getAccountTypeColor(account.accountType)}>
                            {account.accountType.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Balance:</span>
                          <span className="font-medium text-slate-900">
                            UGX {parseFloat(account.balance).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Interest Rate:</span>
                          <span className="text-slate-900">
                            {(parseFloat(account.interestRate) * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex space-x-2 mt-4">
                        <Button size="sm" variant="outline" className="flex-1">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          Deposit
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <ArrowDown className="w-3 h-3 mr-1" />
                          Withdraw
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
    </>
  );
}
