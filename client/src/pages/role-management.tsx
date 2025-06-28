import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function RoleManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleChanges, setRoleChanges] = useState<Record<number, string>>({});
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

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: number; role: string }) => {
      await apiRequest('PATCH', `/api/members/${memberId}/role`, { role });
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

  const handleRoleChange = (memberId: number, newRole: string) => {
    setRoleChanges(prev => ({
      ...prev,
      [memberId]: newRole
    }));
  };

  const saveChanges = () => {
    Object.entries(roleChanges).forEach(([memberId, role]) => {
      updateRoleMutation.mutate({ memberId: parseInt(memberId), role });
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
          const count = (members as MemberWithDetails[]).filter((m) => m.role === role.value).length;
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
                  <TableHead>Current Role</TableHead>
                  <TableHead>New Role</TableHead>
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
                    const currentRole = member.role || 'member';
                    const newRole = roleChanges[member.id] || currentRole;
                    const roleInfo = getRoleInfo(newRole);
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
                          <Badge variant="outline">
                            {getRoleInfo(currentRole).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={newRole}
                            onValueChange={(value) => handleRoleChange(member.id, value)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map(role => (
                                <SelectItem key={role.value} value={role.value}>
                                  <div className="flex items-center gap-2">
                                    <UserCog className="h-4 w-4" />
                                    {role.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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