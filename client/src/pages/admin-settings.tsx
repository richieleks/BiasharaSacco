import { useState, useEffect } from "react";
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
  Shield, 
  Database, 
  Mail, 
  Bell,
  Users,
  CreditCard,
  FileText,
  Activity,
  ArrowLeft,
  Server,
  Lock,
  AlertTriangle,
  Globe,
  Palette,
  Volume2,
  VolumeX,
  ShieldCheck,
  UserCheck,
  Search,
  AlertCircle,
  Moon,
  Sun,
  Monitor,
  MessageSquare,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, KeyRound } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRBAC } from "@/hooks/useRBAC";

const adminSettingsSchema = z.object({
  // System Configuration
  maintenanceMode: z.boolean().default(false),
  systemAnnouncement: z.string().default(""),
  maxLoanAmount: z.number().min(0).default(5000000),
  maxLoanTerm: z.number().min(1).max(60).default(24),
  defaultInterestRate: z.number().min(0).max(100).default(12),
  
  // Security Settings
  sessionTimeout: z.number().min(15).max(1440).default(240),
  maxLoginAttempts: z.number().min(3).max(10).default(5),
  passwordComplexity: z.enum(["low", "medium", "high"]).default("medium"),
  twoFactorRequired: z.boolean().default(false),
  
  // Email Configuration
  emailEnabled: z.boolean().default(true),
  smtpServer: z.string().default(""),
  smtpPort: z.number().min(1).max(65535).default(587),
  emailFromAddress: z.string().default(""),
  
  // Notification Settings
  systemNotifications: z.boolean().default(true),
  memberNotifications: z.boolean().default(true),
  loanNotifications: z.boolean().default(true),
  
  // Membership Configuration
  entranceFee: z.number().min(0).default(15000),
  sharePrice: z.number().min(0).default(5000),

  // Business Rules
  minimumSavingsBalance: z.number().min(0).default(10000),
  loanToSavingsRatio: z.number().min(1).max(10).default(2.5),
  membershipDurationMonths: z.number().min(1).max(12).default(3),
  
  // Backup and Maintenance
  autoBackupEnabled: z.boolean().default(true),
  backupFrequency: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  logRetentionDays: z.number().min(30).max(365).default(90),
});

type AdminSettingsData = z.infer<typeof adminSettingsSchema>;

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
  autoLogout: z.number().min(15).max(480).default(120),
});

type UserSettingsData = z.infer<typeof userSettingsSchema>;

interface RoleFormData {
  name: string;
  displayName: string;
  description: string;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { hasPermission } = useRBAC();
  const [activeTab, setActiveTab] = useState<'system' | 'security' | 'email' | 'notifications' | 'business' | 'maintenance' | 'loantypes' | 'users' | 'preferences' | 'rbac' | 'roleassign'>('system');

  const settingsDefaults: AdminSettingsData = {
    maintenanceMode: false,
    systemAnnouncement: "",
    maxLoanAmount: 5000000,
    maxLoanTerm: 24,
    defaultInterestRate: 12,
    sessionTimeout: 240,
    maxLoginAttempts: 5,
    passwordComplexity: "medium",
    twoFactorRequired: false,
    emailEnabled: true,
    smtpServer: "",
    smtpPort: 587,
    emailFromAddress: "",
    systemNotifications: true,
    memberNotifications: true,
    loanNotifications: true,
    entranceFee: 15000,
    sharePrice: 5000,
    minimumSavingsBalance: 10000,
    loanToSavingsRatio: 2.5,
    membershipDurationMonths: 3,
    autoBackupEnabled: true,
    backupFrequency: "daily",
    logRetentionDays: 90,
  };

