import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileDown, Calendar, Clock, TrendingUp, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

const AttendanceReport = () => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDays: 0,
    totalHours: 0,
    avgHours: 0
  });

  useEffect(() => {
    fetchAttendance();
  }, [user]);

  const fetchAttendance = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setAttendanceRecords(records);
      calculateStats(records);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (records: any[]) => {
    let totalHours = 0;
    let daysWithHours = 0;

    records.forEach((record: any) => {
      if (record.punchIn && record.punchOut) {
        let diff = new Date(record.punchOut).getTime() - new Date(record.punchIn).getTime();
        if (diff < 0) diff += 24 * 60 * 60 * 1000;
        const hours = diff / (1000 * 60 * 60);
        totalHours += hours;
        daysWithHours++;
      }
    });

    setStats({
      totalDays: records.length,
      totalHours: parseFloat(totalHours.toFixed(2)),
      avgHours: daysWithHours > 0 ? parseFloat((totalHours / daysWithHours).toFixed(2)) : 0
    });
  };

  const calculateWorkHours = (punchIn: string, punchOut: string | null) => {
    if (!punchOut) return 'In Progress';
    let diff = new Date(punchOut).getTime() - new Date(punchIn).getTime();
    if (diff < 0) diff += 24 * 60 * 60 * 1000;
    const hours = diff / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hrs`;
  };

  const formatLocation = (location: any) => {
    if (!location) return 'N/A';
    if (typeof location === 'string') return location;
    if (typeof location === 'object' && location.lat && location.lng) {
      return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    }
    return 'N/A';
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Punch In', 'Punch In Location', 'Punch Out', 'Punch Out Location', 'Total Hours'];
    const rows = attendanceRecords.map(record => [
      record.date,
      new Date(record.punchIn).toLocaleString(),
      formatLocation(record.punchInLocation),
      record.punchOut ? new Date(record.punchOut).toLocaleString() : 'N/A',
      formatLocation(record.punchOutLocation),
      calculateWorkHours(record.punchIn, record.punchOut)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Attendance Report
          </h1>
          <p className="text-muted-foreground mt-1">View your attendance history and statistics</p>
        </div>
        <Button onClick={exportToCSV} className="gap-2">
          <FileDown className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Mobile Quick Stats */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm whitespace-nowrap">
          <Calendar className="h-4 w-4" />
          <span>{stats.totalDays} Days</span>
        </div>
        <div className="flex items-center gap-2 bg-secondary/10 text-secondary-foreground px-3 py-1.5 rounded-full text-sm whitespace-nowrap">
          <Clock className="h-4 w-4" />
          <span>{stats.totalHours} Hrs</span>
        </div>
        <div className="flex items-center gap-2 bg-accent/10 text-accent-foreground px-3 py-1.5 rounded-full text-sm whitespace-nowrap">
          <TrendingUp className="h-4 w-4" />
          <span>{stats.avgHours} Avg</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Days</p>
                <p className="text-2xl font-bold">{stats.totalDays}</p>
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
      </div>

      {/* Attendance History */}
      <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Attendance History</CardTitle>
              <p className="text-sm text-muted-foreground">Your complete attendance records</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p>Loading attendance records...</p>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No attendance records found</p>
              <p className="text-sm">Your attendance history will appear here</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Punch In</TableHead>
                      <TableHead className="font-semibold">Location</TableHead>
                      <TableHead className="font-semibold">Punch Out</TableHead>
                      <TableHead className="font-semibold">Location</TableHead>
                      <TableHead className="font-semibold">Total Hours</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record) => (
                      <TableRow key={record.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          {format(new Date(record.date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          {new Date(record.punchIn).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {formatLocation(record.punchInLocation)}
                        </TableCell>
                        <TableCell>
                          {record.punchOut 
                            ? new Date(record.punchOut).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {formatLocation(record.punchOutLocation)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {calculateWorkHours(record.punchIn, record.punchOut)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={record.punchOut ? "default" : "secondary"}
                            className={record.punchOut 
                              ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" 
                              : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
                            }
                          >
                            {record.punchOut ? 'Complete' : 'In Progress'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                {attendanceRecords.map((record) => (
                  <div key={record.id} className="p-4 hover:bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">
                        {format(new Date(record.date), 'MMM dd, yyyy')}
                      </span>
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
                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div>
                        <p className="text-muted-foreground text-xs">Punch In</p>
                        <p className="font-medium">
                          {new Date(record.punchIn).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatLocation(record.punchInLocation)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Punch Out</p>
                        <p className="font-medium">
                          {record.punchOut 
                            ? new Date(record.punchOut).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              })
                            : '-'
                          }
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {record.punchOut ? formatLocation(record.punchOutLocation) : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t pt-2">
                      <span className="text-muted-foreground">Total Hours</span>
                      <span className="font-medium text-primary">
                        {calculateWorkHours(record.punchIn, record.punchOut)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceReport;
