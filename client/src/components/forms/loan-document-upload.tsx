import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader2, Download, ShieldCheck, FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { LoanDocument } from "@shared/schema";

interface LoanDocumentUploadProps {
  loanId: number;
  guarantors?: Array<{ id: number; guarantorMemberId: number; memberName?: string; full_name?: string }>;
  onComplete?: () => void;
  requiresGuarantors?: boolean;
}

const DOC_TYPES = [
  { key: "loan_application", label: "Signed Loan Application", icon: FileText, description: "Upload your signed loan application document" },
  { key: "provident_commitment", label: "Signed Provident Commitment", icon: ShieldCheck, description: "Upload your signed provident fund commitment document" },
] as const;

export default function LoanDocumentUpload({ loanId, guarantors = [], onComplete, requiresGuarantors = false }: LoanDocumentUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadingGuarantorId, setUploadingGuarantorId] = useState<number | null>(null);

  const { data: documents = [], isLoading } = useQuery<LoanDocument[]>({
    queryKey: ['/api/loans', loanId, 'documents'],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/documents`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, documentType, guarantorId }: { file: File; documentType: string; guarantorId?: number }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      if (guarantorId) formData.append('guarantorId', guarantorId.toString());

      const res = await fetch(`/api/loans/${loanId}/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans', loanId, 'documents'] });
      toast({ title: "Uploaded", description: "Document uploaded successfully", variant: "success" as any });
      setUploadingType(null);
      setUploadingGuarantorId(null);
    },
    onError: (err: any) => {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      setUploadingType(null);
      setUploadingGuarantorId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`/api/loans/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans', loanId, 'documents'] });
      toast({ title: "Deleted", description: "Document removed", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleUpload = (documentType: string, guarantorId?: number) => {
    setUploadingType(documentType);
    setUploadingGuarantorId(guarantorId || null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingType) return;
    uploadMutation.mutate({
      file,
      documentType: uploadingType,
      guarantorId: uploadingGuarantorId || undefined,
    });
    e.target.value = '';
  };

  const getDocForType = (type: string, guarantorId?: number) => {
    return documents.find(d =>
      d.documentType === type &&
      (guarantorId ? d.guarantorId === guarantorId : !d.guarantorId)
    );
  };

  const applicationDoc = getDocForType('loan_application');
  const providentDoc = getDocForType('provident_commitment');
  const requiredDocsComplete = !!applicationDoc && !!providentDoc;

  const guarantorDocsComplete = !requiresGuarantors || guarantors.length === 0 ||
    guarantors.every(g => getDocForType('guarantor_guarantee', g.id));

  const allDocsComplete = requiredDocsComplete && guarantorDocsComplete;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFileSelected}
      />

      <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="font-medium text-sm text-blue-800 dark:text-blue-300 mb-1">Required Documents</h4>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Upload signed copies of the required documents. Accepted formats: PDF, Word documents, JPEG, or PNG (max 10MB each).
        </p>
      </div>

      {DOC_TYPES.map(({ key, label, icon: Icon, description }) => {
        const existingDoc = getDocForType(key);
        return (
          <Card key={key} className={existingDoc ? "border-green-300 dark:border-green-700" : "border-dashed border-2"}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${existingDoc ? "bg-green-100 dark:bg-green-900/40" : "bg-slate-100 dark:bg-slate-800"}`}>
                    <Icon className={`h-5 w-5 ${existingDoc ? "text-green-600" : "text-slate-500"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{label}</span>
                      {existingDoc ? (
                        <Badge variant="default" className="bg-green-600 text-xs">Uploaded</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Required</Badge>
                      )}
                    </div>
                    {existingDoc ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{existingDoc.originalName}</p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {existingDoc ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/api/loans/documents/${existingDoc.id}/download`, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => deleteMutation.mutate(existingDoc.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpload(key)}
                      disabled={uploadMutation.isPending}
                    >
                      {uploadMutation.isPending && uploadingType === key ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      Upload
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {requiresGuarantors && guarantors.length > 0 && (
        <>
          <div className="mt-6 mb-2">
            <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Guarantor Documents
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Upload signed guarantee documents for each guarantor.
            </p>
          </div>
          {guarantors.map((g) => {
            const existingDoc = getDocForType('guarantor_guarantee', g.id);
            const gName = g.memberName || g.full_name || (g.guarantorMember?.user ? `${g.guarantorMember.user.firstName} ${g.guarantorMember.user.lastName}` : `Guarantor #${g.id}`);
            return (
              <Card key={g.id} className={existingDoc ? "border-green-300 dark:border-green-700" : "border-dashed border-2"}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${existingDoc ? "bg-green-100 dark:bg-green-900/40" : "bg-slate-100 dark:bg-slate-800"}`}>
                        <FileCheck className={`h-5 w-5 ${existingDoc ? "text-green-600" : "text-slate-500"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">Guarantee - {gName}</span>
                          {existingDoc ? (
                            <Badge variant="default" className="bg-green-600 text-xs">Uploaded</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-slate-500">Optional</Badge>
                          )}
                        </div>
                        {existingDoc ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{existingDoc.originalName}</p>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Signed guarantee document from {gName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {existingDoc ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/api/loans/documents/${existingDoc.id}/download`, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => deleteMutation.mutate(existingDoc.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpload('guarantor_guarantee', g.id)}
                          disabled={uploadMutation.isPending}
                        >
                          {uploadMutation.isPending && uploadingType === 'guarantor_guarantee' && uploadingGuarantorId === g.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Upload className="h-4 w-4 mr-1" />
                          )}
                          Upload
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {allDocsComplete && (
        <div className="p-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm text-green-800 dark:text-green-300">All required documents uploaded</p>
            <p className="text-xs text-green-600 dark:text-green-400">You can proceed to the next step.</p>
          </div>
        </div>
      )}

      {!requiredDocsComplete && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm text-amber-800 dark:text-amber-300">Required documents pending</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Please upload the signed loan application and provident commitment documents.
            </p>
          </div>
        </div>
      )}

      {onComplete && (
        <Button
          onClick={onComplete}
          className="w-full"
          disabled={!requiredDocsComplete}
        >
          {requiredDocsComplete ? "Continue" : "Upload Required Documents to Continue"}
        </Button>
      )}
    </div>
  );
}
