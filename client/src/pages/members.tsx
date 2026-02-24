import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/usePagination";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { hasPermission, userRole } = useRBAC();

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

  const { data: allMembers = [], isLoading: membersLoading, error } = useQuery({
    queryKey: ['/api/members'],
    enabled: isAuthenticated,
  });

  // Filter members based on search query
  const filteredMembers = allMembers.filter((member: MemberWithDetails) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.fullName?.toLowerCase().includes(query) ||
      member.memberNumber?.toLowerCase().includes(query) ||
      member.phoneNumber?.toLowerCase().includes(query) ||
      member.department?.toLowerCase().includes(query) ||
      member.status?.toLowerCase().includes(query)
    );
  });

  // Apply pagination
  const {
    currentPage,
    itemsPerPage,
    paginatedData: members,
    totalItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination({ data: filteredMembers, initialItemsPerPage: 10 });

  const addMemberMutation = useMutation({
    mutationFn: async (memberData: any) => {
      await apiRequest('POST', '/api/members', memberData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      setIsAddModalOpen(false);
      toast({
        title: "Success",
        description: "Member added successfully!",
      });
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
      
      // Handle specific validation errors
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
    return null; // Will redirect via useEffect
  }

  return (
    <div className="space-y-6 page-container animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-7 w-7" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Members</h1>
        </div>
        {hasPermission('create', 'members') && (
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="sacco-gradient text-white hover:opacity-90 rounded-xl shadow-sm">
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

      {/* Search */}
      <div className="section-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search members by name, ID, or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Members Table */}
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
        <div className="section-card">
          <Table className="table-modern">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Avg Net Pay</TableHead>
                <TableHead>Next of Kin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member: MemberWithDetails) => (
                <TableRow key={member.id} className="hover:bg-slate-50">
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
                        <div className="font-medium text-slate-900">
                          {member.fullName || 'No Name'}
                        </div>
                        <div className="text-sm text-slate-500">ID: {member.memberNumber}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-900">{member.phoneNumber}</TableCell>
                  <TableCell className="text-slate-900 capitalize">{member.gender || 'Not specified'}</TableCell>
                  <TableCell className="text-slate-900">{member.department || 'Not specified'}</TableCell>
                  <TableCell className="text-slate-900">
                    {member.averageNetPay ? `UGX ${parseFloat(member.averageNetPay).toLocaleString()}` : 'Not specified'}
                  </TableCell>
                  <TableCell className="text-slate-900">{member.nextOfKinName || 'Not specified'}</TableCell>
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
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredMembers.length > 0 && (
            <Pagination
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </div>
      ) : (
        <div className="section-card">
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No members found</h3>
            <p className="text-slate-500 mb-4">
              {searchQuery ? "No members match your search criteria." : "Get started by adding your first member."}
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