import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, CheckCircle, XCircle, Eye } from "lucide-react";
import { useState } from "react";
import GuarantorRequests from "@/components/guarantor/guarantor-requests";
import { useAuth } from "@/hooks/useAuth";
import type { GuarantorWithDetails, MemberWithDetails } from "@shared/schema";

export default function Guarantors() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'requests' | 'provided'>('requests');

  const { data: currentMember } = useQuery({
    queryKey: ['/api/members/by-user', user?.id],
    enabled: !!user?.id,
  });

  const { data: providedGuarantees = [], isLoading: loadingProvided } = useQuery({
    queryKey: ['/api/guarantors/member', currentMember?.id],
    enabled: !!currentMember?.id,
  });

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  if (!currentMember) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading member information...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guarantor Management</h1>
          <p className="text-muted-foreground">
            Manage guarantor requests and view guarantees you've provided
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 rounded-lg bg-muted p-1">
        <Button
          variant={activeTab === 'requests' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('requests')}
          className="flex-1"
        >
          <Clock className="h-4 w-4 mr-2" />
          Pending Requests
        </Button>
        <Button
          variant={activeTab === 'provided' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('provided')}
          className="flex-1"
        >
          <Users className="h-4 w-4 mr-2" />
          Guarantees Provided
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'requests' ? (
        <GuarantorRequests memberId={currentMember.id} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guarantees You've Provided ({providedGuarantees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProvided ? (
              <div className="text-center py-4">
                <div className="text-muted-foreground">Loading guarantees...</div>
              </div>
            ) : providedGuarantees.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="text-lg font-medium">No Guarantees Provided</div>
                <div className="text-muted-foreground">
                  You haven't provided any guarantees yet
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {providedGuarantees.map((guarantee: GuarantorWithDetails) => (
                  <div key={guarantee.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-medium">
                          Loan for {guarantee.loan?.member?.user?.firstName} {guarantee.loan?.member?.user?.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Member: {guarantee.loan?.member?.memberNumber} | 
                          Loan: KSh {Number(guarantee.loan?.principalAmount).toLocaleString()} |
                          Your Guarantee: KSh {Number(guarantee.guaranteeAmount).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Loan Type: {guarantee.loan?.loanType} | 
                          Term: {guarantee.loan?.termMonths} months |
                          Status: {guarantee.loan?.status}
                        </div>
                        {guarantee.comments && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Your Comment: {guarantee.comments}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(guarantee.status)}
                        <Badge variant={getStatusVariant(guarantee.status)}>
                          {guarantee.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-2">
                      <span>
                        Guaranteed on: {new Date(guarantee.createdAt).toLocaleDateString()}
                      </span>
                      {guarantee.status === 'approved' && guarantee.approvedAt && (
                        <span>
                          Approved on: {new Date(guarantee.approvedAt).toLocaleDateString()}
                        </span>
                      )}
                      {guarantee.status === 'rejected' && guarantee.rejectedAt && (
                        <span>
                          Rejected on: {new Date(guarantee.rejectedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}