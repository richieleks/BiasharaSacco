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
  UserCheck,
  Search,
  AlertCircle,
  Moon,
  Sun,
  Monitor,
  MessageSquare,
  User,
  Download,
  HardDrive,
  Clock,
  Unlock,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  Wifi,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, KeyRound, Building2, ChevronLeft, ChevronRight, UserCog, RefreshCw } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";
import { RBACManagementTab } from "@/components/rbac-management";

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
  
  // Email Configuration (Amazon SES)
  emailEnabled: z.boolean().default(true),
  smtpServer: z.string().default("email-smtp.us-east-1.amazonaws.com"),
  smtpPort: z.coerce.number().min(1).max(65535).default(587),
  emailFromAddress: z.string().default(""),
  emailFromName: z.string().default("Biashara SACCO"),
  
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
  minLoanApprovers: z.number().min(1).max(10).default(2),
  memberExitFee: z.number().min(0).default(0),

  // SACCO Bank Details (for bank schedule reports)
  saccoBankBranch: z.string().default('253047'),
  saccoBankAccount: z.string().default('2201034044'),
  saccoBankName: z.string().default('BIASHARA'),
  saccoSwiftCode: z.string().default('KCBLUGKA'),
  saccoAddress: z.string().default('7 commercial plaza'),
  saccoTown: z.string().default('Kamplala Uganda'),
  saccoCustomerId: z.string().default('CM920321014GLG'),
  saccoCustomerDob: z.string().default('20210909'),
  
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

