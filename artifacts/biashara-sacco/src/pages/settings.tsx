import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Settings, 
  Bell, 
  Moon, 
  Sun, 
  Monitor, 
  Mail, 
  MessageSquare,
  Shield,
  User,
  Palette,
  Volume2,
  VolumeX,
  ShieldCheck,
  Users,
  Edit,
  Plus,
  Trash2,
  Search,
  UserCheck,
  AlertCircle,
  Lock,
  KeyRound,
  Eye,
  EyeOff
} from "lucide-react";
import { TwoFactorSetup } from "@/pages/profile";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRBAC } from "@/hooks/useRBAC";

const userSettingsSchema = z.object({
  emailNotifications: z.boolean().default(true),
  browserNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  loanUpdates: z.boolean().default(true),
  paymentReminders: z.boolean().default(true),
  systemAlerts: z.boolean().default(true),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  language: z.enum(["en", "sw"]).default("en"),
  soundEnabled: z.boolean().default(true),
  autoLogout: z.number().min(15).max(480).default(15), // minutes
});

type UserSettingsData = z.infer<typeof userSettingsSchema>;

interface RoleFormData {
  name: string;
  displayName: string;
  description: string;
}

function ChangePasswordCard() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password Changed", description: "Your password has been updated successfully.", variant: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Change Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Password Too Short", description: "New password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords Do Not Match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Change Password
        </CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                data-testid="input-current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                data-testid="input-new-password"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              data-testid="input-confirm-password"
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            data-testid="button-change-password"
          >
            {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { hasPermission } = useRBAC();
  
  // RBAC Management states
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState<RoleFormData>({
    name: "",
    displayName: "",
    description: "",
  });
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  
  // Role Management states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Load user settings (you'd fetch this from API in real app)
  const defaultSettings: UserSettingsData = {
    emailNotifications: true,
    browserNotifications: true,
    smsNotifications: false,
    loanUpdates: true,
    paymentReminders: true,
    systemAlerts: true,
    theme: "system",
    language: "en",
    soundEnabled: true,
    autoLogout: 15,
  };

  const form = useForm<UserSettingsData>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: defaultSettings,
  });

  // Fetch roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/rbac/roles"],
  });

  // Fetch permissions
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ["/api/rbac/permissions"],
  });

  // Fetch members for role management
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['/api/members'],
  });

  // Filter members based on search term
  const filteredMembers = (members as any[]).filter((member: any) =>
    member.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.memberNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.roles?.some((role: string) => role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: UserSettingsData) => {
      return await apiRequest('PATCH', `/api/auth/settings`, data);
    },
    onSuccess: () => {
      toast({ title: "Settings Updated",
        description: "Your settings have been saved successfully.", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      await apiRequest("POST", "/api/rbac/roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      toast({ title: "Success",
        description: "Role created successfully", variant: "success" });
      setIsCreateDialogOpen(false);
      setRoleFormData({ name: "", displayName: "", description: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update member roles mutation
  const updateMemberRolesMutation = useMutation({
    mutationFn: async ({ memberId, roles }: { memberId: number; roles: string[] }) => {
      return await apiRequest('PATCH', `/api/members/${memberId}/roles`, { roles });
    },
    onSuccess: () => {
      toast({ title: "Roles Updated",
        description: "Member roles have been updated successfully.", variant: "success" });
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

  const handleSubmit = (data: UserSettingsData) => {
    updateSettingsMutation.mutate(data);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'committee':
        return 'secondary';
      case 'treasurer':
        return 'outline';
      case 'member':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account preferences and system settings
        </p>
      </div>

      <Tabs defaultValue="user" className="space-y-6">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-full justify-start bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg min-w-max sm:min-w-0">
            <TabsTrigger value="user" className="text-xs sm:text-sm data-[state=active]:bg-white dark:bg-slate-900 data-[state=active]:shadow-sm">
              User Settings
            </TabsTrigger>
            {hasPermission('update', 'system-settings') && (
              <TabsTrigger value="rbac" className="text-xs sm:text-sm data-[state=active]:bg-white dark:bg-slate-900 data-[state=active]:shadow-sm">
                RBAC Management
              </TabsTrigger>
            )}
            {hasPermission('update', 'system-settings') && (
              <TabsTrigger value="roles" className="text-xs sm:text-sm data-[state=active]:bg-white dark:bg-slate-900 data-[state=active]:shadow-sm">
                Role Management
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="user" className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          
          {/* Notifications Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Choose how you want to receive notifications about your SACCO activities
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Delivery Methods
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="emailNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-1">
                        <FormLabel>Email Notifications</FormLabel>
                        <FormDescription>
                          Receive notifications via email
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="browserNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-1">
                        <FormLabel>Browser Notifications</FormLabel>
                        <FormDescription>
                          Show desktop notifications in your browser
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smsNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-1">
                        <FormLabel>SMS Notifications</FormLabel>
                        <FormDescription>
                          Receive important alerts via SMS
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notification Types
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="loanUpdates"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-1">
                        <FormLabel>Loan Updates</FormLabel>
                        <FormDescription>
                          Notifications about loan approvals, rejections, and status changes
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentReminders"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-1">
                        <FormLabel>Payment Reminders</FormLabel>
                        <FormDescription>
                          Reminders for upcoming loan payments and due dates
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="systemAlerts"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-1">
                        <FormLabel>System Alerts</FormLabel>
                        <FormDescription>
                          Important system maintenance and security notifications
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Appearance Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance Settings
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Customize the look and feel of your SACCO dashboard
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Theme & Display
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a theme" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="light">
                            <div className="flex items-center gap-2">
                              <Sun className="h-4 w-4" />
                              Light
                            </div>
                          </SelectItem>
                          <SelectItem value="dark">
                            <div className="flex items-center gap-2">
                              <Moon className="h-4 w-4" />
                              Dark
                            </div>
                          </SelectItem>
                          <SelectItem value="system">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4" />
                              System
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose your preferred theme or use system setting
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="sw">Kiswahili</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose your preferred language for the interface
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="soundEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-1">
                        <FormLabel className="flex items-center gap-2">
                          {field.value ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                          Sound Effects
                        </FormLabel>
                        <FormDescription>
                          Enable notification sounds and audio feedback
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Security Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Manage your account security and session preferences
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Session Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="autoLogout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auto Logout Timer</FormLabel>
                      <FormControl>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))} 
                          defaultValue={field.value?.toString()}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select timeout duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                            <SelectItem value="240">4 hours</SelectItem>
                            <SelectItem value="480">8 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        Automatically log out after period of inactivity
                      </FormDescription>
                    </FormItem>
                  )}
                />

              </CardContent>
            </Card>

            <ChangePasswordCard />

            <TwoFactorSetup />
          </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button 
                  type="submit" 
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* RBAC Management Tab */}
        {hasPermission('read', 'roles') && (
          <TabsContent value="rbac" className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                RBAC Management
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Manage roles and permissions for system access control
              </p>
            </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  System Roles
                </CardTitle>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <Button
                    size="sm"
                    onClick={() => setIsCreateDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Role</DialogTitle>
                      <DialogDescription>
                        Create a new role with specific permissions
                      </DialogDescription>
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
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={() => createRoleMutation.mutate(roleFormData)}>
                          Create Role
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rolesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading roles...</div>
                ) : (
                  (roles as any[]).map((role: any) => (
                    <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{role.displayName}</p>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{role.name}</Badge>
                        <Badge variant="outline">{role.permissions?.length || 0} permissions</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          </TabsContent>
        )}

        {/* Role Management Tab */}
        {hasPermission('update', 'members') && (
          <TabsContent value="roles" className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Role Management
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Assign roles to members for access control
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Member Roles
              </CardTitle>
              <CardDescription>
                Search and manage roles for SACCO members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, member number, or role..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Member Number</TableHead>
                        <TableHead>Current Roles</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membersLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            Loading members...
                          </TableCell>
                        </TableRow>
                      ) : filteredMembers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            No members found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMembers.slice(0, 10).map((member: any) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">{member.fullName}</TableCell>
                            <TableCell>{member.memberNumber}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {member.roles?.map((role: string) => (
                                  <Badge key={role} variant={getRoleBadgeVariant(role)}>
                                    {role}
                                  </Badge>
                                )) || <span className="text-muted-foreground">No roles</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Dialog>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedMember(member)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit Roles
                                </Button>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit Member Roles</DialogTitle>
                                    <DialogDescription>
                                      Assign roles to {member.fullName} ({member.memberNumber})
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      {(roles as any[]).map((role: any) => {
                                        const isChecked = member.roles?.includes(role.name) || false;
                                        return (
                                          <div key={role.id} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`role-${role.id}`}
                                              checked={isChecked}
                                              onCheckedChange={(checked) => {
                                                const newRoles = checked
                                                  ? [...(member.roles || []), role.name]
                                                  : (member.roles || []).filter((r: string) => r !== role.name);
                                                setSelectedMember({ ...member, roles: newRoles });
                                              }}
                                            />
                                            <Label
                                              htmlFor={`role-${role.id}`}
                                              className="flex-1 cursor-pointer"
                                            >
                                              <div>
                                                <p className="font-medium">{role.displayName}</p>
                                                <p className="text-sm text-muted-foreground">{role.description}</p>
                                              </div>
                                            </Label>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" onClick={() => setSelectedMember(null)}>
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          if (selectedMember) {
                                            updateMemberRolesMutation.mutate({
                                              memberId: selectedMember.id,
                                              roles: selectedMember.roles || [],
                                            });
                                          }
                                        }}
                                      >
                                        Update Roles
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {filteredMembers.length > 10 && (
                  <div className="text-center text-sm text-muted-foreground">
                    Showing first 10 results. Refine your search to see more.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}