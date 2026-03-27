import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { DollarSign, Plus, TrendingUp, TrendingDown, Wallet, CheckCircle2 } from 'lucide-react';

interface Settlement {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  salaryDue: number;
  leaveEncashment: number;
  bonus: number;
  gratuity: number;
  noticePeriodRecovery: number;
  otherRecoveries: number;
  otherPayments: number;
  totalPayable: number;
  totalDeductions: number;
  netSettlement: number;
  status: 'draft' | 'approved' | 'paid';
  remarks: string;
  createdAt: Date;
}

export const FullFinalSettlement = () => {
  const { organizationId } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [clearances, setClearances] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    salaryDue: 0,
    leaveEncashment: 0,
    bonus: 0,
    gratuity: 0,
    noticePeriodRecovery: 0,
    otherRecoveries: 0,
    otherPayments: 0,
    remarks: ''
  });

  useEffect(() => {
    fetchSettlements();
    fetchClearances();
  }, []);

  const fetchClearances = async () => {
    try {
      let snapshot;
      if (organizationId) {
        const q = query(collection(db, 'clearances'), where('organizationId', '==', organizationId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'clearances'));
      }
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClearances(data.filter((c: any) => c.overallStatus === 'completed'));
    } catch (error) {
      console.error('Error fetching clearances:', error);
    }
  };

  const fetchSettlements = async () => {
    try {
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'settlements'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(collection(db, 'settlements'), orderBy('createdAt', 'desc'));
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
        createdAt: (doc.data() as any).createdAt?.toDate() || new Date()
      })) as Settlement[];
      setSettlements(data);
    } catch (error) {
      console.error('Error fetching settlements:', error);
      toast.error('Failed to fetch settlements');
    }
  };

  const calculateSettlement = () => {
    const totalPayable = 
      Number(formData.salaryDue) + 
      Number(formData.leaveEncashment) + 
      Number(formData.bonus) + 
      Number(formData.gratuity) + 
      Number(formData.otherPayments);
    
    const totalDeductions = 
      Number(formData.noticePeriodRecovery) + 
      Number(formData.otherRecoveries);
    
    const netSettlement = totalPayable - totalDeductions;
    
    return { totalPayable, totalDeductions, netSettlement };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedClearance = clearances.find(c => c.employeeId === formData.employeeId);
      
      if (!selectedClearance) {
        toast.error('Clearance not found');
        return;
      }

      const { totalPayable, totalDeductions, netSettlement } = calculateSettlement();

      await addDoc(collection(db, 'settlements'), {
        ...formData,
        employeeName: selectedClearance.employeeName,
        employeeCode: selectedClearance.employeeCode,
        totalPayable,
        totalDeductions,
        netSettlement,
        status: 'draft',
        createdAt: Timestamp.now()
      });

      toast.success('Settlement calculated successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchSettlements();
    } catch (error) {
      console.error('Error calculating settlement:', error);
      toast.error('Failed to calculate settlement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      salaryDue: 0,
      leaveEncashment: 0,
      bonus: 0,
      gratuity: 0,
      noticePeriodRecovery: 0,
      otherRecoveries: 0,
      otherPayments: 0,
      remarks: ''
    });
  };

  const { totalPayable, totalDeductions, netSettlement } = calculateSettlement();

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      'draft': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      'approved': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'paid': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    };
    return <Badge className={config[status] || 'bg-gray-100 text-gray-700'}>{status}</Badge>;
  };

  const totalSettlementAmount = settlements.reduce((acc, s) => acc + s.netSettlement, 0);
  const totalPaid = settlements.filter(s => s.status === 'paid').reduce((acc, s) => acc + s.netSettlement, 0);

  const stats = [
    { label: 'Total Settlements', value: settlements.length, icon: DollarSign, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'Total Amount', value: `₹${totalSettlementAmount.toLocaleString()}`, icon: Wallet, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { label: 'Paid Amount', value: `₹${totalPaid.toLocaleString()}`, icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: 'Pending', value: settlements.filter(s => s.status !== 'paid').length, icon: TrendingUp, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Full & Final Settlement</h3>
          <p className="text-sm text-muted-foreground">Calculate and manage employee settlements</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Calculate Settlement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Full & Final Settlement Calculation
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="employee">Employee *</Label>
                <SearchableEmployeeSelect
                  employees={clearances.map(c => ({ id: c.employeeId, name: c.employeeName, employeeCode: c.employeeCode }))}
                  value={formData.employeeId}
                  onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                  placeholder="Select employee"
                  className="mt-1.5"
                />
              </div>

              <Card className="border bg-emerald-50/50 dark:bg-emerald-900/10">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">Payable Components</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="salaryDue" className="text-sm">Salary Due</Label>
                      <Input
                        id="salaryDue"
                        type="number"
                        step="0.01"
                        value={formData.salaryDue}
                        onChange={(e) => setFormData({ ...formData, salaryDue: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="leaveEncashment" className="text-sm">Leave Encashment</Label>
                      <Input
                        id="leaveEncashment"
                        type="number"
                        step="0.01"
                        value={formData.leaveEncashment}
                        onChange={(e) => setFormData({ ...formData, leaveEncashment: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bonus" className="text-sm">Bonus</Label>
                      <Input
                        id="bonus"
                        type="number"
                        step="0.01"
                        value={formData.bonus}
                        onChange={(e) => setFormData({ ...formData, bonus: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gratuity" className="text-sm">Gratuity</Label>
                      <Input
                        id="gratuity"
                        type="number"
                        step="0.01"
                        value={formData.gratuity}
                        onChange={(e) => setFormData({ ...formData, gratuity: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="otherPayments" className="text-sm">Other Payments</Label>
                      <Input
                        id="otherPayments"
                        type="number"
                        step="0.01"
                        value={formData.otherPayments}
                        onChange={(e) => setFormData({ ...formData, otherPayments: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-red-50/50 dark:bg-red-900/10">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <h4 className="font-semibold text-red-700 dark:text-red-400">Deductions</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="noticePeriodRecovery" className="text-sm">Notice Period Recovery</Label>
                      <Input
                        id="noticePeriodRecovery"
                        type="number"
                        step="0.01"
                        value={formData.noticePeriodRecovery}
                        onChange={(e) => setFormData({ ...formData, noticePeriodRecovery: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="otherRecoveries" className="text-sm">Other Recoveries</Label>
                      <Input
                        id="otherRecoveries"
                        type="number"
                        step="0.01"
                        value={formData.otherRecoveries}
                        onChange={(e) => setFormData({ ...formData, otherRecoveries: parseFloat(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-muted/50">
                <CardContent className="pt-5">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Payable:</span>
                      <span className="text-emerald-600 font-semibold">₹{totalPayable.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Deductions:</span>
                      <span className="text-red-600 font-semibold">₹{totalDeductions.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-lg">
                      <span className="font-bold">Net Settlement:</span>
                      <span className="font-bold text-primary">₹{netSettlement.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Additional remarks"
                  className="mt-1.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Settlement'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, index) => (
          <Card key={index} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[700px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="font-semibold">Total Payable</TableHead>
                    <TableHead className="font-semibold">Deductions</TableHead>
                    <TableHead className="font-semibold">Net Settlement</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <DollarSign className="h-8 w-8" />
                          <p>No settlements calculated</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    settlements.map((settlement) => (
                      <TableRow key={settlement.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{settlement.employeeName}</TableCell>
                        <TableCell>{settlement.employeeCode}</TableCell>
                        <TableCell className="text-emerald-600 font-medium">₹{settlement.totalPayable.toFixed(2)}</TableCell>
                        <TableCell className="text-red-600 font-medium">₹{settlement.totalDeductions.toFixed(2)}</TableCell>
                        <TableCell className="font-bold">₹{settlement.netSettlement.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
