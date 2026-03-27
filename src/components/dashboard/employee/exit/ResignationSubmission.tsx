import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { Calendar } from 'lucide-react';

export const ResignationSubmission = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasActiveResignation, setHasActiveResignation] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [formData, setFormData] = useState({
    resignationType: '',
    lastWorkingDate: '',
    noticePeriod: '',
    reason: '',
    remarks: ''
  });

  useEffect(() => {
    checkExistingResignation();
    loadEmployeeDetails();
  }, [user]);

  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');

  const loadEmployeeDetails = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'employees'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const empData = snapshot.docs[0].data();
        console.log('Employee details for resignation:', {
          name: empData.name,
          department: empData.department,
          designation: empData.designation
        });
        setEmployeeName(empData.name || '');
        setEmployeeCode(empData.employeeCode || '');
        setDepartment(empData.department || '');
        setDesignation(empData.designation || '');
      }
    } catch (error) {
      console.error('Error loading employee details:', error);
    }
  };

  const checkExistingResignation = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'resignations'),
        where('employeeId', '==', user.uid),
        where('status', 'in', ['pending', 'approved', 'in-clearance'])
      );
      const snapshot = await getDocs(q);
      setHasActiveResignation(!snapshot.empty);
    } catch (error) {
      console.error('Error checking resignation:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.resignationType || !formData.lastWorkingDate || !formData.noticePeriod || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'resignations'), {
        employeeId: user?.uid,
        employeeName,
        employeeCode,
        department,
        designation,
        resignationType: formData.resignationType,
        submissionDate: new Date().toISOString().split('T')[0],
        lastWorkingDate: formData.lastWorkingDate,
        noticePeriod: formData.noticePeriod,
        reason: formData.reason,
        remarks: formData.remarks,
        status: 'pending',
        createdAt: new Date()
      });

      toast.success('Resignation submitted successfully');
      setFormData({
        resignationType: '',
        lastWorkingDate: '',
        noticePeriod: '',
        reason: '',
        remarks: ''
      });
      setHasActiveResignation(true);
    } catch (error) {
      console.error('Error submitting resignation:', error);
      toast.error('Failed to submit resignation');
    } finally {
      setLoading(false);
    }
  };

  if (hasActiveResignation) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="text-4xl">📝</div>
            <h3 className="text-lg font-semibold">Resignation Already Submitted</h3>
            <p className="text-muted-foreground">
              You have an active resignation request. Please check the "My Resignation" tab for status updates.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee Name</Label>
              <Input value={employeeName} disabled />
            </div>

            <div className="space-y-2">
              <Label>Employee Code</Label>
              <Input value={employeeCode} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resignationType">Resignation Type *</Label>
              <Select
                value={formData.resignationType}
                onValueChange={(value) => setFormData({ ...formData, resignationType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voluntary">Voluntary Resignation</SelectItem>
                  <SelectItem value="retirement">Retirement</SelectItem>
                  <SelectItem value="termination">Termination</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastWorkingDate">Last Working Date *</Label>
              <div className="relative">
                <Input
                  id="lastWorkingDate"
                  type="date"
                  value={formData.lastWorkingDate}
                  onChange={(e) => setFormData({ ...formData, lastWorkingDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
                <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="noticePeriod">Notice Period *</Label>
              <Select
                value={formData.noticePeriod}
                onValueChange={(value) => setFormData({ ...formData, noticePeriod: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select notice period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30 days">30 Days</SelectItem>
                  <SelectItem value="60 days">60 Days</SelectItem>
                  <SelectItem value="90 days">90 Days</SelectItem>
                  <SelectItem value="immediate">Immediate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reason">Reason for Resignation *</Label>
              <Textarea
                id="reason"
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Please provide reason for resignation"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="remarks">Additional Remarks</Label>
              <Textarea
                id="remarks"
                rows={2}
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Any additional comments (optional)"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Resignation'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
