import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Calendar, Clock, FileText, TrendingUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface LoanApplication {
  id: string;
  loanType: string;
  amount: number;
  purpose: string;
  tenure: number;
  applicationDate: string;
  status: string;
}

export default function LoanApplications() {
  const { user, organizationId } = useAuth();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newApplication, setNewApplication] = useState({
    loanType: '',
    amount: '',
    purpose: '',
    tenure: '',
  });

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  const loadApplications = async () => {
    try {
      const q = query(
        collection(db, 'loan_applications'),
        where('userId', '==', user?.uid),
        orderBy('applicationDate', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoanApplication[];
      setApplications(data);
    } catch (error) {
      console.error('Error loading loan applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!newApplication.loanType || !newApplication.amount || !newApplication.purpose || !newApplication.tenure) {
      toast.error('Please fill in all fields');
      return;
    }

    const amount = parseFloat(newApplication.amount);
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const tenure = parseInt(newApplication.tenure);
    if (tenure <= 0) {
      toast.error('Please enter a valid tenure');
      return;
    }

    try {
      // Fetch employee name and organization
      const employeeDoc = await getDoc(doc(db, 'employees', user?.uid || ''));
      const employeeName = employeeDoc.exists() ? employeeDoc.data().name : 'Unknown';
      const organizationId = employeeDoc.exists() ? employeeDoc.data().organizationId : null;

      await addDoc(collection(db, 'loan_applications'), {
        userId: user?.uid,
        employeeId: user?.uid,
        employeeName: employeeName,
        organizationId: organizationId,
        type: newApplication.loanType,
        loanType: newApplication.loanType,
        amount: amount,
        reason: newApplication.purpose,
        purpose: newApplication.purpose,
        tenure: tenure,
        applicationDate: new Date().toISOString(),
        appliedDate: new Date().toISOString(),
        status: 'pending'
      });

      setNewApplication({ loanType: '', amount: '', purpose: '', tenure: '' });
      setDialogOpen(false);
      toast.success('Loan application submitted successfully');
      loadApplications();
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Failed to submit application');
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'destructive';
      case 'pending':
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return <CheckCircle className="h-3 w-3" />;
      case 'rejected':
        return <XCircle className="h-3 w-3" />;
      case 'pending':
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  // Calculate stats
  const totalApplications = applications.length;
  const totalAmount = applications.reduce((sum, app) => sum + app.amount, 0);
  const pendingApplications = applications.filter(app => app.status === 'pending').length;
  const approvedApplications = applications.filter(app => app.status === 'approved').length;

  const getLoanTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'Personal Loan': 'bg-blue-100 text-blue-800',
      'Emergency Advance': 'bg-red-100 text-red-800',
      'Salary Advance': 'bg-green-100 text-green-800',
      'Festival Advance': 'bg-purple-100 text-purple-800',
      'Vehicle Loan': 'bg-orange-100 text-orange-800',
      'Education Loan': 'bg-indigo-100 text-indigo-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-600 font-medium">Total Applications</div>
          </div>
          <div className="text-lg font-bold text-blue-900 mt-1">{totalApplications}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <div className="text-xs text-green-600 font-medium">Total Amount</div>
          </div>
          <div className="text-lg font-bold text-green-900 mt-1">
            ₹{totalAmount.toLocaleString()}
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-600" />
            <div className="text-xs text-orange-600 font-medium">Pending</div>
          </div>
          <div className="text-lg font-bold text-orange-900 mt-1">{pendingApplications}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <div className="text-xs text-purple-600 font-medium">Approved</div>
          </div>
          <div className="text-lg font-bold text-purple-900 mt-1">{approvedApplications}</div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl">Loan & Advance Applications</CardTitle>
                <CardDescription>Apply for loans and advances from the company</CardDescription>
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Application
            </Button>
          </div>
        </CardHeader>

        {/* Single Controlled Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Apply for Loan/Advance
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="loanType" className="text-sm font-medium">
                      Loan Type
                    </Label>
                    <Select 
                      value={newApplication.loanType} 
                      onValueChange={(value) => setNewApplication({ ...newApplication, loanType: value })}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select loan type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Personal Loan">Personal Loan</SelectItem>
                        <SelectItem value="Emergency Advance">Emergency Advance</SelectItem>
                        <SelectItem value="Salary Advance">Salary Advance</SelectItem>
                        <SelectItem value="Festival Advance">Festival Advance</SelectItem>
                        <SelectItem value="Vehicle Loan">Vehicle Loan</SelectItem>
                        <SelectItem value="Education Loan">Education Loan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="amount" className="text-sm font-medium">
                      Amount (₹)
                    </Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="amount"
                        type="number"
                        value={newApplication.amount}
                        onChange={(e) => setNewApplication({ ...newApplication, amount: e.target.value })}
                        placeholder="Enter amount"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="tenure" className="text-sm font-medium">
                      Repayment Tenure (months)
                    </Label>
                    <Input
                      id="tenure"
                      type="number"
                      value={newApplication.tenure}
                      onChange={(e) => setNewApplication({ ...newApplication, tenure: e.target.value })}
                      placeholder="Enter tenure in months"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="purpose" className="text-sm font-medium">
                      Purpose
                    </Label>
                    <Textarea
                      id="purpose"
                      value={newApplication.purpose}
                      onChange={(e) => setNewApplication({ ...newApplication, purpose: e.target.value })}
                      placeholder="Explain the purpose of this loan/advance"
                      rows={3}
                      className="mt-1 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Important Information</p>
                    <p className="mt-1">Loan applications are subject to approval based on company policy and your eligibility criteria.</p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleSubmitApplication} 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!newApplication.loanType || !newApplication.amount || !newApplication.purpose || !newApplication.tenure}
              >
                Submit Application
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-3">Loading applications...</p>
            </div>
          ) : applications.length === 0 ? (
            <Card className="text-center py-16 mx-4 my-4 border-dashed bg-muted/20">
              <CardContent>
                <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No applications yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Submit your first loan application to get started with company loan facilities
                </p>
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Apply Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block">
                <ScrollArea className="h-[500px]">
                  <div className="min-w-[800px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Application Date</TableHead>
                          <TableHead>Loan Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Tenure</TableHead>
                          <TableHead>Purpose</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applications.map((application) => (
                          <TableRow key={application.id} className="hover:bg-muted/50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {new Date(application.applicationDate).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getLoanTypeColor(application.loanType)}>
                                {application.loanType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-lg text-green-600">
                              ₹{application.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {application.tenure} months
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="truncate" title={application.purpose}>
                                {application.purpose}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={getStatusVariant(application.status)} 
                                className="flex items-center gap-1 w-fit"
                              >
                                {getStatusIcon(application.status)}
                                {application.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </div>

              {/* Mobile View */}
              <div className="lg:hidden space-y-4 p-4">
                {applications.map((application) => (
                  <Card key={application.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <Badge variant="outline" className={getLoanTypeColor(application.loanType)}>
                            {application.loanType}
                          </Badge>
                          <div className="text-xl font-bold text-green-600">
                            ₹{application.amount.toLocaleString()}
                          </div>
                        </div>
                        <Badge 
                          variant={getStatusVariant(application.status)} 
                          className="flex items-center gap-1"
                        >
                          {getStatusIcon(application.status)}
                          {application.status}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Tenure</div>
                          <div className="flex items-center gap-1 font-medium">
                            <Clock className="h-3 w-3" />
                            {application.tenure} months
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Applied On</div>
                          <div className="flex items-center gap-1 font-medium">
                            <Calendar className="h-3 w-3" />
                            {new Date(application.applicationDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Purpose */}
                      <div className="border-t pt-3">
                        <div className="text-muted-foreground text-xs font-medium mb-1">Purpose</div>
                        <p className="text-sm line-clamp-2">{application.purpose}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
