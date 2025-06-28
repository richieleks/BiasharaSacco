import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMemberSchema, type Member, type MemberWithDetails } from "@shared/schema";
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
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/members/:id");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const memberId = params?.id;

  const { data: member, isLoading } = useQuery<MemberWithDetails>({
    queryKey: [`/api/members/${memberId}`],
    enabled: !!memberId,
  });

  const { data: savingsAccounts } = useQuery<any[]>({
    queryKey: [`/api/members/${memberId}/savings`],
    enabled: !!memberId,
  });

  const { data: loans } = useQuery<any[]>({
    queryKey: [`/api/members/${memberId}/loans`],
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
      return apiRequest("PATCH", `/api/members/${memberId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId] });
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Member details updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading member details...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Member not found.</p>
        <Button onClick={() => setLocation("/members")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Button>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/members")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Members
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6" />
              {member.user?.firstName || member.fullName?.split(' ')[0] || 'Unknown'} {member.user?.lastName || member.fullName?.split(' ')[1] || ''}
            </h1>
            <p className="text-muted-foreground">Member #{member.memberNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
            {member.status}
          </Badge>
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Member Details</DialogTitle>
                <DialogDescription>
                  Update member information and contact details.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdateMember)} className="space-y-4">
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
                                <SelectValue />
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

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                                <SelectValue />
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
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Employment Information */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Employment Information</h4>
                    
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
                                  <SelectValue />
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
                            <Input type="number" step="0.01" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Next of Kin Information */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Next of Kin Information</h4>
                    
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

                  {/* Financial Information */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Financial Information</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="monthlySavings"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Savings (UGX)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} value={field.value || ""} />
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
                              <Input type="number" step="0.01" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="numberOfShares"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Shares</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={field.value || ""} />
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
                  </div>

                  {/* Beneficiary Information */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Beneficiary Information</h4>
                    
                    <div className="grid grid-cols-3 gap-4">
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{member.user?.firstName || member.fullName?.split(' ')[0] || 'Unknown'} {member.user?.lastName || member.fullName?.split(' ')[1] || ''}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-medium capitalize">{member.gender || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">{member.dateOfBirth || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marital Status</p>
                <p className="font-medium capitalize">{member.maritalStatus || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ID Number</p>
                <p className="font-medium">{member.idNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">
                  {member.dateOfBirth ? format(new Date(member.dateOfBirth), 'PP') : 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-medium capitalize">{member.gender || 'Not specified'}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{member.phoneNumber || 'No phone number'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{member.user?.email || 'No email address'}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <span>{member.address || 'No address provided'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>{member.department || 'No department listed'}</span>
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
                {member.createdAt ? format(new Date(member.createdAt), 'PP') : 'Not available'}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Savings Accounts</p>
              <p className="text-2xl font-bold text-green-600">
                {savingsAccounts?.length || 0}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Active Loans</p>
              <p className="text-2xl font-bold text-orange-600">
                {loans?.length || 0}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Monthly Savings</p>
              <p className="font-medium">UGX {member.monthlySavings ? parseFloat(member.monthlySavings).toLocaleString() : '0'}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Share Contribution</p>
              <p className="font-medium">UGX {member.shareContribution ? parseFloat(member.shareContribution).toLocaleString() : '0'}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Total Shares</p>
              <p className="font-medium">{member.numberOfShares || 0} shares</p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                {member.status || 'pending'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Employment Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Employment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              {member.staffAccountNumber && (
                <div>
                  <p className="text-sm text-muted-foreground">Staff Account Number</p>
                  <p className="font-medium">{member.staffAccountNumber}</p>
                </div>
              )}
              {member.averageNetPay && (
                <div>
                  <p className="text-sm text-muted-foreground">Average Net Pay</p>
                  <p className="font-medium">UGX {parseFloat(member.averageNetPay).toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Next of Kin Information */}
        {(member.nextOfKinName || member.nextOfKinPhone) && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Next of Kin Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {member.nextOfKinName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{member.nextOfKinName}</p>
                  </div>
                )}
                {member.nextOfKinPhone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    <p className="font-medium">{member.nextOfKinPhone}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Savings Accounts */}
      {savingsAccounts && savingsAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Savings Accounts
            </CardTitle>
            <CardDescription>
              All savings accounts associated with this member
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savingsAccounts.map((account: any) => (
                <Card key={account.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="font-medium">{account.accountNumber}</p>
                        <Badge variant="outline">{account.accountType}</Badge>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        UGX {parseFloat(account.balance || '0').toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Opened {format(new Date(account.createdAt), 'PP')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loans */}
      {loans && loans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Loan History
            </CardTitle>
            <CardDescription>
              All loans associated with this member
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loans.map((loan: any) => (
                <div key={loan.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{loan.loanType} Loan</p>
                        <Badge variant={
                          loan.status === 'disbursed' ? 'default' : 
                          loan.status === 'approved' ? 'secondary' : 
                          loan.status === 'rejected' ? 'destructive' : 'outline'
                        }>
                          {loan.status}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold">
                        UGX {parseFloat(loan.requestedAmount || '0').toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Applied {format(new Date(loan.createdAt), 'PP')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Term</p>
                      <p className="font-medium">{loan.termMonths} months</p>
                    </div>
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