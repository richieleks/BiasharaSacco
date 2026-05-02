import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, UserPlus, DollarSign, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface GuarantorData {
  guarantorMemberId: number;
  guaranteeAmount: string;
  memberName?: string;
  memberNumber?: string;
}

interface GuarantorSelectionProps {
  guarantors: GuarantorData[];
  onGuarantorsChange: (guarantors: GuarantorData[]) => void;
  loanAmount: number;
  memberSavings?: number;
  disabled?: boolean;
}

export default function GuarantorSelection({ 
  guarantors, 
  onGuarantorsChange, 
  loanAmount,
  memberSavings = 0,
  disabled = false 
}: GuarantorSelectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [memberIdInput, setMemberIdInput] = useState("");
  const [guaranteeAmount, setGuaranteeAmount] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState("");
  const [validatedMemberId, setValidatedMemberId] = useState<number | null>(null);
  const [validatedMemberNumber, setValidatedMemberNumber] = useState<string>("");

  const totalGuaranteed = guarantors.reduce((sum, g) => sum + parseFloat(g.guaranteeAmount || '0'), 0);
  const amountToGuarantee = Math.max(0, loanAmount - memberSavings);
  const guaranteeCoverage = amountToGuarantee > 0 ? (totalGuaranteed / amountToGuarantee) * 100 : 100;

  const validateMember = async () => {
    const trimmed = memberIdInput.trim();
    if (!trimmed) {
      setValidationState('invalid');
      setValidationMessage('Please enter a member ID');
      setValidatedMemberId(null);
      return;
    }

    setValidationState('validating');
    setValidationMessage('');

    try {
      const res = await apiRequest('POST', '/api/guarantors/validate-member', { memberNumber: trimmed });
      const data = await res.json();

      if (data.valid) {
        const alreadyAdded = guarantors.some(g => g.guarantorMemberId === data.memberId);
        if (alreadyAdded) {
          setValidationState('invalid');
          setValidationMessage('This member has already been added as a guarantor');
          setValidatedMemberId(null);
          return;
        }

        setValidationState('valid');
        setValidationMessage('Member ID verified');
        setValidatedMemberId(data.memberId);
        setValidatedMemberNumber(data.memberNumber);
      } else {
        setValidationState('invalid');
        setValidationMessage(data.message || 'Invalid member ID');
        setValidatedMemberId(null);
      }
    } catch (error: any) {
      let msg = 'Failed to validate member ID';
      try {
        const parts = error.message?.split(': ');
        if (parts && parts.length > 1) {
          const parsed = JSON.parse(parts.slice(1).join(': '));
          msg = parsed.message || msg;
        }
      } catch {}
      setValidationState('invalid');
      setValidationMessage(msg);
      setValidatedMemberId(null);
    }
  };

  const addGuarantor = () => {
    setFormError(null);

    if (validationState !== 'valid' || !validatedMemberId) {
      setFormError("Please verify the member ID first");
      return;
    }

    if (!guaranteeAmount || parseFloat(guaranteeAmount) <= 0) {
      setFormError("Please enter a valid guarantee amount greater than 0");
      return;
    }

    const newGuarantor: GuarantorData = {
      guarantorMemberId: validatedMemberId,
      guaranteeAmount,
      memberNumber: validatedMemberNumber,
    };

    onGuarantorsChange([...guarantors, newGuarantor]);
    
    setMemberIdInput("");
    setGuaranteeAmount("");
    setFormError(null);
    setValidationState('idle');
    setValidationMessage('');
    setValidatedMemberId(null);
    setValidatedMemberNumber('');
    setIsDialogOpen(false);
  };

  const removeGuarantor = (index: number) => {
    const updated = guarantors.filter((_, i) => i !== index);
    onGuarantorsChange(updated);
  };

  const updateGuaranteeAmount = (index: number, amount: string) => {
    const updated = guarantors.map((g, i) => 
      i === index ? { ...g, guaranteeAmount: amount } : g
    );
    onGuarantorsChange(updated);
  };

  const resetDialogState = () => {
    setMemberIdInput("");
    setGuaranteeAmount("");
    setFormError(null);
    setValidationState('idle');
    setValidationMessage('');
    setValidatedMemberId(null);
    setValidatedMemberNumber('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Guarantors ({guarantors.length})
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (open) resetDialogState(); }}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                disabled={disabled}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Guarantor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Guarantor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700">
                  Enter the member ID of the person you want to add as a guarantor and click Verify.
                </div>
                
                <div className="space-y-2">
                  <Label>Member ID</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter member ID (e.g. MEM-001)"
                      value={memberIdInput}
                      onChange={(e) => {
                        setMemberIdInput(e.target.value);
                        if (validationState !== 'idle') {
                          setValidationState('idle');
                          setValidationMessage('');
                          setValidatedMemberId(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          validateMember();
                        }
                      }}
                      className={
                        validationState === 'valid' ? 'border-green-500 focus-visible:ring-green-500' :
                        validationState === 'invalid' ? 'border-red-500 focus-visible:ring-red-500' : ''
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={validateMember}
                      disabled={validationState === 'validating' || !memberIdInput.trim()}
                    >
                      {validationState === 'validating' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </div>
                  {validationMessage && (
                    <div className={`flex items-center gap-1.5 text-sm ${
                      validationState === 'valid' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {validationState === 'valid' ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      )}
                      {validationMessage}
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="amount">Guarantee Amount (UGX)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={guaranteeAmount}
                    onChange={(e) => setGuaranteeAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="1000"
                  />
                </div>

                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={addGuarantor} disabled={validationState !== 'valid'}>
                    Add Guarantor
                  </Button>
                  <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetDialogState(); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loanAmount > 0 && (
          <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600 dark:text-slate-300">Loan Amount:</span>
                <div className="font-medium">{formatCurrency(loanAmount)}</div>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300">Member Savings:</span>
                <div className="font-medium text-emerald-700">{formatCurrency(memberSavings)}</div>
              </div>
              <div>
                <span className="text-blue-900 font-medium">Amount to Guarantee:</span>
                <div className="font-bold text-blue-900">{formatCurrency(amountToGuarantee)}</div>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300">Total Guaranteed:</span>
                <div className="font-medium">{formatCurrency(totalGuaranteed)}</div>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-600 dark:text-slate-300">Coverage:</span>
                <div className="flex items-center gap-2">
                  <div className="font-medium">{guaranteeCoverage.toFixed(1)}%</div>
                  <Badge variant={guaranteeCoverage >= 100 ? "default" : "secondary"}>
                    {guaranteeCoverage >= 100 ? "Full Coverage" : "Partial Coverage"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {guarantors.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <UserPlus className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No guarantors added yet</p>
            <p className="text-sm">Add guarantors to proceed with loan application</p>
          </div>
        ) : (
          <div className="space-y-3">
            {guarantors.map((guarantor, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {guarantor.memberNumber || 'Unknown Member'}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Input
                      type="number"
                      value={guarantor.guaranteeAmount}
                      onChange={(e) => updateGuaranteeAmount(index, e.target.value)}
                      className="w-32 h-8"
                      placeholder="Amount"
                      min="0"
                      step="1000"
                      disabled={disabled}
                    />
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGuarantor(index)}
                    disabled={disabled}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:bg-red-950/50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {guarantors.length > 0 && guaranteeCoverage < 50 && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-700">
              Low guarantee coverage. Consider adding more guarantors or increasing guarantee amounts.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}