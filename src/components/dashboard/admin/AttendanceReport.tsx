import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where, updateDoc, doc, addDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FileDown, Calendar, Clock, Search, TrendingUp, ClipboardList, Filter, Users, AlertTriangle, Gift, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeDocumentId?: string;
  employeeName?: string;
  employeeCode?: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  punchInLocation?: any;
  punchOutLocation?: any;
  isLate?: boolean;
}

interface Employee {
  id: string;
  userId: string;
  name: string;
  employeeCode: string;
}

// Helper function to map Firestore doc to AttendanceRecord
const mapDocToAttendanceRecord = (doc: any): AttendanceRecord => {
  const data = doc.data();
  return {
    id: doc.id,
    employeeId: data.employeeId || '',
    employeeDocumentId: data.employeeDocumentId,
    employeeName: data.employeeName,
    employeeCode: data.employeeCode,
    date: data.date || '',
    punchIn: data.punchIn || '',
    punchOut: data.punchOut || null,
    punchInLocation: data.punchInLocation,
    punchOutLocation: data.punchOutLocation,
    isLate: data.isLate || false
  };
};

const AttendanceReportHR = () => {
  const { user, userRole, organizationId } = useAuth();
  const currentUser = auth.currentUser;
  const isHR = userRole?.toLowerCase() === 'hr' || userRole?.toLowerCase() === 'admin';
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  // FIX 1: For non-HR users, always set selectedEmployee to their own userId
  const [selectedEmployee, setSelectedEmployee] = useState<string>(
    isHR ? 'all' : (currentUser?.uid || '')
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Mark Late & Comp Off
  const [showMarkLateDialog, setShowMarkLateDialog] = useState(false);
  const [markLateRecord, setMarkLateRecord] = useState<AttendanceRecord | null>(null);
  const [showCompOffDialog, setShowCompOffDialog] = useState(false);
  const [compOffRecord, setCompOffRecord] = useState<AttendanceRecord | null>(null);
  const [compOffReason, setCompOffReason] = useState('');

  useEffect(() => {
    const initializeData = async () => {
      await fetchEmployees();
    };
    initializeData();
  }, [organizationId]);

  useEffect(() => {
    // FIX 2: Always fetch attendance when employees are loaded
    if (employees.length > 0 || !isHR) {
      fetchAttendance();
    }
  }, [selectedEmployee, startDate, endDate, employees, isHR, currentUser]);

  const fetchEmployees = async () => {
    try {
      // FIX 3: For non-HR users, only fetch their own employee record
      let q;
      if (!isHR && currentUser) {
        // Regular user - find their own employee record
        q = query(collection(db, 'employees'), where('userId', '==', currentUser.uid));
      } else if (organizationId) {
        // HR with organization
        q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
      } else {
        // Fallback
        q = collection(db, 'employees');
      }
      
      const empSnapshot = await getDocs(q);
      const empList = empSnapshot.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          userId: data.userId,
          name: data.name,
          employeeCode: data.employeeCode || ''
        };
      });
      
      setEmployees(empList);
      
      // FIX 4: For non-HR users, if we found their employee record, ensure selectedEmployee is set correctly
      if (!isHR && currentUser && empList.length > 0) {
        setSelectedEmployee(currentUser.uid);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employee data');
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let records: AttendanceRecord[] = [];
      
      // FIX 5: Simplified and more reliable query logic
      if (!isHR && currentUser) {
        // REGULAR USER: Only fetch their own records
        console.log('Fetching attendance for regular user:', currentUser.uid);
        
        // Try multiple query approaches for regular user
        try {
          // First try with employeeId
          const q1 = query(
            collection(db, 'attendance'),
            where('employeeId', '==', currentUser.uid)
          );
          const snapshot1 = await getDocs(q1);
          records = snapshot1.docs.map(mapDocToAttendanceRecord);
          
          // If no records found, try with organizationId if available
          if (records.length === 0 && organizationId) {
            const q2 = query(
              collection(db, 'attendance'),
              where('organizationId', '==', organizationId),
              where('employeeId', '==', currentUser.uid)
            );
            const snapshot2 = await getDocs(q2);
            records = snapshot2.docs.map(mapDocToAttendanceRecord);
          }
          
          // If still no records, try with employeeDocumentId
          if (records.length === 0 && employees.length > 0) {
            const employeeDoc = employees.find(e => e.userId === currentUser.uid);
            if (employeeDoc) {
              const q3 = query(
                collection(db, 'attendance'),
                where('employeeDocumentId', '==', employeeDoc.id)
              );
              const snapshot3 = await getDocs(q3);
              records = snapshot3.docs.map(mapDocToAttendanceRecord);
            }
          }
        } catch (error) {
          console.error('Error in regular user query:', error);
          // Fallback: fetch and filter manually
          const allSnapshot = await getDocs(collection(db, 'attendance'));
          const allRecords = allSnapshot.docs.map(mapDocToAttendanceRecord);
          records = allRecords.filter(r => r.employeeId === currentUser.uid);
        }
        
      } else if (isHR) {
        // HR USER: Fetch based on selected employee
        console.log('Fetching attendance for HR user, selected:', selectedEmployee);
        
        if (selectedEmployee !== 'all') {
          // Specific employee
          const selectedEmp = employees.find(e => e.userId === selectedEmployee || e.id === selectedEmployee);
          
          if (selectedEmp) {
            try {
              // Try with employeeId
              let q = query(
                collection(db, 'attendance'),
                where('employeeId', '==', selectedEmp.userId)
              );
              if (organizationId) {
                q = query(q, where('organizationId', '==', organizationId));
              }
              const snapshot = await getDocs(q);
              records = snapshot.docs.map(mapDocToAttendanceRecord);
              
              // If no records, try with employeeDocumentId
              if (records.length === 0) {
                q = query(
                  collection(db, 'attendance'),
                  where('employeeDocumentId', '==', selectedEmp.id)
                );
                if (organizationId) {
                  q = query(q, where('organizationId', '==', organizationId));
                }
                const snapshot2 = await getDocs(q);
                records = snapshot2.docs.map(mapDocToAttendanceRecord);
              }
            } catch (error) {
              console.error('Error in HR specific query:', error);
            }
          }
        } else {
          // All employees
          try {
            if (organizationId) {
              const q = query(
                collection(db, 'attendance'),
                where('organizationId', '==', organizationId)
              );
              const snapshot = await getDocs(q);
              records = snapshot.docs.map(mapDocToAttendanceRecord);
            } else {
              const snapshot = await getDocs(collection(db, 'attendance'));
              records = snapshot.docs.map(mapDocToAttendanceRecord);
            }
          } catch (error) {
            console.error('Error in HR all query:', error);
          }
        }
      }

      // Apply date filters
      if (startDate) {
        records = records.filter(r => r.date >= startDate);
      }
      if (endDate) {
        records = records.filter(r => r.date <= endDate);
      }

      // Sort by date descending
      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Add employee data to records
      const recordsWithEmployeeData = records.map((record) => {
        // Find employee by multiple methods
        let employee: Employee | undefined;
        
        if (record.employeeId) {
          employee = employees.find(e => e.userId === record.employeeId);
        }
        if (!employee && record.employeeDocumentId) {
          employee = employees.find(e => e.id === record.employeeDocumentId);
        }

        return {
          ...record,
          employeeName: employee?.name || record.employeeName || 'Unknown',
          employeeCode: employee?.employeeCode || record.employeeCode || 'N/A'
        };
      });

      console.log('Processed records:', recordsWithEmployeeData.length);
      setAttendanceRecords(recordsWithEmployeeData);
      
      // FIX 6: Show appropriate message based on results
      if (recordsWithEmployeeData.length === 0 && !isHR) {
        toast.info('No attendance records found for your account');
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const calculateWorkHours = (punchIn: string, punchOut: string | null) => {
    if (!punchOut) return 'In Progress';
    try {
      let diff = new Date(punchOut).getTime() - new Date(punchIn).getTime();
      if (diff < 0) diff += 24 * 60 * 60 * 1000;
      const hours = diff / (1000 * 60 * 60);
      return `${hours.toFixed(2)} hrs`;
    } catch {
      return 'Invalid';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid';
    }
  };

  const formatLocation = (location: any) => {
    if (!location) return 'N/A';
    if (typeof location === 'string') return location;
    if (typeof location === 'object' && location.lat && location.lng) {
      return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    }
    return 'N/A';
  };

  const filteredRecords = attendanceRecords.filter(record => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      record.employeeName?.toLowerCase().includes(query) ||
      record.employeeCode?.toLowerCase().includes(query) ||
      record.date.includes(query)
    );
  });

  const isWeekend = (dateStr: string) => {
    const day = new Date(dateStr).getDay();
    return day === 0 || day === 6;
  };

  const handleMarkLate = async () => {
    if (!markLateRecord) return;
    try {
      await updateDoc(doc(db, 'attendance', markLateRecord.id), {
        isLate: true,
        lateMarkedBy: currentUser!.uid,
        lateMarkedAt: new Date().toISOString()
      });
      toast.success(`Marked as late for ${markLateRecord.date}`);
      setShowMarkLateDialog(false);
      setMarkLateRecord(null);
      fetchAttendance();
    } catch (error) {
      console.error('Error marking late:', error);
      toast.error('Failed to mark as late');
    }
  };

  const handleGrantCompOff = async () => {
    if (!compOffRecord || !compOffReason) {
      toast.error('Please provide a reason');
      return;
    }
    try {
      await addDoc(collection(db, 'comp_off'), {
        employeeId: compOffRecord.employeeId,
        employeeDocumentId: compOffRecord.employeeDocumentId || '',
        employeeName: compOffRecord.employeeName,
        employeeCode: compOffRecord.employeeCode,
        attendanceId: compOffRecord.id,
        workedDate: compOffRecord.date,
        reason: compOffReason,
        status: 'granted',
        grantedBy: currentUser!.uid,
        grantedAt: new Date().toISOString(),
        organizationId: organizationId || null,
        used: false
      });

      // Find the employee document ID for leave_balances
      let empDocId = compOffRecord.employeeDocumentId || '';
      if (!empDocId) {
        const empQuery = query(collection(db, 'employees'), where('userId', '==', compOffRecord.employeeId));
        const empSnap = await getDocs(empQuery);
        if (!empSnap.empty) empDocId = empSnap.docs[0].id;
      }

      if (empDocId) {
        const balRef = doc(db, 'leave_balances', empDocId);
        const balSnap = await getDoc(balRef);
        if (balSnap.exists()) {
          const currentCompOff = balSnap.data().COMP_OFF || 0;
          await updateDoc(balRef, {
            COMP_OFF: currentCompOff + 1,
            lastUpdated: new Date().toISOString()
          });
        } else {
          const { setDoc } = await import('firebase/firestore');
          await setDoc(balRef, {
            employeeId: compOffRecord.employeeId,
            COMP_OFF: 1,
            PL: 0, CL: 0, SL: 0, WFH: 0, MATERNITY: 0, PATERNITY: 0,
            ADOPTION: 0, SABBATICAL: 0, BEREAVEMENT: 0, PARENTAL: 0,
            lastUpdated: new Date().toISOString()
          });
        }
      }

      toast.success(`Compensatory Off granted to ${compOffRecord.employeeName}`);
      setShowCompOffDialog(false);
      setCompOffRecord(null);
      setCompOffReason('');
      fetchAttendance();
    } catch (error) {
      console.error('Error granting comp off:', error);
      toast.error('Failed to grant compensatory off');
    }
  };

  const exportToCSV = () => {
    const headers = ['Employee Code', 'Employee Name', 'Date', 'Punch In', 'Punch In Location', 'Punch Out', 'Punch Out Location', 'Total Hours', 'Status'];
    const rows = filteredRecords.map(record => [
      record.employeeCode || 'N/A',
      record.employeeName || 'Unknown',
      record.date,
      formatTime(record.punchIn),
      formatLocation(record.punchInLocation),
      record.punchOut ? formatTime(record.punchOut) : 'N/A',
      formatLocation(record.punchOutLocation),
      calculateWorkHours(record.punchIn, record.punchOut),
      record.punchOut ? 'Complete' : 'In Progress'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const calculateStats = () => {
    const totalRecords = filteredRecords.length;
    let totalHours = 0;
    let completedRecords = 0;

    filteredRecords.forEach(record => {
      if (record.punchOut) {
        try {
          let diff = new Date(record.punchOut).getTime() - new Date(record.punchIn).getTime();
          if (diff < 0) diff += 24 * 60 * 60 * 1000;
          const hours = diff / (1000 * 60 * 60);
          totalHours += hours;
          completedRecords++;
        } catch {
          // Skip invalid records
        }
      }
    });

    return {
      totalRecords,
      totalHours: totalHours.toFixed(2),
      avgHours: completedRecords > 0 ? (totalHours / completedRecords).toFixed(2) : '0',
      totalEmployees: isHR ? employees.length : 1, // For regular users, show 1
      completedRecords
    };
  };

  const stats = calculateStats();

  // FIX 7: Don't show employee filter for regular users
  const showEmployeeFilter = isHR && employees.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Attendance Report
          </h1>
          <p className="text-muted-foreground mt-1">
            {isHR ? 'View and manage employee attendance records' : 'View your attendance history'}
          </p>
        </div>
        <Button onClick={exportToCSV} className="gap-2">
          <FileDown className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Mobile Quick Stats */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm whitespace-nowrap">
          <ClipboardList className="h-4 w-4" />
          <span>{stats.totalRecords} Records</span>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 text-blue-600 px-3 py-1.5 rounded-full text-sm whitespace-nowrap">
          <Clock className="h-4 w-4" />
          <span>{stats.totalHours} Hrs</span>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 text-green-600 px-3 py-1.5 rounded-full text-sm whitespace-nowrap">
          <TrendingUp className="h-4 w-4" />
          <span>{stats.avgHours} Avg</span>
        </div>
        {isHR && (
          <div className="flex items-center gap-2 bg-purple-500/10 text-purple-600 px-3 py-1.5 rounded-full text-sm whitespace-nowrap">
            <Users className="h-4 w-4" />
            <span>{stats.totalEmployees} Employees</span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className={`hidden md:grid grid-cols-1 md:grid-cols-${isHR ? '4' : '3'} gap-4`}>
        <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{stats.totalRecords}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{stats.totalHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-500/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
                <p className="text-2xl font-bold">{stats.avgHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isHR && (
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-500/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                  <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters Card */}
      <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-secondary/10 via-secondary/5 to-transparent border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Filter className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${showEmployeeFilter ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
            {showEmployeeFilter && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Employee</Label>
                <SearchableEmployeeSelect
                  employees={employees.map(emp => ({ 
                    id: emp.userId, 
                    name: emp.name, 
                    employeeCode: emp.employeeCode,
                    documentId: emp.id 
                  }))}
                  value={selectedEmployee}
                  onValueChange={setSelectedEmployee}
                  placeholder="All Employees"
                  includeAllOption={true}
                  allOptionLabel="All Employees"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isHR ? "Search by name, code, date..." : "Search by date..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Records */}
      <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Attendance Records</CardTitle>
              <p className="text-sm text-muted-foreground">
                {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found • 
                {stats.completedRecords} completed • {filteredRecords.length - stats.completedRecords} in progress
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p>Loading attendance records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No attendance records found</p>
              <p className="text-sm">
                {isHR ? 'Try adjusting your filters' : 'Your attendance history will appear here once you start punching in'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table - FIX 8: Conditionally show/hide columns based on user role */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {isHR && <TableHead className="font-semibold">Employee Code</TableHead>}
                      {isHR && <TableHead className="font-semibold">Employee Name</TableHead>}
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Punch In</TableHead>
                      <TableHead className="font-semibold">Location</TableHead>
                      <TableHead className="font-semibold">Punch Out</TableHead>
                      <TableHead className="font-semibold">Location</TableHead>
                      <TableHead className="font-semibold">Total Hours</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      {isHR && <TableHead className="font-semibold">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id} className="hover:bg-muted/30">
                        {isHR && (
                          <TableCell className="font-medium font-mono text-sm">
                            {record.employeeCode}
                          </TableCell>
                        )}
                        {isHR && (
                          <TableCell className="font-medium">{record.employeeName}</TableCell>
                        )}
                        <TableCell>
                          {format(new Date(record.date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>{formatTime(record.punchIn)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {formatLocation(record.punchInLocation)}
                        </TableCell>
                        <TableCell>
                          {record.punchOut ? formatTime(record.punchOut) : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {formatLocation(record.punchOutLocation)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {calculateWorkHours(record.punchIn, record.punchOut)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {record.isLate && (
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Late
                              </Badge>
                            )}
                            <Badge 
                              variant={record.punchOut ? "default" : "secondary"}
                              className={record.punchOut 
                                ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" 
                                : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
                              }
                            >
                              {record.punchOut ? 'Complete' : 'In Progress'}
                            </Badge>
                          </div>
                        </TableCell>
                        {isHR && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!record.isLate && (
                                  <DropdownMenuItem onClick={() => { setMarkLateRecord(record); setShowMarkLateDialog(true); }}>
                                    <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                                    Mark Late
                                  </DropdownMenuItem>
                                )}
                                {isWeekend(record.date) && (
                                  <DropdownMenuItem onClick={() => { setCompOffRecord(record); setShowCompOffDialog(true); }}>
                                    <Gift className="h-4 w-4 mr-2 text-green-500" />
                                    Grant Comp Off
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                {filteredRecords.map((record) => (
                  <div key={record.id} className="p-4 hover:bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        {isHR ? (
                          <>
                            <p className="font-semibold">{record.employeeName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{record.employeeCode}</p>
                          </>
                        ) : (
                          <p className="font-semibold">Attendance Record</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {record.isLate && (
                          <Badge className="bg-red-500/10 text-red-600 text-xs">Late</Badge>
                        )}
                        <Badge 
                          variant={record.punchOut ? "default" : "secondary"}
                          className={record.punchOut 
                            ? "bg-green-500/10 text-green-600" 
                            : "bg-yellow-500/10 text-yellow-600"
                          }
                        >
                          {record.punchOut ? 'Complete' : 'In Progress'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {format(new Date(record.date), 'EEEE, MMM dd, yyyy')}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Punch In</p>
                        <p className="font-medium">{formatTime(record.punchIn)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Punch Out</p>
                        <p className="font-medium">
                          {record.punchOut ? formatTime(record.punchOut) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Hours</p>
                        <p className="font-medium text-primary">
                          {calculateWorkHours(record.punchIn, record.punchOut)}
                        </p>
                      </div>
                    </div>
                    {isHR && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        {!record.isLate && (
                          <Button size="sm" variant="outline" onClick={() => { setMarkLateRecord(record); setShowMarkLateDialog(true); }} className="text-xs gap-1 border-red-500/30 text-red-600">
                            <AlertTriangle className="h-3 w-3" /> Mark Late
                          </Button>
                        )}
                        {isWeekend(record.date) && (
                          <Button size="sm" variant="outline" onClick={() => { setCompOffRecord(record); setShowCompOffDialog(true); }} className="text-xs gap-1 border-green-500/30 text-green-600">
                            <Gift className="h-3 w-3" /> Comp Off
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Mark Late Dialog - Only visible to HR */}
      {isHR && (
        <Dialog open={showMarkLateDialog} onOpenChange={setShowMarkLateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Mark Employee Late
              </DialogTitle>
              <DialogDescription>
                Mark <strong>{markLateRecord?.employeeName}</strong> as late for <strong>{markLateRecord?.date}</strong>?
              </DialogDescription>
            </DialogHeader>
            {markLateRecord && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p><span className="text-muted-foreground">Punch In:</span> <span className="font-medium">{formatTime(markLateRecord.punchIn)}</span></p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowMarkLateDialog(false); setMarkLateRecord(null); }}>Cancel</Button>
              <Button variant="destructive" onClick={handleMarkLate}>Confirm Mark Late</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Grant Comp Off Dialog - Only visible to HR */}
      {isHR && (
        <Dialog open={showCompOffDialog} onOpenChange={setShowCompOffDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-green-500" />
                Grant Compensatory Off
              </DialogTitle>
              <DialogDescription>
                Grant comp off to <strong>{compOffRecord?.employeeName}</strong> for working on <strong>{compOffRecord?.date}</strong> (weekend).
              </DialogDescription>
            </DialogHeader>
            {compOffRecord && (
              <div className="space-y-4">
                <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                  <p><span className="text-muted-foreground">Employee:</span> <span className="font-medium">{compOffRecord.employeeName}</span></p>
                  <p><span className="text-muted-foreground">Date:</span> <span className="font-medium">{compOffRecord.date} ({new Date(compOffRecord.date).toLocaleDateString('en-US', { weekday: 'long' })})</span></p>
                  <p><span className="text-muted-foreground">Hours:</span> <span className="font-medium">{calculateWorkHours(compOffRecord.punchIn, compOffRecord.punchOut)}</span></p>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea placeholder="Reason for granting compensatory off..." value={compOffReason} onChange={(e) => setCompOffReason(e.target.value)} rows={3} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCompOffDialog(false); setCompOffRecord(null); setCompOffReason(''); }}>Cancel</Button>
              <Button onClick={handleGrantCompOff} className="bg-green-600 hover:bg-green-700">Grant Comp Off</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AttendanceReportHR;
