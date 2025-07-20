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
import { type Member, type MemberWithDetails } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, User, Phone, Mail, MapPin, Calendar, CreditCard, Building, Users } from "lucide-react";
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
});

type UpdateMemberData = z.infer<typeof updateMemberSchema>;

export default function MemberDetails() {
  const [match, params] = useRoute("/members/:id");
  const [, setLocation] = useLocation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
                  <p className="text-sm text-muted-foreground">Share Contribution</p>
                  <p className="font-medium">
                    {member.shareContribution ? `UGX ${parseFloat(member.shareContribution).toLocaleString()}` : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Number of Shares</p>
                  <p className="font-medium">{member.numberOfShares || 0}</p>
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
                {member.createdAt ? (() => {
                  try {
                    return format(new Date(member.createdAt), 'PP');
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
                <div key={loan.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{loan.loanType}</p>
                    <p className="text-sm text-muted-foreground">Applied: {loan.applicationDate ? (() => {
                      try {
                        return format(new Date(loan.applicationDate), 'PP');
                      } catch {
                        return 'Invalid date';
                      }
                    })() : 'Date not available'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">UGX {parseFloat(loan.principalAmount || loan.amount || 0).toLocaleString()}</p>
                    <Badge className={`${
                      loan.status === 'approved' ? 'bg-green-100 text-green-800' :
                      loan.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {loan.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}