import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

interface Settlement {
  id: string;
  basicSalary: string;
  pendingLeaves: string;
  bonus: string;
  otherPayable: string;
  totalPayable: string;
  noticePeriodRecovery: string;
  advanceRecovery: string;
  otherDeductions: string;
  totalDeductions: string;
  netSettlement: string;
  status: string;
  remarks: string;
  createdAt: Date;
}

export const MySettlement = () => {
  const { user } = useAuth();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettlement();
  }, [user]);

  const loadSettlement = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'settlements'),
        where('employeeId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setSettlement({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        } as Settlement);
      }
    } catch (error) {
      console.error('Error loading settlement:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    return `₹${parseFloat(value || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!settlement) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="text-4xl">💰</div>
            <h3 className="text-lg font-semibold">No Settlement Calculated</h3>
            <p className="text-muted-foreground">
              Your full & final settlement will be calculated after clearance is completed.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Full & Final Settlement</CardTitle>
          <Badge variant={settlement.status === 'completed' ? 'default' : 'outline'} className="capitalize">
            {settlement.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-3 text-green-700">Payable Components</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Basic Salary</span>
                <span className="font-medium">{formatCurrency(settlement.basicSalary)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Leaves</span>
                <span className="font-medium">{formatCurrency(settlement.pendingLeaves)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bonus</span>
                <span className="font-medium">{formatCurrency(settlement.bonus)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Other Payable</span>
                <span className="font-medium">{formatCurrency(settlement.otherPayable)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total Payable</span>
                <span className="text-green-700">{formatCurrency(settlement.totalPayable)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3 text-red-700">Deductions</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Notice Period Recovery</span>
                <span className="font-medium">{formatCurrency(settlement.noticePeriodRecovery)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Advance Recovery</span>
                <span className="font-medium">{formatCurrency(settlement.advanceRecovery)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Other Deductions</span>
                <span className="font-medium">{formatCurrency(settlement.otherDeductions)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total Deductions</span>
                <span className="text-red-700">{formatCurrency(settlement.totalDeductions)}</span>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">Net Settlement Amount</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(settlement.netSettlement)}</span>
            </div>
          </div>

          {settlement.remarks && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Remarks</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                {settlement.remarks}
              </p>
            </div>
          )}

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-sm">Payment Information</h4>
            <p className="text-sm text-muted-foreground">
              The settlement amount will be processed and credited to your registered bank account 
              within 30-45 days after your last working day and completion of all clearances.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
