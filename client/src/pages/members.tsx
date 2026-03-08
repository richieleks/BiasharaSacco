import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { useServerPagination } from "@/hooks/useServerPagination";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import MemberForm from "@/components/forms/member-form";
import { Search, Plus, Eye, Users, UserCheck, UserX, AlertCircle } from "lucide-react";
import type { MemberWithDetails } from "@shared/schema";

export default function Members() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { hasPermission, userRole } = useRBAC();

  const {
    page,
    limit,
    search,
    setPage,
    setLimit,
    setSearch,
    buildQueryParams,
  } = useServerPagination({ initialLimit: 10 });

  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

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

  const queryParams = buildQueryParams();
  const { data: response, isLoading: membersLoading, error } = useQuery<{ data: MemberWithDetails[]; total: number }>({
    queryKey: ['/api/members', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/members?${queryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const members = response?.data || [];
  const totalItems = response?.total || 0;

  const addMemberMutation = useMutation({
    mutationFn: async (memberData: any) => {
      await apiRequest('POST', '/api/members', memberData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      setIsAddModalOpen(false);
      toast({ title: "Success",
        description: "Member added successfully!", variant: "success" });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
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
      
      let errorMessage = "Failed to add member. Please try again.";
      if (error.message && error.message.includes("A member with this ID number already exists")) {
        errorMessage = "This ID number is already registered. Please check and use a different ID number.";
      } else if (error.message && error.message.includes("You already have a member profile")) {
        errorMessage = "You already have a member profile. Only one membership per user is allowed.";
      }
      
      toast({
        title: "Registration Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200/50';
      case 'inactive':
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
      case 'suspended':
        return 'bg-red-50 text-red-700 border-red-200/50';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/50';
    }
  };

  if (error && isUnauthorizedError(error as Error)) {
    return null;
  }

  return (
    <div className="space-y-6 page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-7 w-7" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Members</h1>
        </div>
        {hasPermission('create', 'members') && (
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-member" className="sacco-gradient text-white hover:opacity-90 rounded-xl shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[44.1rem] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
                <DialogDescription>
                  Register a new member to the SACCO. All fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              <MemberForm
                onSubmit={(data) => addMemberMutation.mutate(data)}
                isLoading={addMemberMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="section-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            data-testid="input-search-members"
            placeholder="Search members by name, ID, or phone number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {membersLoading ? (
        <div className="section-card p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-slate-100 rounded-lg w-1/4 mb-2"></div>
                  <div className="h-3 bg-slate-100 rounded-lg w-1/6"></div>
                </div>
                <div className="h-4 bg-slate-100 rounded-lg w-1/8"></div>
                <div className="h-4 bg-slate-100 rounded-lg w-1/8"></div>
                <div className="h-4 bg-slate-100 rounded-lg w-1/8"></div>
              </div>
            ))}
          </div>
        </div>
      ) : members && Array.isArray(members) && members.length > 0 ? (
        <div className="section-card overflow-x-auto">
          <Table className="table-modern">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Gender</TableHead>
                <TableHead className="hidden lg:table-cell">Department</TableHead>
                <TableHead className="hidden xl:table-cell">Avg Net Pay</TableHead>
                <TableHead className="hidden xl:table-cell">Next of Kin</TableHead>
                <TableHead className="hidden md:table-cell">Date Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member: MemberWithDetails) => (
                <TableRow key={member.id} className="hover:bg-slate-50" data-testid={`row-member-${member.id}`}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center">
                        <span className="text-slate-600 text-sm font-medium">
                          {member.fullName ? getInitials(
                            member.fullName.split(' ')[0] || '', 
                            member.fullName.split(' ')[1] || ''
                          ) : 'NA'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-slate-900" data-testid={`text-member-name-${member.id}`}>
                          {member.fullName || 'No Name'}
                        </div>
                        <div className="text-sm text-slate-500">ID: {member.memberNumber}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-slate-900">{member.phoneNumber}</TableCell>
                  <TableCell className="hidden lg:table-cell text-slate-900 capitalize">{member.gender || 'Not specified'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-slate-900">{member.department || 'Not specified'}</TableCell>
                  <TableCell className="hidden xl:table-cell text-slate-900">
                    {member.averageNetPay ? formatCurrency(member.averageNetPay) : 'Not specified'}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-slate-900">{member.nextOfKinName || 'Not specified'}</TableCell>
                  <TableCell className="hidden md:table-cell text-slate-900">
                    {member.joinDate ? new Date(member.joinDate).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border ${getStatusColor(member.status ?? 'pending')}`}>
                      {member.status ?? 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(`/members/${member.uuid}`)}
                      className="h-8 w-8 p-0"
                      data-testid={`button-view-member-${member.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            totalItems={totalItems}
            itemsPerPage={limit}
            currentPage={page}
            onPageChange={setPage}
            onItemsPerPageChange={setLimit}
          />
        </div>
      ) : (
        <div className="section-card">
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No members found</h3>
            <p className="text-slate-500 mb-4">
              {search ? "No members match your search criteria." : "Get started by adding your first member."}
            </p>
            {hasPermission('create', 'members') && (
              <Button onClick={() => setIsAddModalOpen(true)} className="sacco-gradient text-white hover:opacity-90 rounded-xl shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add First Member
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
