import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const memberFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  idNumber: z.string().min(1, "ID number is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  address: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).default("single"),
  department: z.string().min(1, "Department is required"),
  section: z.string().optional(),
  termsOfService: z.enum(["permanent", "temporary", "contract", "ex-staff"]).default("permanent"),
  monthlySavings: z.string().min(1, "Monthly savings amount is required"),
  accountNumber: z.string().optional(),
  branch: z.string().optional(),
  shareContribution: z.string().min(1, "Share contribution is required"),
  numberOfShares: z.string().min(1, "Number of shares is required"),
  beneficiaryName: z.string().min(1, "Beneficiary name is required"),
  beneficiaryRelationship: z.string().min(1, "Relationship is required"),
  beneficiaryContact: z.string().min(1, "Contact address is required"),
});

type MemberFormData = z.infer<typeof memberFormSchema>;

interface MemberFormProps {
  onSubmit: (data: MemberFormData) => void;
  isLoading?: boolean;
}

export default function MemberForm({ onSubmit, isLoading }: MemberFormProps) {
  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      fullName: "",
      idNumber: "",
      dateOfBirth: "",
      phoneNumber: "",
      address: "",
      maritalStatus: "single",
      department: "",
      section: "",
      termsOfService: "permanent",
      monthlySavings: "",
      accountNumber: "",
      branch: "",
      shareContribution: "20000", // minimum 4 shares at 5000 each
      numberOfShares: "4",
      beneficiaryName: "",
      beneficiaryRelationship: "",
      beneficiaryContact: "",
    },
  });

  const handleSubmit = (data: MemberFormData) => {
    // Convert numberOfShares to number before submitting
    const submissionData = {
      ...data,
      numberOfShares: parseInt(data.numberOfShares)
    };
    onSubmit(submissionData as any);
  };

  const calculateShareContribution = (numberOfShares: string) => {
    const shares = parseInt(numberOfShares) || 0;
    return (shares * 5000).toString();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-none">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold">
              BIASHARA CO-OPERATIVE SAVINGS AND CREDIT SOCIETY LTD
            </CardTitle>
            <p className="text-sm text-muted-foreground">P.O. BOX 7399 KAMPALA</p>
            <h2 className="text-lg font-semibold mt-4">MEMBERSHIP APPLICATION FORM</h2>
          </CardHeader>
        </Card>

        {/* Introduction */}
        <p className="text-sm">
          I hereby make application for membership in the Biashara Co-operative
          Savings and Credit Society Ltd.
        </p>

        {/* Personal Details Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">A. PERSONAL DETAILS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>1. Name (Capital Letters) *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name in capital letters" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="idNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>2. ID Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter ID number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>3. Postal Address *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter postal address" {...field} value={field.value || ''} />
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
                    <FormLabel>Tel Contact *</FormLabel>
                    <FormControl>
                      <Input placeholder="+254 7XX XXX XXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="maritalStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>4. Marital Status *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select marital status" />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>5. Department *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter department" {...field} />
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
                      <Input placeholder="Enter section" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="termsOfService"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>7. Terms of Service *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select terms of service" />
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
          </CardContent>
        </Card>

        {/* Proposed Monthly Savings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">B. PROPOSED MONTHLY SAVINGS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="monthlySavings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Deposit Amount (Shs) *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter monthly savings amount" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    I agree to make a minimum monthly deposit of this amount
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter account number" {...field} />
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
                    <FormLabel>Branch</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter branch" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Entrance Fee and Share Contribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">C. ENTRANCE FEE AND SHARE CONTRIBUTION</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">
                If my application is accepted, I agree to pay an Entrance Fee of <strong>Shs. 15,000</strong> 
                and a share capital contribution as indicated below.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="numberOfShares"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Shares *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Minimum 4 shares" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          const shares = parseInt(e.target.value) || 0;
                          form.setValue('shareContribution', calculateShareContribution(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum 4 shares at Shs. 5,000 each
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shareContribution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Share Contribution (Shs) *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Automatically calculated" 
                        {...field} 
                        disabled
                      />
                    </FormControl>
                    <FormDescription>
                      Total share capital contribution
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Beneficiary Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">D. BENEFICIARY</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="beneficiaryName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beneficiary Name (in case of death) *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter beneficiary full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="beneficiaryRelationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Spouse, Child, Parent" {...field} />
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
                    <FormLabel>Contact Address *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact address or phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Certification */}
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium">
            I certify that the above information is correct to the best of my knowledge
          </p>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Submitting..." : "Submit Application"}
          </Button>
        </div>
      </form>
    </Form>
  );
}