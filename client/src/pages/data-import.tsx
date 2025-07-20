import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (): Promise<ImportResult> => {
      if (!selectedFile) {
        throw new Error('Please select a file to import');
      }
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch('/api/import/savings', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      return await response.json();
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
      console.error("Import failed:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setImportResult(null); // Clear previous results
    }
  };

  const handleImport = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to import",
        variant: "destructive",
      });
      return;
    }
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Excel File
            </CardTitle>
            <CardDescription>
              Select an Excel file containing customer savings account data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select Excel File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                Supported formats: .xlsx, .xls
              </p>
            </div>
            
            {selectedFile && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="font-medium text-blue-900">{selectedFile.name}</div>
                    <div className="text-sm text-blue-600">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Ready for import
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Import Button */}
            <Button 
              onClick={handleImport}
              disabled={importMutation.isPending || !selectedFile}
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
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Import Instructions
            </CardTitle>
            <CardDescription>
              Follow these guidelines for successful data import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Expected Excel Format:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Column headers in the first row</li>
                <li>• Full Name, ID Number, Phone Number</li>
                <li>• Email, Department (optional)</li>
                <li>• Account Balance, Account Type</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">What happens during import:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• New member profiles are created automatically</li>
                <li>• Savings accounts are set up with imported balances</li>
                <li>• Duplicate ID numbers are automatically handled</li>
                <li>• Invalid data rows are reported for review</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Results */}
      {importResult && (
        <Card className="mt-6">
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
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
              <span className="text-xs text-muted-foreground">
                {importResult.successfulImports} of {importResult.totalRows} records processed successfully
              </span>
            </div>

            {/* Statistics Cards */}
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
                          <div className="mt-1 text-xs">
                            Data: {JSON.stringify(error.data, null, 2)}
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}