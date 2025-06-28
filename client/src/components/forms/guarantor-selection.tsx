import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, UserPlus, DollarSign } from "lucide-react";
import type { Member } from "@shared/schema";

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
  disabled?: boolean;
}

export default function GuarantorSelection({ 
  guarantors, 
  onGuarantorsChange, 
  loanAmount,
  disabled = false 
}: GuarantorSelectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [guaranteeAmount, setGuaranteeAmount] = useState<string>("");

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['/api/members'],
    enabled: isDialogOpen,
  });

  // Filter out already selected guarantors and only show approved members
  const availableMembers = members.filter(member => 
    member.status === 'active' && 
    !guarantors.some(g => g.guarantorMemberId === member.id)
  );

  const totalGuaranteed = guarantors.reduce((sum, g) => sum + parseFloat(g.guaranteeAmount || '0'), 0);
  const guaranteeCoverage = loanAmount > 0 ? (totalGuaranteed / loanAmount) * 100 : 0;

  const addGuarantor = () => {
    if (!selectedMemberId || !guaranteeAmount || parseFloat(guaranteeAmount) <= 0) {
      return;
    }

    const selectedMember = members.find(m => m.id === parseInt(selectedMemberId));
    if (!selectedMember) return;

    const newGuarantor: GuarantorData = {
      guarantorMemberId: parseInt(selectedMemberId),
      guaranteeAmount,
      memberName: selectedMember.fullName || selectedMember.memberNumber,
      memberNumber: selectedMember.memberNumber,
    };

    onGuarantorsChange([...guarantors, newGuarantor]);
    
    // Reset form
    setSelectedMemberId("");
    setGuaranteeAmount("");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Guarantors ({guarantors.length})
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <strong>Note:</strong> Only approved/active SACCO members can serve as guarantors for loan applications.
                </div>
                
                <div>
                  <Label htmlFor="member">Select Member</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMembers.length === 0 ? (
                        <div className="p-2 text-sm text-slate-500">
                          No approved members available as guarantors
                        </div>
                      ) : (
                        availableMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id.toString()}>
                            {member.fullName || member.memberNumber} 
                            ({member.memberNumber})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="amount">Guarantee Amount (UGX)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={guaranteeAmount}
                    onChange={(e) => setGuaranteeAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="1000"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={addGuarantor} disabled={!selectedMemberId || !guaranteeAmount}>
                    Add Guarantor
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Guarantee Summary */}
        {loanAmount > 0 && (
          <div className="mb-4 p-4 bg-slate-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600">Loan Amount:</span>
                <div className="font-medium">UGX {loanAmount.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-slate-600">Total Guaranteed:</span>
                <div className="font-medium">UGX {totalGuaranteed.toLocaleString()}</div>
              </div>
              <div className="col-span-2">
                <span className="text-slate-600">Coverage:</span>
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

        {/* Guarantors List */}
        {guarantors.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
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
                    {guarantor.memberName || 'Unknown Member'}
                  </div>
                  <div className="text-sm text-slate-600">
                    Member: {guarantor.memberNumber}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-slate-400" />
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
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Validation Messages */}
        {guarantors.length > 0 && guaranteeCoverage < 50 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              ⚠️ Low guarantee coverage. Consider adding more guarantors or increasing guarantee amounts.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}