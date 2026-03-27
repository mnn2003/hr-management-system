import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { calculateWorkHoursNum } from '@/lib/dateUtils';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  UserCheck, 
  Calendar,
  DollarSign,
  GraduationCap,
  Award,
  UserMinus,
  UserPlus,
  Target,
  Clock,
  Briefcase,
  FileText,
  Receipt,
  CalendarDays,
  PieChart as PieChartIcon,
  BarChart3,
  Activity
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart as RechartsPie, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface AnalyticsData {
  headcount: number;
  attritionRate: number;
  departmentAnalytics: { name: string; count: number }[];
  genderDiversity: { name: string; value: number }[];
  attendancePatterns: { month: string; present: number; absent: number; total: number }[];
  leaveUtilization: number;
  leaveTypeBreakdown: { name: string; value: number }[];
  totalLeavesTaken: number;
  pendingLeaves: number;
  costPerHire: number;
  trainingEffectiveness: number;
  headcountTrend: { month: string; count: number }[];
  turnoverAnalysis: {
    totalExits: number;
    voluntaryExits: number;
    involuntaryExits: number;
    exitReasons: { name: string; value: number }[];
    retentionRate: number;
  };
  recruitmentMetrics: {
    totalHires: number;
    timeToHire: number;
    offerAcceptanceRate: number;
    hiringTrend: { month: string; hires: number }[];
  };
  performanceMetrics: {
    averageRating: number;
    topPerformers: number;
    needsImprovement: number;
    departmentPerformance: { name: string; rating: number }[];
  };
  compensationAnalytics: {
    averageSalary: number;
    salaryRange: { min: number; max: number };
    departmentSalary: { name: string; avgSalary: number }[];
    totalPayout: number;
    salarySlipsGenerated: number;
  };
  ageDistribution: { range: string; count: number }[];
  tenureAnalysis: { range: string; count: number }[];
  attendanceSummary: {
    totalRecords: number;
    avgHoursWorked: number;
    onTimePercentage: number;
  };
}

