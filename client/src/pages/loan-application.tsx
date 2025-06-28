import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LoanApplicationForm from "@/components/forms/loan-application-form";
import { ArrowLeft } from "lucide-react";

export default function LoanApplication() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const handleSuccess = () => {
    navigate("/my-loans");
  };

  const handleBack = () => {
    navigate("/my-loans");
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Loans
          </Button>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Loan Application</h2>
          <p className="text-slate-600 mt-1">Apply for a new loan with Biashara SACCO</p>
        </div>
      </div>

      {/* Loan Application Form */}
      <div className="max-w-4xl">
        <LoanApplicationForm onSuccess={handleSuccess} />
      </div>
    </>
  );
}