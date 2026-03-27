import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, getDay, isToday,
  isFuture, isPast
} from 'date-fns';

interface AttendanceRecord {
  id: string;
  date: string;
  punchIn: string;
  punchOut?: string;
  status?: string;
  isLate?: boolean;
  [key: string]: any;
}

interface ShiftData {
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
}

interface AttendanceCalendarProps {
  employeeId?: string; // Allow viewing another employee's calendar (for admin)
  refreshKey?: number; // Increment to trigger refetch
}

const AttendanceCalendar = ({ employeeId, refreshKey }: AttendanceCalendarProps) => {
  const { user, organizationId } = useAuth();
  const navigate = useNavigate();
  const targetUserId = employeeId || user?.uid;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthAttendance, setMonthAttendance] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateRecord, setSelectedDateRecord] = useState<AttendanceRecord | null>(null);
  const [selectedDateShift, setSelectedDateShift] = useState<ShiftData | null>(null);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [stats, setStats] = useState({ monthlyTarget: 0, monthlyAchieved: 0 });

  useEffect(() => {
    if (targetUserId) {
      fetchHolidays();
      fetchLeaves();
    }
  }, [targetUserId]);

  useEffect(() => {
    if (targetUserId) {
      fetchMonthAttendance();
    }
  }, [targetUserId, currentMonth, refreshKey]);

  const fetchHolidays = async () => {
    try {
      let q;
      if (organizationId) {
        q = query(collection(db, 'holidays'), where('organizationId', '==', organizationId));
      } else {
        q = collection(db, 'holidays');
      }
      const snapshot = await getDocs(q);
      setHolidays(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as object) })));
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const fetchLeaves = async () => {
    if (!targetUserId) return;
    try {
      const q = query(
        collection(db, 'leave_requests'),
        where('employeeId', '==', targetUserId),
        where('status', '==', 'approved')
      );
      const snapshot = await getDocs(q);
      setLeaves(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

  const fetchMonthAttendance = async () => {
    if (!targetUserId) return;
    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', targetUserId),
        where('date', '>=', monthStart),
        where('date', '<=', monthEnd)
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as object) })) as AttendanceRecord[];
      setMonthAttendance(records);

      const presentDays = records.filter(r => r.punchIn && r.punchOut).length;
      const totalWorkingDays = getWorkingDaysInMonth(currentMonth);
      setStats({ monthlyTarget: totalWorkingDays, monthlyAchieved: presentDays });
    } catch (error) {
      console.error('Error fetching month attendance:', error);
    }
  };

  const getWorkingDaysInMonth = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const days = eachDayOfInterval({ start, end });
    return days.filter(day => {
      const dayOfWeek = getDay(day);
      const holiday = holidays.find(h => h.date === format(day, 'yyyy-MM-dd'));
      return dayOfWeek !== 0 && !holiday;
    }).length;
  };

  const getDateStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const record = monthAttendance.find(r => r.date === dateStr);
    const holiday = holidays.find(h => h.date === dateStr);
    const leave = leaves.find(l => l.date === dateStr);
    const dayOfWeek = getDay(date);

    if (holiday) return 'holiday';
    if (leave) return 'leave';
    if (dayOfWeek === 0) return 'sunday';
    if (isFuture(date)) return 'upcoming';
    if (record) {
      if (record.punchIn && record.punchOut) return 'present';
      if (record.punchIn && !record.punchOut) return 'half';
      if (record.isLate) return 'late';
    }
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    if (isWeekday && isPast(date) && !isToday(date)) return 'absent';
    return 'none';
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500';
      case 'absent': return 'bg-red-500';
      case 'half': return 'bg-yellow-500';
      case 'late': return 'bg-orange-500';
      case 'holiday': return 'bg-purple-500';
      case 'sunday': return 'bg-pink-300';
      case 'leave': return 'bg-blue-500';
      case 'upcoming': return 'bg-gray-300';
      default: return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-green-500">Present</Badge>;
      case 'absent': return <Badge variant="destructive">Absent</Badge>;
      case 'half': return <Badge className="bg-yellow-500">Half Day</Badge>;
      case 'late': return <Badge className="bg-orange-500">Late</Badge>;
      case 'holiday': return <Badge className="bg-purple-500">Holiday</Badge>;
      case 'sunday': return <Badge className="bg-pink-500">Sunday</Badge>;
      case 'leave': return <Badge className="bg-blue-500">Leave</Badge>;
      case 'upcoming': return <Badge variant="outline" className="border-gray-300 text-gray-600">Upcoming</Badge>;
      default: return null;
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

  const handleDateClick = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const record = monthAttendance.find(r => r.date === dateStr);

    setSelectedDate(date);
    setSelectedDateRecord(record || null);
    setSelectedDateShift(null);

    if (targetUserId) {
      try {
        const assignQ = query(collection(db, 'shift_assignments'), where('employeeId', '==', targetUserId));
        const assignSnap = await getDocs(assignQ);
        if (!assignSnap.empty) {
          const assignment = assignSnap.docs[0].data();
          const shiftDoc = await getDoc(doc(db, 'shifts', assignment.shiftId));
          if (shiftDoc.exists()) {
            const s = shiftDoc.data();
            setSelectedDateShift({ shiftName: s.name || '', shiftCode: s.code || s.name || '', startTime: s.startTime || '', endTime: s.endTime || '' });
          }
        } else {
          setSelectedDateShift({ shiftName: 'General', shiftCode: 'GEN', startTime: '10:30 AM', endTime: '06:30 PM' });
        }
      } catch (e) {
        console.error('Error fetching shift:', e);
        setSelectedDateShift({ shiftName: 'General', shiftCode: 'GEN', startTime: '10:30 AM', endTime: '06:30 PM' });
      }
    }

    setShowDateDialog(true);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  return (
    <>
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            My Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold text-base">{format(currentMonth, 'MMMM yyyy')}</h3>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayLabels.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {days.map(day => {
                const status = getDateStatus(day);
                const dotColor = getStatusDot(status);
                const isTodayDate = isSameDay(day, today);
                const isFutureDate = isFuture(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    className={`h-9 flex flex-col items-center justify-center rounded-md text-xs transition-all relative
                      ${isTodayDate ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary ring-offset-2' : ''}
                      ${status === 'sunday' ? 'text-red-400' : ''}
                      ${isFutureDate ? 'opacity-60 cursor-pointer hover:bg-muted' : 'cursor-pointer hover:bg-muted'}
                      ${status === 'absent' ? 'text-red-600' : ''}
                      ${status === 'present' ? 'font-medium' : ''}
                    `}
                  >
                    {day.getDate()}
                    {dotColor && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${dotColor}`} />}
                    {isFutureDate && (
                      <span className="absolute top-1 right-1">
                        <span className="block w-1 h-1 rounded-full bg-gray-300" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-3 p-2 text-xs bg-muted/30 rounded-lg">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Present</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Absent</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Half Day</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Holiday</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Leave</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-300" /> Sunday</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Upcoming</div>
            </div>

            {/* Monthly Summary */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-lg font-bold text-green-600">{stats.monthlyAchieved}</p>
              </div>
              <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-lg font-bold text-red-600">{stats.monthlyTarget - stats.monthlyAchieved}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="text-lg font-bold text-primary">{stats.monthlyTarget}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Detail Dialog */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedDate && getStatusBadge(getDateStatus(selectedDate))}

            {/* Attendance Section */}
            <div className="rounded-lg border-l-4 border-primary p-4 bg-muted/30">
              <h4 className="font-semibold text-primary text-sm mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Attendance Details
              </h4>
              {selectedDateRecord ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Clock In</p>
                    <p className="font-semibold text-lg">{formatTime(selectedDateRecord.punchIn)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Clock Out</p>
                    <p className="font-semibold text-lg">{selectedDateRecord.punchOut ? formatTime(selectedDateRecord.punchOut) : '--:--'}</p>
                  </div>
                  {selectedDateRecord.punchOut && (
                    <div className="col-span-2 mt-2 pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                        <p className="font-bold text-primary">{calculateTotalHours(selectedDateRecord.punchIn, selectedDateRecord.punchOut)} hours</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No attendance record for this date.</p>
                  {selectedDate && isPast(selectedDate) && getDay(selectedDate) >= 1 && getDay(selectedDate) <= 5 && (
                    <Badge variant="destructive" className="mt-2">Absent</Badge>
                  )}
                  {selectedDate && isFuture(selectedDate) && (
                    <Badge variant="outline" className="mt-2">Upcoming</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Shift Section */}
            <div className="rounded-lg border-l-4 border-orange-500 p-4 bg-muted/30">
              <h4 className="font-semibold text-orange-600 text-sm mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Shift Details
              </h4>
              {selectedDateShift ? (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Shift Code</p>
                    <p className="font-semibold">{selectedDateShift.shiftCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">In Time</p>
                    <p className="font-semibold">{selectedDateShift.startTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Out Time</p>
                    <p className="font-semibold">{selectedDateShift.endTime}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading shift details...</p>
              )}
            </div>

            {/* Quick Actions - only show for self */}
            {!employeeId && selectedDate && (() => {
              const status = getDateStatus(selectedDate);
              if (status === 'holiday' || status === 'sunday' || status === 'present') return null;
              return (
                <div className="flex justify-end gap-4 pt-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowDateDialog(false); navigate('/attendance'); }}>
                    Apply Swipe
                  </Button>
                  <Button size="sm" onClick={() => { setShowDateDialog(false); navigate('/leave'); }}>
                    Apply Leave
                  </Button>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AttendanceCalendar;
