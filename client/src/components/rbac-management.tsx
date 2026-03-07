import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck,
  Lock,
  Plus,
  Edit,
  KeyRound,
  Search,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RoleFormData {
  name: string;
  displayName: string;
  description: string;
}

export function RBACManagementTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<'roles' | 'members'>('roles');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [roleFormData, setRoleFormData] = useState<RoleFormData>({
    name: "",
    displayName: "",
    description: "",
  });
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  const { data: roles = [], isLoading: rolesLoading } = useQuery<any[]>({
    queryKey: ["/api/rbac/roles"],
  });

  const { data: permissions = [] } = useQuery<any[]>({
    queryKey: ["/api/rbac/permissions"],
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ['/api/members'],
  });

  const filteredMembers = (members as any[]).filter((member: any) =>
    member.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.memberNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      await apiRequest("POST", "/api/rbac/roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      toast({ title: "Success", description: "Role created successfully" });
      setIsCreateDialogOpen(false);
      setRoleFormData({ name: "", displayName: "", description: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) => {
      await apiRequest("PUT", `/api/rbac/roles/${roleId}/permissions`, { permissionIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      toast({ title: "Success", description: "Permissions updated successfully" });
      setIsPermissionsDialogOpen(false);
      setSelectedRole(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberRolesMutation = useMutation({
    mutationFn: async ({ memberId, roles }: { memberId: number; roles: string[] }) => {
      return await apiRequest('PATCH', `/api/members/${memberId}/roles`, { roles });
    },
    onSuccess: () => {
      toast({ title: "Roles Updated", description: "Member roles have been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      setSelectedMember(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const openPermissionsDialog = async (role: any) => {
    setSelectedRole(role);
    try {
      const res = await fetch(`/api/rbac/roles/${role.id}/permissions`, { credentials: 'include' });
      const rolePerms = await res.json();
      setSelectedPermissions(rolePerms.map((p: any) => p.id));
    } catch {
      setSelectedPermissions([]);
    }
    setIsPermissionsDialogOpen(true);
  };

  const togglePermission = (permId: number) => {
    setSelectedPermissions(prev =>
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  const toggleResource = (resource: string) => {
    setExpandedResources(prev => {
      const next = new Set(prev);
      if (next.has(resource)) next.delete(resource);
      else next.add(resource);
      return next;
    });
  };

  const groupedPermissions = (permissions as any[]).reduce((acc: Record<string, any[]>, perm: any) => {
    if (!acc[perm.resource]) acc[perm.resource] = [];
    acc[perm.resource].push(perm);
    return acc;
  }, {});

  const selectAllForResource = (resource: string) => {
    const resourcePermIds = groupedPermissions[resource]?.map((p: any) => p.id) || [];
    const allSelected = resourcePermIds.every((id: number) => selectedPermissions.includes(id));
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(id => !resourcePermIds.includes(id)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...resourcePermIds])]);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive' as const;
      case 'committee': return 'secondary' as const;
      case 'treasurer': return 'outline' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          RBAC Management
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Manage roles, permissions, and member role assignments
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={activeSection === 'roles' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('roles')}
        >
          <Lock className="h-4 w-4 mr-2" />
          Roles & Permissions
        </Button>
        <Button
          variant={activeSection === 'members' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('members')}
        >
          <Users className="h-4 w-4 mr-2" />
          Member Roles
        </Button>
      </div>

      {activeSection === 'roles' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                System Roles
              </CardTitle>
              <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rolesLoading ? (
              <div className="text-sm text-muted-foreground">Loading roles...</div>
            ) : (
              <div className="space-y-3">
                {(roles as any[]).map((role: any) => (
                  <div key={role.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{role.displayName}</p>
                        <Badge variant={getRoleBadgeVariant(role.name)}>{role.name}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{role.permissions?.length || 0} permissions</Badge>
                      <Button variant="outline" size="sm" onClick={() => openPermissionsDialog(role)}>
                        <KeyRound className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'members' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Member Role Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members by name or number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Member No.</TableHead>
                  <TableHead>Current Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.slice(0, 20).map((member: any) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.fullName}</TableCell>
                    <TableCell>{member.memberNumber}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(member.roles && member.roles.length > 0 ? member.roles : ['member']).map((role: string) => (
                          <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedMember(member)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit Roles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredMembers.length > 20 && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Showing 20 of {filteredMembers.length} members. Use search to find specific members.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>Create a new role with specific permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                value={roleFormData.name}
                onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                placeholder="e.g., reviewer"
              />
            </div>
            <div>
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={roleFormData.displayName}
                onChange={(e) => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                placeholder="e.g., Content Reviewer"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                placeholder="Describe the role's purpose"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => createRoleMutation.mutate(roleFormData)} disabled={createRoleMutation.isPending}>
                {createRoleMutation.isPending ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Permissions - {selectedRole?.displayName}
            </DialogTitle>
            <DialogDescription>
              Select which permissions this role should have ({selectedPermissions.length} selected)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {Object.entries(groupedPermissions).sort(([a], [b]) => a.localeCompare(b)).map(([resource, perms]: [string, any]) => {
              const resourcePermIds = perms.map((p: any) => p.id);
              const allSelected = resourcePermIds.every((id: number) => selectedPermissions.includes(id));
              const someSelected = resourcePermIds.some((id: number) => selectedPermissions.includes(id));
              const isExpanded = expandedResources.has(resource);

              return (
                <div key={resource} className="border rounded-lg">
                  <div
                    className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleResource(resource)}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => selectAllForResource(resource)}
                      onClick={(e) => e.stopPropagation()}
                      className={someSelected && !allSelected ? "opacity-50" : ""}
                    />
                    <span className="font-medium capitalize">{resource.replace(/-/g, ' ')}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {resourcePermIds.filter((id: number) => selectedPermissions.includes(id)).length}/{perms.length}
                    </Badge>
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 pl-12 space-y-2">
                      {perms.map((perm: any) => (
                        <label key={perm.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={selectedPermissions.includes(perm.id)}
                            onCheckedChange={() => togglePermission(perm.id)}
                          />
                          <span className="capitalize font-medium">{perm.action}</span>
                          <span className="text-muted-foreground">- {perm.description || `${perm.action} ${perm.resource}`}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsPermissionsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedRole && updatePermissionsMutation.mutate({
                roleId: selectedRole.id,
                permissionIds: selectedPermissions,
              })}
              disabled={updatePermissionsMutation.isPending}
            >
              {updatePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedMember && (
        <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Roles - {selectedMember.fullName}</DialogTitle>
              <DialogDescription>
                Assign roles to {selectedMember.memberNumber}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                {(roles as any[]).map((role: any) => {
                  const memberRoles: string[] = selectedMember.roles || ['member'];
                  const isAssigned = memberRoles.includes(role.name);
                  return (
                    <label key={role.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={isAssigned}
                        onCheckedChange={(checked) => {
                          const currentRoles: string[] = selectedMember.roles || ['member'];
                          let newRoles: string[];
                          if (checked) {
                            newRoles = [...new Set([...currentRoles, role.name])];
                          } else {
                            newRoles = currentRoles.filter((r: string) => r !== role.name);
                            if (newRoles.length === 0) newRoles = ['member'];
                          }
                          setSelectedMember({ ...selectedMember, roles: newRoles });
                        }}
                      />
                      <div>
                        <p className="font-medium">{role.displayName}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                      <Badge variant={getRoleBadgeVariant(role.name)} className="ml-auto">{role.name}</Badge>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedMember(null)}>Cancel</Button>
                <Button
                  onClick={() => updateMemberRolesMutation.mutate({
                    memberId: selectedMember.id,
                    roles: selectedMember.roles || ['member'],
                  })}
                  disabled={updateMemberRolesMutation.isPending}
                >
                  {updateMemberRolesMutation.isPending ? "Saving..." : "Save Roles"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
