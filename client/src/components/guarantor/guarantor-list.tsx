import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, XCircle, Clock } from "lucide-react";
import type { GuarantorWithDetails } from "@shared/schema";

interface GuarantorListProps {
  loanId: number;
}

export default function GuarantorList({ loanId }: GuarantorListProps) {
  const { data: guarantors = [], isLoading } = useQuery({
    queryKey: ['/api/guarantors/loan', loanId],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Guarantors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-muted-foreground">Loading guarantors...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Guarantors ({guarantors.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {guarantors.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-muted-foreground">No guarantors added yet</div>
          </div>
        ) : (
          <div className="space-y-3">
            {guarantors.map((guarantor: GuarantorWithDetails) => (
              <div
                key={guarantor.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {guarantor.guarantorMember?.user?.firstName} {guarantor.guarantorMember?.user?.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Member: {guarantor.guarantorMember?.memberNumber} | 
                    Guarantee: UGX {Number(guarantor.guaranteeAmount).toLocaleString()}
                  </div>
                  {guarantor.comments && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Comment: {guarantor.comments}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(guarantor.status)}
                  <Badge variant={getStatusVariant(guarantor.status)}>
                    {guarantor.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}