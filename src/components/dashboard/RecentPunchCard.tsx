import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock, LogIn, LogOut, Coffee, Award, Target, Activity,
  Sunrise, Sunset, Moon
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { calculateWorkHoursNum, formatLocalDate } from '@/lib/dateUtils';

interface RecentPunchCardProps {
  employeeData?: any;
  onPunchUpdate?: () => void;
}

const RecentPunchCard = ({ employeeData: externalEmployeeData, onPunchUpdate }: RecentPunchCardProps) => {
  const { user, organizationId } = useAuth();
  const [employeeData, setEmployeeData] = useState<any>(externalEmployeeData || null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [yesterdayAttendance, setYesterdayAttendance] = useState<any>(null);
  const [isPunchLoading, setIsPunchLoading] = useState(false);
  const [stats, setStats] = useState({
    avgWorkHours: 0,
    weeklyHours: [0, 0, 0, 0, 0, 0, 0],
  });

  useEffect(() => {
    if (externalEmployeeData) setEmployeeData(externalEmployeeData);
  }, [externalEmployeeData]);

  useEffect(() => {
    if (user) {
      if (!externalEmployeeData) fetchEmployeeData();
      fetchTodayAttendance();
      fetchYesterdayAttendance();
      calculateWorkStats();
    }
  }, [user]);

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

  const fetchTodayAttendance = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid),
        where('date', '==', today)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setTodayAttendance({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setTodayAttendance(null);
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  }, [user]);

  const fetchYesterdayAttendance = async () => {
    if (!user) return;
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatLocalDate(yesterday);
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid),
        where('date', '==', yesterdayStr)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setYesterdayAttendance({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (error) {
      console.error('Error fetching yesterday attendance:', error);
    }
  };

  const calculateWorkStats = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'attendance'), where('employeeId', '==', user.uid));
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(d => d.data());
      
      // Initialize array for Monday (index 0) to Sunday (index 6)
      const weeklyHours = [0, 0, 0, 0, 0, 0, 0];
      let totalHours = 0;
      let daysWorked = 0;

      // Get current date and calculate start of week (Monday)
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Calculate days since Monday (if today is Sunday, getDay() returns 0, so we need to adjust)
      const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
      
      // Get Monday of current week
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysSinceMonday);
      monday.setHours(0, 0, 0, 0);
      
      // Get Sunday of current week
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      records.forEach((record: any) => {
        if (record.punchIn && record.punchOut) {
          const recordDate = new Date(record.date);
          recordDate.setHours(0, 0, 0, 0);
          
          // Check if record is within current week (Monday to Sunday)
          if (recordDate >= monday && recordDate <= sunday) {
            const hours = calculateWorkHoursNum(record.punchIn, record.punchOut);
            
            // Calculate day index (0 for Monday, 6 for Sunday)
            // JavaScript getDay(): 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
            // We want: 0 = Monday, 1 = Tuesday, 2 = Wednesday, 3 = Thursday, 4 = Friday, 5 = Saturday, 6 = Sunday
            const dayIndex = recordDate.getDay() === 0 ? 6 : recordDate.getDay() - 1;
            
            weeklyHours[dayIndex] = hours;
            totalHours += hours;
            daysWorked++;
          }
        }
      });

      const avgHours = daysWorked > 0 ? totalHours / daysWorked : 0;
      setStats({ 
        avgWorkHours: parseFloat(avgHours.toFixed(1)), 
        weeklyHours 
      });
    } catch (error) {
      console.error('Error calculating work stats:', error);
    }
  };

  const getLocation = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => reject(error)
      );
    });
  };

  const handlePunchIn = async () => {
    if (!user || !employeeData) return;
    setIsPunchLoading(true);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (todayAttendance) {
        toast.error('You have already punched in today!');
        setIsPunchLoading(false);
        return;
      }

      let location = null;
      try { location = await getLocation(); } catch (e) { console.warn('Location not available:', e); }

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

      // Instantly update local state
      setTodayAttendance({
        id: docRef.id,
        employeeId: user.uid,
        date: today,
        punchIn: punchInTime,
        punchOut: null,
        punchInLocation: location,
        punchOutLocation: null,
      });

      toast.success('Punched in successfully!');
      onPunchUpdate?.();
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
      try { location = await getLocation(); } catch (e) { console.warn('Location not available:', e); }

      const punchOutNow = new Date();
      const punchOutTime = punchOutNow.toISOString();
      const punchOutDateStr = `${punchOutNow.getFullYear()}-${String(punchOutNow.getMonth() + 1).padStart(2, '0')}-${String(punchOutNow.getDate()).padStart(2, '0')}`;
      await updateDoc(doc(db, 'attendance', todayAttendance.id), {
        punchOut: punchOutTime,
        punchOutDate: punchOutDateStr,
        punchOutLocation: location
      });

      // Instantly update local state
      setTodayAttendance((prev: any) => ({ ...prev, punchOut: punchOutTime, punchOutLocation: location }));

      toast.success('Punched out successfully!');
      onPunchUpdate?.();
    } catch (error) {
      console.error('Error punching out:', error);
      toast.error('Failed to punch out');
    } finally {
      setIsPunchLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const calculateTotalHours = (punchIn: string, punchOut: string) => {
    let punchInDate = new Date(punchIn);
    let punchOutDate = new Date(punchOut);
    if (punchOutDate.getTime() <= punchInDate.getTime()) {
      punchOutDate = new Date(punchOutDate.getTime() + 24 * 60 * 60 * 1000);
    }
    return ((punchOutDate.getTime() - punchInDate.getTime()) / (1000 * 60 * 60)).toFixed(2);
  };

  const getGreetingIcon = () => {
    const hour = new Date().getHours();
    if (hour < 12) return <Sunrise className="h-5 w-5 text-yellow-500" />;
    if (hour < 18) return <Sunset className="h-5 w-5 text-orange-500" />;
    return <Moon className="h-5 w-5 text-indigo-500" />;
  };

  const getPunchStatus = () => {
    if (!todayAttendance) return 'not-started';
    if (todayAttendance.punchIn && !todayAttendance.punchOut) return 'punched-in';
    if (todayAttendance.punchIn && todayAttendance.punchOut) return 'completed';
    return 'not-started';
  };

  const punchStatus = getPunchStatus();

  return (
    <Card className="shadow-sm border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Recent Card Punch
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Status Banner */}
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-3 ${
          punchStatus === 'completed' ? 'bg-green-100 dark:bg-green-900/20' :
          punchStatus === 'punched-in' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
          'bg-gray-100 dark:bg-gray-800'
        }`}>
          {getGreetingIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {punchStatus === 'completed' && 'Day completed! Great job!'}
              {punchStatus === 'punched-in' && 'You are currently punched in'}
              {punchStatus === 'not-started' && 'Ready to start your day?'}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Yesterday's Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Yesterday</p>
              <Coffee className="h-4 w-4 text-gray-400" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">In</span>
                <span className="font-semibold">{yesterdayAttendance?.punchIn ? formatTime(yesterdayAttendance.punchIn) : '--:--'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Out</span>
                <span className="font-semibold">{yesterdayAttendance?.punchOut ? formatTime(yesterdayAttendance.punchOut) : '--:--'}</span>
              </div>
              {yesterdayAttendance?.punchOut && (
                <div className="flex justify-between text-xs text-green-600 font-medium pt-1 border-t">
                  <span>Total</span>
                  <span>{calculateTotalHours(yesterdayAttendance.punchIn, yesterdayAttendance.punchOut)} hrs</span>
                </div>
              )}
            </div>
          </div>

          {/* Today's Card */}
          <div className={`rounded-xl p-4 shadow-sm border ${
            punchStatus === 'completed' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
            punchStatus === 'punched-in' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
            'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Today</p>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">In</span>
                <span className="font-semibold">{todayAttendance?.punchIn ? formatTime(todayAttendance.punchIn) : '--:--'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Out</span>
                <span className="font-semibold">{todayAttendance?.punchOut ? formatTime(todayAttendance.punchOut) : '--:--'}</span>
              </div>
              {todayAttendance?.punchIn && !todayAttendance?.punchOut && (
                <div className="text-xs text-yellow-600 font-medium pt-1">
                  Working since {formatTime(todayAttendance.punchIn)}
                </div>
              )}
              {todayAttendance?.punchOut && (
                <div className="flex justify-between text-xs text-green-600 font-medium pt-1 border-t">
                  <span>Total</span>
                  <span>{calculateTotalHours(todayAttendance.punchIn, todayAttendance.punchOut)} hrs</span>
                </div>
              )}
            </div>
          </div>

          {/* Average Hours */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-4 shadow-sm border border-purple-100 dark:border-purple-900">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Average</p>
              <Award className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.avgWorkHours}</p>
              <p className="text-xs text-muted-foreground mt-1">hours per day</p>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-center bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            {punchStatus === 'completed' ? (
              <div className="text-center">
                <Badge className="bg-green-500 mb-2">Day Complete</Badge>
                <p className="text-xs text-muted-foreground">See you tomorrow!</p>
              </div>
            ) : punchStatus === 'punched-in' ? (
              <Button
                onClick={handlePunchOut}
                disabled={isPunchLoading}
                size="lg"
                className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isPunchLoading ? 'Processing...' : 'Punch Out'}
              </Button>
            ) : (
              <Button
                onClick={handlePunchIn}
                disabled={isPunchLoading}
                size="lg"
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {isPunchLoading ? 'Processing...' : 'Punch In'}
              </Button>
            )}
          </div>
        </div>

        {/* Weekly Progress */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Weekly Progress (Mon - Sun)
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Target: 40 hrs</span>
              <Badge variant="outline" className="text-xs">
                {stats.weeklyHours.reduce((a, b) => a + b, 0).toFixed(1)} hrs
              </Badge>
            </div>
          </div>
          <div className="flex gap-1 h-8">
            {stats.weeklyHours.map((hours, i) => {
              const percentage = Math.min((hours / 8) * 100, 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentPunchCard;
