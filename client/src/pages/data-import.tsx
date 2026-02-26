import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Users, PiggyBank, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useRBAC } from "@/hooks/useRBAC";

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
  importedLoans?: number;
}

export default function DataImport() {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'members' | 'savings' | 'loans'>('members');
  const [createNewMembers, setCreateNewMembers] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useRBAC();

  const canImport = hasPermission('update', 'system-settings');

  useEffect(() => {
    if (!canImport) {
      toast({
        title: "Access Denied",
        description: "Only administrators can access the data import functionality.",
        variant: "destructive",
      });
    }
  }, [canImport, toast]);

  const importMutation = useMutation({
    mutationFn: async (): Promise<ImportResult> => {
      if (!selectedFile) {
        throw new Error('Please select a file to import');
      }
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('createNewMembers', createNewMembers.toString());
      
      const endpoint = importType === 'members' ? '/api/import/members' : importType === 'savings' ? '/api/import/savings' : '/api/import/loans';
      const response = await fetch(endpoint, {
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
        const successMessage = importType === 'members'
          ? `Successfully imported ${data.importedMembers} members and ${data.importedAccounts} savings accounts.`
          : importType === 'savings' 
          ? `Successfully imported ${data.importedMembers} members and ${data.importedAccounts} savings accounts.`
          : `Successfully imported ${data.importedLoans || 0} loans, ${data.importedMembers} members, and ${data.importedAccounts} savings accounts.`;
        
        toast({
          title: "Import Successful",
          description: successMessage,
        });
      } else if (data) {
        toast({
          title: "Import Completed with Errors",
          description: `Imported ${data.successfulImports} records with ${data.errors?.length || 0} errors.`,
          variant: "destructive",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/savings-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
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
      if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
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

  const handleReset = () => {
    setImportResult(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportTypeChange = (type: 'members' | 'savings' | 'loans') => {
    setImportType(type);
    handleReset();
  };

  const progressPercentage = importResult && importResult.totalRows > 0 ? 
    Math.round((importResult.successfulImports / importResult.totalRows) * 100) : 0;

  if (!canImport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Shield className="h-16 w-16 text-red-500" />
        <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
        <p className="text-slate-500 text-center max-w-md">
          Only administrators have permission to access the data import functionality. 
          Contact your system administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-container animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center flex-wrap gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Data Import
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200/50">Admin Only</Badge>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Import customer data from Excel files</p>
      </div>

      {/* Import Type Selection */}
      <div className="section-card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Import Type</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Choose the type of data you want to import
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => handleImportTypeChange('members')}
              className={`p-4 rounded-lg border-2 transition-all ${
                importType === 'members'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className={`h-6 w-6 ${importType === 'members' ? 'text-blue-600' : 'text-gray-500'}`} />
                <div className="text-left">
                  <div className="font-semibold">Members</div>
                  <div className="text-sm text-muted-foreground">Import member registration data</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleImportTypeChange('savings')}
              className={`p-4 rounded-lg border-2 transition-all ${
                importType === 'savings'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <PiggyBank className={`h-6 w-6 ${importType === 'savings' ? 'text-blue-600' : 'text-gray-500'}`} />
                <div className="text-left">
                  <div className="font-semibold">Savings Accounts</div>
                  <div className="text-sm text-muted-foreground">Import savings data and transactions</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => handleImportTypeChange('loans')}
              className={`p-4 rounded-lg border-2 transition-all ${
                importType === 'loans'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className={`h-6 w-6 ${importType === 'loans' ? 'text-blue-600' : 'text-gray-500'}`} />
                <div className="text-left">
                  <div className="font-semibold">Loan Statements</div>
                  <div className="text-sm text-muted-foreground">Import loan data and information</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Upload Card */}
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Excel File
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {importType === 'members'
                ? 'Select an Excel file containing member registration data'
                : importType === 'savings' 
                ? 'Select an Excel file containing customer savings account data'
                : 'Select an Excel file containing loan statement data'
              }
            </p>
          </div>
          <div className="p-6 space-y-4">
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

            {importType === 'savings' && (
              <div className="flex items-start space-x-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <Checkbox
                  id="createNewMembers"
                  checked={createNewMembers}
                  onCheckedChange={(checked) => setCreateNewMembers(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="createNewMembers" className="text-sm font-medium cursor-pointer">
                    Create new members automatically
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {createNewMembers 
                      ? "New member profiles will be created for accounts not found in the system."
                      : "Only existing members will be matched. Accounts without a matching member will be skipped."
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Import Button */}
            <Button 
              onClick={handleImport}
              disabled={importMutation.isPending || !selectedFile}
              className="w-full rounded-xl"
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
          </div>
        </div>

        {/* Instructions Card */}
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Import Instructions
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Follow these guidelines for successful data import
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <h4 className="font-medium mb-2">
                {importType === 'members' ? 'Members Import Format:' : importType === 'savings' ? 'Savings Import Format:' : 'Loan Import Format:'}
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {importType === 'members' ? (
                  <>
                    <li>• Column headers in the first row</li>
                    <li>• Name, ID Number, Date of Birth, Gender</li>
                    <li>• Address, Phone, Marital Status</li>
                    <li>• Department, Section, Terms of Service</li>
                    <li>• Net Pay, Staff Account, Next of Kin</li>
                    <li>• Monthly Savings, Account Number, Branch</li>
                    <li>• Shares, Beneficiary details</li>
                  </>
                ) : importType === 'savings' ? (
                  <>
                    <li>• Column headers in the first row</li>
                    <li>• Full Name, ID Number, Phone Number</li>
                    <li>• Email, Department (optional)</li>
                    <li>• Account Balance, Account Type</li>
                  </>
                ) : (
                  <>
                    <li>• Account Name and Number in header rows</li>
                    <li>• Transaction history with posting dates</li>
                    <li>• Details, amounts, principal, interest columns</li>
                    <li>• Balance tracking throughout statement</li>
                  </>
                )}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">What happens during import:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {importType === 'members' ? (
                  <>
                    <li>• New member profiles are created from each row</li>
                    <li>• Duplicates detected by ID, Staff Account, or Bank Account</li>
                    <li>• Savings accounts created for members with deposit amounts</li>
                    <li>• Member numbers assigned automatically (BCS prefix)</li>
                  </>
                ) : importType === 'savings' ? (
                  <>
                    <li>• New member profiles are created automatically</li>
                    <li>• Savings accounts are set up with imported balances</li>
                    <li>• Duplicate ID numbers are automatically handled</li>
                    <li>• Invalid data rows are reported for review</li>
                  </>
                ) : (
                  <>
                    <li>• Member profiles created from loan account names</li>
                    <li>• Loan records generated from statement data</li>
                    <li>• Savings accounts created automatically for loans</li>
                    <li>• Transaction history imported and processed</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Import Results */}
      {importResult && (
        <div className="section-card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              Import Results
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Results from importing savings account data
            </p>
          </div>
          <div className="p-6 space-y-4">
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
          </div>
        </div>
      )}
    </div>
  );
}
