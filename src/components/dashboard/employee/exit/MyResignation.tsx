import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';

interface Resignation {
  id: string;
  resignationType: string;
  submissionDate: string;
  lastWorkingDate: string;
  noticePeriod: string;
  reason: string;
  remarks: string;
  status: string;
  department?: string;
  designation?: string;
}

export const MyResignation = () => {
  const { user } = useAuth();
  const [resignation, setResignation] = useState<Resignation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResignation();
  }, [user]);

  const loadResignation = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'resignations'),
        where('employeeId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        // Get the most recent resignation by sorting in memory
        const resignations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const sortedResignations = resignations.sort((a: any, b: any) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        setResignation(sortedResignations[0] as Resignation);
      }
    } catch (error) {
      console.error('Error loading resignation:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending Approval
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'in-clearance':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            In Clearance
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  if (!resignation) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="text-4xl">📋</div>
            <h3 className="text-lg font-semibold">No Resignation Found</h3>
            <p className="text-muted-foreground">
              You haven't submitted any resignation request yet.
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
          <CardTitle>Resignation Details</CardTitle>
          {getStatusBadge(resignation.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Resignation Type</p>
            <p className="text-base font-medium capitalize">{resignation.resignationType}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Submission Date</p>
            <p className="text-base font-medium">{resignation.submissionDate}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Last Working Date</p>
            <p className="text-base font-medium">{resignation.lastWorkingDate}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Notice Period</p>
            <p className="text-base font-medium">{resignation.noticePeriod}</p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <p className="text-sm font-medium text-muted-foreground">Reason</p>
            <p className="text-base">{resignation.reason}</p>
          </div>

          {resignation.remarks && (
            <div className="space-y-1 md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Remarks</p>
              <p className="text-base">{resignation.remarks}</p>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Next Steps</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {resignation.status === 'pending' && (
              <li>• Your resignation is pending approval from HR</li>
            )}
            {resignation.status === 'approved' && (
              <>
                <li>• Your resignation has been approved</li>
                <li>• Clearance process will be initiated soon</li>
              </>
            )}
            {resignation.status === 'in-clearance' && (
              <>
                <li>• Complete clearance from all departments</li>
                <li>• Check "Clearance Status" tab for details</li>
              </>
            )}
            {resignation.status === 'completed' && (
              <li>• All formalities completed. Thank you for your service!</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
