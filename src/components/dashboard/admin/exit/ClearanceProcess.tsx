import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { CheckCircle, XCircle, Clock, Plus, Users, AlertCircle, CheckCircle2, Building } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ClearanceItem {
  department: string;
  status: 'pending' | 'approved' | 'rejected';
  clearedBy: string;
  clearedDate: string;
  remarks: string;
}

interface Clearance {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  items: ClearanceItem[];
  overallStatus: 'in-progress' | 'completed' | 'rejected';
  createdAt: Date;
}

export const ClearanceProcess = () => {
  const { organizationId } = useAuth();
  const [clearances, setClearances] = useState<Clearance[]>([]);
  const [resignations, setResignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClearance, setSelectedClearance] = useState<Clearance | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  useEffect(() => {
    fetchDepartments();
    fetchClearances();
    fetchResignations();
  }, []);

  const fetchDepartments = async () => {
    try {
      let snapshot;
      if (organizationId) {
        const q = query(collection(db, 'departments'), where('organizationId', '==', organizationId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'departments'));
      }
      const deptNames = snapshot.docs.map(doc => doc.data().name || '').filter(name => name);
      setDepartments(deptNames);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to fetch departments');
    }
  };

  const fetchResignations = async () => {
    try {
      let snapshot;
      if (organizationId) {
        const q = query(collection(db, 'resignations'), where('organizationId', '==', organizationId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'resignations'));
      }
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResignations(data.filter((r: any) => r.status === 'approved' || r.status === 'in-clearance'));
    } catch (error) {
      console.error('Error fetching resignations:', error);
    }
  };

  const fetchClearances = async () => {
    try {
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'clearances'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(collection(db, 'clearances'), orderBy('createdAt', 'desc'));
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
        createdAt: (doc.data() as any).createdAt?.toDate() || new Date()
      })) as Clearance[];
      setClearances(data);
    } catch (error) {
      console.error('Error fetching clearances:', error);
      toast.error('Failed to fetch clearances');
    }
  };

  const handleInitiateClearance = async () => {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    if (departments.length === 0) {
      toast.error('No departments found. Please add departments first.');
      return;
    }

    setLoading(true);
    try {
      const selectedResignation = resignations.find(r => r.employeeId === selectedEmployeeId);
      
      if (!selectedResignation) {
        toast.error('Resignation not found');
        return;
      }

      const initialItems: ClearanceItem[] = departments.map(dept => ({
        department: dept,
        status: 'pending',
        clearedBy: '',
        clearedDate: '',
        remarks: ''
      }));

      await addDoc(collection(db, 'clearances'), {
        employeeId: selectedEmployeeId,
        employeeName: selectedResignation.employeeName,
        employeeCode: selectedResignation.employeeCode,
        items: initialItems,
        overallStatus: 'in-progress',
        createdAt: Timestamp.now()
      });

      const resignationDoc = resignations.find(r => r.employeeId === selectedEmployeeId);
      if (resignationDoc) {
        await updateDoc(doc(db, 'resignations', resignationDoc.id), {
          status: 'in-clearance'
        });
      }

      toast.success('Clearance process initiated successfully');
      setIsDialogOpen(false);
      setSelectedEmployeeId('');
      fetchClearances();
      fetchResignations();
    } catch (error) {
      console.error('Error initiating clearance:', error);
      toast.error('Failed to initiate clearance');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClearance = async (clearanceId: string, itemIndex: number, updatedItem: ClearanceItem) => {
    if (!selectedClearance) return;

    setLoading(true);
    try {
      const updatedItems = [...selectedClearance.items];
      updatedItems[itemIndex] = {
        ...updatedItem,
        clearedDate: new Date().toISOString()
      };

      const allApproved = updatedItems.every(item => item.status === 'approved');
      const anyRejected = updatedItems.some(item => item.status === 'rejected');
      
      const overallStatus = anyRejected ? 'rejected' : 
                           allApproved ? 'completed' : 'in-progress';

      await updateDoc(doc(db, 'clearances', clearanceId), {
        items: updatedItems,
        overallStatus
      });

      toast.success('Clearance updated successfully');
      fetchClearances();
      setEditDialogOpen(false);
      setSelectedClearance(null);
    } catch (error) {
      console.error('Error updating clearance:', error);
      toast.error('Failed to update clearance');
    } finally {
      setLoading(false);
    }
  };

  const getClearanceProgress = (items: ClearanceItem[]) => {
    const approved = items.filter(item => item.status === 'approved').length;
    return (approved / items.length) * 100;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      'in-progress': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      'completed': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      'rejected': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };
    return <Badge className={config[status] || 'bg-gray-100 text-gray-700'}>{status}</Badge>;
  };

  const stats = [
    { label: 'Total Clearances', value: clearances.length, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'In Progress', value: clearances.filter(c => c.overallStatus === 'in-progress').length, icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: 'Completed', value: clearances.filter(c => c.overallStatus === 'completed').length, icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: 'Departments', value: departments.length, icon: Building, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Clearance Process</h3>
          <p className="text-sm text-muted-foreground">Manage departmental clearances for exiting employees</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Initiate Clearance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Initiate Clearance Process
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Employee</Label>
                <SearchableEmployeeSelect
                  employees={resignations.map(res => ({ id: res.employeeId, name: res.employeeName, employeeCode: res.employeeCode }))}
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                  placeholder="Choose employee"
                  className="mt-1.5"
                />
              </div>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                This will create a clearance checklist for all {departments.length} departments.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInitiateClearance} disabled={loading}>
                  {loading ? 'Initiating...' : 'Initiate Clearance'}
                </Button>
              </div>
            </div>
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
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clearance Cards */}
      <div className="grid gap-4">
        {clearances.length === 0 ? (
          <Card className="border">
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No clearance processes initiated</p>
            </CardContent>
          </Card>
        ) : (
          clearances.map((clearance) => (
            <Card key={clearance.id} className="border shadow-sm">
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-foreground">{clearance.employeeName}</h4>
                      <p className="text-sm text-muted-foreground">{clearance.employeeCode}</p>
                    </div>
                    {getStatusBadge(clearance.overallStatus)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Clearance Progress</span>
                      <span className="font-medium">{Math.round(getClearanceProgress(clearance.items))}%</span>
                    </div>
                    <Progress value={getClearanceProgress(clearance.items)} className="h-2" />
                  </div>

                  <Card className="border bg-muted/30">
                    <CardContent className="p-0">
                      <ScrollArea className="w-full">
                        <div className="min-w-[600px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="font-semibold">Department</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                                <TableHead className="font-semibold">Cleared By</TableHead>
                                <TableHead className="font-semibold">Date</TableHead>
                                <TableHead className="font-semibold">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {clearance.items.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{item.department}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {item.status === 'approved' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                                      {item.status === 'rejected' && <XCircle className="h-4 w-4 text-red-500" />}
                                      {item.status === 'pending' && <Clock className="h-4 w-4 text-amber-500" />}
                                      <span className="capitalize text-sm">{item.status}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">{item.clearedBy || '-'}</TableCell>
                                  <TableCell className="text-sm">
                                    {item.clearedDate ? new Date(item.clearedDate).toLocaleDateString() : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedClearance(clearance);
                                        setEditDialogOpen(true);
                                      }}
                                    >
                                      Update
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Clearance Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Update Clearance Status
            </DialogTitle>
          </DialogHeader>
          {selectedClearance && (
            <div className="space-y-4">
              {selectedClearance.items.map((item, index) => (
                <Card key={index} className="border">
                  <CardContent className="pt-5 space-y-3">
                    <h4 className="font-semibold text-foreground">{item.department}</h4>
                    <div className="grid gap-3">
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={item.status}
                          onValueChange={(value: any) => {
                            const updated = { ...item, status: value };
                            handleUpdateClearance(selectedClearance.id, index, updated);
                          }}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Cleared By</Label>
                        <Input
                          value={item.clearedBy}
                          onChange={(e) => {
                            const updatedItems = [...selectedClearance.items];
                            updatedItems[index] = { ...item, clearedBy: e.target.value };
                            setSelectedClearance({ ...selectedClearance, items: updatedItems });
                          }}
                          className="mt-1.5"
                          placeholder="Enter name"
                        />
                      </div>
                      <div>
                        <Label>Remarks</Label>
                        <Textarea
                          value={item.remarks}
                          onChange={(e) => {
                            const updatedItems = [...selectedClearance.items];
                            updatedItems[index] = { ...item, remarks: e.target.value };
                            setSelectedClearance({ ...selectedClearance, items: updatedItems });
                          }}
                          className="mt-1.5"
                          placeholder="Additional remarks"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
