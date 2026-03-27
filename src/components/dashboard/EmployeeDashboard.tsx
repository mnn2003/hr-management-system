import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Clock, DollarSign, Calendar, 
  FileText, User, Sunrise, Sunset, Moon,
  Cloud, CloudRain, Sun, Snowflake, Wind,
  Droplets, Eye, ThermometerSun, MapPin,
  ChevronRight, Loader2
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import BirthdayWidget from './BirthdayWidget';
import RecentPunchCard from './RecentPunchCard';
import AttendanceCalendar from './AttendanceCalendar';
import WeatherWidget from './WeatherWidget';
import { format } from 'date-fns';
import { calculateWorkHoursNum } from '@/lib/dateUtils';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [widgetPreferences, setWidgetPreferences] = useState({
    birthdayWidget: true,
    recentPunch: true,
    myCalendar: true,
    todayAttendance: true,
    profileCard: true,
    workStats: true,
    teamStats: true,
    quickActions: true,
    weatherWidget: true, // Added weather widget preference
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
  });
  const [location, setLocation] = useState<{lat: number; lon: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
      calculateWorkStats();
      loadWidgetPreferences();
      getUserLocation();
    }
  }, [user]);

   const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
          setLocationError(null);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationError('Unable to get location');
          // Set default location to Mumbai, India
          setLocation({ lat: 19.0760, lon: 72.8777 });
        }
      );
    } else {
      setLocationError('Geolocation not supported');
      // Set default location to Mumbai, India
      setLocation({ lat: 19.0760, lon: 72.8777 });
    }
  };
  
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

  const fetchEmployeeData = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'employees'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setEmployeeData({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
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
          const recordDate = new Date(record.date);
          const daysDiff = Math.floor((new Date().getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff < 7) {
            weeklyHours[6 - daysDiff] = hours;
            totalHours += hours;
            daysWorked++;
          }
        }
      });

      const avgHours = daysWorked > 0 ? totalHours / daysWorked : 0;
      setStats(prev => ({
        ...prev,
        avgWorkHours: parseFloat(avgHours.toFixed(1)),
        weeklyHours
      }));
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

  const getGreetingIcon = () => {
    const hour = new Date().getHours();
    if (hour < 12) return <Sunrise className="h-5 w-5 text-yellow-500" />;
    if (hour < 18) return <Sunset className="h-5 w-5 text-orange-500" />;
    return <Moon className="h-5 w-5 text-indigo-500" />;
  };

  const handlePunchUpdate = () => {
    setCalendarRefreshKey(prev => prev + 1);
  };

  const visibleWidgetsCount = [widgetPreferences.recentPunch, widgetPreferences.myCalendar].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <Card className="w-full shadow-sm border-0 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-3">
                {getGreetingIcon()}
                <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  {getGreeting()}, {employeeData?.name || user?.email?.split('@')[0] || 'User'}
                </span>
              </CardTitle>
              <CardDescription className="text-sm">
                Welcome to your personal dashboard
              </CardDescription>
            </div>
            {!isMobile && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="px-3 py-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(), 'EEE, MMM d')}
                </Badge>
                <Badge variant="outline" className="px-3 py-1">
                  <User className="h-3 w-3 mr-1" />
                  {employeeData?.designation || 'Employee'}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Weather Widget */}
      {widgetPreferences.weatherWidget && location && (
        <WeatherWidget 
          latitude={location.lat} 
          longitude={location.lon}
          locationError={locationError}
        />
      )}

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

      {/* Other Dashboard Sections */}
      {widgetPreferences.birthdayWidget && <BirthdayWidget />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {widgetPreferences.workStats && (
          <Card className="border-0 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  {stats.weeklyTrend}
                </Badge>
              </div>
              <div>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-300">{stats.avgWorkHours}</p>
                <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">Average hours per day</p>
              </div>
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Weekly hours</span>
                  <span className="font-medium">{stats.weeklyHours.reduce((a, b) => a + b, 0).toFixed(1)} hrs</span>
                </div>
                <div className="h-16 flex items-end gap-1">
                  {stats.weeklyHours.map((hours, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-purple-400 rounded-t transition-all duration-500" 
                        style={{ height: `${Math.min((hours / 10) * 100, 100)}%` }} 
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {widgetPreferences.teamStats && (
          <Card className="border-0 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20">
            <CardContent className="p-6">
              <div className="mb-6">
                <h3 className="font-semibold text-lg text-teal-900 dark:text-teal-300 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Overview
                </h3>
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-teal-500" />
                      <span className="text-sm text-teal-700 dark:text-teal-400">Onsite team</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-teal-900 dark:text-teal-300">{stats.onsiteTeam}%</span>
                      <Badge className="bg-teal-100 text-teal-700">+2.6%</Badge>
                    </div>
                  </div>
                  <div className="w-full bg-teal-200 rounded-full h-2">
                    <div className="bg-teal-500 rounded-full h-2" style={{ width: `${stats.onsiteTeam}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-500" />
                      <span className="text-sm text-cyan-700 dark:text-cyan-400">Remote team</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-cyan-900 dark:text-cyan-300">{stats.remoteTeam}%</span>
                      <Badge className="bg-cyan-100 text-cyan-700">+2.6%</Badge>
                    </div>
                  </div>
                  <div className="w-full bg-cyan-200 rounded-full h-2">
                    <div className="bg-cyan-500 rounded-full h-2" style={{ width: `${stats.remoteTeam}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {widgetPreferences.quickActions && (
          <Card className="md:col-span-2 border-0">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-blue-600" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Button 
                  onClick={() => navigate('/attendance')} 
                  className="h-auto py-4 flex-col gap-2 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                >
                  <Calendar className="h-6 w-6" />
                  <span className="text-sm">Attendance</span>
                </Button>
                <Button 
                  onClick={() => navigate('/leave')} 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2 border-2 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Calendar className="h-6 w-6 text-blue-600" />
                  <span className="text-sm">Leave Request</span>
                </Button>
                <Button 
                  onClick={() => navigate('/salary')} 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2 border-2 hover:bg-green-50 hover:text-green-700"
                >
                  <DollarSign className="h-6 w-6 text-green-600" />
                  <span className="text-sm">Salary</span>
                </Button>
                <Button 
                  onClick={() => navigate('/profile')} 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2 border-2 hover:bg-purple-50 hover:text-purple-700"
                >
                  <User className="h-6 w-6 text-purple-600" />
                  <span className="text-sm">Profile</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
