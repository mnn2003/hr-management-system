import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

const AttendanceRequests = () => {
  const { user } = useAuth();
  const [attendanceRequests, setAttendanceRequests] = useState<any[]>([]);
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (user) {
      fetchAttendanceRequests();
      fetchEditRequests();
    }
  }, [user]);

  const fetchAttendanceRequests = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'attendance_requests'),
        where('employeeId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'attendance' }));
      requests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAttendanceRequests(requests);
    } catch (error) {
      console.error('Error fetching attendance requests:', error);
    }
  };

  const fetchEditRequests = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'attendance_edit_requests'),
        where('employeeId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'edit' }));
      requests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEditRequests(requests);
    } catch (error) {
      console.error('Error fetching edit requests:', error);
    }
  };

  const allRequests = [...attendanceRequests, ...editRequests].sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredRequests = activeFilter === 'all' 
    ? allRequests 
    : allRequests.filter(r => r.status === activeFilter);

  const counts = {
    all: allRequests.length,
    pending: allRequests.filter(r => r.status === 'pending').length,
    approved: allRequests.filter(r => r.status === 'approved').length,
    rejected: allRequests.filter(r => r.status === 'rejected').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Pending</Badge>;
      case 'approved': return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Approved</Badge>;
      case 'rejected': return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Rejected</Badge>;
      default: return null;
    }
  };

  const filters: { key: typeof activeFilter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'bg-primary/10 text-primary border-primary/20' },
    { key: 'pending', label: 'Pending', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
    { key: 'approved', label: 'Approved', color: 'bg-green-500/10 text-green-700 border-green-500/20' },
    { key: 'rejected', label: 'Rejected', color: 'bg-red-500/10 text-red-700 border-red-500/20' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
          Attendance Requests
        </h1>
        <p className="text-sm text-muted-foreground mt-1">View all your attendance and edit requests</p>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              activeFilter === f.key ? f.color + ' shadow-sm' : 'bg-muted/30 text-muted-foreground border-muted hover:bg-muted/50'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{counts.all}</p>
            <p className="text-xs text-muted-foreground">Total Requests</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{counts.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{counts.approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{counts.rejected}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Request List */}
      {filteredRequests.length > 0 ? (
        <div className="space-y-3">
          {filteredRequests.map((request: any) => (
            <Card key={request.id} className={`border transition-all hover:shadow-md ${
              request.status === 'pending' ? 'border-yellow-500/20' :
              request.status === 'approved' ? 'border-green-500/20' :
              'border-red-500/20'
            }`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg mt-0.5 ${
                      request.status === 'pending' ? 'bg-yellow-500/10' :
                      request.status === 'approved' ? 'bg-green-500/10' :
                      'bg-red-500/10'
                    }`}>
                      {getStatusIcon(request.status)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{request.date}</p>
                        <Badge variant="outline" className="text-xs">
                          {request.type === 'edit' ? 'Edit Request' : 'New Attendance'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {request.type === 'edit' 
                          ? `Requested Punch Out: ${request.requestedPunchOut}`
                          : `${request.requestedPunchIn} → ${request.requestedPunchOut}`
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">{request.reason}</p>
                      {request.createdAt && (
                        <p className="text-xs text-muted-foreground">
                          Submitted: {new Date(request.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </p>
                      )}
                      {request.approvedAt && (
                        <p className="text-xs text-muted-foreground">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(request.approvedAt).toLocaleDateString('en-US', { 
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {getStatusBadge(request.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No {activeFilter !== 'all' ? activeFilter : ''} requests found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceRequests;
