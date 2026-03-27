import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { CalendarIcon, Plus, Info, X, Clock, Briefcase, Baby, Heart, Home, Award, Coffee } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { LeaveType, LeaveRequest, LeaveBalance } from '@/types/leave';

// Indian leave rules with statutory requirements
const LEAVE_TYPE_CONFIG: Record<LeaveType, { name: string; icon: any; description: string; color: string }> = {
  PL: { name: 'Privilege Leave', icon: Award, description: 'Earned leave for personal use', color: 'text-blue-600 bg-blue-500/10' },
  CL: { name: 'Casual Leave', icon: Coffee, description: 'Short notice personal leave', color: 'text-green-600 bg-green-500/10' },
  SL: { name: 'Sick Leave', icon: Heart, description: 'Medical leave with certificate', color: 'text-orange-600 bg-orange-500/10' },
  MATERNITY: { name: 'Maternity Leave', icon: Baby, description: '26 weeks for childbirth (Female)', color: 'text-pink-600 bg-pink-500/10' },
  PATERNITY: { name: 'Paternity Leave', icon: Baby, description: '15 days for new fathers (Male)', color: 'text-cyan-600 bg-cyan-500/10' },
  ADOPTION: { name: 'Adoption Leave', icon: Baby, description: '12 weeks for adoption (Female)', color: 'text-purple-600 bg-purple-500/10' },
  SABBATICAL: { name: 'Sabbatical', icon: Briefcase, description: 'Extended leave for personal growth', color: 'text-indigo-600 bg-indigo-500/10' },
  WFH: { name: 'Work From Home', icon: Home, description: 'Remote work from home', color: 'text-teal-600 bg-teal-500/10' },
  BEREAVEMENT: { name: 'Bereavement Leave', icon: Heart, description: 'Leave for family loss', color: 'text-gray-600 bg-gray-500/10' },
  PARENTAL: { name: 'Parental Leave', icon: Baby, description: 'Unpaid leave for childcare', color: 'text-amber-600 bg-amber-500/10' },
  COMP_OFF: { name: 'Compensatory Off', icon: Clock, description: 'Leave for extra work done', color: 'text-emerald-600 bg-emerald-500/10' },
  LWP: { name: 'Leave Without Pay', icon: Clock, description: 'Unpaid leave when balance exhausted', color: 'text-red-600 bg-red-500/10' },
  VACATION: { name: 'Vacation', icon: Briefcase, description: 'Extended vacation leave', color: 'text-violet-600 bg-violet-500/10' },
};

// Gender-specific leave types as per Indian rules
const GENDER_SPECIFIC_LEAVES: Record<string, 'Male' | 'Female'> = {
  MATERNITY: 'Female',  // 26 weeks - Female only
  PATERNITY: 'Male',    // 15 days - Male only
  ADOPTION: 'Female',   // 12 weeks - Female only
};

