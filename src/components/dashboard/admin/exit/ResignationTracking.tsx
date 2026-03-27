import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, Timestamp, getDoc, where } from 'firebase/firestore';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { UserMinus, Plus, Calendar, FileText, Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface Resignation {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  resignationDate: string;
  lastWorkingDay: string;
  noticePeriod: number;
  reason: string;
  status: 'submitted' | 'approved' | 'in-clearance' | 'completed';
  remarks: string;
  createdAt: Date;
}

export const ResignationTracking = () => {
  const { organizationId } = useAuth();
  const [resignations, setResignations] = useState<Resignation[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    resignationDate: '',
    lastWorkingDay: '',
    noticePeriod: 30,
    reason: '',
    remarks: ''
  });

  useEffect(() => {
    fetchResignations();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      let employeesSnapshot;
      if (organizationId) {
        const q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
        employeesSnapshot = await getDocs(q);
      } else {
        employeesSnapshot = await getDocs(collection(db, 'employees'));
      }
      const employeesList = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmployees(employeesList);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchResignations = async () => {
    try {
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'resignations'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(collection(db, 'resignations'), orderBy('createdAt', 'desc'));
      }
      const snapshot = await getDocs(q);
      
      const data = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const resignationData = docSnapshot.data() as any;
          let department = resignationData.department;
          let designation = resignationData.designation;
          
          if (!department || !designation) {
            try {
              const employeeDoc = await getDoc(doc(db, 'employees', resignationData.employeeId));
              if (employeeDoc.exists()) {
                const empData = employeeDoc.data();
                department = department || empData.department || 'N/A';
                designation = designation || empData.designation || 'N/A';
                
                await updateDoc(doc(db, 'resignations', docSnapshot.id), {
                  department: department,
                  designation: designation
                });
              }
            } catch (error) {
              console.error('Error fetching employee data for resignation:', error);
            }
          }
          
          return {
            id: docSnapshot.id,
            ...resignationData,
            department: department || 'N/A',
            designation: designation || 'N/A',
            createdAt: resignationData.createdAt?.toDate() || new Date()
          };
        })
      ) as Resignation[];
      
      setResignations(data);
    } catch (error) {
      console.error('Error fetching resignations:', error);
      toast.error('Failed to fetch resignations');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedEmployee = employees.find(emp => emp.id === formData.employeeId);
      
      if (!selectedEmployee) {
        toast.error('Employee not found');
        return;
      }

      await addDoc(collection(db, 'resignations'), {
        employeeId: formData.employeeId,
        employeeName: selectedEmployee.name,
        employeeCode: selectedEmployee.employeeCode,
        department: selectedEmployee.department || 'N/A',
        designation: selectedEmployee.designation || 'N/A',
        resignationDate: formData.resignationDate,
        lastWorkingDay: formData.lastWorkingDay,
        noticePeriod: formData.noticePeriod,
        reason: formData.reason,
        status: 'submitted',
        remarks: formData.remarks,
        createdAt: Timestamp.now()
      });

      toast.success('Resignation recorded successfully');
      setIsDialogOpen(false);
      setFormData({
        employeeId: '',
        resignationDate: '',
        lastWorkingDay: '',
        noticePeriod: 30,
        reason: '',
        remarks: ''
      });
      fetchResignations();
    } catch (error) {
      console.error('Error recording resignation:', error);
      toast.error('Failed to record resignation');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: Resignation['status']) => {
    try {
      await updateDoc(doc(db, 'resignations', id), {
        status: newStatus
      });
      toast.success('Status updated successfully');
      fetchResignations();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status: Resignation['status']) => {
    const statusConfig = {
      'submitted': { label: 'Submitted', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      'approved': { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
      'in-clearance': { label: 'In Clearance', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
      'completed': { label: 'Completed', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' }
    };
    
    const config = statusConfig[status] || { label: 'Unknown', className: 'bg-gray-100 text-gray-700' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const stats = [
    { 
      label: 'Total Resignations', 
      value: resignations.length, 
      icon: Users, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      label: 'Pending Approval', 
      value: resignations.filter(r => r.status === 'submitted').length, 
      icon: Clock, 
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    },
    { 
      label: 'In Progress', 
      value: resignations.filter(r => r.status === 'approved' || r.status === 'in-clearance').length, 
      icon: AlertCircle, 
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    { 
      label: 'Completed', 
      value: resignations.filter(r => r.status === 'completed').length, 
      icon: CheckCircle2, 
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Resignation Tracking</h3>
          <p className="text-sm text-muted-foreground">Track and manage employee resignations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Record Resignation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserMinus className="h-5 w-5 text-primary" />
                Record Employee Resignation
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="employee">Employee *</Label>
                  <SearchableEmployeeSelect
                    employees={employees.map(emp => ({ id: emp.id, name: emp.name, employeeCode: emp.employeeCode }))}
                    value={formData.employeeId}
                    onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                    placeholder="Select employee"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="resignationDate">Resignation Date *</Label>
                  <Input
                    id="resignationDate"
                    type="date"
                    value={formData.resignationDate}
                    onChange={(e) => setFormData({ ...formData, resignationDate: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="lastWorkingDay">Last Working Day *</Label>
                  <Input
                    id="lastWorkingDay"
                    type="date"
                    value={formData.lastWorkingDay}
                    onChange={(e) => setFormData({ ...formData, lastWorkingDay: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="noticePeriod">Notice Period (Days) *</Label>
                  <Input
                    id="noticePeriod"
                    type="number"
                    value={formData.noticePeriod}
                    onChange={(e) => setFormData({ ...formData, noticePeriod: parseInt(e.target.value) })}
                    className="mt-1.5"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="reason">Reason for Resignation *</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Enter reason for resignation"
                    className="mt-1.5"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Additional remarks (optional)"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Recording...' : 'Record Resignation'}
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
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
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
            <div className="min-w-[800px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Resignation Date</TableHead>
                    <TableHead className="font-semibold">Last Working Day</TableHead>
                    <TableHead className="font-semibold">Notice Period</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resignations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <UserMinus className="h-8 w-8" />
                          <p>No resignations recorded</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    resignations.map((resignation) => (
                      <TableRow key={resignation.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{resignation.employeeName}</TableCell>
                        <TableCell>{resignation.employeeCode}</TableCell>
                        <TableCell>{resignation.department || 'N/A'}</TableCell>
                        <TableCell>{(resignation as any).submissionDate || resignation.resignationDate || 'N/A'}</TableCell>
                        <TableCell>{(resignation as any).lastWorkingDate || resignation.lastWorkingDay || 'N/A'}</TableCell>
                        <TableCell>{resignation.noticePeriod} days</TableCell>
                        <TableCell>{getStatusBadge(resignation.status)}</TableCell>
                        <TableCell>
                          <Select
                            value={resignation.status}
                            onValueChange={(value) => updateStatus(resignation.id, value as Resignation['status'])}
                          >
                            <SelectTrigger className="w-[130px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="in-clearance">In Clearance</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
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
