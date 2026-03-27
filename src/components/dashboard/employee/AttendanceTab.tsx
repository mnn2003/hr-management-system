import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, getDocs, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Calendar from 'react-calendar';
import { Clock, MapPin, AlertCircle, Plus, Calendar as CalendarIcon, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { calculateWorkHoursNum } from '@/lib/dateUtils';
import 'react-calendar/dist/Calendar.css';

interface AttendanceTabProps {
  onAttendanceUpdate?: () => void;
}

const AttendanceTab = ({ onAttendanceUpdate }: AttendanceTabProps) => {
  const { user, organizationId } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [holidays, setHolidays] = useState<any[]>([]);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showEditRequestDialog, setShowEditRequestDialog] = useState(false);
  const [editRequestReason, setEditRequestReason] = useState('');
  const [editRequestPunchOut, setEditRequestPunchOut] = useState('');
  const [employeeData, setEmployeeData] = useState<any>(null);
  
  // New state for attendance request
  const [showAttendanceRequestDialog, setShowAttendanceRequestDialog] = useState(false);
  const [attendanceRequestDate, setAttendanceRequestDate] = useState('');
  const [attendanceRequestPunchIn, setAttendanceRequestPunchIn] = useState('');
  const [attendanceRequestPunchOut, setAttendanceRequestPunchOut] = useState('');
  const [attendanceRequestReason, setAttendanceRequestReason] = useState('');
  const [attendanceRequests, setAttendanceRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchAttendance();
    fetchHolidays();
    fetchEmployeeData();
    fetchAttendanceRequests();
  }, [user, organizationId]);

  const fetchEmployeeData = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'employees'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setEmployeeData({ id: snapshot.docs[0].id, ...data });
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  };

  const fetchHolidays = async () => {
    try {
      // Filter holidays by organizationId
      const q = organizationId 
        ? query(collection(db, 'holidays'), where('organizationId', '==', organizationId))
        : collection(db, 'holidays');
      const snapshot = await getDocs(q);
      const holidayList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHolidays(holidayList);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const fetchAttendanceRequests = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'attendance_requests'),
        where('employeeId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setAttendanceRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        // Fallback without orderBy
        const q = query(
          collection(db, 'attendance_requests'),
          where('employeeId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        requests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAttendanceRequests(requests);
      } else {
        console.error('Error fetching attendance requests:', error);
      }
    }
  };

  const fetchAttendance = async () => {
  if (!user) return;
  try {
    // Method 1: Try with ordering (requires index)
    try {
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      console.log('Records with order:', records);
      setAttendanceRecords(records);

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayRec = records.find((r: any) => r.date === today);
      setTodayRecord(todayRec);
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        console.log('Firestore index missing, fetching without order...');
        // Method 2: Fetch without orderBy and sort manually
        const q = query(
          collection(db, 'attendance'),
          where('employeeId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        console.log('Records without order:', records);
        setAttendanceRecords(records);

        const now2 = new Date();
        const today2 = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}-${String(now2.getDate()).padStart(2, '0')}`;
        const todayRec = records.find((r: any) => r.date === today2);
        setTodayRecord(todayRec);
        
        // Show user-friendly message
        toast.error('Please create Firestore index for better performance');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error fetching attendance:', error);
    toast.error('Failed to load attendance records');
  }
};

  const getLocation = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }),
        (error) => reject(error)
      );
    });
  };

  const handlePunchIn = async () => {
    try {
      // Check if already punched in today
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (todayRecord) {
        toast.error('You have already punched in today!');
        return;
      }

      const location = await getLocation();
      
      // Get employee data first to store consistent information
      const q = query(collection(db, 'employees'), where('userId', '==', user!.uid));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        toast.error('Employee record not found');
        return;
      }
      
      const employeeDoc = snapshot.docs[0];
      const employeeData = employeeDoc.data();
      
      await addDoc(collection(db, 'attendance'), {
        // Store BOTH IDs for consistency
        employeeId: user!.uid, // Firebase Auth UID
        employeeDocumentId: employeeDoc.id, // Employee document ID
        
        // Store employee details directly
        employeeName: employeeData.name,
        employeeCode: employeeData.employeeCode,
        
        date: today,
        punchIn: new Date().toISOString(),
        punchInLocation: location,
        punchOut: null,
        punchOutLocation: null,
        organizationId: organizationId || null,
        
        // Add source to track how record was created
        source: 'employee_punch'
      });
      toast.success('Punched in successfully!');
      fetchAttendance();
      onAttendanceUpdate?.();
    } catch (error) {
      console.error('Punch in error:', error);
      toast.error('Failed to punch in');
    }
  };

  const handlePunchOut = async () => {
    try {
      if (!todayRecord) {
        toast.error('No punch in record found for today!');
        return;
      }

      if (todayRecord.punchOut) {
        toast.error('You have already punched out today!');
        return;
      }

      const location = await getLocation();
      
      const punchOutTime = new Date();
      const punchOutDateStr = `${punchOutTime.getFullYear()}-${String(punchOutTime.getMonth() + 1).padStart(2, '0')}-${String(punchOutTime.getDate()).padStart(2, '0')}`;
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        punchOut: punchOutTime.toISOString(),
        punchOutDate: punchOutDateStr,
        punchOutLocation: location
      });
      toast.success('Punched out successfully!');
      fetchAttendance();
      onAttendanceUpdate?.();
    } catch (error) {
      console.error('Punch out error:', error);
      toast.error('Failed to punch out. Please try again.');
    }
  };

  const tileClassName = ({ date, view }: any) => {
    if (view !== 'month') return '';
    
    // Create date string in YYYY-MM-DD format avoiding timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const record = attendanceRecords.find((r: any) => r.date === dateStr);
    const holiday = holidays.find((h: any) => h.date === dateStr);
    const isSunday = date.getDay() === 0;
    
    // Get today at midnight for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    const isFuture = compareDate > today;
    
    // Holidays should always be highlighted (past, today, and future)
    if (holiday) return 'bg-purple-500/20 text-purple-700 font-bold hover:bg-purple-500/30';
    
    // Don't style future dates (except holidays which are handled above)
    if (isFuture) return 'text-muted-foreground/50';
    
    // Priority order: Present > Absent > Sunday
    if (record) return 'bg-green-500/20 text-green-700 font-semibold hover:bg-green-500/30';
    if (isSunday) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    
    // Mark as absent only if it's a weekday (Mon-Fri) in the past
    const isWeekday = date.getDay() >= 1 && date.getDay() <= 5; // Monday to Friday
    const isPastWeekday = compareDate < today && isWeekday;
    
    if (isPastWeekday) {
      return 'bg-red-100 text-red-600 font-semibold hover:bg-red-200';
    }
    
    return '';
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    
    // Create date string avoiding timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const holiday = holidays.find((h: any) => h.date === dateStr);
    const attendance = attendanceRecords.find((r: any) => r.date === dateStr);
    
    if (holiday) {
      setSelectedHoliday(holiday);
      setShowHolidayDialog(true);
    } else if (attendance) {
      setSelectedAttendance(attendance);
      setShowAttendanceDialog(true);
    }
  };

  const handleRequestEdit = (attendance: any) => {
    setSelectedAttendance(attendance);
    setEditRequestPunchOut('');
    setEditRequestReason('');
    setShowEditRequestDialog(true);
  };

  const submitEditRequest = async () => {
    if (!selectedAttendance || !editRequestPunchOut || !editRequestReason) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      // Get HR and HOD user IDs filtered by organization
      let hrQuery, hodQuery;
      
      if (organizationId) {
        hrQuery = query(
          collection(db, 'user_roles'), 
          where('role', '==', 'hr'),
          where('organizationId', '==', organizationId)
        );
        hodQuery = query(
          collection(db, 'user_roles'), 
          where('role', '==', 'hod'),
          where('organizationId', '==', organizationId)
        );
      } else {
        hrQuery = query(collection(db, 'user_roles'), where('role', '==', 'hr'));
        hodQuery = query(collection(db, 'user_roles'), where('role', '==', 'hod'));
      }
      
      const [hrSnapshot, hodSnapshot] = await Promise.all([
        getDocs(hrQuery),
        getDocs(hodQuery)
      ]);

      const approverIds = [
        ...hrSnapshot.docs.map(doc => doc.id),
        ...hodSnapshot.docs.map(doc => doc.id)
      ];

      if (approverIds.length === 0) {
        toast.error('No HR or HOD found to approve request');
        return;
      }

      await addDoc(collection(db, 'attendance_edit_requests'), {
        attendanceId: selectedAttendance.id,
        employeeId: user!.uid,
        employeeName: employeeData?.name || user!.email,
        employeeDocumentId: employeeData?.id,
        date: selectedAttendance.date,
        currentPunchIn: selectedAttendance.punchIn,
        currentPunchOut: selectedAttendance.punchOut,
        requestedPunchOut: editRequestPunchOut,
        reason: editRequestReason,
        status: 'pending',
        approverIds,
        organizationId: organizationId || null,
        createdAt: new Date().toISOString()
      });

      toast.success('Edit request submitted to HR/HOD');
      setShowEditRequestDialog(false);
      setEditRequestPunchOut('');
      setEditRequestReason('');
    } catch (error) {
      console.error('Error submitting edit request:', error);
      toast.error('Failed to submit edit request');
    }
  };

  const submitAttendanceRequest = async () => {
    if (!attendanceRequestDate || !attendanceRequestPunchIn || !attendanceRequestPunchOut || !attendanceRequestReason) {
      toast.error('Please fill all fields');
      return;
    }

    // Check if date is in future
    const requestDate = new Date(attendanceRequestDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestDate >= today) {
      toast.error('Cannot request attendance for today or future dates');
      return;
    }

    // Check if attendance already exists for this date
    const existingRecord = attendanceRecords.find(r => r.date === attendanceRequestDate);
    if (existingRecord) {
      toast.error('Attendance already exists for this date. Use edit request instead.');
      return;
    }

    try {
      // Get HR and HOD user IDs filtered by organization
      let hrQuery, hodQuery;
      
      if (organizationId) {
        hrQuery = query(
          collection(db, 'user_roles'), 
          where('role', '==', 'hr'),
          where('organizationId', '==', organizationId)
        );
        hodQuery = query(
          collection(db, 'user_roles'), 
          where('role', '==', 'hod'),
          where('organizationId', '==', organizationId)
        );
      } else {
        hrQuery = query(collection(db, 'user_roles'), where('role', '==', 'hr'));
        hodQuery = query(collection(db, 'user_roles'), where('role', '==', 'hod'));
      }
      
      const [hrSnapshot, hodSnapshot] = await Promise.all([
        getDocs(hrQuery),
        getDocs(hodQuery)
      ]);

      const approverIds = [
        ...hrSnapshot.docs.map(doc => doc.id),
        ...hodSnapshot.docs.map(doc => doc.id)
      ];

      if (approverIds.length === 0) {
        toast.error('No HR or HOD found to approve request');
        return;
      }

      await addDoc(collection(db, 'attendance_requests'), {
        employeeId: user!.uid,
        employeeName: employeeData?.name || user!.email,
        employeeDocumentId: employeeData?.id,
        date: attendanceRequestDate,
        requestedPunchIn: attendanceRequestPunchIn,
        requestedPunchOut: attendanceRequestPunchOut,
        reason: attendanceRequestReason,
        status: 'pending',
        approverIds,
        organizationId: organizationId || null,
        createdAt: new Date().toISOString()
      });

      toast.success('Attendance request submitted to HR/HOD');
      setShowAttendanceRequestDialog(false);
      setAttendanceRequestDate('');
      setAttendanceRequestPunchIn('');
      setAttendanceRequestPunchOut('');
      setAttendanceRequestReason('');
      fetchAttendanceRequests();
    } catch (error) {
      console.error('Error submitting attendance request:', error);
      toast.error('Failed to submit attendance request');
    }
  };

  const presentDays = attendanceRecords.length;
  const pendingRequests = attendanceRequests.filter(r => r.status === 'pending').length;

  // Get last 7 days attendance
  const getRecentAttendance = () => {
    const today = new Date();
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const record = attendanceRecords.find((r: any) => r.date === dateStr);
      const holiday = holidays.find((h: any) => h.date === dateStr);
      last7Days.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        record,
        holiday,
        isSunday: date.getDay() === 0
      });
    }
    return last7Days;
  };


  // Get all holidays for the current year
  const getYearlyHolidays = () => {
    const currentYear = new Date().getFullYear();
    return holidays
      .filter((h: any) => {
        const holidayYear = new Date(h.date).getFullYear();
        return holidayYear === currentYear;
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const recentAttendance = getRecentAttendance();
  const yearlyHolidays = getYearlyHolidays();

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track your daily attendance and requests</p>
        </div>
        <Button onClick={() => setShowAttendanceRequestDialog(true)} variant="outline" className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Request Attendance
        </Button>
      </div>

      {/* Mobile Quick Stats */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="text-sm font-medium text-green-600">{presentDays} Present</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-sm font-medium text-yellow-600">{pendingRequests} Pending</span>
        </div>
        {todayRecord && (
          <div className="flex-shrink-0 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
            <span className="text-sm font-medium text-blue-600">Punched In</span>
          </div>
        )}
      </div>

      {/* Stats Cards - Desktop */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Present Days</p>
                <p className="text-2xl font-bold text-green-600">{presentDays}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingRequests}</p>
              </div>
              <div className="p-3 rounded-full bg-yellow-500/20">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Holidays</p>
                <p className="text-2xl font-bold text-purple-600">{holidays.length}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/20">
                <CalendarIcon className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${todayRecord ? 'from-blue-500/10 to-blue-600/5 border-blue-500/20' : 'from-gray-500/10 to-gray-600/5 border-gray-500/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today Status</p>
                <p className={`text-lg font-bold ${todayRecord ? 'text-blue-600' : 'text-gray-600'}`}>
                  {todayRecord ? (todayRecord.punchOut ? 'Completed' : 'In Progress') : 'Not Started'}
                </p>
              </div>
              <div className={`p-3 rounded-full ${todayRecord ? 'bg-blue-500/20' : 'bg-gray-500/20'}`}>
                <Clock className={`h-5 w-5 ${todayRecord ? 'text-blue-600' : 'text-gray-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Attendance Card */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-6 w-6 text-primary" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {todayRecord ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Punch In</p>
                  <p className="text-2xl font-bold text-green-600">
                    {new Date(todayRecord.punchIn).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </p>
                </div>
                {todayRecord.punchOut && (
                  <div className="p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20">
                    <p className="text-sm text-muted-foreground mb-1">Punch Out</p>
                    <p className="text-2xl font-bold text-red-600">
                      {new Date(todayRecord.punchOut).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </p>
                  </div>
                )}
              </div>
              {!todayRecord.punchOut && (
                <Button 
                  onClick={handlePunchOut} 
                  variant="destructive" 
                  size="lg"
                  className="w-full"
                >
                  <MapPin className="mr-2 h-5 w-5" />
                  Punch Out
                </Button>
              )}
              {todayRecord.punchOut && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center">
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-xl font-bold text-primary">
                    {calculateWorkHoursNum(todayRecord.punchIn, todayRecord.punchOut).toFixed(2)} hrs
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mb-4">
                <Clock className="h-16 w-16 mx-auto text-muted-foreground/30" />
              </div>
              <p className="text-muted-foreground mb-4">You haven't punched in today</p>
              <Button onClick={handlePunchIn} size="lg" className="w-full md:w-auto">
                <MapPin className="mr-2 h-5 w-5" />
                Punch In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Attendance Requests */}
      {attendanceRequests.filter(r => r.status === 'pending').length > 0 && (
        <Card className="border-yellow-500/30 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-yellow-500/5 to-yellow-500/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Pending Attendance Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {attendanceRequests.filter(r => r.status === 'pending').map(request => (
                <div key={request.id} className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{request.date}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.requestedPunchIn} - {request.requestedPunchOut}
                      </p>
                    </div>
                    <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Pending</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{request.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processed Attendance Requests (Approved/Rejected) */}
      {attendanceRequests.filter(r => r.status !== 'pending').length > 0 && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5 text-primary" />
              Request History
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {attendanceRequests.filter(r => r.status !== 'pending').map(request => (
                <div key={request.id} className={`p-4 rounded-lg border space-y-2 ${
                  request.status === 'approved' 
                    ? 'bg-green-500/5 border-green-500/20' 
                    : 'bg-red-500/5 border-red-500/20'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{request.date}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.requestedPunchIn} - {request.requestedPunchOut}
                      </p>
                    </div>
                    <Badge className={request.status === 'approved'
                      ? "bg-green-500/20 text-green-700 border-green-500/30"
                      : "bg-red-500/20 text-red-700 border-red-500/30"
                    }>
                      {request.status === 'approved' ? 'Approved' : 'Rejected'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{request.reason}</p>
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

      {/* Recent Attendance - Last 7 Days (Only Pending & Present) */}
      {recentAttendance.filter(day => day.record || attendanceRequests.some(r => r.status === 'pending' && r.date === day.date)).length > 0 && (
        <Card className="border-blue-500/20 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-blue-600" />
              Recent Attendance
              <span className="text-sm font-normal text-muted-foreground ml-2">Last 7 days</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {recentAttendance
                .filter(day => day.record || attendanceRequests.some(r => r.status === 'pending' && r.date === day.date))
                .map((day) => {
                  const hasPendingRequest = attendanceRequests.some(r => r.status === 'pending' && r.date === day.date);
                  const pendingRequestData = attendanceRequests.find(r => r.status === 'pending' && r.date === day.date);
                  return (
                    <div 
                      key={day.date} 
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                        hasPendingRequest
                          ? 'bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20'
                          : 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20'
                      }`}
                      onClick={() => {
                        if (day.record) {
                          setSelectedAttendance(day.record);
                          setShowAttendanceDialog(true);
                        } else if (pendingRequestData) {
                          // Show pending request details in a simple way
                          setSelectedAttendance({
                            date: pendingRequestData.date,
                            punchIn: pendingRequestData.requestedPunchIn,
                            punchOut: pendingRequestData.requestedPunchOut,
                            isPendingRequest: true,
                            reason: pendingRequestData.reason,
                            status: 'pending'
                          });
                          setShowAttendanceDialog(true);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[50px]">
                          <p className="text-xs text-muted-foreground">{day.dayName}</p>
                          <p className="font-semibold">{new Date(day.date).getDate()}</p>
                        </div>
                        <div>
                          {hasPendingRequest ? (
                            <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Pending Request</Badge>
                          ) : day.record ? (
                            <div className="text-sm">
                              <span className="text-green-600 font-medium">
                                {new Date(day.record.punchIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                              {day.record.punchOut && (
                                <>
                                  <span className="text-muted-foreground mx-2">→</span>
                                  <span className="text-red-600 font-medium">
                                    {new Date(day.record.punchOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                  </span>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {day.record && day.record.punchOut && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Hours</p>
                            <p className="font-semibold text-primary">
                              {calculateWorkHoursNum(day.record.punchIn, day.record.punchOut).toFixed(1)}h
                            </p>
                          </div>
                        )}
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Calendar */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Attendance Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm">Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-200"></div>
                <span className="text-sm">Absent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-500"></div>
                <span className="text-sm">Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-200"></div>
                <span className="text-sm">Sunday</span>
              </div>
            </div>
            <Calendar
              onChange={(value: any) => setSelectedDate(value)}
              onClickDay={handleDateClick}
              value={selectedDate}
              tileClassName={tileClassName}
              className="w-full"
            />
            {attendanceRecords.length === 0 && (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No attendance records found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Public Holidays for the Year */}
      <Card className="border-orange-500/20 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-orange-500/5 to-orange-500/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5 text-orange-600" />
            Public Holidays {new Date().getFullYear()}
            <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30 ml-2">
              {yearlyHolidays.length} holidays
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {yearlyHolidays.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {yearlyHolidays.map((holiday: any) => {
                const holidayDate = new Date(holiday.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                holidayDate.setHours(0, 0, 0, 0);
                const isPast = holidayDate < today;
                
                return (
                  <div 
                    key={holiday.id} 
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      isPast 
                        ? 'bg-muted/30 border-muted opacity-60' 
                        : 'bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20'
                    }`}
                    onClick={() => {
                      setSelectedHoliday(holiday);
                      setShowHolidayDialog(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isPast ? 'bg-muted' : 'bg-orange-500/20'}`}>
                        <p className={`text-lg font-bold ${isPast ? 'text-muted-foreground' : 'text-orange-600'}`}>
                          {holidayDate.getDate()}
                        </p>
                        <p className={`text-xs ${isPast ? 'text-muted-foreground' : 'text-orange-600'}`}>
                          {format(holidayDate, 'MMM')}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {holiday.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(holidayDate, 'EEEE')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No holidays configured for this year</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Holiday Details</DialogTitle>
          </DialogHeader>
          {selectedHoliday && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="text-lg font-semibold">{(() => {
                  const [year, month, day] = selectedHoliday.date.split('-').map(Number);
                  return format(new Date(year, month - 1, day), 'MMMM dd, yyyy');
                })()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Holiday Name</p>
                <p className="text-lg font-semibold">{selectedHoliday.name}</p>
              </div>
              {selectedHoliday.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-base">{selectedHoliday.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAttendance?.isPendingRequest ? (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  Pending Attendance Request
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Attendance Details
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedAttendance && (
            <div className="space-y-4">
              {/* Status Badge for Pending Requests */}
              {selectedAttendance.isPendingRequest && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                  <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                    Awaiting Approval
                  </Badge>
                </div>
              )}
              
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="text-lg font-semibold">{format(new Date(selectedAttendance.date), 'EEEE, MMMM dd, yyyy')}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-3 rounded-lg ${selectedAttendance.isPendingRequest ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
                  <p className="text-sm text-muted-foreground mb-1">{selectedAttendance.isPendingRequest ? 'Requested Punch In' : 'Punch In'}</p>
                  <p className={`text-lg font-semibold ${selectedAttendance.isPendingRequest ? 'text-yellow-700' : 'text-green-600'}`}>
                    {selectedAttendance.isPendingRequest 
                      ? selectedAttendance.punchIn 
                      : new Date(selectedAttendance.punchIn).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })
                    }
                  </p>
                </div>
                {selectedAttendance.punchOut && (
                  <div className={`p-3 rounded-lg ${selectedAttendance.isPendingRequest ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <p className="text-sm text-muted-foreground mb-1">{selectedAttendance.isPendingRequest ? 'Requested Punch Out' : 'Punch Out'}</p>
                    <p className={`text-lg font-semibold ${selectedAttendance.isPendingRequest ? 'text-yellow-700' : 'text-red-600'}`}>
                      {selectedAttendance.isPendingRequest 
                        ? selectedAttendance.punchOut 
                        : new Date(selectedAttendance.punchOut).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          })
                      }
                    </p>
                  </div>
                )}
              </div>
              
              {/* Reason for Pending Requests */}
              {selectedAttendance.isPendingRequest && selectedAttendance.reason && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground mb-1">Request Reason</p>
                  <p className="text-sm font-medium">{selectedAttendance.reason}</p>
                </div>
              )}
              
              {/* Total Hours for Confirmed Attendance */}
              {!selectedAttendance.isPendingRequest && selectedAttendance.punchOut && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <p className="text-sm text-muted-foreground">Total Hours Worked</p>
                  <p className="text-2xl font-bold text-primary">
                    {calculateWorkHoursNum(selectedAttendance.punchIn, selectedAttendance.punchOut).toFixed(2)} hours
                  </p>
                </div>
              )}
              
              {/* No Punch Out Warning */}
              {!selectedAttendance.isPendingRequest && !selectedAttendance.punchOut && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                    <p className="text-sm text-yellow-700">No punch out recorded for this day</p>
                  </div>
                  <Button 
                    onClick={() => handleRequestEdit(selectedAttendance)} 
                    variant="outline" 
                    className="w-full"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Request Attendance Edit
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditRequestDialog} onOpenChange={setShowEditRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Attendance Edit</DialogTitle>
            <DialogDescription>
              Request HR/HOD to update your punch out time for {selectedAttendance?.date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Punch In</p>
              <p className="font-medium">
                {selectedAttendance?.punchIn && new Date(selectedAttendance.punchIn).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Requested Punch Out Time</label>
              <Input
                type="time"
                value={editRequestPunchOut}
                onChange={(e) => setEditRequestPunchOut(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Edit Request</label>
              <Textarea
                value={editRequestReason}
                onChange={(e) => setEditRequestReason(e.target.value)}
                placeholder="Please explain why you need this attendance correction..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitEditRequest}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAttendanceRequestDialog} onOpenChange={setShowAttendanceRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Attendance</DialogTitle>
            <DialogDescription>
              Request HR/HOD to mark your attendance for a past date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={attendanceRequestDate}
                onChange={(e) => setAttendanceRequestDate(e.target.value)}
                max={new Date(Date.now() - 86400000).toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Punch In Time</Label>
                <Input
                  type="time"
                  value={attendanceRequestPunchIn}
                  onChange={(e) => setAttendanceRequestPunchIn(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Punch Out Time</Label>
                <Input
                  type="time"
                  value={attendanceRequestPunchOut}
                  onChange={(e) => setAttendanceRequestPunchOut(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={attendanceRequestReason}
                onChange={(e) => setAttendanceRequestReason(e.target.value)}
                placeholder="Please explain why you need attendance marked for this date..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttendanceRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitAttendanceRequest}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceTab;
