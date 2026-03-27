import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { MessageSquare, Plus, Eye, Calendar, Users, CheckCircle2, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface ExitInterviewData {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  interviewDate: string;
  interviewer: string;
  overallExperience: string;
  reasonForLeaving: string;
  workEnvironment: string;
  management: string;
  careerGrowth: string;
  workLifeBalance: string;
  recommendations: string;
  wouldRecommendCompany: boolean;
  wouldRejoin: boolean;
  additionalComments: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
}

export const ExitInterview = () => {
  const [interviews, setInterviews] = useState<ExitInterviewData[]>([]);
  const [resignations, setResignations] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<ExitInterviewData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    interviewDate: '',
    interviewer: '',
    overallExperience: '',
    reasonForLeaving: '',
    workEnvironment: '',
    management: '',
    careerGrowth: '',
    workLifeBalance: '',
    recommendations: '',
    wouldRecommendCompany: false,
    wouldRejoin: false,
    additionalComments: ''
  });

  useEffect(() => {
    fetchInterviews();
    fetchResignations();
  }, []);

  const fetchResignations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'resignations'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResignations(data.filter((r: any) => r.status === 'approved'));
    } catch (error) {
      console.error('Error fetching resignations:', error);
    }
  };

  const fetchInterviews = async () => {
    try {
      const q = query(collection(db, 'exit_interviews'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as ExitInterviewData[];
      setInterviews(data);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      toast.error('Failed to fetch exit interviews');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedResignation = resignations.find(r => r.employeeId === formData.employeeId);
      
      if (!selectedResignation) {
        toast.error('Resignation not found');
        return;
      }

      await addDoc(collection(db, 'exit_interviews'), {
        ...formData,
        employeeName: selectedResignation.employeeName,
        employeeCode: selectedResignation.employeeCode,
        status: 'completed',
        createdAt: Timestamp.now()
      });

      toast.success('Exit interview recorded successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchInterviews();
    } catch (error) {
      console.error('Error recording exit interview:', error);
      toast.error('Failed to record exit interview');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      interviewDate: '',
      interviewer: '',
      overallExperience: '',
      reasonForLeaving: '',
      workEnvironment: '',
      management: '',
      careerGrowth: '',
      workLifeBalance: '',
      recommendations: '',
      wouldRecommendCompany: false,
      wouldRejoin: false,
      additionalComments: ''
    });
  };

  const viewInterview = (interview: ExitInterviewData) => {
    setSelectedInterview(interview);
    setViewDialogOpen(true);
  };

  const getRatingBadge = (rating: string) => {
    const config: Record<string, string> = {
      'excellent': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      'good': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'average': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      'poor': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };
    return <Badge className={config[rating] || 'bg-gray-100 text-gray-700'}>{rating}</Badge>;
  };

  const stats = [
    { label: 'Total Interviews', value: interviews.length, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'Completed', value: interviews.filter(i => i.status === 'completed').length, icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: 'Would Recommend', value: interviews.filter(i => i.wouldRecommendCompany).length, icon: Star, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: 'Would Rejoin', value: interviews.filter(i => i.wouldRejoin).length, icon: MessageSquare, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Exit Interview System</h3>
          <p className="text-sm text-muted-foreground">Conduct and manage exit interviews</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Conduct Interview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Exit Interview Form
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="employee">Employee *</Label>
                  <SearchableEmployeeSelect
                    employees={resignations.map(res => ({ id: res.employeeId, name: res.employeeName, employeeCode: res.employeeCode }))}
                    value={formData.employeeId}
                    onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                    placeholder="Select employee"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="interviewDate">Interview Date *</Label>
                  <Input
                    id="interviewDate"
                    type="date"
                    value={formData.interviewDate}
                    onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="interviewer">Interviewer *</Label>
                  <Input
                    id="interviewer"
                    value={formData.interviewer}
                    onChange={(e) => setFormData({ ...formData, interviewer: e.target.value })}
                    placeholder="Enter interviewer name"
                    className="mt-1.5"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="overallExperience">Overall Experience Rating *</Label>
                  <Select
                    value={formData.overallExperience}
                    onValueChange={(value) => setFormData({ ...formData, overallExperience: value })}
                    required
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="workEnvironment">Work Environment Rating *</Label>
                  <Select
                    value={formData.workEnvironment}
                    onValueChange={(value) => setFormData({ ...formData, workEnvironment: value })}
                    required
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="reasonForLeaving">Primary Reason for Leaving *</Label>
                  <Textarea
                    id="reasonForLeaving"
                    value={formData.reasonForLeaving}
                    onChange={(e) => setFormData({ ...formData, reasonForLeaving: e.target.value })}
                    placeholder="Describe the primary reason"
                    className="mt-1.5"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="management">Management Feedback</Label>
                  <Textarea
                    id="management"
                    value={formData.management}
                    onChange={(e) => setFormData({ ...formData, management: e.target.value })}
                    placeholder="Feedback about management"
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="careerGrowth">Career Growth Feedback</Label>
                  <Textarea
                    id="careerGrowth"
                    value={formData.careerGrowth}
                    onChange={(e) => setFormData({ ...formData, careerGrowth: e.target.value })}
                    placeholder="Feedback about career growth opportunities"
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="workLifeBalance">Work-Life Balance Feedback</Label>
                  <Textarea
                    id="workLifeBalance"
                    value={formData.workLifeBalance}
                    onChange={(e) => setFormData({ ...formData, workLifeBalance: e.target.value })}
                    placeholder="Feedback about work-life balance"
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="recommendations">Recommendations for Improvement</Label>
                  <Textarea
                    id="recommendations"
                    value={formData.recommendations}
                    onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                    placeholder="Suggestions for company improvement"
                    className="mt-1.5"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wouldRecommendCompany"
                    checked={formData.wouldRecommendCompany}
                    onCheckedChange={(checked) => setFormData({ ...formData, wouldRecommendCompany: checked as boolean })}
                  />
                  <Label htmlFor="wouldRecommendCompany" className="cursor-pointer text-sm">
                    Would recommend company to others
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wouldRejoin"
                    checked={formData.wouldRejoin}
                    onCheckedChange={(checked) => setFormData({ ...formData, wouldRejoin: checked as boolean })}
                  />
                  <Label htmlFor="wouldRejoin" className="cursor-pointer text-sm">
                    Would consider rejoining
                  </Label>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="additionalComments">Additional Comments</Label>
                  <Textarea
                    id="additionalComments"
                    value={formData.additionalComments}
                    onChange={(e) => setFormData({ ...formData, additionalComments: e.target.value })}
                    placeholder="Any additional feedback"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Interview'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, index) => (
          <Card key={index} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="font-semibold">Interview Date</TableHead>
                    <TableHead className="font-semibold">Interviewer</TableHead>
                    <TableHead className="font-semibold">Overall Rating</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interviews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <MessageSquare className="h-8 w-8" />
                          <p>No exit interviews recorded</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    interviews.map((interview) => (
                      <TableRow key={interview.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{interview.employeeName}</TableCell>
                        <TableCell>{interview.employeeCode}</TableCell>
                        <TableCell>{new Date(interview.interviewDate).toLocaleDateString()}</TableCell>
                        <TableCell>{interview.interviewer}</TableCell>
                        <TableCell>{getRatingBadge(interview.overallExperience)}</TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {interview.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewInterview(interview)}
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* View Interview Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Exit Interview Details
            </DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <div className="space-y-4">
              <Card className="border">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Employee Name</Label>
                      <p className="font-medium">{selectedInterview.employeeName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Employee Code</Label>
                      <p className="font-medium">{selectedInterview.employeeCode}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Interview Date</Label>
                      <p className="font-medium">{new Date(selectedInterview.interviewDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Interviewer</Label>
                      <p className="font-medium">{selectedInterview.interviewer}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Overall Experience</Label>
                      {getRatingBadge(selectedInterview.overallExperience)}
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Work Environment</Label>
                      {getRatingBadge(selectedInterview.workEnvironment)}
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs">Reason for Leaving</Label>
                    <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg">{selectedInterview.reasonForLeaving}</p>
                  </div>

                  {selectedInterview.management && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Management Feedback</Label>
                      <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg">{selectedInterview.management}</p>
                    </div>
                  )}

                  {selectedInterview.careerGrowth && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Career Growth Feedback</Label>
                      <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg">{selectedInterview.careerGrowth}</p>
                    </div>
                  )}

                  {selectedInterview.workLifeBalance && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Work-Life Balance Feedback</Label>
                      <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg">{selectedInterview.workLifeBalance}</p>
                    </div>
                  )}

                  {selectedInterview.recommendations && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Recommendations</Label>
                      <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg">{selectedInterview.recommendations}</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full ${selectedInterview.wouldRecommendCompany ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-sm">Would recommend company</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full ${selectedInterview.wouldRejoin ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-sm">Would consider rejoining</span>
                    </div>
                  </div>

                  {selectedInterview.additionalComments && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Additional Comments</Label>
                      <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg">{selectedInterview.additionalComments}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