function SystemSeedCard() {
  const { toast } = useToast();

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/run-seed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Seed Complete", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Seed Failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          System Seed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Re-sync system roles, permissions, and default SACCO accounts. This is safe to run at any time — it only adds missing entries and removes stale ones without affecting existing data.
        </p>
        <Button
          variant="outline"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
        >
          {seedMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Seed...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run System Seed
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function BackupManagementCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: backups, isLoading: backupsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/backups'],
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/backup');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Backup Created", description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/backups'] });
    },
    onError: (error: any) => {
      toast({ title: "Backup Failed", description: error.message, variant: "destructive" });
    },
  });

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Backup History
          </CardTitle>
          <Button
            size="sm"
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            data-testid="button-create-backup"
          >
            {createBackupMutation.isPending ? "Creating..." : "Create Backup Now"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {backupsLoading ? (
          <p className="text-sm text-muted-foreground">Loading backups...</p>
        ) : !backups || backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backups yet. Click "Create Backup Now" to create your first backup.</p>
        ) : (
          <div className="space-y-2">
            {backups.map((backup: any) => (
              <div key={backup.filename} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30" data-testid={`backup-item-${backup.filename}`}>
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{new Date(backup.timestamp).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(backup.size)} — {backup.tables?.length || 0} tables</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    window.open(`/api/admin/backups/${backup.filename}`, '_blank');
                  }}
                  data-testid={`button-download-backup-${backup.filename}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmailConfigTab({ form }: { form: any }) {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState("");

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/email/test-connection');
      return res.json();
    },
    onSuccess: () => {
      setConnectionStatus('success');
      toast({ title: "Connection Successful", description: "SMTP connection to Amazon SES verified." });
    },
    onError: (error: Error) => {
      setConnectionStatus('error');
      setConnectionError(error.message);
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async (to: string) => {
      const res = await apiRequest('POST', '/api/admin/email/send-test', { to });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Test Email Sent", description: data.message });
      setTestEmail("");
    },
    onError: (error: Error) => {
      toast({ title: "Send Failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Email Configuration</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure Amazon SES email delivery for member notifications and system alerts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Amazon SES SMTP Settings
          </CardTitle>
          <CardDescription>
            SMTP credentials are stored securely as environment variables (SES_SMTP_USERNAME, SES_SMTP_PASSWORD)
          </CardDescription>
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
                    Enable or disable all outgoing email notifications
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="smtpServer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SES SMTP Endpoint</FormLabel>
                  <FormControl>
                    <Input placeholder="email-smtp.us-east-1.amazonaws.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Amazon SES SMTP endpoint for your region
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
                    Use 587 (STARTTLS) or 465 (TLS)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailFromAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Email Address</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="noreply@biasharasacco.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Must be a verified identity in Amazon SES
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailFromName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Display Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Biashara SACCO" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Name shown in the "From" field
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
            <Wifi className="h-4 w-4" />
            Connection Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setConnectionStatus('testing');
                setConnectionError("");
                testConnectionMutation.mutate();
              }}
              disabled={testConnectionMutation.isPending}
            >
              {testConnectionMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Testing...</>
              ) : (
                <><Wifi className="h-4 w-4 mr-2" />Test SMTP Connection</>
              )}
            </Button>
            {connectionStatus === 'success' && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Connected to Amazon SES
              </span>
            )}
            {connectionStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                {connectionError || "Connection failed"}
              </span>
            )}
          </div>

          <Separator />

          <div>
            <label className="text-sm font-medium mb-2 block">Send Test Email</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="recipient@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => sendTestMutation.mutate(testEmail)}
                disabled={sendTestMutation.isPending || !testEmail}
              >
                {sendTestMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Send Test</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Send a test email to verify delivery is working end-to-end
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { hasPermission } = useRBAC();
  const [activeTab, setActiveTab] = useState<'system' | 'security' | 'email' | 'notifications' | 'business' | 'maintenance' | 'loantypes' | 'users' | 'preferences'>('business');

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
    smtpServer: "email-smtp.us-east-1.amazonaws.com",
    smtpPort: 587,
    emailFromAddress: "",
    emailFromName: "Biashara SACCO",
    systemNotifications: true,
    memberNotifications: true,
    loanNotifications: true,
    entranceFee: 15000,
    sharePrice: 5000,
    minimumSavingsBalance: 10000,
    loanToSavingsRatio: 2.5,
    membershipDurationMonths: 3,
    minLoanApprovers: 2,
    memberExitFee: 0,
    saccoBankBranch: '253047',
    saccoBankAccount: '2201034044',
    saccoBankName: 'BIASHARA',
    saccoSwiftCode: 'KCBLUGKA',
    saccoAddress: '7 commercial plaza',
    saccoTown: 'Kamplala Uganda',
    saccoCustomerId: 'CM920321014GLG',
    saccoCustomerDob: '20210909',
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
      toast({ title: "Settings Updated",
        description: "System settings have been updated successfully.", variant: "success" });
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

  const { data: savedUserSettings } = useQuery<UserSettingsData>({
    queryKey: ['/api/auth/settings'],
  });

  useEffect(() => {
    if (savedUserSettings) {
      userForm.reset(savedUserSettings);
    }
  }, [savedUserSettings, userForm]);

  const updateUserSettingsMutation = useMutation({
    mutationFn: async (data: UserSettingsData) => {
      return await apiRequest('PATCH', `/api/auth/settings`, data);
    },
    onSuccess: () => {
      toast({ title: "Settings Updated",
        description: "Your settings have been saved successfully.", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/settings'] });
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

  // Load loan types for management
  const { data: loanTypes } = useQuery({
    queryKey: ['/api/loan-types'],
  });

  const createLoanTypeMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/loan-types', data);
    },
    onSuccess: () => {
      toast({ title: "Loan Type Created",
        description: "New loan type has been created successfully.", variant: "success" });
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
      toast({ title: "Loan Type Deleted", description: "Loan type has been removed.", variant: "success" });
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
      className="justify-start whitespace-nowrap md:w-full shrink-0"
    >
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
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

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex md:flex-col gap-1 md:gap-0 md:space-y-1 overflow-x-auto pb-2 md:pb-0">
          <p className="hidden md:block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 pt-1 pb-1">SACCO Settings</p>
          <TabButton
            tab="business"
            icon={CreditCard}
            label="Business Rules"
            isActive={activeTab === 'business'}
          />
          <TabButton
            tab="loantypes"
            icon={CreditCard}
            label="Loan Types"
            isActive={activeTab === 'loantypes'}
          />
          <Separator className="hidden md:block my-2" />
          <p className="hidden md:block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 pt-1 pb-1">System Settings</p>
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
            tab="users"
            icon={Users}
            label="System Users"
            isActive={activeTab === 'users'}
          />
          <TabButton
            tab="maintenance"
            icon={Database}
            label="Backup & Maintenance"
            isActive={activeTab === 'maintenance'}
          />
          <Separator className="hidden md:block my-2" />
          <p className="hidden md:block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 pt-1 pb-1">Personal</p>
          <TabButton
            tab="preferences"
            icon={User}
            label="Preferences"
            isActive={activeTab === 'preferences'}
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
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-password-complexity">
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
                <EmailConfigTab form={form} />
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
                      Configure SACCO business rules, membership and loan operational limits
                    </p>
                  </div>

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

                        <FormField
                          control={form.control}
                          name="minLoanApprovers"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Loan Approvers</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1" 
                                  max="10"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Number of committee members required to approve a loan before it moves to disbursement
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="memberExitFee"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Member Exit Fee (UGX)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormDescription>
                                Fee charged when a member exits and their account is closed. Set to 0 for no exit fee.
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
                        <Building2 className="h-4 w-4" />
                        SACCO Bank Details
                      </CardTitle>
                      <CardDescription>
                        Bank account details used when generating KCB bank transfer schedule files for salary deductions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="saccoBankBranch"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Branch Code</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-sacco-branch" />
                              </FormControl>
                              <FormDescription>KCB branch code (e.g., 253047)</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="saccoBankAccount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SACCO Account Number</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-sacco-account" />
                              </FormControl>
                              <FormDescription>SACCO bank account number (credit account)</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="saccoBankName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-sacco-bank-name" />
                              </FormControl>
                              <FormDescription>SACCO account name as registered with the bank</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="saccoSwiftCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SWIFT Code</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-sacco-swift" />
                              </FormControl>
                              <FormDescription>Bank SWIFT/BIC code (e.g., KCBLUGKA)</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="saccoAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-sacco-address" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="saccoTown"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Town</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-sacco-town" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="saccoCustomerId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Customer ID</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-sacco-customer-id" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="saccoCustomerDob"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Customer DOB (YYYYMMDD)</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-sacco-customer-dob" />
                              </FormControl>
                              <FormDescription>Date in YYYYMMDD format for bank records</FormDescription>
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
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-backup-frequency">
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

                  <SystemSeedCard />
                  <BackupManagementCard />
                </div>
              )}

              {!['users', 'preferences', 'loantypes'].includes(activeTab) && (
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button variant="outline" type="button" onClick={() => navigate('/')}>
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

          {activeTab === 'users' && (
            <UserManagementTab />
          )}

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
                    <div className="overflow-x-auto"><Table>
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
                            <TableCell>{formatCurrency(loanType.minAmount || 0)}</TableCell>
                            <TableCell>{formatCurrency(loanType.maxAmount || 0)}</TableCell>
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
                    </Table></div>
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
                            <Select onValueChange={field.onChange} value={field.value}>
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
                            <Select onValueChange={field.onChange} value={field.value}>
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

        </div>
      </div>
    </div>
  );
}

function UserManagementTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [systemPage, setSystemPage] = useState(1);
  const [memberPage, setMemberPage] = useState(1);
  const [memberFilter, setMemberFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const PAGE_SIZE = 10;

  const { data: allUsers = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/auth/users'],
  });

  const { data: dynamicRoles = [] } = useQuery<any[]>({
    queryKey: ['/api/rbac/roles'],
  });

  const createUserSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    email: z.string().email("Invalid email address"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    roles: z.array(z.string()).min(1, "At least one role must be selected"),
  });

  const editUserSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    roles: z.array(z.string()).min(1, "At least one role must be selected"),
    password: z.string().optional(),
  });

  const systemRoleNames = ['admin', 'manager', 'committee', 'treasurer'];
  const systemRoles = dynamicRoles.filter((r: any) => systemRoleNames.includes(r.name));

  const createForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      roles: ["committee"],
    },
  });

  const editForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      roles: ["member"],
      password: "",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createUserSchema>) => {
      return await apiRequest('POST', '/api/auth/create-user', data);
    },
    onSuccess: () => {
      toast({ title: "User Created", description: "New user account has been created successfully.", variant: "success" });
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
      if (payload.roles) {
        payload.role = payload.roles[0];
      }
      return await apiRequest('PATCH', `/api/auth/users/${id}`, payload);
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "User account has been updated successfully.", variant: "success" });
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
      toast({ title: "User Deleted", description: "User account has been deleted.", variant: "success" });
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
      toast({ title: "Password Reset",
        description: `Password has been reset to "changeme123". User will be prompted to change it on next login.`, variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/users'] });
    },
    onError: (error: Error) => {
      toast({ title: "Reset Failed", description: error.message, variant: "destructive" });
    },
  });

  const unlockUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/auth/users/${id}/unlock`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Account Unlocked", description: data.message, variant: "success" });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/users'] });
    },
    onError: (error: Error) => {
      toast({ title: "Unlock Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleEditUser = (u: any) => {
    setEditingUser(u);
    const userRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || "member"];
    editForm.reset({
      username: u.username || "",
      email: u.email || "",
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      roles: userRoles,
      password: "",
    });
    setShowEditDialog(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300';
      case 'manager': return 'bg-purple-100 text-purple-800 dark:text-purple-300';
      case 'committee': return 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300';
      case 'treasurer': return 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200';
    }
  };

  const systemUsers = allUsers.filter((u: any) => u.userType === 'system' || ['admin', 'manager', 'committee'].includes(u.role));
  const allMemberUsers = allUsers.filter((u: any) => u.userType === 'member' || u.role === 'member');
  const linkedCount = allMemberUsers.filter((u: any) => !u.isUnlinked).length;
  const unlinkedCount = allMemberUsers.filter((u: any) => u.isUnlinked).length;

  const memberUsers = allMemberUsers.filter((u: any) => {
    if (memberFilter === 'linked' && u.isUnlinked) return false;
    if (memberFilter === 'unlinked' && !u.isUnlinked) return false;
    if (memberSearch) {
      const q = memberSearch.toLowerCase();
      const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const username = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const memberNum = (u.memberNumber || '').toLowerCase();
      return name.includes(q) || username.includes(q) || email.includes(q) || memberNum.includes(q);
    }
    return true;
  });

  const systemTotalPages = Math.max(1, Math.ceil(systemUsers.length / PAGE_SIZE));
  const paginatedSystemUsers = systemUsers.slice((systemPage - 1) * PAGE_SIZE, systemPage * PAGE_SIZE);
  const memberTotalPages = Math.max(1, Math.ceil(memberUsers.length / PAGE_SIZE));
  const paginatedMemberUsers = memberUsers.slice((memberPage - 1) * PAGE_SIZE, memberPage * PAGE_SIZE);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-1">System Users & Roles</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Manage system staff accounts separately from SACCO members. System users (admin, manager, committee) operate the platform and do not have member profiles.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            System Staff ({systemUsers.length})
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create System User</DialogTitle>
                <DialogDescription>Add a new system staff account (admin, manager, committee, treasurer).</DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <FormField control={createForm.control} name="roles" render={({ field }) => {
                    const currentRoles = field.value || [];
                    const isAdminSelected = currentRoles.includes('admin');
                    return (
                    <FormItem>
                      <FormLabel>Roles</FormLabel>
                      <div className="space-y-2">
                        {systemRoles.length > 0 ? systemRoles.map((roleOption: any) => {
                          const isAdmin = roleOption.name === 'admin';
                          const disabled = isAdmin ? false : isAdminSelected;
                          return (
                          <div key={roleOption.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`create-role-${roleOption.name}`}
                              checked={currentRoles.includes(roleOption.name)}
                              disabled={disabled}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  if (isAdmin) {
                                    field.onChange(['admin']);
                                  } else {
                                    field.onChange([...currentRoles.filter((r: string) => r !== 'admin'), roleOption.name]);
                                  }
                                } else {
                                  const updated = currentRoles.filter((r: string) => r !== roleOption.name);
                                  field.onChange(updated.length > 0 ? updated : currentRoles);
                                }
                              }}
                            />
                            <label htmlFor={`create-role-${roleOption.name}`} className={`text-sm font-medium cursor-pointer ${disabled ? 'text-muted-foreground' : ''}`}>
                              {roleOption.displayName}
                            </label>
                          </div>
                          );
                        }) : (
                          <p className="text-sm text-muted-foreground">Loading roles...</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{isAdminSelected ? 'Admin role cannot be combined with other roles. Admin users do not have member profiles.' : 'Only system roles are available here. Member accounts are created from the Members page.'}</p>
                      <FormMessage />
                    </FormItem>
                    );
                  }} />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? "Creating..." : "Create System User"}
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
          ) : systemUsers.length > 0 ? (
            <><div className="overflow-x-auto"><Table>
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
                {paginatedSystemUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {u.username}
                        {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(u.roles) ? u.roles : [u.role]).map((r: string) => (
                          <span key={r} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(r)}`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-600 hover:text-orange-700"
                            title="Unlock account"
                            onClick={() => unlockUserMutation.mutate(u.id)}
                            data-testid={`button-unlock-user-${u.id}`}
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        )}
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
            </Table></div>
            {systemTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(systemPage - 1) * PAGE_SIZE + 1}–{Math.min(systemPage * PAGE_SIZE, systemUsers.length)} of {systemUsers.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSystemPage(p => Math.max(1, p - 1))} disabled={systemPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">Page {systemPage} of {systemTotalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setSystemPage(p => Math.min(systemTotalPages, p + 1))} disabled={systemPage === systemTotalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No system users found. Create one using the button above.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Member Login Accounts ({allMemberUsers.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Login accounts linked to SACCO members. Member profiles are managed in the Members page.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, username, email, or member number..."
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={memberFilter} onValueChange={(v: any) => { setMemberFilter(v); setMemberPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({allMemberUsers.length})</SelectItem>
                <SelectItem value="linked">With Login ({linkedCount})</SelectItem>
                <SelectItem value="unlinked">Without Login ({unlinkedCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {memberUsers.length > 0 ? (
            <><div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Member ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMemberUsers.map((u: any) => (
                  <TableRow key={u.id} className={u.isUnlinked ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                    <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {u.isUnlinked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                            No login account
                          </span>
                        ) : (
                          <>
                            {u.username}
                            {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300">
                                <Lock className="h-3 w-3" />
                                Locked
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{u.email || <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {u.memberId ? (
                        <span className="text-xs font-mono bg-muted px-2 py-1 rounded">#{u.memberId}{u.memberNumber ? ` (${u.memberNumber})` : ''}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.memberUuid && (
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700" title="Edit member details" onClick={() => navigate(`/members/${u.memberUuid}`)}>
                            <UserCog className="h-4 w-4" />
                          </Button>
                        )}
                        {!u.isUnlinked && (
                          <>
                            {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                              <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700" title="Unlock account" onClick={() => unlockUserMutation.mutate(u.id)}>
                                <Unlock className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleEditUser(u)} title="Edit login account">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700" title="Reset password" onClick={() => {
                              if (confirm(`Reset password for "${u.username}"?`)) resetPasswordMutation.mutate(u.id);
                            }}>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" title="Delete login account" onClick={() => {
                              if (confirm(`Are you sure you want to delete the login account for "${u.username}"? This will remove their ability to log in but will NOT delete their member profile.`)) deleteUserMutation.mutate(u.id);
                            }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
            {memberTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(memberPage - 1) * PAGE_SIZE + 1}–{Math.min(memberPage * PAGE_SIZE, memberUsers.length)} of {memberUsers.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setMemberPage(p => Math.max(1, p - 1))} disabled={memberPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">Page {memberPage} of {memberTotalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setMemberPage(p => Math.min(memberTotalPages, p + 1))} disabled={memberPage === memberTotalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {memberSearch || memberFilter !== 'all' 
                ? "No members match the current filter criteria." 
                : "No member login accounts found. Member accounts are created from the Members page."}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user account details. Leave password blank to keep unchanged.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateUserMutation.mutate({ id: editingUser?.id, data }))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <FormField control={editForm.control} name="roles" render={({ field }) => {
                const currentRoles = field.value || [];
                const isAdminSelected = currentRoles.includes('admin');
                const isEditingSystemUser = editingUser?.userType === 'system' || systemRoleNames.includes(editingUser?.role);
                const availableEditRoles = isEditingSystemUser ? systemRoles : dynamicRoles;
                return (
                <FormItem>
                  <FormLabel>Roles</FormLabel>
                  <div className="space-y-2">
                    {availableEditRoles.length > 0 ? availableEditRoles.map((roleOption: any) => {
                      const isAdmin = roleOption.name === 'admin';
                      const disabled = isAdmin ? false : isAdminSelected;
                      return (
                      <div key={roleOption.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-role-${roleOption.name}`}
                          checked={currentRoles.includes(roleOption.name)}
                          disabled={disabled}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if (isAdmin) {
                                field.onChange(['admin']);
                              } else {
                                field.onChange([...currentRoles.filter((r: string) => r !== 'admin'), roleOption.name]);
                              }
                            } else {
                              const updated = currentRoles.filter((r: string) => r !== roleOption.name);
                              field.onChange(updated.length > 0 ? updated : currentRoles);
                            }
                          }}
                        />
                        <label htmlFor={`edit-role-${roleOption.name}`} className={`text-sm font-medium cursor-pointer ${disabled ? 'text-muted-foreground' : ''}`}>
                          {roleOption.displayName}
                        </label>
                      </div>
                      );
                    }) : (
                      <p className="text-sm text-muted-foreground">Loading roles...</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{isAdminSelected ? 'Admin role cannot be combined with other roles. Admin users do not have member profiles.' : 'Select one or more roles. The first selected role will be the primary role.'}</p>
                  <FormMessage />
                </FormItem>
                );
              }} />
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

      <Separator />

      <RBACManagementTab />
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
    acceptanceFee: z.number().min(0).default(0),
    minRepaymentsForTopUp: z.number().min(0).default(3),
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
        acceptanceFee: parseFloat(editLoanType.acceptanceFee) || 0,
        minRepaymentsForTopUp: editLoanType.minRepaymentsForTopUp ?? 3,
        isActive: editLoanType.isActive ?? true,
      };
    }
    return {
      name: "", displayName: "", description: "",
      interestRate: 12, interestCalculationMethod: "reducing_balance",
      compoundingFrequency: "monthly", minAmount: 50000, maxAmount: 5000000,
      minTermMonths: 1, maxTermMonths: 24, requiresGuarantors: false,
      maxGuarantors: 0, processingFeePercentage: 0, acceptanceFee: 0, minRepaymentsForTopUp: 3, isActive: true,
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
                name="acceptanceFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acceptance Fee (UGX)</FormLabel>
                    <FormControl>
                      <Input type="number" step="100" min="0" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormDescription>Fixed amount charged when a loan is accepted/approved</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minRepaymentsForTopUp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min. Repayments for Top-Up</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="24" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                    </FormControl>
                    <FormDescription>Minimum number of repayments a member must make before requesting a loan top-up (0 = no minimum)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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