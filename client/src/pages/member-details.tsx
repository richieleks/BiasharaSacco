import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import { type Member, type MemberWithDetails } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Edit, User, Phone, Mail, MapPin, Calendar, CreditCard, Building, Users, Eye, FileText, Calculator, DollarSign, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";

// Create a specific update schema for the edit form
const updateMemberSchema = z.object({
  memberNumber: z.string().optional(),
  fullName: z.string().optional(),
  idNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
  department: z.string().optional(),
  section: z.string().optional(),
  termsOfService: z.enum(["permanent", "temporary", "contract", "ex-staff"]).optional(),
  averageNetPay: z.string().optional(),
  staffAccountNumber: z.string().optional(),
  monthlySavings: z.string().optional(),
  accountNumber: z.string().optional(),
  branch: z.string().optional(),
  shareContribution: z.string().optional(),
  numberOfShares: z.number().optional(),
  beneficiaryName: z.string().optional(),
  beneficiaryRelationship: z.string().optional(),
  beneficiaryContact: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  status: z.enum(["pending", "active", "inactive", "suspended", "rejected"]).optional(),
  joinDate: z.string().optional(),
});

type UpdateMemberData = z.infer<typeof updateMemberSchema>;

const shareCapitalSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => parseFloat(val) > 0, "Amount must be greater than zero"),
  description: z.string().optional(),
});

type ShareCapitalData = z.infer<typeof shareCapitalSchema>;

