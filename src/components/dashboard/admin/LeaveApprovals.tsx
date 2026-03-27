import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { Check, X, User, Edit, Clock, CheckCircle2, XCircle, FileText, CalendarDays } from 'lucide-react';
import { LeaveRequest, LeaveType, LeaveBalance } from '@/types/leave';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LEAVE_TYPE_NAMES: Record<LeaveType, string> = {
  PL: 'Privilege Leave',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  MATERNITY: 'Maternity Leave',
  PATERNITY: 'Paternity Leave',
  ADOPTION: 'Adoption Leave',
  SABBATICAL: 'Sabbatical',
  WFH: 'Work From Home',
  BEREAVEMENT: 'Bereavement Leave',
  PARENTAL: 'Parental Leave',
  COMP_OFF: 'Compensatory Off',
  LWP: 'Leave Without Pay',
  VACATION: 'Vacation',
};

const LeaveApprovals = () => {
  const { userRole, organizationId } = useAuth();
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [hodDepartmentId, setHodDepartmentId] = useState<string | null>(null);
  const [hodDepartmentName, setHodDepartmentName] = useState<string | null>(null);
  const [hodDeptResolved, setHodDeptResolved] = useState(false);
  const isHOD = userRole?.toLowerCase() === 'hod';
  const isHR = userRole?.toLowerCase() === 'hr';

  useEffect(() => {
    const initHODDepartment = async () => {
      if (isHOD) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          // Get HOD's department
          const deptQuery = query(collection(db, 'departments'), where('hodId', '==', currentUser.uid));
          const deptSnapshot = await getDocs(deptQuery);
          if (!deptSnapshot.empty) {
            setHodDepartmentId(deptSnapshot.docs[0].id);
            setHodDepartmentName((deptSnapshot.docs[0].data() as any)?.name ?? null);
          } else {
            setHodDepartmentId(null);
            setHodDepartmentName(null);
          }
        }
      }
      if (isHOD) setHodDeptResolved(true);
    };
    initHODDepartment();
  }, [isHOD]);

  useEffect(() => {
    // Wait until we've resolved whether the HOD has a department assigned
    if (isHOD && !hodDeptResolved) return;
    fetchPendingLeaves();
    fetchAllLeaves();
  }, [userRole, hodDepartmentId, hodDeptResolved]);

  const fetchPendingLeaves = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      console.log('LeaveApprovals - Fetching pending leaves...');
      console.log('LeaveApprovals - Context:', { isHOD, hodDepartmentId, hodDepartmentName, organizationId });

      // Get department employees for HOD filtering
      let deptEmployeeIds: string[] = [];
      if (isHOD && (hodDepartmentId || hodDepartmentName)) {
        const ids = new Set<string>();

        if (hodDepartmentId) {
          const deptEmpQuery = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
          const deptEmpSnapshot = await getDocs(deptEmpQuery);
          deptEmpSnapshot.docs.forEach((d) => {
            const userId = (d.data() as any).userId;
            if (userId) ids.add(userId);
            ids.add(d.id);
          });
        }

        // Legacy support: some employees only have `department` (name) populated
        if (hodDepartmentName) {
          const deptByNameQuery = query(collection(db, 'employees'), where('department', '==', hodDepartmentName));
          const deptByNameSnapshot = await getDocs(deptByNameQuery);
          deptByNameSnapshot.docs.forEach((d) => {
            const userId = (d.data() as any).userId;
            if (userId) ids.add(userId);
            ids.add(d.id);
          });
        }

        deptEmployeeIds = Array.from(ids);
        console.log('LeaveApprovals - HOD team employee IDs:', deptEmployeeIds);
      }

      // Get all org employees - include both userId AND document ID
      let orgEmployeeIds: string[] = [];
      if (organizationId) {
        const empQuery = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
        const empSnapshot = await getDocs(empQuery);
        orgEmployeeIds = empSnapshot.docs.flatMap(d => {
          const userId = d.data().userId;
          return userId ? [userId, d.id] : [d.id];
        }).filter(Boolean);
        console.log('Organization employee IDs:', orgEmployeeIds);
      }

      const q = query(collection(db, 'leaves'), where('status', '==', 'PENDING'));
      const snapshot = await getDocs(q);
      console.log('Total pending leaves in system:', snapshot.docs.length);
      
      const leavesWithEmployees = await Promise.all(
        snapshot.docs.map(async (leaveDoc) => {
          const leaveData = leaveDoc.data() as any;
          let employeeName = leaveData.employeeName || 'Unknown';
          let employeeCode = leaveData.employeeCode || '';
          let departmentId = leaveData.departmentId || '';
          let departmentName = leaveData.department || '';
          
          // Fetch employee details if needed
          if (employeeName === 'Unknown' || (!departmentId && !departmentName)) {
            try {
              // First try to get by document ID
              const employeeDoc = await getDoc(doc(db, 'employees', leaveData.employeeId));
              if (employeeDoc.exists()) {
                const empData = employeeDoc.data() as any;
                employeeName = empData.name || 'Unknown';
                employeeCode = empData.employeeCode || '';
                departmentId = empData.departmentId || '';
                departmentName = empData.department || '';
              } else {
                // Try to find by userId field
                const empQuery = query(collection(db, 'employees'), where('userId', '==', leaveData.employeeId));
                const empSnapshot = await getDocs(empQuery);
                if (!empSnapshot.empty) {
                  const empData = empSnapshot.docs[0].data() as any;
                  employeeName = empData.name || 'Unknown';
                  employeeCode = empData.employeeCode || '';
                  departmentId = empData.departmentId || '';
                  departmentName = empData.department || '';
                }
              }
            } catch (error) {
              console.error('Error fetching employee:', error);
            }
          }
          
          return {
            id: leaveDoc.id,
            ...leaveData,
            employeeName,
            employeeCode,
            departmentId,
            department: departmentName,
          } as LeaveRequest & { departmentId?: string };
        })
      );
      
      // Filter by organization
      let filteredLeaves = organizationId
        ? leavesWithEmployees.filter(leave => 
            leave.organizationId === organizationId || orgEmployeeIds.includes(leave.employeeId)
          )
        : leavesWithEmployees;
      
      console.log('Leaves after org filter:', filteredLeaves.length);
      
      // HOD can only see their own department's leaves
      if (isHOD && deptEmployeeIds.length > 0) {
        filteredLeaves = filteredLeaves.filter(leave => deptEmployeeIds.includes(leave.employeeId));
        console.log('Leaves after HOD department filter:', filteredLeaves.length);
      } else if (isHOD && deptEmployeeIds.length === 0) {
        // HOD has no department assigned - show nothing
        filteredLeaves = [];
        console.log('HOD has no department assigned, showing 0 leaves');
      }
      
      setPendingLeaves(filteredLeaves);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast.error('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLeaves = async () => {
    try {
      // Get department employees for HOD filtering
      let deptEmployeeIds: string[] = [];
      if (isHOD && (hodDepartmentId || hodDepartmentName)) {
        const ids = new Set<string>();

        if (hodDepartmentId) {
          const deptEmpQuery = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
          const deptEmpSnapshot = await getDocs(deptEmpQuery);
          deptEmpSnapshot.docs.forEach((d) => {
            const userId = (d.data() as any).userId;
            if (userId) ids.add(userId);
            ids.add(d.id);
          });
        }

        if (hodDepartmentName) {
          const deptByNameQuery = query(collection(db, 'employees'), where('department', '==', hodDepartmentName));
          const deptByNameSnapshot = await getDocs(deptByNameQuery);
          deptByNameSnapshot.docs.forEach((d) => {
            const userId = (d.data() as any).userId;
            if (userId) ids.add(userId);
            ids.add(d.id);
          });
        }

        deptEmployeeIds = Array.from(ids);
      }

      // Get all org employees - include both userId AND document ID
      let orgEmployeeIds: string[] = [];
      if (organizationId) {
        const empQuery = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
        const empSnapshot = await getDocs(empQuery);
        orgEmployeeIds = empSnapshot.docs.flatMap(d => {
          const userId = d.data().userId;
          return userId ? [userId, d.id] : [d.id];
        }).filter(Boolean);
      }

      const q = query(collection(db, 'leaves'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const leavesWithEmployees = await Promise.all(
        snapshot.docs.map(async (leaveDoc) => {
          const leaveData = leaveDoc.data() as any;
          let employeeName = leaveData.employeeName || 'Unknown';
          let employeeCode = leaveData.employeeCode || '';
          let departmentId = leaveData.departmentId || '';
          let departmentName = leaveData.department || '';
          
          if (employeeName === 'Unknown' || (!departmentId && !departmentName)) {
            try {
              // First try to get by document ID
              const employeeDoc = await getDoc(doc(db, 'employees', leaveData.employeeId));
              if (employeeDoc.exists()) {
                const empData = employeeDoc.data() as any;
                employeeName = empData.name || 'Unknown';
                employeeCode = empData.employeeCode || '';
                departmentId = empData.departmentId || '';
                departmentName = empData.department || '';
              } else {
                // Try to find by userId field
                const empQuery = query(collection(db, 'employees'), where('userId', '==', leaveData.employeeId));
                const empSnapshot = await getDocs(empQuery);
                if (!empSnapshot.empty) {
                  const empData = empSnapshot.docs[0].data() as any;
                  employeeName = empData.name || 'Unknown';
                  employeeCode = empData.employeeCode || '';
                  departmentId = empData.departmentId || '';
                  departmentName = empData.department || '';
                }
              }
            } catch (error) {
              console.error('Error fetching employee:', error);
            }
          }
          
          return {
            id: leaveDoc.id,
            ...leaveData,
            employeeName,
            employeeCode,
            departmentId,
            department: departmentName,
          } as LeaveRequest & { departmentId?: string };
        })
      );
      
      // Filter by organization
      let filteredLeaves = organizationId
        ? leavesWithEmployees.filter(leave => 
            leave.organizationId === organizationId || orgEmployeeIds.includes(leave.employeeId)
          )
        : leavesWithEmployees;
      
      // HOD can only see their own department's leaves
      if (isHOD && deptEmployeeIds.length > 0) {
        filteredLeaves = filteredLeaves.filter(leave => deptEmployeeIds.includes(leave.employeeId));
      } else if (isHOD && deptEmployeeIds.length === 0) {
        filteredLeaves = [];
      }
      
      setAllLeaves(filteredLeaves);
    } catch (error) {
      console.error('Error fetching all leaves:', error);
    }
  };

  const handleApprove = async (leaveId: string, leave: LeaveRequest) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const balanceDoc = await getDoc(doc(db, 'leave_balances', leave.employeeId));
      if (balanceDoc.exists() && leave.leaveType !== 'LWP' && leave.leaveType !== 'VACATION') {
        const balance = balanceDoc.data() as LeaveBalance;
        const updatedBalance = {
          ...balance,
          [leave.leaveType]: Math.max(0, balance[leave.leaveType as keyof Omit<LeaveBalance, 'employeeId' | 'lastUpdated'>] - leave.duration),
          lastUpdated: new Date().toISOString(),
        };
        await updateDoc(doc(db, 'leave_balances', leave.employeeId), updatedBalance);
      }

      await updateDoc(doc(db, 'leaves', leaveId), { 
        status: 'APPROVED',
        approvedBy: currentUser.uid,
        approvedAt: new Date().toISOString()
      });
      toast.success('Leave approved and balance updated!');
      fetchPendingLeaves();
      fetchAllLeaves();
    } catch (error) {
      toast.error('Failed to approve leave');
    }
  };

  const handleReject = async (leaveId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      await updateDoc(doc(db, 'leaves', leaveId), { 
        status: 'REJECTED',
        rejectedBy: currentUser.uid,
        rejectedAt: new Date().toISOString()
      });
      toast.success('Leave rejected!');
      fetchPendingLeaves();
      fetchAllLeaves();
    } catch (error) {
      toast.error('Failed to reject leave');
    }
  };

  const handleEditLeave = (leave: LeaveRequest) => {
    setEditingLeave(leave);
    setIsEditDialogOpen(true);
  };

  const handleUpdateLeave = async () => {
    if (!editingLeave || !editingLeave.id) return;

    try {
      await updateDoc(doc(db, 'leaves', editingLeave.id), {
        leaveType: editingLeave.leaveType,
        startDate: editingLeave.startDate,
        endDate: editingLeave.endDate,
        duration: editingLeave.duration,
        reason: editingLeave.reason,
        notes: editingLeave.notes,
      });

      toast.success('Leave updated successfully');
      setIsEditDialogOpen(false);
      fetchPendingLeaves();
      fetchAllLeaves();
    } catch (error) {
      console.error('Error updating leave:', error);
      toast.error('Failed to update leave');
    }
  };

  const approvedCount = allLeaves.filter(l => l.status === 'APPROVED').length;
  const rejectedCount = allLeaves.filter(l => l.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Leave Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage employee leave requests</p>
        </div>
      </div>

      {/* Mobile Quick Stats */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-sm font-medium text-yellow-600">{pendingLeaves.length} Pending</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="text-sm font-medium text-green-600">{approvedCount} Approved</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20">
          <span className="text-sm font-medium text-red-600">{rejectedCount} Rejected</span>
        </div>
      </div>

      {/* Stats Cards - Desktop */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingLeaves.length}</p>
              </div>
              <div className="p-3 rounded-full bg-yellow-500/20">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
              </div>
              <div className="p-3 rounded-full bg-red-500/20">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold text-blue-600">{allLeaves.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/20">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'all')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingLeaves.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <FileText className="h-4 w-4" />
            All History ({allLeaves.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Pending Leave Approvals
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingLeaves.map(leave => (
                    <div 
                      key={leave.id} 
                      className="p-4 border rounded-xl space-y-4 hover:border-primary/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <p className="font-semibold text-lg">{leave.employeeName}</p>
                            {leave.employeeCode && (
                              <Badge variant="outline" className="text-xs">{leave.employeeCode}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">
                              {LEAVE_TYPE_NAMES[leave.leaveType]}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <CalendarDays className="h-4 w-4" />
                              {leave.startDate} to {leave.endDate}
                            </div>
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                              {leave.duration} days
                            </Badge>
                          </div>
                        </div>
                        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                      
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground font-medium mb-1">Reason</p>
                        <p className="text-sm">{leave.reason}</p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditLeave(leave)} className="flex-1 sm:flex-none">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button size="sm" onClick={() => handleApprove(leave.id!, leave)} className="flex-1 bg-green-600 hover:bg-green-700">
                          <Check className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(leave.id!)} className="flex-1">
                          <X className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                  {pendingLeaves.length === 0 && (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      </div>
                      <p className="text-lg font-medium">All caught up!</p>
                      <p className="text-muted-foreground">No pending leave requests to review</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                All Leave History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {allLeaves.map(leave => (
                  <div 
                    key={leave.id} 
                    className="p-4 border rounded-xl space-y-3 transition-all hover:shadow-sm bg-gradient-to-br from-background to-muted/10"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="p-2 rounded-full bg-muted">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="font-semibold">{leave.employeeName}</p>
                          {leave.employeeCode && (
                            <Badge variant="outline" className="text-xs">{leave.employeeCode}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{LEAVE_TYPE_NAMES[leave.leaveType]}</Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {leave.startDate} to {leave.endDate} ({leave.duration} days)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={
                            leave.status === 'APPROVED' 
                              ? 'bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20' 
                              : leave.status === 'REJECTED' 
                                ? 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20' 
                                : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20'
                          }
                        >
                          {leave.status === 'APPROVED' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {leave.status === 'REJECTED' && <XCircle className="h-3 w-3 mr-1" />}
                          {leave.status === 'PENDING' && <Clock className="h-3 w-3 mr-1" />}
                          {leave.status}
                        </Badge>
                        {leave.status === 'PENDING' && (
                          <Button size="sm" variant="outline" onClick={() => handleEditLeave(leave)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="bg-muted/50 p-2 rounded-lg">
                      <p className="text-sm">{leave.reason}</p>
                    </div>
                  </div>
                ))}
                {allLeaves.length === 0 && (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No leave records found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit Leave Request
            </DialogTitle>
          </DialogHeader>
          {editingLeave && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Input value={editingLeave.employeeName} disabled className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Input value={LEAVE_TYPE_NAMES[editingLeave.leaveType]} disabled className="bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={editingLeave.startDate}
                    onChange={(e) => setEditingLeave({ ...editingLeave, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={editingLeave.endDate}
                    onChange={(e) => setEditingLeave({ ...editingLeave, endDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (Days)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editingLeave.duration}
                    onChange={(e) => setEditingLeave({ ...editingLeave, duration: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={editingLeave.reason}
                  onChange={(e) => setEditingLeave({ ...editingLeave, reason: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (HR)</Label>
                <Textarea
                  value={editingLeave.notes || ''}
                  onChange={(e) => setEditingLeave({ ...editingLeave, notes: e.target.value })}
                  placeholder="Add internal notes..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateLeave}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveApprovals;
