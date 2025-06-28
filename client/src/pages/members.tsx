import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import MemberForm from "@/components/forms/member-form";
import { Search, Plus, Eye, Edit, Users, Phone, Mail, MapPin, Calendar, CreditCard, User } from "lucide-react";
import type { MemberWithDetails } from "@shared/schema";

export default function Members() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewMember, setViewMember] = useState<MemberWithDetails | null>(null);
  const [editMember, setEditMember] = useState<MemberWithDetails | null>(null);
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

  const { data: members = [], isLoading: membersLoading, error } = useQuery({
    queryKey: ['/api/members', searchQuery],
    enabled: isAuthenticated,
  });

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

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest('PATCH', `/api/members/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      setEditMember(null);
      toast({
        title: "Success",
        description: "Member updated successfully!",
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
      toast({
        title: "Error",
        description: "Failed to update member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddMember = (memberData: any) => {
    addMemberMutation.mutate(memberData);
  };

  const handleUpdateMember = (memberData: any) => {
    if (editMember) {
      updateMemberMutation.mutate({ id: editMember.id, data: memberData });
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "M";
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
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
            <h2 className="text-2xl font-semibold text-slate-900">Members</h2>
            <p className="text-slate-600 mt-1">Manage SACCO member profiles and accounts</p>
          </div>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="sacco-gradient text-white hover:opacity-90 mt-4 sm:mt-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
              </DialogHeader>
              <MemberForm onSubmit={handleAddMember} isLoading={addMemberMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search members by name, ID, phone, or member number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Grid */}
      {membersLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : members && Array.isArray(members) && members.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member: MemberWithDetails) => (
            <Card key={member.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-slate-600 text-sm font-medium">
                      {getInitials(member.user?.firstName || '', member.user?.lastName || '')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">
                      {member.user?.firstName} {member.user?.lastName}
                    </h3>
                    <p className="text-sm text-slate-500">ID: {member.memberNumber}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Phone:</span>
                    <span className="text-slate-900">{member.phoneNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Status:</span>
                    <Badge className={getStatusColor(member.status ?? 'pending')}>
                      {member.status ?? 'pending'}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Join Date:</span>
                    <span className="text-slate-900">
                      {new Date(member.joinDate!).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setViewMember(member)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  {hasPermission('update', 'members') && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => setEditMember(member)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No members found</h3>
            <p className="text-slate-500 mb-4">
              {searchQuery ? "No members match your search criteria." : "Get started by adding your first member."}
            </p>
            <Button onClick={() => setIsAddModalOpen(true)} className="sacco-gradient text-white hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Add First Member
            </Button>
          </CardContent>
        </Card>
      )}

      {/* View Member Dialog */}
      <Dialog open={!!viewMember} onOpenChange={() => setViewMember(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Member Details</DialogTitle>
            <DialogDescription>Complete member information</DialogDescription>
          </DialogHeader>
          {viewMember && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{viewMember.fullName}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">ID Number</Label>
                    <p className="font-medium">{viewMember.idNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Member Number</Label>
                    <p className="font-medium">{viewMember.memberNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <Badge className={getStatusColor(viewMember.status!)}>
                      {viewMember.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Email</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {viewMember.user?.email || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Phone Number</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {viewMember.phoneNumber}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm text-muted-foreground">Address</Label>
                    <p className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {viewMember.address || 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Account Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Join Date</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(viewMember.joinDate!).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Role</Label>
                    <p className="font-medium">{viewMember.role || 'Member'}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setViewMember(null)}>
                  Close
                </Button>
                {hasPermission('update', 'members') && (
                  <Button onClick={() => {
                    setEditMember(viewMember);
                    setViewMember(null);
                  }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Member
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={!!editMember} onOpenChange={() => setEditMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update member information</DialogDescription>
          </DialogHeader>
          {editMember && (
            <MemberForm
              member={editMember}
              onSubmit={handleUpdateMember}
              isLoading={updateMemberMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
