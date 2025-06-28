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
import type { z } from "zod";

type UpdateMemberData = z.infer<typeof insertMemberSchema>;

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
    resolver: zodResolver(insertMemberSchema.omit({ userId: true })),
    defaultValues: member || {},
  });

  const updateMemberMutation = useMutation({
    mutationFn: async (data: UpdateMemberData) => {
      return apiRequest(`/api/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
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

  // Update form default values when member data is loaded
  if (member && Object.keys(form.getValues()).length === 0) {
    form.reset(member);
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
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
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
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} value={field.value || ""} />
                          </FormControl>
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
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Occupation</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                {loans?.filter((loan: any) => loan.status === 'disbursed').length || 0}
              </p>
            </div>

            {savingsAccounts && savingsAccounts.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Total Savings</p>
                <p className="text-2xl font-bold text-primary">
                  UGX {savingsAccounts.reduce((total: number, account: any) => 
                    total + parseFloat(account.balance || '0'), 0
                  ).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
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