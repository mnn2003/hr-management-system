import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, Clock, CalendarCheck, TrendingUp, Briefcase, FileText, User, Building2, LogIn, LogOut } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import BirthdayWidget from './BirthdayWidget';
import { toast } from 'sonner';
import { calculateWorkHoursNum, formatLocalDate } from '@/lib/dateUtils';

const HodDashboard = () => {
  const { user, organizationId } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [employeeData, setEmployeeData] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [isPunchLoading, setIsPunchLoading] = useState(false);
  const [departmentName, setDepartmentName] = useState('');
  const [deptStats, setDeptStats] = useState({
    totalMembers: 0,
    pendingLeaves: 0,
    todayPresent: 0,
  });
  const [personalStats, setPersonalStats] = useState({
    avgWorkHours: 0,
    weeklyHours: [0, 0, 0, 0, 0, 0, 0],
  });
  const [widgetPreferences, setWidgetPreferences] = useState({
    birthdayWidget: true,
    statsCards: true,
    quickActions: true,
    todayAttendance: true,
    workStats: true,
  });

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
      fetchTodayAttendance();
      loadWidgetPreferences();
    }
  }, [user, organizationId]);

  useEffect(() => {
    if (employeeData) {
      fetchDepartmentStats();
      calculateWorkStats();
    }
  }, [employeeData]);

  const loadWidgetPreferences = async () => {
    if (!user) return;
    try {
      const prefsDoc = await getDocs(query(collection(db, 'user_preferences'), where('userId', '==', user.uid)));
      if (!prefsDoc.empty && prefsDoc.docs[0].data().dashboardWidgets) {
        setWidgetPreferences(prev => ({ ...prev, ...prefsDoc.docs[0].data().dashboardWidgets }));
      }
    } catch (error) {
      console.error('Error loading widget preferences:', error);
    }
  };

  const fetchEmployeeData = async () => {
    if (!user) return;
    try {
      // Try doc ID first
      const empDoc = await getDoc(doc(db, 'employees', user.uid));
      if (empDoc.exists()) {
        setEmployeeData({ id: empDoc.id, ...empDoc.data() });
        return;
      }
      const q = query(collection(db, 'employees'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setEmployeeData({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  };

  const fetchDepartmentStats = async () => {
    if (!user || !organizationId) return;
    try {
      // Find department where this user is HOD
      const deptQuery = query(
        collection(db, 'departments'),
        where('organizationId', '==', organizationId),
        where('hodId', '==', user.uid)
      );
      const deptSnap = await getDocs(deptQuery);
      if (deptSnap.empty) return;

      const deptDoc = deptSnap.docs[0];
      const deptData = deptDoc.data();
      setDepartmentName(deptData.name || 'My Department');

      // Get department employees
      const deptId = deptDoc.id;
      const empQuery = query(
        collection(db, 'employees'),
        where('organizationId', '==', organizationId)
      );
      const empSnap = await getDocs(empQuery);
      const deptEmployees = empSnap.docs.filter(d => {
        const data = d.data();
        return data.departmentId === deptId || data.department === deptData.name;
      });
      const deptEmployeeIds = deptEmployees.map(d => d.data().userId || d.id);

      // Pending leaves for dept employees
      const leavesQuery = query(
        collection(db, 'leaves'),
        where('organizationId', '==', organizationId),
        where('status', '==', 'PENDING')
      );
      const leavesSnap = await getDocs(leavesQuery);
      const pendingLeaves = leavesSnap.docs.filter(d => deptEmployeeIds.includes(d.data().employeeId)).length;

      // Today's attendance for dept
      const today = formatLocalDate(new Date());
      const attQuery = query(
        collection(db, 'attendance'),
        where('date', '==', today)
      );
      const attSnap = await getDocs(attQuery);
      const todayPresent = attSnap.docs.filter(d => deptEmployeeIds.includes(d.data().employeeId)).length;

      setDeptStats({
        totalMembers: deptEmployees.length,
        pendingLeaves,
        todayPresent,
      });
    } catch (error) {
      console.error('Error fetching department stats:', error);
    }
  };

  const fetchTodayAttendance = async () => {
    if (!user) return;
    try {
      const today = formatLocalDate(new Date());
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid),
        where('date', '==', today)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setTodayAttendance({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
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
    if (!user || !employeeData) return;
    setIsPunchLoading(true);
    try {
      const today = formatLocalDate(new Date());
      if (todayAttendance) {
        toast.error('You have already punched in today!');
        setIsPunchLoading(false);
        return;
      }

      let location = null;
      try {
        location = await getLocation();
      } catch (e) {
        console.warn('Location not available:', e);
      }

      const punchInTime = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'attendance'), {
        employeeId: user.uid,
        employeeDocumentId: employeeData.id || user.uid,
        employeeName: employeeData?.name || '',
        employeeCode: employeeData?.employeeCode || '',
        date: today,
        punchIn: punchInTime,
        punchInLocation: location,
        punchOut: null,
        punchOutLocation: null,
        organizationId: organizationId || null,
        source: 'employee_punch'
      });
      setTodayAttendance({ id: docRef.id, employeeId: user.uid, date: today, punchIn: punchInTime, punchOut: null });
      toast.success('Punched in successfully!');
    } catch (error) {
      console.error('Error punching in:', error);
      toast.error('Failed to punch in');
    } finally {
      setIsPunchLoading(false);
    }
  };

  const handlePunchOut = async () => {
    if (!user || !todayAttendance?.id) return;
    setIsPunchLoading(true);
    try {
      if (todayAttendance.punchOut) {
        toast.error('You have already punched out today!');
        setIsPunchLoading(false);
        return;
      }

      let location = null;
      try {
        location = await getLocation();
      } catch (e) {
        console.warn('Location not available:', e);
      }

      const punchOutNow = new Date();
      const punchOutTime = punchOutNow.toISOString();
      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        punchOut: punchOutTime,
        punchOutDate: formatLocalDate(punchOutNow),
        punchOutLocation: location
      });
      setTodayAttendance({ ...todayAttendance, punchOut: punchOutTime });
      toast.success('Punched out successfully!');
    } catch (error) {
      console.error('Error punching out:', error);
      toast.error('Failed to punch out');
    } finally {
      setIsPunchLoading(false);
    }
  };

  const calculateWorkStats = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'attendance'), where('employeeId', '==', user.uid));
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(d => d.data());
      const weeklyHours = [0, 0, 0, 0, 0, 0, 0];
      let totalHours = 0;
      let daysWorked = 0;
      records.forEach((record: any) => {
        if (record.punchIn && record.punchOut) {
          const hours = calculateWorkHoursNum(record.punchIn, record.punchOut);
          const daysDiff = Math.floor((new Date().getTime() - new Date(record.date).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff < 7) {
            weeklyHours[6 - daysDiff] = hours;
            totalHours += hours;
            daysWorked++;
          }
        }
      });
      setPersonalStats({ avgWorkHours: parseFloat((daysWorked > 0 ? totalHours / daysWorked : 0).toFixed(1)), weeklyHours });
    } catch (error) {
      console.error('Error calculating work stats:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Mobile Quick Stats */}
      {isMobile && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
          <div className="text-center">
            <div className="font-bold text-base text-indigo-900">{deptStats.totalMembers}</div>
            <div className="text-[10px] sm:text-xs text-indigo-600 font-medium truncate">Team</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-base text-orange-900">{deptStats.pendingLeaves}</div>
            <div className="text-[10px] sm:text-xs text-orange-600 font-medium truncate">Pending</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-base text-green-900">{deptStats.todayPresent}</div>
            <div className="text-[10px] sm:text-xs text-green-600 font-medium truncate">Present</div>
          </div>
        </div>
      )}

      {/* Greeting & Header */}
      <Card className="w-full shadow-sm border-0 sm:border">
        <CardHeader className="pb-3 sm:pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 sm:space-y-2">
              <CardTitle className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {getGreeting()}, {employeeData?.name || user?.email?.split('@')[0] || 'User'}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm md:text-base">
                Head of Department — {departmentName || 'Loading...'}
              </CardDescription>
            </div>
            {!isMobile && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="px-2 py-1 text-xs sm:px-3 sm:py-1 sm:text-sm">
                  <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Badge>
                <Badge variant="outline" className="px-2 py-1 text-xs sm:px-3 sm:py-1 sm:text-sm">
                  <Building2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                  HOD
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Personal Punch In/Out */}
      {widgetPreferences.todayAttendance && (
        <Card className={`${todayAttendance ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}>
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${todayAttendance ? 'bg-green-500/20' : 'bg-blue-500/20'} flex items-center justify-center`}>
                  <Clock className={`h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 ${todayAttendance ? 'text-green-600' : 'text-blue-600'}`} />
                </div>
                <div className="min-w-0">
                  <h3 className={`font-semibold text-sm sm:text-base md:text-lg ${todayAttendance ? 'text-green-900' : 'text-blue-900'} truncate`}>My Attendance</h3>
                  <p className={`text-xs sm:text-sm ${todayAttendance ? 'text-green-600' : 'text-blue-600'} truncate`}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              {todayAttendance ? (
                <div className="grid grid-cols-2 sm:flex sm:gap-4 md:gap-6 gap-2 items-center">
                  <div className="text-center min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">Punch In</p>
                    <p className="text-base sm:text-lg md:text-xl font-bold text-green-600 truncate">
                      {new Date(todayAttendance.punchIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                  {todayAttendance.punchOut ? (
                    <>
                      <div className="text-center min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">Punch Out</p>
                        <p className="text-base sm:text-lg md:text-xl font-bold text-red-600 truncate">
                          {new Date(todayAttendance.punchOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                      <div className="col-span-2 sm:col-auto text-center min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">Total Hours</p>
                        <p className="text-base sm:text-lg md:text-xl font-bold text-primary truncate">
                          {calculateWorkHoursNum(todayAttendance.punchIn, todayAttendance.punchOut).toFixed(2)} hrs
                        </p>
                      </div>
                    </>
                  ) : (
                    <Button onClick={handlePunchOut} disabled={isPunchLoading} className="bg-red-600 hover:bg-red-700 text-white">
                      <LogOut className="h-4 w-4 mr-2" />
                      {isPunchLoading ? 'Processing...' : 'Punch Out'}
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={handlePunchIn} disabled={isPunchLoading} className="bg-green-600 hover:bg-green-700 text-white">
                  <LogIn className="h-4 w-4 mr-2" />
                  {isPunchLoading ? 'Processing...' : 'Punch In'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Stats */}
      {widgetPreferences.statsCards && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {departmentName} — Department Overview
          </h3>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/employee-directory')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-indigo-900 truncate">Team Members</CardTitle>
                <div className="p-1 sm:p-2 bg-indigo-100 rounded-lg">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-indigo-900">{deptStats.totalMembers}</div>
                <p className="text-[10px] sm:text-xs text-indigo-600 mt-0.5 sm:mt-1 truncate">In your department</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/leave-approvals')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-orange-900 truncate">Pending Leaves</CardTitle>
                <div className="p-1 sm:p-2 bg-orange-100 rounded-lg">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-900">{deptStats.pendingLeaves}</div>
                <p className="text-[10px] sm:text-xs text-orange-600 mt-0.5 sm:mt-1 truncate">Awaiting your approval</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/attendance-management')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-green-900 truncate">Present Today</CardTitle>
                <div className="p-1 sm:p-2 bg-green-100 rounded-lg">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-900">{deptStats.todayPresent}</div>
                <p className="text-[10px] sm:text-xs text-green-600 mt-0.5 sm:mt-1 truncate">Department attendance</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Birthday Widget */}
      {widgetPreferences.birthdayWidget && <BirthdayWidget />}

      {/* Personal Work Stats + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {widgetPreferences.workStats && (
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-600" />
                </div>
                <div className="text-right">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-900">{personalStats.avgWorkHours}</div>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs sm:text-sm">My Hours</Badge>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-purple-600 mt-3 sm:mt-4">avg hours / week</p>
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">2 Hours</span>
                  <span className="text-muted-foreground">10 Hours</span>
                </div>
                <div className="h-12 sm:h-16 flex items-end gap-1">
                  {personalStats.weeklyHours.map((hours, i) => (
                    <div key={i} className="flex-1 bg-purple-400 rounded-t transition-all" style={{ height: hours > 0 ? `${Math.min((hours / 10) * 100, 100)}%` : '4%' }} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {widgetPreferences.quickActions && (
          <Card className="border-indigo-200">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-indigo-900 text-base sm:text-lg">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 space-y-2">
              <Button onClick={() => navigate('/leave-approvals')} variant="outline" className="w-full justify-start h-auto p-2 sm:p-3 border-orange-200 hover:bg-orange-50 hover:text-orange-700 transition-colors">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
                    <CalendarCheck className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="font-medium text-sm sm:text-base truncate">Review Leave Requests</div>
                    <div className="text-xs text-muted-foreground truncate">Approve or reject department leaves</div>
                  </div>
                </div>
              </Button>
              <Button onClick={() => navigate('/attendance-management')} variant="outline" className="w-full justify-start h-auto p-2 sm:p-3 border-green-200 hover:bg-green-50 hover:text-green-700 transition-colors">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="font-medium text-sm sm:text-base truncate">Attendance Management</div>
                    <div className="text-xs text-muted-foreground truncate">View department attendance</div>
                  </div>
                </div>
              </Button>
              <Button onClick={() => navigate('/attendance-report')} variant="outline" className="w-full justify-start h-auto p-2 sm:p-3 border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="font-medium text-sm sm:text-base truncate">Attendance Report</div>
                    <div className="text-xs text-muted-foreground truncate">View department reports</div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mobile Quick Actions */}
      {isMobile && (
        <div className="bg-card border rounded-lg shadow-sm p-3 sm:p-4">
          <h3 className="font-semibold text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2">
            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/leave-approvals')} className="flex flex-col items-center justify-center gap-1 p-2 border rounded-lg text-xs font-medium hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors min-h-[60px]">
              <CalendarCheck className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate w-full text-center px-1">Leave Approvals</span>
            </button>
            <button onClick={() => navigate('/attendance-management')} className="flex flex-col items-center justify-center gap-1 p-2 border rounded-lg text-xs font-medium hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors min-h-[60px]">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate w-full text-center px-1">Attendance</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HodDashboard;
