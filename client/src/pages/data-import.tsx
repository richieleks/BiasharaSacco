import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Users, PiggyBank } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulImports: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  importedMembers: number;
  importedAccounts: number;
}

export default function DataImport() {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (): Promise<ImportResult> => {
      return await apiRequest('POST', '/api/import/savings');
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      if (data && data.success) {
        toast({
          title: "Import Successful",
          description: `Successfully imported ${data.importedMembers} members and ${data.importedAccounts} savings accounts.`,
        });
      } else if (data) {
        toast({
          title: "Import Completed with Errors",
          description: `Imported ${data.successfulImports} records with ${data.errors?.length || 0} errors.`,
          variant: "destructive",
        });
      }
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/savings-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
    },
    onError: (error) => {
      console.error('Import failed:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import data",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    importMutation.mutate();
  };

  const progressPercentage = importResult && importResult.totalRows > 0 ? 
    Math.round((importResult.successfulImports / importResult.totalRows) * 100) : 0;

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Data Import</h1>
        <p className="text-slate-600 mt-1">Import customer savings accounts from Excel files</p>
      </div>

      {/* Import Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Savings Accounts
          </CardTitle>
          <CardDescription>
            Import customer savings account data from the attached Excel file (savings_1753029560040.xlsx)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium">savings_1753029560040.xlsx</p>
                <p className="text-sm text-slate-600">Excel file containing customer savings data</p>
              </div>
            </div>

            {/* Import Button */}
            <Button 
              onClick={handleImport}
              disabled={importMutation.isPending}
              className="w-full"
            >
              {importMutation.isPending ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Importing Data...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Start Import
                </>
              )}
            </Button>

            {/* Expected Data Format */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Expected columns:</strong> Full Name, National ID, Phone Number, Email, Department, Balance, Account Type.
                The system will automatically map various column name formats and create member profiles with savings accounts.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Import Results
            </CardTitle>
            <CardDescription>
              Results from importing savings account data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{importResult.totalRows}</div>
                <div className="text-sm text-blue-600">Total Rows</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResult.importedMembers}</div>
                <div className="text-sm text-green-600">New Members</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{importResult.importedAccounts}</div>
                <div className="text-sm text-purple-600">Savings Accounts</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importResult.errors?.length || 0}</div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
            </div>

            {/* Success/Error Status */}
            <div className="flex items-center gap-2">
              <Badge variant={importResult.success ? "default" : "destructive"}>
                {importResult.success ? "Success" : "Completed with Errors"}
              </Badge>
              <span className="text-sm text-slate-600">
                {importResult.successfulImports} of {importResult.totalRows} records processed successfully
              </span>
            </div>

            {/* Errors List */}
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <h4 className="font-medium text-red-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Import Errors ({importResult.errors?.length || 0})
                </h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {(importResult.errors || []).map((error, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertDescription>
                        <strong>Row {error.row}:</strong> {error.error}
                        {error.data && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm">Show data</summary>
                            <pre className="text-xs mt-1 p-2 bg-red-50 rounded overflow-x-auto">
                              {JSON.stringify(error.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* Success Summary */}
            {importResult.success && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Import completed successfully!</strong> All customer savings accounts have been imported into the system. 
                  You can now view the imported members and their savings accounts in the Members and Savings sections.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Import Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Member Creation
                </h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Automatically creates new member profiles</li>
                  <li>• Generates unique member numbers (IMP000001, etc.)</li>
                  <li>• Maps Excel columns to member fields</li>
                  <li>• Skips existing members (by National ID)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <PiggyBank className="h-4 w-4" />
                  Savings Accounts
                </h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Creates savings accounts for positive balances</li>
                  <li>• Generates unique account numbers</li>
                  <li>• Sets account type (regular by default)</li>
                  <li>• Links accounts to member profiles</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}