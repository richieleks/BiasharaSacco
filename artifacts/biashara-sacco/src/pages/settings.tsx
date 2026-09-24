import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest, validatePasswordAgainstRequirements, type PasswordRequirements } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Settings, 
  Bell, 
  Moon, 
  Sun, 
  Monitor, 
  Shield,
  User,
  Palette,
  Volume2,
  VolumeX,
  ShieldCheck,
  Users,
  Edit,
  Plus,
  Search,
  UserCheck,
  Lock,
  KeyRound,
  Eye,
  EyeOff
} from "lucide-react";
import { TwoFactorSetup } from "@/pages/profile";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useRBAC } from "@/hooks/useRBAC";
import { cn } from "@/lib/utils";

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
  autoLogout: z.coerce.number().min(15).max(480).default(15), // minutes
});

type UserSettingsData = z.infer<typeof userSettingsSchema>;

interface RoleFormData {
  name: string;
  displayName: string;
  description: string;
}

function ChangePasswordCard() {
  const { toast } = useToast();
  const { data: requirements, isLoading: requirementsLoading, isError: requirementsError, refetch: refetchRequirements } = useQuery<PasswordRequirements>({
    queryKey: ["/api/auth/password-requirements"],
    queryFn: async () => (await apiRequest("GET", "/api/auth/password-requirements")).json(),
    staleTime: 60_000,
  });
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
    if (!requirements) {
      toast({ title: "Requirements unavailable", description: "Load password requirements before changing your password.", variant: "destructive" });
      return;
    }
    const validationError = validatePasswordAgainstRequirements(newPassword, requirements);
    if (validationError) {
      toast({ title: "Password does not meet requirements", description: validationError, variant: "destructive" });
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
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>Update your account password. {requirements ? requirements.description : requirementsLoading ? "Loading password requirements..." : "Password requirements unavailable."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 max-w-md">
          <div className="space-y-2.5">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                autoComplete="current-password"
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
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                autoComplete="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                data-testid="input-new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? "Hide new password" : "Show new password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              autoComplete="new-password"
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              data-testid="input-confirm-password"
              required
            />
          </div>
          {requirementsError && <p className="text-sm text-destructive">Could not load password requirements. <Button type="button" variant="link" onClick={() => refetchRequirements()}>Retry</Button></p>}
        </CardContent>
        <CardFooter className="border-t bg-muted/20 px-6 py-4">
          <Button
            type="submit"
            data-testid="button-change-password"
            disabled={changePasswordMutation.isPending || !requirements || !currentPassword || !newPassword || !confirmPassword}
          >
            {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all w-full text-left whitespace-nowrap",
        active
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useRBAC();
  
  const [activeTab, setActiveTab] = useState("preferences");

  // RBAC Management states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState<RoleFormData>({
    name: "",
    displayName: "",
    description: "",
  });
  
  // Role Management states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Data fetching
  const { data: settingsData, isLoading: settingsLoading, isError: settingsError, refetch: refetchSettings } = useQuery<UserSettingsData>({
    queryKey: ["/api/auth/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/settings");
      return userSettingsSchema.parse(await res.json());
    },
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/rbac/roles"],
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['/api/members'],
  });

  // Settings form setup
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
    autoLogout: 120,
  };

  const form = useForm<UserSettingsData>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: defaultSettings,
  });

  const initializedForId = useRef<string | number | null>(null);

  useEffect(() => {
    if (settingsData && initializedForId.current !== ((user as any)?.id ?? 'me')) {
      initializedForId.current = (user as any)?.id ?? 'me';
      form.reset(settingsData);
    }
  }, [settingsData, form, user?.id]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: UserSettingsData) => {
      return await apiRequest('PATCH', `/api/auth/settings`, data);
    },
    onSuccess: (_, variables) => {
      toast({ title: "Settings Saved", description: "Your preferences have been updated successfully.", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      form.reset(variables);
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update settings.", variant: "destructive" });
    },
  });

  const handleSubmit = (data: UserSettingsData) => {
    updateSettingsMutation.mutate(data);
  };

  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      await apiRequest("POST", "/api/rbac/roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      toast({ title: "Role Created", description: "The new role has been created.", variant: "success" });
      setIsCreateDialogOpen(false);
      setRoleFormData({ name: "", displayName: "", description: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Creation Failed", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberRolesMutation = useMutation({
    mutationFn: async ({ memberId, roles }: { memberId: number; roles: string[] }) => {
      return await apiRequest('PATCH', `/api/members/${memberId}/roles`, { roles });
    },
    onSuccess: () => {
      toast({ title: "Roles Updated", description: "Member roles have been updated.", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      setSelectedMember(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredMembers = (members as any[]).filter((member: any) =>
    member.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.memberNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.roles?.some((role: string) => role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'committee': return 'secondary';
      case 'treasurer': return 'outline';
      case 'member': return 'secondary';
      default: return 'outline';
    }
  };

  const isFormDirty = form.formState.isDirty;
  const isFormPending = updateSettingsMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 pt-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and system configuration.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <NavButton active={activeTab === 'preferences'} onClick={() => setActiveTab('preferences')} icon={Settings} label="Preferences" />
            <NavButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={Shield} label="Security" />
            {hasPermission('update', 'system-settings') && hasPermission('read', 'roles') && (
              <NavButton active={activeTab === 'rbac'} onClick={() => setActiveTab('rbac')} icon={ShieldCheck} label="Access Control" />
            )}
            {hasPermission('update', 'system-settings') && hasPermission('update', 'members') && (
              <NavButton active={activeTab === 'roles'} onClick={() => setActiveTab('roles')} icon={Users} label="Member Roles" />
            )}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {settingsError && (activeTab === 'preferences' || activeTab === 'security') ? (
            <Card className="mb-6 border-destructive/40">
              <CardContent className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">We could not load your saved preferences.</p>
                  <p className="text-sm text-muted-foreground">Nothing has been changed. Try again before editing.</p>
                </div>
                <Button variant="outline" onClick={() => refetchSettings()}>Retry</Button>
              </CardContent>
            </Card>
          ) : null}
          {settingsError && activeTab === 'preferences' ? null : settingsLoading && (activeTab === 'preferences' || activeTab === 'security') ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-64 bg-muted rounded-xl w-full"></div>
              <div className="h-64 bg-muted rounded-xl w-full"></div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Form {...form}>
                {activeTab === 'preferences' && (
                  <form onSubmit={form.handleSubmit(handleSubmit)}>
                  <fieldset disabled={isFormPending} className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Bell className="h-5 w-5" />
                          Notifications
                        </CardTitle>
                        <CardDescription>Choose how and when you want to be updated.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Delivery Methods</h4>
                          <div className="space-y-3">
                            <FormField control={form.control} name="emailNotifications" render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-card">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-sm font-medium">Email</FormLabel>
                                  <FormDescription className="text-xs">Receive email updates.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="browserNotifications" render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-card">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-sm font-medium">Browser</FormLabel>
                                  <FormDescription className="text-xs">Show desktop alerts.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="smsNotifications" render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-card">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-sm font-medium">SMS Alerts</FormLabel>
                                  <FormDescription className="text-xs">Receive critical texts.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              </FormItem>
                            )} />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Alert Types</h4>
                          <div className="space-y-3">
                            <FormField control={form.control} name="loanUpdates" render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-card">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-sm font-medium">Loan Updates</FormLabel>
                                  <FormDescription className="text-xs">Status changes.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="paymentReminders" render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-card">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-sm font-medium">Payment Reminders</FormLabel>
                                  <FormDescription className="text-xs">Upcoming dues.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="systemAlerts" render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-card">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-sm font-medium">System Alerts</FormLabel>
                                  <FormDescription className="text-xs">Security & maintenance.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              </FormItem>
                            )} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Palette className="h-5 w-5" />
                          Appearance & Locale
                        </CardTitle>
                        <CardDescription>Customize the interface look and feel.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-6 md:grid-cols-2">
                        <FormField control={form.control} name="theme" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Theme</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a theme" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="light"><div className="flex items-center gap-2"><Sun className="h-4 w-4" /> Light</div></SelectItem>
                                <SelectItem value="dark"><div className="flex items-center gap-2"><Moon className="h-4 w-4" /> Dark</div></SelectItem>
                                <SelectItem value="system"><div className="flex items-center gap-2"><Monitor className="h-4 w-4" /> System</div></SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Choose your preferred theme.</FormDescription>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="language" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Language</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a language" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="sw">Kiswahili</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Choose interface language.</FormDescription>
                          </FormItem>
                        )} />
                        <div className="md:col-span-2">
                          <FormField control={form.control} name="soundEnabled" render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-4 shadow-sm bg-card max-w-sm">
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm font-medium flex items-center gap-2">
                                  {field.value ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                                  Sound Effects
                                </FormLabel>
                                <FormDescription className="text-xs">Enable notification sounds.</FormDescription>
                              </div>
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex items-center justify-between pt-2">
                      <p className="text-sm text-muted-foreground">
                        {isFormDirty ? "You have unsaved changes." : "Your preferences are up to date."} Saving stores preferences and session settings together.
                      </p>
                      <Button type="submit" disabled={!isFormDirty || isFormPending}>
                        {isFormPending ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </fieldset>
                  </form>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <fieldset disabled={isFormPending}>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Session Management
                          </CardTitle>
                          <CardDescription>Automatically secure your account when away.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <FormField control={form.control} name="autoLogout" render={({ field }) => (
                            <FormItem className="max-w-xs">
                              <FormLabel>Auto Logout Timer</FormLabel>
                              <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="15">15 minutes</SelectItem>
                                  <SelectItem value="30">30 minutes</SelectItem>
                                  <SelectItem value="60">1 hour</SelectItem>
                                  <SelectItem value="120">2 hours</SelectItem>
                                  <SelectItem value="240">4 hours</SelectItem>
                                  <SelectItem value="480">8 hours</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>Your personal inactivity timer is capped by the organization's session timeout policy. Server session expiry applies even if this page is closed.</FormDescription>
                            </FormItem>
                          )} />
                        </CardContent>
                        <CardFooter className="border-t bg-muted/20 px-6 py-4 flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">
                             {isFormDirty ? "Unsaved changes. " : ""}Saves session and preference settings together.
                          </p>
                          <Button type="submit" variant="secondary" disabled={!isFormDirty || isFormPending}>
                            {isFormPending ? "Saving..." : "Save changes"}
                          </Button>
                        </CardFooter>
                      </Card>
                    </fieldset>
                    </form>

                    <ChangePasswordCard />
                    <TwoFactorSetup />
                  </div>
                )}
              </Form>

              {activeTab === 'rbac' && hasPermission('read', 'roles') && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Lock className="h-5 w-5" />
                          System Roles
                        </CardTitle>
                        <CardDescription className="mt-1">Define roles and their permissions.</CardDescription>
                      </div>
                      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" /> Create Role
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create New Role</DialogTitle>
                            <DialogDescription>Create a new role with specific permissions</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="role-name">Role Identifier</Label>
                              <Input id="role-name" value={roleFormData.name} onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })} placeholder="e.g., reviewer" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="display-name">Display Name</Label>
                              <Input id="display-name" value={roleFormData.displayName} onChange={(e) => setRoleFormData({ ...roleFormData, displayName: e.target.value })} placeholder="e.g., Content Reviewer" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="description">Description</Label>
                              <Textarea id="description" value={roleFormData.description} onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })} placeholder="Describe the role's purpose" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                              <Button onClick={() => createRoleMutation.mutate(roleFormData)} disabled={createRoleMutation.isPending || !roleFormData.name}>
                                {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      {rolesLoading ? (
                        <div className="text-sm text-muted-foreground animate-pulse">Loading roles...</div>
                      ) : (
                        <div className="grid gap-3">
                          {(roles as any[]).map((role: any) => (
                            <div key={role.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card hover:bg-accent/5 transition-colors gap-4">
                              <div>
                                <h4 className="font-semibold text-foreground">{role.displayName}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="font-mono text-xs">{role.name}</Badge>
                                <Badge variant="outline">{role.permissions?.length || 0} perms</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'roles' && hasPermission('update', 'members') && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        Member Roles
                      </CardTitle>
                      <CardDescription>Assign or revoke roles for SACCO members.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search members..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>

                      <div className="border rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Member No.</TableHead>
                              <TableHead>Roles</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {membersLoading ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground animate-pulse">Loading members...</TableCell>
                              </TableRow>
                            ) : filteredMembers.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No members found.</TableCell>
                              </TableRow>
                            ) : (
                              filteredMembers.slice(0, 10).map((member: any) => (
                                <TableRow key={member.id}>
                                  <TableCell className="font-medium">{member.fullName}</TableCell>
                                  <TableCell className="text-muted-foreground">{member.memberNumber}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {member.roles?.length > 0 ? member.roles.map((role: string) => (
                                        <Badge key={role} variant={getRoleBadgeVariant(role)}>
                                          {role}
                                        </Badge>
                                      )) : <span className="text-xs text-muted-foreground italic">None</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Dialog open={selectedMember?.id === member.id} onOpenChange={(open) => !open && setSelectedMember(null)}>
                                      <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedMember(member)}>
                                          <Edit className="h-4 w-4" />
                                          <span className="sr-only">Edit Roles</span>
                                        </Button>
                                      </DialogTrigger>
                                      {selectedMember?.id === member.id && (
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>Edit Member Roles</DialogTitle>
                                            <DialogDescription>Assign roles to {member.fullName} ({member.memberNumber})</DialogDescription>
                                          </DialogHeader>
                                          <div className="space-y-4 py-4">
                                            <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                                              {(roles as any[]).map((role: any) => {
                                                const isChecked = selectedMember.roles?.includes(role.name) || false;
                                                return (
                                                  <div key={role.id} className="flex items-start space-x-3">
                                                    <Checkbox
                                                      id={`role-${role.id}`}
                                                      checked={isChecked}
                                                      className="mt-1"
                                                      onCheckedChange={(checked) => {
                                                        const newRoles = checked
                                                          ? [...(selectedMember.roles || []), role.name]
                                                          : (selectedMember.roles || []).filter((r: string) => r !== role.name);
                                                        setSelectedMember({ ...selectedMember, roles: newRoles });
                                                      }}
                                                    />
                                                    <div className="grid gap-1 leading-none">
                                                      <Label htmlFor={`role-${role.id}`} className="font-medium cursor-pointer">
                                                        {role.displayName}
                                                      </Label>
                                                      <p className="text-sm text-muted-foreground">{role.description}</p>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                            <div className="flex justify-end gap-2">
                                              <Button variant="outline" onClick={() => setSelectedMember(null)}>Cancel</Button>
                                              <Button
                                                onClick={() => updateMemberRolesMutation.mutate({ memberId: selectedMember.id, roles: selectedMember.roles || [] })}
                                                disabled={updateMemberRolesMutation.isPending}
                                              >
                                                {updateMemberRolesMutation.isPending ? "Updating..." : "Update Roles"}
                                              </Button>
                                            </div>
                                          </div>
                                        </DialogContent>
                                      )}
                                    </Dialog>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {filteredMembers.length > 10 && (
                        <div className="text-center text-sm text-muted-foreground pt-2">
                          Showing first 10 results. Refine your search to see more.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}