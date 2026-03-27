import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, Clock, FileText, CalendarCheck, TrendingUp, Briefcase, User, Building2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import BirthdayWidget from './BirthdayWidget';
import RecentPunchCard from './RecentPunchCard';
import AttendanceCalendar from './AttendanceCalendar';

const AdminDashboard = () => {
  const { userRole, user, organizationId } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [widgetPreferences, setWidgetPreferences] = useState({
    birthdayWidget: true,
    recentPunch: true,
    myCalendar: true,
    statsCards: true,
    quickActions: true,
    recentActivity: true,
  });
  
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [stats, setStats] = useState({
    avgWorkHours: 0,
    weeklyTrend: '+0.5%',
    onsiteTeam: 80,
    remoteTeam: 20,
    weeklyHours: [0, 0, 0, 0, 0, 0, 0],
    totalLeaves: 0,
    usedLeaves: 0,
    totalEmployees: 0,
    pendingLeaves: 0,
    todayAttendance: 0,
  });
  
  useEffect(() => {
    fetchStats();
    loadWidgetPreferences();
  }, [user, organizationId]);

  const loadWidgetPreferences = async () => {
    if (!user) return;
    try {
      const prefsDoc = await getDocs(query(collection(db, 'user_preferences'), where('userId', '==', user.uid)));
      if (!prefsDoc.empty && prefsDoc.docs[0].data().dashboardWidgets) {
        setWidgetPreferences(prefsDoc.docs[0].data().dashboardWidgets);
      }
    } catch (error) {
      console.error('Error loading widget preferences:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Total employees - filter by organizationId
      const employeesQuery = organizationId 
        ? query(collection(db, 'employees'), where('organizationId', '==', organizationId))
        : collection(db, 'employees');
      const employeesSnap = await getDocs(employeesQuery);
      const totalEmployees = employeesSnap.size;

      // Pending leaves - filter by organizationId
      const leavesConstraints = [where('status', '==', 'PENDING')];
      if (organizationId) {
        leavesConstraints.push(where('organizationId', '==', organizationId));
      }
      const leavesQuery = query(collection(db, 'leaves'), ...leavesConstraints);
      const leavesSnap = await getDocs(leavesQuery);
      const pendingLeaves = leavesSnap.size;

      // Today's attendance - filter by organizationId
      const today = new Date().toISOString().split('T')[0];
      const attendanceConstraints = [where('date', '==', today)];
      if (organizationId) {
        attendanceConstraints.push(where('organizationId', '==', organizationId));
      }
      const attendanceQuery = query(collection(db, 'attendance'), ...attendanceConstraints);
      const attendanceSnap = await getDocs(attendanceQuery);
      const todayAttendance = attendanceSnap.size;

      setStats(prev => ({ ...prev, totalEmployees, pendingLeaves, todayAttendance }));
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handlePunchUpdate = () => {
    // Refresh calendar when punch happens
    setCalendarRefreshKey(prev => prev + 1);
  };

  const visibleWidgetsCount = [widgetPreferences.recentPunch, widgetPreferences.myCalendar].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Quick Stats Bar - Mobile Only */}
      {isMobile && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="text-center">
            <div className="font-bold text-base text-blue-900">{stats.totalEmployees}</div>
            <div className="text-[10px] sm:text-xs text-blue-600 font-medium truncate">Employees</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-base text-orange-900">{stats.pendingLeaves}</div>
            <div className="text-[10px] sm:text-xs text-orange-600 font-medium truncate">Pending</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-base text-green-900">{stats.todayAttendance}</div>
            <div className="text-[10px] sm:text-xs text-green-600 font-medium truncate">Present</div>
          </div>
        </div>
      )}

      <Card className="w-full shadow-sm border-0 sm:border">
        <CardHeader className="pb-3 sm:pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 sm:space-y-2">
              <CardTitle className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Admin Dashboard
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm md:text-base">
                Manage your organization's HR operations
              </CardDescription>
            </div>
            
            {/* Desktop Quick Actions */}
            {!isMobile && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="px-2 py-1 text-xs sm:px-3 sm:py-1 sm:text-sm">
                  <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Badge>
                <Badge variant="outline" className="px-2 py-1 text-xs sm:px-3 sm:py-1 sm:text-sm">
                  <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                  {userRole === 'hr' ? 'HR Admin' : 'HOD'}
                </Badge>
              </div>
            )}
          </div>

          {/* Attendance Section - Using reusable components */}
          {(widgetPreferences.recentPunch || widgetPreferences.myCalendar) && (
            <div className={`grid ${visibleWidgetsCount === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-6`}>
              {widgetPreferences.recentPunch && (
                <RecentPunchCard employeeData={employeeData} onPunchUpdate={handlePunchUpdate} />
              )}
              {widgetPreferences.myCalendar && (
                <AttendanceCalendar refreshKey={calendarRefreshKey} />
              )}
            </div>
          )}

          {/* Active Section Header */}
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-blue-900 text-sm sm:text-base truncate">Organization Overview</h3>
              <p className="text-xs sm:text-sm text-blue-600 truncate">Monitor employee activities and pending requests</p>
            </div>
            <Badge variant="outline" className="bg-white text-xs shrink-0">
              Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-2 sm:p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Stats Cards */}
          {widgetPreferences.statsCards && (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/employees')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-blue-900 truncate">Total Employees</CardTitle>
                  <div className="p-1 sm:p-2 bg-blue-100 rounded-lg">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-900">{stats.totalEmployees}</div>
                  <p className="text-[10px] sm:text-xs text-blue-600 mt-0.5 sm:mt-1 truncate">Active in system</p>
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
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-900">{stats.pendingLeaves}</div>
                  <p className="text-[10px] sm:text-xs text-orange-600 mt-0.5 sm:mt-1 truncate">Awaiting approval</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/attendance-management')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-green-900 truncate">Today's Attendance</CardTitle>
                  <div className="p-1 sm:p-2 bg-green-100 rounded-lg">
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-900">{stats.todayAttendance}</div>
                  <p className="text-[10px] sm:text-xs text-green-600 mt-0.5 sm:mt-1 truncate">Employees present</p>
                </CardContent>
              </Card>
            </div>
          )}

          {widgetPreferences.birthdayWidget && <BirthdayWidget />}

          {(widgetPreferences.quickActions || widgetPreferences.recentActivity) && (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {widgetPreferences.quickActions && (
                <Card className="border-blue-200">
                  <CardHeader className="p-3 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-blue-900 text-base sm:text-lg">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6 pt-0 space-y-2">
                    {userRole === 'hr' && (
                      <Button 
                        onClick={() => navigate('/employees')}
                        variant="outline"
                        className="w-full justify-start h-auto p-2 sm:p-3 border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                          </div>
                          <div className="text-left min-w-0 flex-1">
                            <div className="font-medium text-sm sm:text-base truncate">Manage Employees</div>
                            <div className="text-xs text-muted-foreground truncate">Add, edit, or remove employees</div>
                          </div>
                        </div>
                      </Button>
                    )}
                    <Button 
                      onClick={() => navigate('/leave-approvals')}
                      variant="outline"
                      className="w-full justify-start h-auto p-2 sm:p-3 border-orange-200 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
                          <CalendarCheck className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <div className="font-medium text-sm sm:text-base truncate">Review Leave Requests</div>
                          <div className="text-xs text-muted-foreground truncate">Approve or reject pending leaves</div>
                        </div>
                      </div>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {widgetPreferences.recentActivity && (
                <Card className="border-blue-200">
                  <CardHeader className="p-3 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-blue-900 text-base sm:text-lg">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6 pt-0">
                    <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                      {stats.pendingLeaves > 0 && (
                        <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-orange-500 mt-1 sm:mt-1.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-orange-900 truncate">{stats.pendingLeaves} leave request(s) pending</p>
                            <p className="text-orange-600 truncate">Requires your attention</p>
                          </div>
                        </div>
                      )}
                      {stats.todayAttendance > 0 && (
                        <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500 mt-1 sm:mt-1.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-green-900 truncate">{stats.todayAttendance} employee(s) checked in today</p>
                            <p className="text-green-600 truncate">Attendance recorded</p>
                          </div>
                        </div>
                      )}
                      {stats.pendingLeaves === 0 && stats.todayAttendance === 0 && (
                        <div className="flex items-center justify-center p-4 sm:p-6 text-muted-foreground text-sm">
                          No recent activity
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Quick Actions */}
      {isMobile && (
        <div className="bg-card border rounded-lg shadow-sm p-3 sm:p-4">
          <h3 className="font-semibold text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2">
            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => navigate('/employees')}
              className="flex flex-col items-center justify-center gap-1 p-2 border rounded-lg text-xs font-medium hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors min-h-[60px]"
            >
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate w-full text-center px-1">Employees</span>
            </button>
            <button 
              onClick={() => navigate('/leave-approvals')}
              className="flex flex-col items-center justify-center gap-1 p-2 border rounded-lg text-xs font-medium hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors min-h-[60px]"
            >
              <CalendarCheck className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate w-full text-center px-1">Leave Approvals</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
