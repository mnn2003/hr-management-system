import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface ClearanceItem {
  department: string;
  status: 'pending' | 'approved' | 'rejected';
  clearedBy: string;
  clearedDate: string;
  remarks: string;
}

interface Clearance {
  id: string;
  items: ClearanceItem[];
  overallStatus: string;
}

export const MyClearance = () => {
  const { user } = useAuth();
  const [clearance, setClearance] = useState<Clearance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClearance();
  }, [user]);

  const loadClearance = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'clearances'),
        where('employeeId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setClearance({
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data()
        } as Clearance);
      }
    } catch (error) {
      console.error('Error loading clearance:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = () => {
    if (!clearance) return 0;
    const approved = clearance.items.filter(item => item.status === 'approved').length;
    return (approved / clearance.items.length) * 100;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!clearance) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="text-4xl">📋</div>
            <h3 className="text-lg font-semibold">No Clearance Process Initiated</h3>
            <p className="text-muted-foreground">
              Clearance process will be initiated after your resignation is approved.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Clearance Progress</CardTitle>
          <Badge variant="outline" className="capitalize">
            {clearance.overallStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{Math.round(calculateProgress())}%</span>
          </div>
          <Progress value={calculateProgress()} />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cleared By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clearance.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      {item.department}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>{item.clearedBy || '-'}</TableCell>
                  <TableCell>{item.clearedDate || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">{item.remarks || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-sm">Note</h4>
          <p className="text-sm text-muted-foreground">
            Please ensure all departments clear your exit before your last working day. 
            Contact respective departments if you need assistance with any pending clearances.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
