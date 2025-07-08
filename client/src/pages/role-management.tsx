import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Users, 
  Shield, 
  Edit, 
  Search,
  ArrowLeft,
  UserCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

const roleAssignmentSchema = z.object({
  roles: z.array(z.string()).min(1, "At least one role must be selected"),
});

type RoleAssignmentData = z.infer<typeof roleAssignmentSchema>;

export default function RoleManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Load members with their roles
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['/api/members'],
  });

  // Load available roles
  const { data: availableRoles } = useQuery({
    queryKey: ['/api/rbac/roles'],
  });

  const updateMemberRolesMutation = useMutation({
    mutationFn: async ({ memberId, roles }: { memberId: number; roles: string[] }) => {
      return await apiRequest('PUT', `/api/members/${memberId}/roles`, { roles });
    },
    onSuccess: () => {
      toast({
        title: "Roles Updated",
        description: "Member roles have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      setSelectedMember(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update member roles. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter members based on search term
  const filteredMembers = members?.filter((member: any) =>
    member.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.memberNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.roles?.some((role: string) => role.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'default';
      case 'committee':
        return 'secondary';
      case 'teller':
        return 'outline';
      case 'member':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (membersLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Role Management
          </h1>
          <p className="text-muted-foreground">
            Assign and manage user roles and permissions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Member Roles
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search members or roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Member Number</TableHead>
                  <TableHead>Current Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member: any) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{member.fullName}</div>
                        <div className="text-sm text-muted-foreground">{member.email || 'No email'}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{member.memberNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.roles && member.roles.length > 0 ? (
                          member.roles.map((role: string) => (
                            <Badge 
                              key={role} 
                              variant={getRoleBadgeVariant(role)}
                              className="text-xs"
                            >
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs">No roles</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={member.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RoleAssignmentDialog
                        member={member}
                        availableRoles={availableRoles || []}
                        onUpdateRoles={updateMemberRolesMutation.mutate}
                        isLoading={updateMemberRolesMutation.isPending}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No members found matching your search.' : 'No members found.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Role Assignment Dialog Component
function RoleAssignmentDialog({ 
  member, 
  availableRoles, 
  onUpdateRoles, 
  isLoading 
}: { 
  member: any; 
  availableRoles: any[]; 
  onUpdateRoles: (data: { memberId: number; roles: string[] }) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<RoleAssignmentData>({
    resolver: zodResolver(roleAssignmentSchema),
    defaultValues: {
      roles: member.roles || [],
    },
  });

  // Reset form when member changes or dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        roles: member.roles || [],
      });
    }
  }, [open, member.roles, form]);

  const handleSubmit = (data: RoleAssignmentData) => {
    if (data.roles.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one role must be selected.",
        variant: "destructive",
      });
      return;
    }

    onUpdateRoles({
      memberId: member.id,
      roles: data.roles,
    });
    setOpen(false);
  };

  const handleRoleToggle = (roleId: string, checked: boolean) => {
    const currentRoles = form.getValues('roles');
    if (checked) {
      form.setValue('roles', [...currentRoles, roleId]);
    } else {
      form.setValue('roles', currentRoles.filter(r => r !== roleId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Manage Roles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Manage Roles - {member.fullName}
          </DialogTitle>
          <DialogDescription>
            Select the roles to assign to this member. Changes will be applied immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="roles"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-base">Available Roles</FormLabel>
                    <div className="space-y-3">
                      {availableRoles.map((role: any) => (
                        <div key={role.name} className="flex items-center space-x-3">
                          <Checkbox
                            id={role.name}
                            checked={form.watch('roles').includes(role.name)}
                            onCheckedChange={(checked) => 
                              handleRoleToggle(role.name, checked as boolean)
                            }
                          />
                          <div className="flex-1">
                            <label 
                              htmlFor={role.name}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {role.displayName || role.name}
                            </label>
                            {role.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {role.description}
                              </p>
                            )}
                          </div>
                          <Badge 
                            variant={getRoleBadgeVariant(role.name)}
                            className="text-xs"
                          >
                            {role.name}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Roles"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

