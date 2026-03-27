import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, getDoc, doc, updateDoc, where, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, MapPin, User, Edit, CheckCircle, XCircle, Plus, CalendarPlus, CalendarDays, FileText, CheckCircle2, AlertTriangle, Gift } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';

interface AttendanceWithEmployee {
  id: string;
  employeeId: string;
  employeeDocumentId?: string;
  employeeName: string;
  employeeCode: string;
  date: string;
  punchIn: any;
  punchOut?: any;
  punchInLocation?: any;
  punchOutLocation?: any;
  totalHours?: number;
  source?: string;
  isLate?: boolean;
  lateMarkedBy?: string;
  lateMarkedAt?: string;
}

const AttendanceManagement = () => {
  const { user, organizationId, userRole } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceWithEmployee[]>([]);
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [attendanceRequests, setAttendanceRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'processed'>('pending');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceWithEmployee | null>(null);
  const [editPunchOut, setEditPunchOut] = useState('');
  const [hodDepartmentId, setHodDepartmentId] = useState<string | null>(null);
  const isHOD = userRole?.toLowerCase() === 'hod';
  const isHR = userRole?.toLowerCase() === 'hr';
  
  // HR direct attendance marking
  const [showAddAttendanceDialog, setShowAddAttendanceDialog] = useState(false);
  const [addAttendanceEmployeeId, setAddAttendanceEmployeeId] = useState('');
  const [addAttendanceDate, setAddAttendanceDate] = useState('');
  const [addAttendancePunchIn, setAddAttendancePunchIn] = useState('');
  const [addAttendancePunchOut, setAddAttendancePunchOut] = useState('');

  // Mark Late
  const [showMarkLateDialog, setShowMarkLateDialog] = useState(false);
  const [markLateRecord, setMarkLateRecord] = useState<AttendanceWithEmployee | null>(null);

  // Grant Comp Off
  const [showCompOffDialog, setShowCompOffDialog] = useState(false);
  const [compOffRecord, setCompOffRecord] = useState<AttendanceWithEmployee | null>(null);
  const [compOffReason, setCompOffReason] = useState('');

  useEffect(() => {
    const initHODDepartment = async () => {
      if (isHOD && user) {
        // Get HOD's department
        const deptQuery = query(collection(db, 'departments'), where('hodId', '==', user.uid));
        const deptSnapshot = await getDocs(deptQuery);
        if (!deptSnapshot.empty) {
          setHodDepartmentId(deptSnapshot.docs[0].id);
        }
      }
    };
    initHODDepartment();
  }, [isHOD, user]);

  useEffect(() => {
    // Wait for HOD department to be fetched if user is HOD
    if (isHOD && hodDepartmentId === null) return;
    fetchAttendance();
    fetchEditRequests();
    fetchAttendanceRequests();
    fetchEmployees();
  }, [user, organizationId, hodDepartmentId]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      console.log('Attendance Management - Fetching attendance...');
      console.log('Organization ID:', organizationId);
      console.log('HOD Department ID:', hodDepartmentId);
      
      // Get department employee IDs for HOD filtering
      let deptEmployeeIds: string[] = [];
      if (isHOD && hodDepartmentId) {
        const deptEmpQuery = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
        const deptEmpSnapshot = await getDocs(deptEmpQuery);
        // Include both userId field and document ID as employee identifier
        deptEmployeeIds = deptEmpSnapshot.docs.flatMap(d => {
          const userId = d.data().userId;
          return userId ? [userId, d.id] : [d.id];
        }).filter(Boolean);
        console.log('HOD department employee IDs:', deptEmployeeIds);
      }
      
      let recordsWithEmployees: AttendanceWithEmployee[] = [];
      
      let q;
      if (organizationId) {
        q = query(
          collection(db, 'attendance'),
          where('organizationId', '==', organizationId)
        );
      } else {
        q = collection(db, 'attendance');
      }
      
      const snapshot = await getDocs(q);
      console.log('Total attendance records found:', snapshot.docs.length);
      
      recordsWithEmployees = await Promise.all(
        snapshot.docs.map(async (attendanceDoc) => {
          const attendanceData = attendanceDoc.data() as any;
          
          let employeeName = attendanceData.employeeName || 'Unknown';
          let employeeCode = attendanceData.employeeCode || '';
          
          // Only fetch employee data if not already stored
          if (!employeeName || employeeName === 'Unknown') {
            try {
              if (attendanceData.employeeId) {
                const employeeQueryByUserId = query(
                  collection(db, 'employees'),
                  where('userId', '==', attendanceData.employeeId)
                );
                const employeeSnapshotByUserId = await getDocs(employeeQueryByUserId);
                
                if (!employeeSnapshotByUserId.empty) {
                  const empData = employeeSnapshotByUserId.docs[0].data() as any;
                  employeeName = empData.name || 'Unknown';
                  employeeCode = empData.employeeCode || '';
                } else if (attendanceData.employeeDocumentId) {
                  const employeeDoc = await getDoc(doc(db, 'employees', attendanceData.employeeDocumentId));
                  if (employeeDoc.exists()) {
                    const empData = employeeDoc.data() as any;
                    employeeName = empData.name || 'Unknown';
                    employeeCode = empData.employeeCode || '';
                  }
                } else {
                  const employeeDoc = await getDoc(doc(db, 'employees', attendanceData.employeeId));
                  if (employeeDoc.exists()) {
                    const empData = employeeDoc.data() as any;
                    employeeName = empData.name || 'Unknown';
                    employeeCode = empData.employeeCode || '';
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching employee:', error);
            }
          }
          
          return {
            id: attendanceDoc.id,
            ...attendanceData,
            employeeName,
            employeeCode,
          } as AttendanceWithEmployee;
        })
      );
      
      // For HOD, filter by department employees only
      if (isHOD && hodDepartmentId && deptEmployeeIds.length > 0) {
        recordsWithEmployees = recordsWithEmployees.filter(record => 
          deptEmployeeIds.includes(record.employeeId)
        );
      }
      
      // Sort by date descending
      recordsWithEmployees.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      // Limit to 50 records
      recordsWithEmployees = recordsWithEmployees.slice(0, 50);
      
      console.log('Final processed records:', recordsWithEmployees.length);
      setAttendanceRecords(recordsWithEmployees);
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid';
    }
  };

  const calculateHours = (punchIn: any, punchOut: any) => {
    if (!punchIn || !punchOut) return null;
    try {
      let diff = new Date(punchOut).getTime() - new Date(punchIn).getTime();
      // Handle overnight shifts (punch out is next day)
      if (diff < 0) diff += 24 * 60 * 60 * 1000;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } catch {
      return null;
    }
  };

  const fetchEmployees = async () => {
    try {
      let q;
      if (isHOD && hodDepartmentId) {
        // HOD can only see their department's employees
        q = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
      } else if (organizationId) {
        q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
      } else {
        q = collection(db, 'employees');
      }
      const snapshot = await getDocs(q);
      setEmployees(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) })));
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAttendanceRequests = async () => {
    if (!user) return;
    try {
      // Get department employee IDs for HOD filtering
      let deptEmployeeIds: string[] = [];
      if (isHOD && hodDepartmentId) {
        const deptEmpQuery = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
        const deptEmpSnapshot = await getDocs(deptEmpQuery);
        deptEmployeeIds = deptEmpSnapshot.docs.map(d => d.data().userId).filter(Boolean);
      }

      let q;
      if (organizationId) {
        q = query(
          collection(db, 'attendance_requests'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'attendance_requests'),
          orderBy('createdAt', 'desc')
        );
      }
      const snapshot = await getDocs(q);
      let requests = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      
      // Filter for HOD department
      if (isHOD && hodDepartmentId && deptEmployeeIds.length > 0) {
        requests = requests.filter(req => deptEmployeeIds.includes(req.employeeId));
      }
      
      setAttendanceRequests(requests);
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        // Fallback without orderBy
        let deptEmployeeIds: string[] = [];
        if (isHOD && hodDepartmentId) {
          const deptEmpQuery = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
          const deptEmpSnapshot = await getDocs(deptEmpQuery);
          deptEmployeeIds = deptEmpSnapshot.docs.map(d => d.data().userId).filter(Boolean);
        }

        let q;
        if (organizationId) {
          q = query(
            collection(db, 'attendance_requests'),
            where('organizationId', '==', organizationId)
          );
        } else {
          q = collection(db, 'attendance_requests');
        }
        const snapshot = await getDocs(q);
        let requests = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        requests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Filter for HOD department
        if (isHOD && hodDepartmentId && deptEmployeeIds.length > 0) {
          requests = requests.filter(req => deptEmployeeIds.includes(req.employeeId));
        }
        
        setAttendanceRequests(requests);
      } else {
        console.error('Error fetching attendance requests:', error);
      }
    }
  };

  const fetchEditRequests = async () => {
    if (!user) return;
    try {
      // Get department employee IDs for HOD filtering
      let deptEmployeeIds: string[] = [];
      if (isHOD && hodDepartmentId) {
        const deptEmpQuery = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
        const deptEmpSnapshot = await getDocs(deptEmpQuery);
        deptEmployeeIds = deptEmpSnapshot.docs.map(d => d.data().userId).filter(Boolean);
      }

      let q;
      if (organizationId) {
        q = query(
          collection(db, 'attendance_edit_requests'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'attendance_edit_requests'),
          orderBy('createdAt', 'desc')
        );
      }
      const snapshot = await getDocs(q);
      let requests = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      
      // Filter for HOD department
      if (isHOD && hodDepartmentId && deptEmployeeIds.length > 0) {
        requests = requests.filter(req => deptEmployeeIds.includes(req.employeeId));
      }
      
      setEditRequests(requests);
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        let deptEmployeeIds: string[] = [];
        if (isHOD && hodDepartmentId) {
          const deptEmpQuery = query(collection(db, 'employees'), where('departmentId', '==', hodDepartmentId));
          const deptEmpSnapshot = await getDocs(deptEmpQuery);
          deptEmployeeIds = deptEmpSnapshot.docs.map(d => d.data().userId).filter(Boolean);
        }

        let q;
        if (organizationId) {
          q = query(
            collection(db, 'attendance_edit_requests'),
            where('organizationId', '==', organizationId)
          );
        } else {
          q = collection(db, 'attendance_edit_requests');
        }
        const snapshot = await getDocs(q);
        let requests = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        requests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        if (isHOD && hodDepartmentId && deptEmployeeIds.length > 0) {
          requests = requests.filter(req => deptEmployeeIds.includes(req.employeeId));
        }
        
        setEditRequests(requests);
      } else {
        console.error('Error fetching edit requests:', error);
      }
    }
  };

  const handleAttendanceRequestAction = async (requestId: string, action: 'approved' | 'rejected', request: any) => {
    try {
      if (action === 'approved') {
        // Find employee by userId to get all necessary data
        const employeeQuery = query(collection(db, 'employees'), where('userId', '==', request.employeeId));
        const employeeSnapshot = await getDocs(employeeQuery);
        
        let employeeDocId = '';
        let employeeData: any = {};
        
        if (!employeeSnapshot.empty) {
          employeeData = employeeSnapshot.docs[0].data();
          employeeDocId = employeeSnapshot.docs[0].id;
        }
        
        const punchInDate = new Date(request.date + 'T' + request.requestedPunchIn);
        let punchOutDate = new Date(request.date + 'T' + request.requestedPunchOut);
        // Handle overnight: if punch-out time is before punch-in, it's next day
        if (punchOutDate.getTime() <= punchInDate.getTime()) {
          punchOutDate = new Date(punchOutDate.getTime() + 24 * 60 * 60 * 1000);
        }
        
        await addDoc(collection(db, 'attendance'), {
          employeeId: request.employeeId,
          employeeDocumentId: employeeDocId,
          employeeName: employeeData.name || request.employeeName,
          employeeCode: employeeData.employeeCode || '',
          date: request.date,
          punchIn: punchInDate.toISOString(),
          punchOut: punchOutDate.toISOString(),
          punchInLocation: null,
          punchOutLocation: null,
          organizationId: organizationId || null,
          addedBy: user!.uid,
          addedAt: new Date().toISOString(),
          source: 'request_approved'
        });
      }

      await updateDoc(doc(db, 'attendance_requests', requestId), {
        status: action,
        approvedBy: user!.uid,
        approvedAt: new Date().toISOString()
      });

      toast.success(`Request ${action} successfully`);
      fetchAttendanceRequests();
      fetchAttendance();
    } catch (error) {
      console.error('Error handling attendance request:', error);
      toast.error('Failed to process request');
    }
  };

  const submitAddAttendance = async () => {
    if (!addAttendanceEmployeeId || !addAttendanceDate || !addAttendancePunchIn || !addAttendancePunchOut) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      // Get the selected employee
      const selectedEmployee = employees.find(e => e.id === addAttendanceEmployeeId);
      if (!selectedEmployee) {
        toast.error('Employee not found');
        return;
      }

      // Check for existing attendance using BOTH possible IDs
      const existingQuery = query(
        collection(db, 'attendance'),
        where('date', '==', addAttendanceDate)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      // Check if attendance exists for this employee on this date
      const existingRecord = existingSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.employeeId === selectedEmployee.userId || 
               data.employeeDocumentId === selectedEmployee.id;
      });
      
      if (existingRecord) {
        toast.error('Attendance already exists for this employee on this date');
        return;
      }

      const punchInDate = new Date(addAttendanceDate + 'T' + addAttendancePunchIn);
      let punchOutDate = new Date(addAttendanceDate + 'T' + addAttendancePunchOut);
      // Handle overnight: if punch-out time is before punch-in, it's next day
      if (punchOutDate.getTime() <= punchInDate.getTime()) {
        punchOutDate = new Date(punchOutDate.getTime() + 24 * 60 * 60 * 1000);
      }

      await addDoc(collection(db, 'attendance'), {
        // Store BOTH IDs like employee punches do
        employeeId: selectedEmployee.userId, // Firebase Auth UID
        employeeDocumentId: selectedEmployee.id, // Employee document ID
        
        // Store employee details directly
        employeeName: selectedEmployee.name,
        employeeCode: selectedEmployee.employeeCode,
        
        date: addAttendanceDate,
        punchIn: punchInDate.toISOString(),
        punchOut: punchOutDate.toISOString(),
        punchInLocation: null,
        punchOutLocation: null,
        organizationId: organizationId || null,
        addedBy: user!.uid,
        addedAt: new Date().toISOString(),
        source: 'hr_manual'
      });

      toast.success('Attendance added successfully');
      setShowAddAttendanceDialog(false);
      setAddAttendanceEmployeeId('');
      setAddAttendanceDate('');
      setAddAttendancePunchIn('');
      setAddAttendancePunchOut('');
      fetchAttendance();
    } catch (error) {
      console.error('Error adding attendance:', error);
      toast.error('Failed to add attendance');
    }
  };

  const handleMarkLate = async () => {
    if (!markLateRecord) return;
    try {
      await updateDoc(doc(db, 'attendance', markLateRecord.id), {
        isLate: true,
        lateMarkedBy: user!.uid,
        lateMarkedAt: new Date().toISOString()
      });
      toast.success(`${markLateRecord.employeeName} marked as late for ${markLateRecord.date}`);
      setShowMarkLateDialog(false);
      setMarkLateRecord(null);
      fetchAttendance();
    } catch (error) {
      console.error('Error marking late:', error);
      toast.error('Failed to mark as late');
    }
  };

  const isWeekend = (dateStr: string) => {
    const day = new Date(dateStr).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  const handleGrantCompOff = async () => {
    if (!compOffRecord || !compOffReason) {
      toast.error('Please provide a reason');
      return;
    }
    try {
      // Add comp off to leave balances or create a comp_off record
      await addDoc(collection(db, 'comp_off'), {
        employeeId: compOffRecord.employeeId,
        employeeDocumentId: compOffRecord.employeeDocumentId || '',
        employeeName: compOffRecord.employeeName,
        employeeCode: compOffRecord.employeeCode,
        attendanceId: compOffRecord.id,
        workedDate: compOffRecord.date,
        reason: compOffReason,
        status: 'granted',
        grantedBy: user!.uid,
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
        const balDoc = await getDoc(balRef);
        if (balDoc.exists()) {
          const currentCompOff = balDoc.data().COMP_OFF || 0;
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
    } catch (error) {
      console.error('Error granting comp off:', error);
      toast.error('Failed to grant compensatory off');
    }
  };

  const handleEditAttendance = (record: AttendanceWithEmployee) => {
    setSelectedRecord(record);
    setEditPunchOut('');
    setShowEditDialog(true);
  };

  const submitEdit = async () => {
    if (!selectedRecord || !editPunchOut) {
      toast.error('Please provide punch out time');
      return;
    }

    try {
      const punchOutDate = new Date(selectedRecord.date + 'T' + editPunchOut);
      await updateDoc(doc(db, 'attendance', selectedRecord.id), {
        punchOut: punchOutDate.toISOString(),
        punchOutLocation: selectedRecord.punchInLocation || null,
        editedBy: user!.uid,
        editedAt: new Date().toISOString()
      });

      toast.success('Attendance updated successfully');
      setShowEditDialog(false);
      fetchAttendance();
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    }
  };

  const handleEditRequestAction = async (requestId: string, action: 'approved' | 'rejected', attendanceId: string, requestedPunchOut: string, date: string, currentPunchIn?: string) => {
    try {
      if (action === 'approved') {
        let punchOutDate = new Date(date + 'T' + requestedPunchOut);
        // Handle overnight: if we have punch-in info and punch-out is before it
        if (currentPunchIn) {
          const punchInDate = new Date(currentPunchIn);
          if (punchOutDate.getTime() <= punchInDate.getTime()) {
            punchOutDate = new Date(punchOutDate.getTime() + 24 * 60 * 60 * 1000);
          }
        }
        await updateDoc(doc(db, 'attendance', attendanceId), {
          punchOut: punchOutDate.toISOString(),
          punchOutLocation: null,
          editedBy: user!.uid,
          editedAt: new Date().toISOString()
        });
      }

      await updateDoc(doc(db, 'attendance_edit_requests', requestId), {
        status: action,
        approvedBy: user!.uid,
        approvedAt: new Date().toISOString()
      });

      toast.success(`Request ${action} successfully`);
      fetchEditRequests();
      fetchAttendance();
    } catch (error) {
      console.error('Error handling edit request:', error);
      toast.error('Failed to process request');
    }
  };

  // Migration function to fix existing records
  const migrateAttendanceRecords = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'attendance'));
      const batch = writeBatch(db);
      let updateCount = 0;
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // If employeeId exists but not employeeDocumentId
        if (data.employeeId && !data.employeeDocumentId) {
          // Find employee by userId
          const employeeQuery = query(
            collection(db, 'employees'),
            where('userId', '==', data.employeeId)
          );
          const employeeSnapshot = await getDocs(employeeQuery);
          
          if (!employeeSnapshot.empty) {
            const employeeDoc = employeeSnapshot.docs[0];
            const employeeData = employeeDoc.data();
            
            batch.update(doc(db, 'attendance', docSnap.id), {
              employeeDocumentId: employeeDoc.id,
              employeeName: employeeData.name || data.employeeName || 'Unknown',
              employeeCode: employeeData.employeeCode || data.employeeCode || '',
              organizationId: employeeData.organizationId || data.organizationId || null,
              source: data.source || 'migrated'
            });
            updateCount++;
          }
        }
      }
      
      if (updateCount > 0) {
        await batch.commit();
        console.log(`Migration completed: ${updateCount} records updated`);
        toast.success(`Migrated ${updateCount} attendance records successfully`);
        fetchAttendance(); // Refresh the list
      } else {
        toast.success('No records need migration');
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Migration failed');
    }
  };

  // Calculate stats
  const pendingAttendanceRequests = attendanceRequests.filter(r => r.status === 'pending');
  const processedAttendanceRequests = attendanceRequests.filter(r => r.status !== 'pending');
  const pendingEditRequests = editRequests.filter(r => r.status === 'pending');
  const processedEditRequests = editRequests.filter(r => r.status !== 'pending');
  const pendingRequestsCount = pendingAttendanceRequests.length + pendingEditRequests.length;
  const completeRecords = attendanceRecords.filter(r => r.punchOut);
  const incompleteRecords = attendanceRecords.filter(r => !r.punchOut);

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Attendance Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track and manage employee attendance records</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={migrateAttendanceRecords}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Migrate Records
          </Button>
          <Button onClick={() => setShowAddAttendanceDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Attendance
          </Button>
        </div>
      </div>

      {/* Mobile Quick Stats */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-sm font-medium text-yellow-600">{pendingRequestsCount} Pending</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="text-sm font-medium text-green-600">{completeRecords.length} Complete</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20">
          <span className="text-sm font-medium text-orange-600">{incompleteRecords.length} In Progress</span>
        </div>
      </div>

      {/* Stats Cards - Desktop */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingRequestsCount}</p>
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
                <p className="text-sm text-muted-foreground">Complete</p>
                <p className="text-2xl font-bold text-green-600">{completeRecords.length}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-orange-600">{incompleteRecords.length}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/20">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold text-blue-600">{attendanceRecords.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/20">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'all' | 'processed')} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingRequestsCount})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <FileText className="h-4 w-4" />
            All Records ({attendanceRecords.length})
          </TabsTrigger>
          <TabsTrigger value="processed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Processed ({processedAttendanceRequests.length + processedEditRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6 space-y-6">
          {/* Pending Attendance Requests */}
          {pendingAttendanceRequests.length > 0 && (
            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarPlus className="h-5 w-5 text-blue-600" />
                  Attendance Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {pendingAttendanceRequests.map(request => (
                    <div 
                      key={request.id} 
                      className="p-4 border rounded-xl space-y-4 hover:border-primary/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <p className="font-semibold text-lg">{request.employeeName}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <CalendarDays className="h-4 w-4" />
                              {request.date}
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="bg-green-500/5 p-3 rounded-lg border border-green-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Requested Punch In</p>
                          <p className="font-medium text-green-600">{request.requestedPunchIn}</p>
                        </div>
                        <div className="bg-red-500/5 p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Requested Punch Out</p>
                          <p className="font-medium text-red-600">{request.requestedPunchOut}</p>
                        </div>
                      </div>

                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground font-medium mb-1">Reason</p>
                        <p className="text-sm">{request.reason}</p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleAttendanceRequestAction(request.id, 'approved', request)} 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleAttendanceRequestAction(request.id, 'rejected', request)} 
                          className="flex-1"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Edit Requests */}
          {pendingEditRequests.length > 0 && (
            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-yellow-500/5 to-yellow-500/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Edit className="h-5 w-5 text-yellow-600" />
                  Punch Out Edit Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {pendingEditRequests.map(request => (
                    <div 
                      key={request.id} 
                      className="p-4 border rounded-xl space-y-4 hover:border-primary/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <p className="font-semibold text-lg">{request.employeeName}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <CalendarDays className="h-4 w-4" />
                              {request.date}
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Current Punch In</p>
                          <p className="font-medium">
                            {new Date(request.currentPunchIn).toLocaleTimeString('en-US', { 
                              hour: '2-digit', minute: '2-digit', hour12: true 
                            })}
                          </p>
                        </div>
                        <div className="bg-blue-500/5 p-3 rounded-lg border border-blue-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Requested Punch Out</p>
                          <p className="font-medium text-blue-600">{request.requestedPunchOut}</p>
                        </div>
                      </div>

                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground font-medium mb-1">Reason</p>
                        <p className="text-sm">{request.reason}</p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleEditRequestAction(request.id, 'approved', request.attendanceId, request.requestedPunchOut, request.date, request.currentPunchIn)} 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleEditRequestAction(request.id, 'rejected', request.attendanceId, request.requestedPunchOut, request.date, request.currentPunchIn)} 
                          className="flex-1"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {pendingRequestsCount === 0 && (
            <Card className="border-primary/20 shadow-sm">
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-muted-foreground">No pending attendance requests to review</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Processed Requests Tab */}
        <TabsContent value="processed" className="mt-6 space-y-6">
          {processedAttendanceRequests.length > 0 && (
            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarPlus className="h-5 w-5 text-primary" />
                  Processed Attendance Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {processedAttendanceRequests.map(request => (
                    <div 
                      key={request.id} 
                      className="p-4 border rounded-xl space-y-3 bg-gradient-to-br from-background to-muted/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <p className="font-semibold text-lg">{request.employeeName}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <CalendarDays className="h-4 w-4" />
                              {request.date}
                            </div>
                          </div>
                        </div>
                        <Badge className={request.status === 'approved' 
                          ? "bg-green-500/10 text-green-600 border-green-500/20" 
                          : "bg-red-500/10 text-red-600 border-red-500/20"
                        }>
                          {request.status === 'approved' ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Approved</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Rejected</>
                          )}
                        </Badge>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Requested Punch In</p>
                          <p className="font-medium">{request.requestedPunchIn}</p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Requested Punch Out</p>
                          <p className="font-medium">{request.requestedPunchOut}</p>
                        </div>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground font-medium mb-1">Reason</p>
                        <p className="text-sm">{request.reason}</p>
                      </div>
                      {request.approvedAt && (
                        <p className="text-xs text-muted-foreground">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'} on {new Date(request.approvedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {processedEditRequests.length > 0 && (
            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Edit className="h-5 w-5 text-primary" />
                  Processed Edit Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {processedEditRequests.map(request => (
                    <div 
                      key={request.id} 
                      className="p-4 border rounded-xl space-y-3 bg-gradient-to-br from-background to-muted/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <p className="font-semibold text-lg">{request.employeeName}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <CalendarDays className="h-4 w-4" />
                              {request.date}
                            </div>
                          </div>
                        </div>
                        <Badge className={request.status === 'approved' 
                          ? "bg-green-500/10 text-green-600 border-green-500/20" 
                          : "bg-red-500/10 text-red-600 border-red-500/20"
                        }>
                          {request.status === 'approved' ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Approved</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Rejected</>
                          )}
                        </Badge>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Punch In</p>
                          <p className="font-medium">
                            {new Date(request.currentPunchIn).toLocaleTimeString('en-US', { 
                              hour: '2-digit', minute: '2-digit', hour12: true 
                            })}
                          </p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Requested Punch Out</p>
                          <p className="font-medium">{request.requestedPunchOut}</p>
                        </div>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground font-medium mb-1">Reason</p>
                        <p className="text-sm">{request.reason}</p>
                      </div>
                      {request.approvedAt && (
                        <p className="text-xs text-muted-foreground">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'} on {new Date(request.approvedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(processedAttendanceRequests.length + processedEditRequests.length) === 0 && (
            <Card className="border-primary/20 shadow-sm">
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/30 mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium">No processed requests</p>
                  <p className="text-muted-foreground">Approved and rejected requests will appear here</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Attendance Records
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {attendanceRecords.map(record => (
                    <div 
                      key={record.id} 
                      className="p-4 border rounded-xl space-y-4 hover:border-primary/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-lg">{record.employeeName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {record.employeeCode && (
                                  <Badge variant="outline" className="text-xs">{record.employeeCode}</Badge>
                                )}
                                {record.source && (
                                  <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600">
                                    {record.source}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <CalendarDays className="h-4 w-4" />
                              {record.date}
                            </div>
                            {record.punchOut && calculateHours(record.punchIn, record.punchOut) && (
                              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                {calculateHours(record.punchIn, record.punchOut)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {record.isLate && (
                            <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Late
                            </Badge>
                          )}
                          <Badge className={record.punchOut 
                            ? "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20" 
                            : "bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20"
                          }>
                            {record.punchOut ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Complete
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                In Progress
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="bg-green-500/5 p-3 rounded-lg border border-green-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Punch In</p>
                          <p className="font-medium text-green-600">{formatTime(record.punchIn)}</p>
                          {record.punchInLocation && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {typeof record.punchInLocation === 'object' && record.punchInLocation.lat && record.punchInLocation.lng
                                ? `${record.punchInLocation.lat.toFixed(4)}, ${record.punchInLocation.lng.toFixed(4)}`
                                : record.punchInLocation}
                            </p>
                          )}
                        </div>
                        <div className="bg-red-500/5 p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Punch Out</p>
                          <p className="font-medium text-red-600">{formatTime(record.punchOut)}</p>
                          {record.punchOutLocation && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {typeof record.punchOutLocation === 'object' && record.punchOutLocation.lat && record.punchOutLocation.lng
                                ? `${record.punchOutLocation.lat.toFixed(4)}, ${record.punchOutLocation.lng.toFixed(4)}`
                                : record.punchOutLocation}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        {!record.punchOut && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditAttendance(record)}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Add Punch Out
                          </Button>
                        )}
                        {!record.isLate && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => { setMarkLateRecord(record); setShowMarkLateDialog(true); }}
                            className="gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Mark Late
                          </Button>
                        )}
                        {isWeekend(record.date) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => { setCompOffRecord(record); setShowCompOffDialog(true); }}
                            className="gap-2 border-green-500/30 text-green-600 hover:bg-green-500/10"
                          >
                            <Gift className="h-4 w-4" />
                            Grant Comp Off
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {attendanceRecords.length === 0 && (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <Clock className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-medium">No records found</p>
                      <p className="text-muted-foreground">No attendance records available</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Attendance Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              Add punch out time for {selectedRecord?.employeeName} on {selectedRecord?.date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Punch In</p>
              <p className="font-medium">
                {selectedRecord?.punchIn && new Date(selectedRecord.punchIn).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Punch Out Time</label>
              <Input
                type="time"
                value={editPunchOut}
                onChange={(e) => setEditPunchOut(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitEdit}>
              Update Attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Attendance Dialog */}
      <Dialog open={showAddAttendanceDialog} onOpenChange={setShowAddAttendanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Attendance</DialogTitle>
            <DialogDescription>
              Mark attendance for any employee on any date
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
                value={addAttendanceEmployeeId}
                onValueChange={setAddAttendanceEmployeeId}
                placeholder="Select employee"
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={addAttendanceDate}
                onChange={(e) => setAddAttendanceDate(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Punch In Time</Label>
                <Input
                  type="time"
                  value={addAttendancePunchIn}
                  onChange={(e) => setAddAttendancePunchIn(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Punch Out Time</Label>
                <Input
                  type="time"
                  value={addAttendancePunchOut}
                  onChange={(e) => setAddAttendancePunchOut(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAttendanceDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitAddAttendance}>
              Add Attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Late Dialog */}
      <Dialog open={showMarkLateDialog} onOpenChange={setShowMarkLateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Mark Employee Late
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to mark <strong>{markLateRecord?.employeeName}</strong> as late for <strong>{markLateRecord?.date}</strong>?
            </DialogDescription>
          </DialogHeader>
          {markLateRecord && (
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p><span className="text-muted-foreground">Punch In:</span> <span className="font-medium">{formatTime(markLateRecord.punchIn)}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMarkLateDialog(false); setMarkLateRecord(null); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleMarkLate}>
              Confirm Mark Late
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Comp Off Dialog */}
      <Dialog open={showCompOffDialog} onOpenChange={setShowCompOffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-500" />
              Grant Compensatory Off
            </DialogTitle>
            <DialogDescription>
              Grant a comp off to <strong>{compOffRecord?.employeeName}</strong> for working on <strong>{compOffRecord?.date}</strong> (weekend).
            </DialogDescription>
          </DialogHeader>
          {compOffRecord && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                <p><span className="text-muted-foreground">Employee:</span> <span className="font-medium">{compOffRecord.employeeName}</span></p>
                <p><span className="text-muted-foreground">Date Worked:</span> <span className="font-medium">{compOffRecord.date} ({new Date(compOffRecord.date).toLocaleDateString('en-US', { weekday: 'long' })})</span></p>
                <p><span className="text-muted-foreground">Hours:</span> <span className="font-medium">{calculateHours(compOffRecord.punchIn, compOffRecord.punchOut) || 'In Progress'}</span></p>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  placeholder="Reason for granting compensatory off..."
                  value={compOffReason}
                  onChange={(e) => setCompOffReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCompOffDialog(false); setCompOffRecord(null); setCompOffReason(''); }}>
              Cancel
            </Button>
            <Button onClick={handleGrantCompOff} className="bg-green-600 hover:bg-green-700">
              Grant Comp Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceManagement;
