import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Plus, Edit, Trash2, Users, Timer, UserCog } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Shift {
  id: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string;
  isDefault?: boolean;
  organizationId?: string;
  createdBy: string;
  createdAt: string;
}

interface EmployeeShiftAssignment {
  id: string;
  employeeId: string;
  employeeDocumentId: string;
  employeeName: string;
  employeeCode: string;
  shiftId: string;
  shiftName: string;
  assignedBy: string;
  assignedAt: string;
  organizationId?: string;
}

const ShiftManagement = () => {
  const { user, organizationId, userRole } = useAuth();
  const isHR = userRole?.toLowerCase() === 'hr';
  const isHOD = userRole?.toLowerCase() === 'hod';

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<EmployeeShiftAssignment[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('shifts');
  const [hodDepartmentId, setHodDepartmentId] = useState<string | null>(null);

  // Create/Edit shift dialog
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftName, setShiftName] = useState('');
  const [shiftStart, setShiftStart] = useState('10:30');
  const [shiftEnd, setShiftEnd] = useState('18:30');
  const [shiftIsDefault, setShiftIsDefault] = useState(false);

  // Assign shift dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignShiftId, setAssignShiftId] = useState('');

  // Delete confirm
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteShift, setDeleteShift] = useState<Shift | null>(null);

  useEffect(() => {
    const init = async () => {
      if (isHOD && user) {
        const deptQuery = query(collection(db, 'departments'), where('hodId', '==', user.uid));
        const deptSnapshot = await getDocs(deptQuery);
        if (!deptSnapshot.empty) {
          setHodDepartmentId(deptSnapshot.docs[0].id);
        }
      }
    };
    init();
  }, [isHOD, user]);

  useEffect(() => {
    fetchShifts();
    fetchEmployees();
    fetchAssignments();
  }, [organizationId, hodDepartmentId]);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      let q;
      if (organizationId) {
        q = query(collection(db, 'shifts'), where('organizationId', '==', organizationId));
      } else {
        q = collection(db, 'shifts');
      }
      const snapshot = await getDocs(q);
      const shiftList = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Shift, 'id'>) }));
      
      // If no shifts exist, create default
      if (shiftList.length === 0 && isHR) {
        await createDefaultShift();
        return;
      }
      
      setShifts(shiftList);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultShift = async () => {
    try {
      await addDoc(collection(db, 'shifts'), {
        name: 'General Shift',
        startTime: '10:30',
        endTime: '18:30',
        isDefault: true,
        organizationId: organizationId || null,
        createdBy: user!.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('Default shift created (10:30 AM - 6:30 PM)');
      fetchShifts();
    } catch (error) {
      console.error('Error creating default shift:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      let q;
      if (isHOD && hodDepartmentId) {
        q = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
      } else if (organizationId) {
        q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
      } else {
        q = collection(db, 'employees');
      }
      const snapshot = await getDocs(q);
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) })));
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      let q;
      if (organizationId) {
        q = query(collection(db, 'shift_assignments'), where('organizationId', '==', organizationId));
      } else {
        q = collection(db, 'shift_assignments');
      }
      const snapshot = await getDocs(q);
      let assignmentList = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<EmployeeShiftAssignment, 'id'>) }));
      
      // HOD filter
      if (isHOD && hodDepartmentId) {
        const deptEmpQuery = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
        const deptEmpSnapshot = await getDocs(deptEmpQuery);
        const deptEmpIds = deptEmpSnapshot.docs.map(d => d.data().userId).filter(Boolean);
        assignmentList = assignmentList.filter(a => deptEmpIds.includes(a.employeeId));
      }
      
      setAssignments(assignmentList);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const formatTime12 = (time24: string) => {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const handleSaveShift = async () => {
    if (!shiftName || !shiftStart || !shiftEnd) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      if (editingShift) {
        await updateDoc(doc(db, 'shifts', editingShift.id), {
          name: shiftName,
          startTime: shiftStart,
          endTime: shiftEnd,
          isDefault: shiftIsDefault,
          updatedAt: new Date().toISOString()
        });
        
        // Update all assignments with this shift name
        const assignQuery = query(collection(db, 'shift_assignments'), where('shiftId', '==', editingShift.id));
        const assignSnapshot = await getDocs(assignQuery);
        for (const assignDoc of assignSnapshot.docs) {
          await updateDoc(doc(db, 'shift_assignments', assignDoc.id), { shiftName });
        }
        
        toast.success('Shift updated successfully');
      } else {
        // If marking as default, unmark existing default
        if (shiftIsDefault) {
          const defaultQuery = query(collection(db, 'shifts'), where('isDefault', '==', true));
          const defaultSnapshot = await getDocs(defaultQuery);
          for (const d of defaultSnapshot.docs) {
            await updateDoc(doc(db, 'shifts', d.id), { isDefault: false });
          }
        }

        await addDoc(collection(db, 'shifts'), {
          name: shiftName,
          startTime: shiftStart,
          endTime: shiftEnd,
          isDefault: shiftIsDefault,
          organizationId: organizationId || null,
          createdBy: user!.uid,
          createdAt: new Date().toISOString()
        });
        toast.success('Shift created successfully');
      }

      setShowShiftDialog(false);
      resetShiftForm();
      fetchShifts();
    } catch (error) {
      console.error('Error saving shift:', error);
      toast.error('Failed to save shift');
    }
  };

  const handleDeleteShift = async () => {
    if (!deleteShift) return;
    try {
      // Remove all assignments for this shift
      const assignQuery = query(collection(db, 'shift_assignments'), where('shiftId', '==', deleteShift.id));
      const assignSnapshot = await getDocs(assignQuery);
      for (const d of assignSnapshot.docs) {
        await deleteDoc(doc(db, 'shift_assignments', d.id));
      }
      
      await deleteDoc(doc(db, 'shifts', deleteShift.id));
      toast.success('Shift deleted');
      setShowDeleteDialog(false);
      setDeleteShift(null);
      fetchShifts();
      fetchAssignments();
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error('Failed to delete shift');
    }
  };

  const handleAssignShift = async () => {
    if (!assignEmployeeId || !assignShiftId) {
      toast.error('Please select employee and shift');
      return;
    }

    const employee = employees.find(e => e.id === assignEmployeeId);
    const shift = shifts.find(s => s.id === assignShiftId);
    if (!employee || !shift) {
      toast.error('Invalid selection');
      return;
    }

    try {
      // Check existing assignment
      const existingQuery = query(
        collection(db, 'shift_assignments'),
        where('employeeId', '==', employee.userId || employee.id)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        // Update existing
        const existingDoc = existingSnapshot.docs[0];
        await updateDoc(doc(db, 'shift_assignments', existingDoc.id), {
          shiftId: shift.id,
          shiftName: shift.name,
          assignedBy: user!.uid,
          assignedAt: new Date().toISOString()
        });
        toast.success(`${employee.name}'s shift updated to ${shift.name}`);
      } else {
        await addDoc(collection(db, 'shift_assignments'), {
          employeeId: employee.userId || employee.id,
          employeeDocumentId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.employeeCode || '',
          shiftId: shift.id,
          shiftName: shift.name,
          assignedBy: user!.uid,
          assignedAt: new Date().toISOString(),
          organizationId: organizationId || null
        });
        toast.success(`${shift.name} assigned to ${employee.name}`);
      }

      setShowAssignDialog(false);
      setAssignEmployeeId('');
      setAssignShiftId('');
      fetchAssignments();
    } catch (error) {
      console.error('Error assigning shift:', error);
      toast.error('Failed to assign shift');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await deleteDoc(doc(db, 'shift_assignments', assignmentId));
      toast.success('Shift assignment removed');
      fetchAssignments();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('Failed to remove assignment');
    }
  };

  const resetShiftForm = () => {
    setShiftName('');
    setShiftStart('10:30');
    setShiftEnd('18:30');
    setShiftIsDefault(false);
    setEditingShift(null);
  };

  const openEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftName(shift.name);
    setShiftStart(shift.startTime);
    setShiftEnd(shift.endTime);
    setShiftIsDefault(shift.isDefault || false);
    setShowShiftDialog(true);
  };

  const getEmployeeShift = (employeeUserId: string) => {
    const assignment = assignments.find(a => a.employeeId === employeeUserId);
    if (assignment) {
      const shift = shifts.find(s => s.id === assignment.shiftId);
      return shift || null;
    }
    return shifts.find(s => s.isDefault) || null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Shift Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage work shifts and assign them to employees</p>
        </div>
        <div className="flex gap-2">
          {isHR && (
            <Button onClick={() => { resetShiftForm(); setShowShiftDialog(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Shift
            </Button>
          )}
          <Button onClick={() => setShowAssignDialog(true)} variant="outline" className="gap-2">
            <UserCog className="h-4 w-4" />
            Assign Shift
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Shifts</p>
                <p className="text-2xl font-bold">{shifts.length}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/20">
                <Timer className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Assigned</p>
                <p className="text-2xl font-bold text-blue-600">{assignments.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unassigned</p>
                <p className="text-2xl font-bold text-green-600">{employees.length - assignments.length}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/20">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="shifts" className="gap-2">
            <Timer className="h-4 w-4" />
            Shifts ({shifts.length})
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Users className="h-4 w-4" />
            Assignments ({assignments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="mt-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Timer className="h-5 w-5 text-primary" />
                Available Shifts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : shifts.length === 0 ? (
                <div className="text-center py-12">
                  <Timer className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-lg font-medium">No shifts configured</p>
                  <p className="text-muted-foreground mb-4">Create your first shift to get started</p>
                  {isHR && (
                    <Button onClick={() => { resetShiftForm(); setShowShiftDialog(true); }}>
                      <Plus className="mr-2 h-4 w-4" /> Create Shift
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Shift Name</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Employees</TableHead>
                          <TableHead>Status</TableHead>
                          {isHR && <TableHead>Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shifts.map(shift => {
                          const assignedCount = assignments.filter(a => a.shiftId === shift.id).length;
                          const [sh, sm] = shift.startTime.split(':').map(Number);
                          const [eh, em] = shift.endTime.split(':').map(Number);
                          let durationMins = (eh * 60 + em) - (sh * 60 + sm);
                          if (durationMins < 0) durationMins += 24 * 60;
                          const dh = Math.floor(durationMins / 60);
                          const dm = durationMins % 60;
                          
                          return (
                            <TableRow key={shift.id}>
                              <TableCell className="font-medium">{shift.name}</TableCell>
                              <TableCell>{formatTime12(shift.startTime)}</TableCell>
                              <TableCell>{formatTime12(shift.endTime)}</TableCell>
                              <TableCell>{dh}h {dm}m</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{assignedCount} employees</Badge>
                              </TableCell>
                              <TableCell>
                                {shift.isDefault ? (
                                  <Badge className="bg-primary/10 text-primary border-primary/20">Default</Badge>
                                ) : (
                                  <Badge variant="outline">Custom</Badge>
                                )}
                              </TableCell>
                              {isHR && (
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => openEditShift(shift)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    {!shift.isDefault && (
                                      <Button size="sm" variant="ghost" onClick={() => { setDeleteShift(shift); setShowDeleteDialog(true); }} className="text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3">
                    {shifts.map(shift => {
                      const assignedCount = assignments.filter(a => a.shiftId === shift.id).length;
                      return (
                        <div key={shift.id} className="p-4 border rounded-xl space-y-3 bg-gradient-to-br from-background to-muted/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-full bg-primary/10">
                                <Timer className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold">{shift.name}</p>
                                {shift.isDefault && (
                                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Default</Badge>
                                )}
                              </div>
                            </div>
                            {isHR && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openEditShift(shift)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="bg-green-500/5 p-2 rounded-lg border border-green-500/20">
                              <p className="text-xs text-muted-foreground">Start</p>
                              <p className="font-medium text-green-600">{formatTime12(shift.startTime)}</p>
                            </div>
                            <div className="bg-red-500/5 p-2 rounded-lg border border-red-500/20">
                              <p className="text-xs text-muted-foreground">End</p>
                              <p className="font-medium text-red-600">{formatTime12(shift.endTime)}</p>
                            </div>
                            <div className="bg-blue-500/5 p-2 rounded-lg border border-blue-500/20">
                              <p className="text-xs text-muted-foreground">Assigned</p>
                              <p className="font-medium text-blue-600">{assignedCount}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-600" />
                Employee Shift Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Assigned Shift</TableHead>
                      <TableHead>Shift Timing</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map(emp => {
                      const assignment = assignments.find(a => a.employeeId === (emp.userId || emp.id));
                      const shift = assignment 
                        ? shifts.find(s => s.id === assignment.shiftId) 
                        : shifts.find(s => s.isDefault);
                      
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="font-mono text-sm">{emp.employeeCode || 'N/A'}</TableCell>
                          <TableCell className="font-medium">{emp.name}</TableCell>
                          <TableCell>
                            <Badge variant={assignment ? "default" : "secondary"} className={assignment ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : ""}>
                              {shift?.name || 'No Shift'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {shift ? `${formatTime12(shift.startTime)} - ${formatTime12(shift.endTime)}` : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => {
                                setAssignEmployeeId(emp.id);
                                setAssignShiftId(assignment?.shiftId || '');
                                setShowAssignDialog(true);
                              }}>
                                <Edit className="h-3 w-3 mr-1" />
                                {assignment ? 'Change' : 'Assign'}
                              </Button>
                              {assignment && (
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRemoveAssignment(assignment.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {employees.map(emp => {
                  const assignment = assignments.find(a => a.employeeId === (emp.userId || emp.id));
                  const shift = assignment 
                    ? shifts.find(s => s.id === assignment.shiftId) 
                    : shifts.find(s => s.isDefault);
                  
                  return (
                    <div key={emp.id} className="p-4 border rounded-xl space-y-3 bg-gradient-to-br from-background to-muted/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{emp.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{emp.employeeCode || 'N/A'}</p>
                        </div>
                        <Badge variant={assignment ? "default" : "secondary"} className={assignment ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : ""}>
                          {shift?.name || 'No Shift'}
                        </Badge>
                      </div>
                      {shift && (
                        <p className="text-sm text-muted-foreground">
                          {formatTime12(shift.startTime)} - {formatTime12(shift.endTime)}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                          setAssignEmployeeId(emp.id);
                          setAssignShiftId(assignment?.shiftId || '');
                          setShowAssignDialog(true);
                        }}>
                          <Edit className="h-3 w-3 mr-1" />
                          {assignment ? 'Change Shift' : 'Assign Shift'}
                        </Button>
                        {assignment && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRemoveAssignment(assignment.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Shift Dialog */}
      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              {editingShift ? 'Edit Shift' : 'Create New Shift'}
            </DialogTitle>
            <DialogDescription>
              {editingShift ? 'Update shift details' : 'Define a new work shift with start and end times'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Shift Name</Label>
              <Input
                placeholder="e.g., Morning Shift, Night Shift"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={shiftIsDefault}
                onChange={(e) => setShiftIsDefault(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="isDefault" className="text-sm cursor-pointer">Set as default shift for all employees</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowShiftDialog(false); resetShiftForm(); }}>Cancel</Button>
            <Button onClick={handleSaveShift}>{editingShift ? 'Update Shift' : 'Create Shift'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Shift Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-blue-500" />
              Assign Shift to Employee
            </DialogTitle>
            <DialogDescription>
              Select an employee and assign them to a specific shift
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <SearchableEmployeeSelect
                employees={employees.map(emp => ({
                  id: emp.id,
                  name: emp.name,
                  employeeCode: emp.employeeCode,
                  userId: emp.userId
                }))}
                value={assignEmployeeId}
                onValueChange={setAssignEmployeeId}
                placeholder="Select employee"
              />
            </div>
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={assignShiftId} onValueChange={setAssignShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map(shift => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name} ({formatTime12(shift.startTime)} - {formatTime12(shift.endTime)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleAssignShift}>Assign Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Shift Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Shift
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteShift?.name}</strong>? This will also remove all employee assignments for this shift.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeleteShift(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteShift}>Delete Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftManagement;
