import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { collection, getDocs, query, where, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  UserCheck,
  Trash2,
  Eye,
  RefreshCw,
  ScanFace,
  Loader2,
  Users,
  Calendar,
  Hash,
} from 'lucide-react';

interface FaceEnrollmentData {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  userId: string;
  organizationId: string;
  descriptors: { values: number[] }[];
  enrolledAt: string;
  updatedAt: string;
  photoURL?: string;
}

const FaceEnrollmentManagement = () => {
  const { organizationId } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<FaceEnrollmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<FaceEnrollmentData | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FaceEnrollmentData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEnrollments = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'face_data'), where('organizationId', '==', organizationId));
      const snapshot = await getDocs(q);
      const data: FaceEnrollmentData[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FaceEnrollmentData[];
      setEnrollments(data);
    } catch (e) {
      console.error('Error fetching enrollments:', e);
      toast.error('Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [organizationId]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'face_data', deleteTarget.id));
      setEnrollments((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      toast.success(`Face data deleted for ${deleteTarget.employeeName}`);
    } catch (e) {
      console.error('Error deleting enrollment:', e);
      toast.error('Failed to delete enrollment');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const filtered = enrollments.filter(
    (e) =>
      e.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <Layout pageTitle="Face Enrollment Management">
      <div className="space-y-6 p-4 sm:p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enrollments.length}</p>
                <p className="text-xs text-muted-foreground">Total Enrolled</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="p-2 rounded-lg bg-green-500/10">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {enrollments.filter((e) => (e.descriptors?.length || 0) >= 3).length}
                </p>
                <p className="text-xs text-muted-foreground">Fully Enrolled (3+ captures)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <ScanFace className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {enrollments.filter((e) => (e.descriptors?.length || 0) < 3).length}
                </p>
                <p className="text-xs text-muted-foreground">Partial Enrollment</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ScanFace className="h-5 w-5" />
                  Face Enrollment Management
                </CardTitle>
                <CardDescription>View, manage and delete employee face enrollments</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchEnrollments} className="gap-1">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => navigate('/face-enrollment')} className="gap-1">
                  <ScanFace className="h-4 w-4" />
                  Enroll New
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or employee code..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ScanFace className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No enrollments found</p>
                <p className="text-sm mt-1">
                  {searchTerm ? 'Try a different search term' : 'Enroll employees to get started'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="hidden sm:table-cell">Employee Code</TableHead>
                      <TableHead className="hidden md:table-cell">Captures</TableHead>
                      <TableHead className="hidden md:table-cell">Enrolled At</TableHead>
                      <TableHead className="hidden lg:table-cell">Updated At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                              {enrollment.employeeName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{enrollment.employeeName}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">
                                {enrollment.employeeCode}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary">{enrollment.employeeCode || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant={
                              (enrollment.descriptors?.length || 0) >= 3 ? 'default' : 'secondary'
                            }
                          >
                            {enrollment.descriptors?.length || 0} captures
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {formatDate(enrollment.enrolledAt)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {formatDate(enrollment.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedEnrollment(enrollment);
                                setViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate('/face-enrollment')}
                              title="Re-enroll"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setDeleteTarget(enrollment);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enrollment Details</DialogTitle>
              <DialogDescription>Face enrollment information</DialogDescription>
            </DialogHeader>
            {selectedEnrollment && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {selectedEnrollment.employeeName?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedEnrollment.employeeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedEnrollment.employeeCode}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Hash className="h-3 w-3" />
                      Employee ID
                    </div>
                    <p className="text-sm font-medium truncate">{selectedEnrollment.employeeId}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <ScanFace className="h-3 w-3" />
                      Captures
                    </div>
                    <p className="text-sm font-medium">
                      {selectedEnrollment.descriptors?.length || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3 w-3" />
                      Enrolled
                    </div>
                    <p className="text-sm font-medium">
                      {formatDate(selectedEnrollment.enrolledAt)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3 w-3" />
                      Updated
                    </div>
                    <p className="text-sm font-medium">
                      {formatDate(selectedEnrollment.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      (selectedEnrollment.descriptors?.length || 0) >= 3 ? 'default' : 'secondary'
                    }
                  >
                    {(selectedEnrollment.descriptors?.length || 0) >= 3
                      ? 'Fully Enrolled'
                      : 'Partial Enrollment'}
                  </Badge>
                  {selectedEnrollment.userId && (
                    <Badge variant="outline">User Linked</Badge>
                  )}
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={() => { setViewDialogOpen(false); navigate('/face-enrollment'); }}>
                Re-enroll
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Face Enrollment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete face data for{' '}
                <strong>{deleteTarget?.employeeName}</strong>? This action cannot be undone. The
                employee will need to be re-enrolled for face attendance.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default FaceEnrollmentManagement;