const LeaveTab = () => {
  const { organizationId } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('PL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [employeeGender, setEmployeeGender] = useState<'Male' | 'Female' | null>(null);
  const [holidays, setHolidays] = useState<string[]>([]);

  useEffect(() => {
    fetchLeaves();
    fetchLeaveBalance();
    fetchEmployeeGender();
    fetchHolidays();
  }, [organizationId]);

  const fetchHolidays = async () => {
    try {
      // Filter holidays by organizationId
      const q = organizationId 
        ? query(collection(db, 'holidays'), where('organizationId', '==', organizationId))
        : collection(db, 'holidays');
      const holidaysSnapshot = await getDocs(q);
      const holidayDates = holidaysSnapshot.docs.map(doc => {
        const data = doc.data();
        return data.date; // Date in YYYY-MM-DD format
      });
      setHolidays(holidayDates);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const fetchEmployeeGender = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const empQuery = query(collection(db, 'employees'), where('userId', '==', currentUser.uid));
      const empSnapshot = await getDocs(empQuery);
      if (!empSnapshot.empty) {
        const empData = empSnapshot.docs[0].data();
        setEmployeeGender(empData.gender || null);
      }
    } catch (error) {
      console.error('Error fetching employee gender:', error);
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const q = query(
        collection(db, 'leaves'),
        where('employeeId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      const leavesData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest));
      setLeaves(leavesData);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast.error('Failed to fetch leaves');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const balanceDoc = await getDoc(doc(db, 'leave_balances', currentUser.uid));
      if (balanceDoc.exists()) {
        setLeaveBalance(balanceDoc.data() as LeaveBalance);
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };

  const calculateDuration = (s?: string, e?: string) => {
    const a = s ?? startDate;
    const b = e ?? endDate;
    if (!a || !b) return 0;
    const start = new Date(a + 'T00:00:00');
    const end = new Date(b + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    // Count working days (excluding Sundays and holidays)
    let workingDays = 0;
    const current = new Date(start);
    
    while (current <= end) {
      // Create date string without timezone conversion
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const isSunday = current.getDay() === 0;
      const isHoliday = holidays.includes(dateStr);
      
      // Count only if it's not Sunday and not a holiday
      if (!isSunday && !isHoliday) {
        workingDays++;
      }
      
      // Move to next day
      current.setDate(current.getDate() + 1);
    }
    
    setDuration(workingDays);
    return workingDays;
  };

  const isDateExcluded = (date: Date) => {
    // Create date string without timezone conversion
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const isSunday = date.getDay() === 0;
    const isHoliday = holidays.includes(dateStr);
    return isSunday || isHoliday;
  };

  const getExcludedDatesCount = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    let excludedCount = 0;
    const current = new Date(start);
    
    while (current <= end) {
      if (isDateExcluded(current)) {
        excludedCount++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return excludedCount;
  };

  const getTotalDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0;
  };

  useEffect(() => {
    calculateDuration();
  }, [startDate, endDate, holidays]);

  const validateForm = () => {
    if (!leaveType) {
      toast.error('Select a leave type');
      return false;
    }
    if (!startDate || !endDate) {
      toast.error('Select start and end dates');
      return false;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date cannot be before start date');
      return false;
    }
    if (!reason.trim()) {
      toast.error('Provide a reason');
      return false;
    }
    // balance check for paid leaves
    if (leaveBalance && leaveType !== 'LWP' && leaveType !== 'VACATION') {
      const available = leaveBalance[leaveType as keyof Omit<LeaveBalance, 'employeeId' | 'lastUpdated'>] || 0;
      if (available < duration) {
        toast.error(`Insufficient balance for ${LEAVE_TYPE_CONFIG[leaveType].name}. Available: ${available}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;

    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // get employee profile
      const empQuery = query(collection(db, 'employees'), where('userId', '==', currentUser.uid));
      const empSnapshot = await getDocs(empQuery);
      const empDoc = empSnapshot.docs[0];
      const employeeData = empDoc ? empDoc.data() : null;
      const employeeName = employeeData?.name || currentUser.email || 'Unknown';
      const employeeCode = employeeData?.employeeCode || '';

      // find approvers (HR + HOD)
      const hrQuery = query(collection(db, 'user_roles'), where('role', '==', 'hr'));
      const hodQuery = query(collection(db, 'user_roles'), where('role', '==', 'hod'));
      const [hrSnap, hodSnap] = await Promise.all([getDocs(hrQuery), getDocs(hodQuery)]);
      const approverIds = [
        ...hrSnap.docs.map((d) => (d.data() as any).userId),
        ...hodSnap.docs.map((d) => (d.data() as any).userId),
      ].filter(Boolean);

      if (approverIds.length === 0) {
        toast.error('No approvers found (HR/HOD)');
        setSubmitting(false);
        return;
      }

      const leaveRequest: Omit<LeaveRequest, 'id'> & { organizationId?: string } = {
        employeeId: currentUser.uid,
        employeeName,
        employeeCode,
        leaveType,
        startDate,
        endDate,
        duration,
        reason: reason.trim(),
        status: 'PENDING',
        appliedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        approverIds,
        isPaid: leaveType !== 'LWP',
        ...(organizationId && { organizationId }),
      };

      await addDoc(collection(db, 'leaves'), leaveRequest);
      toast.success('Leave application submitted');

      // reset form
      setShowForm(false);
      setLeaveType('PL');
      setStartDate('');
      setEndDate('');
      setDuration(1);
      setReason('');

      // refresh data
      await fetchLeaves();
      await fetchLeaveBalance();
    } catch (error) {
      console.error('Error submitting leave:', error);
      toast.error('Failed to submit leave application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    
    try {
      await deleteDoc(doc(db, 'leaves', leaveId));
      toast.success('Leave request cancelled successfully');
      await fetchLeaves();
      await fetchLeaveBalance();
    } catch (error) {
      console.error('Error cancelling leave:', error);
      toast.error('Failed to cancel leave request');
    }
  };

  const formattedLeaves = useMemo(() => leaves, [leaves]);

  // Filter leave types based on gender (Indian rules)
  const availableLeaveTypes = useMemo(() => {
    return Object.entries(LEAVE_TYPE_CONFIG).filter(([key]) => {
      const requiredGender = GENDER_SPECIFIC_LEAVES[key];
      if (!requiredGender) return true; // Available for all genders
      return employeeGender === requiredGender;
    });
  }, [employeeGender]);

  const pendingCount = leaves.filter(l => l.status === 'PENDING').length;
  const approvedCount = leaves.filter(l => l.status === 'APPROVED').length;
  const rejectedCount = leaves.filter(l => l.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Leave Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Apply for leave and track your requests</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? 'Close Form' : 'Apply Leave'}
        </Button>
      </div>

      {/* Mobile Quick Stats */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
          <span className="text-sm font-medium text-blue-600">{leaves.length} Total</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-sm font-medium text-yellow-600">{pendingCount} Pending</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="text-sm font-medium text-green-600">{approvedCount} Approved</span>
        </div>
      </div>

      {/* Stats Cards - Desktop */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold text-blue-600">{leaves.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/20">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <div className="p-3 rounded-full bg-yellow-500/20">
                <Info className="h-5 w-5 text-yellow-600" />
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
                <CalendarIcon className="h-5 w-5 text-green-600" />
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
                <X className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Balance */}
      {leaveBalance && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Leave Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(['PL', 'CL', 'SL', 'WFH', 'COMP_OFF'] as (keyof LeaveBalance)[]).map((k, idx) => {
                const colors = [
                  'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-600',
                  'from-green-500/10 to-green-600/5 border-green-500/20 text-green-600',
                  'from-orange-500/10 to-orange-600/5 border-orange-500/20 text-orange-600',
                  'from-purple-500/10 to-purple-600/5 border-purple-500/20 text-purple-600',
                  'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 text-cyan-600',
                ];
                return (
                  <div key={k} className={`p-4 rounded-lg bg-gradient-to-br ${colors[idx]} border flex flex-col items-center text-center`}>
                    <p className="text-xs text-muted-foreground font-medium">{k}</p>
                    <p className="text-2xl font-bold">{(leaveBalance as any)[k] ?? 0}</p>
                    <p className="text-xs text-muted-foreground">days</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Holidays */}
      {holidays.length > 0 && (
        <Card className="border-purple-500/20 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-purple-500/5 to-purple-500/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="h-5 w-5 text-purple-600" />
              Upcoming Holidays
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {holidays
                .map(dateStr => {
                  const [year, month, day] = dateStr.split('-').map(Number);
                  return { dateStr, date: new Date(year, month - 1, day) };
                })
                .filter(({ date }) => date >= new Date(new Date().setHours(0, 0, 0, 0)))
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 10)
                .map(({ dateStr, date }) => (
                  <div key={dateStr} className="flex items-center justify-between p-3 bg-purple-500/5 rounded-lg border border-purple-500/10">
                    <span className="text-sm font-medium">
                      {format(date, 'EEEE, MMMM dd, yyyy')}
                    </span>
                    <Badge className="bg-purple-500/20 text-purple-700 border-purple-500/30">Holiday</Badge>
                  </div>
                ))}
              {holidays.filter(dateStr => {
                const [year, month, day] = dateStr.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                return date >= new Date(new Date().setHours(0, 0, 0, 0));
              }).length === 0 && (
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming holidays</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
     {/* Application Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl w-[95vw] p-0 overflow-hidden">
          {/* Fixed Header */}
          <DialogHeader className="p-4 sm:p-6 border-b bg-background">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              Apply for Leave
            </DialogTitle>
          </DialogHeader>
      
          {/* Scrollable Content - Using simple overflow-y-auto */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            <div className="p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {/* Leave Type Selection - Using Select instead of Popover */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-medium">Leave Type</Label>
                  <Select value={leaveType} onValueChange={(value) => setLeaveType(value as LeaveType)}>
                    <SelectTrigger className="w-full h-auto py-2 sm:py-3 px-3 sm:px-4">
                      <SelectValue>
                        {(() => {
                          const config = LEAVE_TYPE_CONFIG[leaveType];
                          const Icon = config.icon;
                          const balance = leaveBalance ? (leaveBalance as any)[leaveType] ?? 0 : 0;
                          return (
                            <div className="flex items-center gap-2 sm:gap-3 w-full">
                              <div className={cn("p-1.5 sm:p-2 rounded-lg flex-shrink-0", config.color)}>
                                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </div>
                              <div className="text-left flex-1">
                                <p className="font-medium text-sm sm:text-base">{config.name}</p>
                              </div>
                              {leaveType !== 'LWP' && leaveType !== 'VACATION' && (
                                <Badge variant="outline" className="ml-auto flex-shrink-0 text-xs">
                                  {balance} days
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] z-[200]">
                      {availableLeaveTypes.map(([key, config]) => {
                        const Icon = config.icon;
                        const balance = leaveBalance ? (leaveBalance as any)[key] ?? 0 : 0;
                        const hasBalance = key === 'LWP' || key === 'VACATION' || balance > 0;
                        
                        if (!hasBalance) return null;
                        
                        return (
                          <SelectItem key={key} value={key} className="py-2 sm:py-3">
                            <div className="flex items-center gap-2 sm:gap-3 w-full">
                              <div className={cn("p-1.5 rounded-lg flex-shrink-0", config.color)}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-sm truncate">{config.name}</span>
                                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                                    {balance} days
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
      
                {/* Date Selection - Using simple inputs for mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="h-9 sm:h-10 text-sm sm:text-base"
                    />
                  </div>
      
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="h-9 sm:h-10 text-sm sm:text-base"
                    />
                  </div>
                </div>
      
                {/* Holiday Warning */}
                {holidays.length > 0 && startDate && endDate && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    <p>Note: Sundays and holidays are automatically excluded from working days calculation.</p>
                  </div>
                )}
      
                {/* Duration Summary */}
                {startDate && endDate && (
                  <div className="p-3 sm:p-4 rounded-xl bg-muted/50 border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                      <div>
                        <p className="text-sm font-medium">Leave Duration</p>
                        <p className="text-xs text-muted-foreground">
                          Total: {getTotalDays()} days | Excluded: {getExcludedDatesCount()} (Sun/Holidays)
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xl sm:text-2xl font-bold text-primary">{duration}</p>
                        <p className="text-xs text-muted-foreground">working days</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <Label className="text-xs">Adjust for half-days if needed</Label>
                      <Input
                        type="number"
                        value={duration}
                        step={0.5}
                        onChange={(e) => setDuration(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={getTotalDays()}
                        className="mt-1 h-8 sm:h-9 text-sm"
                      />
                    </div>
                  </div>
                )}
      
                {/* Reason */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Reason for Leave</Label>
                  <Textarea 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)} 
                    rows={3} 
                    required 
                    placeholder="Please provide a reason for your leave request..."
                    className="resize-none text-sm sm:text-base min-h-[80px] sm:min-h-[100px]"
                  />
                </div>
      
                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowForm(false)}
                    className="w-full sm:flex-1 h-9 sm:h-10 text-sm"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:flex-1 h-9 sm:h-10 text-sm"
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Leave History */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Leave History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading...</p>
            </div>
          ) : formattedLeaves.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-1">No Leave Requests</h3>
              <p className="text-sm text-muted-foreground">You haven't applied for any leaves yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {formattedLeaves.map((leave) => (
                <div 
                  key={leave.id} 
                  className={cn(
                    "p-4 rounded-lg border transition-all hover:shadow-sm",
                    leave.status === 'APPROVED' && "bg-green-500/5 border-green-500/20",
                    leave.status === 'REJECTED' && "bg-red-500/5 border-red-500/20",
                    leave.status === 'PENDING' && "bg-yellow-500/5 border-yellow-500/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          {LEAVE_TYPE_CONFIG[leave.leaveType]?.name || leave.leaveType}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {leave.startDate} — {leave.endDate}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {leave.duration} day{leave.duration > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm bg-muted/50 p-2 rounded">{leave.reason}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        className={cn(
                          leave.status === 'APPROVED' && "bg-green-500/20 text-green-700 border-green-500/30",
                          leave.status === 'REJECTED' && "bg-red-500/20 text-red-700 border-red-500/30",
                          leave.status === 'PENDING' && "bg-yellow-500/20 text-yellow-700 border-yellow-500/30"
                        )}
                      >
                        {leave.status}
                      </Badge>
                      {leave.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelLeave(leave.id)}
                          className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaveTab;
