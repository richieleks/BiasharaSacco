import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { User, Mail, Phone, Building, Calendar, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const profileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
});

type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  // Fetch member details for additional profile information
  const { data: memberData } = useQuery({
    queryKey: ['/api/members/by-user', user?.id],
    enabled: !!user?.id,
  });

  const form = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      return await apiRequest('PATCH', `/api/auth/profile`, data);
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ProfileUpdateData) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </DialogTitle>
          <DialogDescription>
            View and manage your profile information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Profile Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Basic Information</CardTitle>
              {!isEditing ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Full Name</p>
                      <p className="text-sm text-muted-foreground">
                        {user?.firstName} {user?.lastName}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SACCO Membership Information */}
          {memberData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SACCO Membership</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Member Number</p>
                      <p className="text-sm text-muted-foreground">{memberData.memberNumber}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge variant={memberData.status === 'active' ? 'default' : 'secondary'}>
                      {memberData.status?.charAt(0).toUpperCase() + memberData.status?.slice(1)}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">Status</p>
                    </div>
                  </div>
                  
                  {memberData.department && (
                    <div className="flex items-center gap-3">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Department</p>
                        <p className="text-sm text-muted-foreground">{memberData.department}</p>
                      </div>
                    </div>
                  )}
                  
                  {memberData.phoneNumber && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Phone Number</p>
                        <p className="text-sm text-muted-foreground">{memberData.phoneNumber}</p>
                      </div>
                    </div>
                  )}
                  
                  {memberData.createdAt && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Member Since</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(memberData.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Security */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Security</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-sm text-muted-foreground">
                      Your password is managed through your authentication provider
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Managed Externally
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Two-Factor Authentication</p>
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
      </DialogContent>
    </Dialog>
  );
}