  // Load system settings from API
  const { data: systemSettings, isLoading } = useQuery<AdminSettingsData>({
    queryKey: ['/api/admin/settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings');
      if (!response.ok) return settingsDefaults;
      const data = await response.json();
      return { ...settingsDefaults, ...data };
    },
  });

  const form = useForm<AdminSettingsData>({
    resolver: zodResolver(adminSettingsSchema),
    defaultValues: systemSettings || settingsDefaults,
  });

  useEffect(() => {
    if (systemSettings) {
      form.reset(systemSettings);
    }
  }, [systemSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: AdminSettingsData) => {
      return await apiRequest('PATCH', `/api/admin/settings`, data);
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "System settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: AdminSettingsData) => {
    updateSettingsMutation.mutate(data);
  };

  // User settings form (preferences tab)
  const defaultUserSettings: UserSettingsData = {
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

  const userForm = useForm<UserSettingsData>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: defaultUserSettings,
  });

  const updateUserSettingsMutation = useMutation({
    mutationFn: async (data: UserSettingsData) => {
      return await apiRequest('PATCH', `/api/auth/settings`, data);
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your settings have been saved successfully.",
      });
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

  const handleUserSettingsSubmit = (data: UserSettingsData) => {
    updateUserSettingsMutation.mutate(data);
  };

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

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      await apiRequest("POST", "/api/rbac/roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      toast({
        title: "Success",
        description: "Role created successfully",
      });
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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive' as const;
      case 'committee':
        return 'secondary' as const;
      case 'treasurer':
        return 'outline' as const;
      case 'member':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  // Load loan types for management
  const { data: loanTypes } = useQuery({
    queryKey: ['/api/loan-types'],
  });

  const createLoanTypeMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/loan-types', data);
    },
    onSuccess: () => {
      toast({
        title: "Loan Type Created",
        description: "New loan type has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loan-types'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create loan type. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteLoanTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/loan-types/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Loan Type Deleted", description: "Loan type has been removed." });
      queryClient.invalidateQueries({ queryKey: ['/api/loan-types'] });
    },
    onError: (error: Error) => {
      toast({ title: "Deletion Failed", description: error.message, variant: "destructive" });
    },
  });

  const TabButton = ({ tab, icon: Icon, label, isActive }: { 
    tab: typeof activeTab, 
    icon: React.ComponentType<any>, 
    label: string, 
    isActive: boolean 
  }) => (
    <Button
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onClick={() => setActiveTab(tab)}
      className="justify-start w-full"
    >
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );

  if (isLoading) {
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
            <Settings className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your preferences, system settings, and SACCO operations
          </p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 space-y-2">
          <TabButton
            tab="system"
            icon={Server}
            label="System Configuration"
            isActive={activeTab === 'system'}
          />
          <TabButton
            tab="security"
            icon={Shield}
            label="Security & Access"
            isActive={activeTab === 'security'}
          />
          <TabButton
            tab="email"
            icon={Mail}
            label="Email Configuration"
            isActive={activeTab === 'email'}
          />
          <TabButton
            tab="notifications"
            icon={Bell}
            label="Notifications"
            isActive={activeTab === 'notifications'}
          />
          <TabButton
            tab="business"
            icon={CreditCard}
            label="Business Rules"
            isActive={activeTab === 'business'}
          />
          <TabButton
            tab="maintenance"
            icon={Database}
            label="Backup & Maintenance"
            isActive={activeTab === 'maintenance'}
          />
          <TabButton
            tab="loantypes"
            icon={CreditCard}
            label="Loan Types"
            isActive={activeTab === 'loantypes'}
          />
          <TabButton
            tab="users"
            icon={Users}
            label="User Management"
            isActive={activeTab === 'users'}
          />
          <Separator className="my-2" />
          <TabButton
            tab="preferences"
            icon={User}
            label="Preferences"
            isActive={activeTab === 'preferences'}
          />
          <TabButton
            tab="rbac"
            icon={ShieldCheck}
            label="RBAC Management"
            isActive={activeTab === 'rbac'}
          />
          <TabButton
            tab="roleassign"
            icon={UserCheck}
            label="Role Assignment"
            isActive={activeTab === 'roleassign'}
          />
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              
              {/* System Configuration Tab */}
              {activeTab === 'system' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">System Configuration</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure global system settings and operational parameters
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        System Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="maintenanceMode"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between space-y-0">
                            <div className="space-y-1">
                              <FormLabel className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Maintenance Mode
                              </FormLabel>
                              <FormDescription>
                                Enable to restrict system access during maintenance
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
                        name="systemAnnouncement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>System Announcement</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter system announcement message..."
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Display important announcements to all users
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Membership Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="entranceFee"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Entrance Fee (UGX)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                One-time fee charged when a new member joins the SACCO
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="sharePrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Share Price (UGX)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Price per share for share capital contribution
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Loan Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="maxLoanAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Maximum Loan Amount (UGX)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Maximum loan amount that can be approved
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="maxLoanTerm"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Maximum Loan Term (months)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1" 
                                  max="60"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Maximum loan repayment period
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="defaultInterestRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Default Interest Rate (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="100"
                                  step="0.001"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Default annual interest rate for loans
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Security & Access Control</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure security policies and access controls
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Authentication Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="sessionTimeout"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Session Timeout (minutes)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="15" 
                                  max="1440"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Auto-logout after inactivity
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="maxLoginAttempts"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Login Attempts</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="3" 
                                  max="10"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Account lockout after failed attempts
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="passwordComplexity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password Complexity</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select complexity level" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Low - Basic requirements</SelectItem>
                                  <SelectItem value="medium">Medium - Moderate requirements</SelectItem>
                                  <SelectItem value="high">High - Strong requirements</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Password strength requirements
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="twoFactorRequired"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between space-y-0">
                            <div className="space-y-1">
                              <FormLabel>Require Two-Factor Authentication</FormLabel>
                              <FormDescription>
                                Mandate 2FA for all user accounts
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
              )}

              {/* Email Configuration Tab */}
              {activeTab === 'email' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Email Configuration</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure email server settings and notification preferences
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        SMTP Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="emailEnabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between space-y-0">
                            <div className="space-y-1">
                              <FormLabel>Email System Enabled</FormLabel>
                              <FormDescription>
                                Enable or disable email notifications
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="smtpServer"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Server</FormLabel>
                              <FormControl>
                                <Input placeholder="smtp.gmail.com" {...field} />
                              </FormControl>
                              <FormDescription>
                                SMTP server hostname
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="smtpPort"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Port</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1" 
                                  max="65535"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                SMTP server port (usually 587)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="emailFromAddress"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>From Email Address</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email" 
                                  placeholder="noreply@biasharasacco.com" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Email address used for outgoing notifications
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">System Notifications</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure system-wide notification settings
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Notification Categories
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="systemNotifications"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between space-y-0">
                            <div className="space-y-1">
                              <FormLabel>System Notifications</FormLabel>
                              <FormDescription>
                                Enable system maintenance and security alerts
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
                        name="memberNotifications"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between space-y-0">
                            <div className="space-y-1">
                              <FormLabel>Member Notifications</FormLabel>
                              <FormDescription>
                                Enable member-related notifications
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
                        name="loanNotifications"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between space-y-0">
                            <div className="space-y-1">
                              <FormLabel>Loan Notifications</FormLabel>
                              <FormDescription>
                                Enable loan application and approval notifications
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
              )}

              {/* Business Rules Tab */}
              {activeTab === 'business' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Business Rules</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure SACCO business rules and operational limits
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Loan Eligibility Rules
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="minimumSavingsBalance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Savings Balance (UGX)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Minimum balance required for loan eligibility
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="loanToSavingsRatio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Loan-to-Savings Ratio</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1" 
                                  max="10"
                                  step="0.1"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Maximum loan amount as multiple of savings
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="membershipDurationMonths"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Membership Duration (months)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1" 
                                  max="12"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Required membership duration for loan eligibility
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Maintenance Tab */}
              {activeTab === 'maintenance' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Backup & Maintenance</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure backup schedules and maintenance settings
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Backup Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="autoBackupEnabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between space-y-0">
                            <div className="space-y-1">
                              <FormLabel>Automatic Backups</FormLabel>
                              <FormDescription>
                                Enable automatic database backups
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="backupFrequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Backup Frequency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select frequency" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                How often to perform backups
                              </FormDescription>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="logRetentionDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Log Retention (days)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="30" 
                                  max="365"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                How long to keep system logs
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Loan Types Tab */}
              {activeTab === 'loantypes' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Loan Type Management</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Create and manage loan types, interest rates, and lending terms
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Loan Types
                        </CardTitle>
                        <LoanTypeFormDialog />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loanTypes && loanTypes.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Interest Rate</TableHead>
                              <TableHead>Min Amount</TableHead>
                              <TableHead>Max Amount</TableHead>
                              <TableHead>Min Term</TableHead>
                              <TableHead>Max Term</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loanTypes.map((loanType: any) => (
                              <TableRow key={loanType.id}>
                                <TableCell className="font-medium">
                                  {loanType.displayName}
                                </TableCell>
                                <TableCell>{loanType.interestRate}%</TableCell>
                                <TableCell>UGX {loanType.minAmount?.toLocaleString()}</TableCell>
                                <TableCell>UGX {loanType.maxAmount?.toLocaleString()}</TableCell>
                                <TableCell>{loanType.minTerm || loanType.minTermMonths} months</TableCell>
                                <TableCell>{loanType.maxTerm || loanType.maxTermMonths} months</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <LoanTypeFormDialog editLoanType={loanType} />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      type="button"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete "${loanType.displayName}"?`)) {
                                          deleteLoanTypeMutation.mutate(loanType.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4">No loan types configured</p>
                          <LoanTypeFormDialog />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'users' && (
                <UserManagementTab />
              )}

              {!['users', 'rbac', 'roleassign', 'preferences', 'loantypes'].includes(activeTab) && (
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button variant="outline" onClick={() => navigate('/')}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              )}
            </form>
          </Form>

          {/* Preferences Tab - separate form */}
          {activeTab === 'preferences' && (
            <Form {...userForm}>
              <form onSubmit={userForm.handleSubmit(handleUserSettingsSubmit)} className="space-y-8">
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
                        control={userForm.control}
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
                        control={userForm.control}
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
                        control={userForm.control}
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
                        control={userForm.control}
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
                        control={userForm.control}
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
                        control={userForm.control}
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
                        control={userForm.control}
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
                        control={userForm.control}
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
                        control={userForm.control}
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
                        control={userForm.control}
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

                      <Separator />

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">Change Password</p>
                            <p className="text-sm text-muted-foreground">
                              Password is managed through your authentication provider
                            </p>
                          </div>
                          <Button variant="outline" size="sm" disabled>
                            Managed Externally
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">Two-Factor Authentication</p>
                            <p className="text-sm text-muted-foreground">
                              Enhanced security through your authentication provider
                            </p>
                          </div>
                          <Button variant="outline" size="sm" disabled>
                            Provider Managed
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button 
                    type="submit" 
                    disabled={updateUserSettingsMutation.isPending}
                  >
                    {updateUserSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {/* RBAC Management Tab */}
          {activeTab === 'rbac' && (
            <div className="space-y-6">
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
            </div>
          )}

          {/* Role Assignment Tab */}
          {activeTab === 'roleassign' && (
            <div className="space-y-6">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserManagementTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: allUsers = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/auth/users'],
  });

  const createUserSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    email: z.string().email("Invalid email address"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    role: z.enum(["admin", "manager", "committee", "teller", "member"]),
  });

  const editUserSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    role: z.enum(["admin", "manager", "committee", "teller", "member"]),
    password: z.string().optional(),
  });

  const createForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "member",
    },
  });

  const editForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "member",
      password: "",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createUserSchema>) => {
      return await apiRequest('POST', '/api/auth/create-user', data);
    },
    onSuccess: () => {
      toast({ title: "User Created", description: "New user account has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/users'] });
      setShowCreateDialog(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Creation Failed", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload = { ...data };
      if (!payload.password) delete payload.password;
      return await apiRequest('PATCH', `/api/auth/users/${id}`, payload);
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "User account has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/users'] });
      setShowEditDialog(false);
      setEditingUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/auth/users/${id}`);
    },
    onSuccess: () => {
      toast({ title: "User Deleted", description: "User account has been deleted." });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/users'] });
    },
    onError: (error: Error) => {
      toast({ title: "Deletion Failed", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/auth/users/${id}/reset-password`);
      return res;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Password Reset",
        description: `Password has been reset to "changeme123". User will be prompted to change it on next login.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/users'] });
    },
    onError: (error: Error) => {
      toast({ title: "Reset Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleEditUser = (u: any) => {
    setEditingUser(u);
    editForm.reset({
      username: u.username || "",
      email: u.email || "",
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      role: u.role || "member",
      password: "",
    });
    setShowEditDialog(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-purple-100 text-purple-800';
      case 'committee': return 'bg-blue-100 text-blue-800';
      case 'teller': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">User Management</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Create, edit, and manage system user accounts and their roles
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            System Users ({allUsers.length})
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new user account to the system.</DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={createForm.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={createForm.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={createForm.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={createForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={createForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={createForm.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="committee">Committee</SelectItem>
                          <SelectItem value="teller">Teller</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : allUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(u.role)}`}>
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditUser(u)} title="Edit user">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-600 hover:text-amber-700"
                          title="Reset password"
                          onClick={() => {
                            if (confirm(`Reset password for "${u.username}"? Their password will be set to "changeme123" and they will be required to change it on next login.`)) {
                              resetPasswordMutation.mutate(u.id);
                            }
                          }}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          title="Delete user"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete user "${u.username}"?`)) {
                              deleteUserMutation.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No users found.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user account details. Leave password blank to keep unchanged.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateUserMutation.mutate({ id: editingUser?.id, data }))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password (optional)</FormLabel>
                  <FormControl><Input type="password" placeholder="Leave blank to keep current" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="committee">Committee</SelectItem>
                      <SelectItem value="teller">Teller</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoanTypeFormDialog({ editLoanType }: { editLoanType?: any }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!editLoanType;

  const loanTypeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    displayName: z.string().min(1, "Display name is required"),
    description: z.string().min(1, "Description is required").or(z.literal("")),
    interestRate: z.number().min(0, "Interest rate must be positive"),
    interestCalculationMethod: z.enum(["simple", "compound", "reducing_balance"]),
    compoundingFrequency: z.enum(["monthly", "quarterly", "annually"]).optional(),
    minAmount: z.number().min(1, "Minimum amount must be positive"),
    maxAmount: z.number().min(1, "Maximum amount must be positive"),
    minTermMonths: z.number().min(1, "Minimum term must be at least 1 month"),
    maxTermMonths: z.number().min(1, "Maximum term must be at least 1 month"),
    requiresGuarantors: z.boolean().default(false),
    maxGuarantors: z.number().min(0).optional(),
    processingFeePercentage: z.number().min(0).max(100).default(0),
    isActive: z.boolean().default(true),
  });

  type LoanTypeFormData = z.infer<typeof loanTypeSchema>;

  const getDefaults = (): LoanTypeFormData => {
    if (editLoanType) {
      return {
        name: editLoanType.name || "",
        displayName: editLoanType.displayName || "",
        description: editLoanType.description || "",
        interestRate: parseFloat(editLoanType.interestRate) || 12,
        interestCalculationMethod: editLoanType.interestType || editLoanType.interestCalculationMethod || "reducing_balance",
        compoundingFrequency: editLoanType.compoundingFrequency || "monthly",
        minAmount: parseFloat(editLoanType.minAmount) || 50000,
        maxAmount: parseFloat(editLoanType.maxAmount) || 5000000,
        minTermMonths: editLoanType.minTerm || editLoanType.minTermMonths || 1,
        maxTermMonths: editLoanType.maxTerm || editLoanType.maxTermMonths || 24,
        requiresGuarantors: editLoanType.requiresGuarantor ?? false,
        maxGuarantors: 0,
        processingFeePercentage: parseFloat(editLoanType.processingFee) || 0,
        isActive: editLoanType.isActive ?? true,
      };
    }
    return {
      name: "", displayName: "", description: "",
      interestRate: 12, interestCalculationMethod: "reducing_balance",
      compoundingFrequency: "monthly", minAmount: 50000, maxAmount: 5000000,
      minTermMonths: 1, maxTermMonths: 24, requiresGuarantors: false,
      maxGuarantors: 0, processingFeePercentage: 0, isActive: true,
    };
  };

  const form = useForm<LoanTypeFormData>({
    resolver: zodResolver(loanTypeSchema),
    defaultValues: getDefaults(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: LoanTypeFormData) => {
      if (isEditing) {
        return await apiRequest('PUT', `/api/loan-types/${editLoanType.id}`, data);
      }
      return await apiRequest('POST', '/api/loan-types', data);
    },
    onSuccess: () => {
      toast({
        title: isEditing ? "Loan Type Updated" : "Loan Type Created",
        description: isEditing ? "Loan type has been updated successfully." : "New loan type has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loan-types'] });
      setOpen(false);
      if (!isEditing) form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: isEditing ? "Update Failed" : "Creation Failed",
        description: error.message || "Operation failed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFormSubmit = (data: LoanTypeFormData) => {
    if (data.maxAmount < data.minAmount) {
      toast({ title: "Validation Error", description: "Maximum amount must be greater than minimum amount.", variant: "destructive" });
      return;
    }
    if (data.maxTermMonths < data.minTermMonths) {
      toast({ title: "Validation Error", description: "Maximum term must be greater than minimum term.", variant: "destructive" });
      return;
    }
    saveMutation.mutate(data);
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit(handleFormSubmit)(e);
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      form.reset(getDefaults());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="ghost" size="sm" type="button" title="Edit loan type">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button">
            <Plus className="h-4 w-4 mr-2" />
            Create Loan Type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Loan Type" : "Create New Loan Type"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update loan product configuration." : "Configure a new loan product with interest rates, terms, and requirements."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onFormSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Name</FormLabel>
                    <FormControl>
                      <Input placeholder="emergency_loan" {...field} />
                    </FormControl>
                    <FormDescription>Internal identifier (lowercase, no spaces)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Emergency Loan" {...field} />
                    </FormControl>
                    <FormDescription>Name shown to users</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Quick financial assistance for urgent needs..." className="resize-none" {...field} />
                  </FormControl>
                  <FormDescription>Detailed description of the loan product</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" min="0" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormDescription>Annual interest rate</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="interestCalculationMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calculation Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="simple">Simple Interest</SelectItem>
                        <SelectItem value="compound">Compound Interest</SelectItem>
                        <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch('interestCalculationMethod') === 'compound' && (
                <FormField
                  control={form.control}
                  name="compoundingFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compounding</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Amount (UGX)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Amount (UGX)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minTermMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Term (months)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxTermMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Term (months)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="requiresGuarantors"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-1">
                      <FormLabel>Requires Guarantors</FormLabel>
                      <FormDescription>Whether this loan type requires guarantors</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {form.watch('requiresGuarantors') && (
                <FormField
                  control={form.control}
                  name="maxGuarantors"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Guarantors</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="10" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormDescription>Maximum number of guarantors allowed</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="processingFeePercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Processing Fee (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0" max="100" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormDescription>Percentage of loan amount charged as processing fee</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-1">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Whether this loan type is available for applications</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Loan Type")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}