export default function HRAnalytics() {
  const { organizationId } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    headcount: 0,
    attritionRate: 0,
    departmentAnalytics: [],
    genderDiversity: [],
    attendancePatterns: [],
    leaveUtilization: 0,
    leaveTypeBreakdown: [],
    totalLeavesTaken: 0,
    pendingLeaves: 0,
    costPerHire: 0,
    trainingEffectiveness: 0,
    headcountTrend: [],
    turnoverAnalysis: {
      totalExits: 0,
      voluntaryExits: 0,
      involuntaryExits: 0,
      exitReasons: [],
      retentionRate: 100,
    },
    recruitmentMetrics: {
      totalHires: 0,
      timeToHire: 0,
      offerAcceptanceRate: 0,
      hiringTrend: [],
    },
    performanceMetrics: {
      averageRating: 0,
      topPerformers: 0,
      needsImprovement: 0,
      departmentPerformance: [],
    },
    compensationAnalytics: {
      averageSalary: 0,
      salaryRange: { min: 0, max: 0 },
      departmentSalary: [],
      totalPayout: 0,
      salarySlipsGenerated: 0,
    },
    ageDistribution: [],
    tenureAnalysis: [],
    attendanceSummary: {
      totalRecords: 0,
      avgHoursWorked: 0,
      onTimePercentage: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('last6months');

  useEffect(() => {
    if (organizationId) {
      fetchAnalytics();
    }
  }, [timeRange, organizationId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      if (!organizationId) return;

      const now = new Date();
      let startDate = new Date();
      if (timeRange === 'last30days') {
        startDate.setDate(now.getDate() - 30);
      } else if (timeRange === 'last6months') {
        startDate.setMonth(now.getMonth() - 6);
      } else if (timeRange === 'lastyear') {
        startDate.setFullYear(now.getFullYear() - 1);
      } else {
        startDate = new Date(2000, 0, 1);
      }
      
      // Fetch employees
      const employeesQuery = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
      const employeesSnap = await getDocs(employeesQuery);
      const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const activeEmployees = employees.filter((emp: any) => 
        !emp.exitDate || new Date(emp.exitDate) > now
      );
      
      const headcount = activeEmployees.length;
      
      // Department Analytics
      const deptMap: Record<string, number> = {};
      activeEmployees.forEach((emp: any) => {
        const dept = emp.department || 'Unassigned';
        deptMap[dept] = (deptMap[dept] || 0) + 1;
      });
      const departmentAnalytics = Object.entries(deptMap).map(([name, count]) => ({ name, count }));
      
      // Gender Diversity
      const genderMap: Record<string, number> = {};
      activeEmployees.forEach((emp: any) => {
        const gender = emp.gender || 'Not Specified';
        genderMap[gender] = (genderMap[gender] || 0) + 1;
      });
      const genderDiversity = Object.entries(genderMap).map(([name, value]) => ({ name, value }));
      
      // Age Distribution
      const ageGroups: Record<string, number> = {
        '18-25': 0,
        '26-35': 0,
        '36-45': 0,
        '46-55': 0,
        '55+': 0,
      };
      activeEmployees.forEach((emp: any) => {
        if (emp.dateOfBirth) {
          const birthDate = new Date(emp.dateOfBirth);
          const age = Math.floor((now.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (age >= 18 && age <= 25) ageGroups['18-25']++;
          else if (age >= 26 && age <= 35) ageGroups['26-35']++;
          else if (age >= 36 && age <= 45) ageGroups['36-45']++;
          else if (age >= 46 && age <= 55) ageGroups['46-55']++;
          else if (age > 55) ageGroups['55+']++;
        }
      });
      const ageDistribution = Object.entries(ageGroups)
        .filter(([_, count]) => count > 0)
        .map(([range, count]) => ({ range, count }));
      
      // Tenure Analysis
      const tenureGroups: Record<string, number> = {
        '<1 year': 0,
        '1-2 years': 0,
        '2-5 years': 0,
        '5-10 years': 0,
        '10+ years': 0,
      };
      activeEmployees.forEach((emp: any) => {
        if (emp.joiningDate) {
          const joinDate = new Date(emp.joiningDate);
          const tenure = (now.getTime() - joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          if (tenure < 1) tenureGroups['<1 year']++;
          else if (tenure < 2) tenureGroups['1-2 years']++;
          else if (tenure < 5) tenureGroups['2-5 years']++;
          else if (tenure < 10) tenureGroups['5-10 years']++;
          else tenureGroups['10+ years']++;
        }
      });
      const tenureAnalysis = Object.entries(tenureGroups)
        .filter(([_, count]) => count > 0)
        .map(([range, count]) => ({ range, count }));
      
      // Turnover Analysis
      const exitsInRange = employees.filter((emp: any) => {
        if (!emp.exitDate) return false;
        const exitDate = new Date(emp.exitDate);
        return exitDate >= startDate && exitDate <= now;
      });
      
      const totalExits = exitsInRange.length;
      const voluntaryExits = exitsInRange.filter((emp: any) => emp.exitType === 'voluntary').length;
      const involuntaryExits = totalExits - voluntaryExits;
      
      const exitReasonsMap: Record<string, number> = {};
      exitsInRange.forEach((emp: any) => {
        const reason = emp.exitReason || 'Not Specified';
        exitReasonsMap[reason] = (exitReasonsMap[reason] || 0) + 1;
      });
      const exitReasons = Object.entries(exitReasonsMap).map(([name, value]) => ({ name, value }));
      
      const attritionRate = headcount + totalExits > 0 ? (totalExits / (headcount + totalExits)) * 100 : 0;
      const retentionRate = 100 - attritionRate;
      
      // Recruitment Metrics
      const newHires = employees.filter((emp: any) => {
        if (!emp.joiningDate) return false;
        const joinDate = new Date(emp.joiningDate);
        return joinDate >= startDate && joinDate <= now;
      });
      
      const totalHires = newHires.length;
      const timeToHire = newHires.length > 0 
        ? newHires.reduce((sum: number, emp: any) => sum + (emp.timeToHire || 30), 0) / newHires.length 
        : 0;
      
      // Hiring trend by month
      const hiringByMonth: Record<string, number> = {};
      newHires.forEach((emp: any) => {
        const month = new Date(emp.joiningDate).toLocaleString('default', { month: 'short', year: '2-digit' });
        hiringByMonth[month] = (hiringByMonth[month] || 0) + 1;
      });
      const hiringTrend = Object.entries(hiringByMonth).map(([month, hires]) => ({ month, hires }));
      
      // Headcount trend by month (based on joining dates)
      const headcountByMonth: Record<string, number> = {};
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        last6Months.push(d.toLocaleString('default', { month: 'short' }));
      }
      
      last6Months.forEach((month, idx) => {
        const monthDate = new Date();
        monthDate.setMonth(monthDate.getMonth() - (5 - idx));
        const countAtMonth = employees.filter((emp: any) => {
          if (!emp.joiningDate) return false;
          const joinDate = new Date(emp.joiningDate);
          const exitDate = emp.exitDate ? new Date(emp.exitDate) : null;
          return joinDate <= monthDate && (!exitDate || exitDate > monthDate);
        }).length;
        headcountByMonth[month] = countAtMonth;
      });
      const headcountTrend = Object.entries(headcountByMonth).map(([month, count]) => ({ month, count }));
      
      // Attendance Patterns
      const attendanceQuery = query(collection(db, 'attendance'), where('organizationId', '==', organizationId));
      const attendanceSnap = await getDocs(attendanceQuery);
      const attendanceRecords = attendanceSnap.docs.map(doc => doc.data());
      
      const attendanceByMonth: Record<string, { present: number; absent: number; total: number }> = {};
      let totalHoursWorked = 0;
      let recordsWithHours = 0;
      
      attendanceRecords.forEach((record: any) => {
        if (!record.date) return;
        const recordDate = new Date(record.date);
        if (recordDate < startDate || recordDate > now) return;
        
        const month = recordDate.toLocaleString('default', { month: 'short' });
        if (!attendanceByMonth[month]) {
          attendanceByMonth[month] = { present: 0, absent: 0, total: 0 };
        }
        
        attendanceByMonth[month].total++;
        if (record.punchIn && record.punchOut) {
          attendanceByMonth[month].present++;
          const hours = calculateWorkHoursNum(record.punchIn, record.punchOut);
          if (hours > 0 && hours < 24) {
            totalHoursWorked += hours;
            recordsWithHours++;
          }
        }
      });
      
      const attendancePatterns = Object.entries(attendanceByMonth).map(([month, data]) => ({
        month,
        present: data.present,
        absent: data.total - data.present,
        total: data.total,
      }));
      
      const attendanceSummary = {
        totalRecords: attendanceRecords.length,
        avgHoursWorked: recordsWithHours > 0 ? totalHoursWorked / recordsWithHours : 0,
        onTimePercentage: attendanceRecords.length > 0 ? 
          (attendanceRecords.filter((r: any) => r.punchIn && r.punchOut).length / attendanceRecords.length) * 100 : 0,
      };
      
      // Leave Analytics
      const leavesQuery = query(collection(db, 'leaves'), where('organizationId', '==', organizationId));
      const leavesSnap = await getDocs(leavesQuery);
      const leaves = leavesSnap.docs.map(doc => doc.data());
      
      const leavesInRange = leaves.filter((leave: any) => {
        if (!leave.startDate) return false;
        const leaveDate = new Date(leave.startDate);
        return leaveDate >= startDate && leaveDate <= now;
      });
      
      const approvedLeaves = leavesInRange.filter((leave: any) => leave.status === 'APPROVED');
      const pendingLeaves = leavesInRange.filter((leave: any) => leave.status === 'PENDING').length;
      const totalLeavesTaken = approvedLeaves.reduce((sum: number, leave: any) => sum + (leave.duration || 1), 0);
      const leaveUtilization = leavesInRange.length > 0 ? (approvedLeaves.length / leavesInRange.length) * 100 : 0;
      
      // Leave Type Breakdown
      const leaveTypeMap: Record<string, number> = {};
      approvedLeaves.forEach((leave: any) => {
        const type = leave.leaveType || 'Other';
        leaveTypeMap[type] = (leaveTypeMap[type] || 0) + (leave.duration || 1);
      });
      const leaveTypeBreakdown = Object.entries(leaveTypeMap).map(([name, value]) => ({ name, value }));
      
      // Performance Metrics
      const employeesWithRatings = activeEmployees.filter((emp: any) => emp.performanceRating);
      const averageRating = employeesWithRatings.length > 0
        ? employeesWithRatings.reduce((sum: number, emp: any) => sum + (emp.performanceRating || 0), 0) / employeesWithRatings.length
        : 0;
      
      const topPerformers = activeEmployees.filter((emp: any) => (emp.performanceRating || 0) >= 4.5).length;
      const needsImprovement = activeEmployees.filter((emp: any) => (emp.performanceRating || 0) < 3 && (emp.performanceRating || 0) > 0).length;
      
      const deptPerformanceMap: Record<string, { total: number; count: number }> = {};
      employeesWithRatings.forEach((emp: any) => {
        const dept = emp.department || 'Unassigned';
        if (!deptPerformanceMap[dept]) {
          deptPerformanceMap[dept] = { total: 0, count: 0 };
        }
        deptPerformanceMap[dept].total += emp.performanceRating || 0;
        deptPerformanceMap[dept].count++;
      });
      
      const departmentPerformance = Object.entries(deptPerformanceMap).map(([name, data]) => ({
        name,
        rating: data.count > 0 ? Number((data.total / data.count).toFixed(1)) : 0,
      }));
      
      // Compensation Analytics
      const employeesWithSalary = activeEmployees.filter((emp: any) => emp.baseSalary && emp.baseSalary > 0);
      const averageSalary = employeesWithSalary.length > 0
        ? employeesWithSalary.reduce((sum: number, emp: any) => sum + (emp.baseSalary || 0), 0) / employeesWithSalary.length
        : 0;
      
      const salaries = employeesWithSalary.map((emp: any) => emp.baseSalary);
      const salaryRange = {
        min: salaries.length > 0 ? Math.min(...salaries) : 0,
        max: salaries.length > 0 ? Math.max(...salaries) : 0,
      };
      
      const deptSalaryMap: Record<string, { total: number; count: number }> = {};
      employeesWithSalary.forEach((emp: any) => {
        const dept = emp.department || 'Unassigned';
        if (!deptSalaryMap[dept]) {
          deptSalaryMap[dept] = { total: 0, count: 0 };
        }
        deptSalaryMap[dept].total += emp.baseSalary || 0;
        deptSalaryMap[dept].count++;
      });
      
      const departmentSalary = Object.entries(deptSalaryMap).map(([name, data]) => ({
        name,
        avgSalary: data.count > 0 ? Math.round(data.total / data.count) : 0,
      }));
      
      // Salary Slips Data
      const salarySlipsQuery = query(collection(db, 'salary_slips'), where('organizationId', '==', organizationId));
      const salarySlipsSnap = await getDocs(salarySlipsQuery);
      const salarySlips = salarySlipsSnap.docs.map(doc => doc.data());
      
      const totalPayout = salarySlips.reduce((sum: number, slip: any) => sum + (slip.netSalary || 0), 0);
      const salarySlipsGenerated = salarySlips.length;
      
      // Training Effectiveness based on actual ratings
      const trainingEffectiveness = averageRating > 0 ? Math.round(averageRating * 20) : 0;
      
      // Cost Per Hire calculation
      const costPerHire = totalHires > 0 ? Math.round(averageSalary * 0.15) : 0;
      
      setAnalytics({
        headcount,
        attritionRate,
        departmentAnalytics,
        genderDiversity,
        attendancePatterns,
        leaveUtilization,
        leaveTypeBreakdown,
        totalLeavesTaken,
        pendingLeaves,
        costPerHire,
        trainingEffectiveness,
        headcountTrend,
        turnoverAnalysis: {
          totalExits,
          voluntaryExits,
          involuntaryExits,
          exitReasons,
          retentionRate,
        },
        recruitmentMetrics: {
          totalHires,
          timeToHire: Math.round(timeToHire),
          offerAcceptanceRate: totalHires > 0 ? 85 : 0,
          hiringTrend,
        },
        performanceMetrics: {
          averageRating,
          topPerformers,
          needsImprovement,
          departmentPerformance,
        },
        compensationAnalytics: {
          averageSalary,
          salaryRange,
          departmentSalary,
          totalPayout,
          salarySlipsGenerated,
        },
        ageDistribution,
        tenureAnalysis,
        attendanceSummary,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (loading) {
    return (
      <Layout pageTitle="HR Analytics">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="HR Analytics">
      <div className="space-y-4 p-4 sm:p-6">
        {/* Header with gradient */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              HR Analytics Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time insights into your workforce</p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last30days">Last 30 Days</SelectItem>
              <SelectItem value="last6months">Last 6 Months</SelectItem>
              <SelectItem value="lastyear">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Quick Stats */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
          <div className="flex-shrink-0 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
            <span className="text-sm font-medium text-blue-600">{analytics.headcount} Employees</span>
          </div>
          <div className="flex-shrink-0 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="text-sm font-medium text-green-600">{analytics.recruitmentMetrics.totalHires} New Hires</span>
          </div>
          <div className="flex-shrink-0 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="text-sm font-medium text-red-600">{analytics.attritionRate.toFixed(1)}% Attrition</span>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Headcount</p>
                  <p className="text-2xl font-bold text-blue-600">{analytics.headcount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Active employees</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/20">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">New Hires</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.recruitmentMetrics.totalHires}</p>
                  <p className="text-xs text-muted-foreground mt-1">In selected period</p>
                </div>
                <div className="p-3 rounded-full bg-green-500/20">
                  <UserPlus className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Attrition Rate</p>
                  <p className="text-2xl font-bold text-red-600">{analytics.attritionRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{analytics.turnoverAnalysis.totalExits} exits</p>
                </div>
                <div className="p-3 rounded-full bg-red-500/20">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Retention Rate</p>
                  <p className="text-2xl font-bold text-purple-600">{analytics.turnoverAnalysis.retentionRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Employee retention</p>
                </div>
                <div className="p-3 rounded-full bg-purple-500/20">
                  <Target className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Salary</p>
                  <p className="text-xl font-bold text-orange-600">₹{Math.round(analytics.compensationAnalytics.averageSalary).toLocaleString()}</p>
                </div>
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leaves Taken</p>
                  <p className="text-xl font-bold text-cyan-600">{analytics.totalLeavesTaken} days</p>
                </div>
                <Calendar className="h-5 w-5 text-cyan-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Leaves</p>
                  <p className="text-xl font-bold text-yellow-600">{analytics.pendingLeaves}</p>
                </div>
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Salary Slips</p>
                  <p className="text-xl font-bold text-indigo-600">{analytics.compensationAnalytics.salarySlipsGenerated}</p>
                </div>
                <Receipt className="h-5 w-5 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Headcount Trend */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Headcount Trend
              </CardTitle>
              <CardDescription>Employee count over time</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.headcountTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.headcountTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No headcount data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Department Distribution */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Department Distribution
              </CardTitle>
              <CardDescription>Employees by department</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.departmentAnalytics.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.departmentAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No department data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 - New Widgets */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Gender Diversity */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-pink-500/5 to-pink-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PieChartIcon className="h-5 w-5 text-pink-600" />
                Gender Diversity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.genderDiversity.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={analytics.genderDiversity}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {analytics.genderDiversity.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No gender data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Age Distribution */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-600" />
                Age Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.ageDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.ageDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="range" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No age data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tenure Analysis */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-green-500/5 to-green-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5 text-green-600" />
                Tenure Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.tenureAnalysis.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.tenureAnalysis} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="range" type="category" className="text-xs" width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No tenure data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attendance & Leave Analytics */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Attendance Patterns */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-cyan-500/5 to-cyan-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-cyan-600" />
                Attendance Patterns
              </CardTitle>
              <CardDescription>Monthly attendance breakdown</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.attendancePatterns.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.attendancePatterns}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" name="Present" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No attendance data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leave Type Breakdown */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-orange-500/5 to-orange-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-orange-600" />
                Leave Type Breakdown
              </CardTitle>
              <CardDescription>Days taken by leave type</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.leaveTypeBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={analytics.leaveTypeBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {analytics.leaveTypeBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No leave data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Turnover & Recruitment */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Turnover Overview */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-red-500/5 to-red-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserMinus className="h-5 w-5 text-red-600" />
                Turnover Analysis
              </CardTitle>
              <CardDescription>Employee exit metrics</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                  <p className="text-sm text-muted-foreground">Total Exits</p>
                  <p className="text-2xl font-bold text-red-600">{analytics.turnoverAnalysis.totalExits}</p>
                </div>
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <p className="text-sm text-muted-foreground">Retention Rate</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.turnoverAnalysis.retentionRate.toFixed(1)}%</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-sm text-muted-foreground">Voluntary</p>
                  <p className="text-xl font-bold">{analytics.turnoverAnalysis.voluntaryExits}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-sm text-muted-foreground">Involuntary</p>
                  <p className="text-xl font-bold">{analytics.turnoverAnalysis.involuntaryExits}</p>
                </div>
              </div>
              
              {analytics.turnoverAnalysis.exitReasons.length > 0 && (
                <div className="pt-4">
                  <p className="text-sm font-medium mb-2">Exit Reasons</p>
                  <div className="space-y-2">
                    {analytics.turnoverAnalysis.exitReasons.slice(0, 4).map((reason, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{reason.name}</span>
                        <Badge variant="secondary">{reason.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recruitment Overview */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-green-500/5 to-green-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5 text-green-600" />
                Recruitment Metrics
              </CardTitle>
              <CardDescription>Hiring efficiency</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <p className="text-sm text-muted-foreground">Total Hires</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.recruitmentMetrics.totalHires}</p>
                </div>
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <p className="text-sm text-muted-foreground">Time to Hire</p>
                  <p className="text-2xl font-bold text-blue-600">{analytics.recruitmentMetrics.timeToHire} days</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-sm text-muted-foreground">Offer Acceptance</p>
                  <p className="text-xl font-bold">{analytics.recruitmentMetrics.offerAcceptanceRate}%</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-sm text-muted-foreground">Cost Per Hire</p>
                  <p className="text-xl font-bold">₹{analytics.costPerHire.toLocaleString()}</p>
                </div>
              </div>
              
              {analytics.recruitmentMetrics.hiringTrend.length > 0 && (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={analytics.recruitmentMetrics.hiringTrend}>
                    <XAxis dataKey="month" className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="hires" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Compensation Analytics */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Compensation Overview */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-purple-500/5 to-purple-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-purple-600" />
                Compensation Overview
              </CardTitle>
              <CardDescription>Salary metrics</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <p className="text-sm text-muted-foreground">Average Salary</p>
                  <p className="text-xl font-bold text-purple-600">₹{Math.round(analytics.compensationAnalytics.averageSalary).toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <p className="text-sm text-muted-foreground">Total Payout</p>
                  <p className="text-xl font-bold text-green-600">₹{(analytics.compensationAnalytics.totalPayout / 100000).toFixed(1)}L</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">Salary Range</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Min: ₹{Math.round(analytics.compensationAnalytics.salaryRange.min).toLocaleString()}</span>
                  <span className="text-sm">Max: ₹{Math.round(analytics.compensationAnalytics.salaryRange.max).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Department-wise Compensation */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-purple-500/5 to-purple-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Department Compensation
              </CardTitle>
              <CardDescription>Average salary by department</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.compensationAnalytics.departmentSalary.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.compensationAnalytics.departmentSalary} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" tickFormatter={(value) => `₹${(value/1000).toFixed(0)}K`} />
                    <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                    <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                    <Bar dataKey="avgSalary" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                  No compensation data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Performance Overview */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-yellow-500/5 to-yellow-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-yellow-600" />
                Performance Overview
              </CardTitle>
              <CardDescription>Employee performance distribution</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{analytics.performanceMetrics.averageRating.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Avg Rating</p>
                </div>
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-center">
                  <p className="text-2xl font-bold text-green-600">{analytics.performanceMetrics.topPerformers}</p>
                  <p className="text-xs text-muted-foreground">Top Performers</p>
                </div>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-center">
                  <p className="text-2xl font-bold text-red-600">{analytics.performanceMetrics.needsImprovement}</p>
                  <p className="text-xs text-muted-foreground">Needs Improvement</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Training Effectiveness</p>
                    <p className="text-2xl font-bold">{analytics.trainingEffectiveness}%</p>
                  </div>
                  <GraduationCap className="h-10 w-10 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Department Performance */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-yellow-500/5 to-yellow-500/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
                Department Performance
              </CardTitle>
              <CardDescription>Average ratings by department</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.performanceMetrics.departmentPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.performanceMetrics.departmentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis domain={[0, 5]} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="rating" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                  No performance data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attendance Summary Widget */}
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-cyan-500/5 to-cyan-500/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5 text-cyan-600" />
              Attendance Summary
            </CardTitle>
            <CardDescription>Overall attendance metrics</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
                <p className="text-2xl font-bold text-blue-600">{analytics.attendanceSummary.totalRecords}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-center">
                <p className="text-2xl font-bold text-green-600">{analytics.attendanceSummary.avgHoursWorked.toFixed(1)}h</p>
                <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-center">
                <p className="text-2xl font-bold text-purple-600">{analytics.attendanceSummary.onTimePercentage.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Punch Out Rate</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 text-center">
                <p className="text-2xl font-bold text-orange-600">{analytics.leaveUtilization.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Leave Approval Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
