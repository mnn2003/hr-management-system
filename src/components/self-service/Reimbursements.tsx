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
import { Progress } from '@/components/ui/progress';
import { Receipt, Plus, FileText, Eye, Calendar, Upload, CheckCircle, XCircle, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { DocumentViewer } from '@/components/ui/document-viewer';

interface Reimbursement {
  id: string;
  category: string;
  amount: number;
  description: string;
  dateIncurred: string;
  submittedDate: string;
  status: string;
  documentName?: string;
  documentUrl?: string;
}

export default function Reimbursements() {
  const { user, organizationId } = useAuth();
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newReimbursement, setNewReimbursement] = useState({
    category: '',
    amount: '',
    description: '',
    dateIncurred: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadReimbursements();
    }
  }, [user]);

  const loadReimbursements = async () => {
    try {
      const q = query(
        collection(db, 'reimbursements'),
        where('userId', '==', user?.uid),
        orderBy('submittedDate', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reimbursement[];
      setReimbursements(data);
    } catch (error) {
      console.error('Error loading reimbursements:', error);
      toast.error('Failed to load reimbursements');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      e.target.value = '';
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PDF, JPG, or PNG files only');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmitClaim = async () => {
    if (!newReimbursement.category || !newReimbursement.amount || !newReimbursement.description || !newReimbursement.dateIncurred) {
      toast.error('Please fill in all fields');
      return;
    }

    const amount = parseFloat(newReimbursement.amount);
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Fetch employee name and organization
      const employeeDoc = await getDoc(doc(db, 'employees', user?.uid || ''));
      const employeeName = employeeDoc.exists() ? employeeDoc.data().name : 'Unknown';
      const organizationId = employeeDoc.exists() ? employeeDoc.data().organizationId : null;

      let documentUrl = '';
      let documentName = '';

      // Upload file if selected
      if (selectedFile) {
        const storageRef = ref(storage, `reimbursements/${user?.uid}/${Date.now()}_${selectedFile.name}`);
        await uploadBytes(storageRef, selectedFile);
        documentUrl = await getDownloadURL(storageRef);
        documentName = selectedFile.name;
      }

      clearInterval(progressInterval);
      setUploadProgress(100);

      await addDoc(collection(db, 'reimbursements'), {
        userId: user?.uid,
        employeeId: user?.uid,
        employeeName: employeeName,
        organizationId: organizationId,
        category: newReimbursement.category,
        amount: amount,
        description: newReimbursement.description,
        dateIncurred: newReimbursement.dateIncurred,
        submittedDate: new Date().toISOString(),
        status: 'pending',
        ...(documentUrl && { documentUrl, documentName })
      });

      // Reset form
      setNewReimbursement({ category: '', amount: '', description: '', dateIncurred: '' });
      setSelectedFile(null);
      setUploadProgress(0);
      setDialogOpen(false);
      
      toast.success('Reimbursement claim submitted successfully');
      loadReimbursements();
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast.error('Failed to submit reimbursement claim');
    } finally {
      setUploading(false);
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

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Travel': 'bg-blue-100 text-blue-800',
      'Medical': 'bg-green-100 text-green-800',
      'Phone': 'bg-purple-100 text-purple-800',
      'Food': 'bg-orange-100 text-orange-800',
      'Office Supplies': 'bg-indigo-100 text-indigo-800',
      'Other': 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // Calculate stats
  const totalClaims = reimbursements.length;
  const totalAmount = reimbursements.reduce((sum, claim) => sum + claim.amount, 0);
  const pendingClaims = reimbursements.filter(claim => claim.status === 'pending').length;
  const approvedAmount = reimbursements
    .filter(claim => claim.status === 'approved')
    .reduce((sum, claim) => sum + claim.amount, 0);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-600 font-medium">Total Claims</div>
          </div>
          <div className="text-lg font-bold text-blue-900 mt-1">{totalClaims}</div>
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
          <div className="text-lg font-bold text-orange-900 mt-1">{pendingClaims}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <div className="text-xs text-purple-600 font-medium">Approved</div>
          </div>
          <div className="text-lg font-bold text-purple-900 mt-1">
            ₹{approvedAmount.toLocaleString()}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl">Reimbursement Claims</CardTitle>
                <CardDescription>Submit and track expense reimbursement claims</CardDescription>
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Claim
            </Button>
          </div>
        </CardHeader>

        {/* Single Controlled Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Submit Reimbursement Claim
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="category" className="text-sm font-medium">
                      Category
                    </Label>
                    <Select 
                      value={newReimbursement.category} 
                      onValueChange={(value) => setNewReimbursement({ ...newReimbursement, category: value })}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Travel">Travel Expenses</SelectItem>
                        <SelectItem value="Medical">Medical Expenses</SelectItem>
                        <SelectItem value="Phone">Phone/Internet</SelectItem>
                        <SelectItem value="Food">Food & Entertainment</SelectItem>
                        <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                        <SelectItem value="Other">Other Expenses</SelectItem>
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
                        value={newReimbursement.amount}
                        onChange={(e) => setNewReimbursement({ ...newReimbursement, amount: e.target.value })}
                        placeholder="Enter amount"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="dateIncurred" className="text-sm font-medium">
                      Date of Expense
                    </Label>
                    <Input
                      id="dateIncurred"
                      type="date"
                      value={newReimbursement.dateIncurred}
                      onChange={(e) => setNewReimbursement({ ...newReimbursement, dateIncurred: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="receipt" className="text-sm font-medium">
                      Upload Receipt
                    </Label>
                    {selectedFile ? (
                      <div className="border-2 border-green-200 bg-green-50 rounded-lg p-3 mt-1">
                        <div className="flex items-center gap-3">
                          <FileText className="h-6 w-6 text-green-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                            <p className="text-xs text-green-600">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedFile(null)}
                            disabled={uploading}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {uploading && (
                          <div className="mt-2 space-y-1">
                            <Progress value={uploadProgress} className="h-1" />
                            <p className="text-xs text-green-600 text-center">
                              Uploading... {uploadProgress}%
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center hover:border-muted-foreground/50 transition-colors mt-1">
                        <Input
                          id="receipt"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={uploading}
                        />
                        <label htmlFor="receipt" className="cursor-pointer block">
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Click to upload receipt</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                PDF, JPG, PNG (Max 5MB)
                              </p>
                            </div>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={newReimbursement.description}
                  onChange={(e) => setNewReimbursement({ ...newReimbursement, description: e.target.value })}
                  placeholder="Provide details about the expense and why it should be reimbursed"
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>

              <Button 
                onClick={handleSubmitClaim}
                disabled={!newReimbursement.category || !newReimbursement.amount || !newReimbursement.description || !newReimbursement.dateIncurred || uploading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4 mr-2" />
                    Submit Claim
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-3">Loading claims...</p>
            </div>
          ) : reimbursements.length === 0 ? (
            <Card className="text-center py-16 mx-4 my-4 border-dashed bg-muted/20">
              <CardContent>
                <Receipt className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No claims submitted</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Submit your first reimbursement claim to get started with expense reimbursements
                </p>
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Submit First Claim
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
                          <TableHead>Submitted Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Date Incurred</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reimbursements.map((reimbursement) => (
                          <TableRow key={reimbursement.id} className="hover:bg-muted/50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {new Date(reimbursement.submittedDate).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getCategoryColor(reimbursement.category)}>
                                {reimbursement.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-lg text-green-600">
                              ₹{reimbursement.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {new Date(reimbursement.dateIncurred).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="truncate" title={reimbursement.description}>
                                {reimbursement.description}
                              </p>
                            </TableCell>
                            <TableCell>
                              {reimbursement.documentUrl ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 hover:bg-blue-50"
                                  onClick={() => {
                                    setSelectedDoc({ 
                                      url: reimbursement.documentUrl!, 
                                      name: reimbursement.documentName! 
                                    });
                                    setViewerOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-sm">No receipt</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={getStatusVariant(reimbursement.status)} 
                                className="flex items-center gap-1 w-fit"
                              >
                                {getStatusIcon(reimbursement.status)}
                                {reimbursement.status}
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
                {reimbursements.map((reimbursement) => (
                  <Card key={reimbursement.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getCategoryColor(reimbursement.category)}>
                              {reimbursement.category}
                            </Badge>
                            <Badge 
                              variant={getStatusVariant(reimbursement.status)} 
                              className="flex items-center gap-1"
                            >
                              {getStatusIcon(reimbursement.status)}
                              {reimbursement.status}
                            </Badge>
                          </div>
                          <div className="text-xl font-bold text-green-600">
                            ₹{reimbursement.amount.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Submitted</div>
                          <div className="flex items-center gap-1 font-medium">
                            <Calendar className="h-3 w-3" />
                            {new Date(reimbursement.submittedDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Incurred</div>
                          <div className="font-medium">
                            {new Date(reimbursement.dateIncurred).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="border-t pt-3">
                        <div className="text-muted-foreground text-xs font-medium mb-1">Description</div>
                        <p className="text-sm line-clamp-2">{reimbursement.description}</p>
                      </div>

                      {/* Receipt */}
                      <div className="flex justify-between items-center pt-3 border-t">
                        <div className="text-sm text-muted-foreground">
                          {reimbursement.documentUrl ? 'Receipt uploaded' : 'No receipt'}
                        </div>
                        {reimbursement.documentUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDoc({ 
                                url: reimbursement.documentUrl!, 
                                name: reimbursement.documentName! 
                              });
                              setViewerOpen(true);
                            }}
                            className="hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Document Viewer */}
      {selectedDoc && (
        <DocumentViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          documentUrl={selectedDoc.url}
          documentName={selectedDoc.name}
        />
      )}
    </div>
  );
}