export default function MemberDetails() {
  const [match, params] = useRoute("/members/:id");
  const [, setLocation] = useLocation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isShareCapitalDialogOpen, setIsShareCapitalDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStaff = ['admin', 'manager', 'committee', 'teller', 'treasurer'].includes(user?.role || '');

  const memberId = params?.id;

  // Fetch member details
  const { data: member, isLoading: memberLoading } = useQuery<MemberWithDetails>({
    queryKey: ['/api/members', memberId],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch member details');
      }
      return response.json();
    },
    enabled: !!memberId,
  });

  // Fetch member's savings accounts
  const { data: savingsAccounts } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'savings'],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}/savings`);
      if (!response.ok) {
        throw new Error('Failed to fetch savings accounts');
      }
      return response.json();
    },
    enabled: !!memberId,
  });

  // Fetch member's loans
  const { data: loans } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'loans'],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}/loans`);
      if (!response.ok) {
        throw new Error('Failed to fetch loans');
      }
      return response.json();
    },
    enabled: !!memberId,
  });

  // Fetch member's transactions
  const { data: transactions } = useQuery<any[]>({
    queryKey: ['/api/members', memberId, 'transactions'],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}/transactions`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      return response.json();
    },
    enabled: !!memberId,
  });

  const form = useForm<UpdateMemberData>({
    resolver: zodResolver(updateMemberSchema),
  });

  // Reset form when member data is loaded
  if (member && form.getValues().memberNumber !== member.memberNumber) {
    form.reset({
      memberNumber: member.memberNumber || "",
      fullName: member.fullName || "",
      idNumber: member.idNumber || "",
      dateOfBirth: member.dateOfBirth || "",
      gender: member.gender || "male",
      phoneNumber: member.phoneNumber || "",
      address: member.address || "",
      maritalStatus: member.maritalStatus || "single",
      department: member.department || "",
      section: member.section || "",
      termsOfService: member.termsOfService || "permanent",
      averageNetPay: member.averageNetPay?.toString() || "",
      staffAccountNumber: member.staffAccountNumber || "",
      monthlySavings: member.monthlySavings?.toString() || "",
      accountNumber: member.accountNumber || "",
      branch: member.branch || "",
      shareContribution: member.shareContribution?.toString() || "",
      numberOfShares: member.numberOfShares || 4,
      beneficiaryName: member.beneficiaryName || "",
      beneficiaryRelationship: member.beneficiaryRelationship || "",
      beneficiaryContact: member.beneficiaryContact || "",
      nextOfKinName: member.nextOfKinName || "",
      nextOfKinPhone: member.nextOfKinPhone || "",
      status: member.status || "active",
      joinDate: member.joinDate ? new Date(member.joinDate).toISOString().split('T')[0] : "",
    });
  }

  const updateMemberMutation = useMutation({
    mutationFn: async (data: UpdateMemberData) => {
      const response = await apiRequest("PATCH", `/api/members/${memberId}`, data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Member updated successfully",
      });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update member",
        variant: "destructive",
      });
    },
  });

  const handleUpdateMember = (data: UpdateMemberData) => {
    updateMemberMutation.mutate(data);
  };

  const shareCapitalForm = useForm<ShareCapitalData>({
    resolver: zodResolver(shareCapitalSchema),
    defaultValues: { amount: "", description: "" },
  });

  const shareCapitalMutation = useMutation({
    mutationFn: async (data: ShareCapitalData) => {
      const response = await apiRequest("POST", `/api/members/${memberId}/share-capital`, data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Share Capital Posted",
        description: data.message,
      });
      setIsShareCapitalDialogOpen(false);
      shareCapitalForm.reset({ amount: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to post share capital",
        variant: "destructive",
      });
    },
  });

  if (!match || !memberId) {
    setLocation("/members");
    return null;
  }

  if (memberLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading member details...</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-lg">Member not found</div>
        <Button onClick={() => setLocation("/members")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Members
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/members")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Members
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {member.fullName || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || 'Member Details'}
            </h1>
            <p className="text-muted-foreground">Member #{member.memberNumber}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setIsEditDialogOpen(true)}
            size="sm"
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Member
          </Button>

          {/* Edit Member Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Member Details</DialogTitle>
                <DialogDescription>
                  Update member information. All fields are optional.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdateMember)} className="space-y-6">
                  {/* Personal Details Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Personal Details</h3>
                    
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="idNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ID Number</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="maritalStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Marital Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="single">Single</SelectItem>
                                <SelectItem value="married">Married</SelectItem>
                                <SelectItem value="divorced">Divorced</SelectItem>
                                <SelectItem value="widowed">Widowed</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Member Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="joinDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Join Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Employment Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Employment Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="section"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Section</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="termsOfService"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Terms of Service</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select terms" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="permanent">Permanent</SelectItem>
                                <SelectItem value="temporary">Temporary</SelectItem>
                                <SelectItem value="contract">Contract</SelectItem>
                                <SelectItem value="ex-staff">Ex-Staff</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="staffAccountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Staff Account Number</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="averageNetPay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Average Net Pay (UGX)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Next of Kin Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Next of Kin Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="nextOfKinName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Next of Kin Name</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nextOfKinPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Next of Kin Phone</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Financial Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Financial Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="monthlySavings"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Savings (UGX)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="shareContribution"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Share Contribution (UGX)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="numberOfShares"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Shares</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                value={field.value || ""}
                                onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="accountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Account Number</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="branch"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Branch</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Beneficiary Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Beneficiary Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="beneficiaryName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Beneficiary Name</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="beneficiaryRelationship"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relationship</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="beneficiaryContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Beneficiary Contact</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateMemberMutation.isPending}>
                      {updateMemberMutation.isPending ? "Updating..." : "Update Member"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{member.fullName || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Number</p>
                  <p className="font-medium">{member.memberNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID Number</p>
                  <p className="font-medium">{member.idNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{member.dateOfBirth || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium capitalize">{member.gender || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Marital Status</p>
                  <p className="font-medium capitalize">{member.maritalStatus || 'Not specified'}</p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Phone Number</p>
                  <p className="font-medium">{member.phoneNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email Address</p>
                  <p className="font-medium">{member.user?.email || 'Not provided'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{member.address || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Employment Information */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Employment Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{member.department || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Section</p>
                  <p className="font-medium">{member.section || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Terms of Service</p>
                  <p className="font-medium capitalize">{member.termsOfService || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Staff Account Number</p>
                  <p className="font-medium">{member.staffAccountNumber || 'Not provided'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Average Net Pay</p>
                  <p className="font-medium">
                    {member.averageNetPay ? `UGX ${parseFloat(member.averageNetPay).toLocaleString()}` : 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* Next of Kin Information */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Next of Kin Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Next of Kin Name</p>
                  <p className="font-medium">{member.nextOfKinName || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next of Kin Phone</p>
                  <p className="font-medium">{member.nextOfKinPhone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Financial Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Savings</p>
                  <p className="font-medium">
                    {member.monthlySavings ? `UGX ${parseFloat(member.monthlySavings).toLocaleString()}` : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bank Account Number</p>
                  <p className="font-medium">{member.accountNumber || 'Not provided'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Bank Branch</p>
                  <p className="font-medium">{member.branch || 'Not provided'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Share Capital Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Share Capital
                </h4>
                {isAdmin && (
                  <Button
                    size="sm"
                    onClick={() => setIsShareCapitalDialogOpen(true)}
                    className="h-8"
                  >
                    <DollarSign className="h-3.5 w-3.5 mr-1" />
                    Post Share Capital
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Contribution Per Share</p>
                  <p className="font-medium">
                    UGX {parseFloat(member.shareContribution || "20000").toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Number of Shares</p>
                  <p className="font-medium">{member.numberOfShares || 4}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Total</p>
                  <p className="font-medium">
                    UGX {(parseFloat(member.shareContribution || "20000") * (member.numberOfShares || 4)).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="font-medium text-green-600">
                    UGX {parseFloat(member.shareCapital || "0").toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance Remaining</p>
                  <p className="font-medium text-orange-600">
                    UGX {Math.max(0, (parseFloat(member.shareContribution || "20000") * (member.numberOfShares || 4)) - parseFloat(member.shareCapital || "0")).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={member.isPaidUp ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {member.isPaidUp ? 'Fully Paid' : 'Pending'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Beneficiary Information */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Beneficiary Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Beneficiary Name</p>
                  <p className="font-medium">{member.beneficiaryName || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Relationship</p>
                  <p className="font-medium">{member.beneficiaryRelationship || 'Not specified'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Beneficiary Contact</p>
                  <p className="font-medium">{member.beneficiaryContact || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Membership Information */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Membership Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Join Date</p>
                  <p className="font-medium">
                    {member.joinDate ? (() => {
                      try {
                        return format(new Date(member.joinDate), 'PPP');
                      } catch {
                        return 'Invalid date';
                      }
                    })() : 'Not recorded'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={`capitalize ${
                    member.status === 'active' ? 'bg-green-100 text-green-800' :
                    member.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                    member.status === 'suspended' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {member.status || 'pending'}
                  </Badge>
                </div>
                {member.approvedBy && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Approved By</p>
                      <p className="font-medium">{member.approvedBy}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Approval Date</p>
                      <p className="font-medium">
                        {member.approvedAt ? (() => {
                          try {
                            return format(new Date(member.approvedAt), 'PPP');
                          } catch {
                            return 'Invalid date';
                          }
                        })() : 'Not recorded'}
                      </p>
                    </div>
                  </>
                )}
                {member.approvalComments && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Approval Comments</p>
                    <p className="font-medium">{member.approvalComments}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Account Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {(member.joinDate || member.createdAt) ? (() => {
                  try {
                    return format(new Date(member.joinDate || member.createdAt), 'PP');
                  } catch {
                    return 'Invalid date';
                  }
                })() : 'Not available'}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Savings Accounts</p>
              <p className="text-2xl font-bold text-green-600">
                {Array.isArray(savingsAccounts) ? savingsAccounts.length : 0}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Active Loans</p>
              <p className="text-2xl font-bold text-orange-600">
                {Array.isArray(loans) ? loans.length : 0}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-2xl font-bold text-blue-600">
                {Array.isArray(transactions) ? transactions.length : 0}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Total Savings</p>
              <p className="text-2xl font-bold text-green-600">
                UGX {Array.isArray(savingsAccounts) ? savingsAccounts.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance || '0'), 0).toLocaleString() : '0'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={`capitalize ${
                member.status === 'active' ? 'bg-green-100 text-green-800' :
                member.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                member.status === 'suspended' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {member.status || 'pending'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Savings Accounts */}
      {Array.isArray(savingsAccounts) && savingsAccounts.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Savings Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {savingsAccounts.map((account: any) => (
                <div key={account.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{account.accountNumber}</p>
                    <p className="text-sm text-muted-foreground">{account.accountType}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">UGX {parseFloat(account.balance).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Balance</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loans */}
      {Array.isArray(loans) && loans.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Loan History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loans.map((loan: any) => (
                <div key={loan.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{loan.loanType}</p>
                      <Badge className={`${
                        loan.status === 'approved' || loan.status === 'active' ? 'bg-green-100 text-green-800' :
                        loan.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {loan.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Loan #{loan.loanNumber} • Applied: {loan.applicationDate ? (() => {
                        try {
                          return format(new Date(loan.applicationDate), 'PP');
                        } catch {
                          return 'Invalid date';
                        }
                      })() : 'Date not available'}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(isStaff ? `/loans?loanId=${loan.uuid}` : `/my-loans?loanId=${loan.uuid}`)}
                        className="text-xs"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/loans/${loan.uuid}/statement`)}
                        className="text-xs"
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        Statement
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/loans/${loan.uuid}/amortization`)}
                        className="text-xs"
                      >
                        <Calculator className="mr-1 h-3 w-3" />
                        Schedule
                      </Button>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-lg">UGX {parseFloat(loan.principalAmount || loan.amount || 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      Outstanding: UGX {parseFloat(loan.outstandingBalance || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            All transactions for this member
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Array.isArray(transactions) && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Date</th>
                    <th className="pb-2 font-medium text-muted-foreground">Type</th>
                    <th className="pb-2 font-medium text-muted-foreground">Description</th>
                    <th className="pb-2 font-medium text-muted-foreground">Reference</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Amount (UGX)</th>
                    <th className="pb-2 font-medium text-muted-foreground text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: any) => {
                    const isCredit = ['deposit', 'interest_credit', 'share_capital', 'loan_disbursement'].includes(tx.transactionType);
                    return (
                      <tr key={tx.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="py-3">
                          {tx.createdAt ? (() => {
                            try {
                              return format(new Date(tx.createdAt), 'PP');
                            } catch {
                              return 'N/A';
                            }
                          })() : 'N/A'}
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className="capitalize text-xs">
                            {(tx.transactionType || '').replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 text-muted-foreground max-w-[200px] truncate">
                          {tx.description || '-'}
                        </td>
                        <td className="py-3 text-muted-foreground text-xs font-mono">
                          {tx.referenceNumber || '-'}
                        </td>
                        <td className={`py-3 text-right font-medium ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                          {isCredit ? '+' : '-'}{parseFloat(tx.amount || '0').toLocaleString()}
                        </td>
                        <td className="py-3 text-center">
                          <Badge className={`text-xs ${
                            tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                            tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            tx.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {tx.status || 'unknown'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No transactions found for this member.</p>
          )}
        </CardContent>
      </Card>

      {/* Share Capital Posting Dialog */}
      <Dialog open={isShareCapitalDialogOpen} onOpenChange={setIsShareCapitalDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Post Share Capital
            </DialogTitle>
            <DialogDescription>
              Post a share capital payment for {member?.fullName || 'this member'}.
              {member && (
                <span className="block mt-2 text-xs">
                  Expected: UGX {(parseFloat(member.shareContribution || "20000") * (member.numberOfShares || 4)).toLocaleString()} 
                  {" | "}Paid: UGX {parseFloat(member.shareCapital || "0").toLocaleString()}
                  {" | "}Remaining: UGX {Math.max(0, (parseFloat(member.shareContribution || "20000") * (member.numberOfShares || 4)) - parseFloat(member.shareCapital || "0")).toLocaleString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...shareCapitalForm}>
            <form onSubmit={shareCapitalForm.handleSubmit((data) => shareCapitalMutation.mutate(data))} className="space-y-4">
              <FormField
                control={shareCapitalForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (UGX)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="Enter amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={shareCapitalForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Monthly share capital installment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsShareCapitalDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={shareCapitalMutation.isPending}>
                  {shareCapitalMutation.isPending ? "Posting..." : "Post Payment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}