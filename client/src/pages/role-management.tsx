import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Search, UserCog, Save } from "lucide-react";
import type { MemberWithDetails } from "@shared/schema";

const roles = [
  { value: "admin", label: "Administrator", color: "bg-red-100 text-red-800" },
  { value: "manager", label: "Manager", color: "bg-purple-100 text-purple-800" },
  { value: "committee", label: "Committee Member", color: "bg-blue-100 text-blue-800" },
  { value: "teller", label: "Teller", color: "bg-green-100 text-green-800" },
  { value: "member", label: "Member", color: "bg-gray-100 text-gray-800" },
];

interface MemberRole {
  memberId: number;
  roles: string[];
}

export default function RoleManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleChanges, setRoleChanges] = useState<Record<number, string[]>>({});
  const [memberRoles, setMemberRoles] = useState<Record<number, string[]>>({});
  const { toast } = useToast();
  const { hasPermission, userRole } = useRBAC();

  // Check if user has permission to manage roles
  if (!hasPermission('update', 'system-settings')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold">Access Denied</h3>
              <p className="text-gray-600 mt-2">You don't have permission to manage roles.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: members = [], isLoading } = useQuery<MemberWithDetails[]>({
    queryKey: ['/api/members', searchQuery],
  });

  // Fetch roles for all members
  const { data: memberRolesData } = useQuery({
    queryKey: ['/api/members/roles', members],
    queryFn: async () => {
      if (!members || members.length === 0) return {};
      
      const rolesMap: Record<number, string[]> = {};
      
      // Fetch roles for each member
      await Promise.all(
        members.map(async (member) => {
          try {
            const response = await fetch(`/api/members/${member.id}/roles`);
            if (response.ok) {
              const roles = await response.json();
              rolesMap[member.id] = roles;
            } else {
              // Default to single role from member data if available
              rolesMap[member.id] = member.role ? [member.role] : ['member'];
            }
          } catch (error) {
            console.error(`Failed to fetch roles for member ${member.id}:`, error);
            rolesMap[member.id] = member.role ? [member.role] : ['member'];
          }
        })
      );
      
      return rolesMap;
    },
    enabled: !!members && members.length > 0,
  });

  // Update local state when data changes
  useEffect(() => {
    if (memberRolesData) {
      setMemberRoles(memberRolesData);
    }
  }, [memberRolesData]);

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, roles }: { memberId: number; roles: string[] }) => {
      await apiRequest('PATCH', `/api/members/${memberId}/roles`, { roles });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      setRoleChanges({});
      toast({
        title: "Roles Updated",
        description: "Member roles have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update member roles. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRoleToggle = (memberId: number, role: string, checked: boolean) => {
    const currentRoles = roleChanges[memberId] || memberRoles[memberId] || [];
    let newRoles: string[];
    
    if (checked) {
      newRoles = [...currentRoles, role];
    } else {
      newRoles = currentRoles.filter(r => r !== role);
    }
    
    // Ensure at least one role is selected
    if (newRoles.length === 0) {
      newRoles = ['member'];
    }
    
    setRoleChanges(prev => ({
      ...prev,
      [memberId]: newRoles
    }));
  };

  const saveChanges = () => {
    Object.entries(roleChanges).forEach(([memberId, roles]) => {
      updateRoleMutation.mutate({ memberId: parseInt(memberId), roles });
    });
  };

  const hasChanges = Object.keys(roleChanges).length > 0;

  const getRoleInfo = (role: string) => {
    return roles.find(r => r.value === role) || roles[4]; // Default to member
  };

  const filteredMembers = (members as MemberWithDetails[]).filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.fullName?.toLowerCase().includes(query) ||
      member.memberNumber.toLowerCase().includes(query) ||
      member.phoneNumber?.toLowerCase().includes(query) ||
      member.idNumber?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions across the system
          </p>
        </div>
        {hasChanges && (
          <Button 
            onClick={saveChanges}
            disabled={updateRoleMutation.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes ({Object.keys(roleChanges).length})
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {roles.map(role => {
          const count = Object.values(memberRoles).filter(roles => roles.includes(role.value)).length;
          return (
            <Card key={role.value}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {role.label}s
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>
            Assign and manage roles for all system users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, member number, phone, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Member Number</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Current Roles</TableHead>
                  <TableHead>Assign Roles</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading members...
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No members found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member: MemberWithDetails) => {
                    const currentRoles = memberRoles[member.id] || ['member'];
                    const newRoles = roleChanges[member.id] || currentRoles;
                    const hasChange = roleChanges[member.id] !== undefined;
                    
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-medium">{member.fullName}</div>
                            <div className="text-sm text-muted-foreground">
                              {member.idNumber}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{member.memberNumber}</TableCell>
                        <TableCell>{member.phoneNumber}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {currentRoles.map(role => {
                              const roleInfo = getRoleInfo(role);
                              return (
                                <Badge key={role} variant="outline" className={roleInfo.color}>
                                  {roleInfo.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {roles.map(role => (
                              <div key={role.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${member.id}-${role.value}`}
                                  checked={newRoles.includes(role.value)}
                                  onCheckedChange={(checked) => 
                                    handleRoleToggle(member.id, role.value, checked as boolean)
                                  }
                                />
                                <label
                                  htmlFor={`${member.id}-${role.value}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {role.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasChange ? (
                            <Badge variant="default">Modified</Badge>
                          ) : (
                            <Badge variant="secondary">{member.status}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}