import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Trash2, Eye, Plus, IndianRupee, Calendar, FileCheck, Download, CloudUpload, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { DocumentViewer } from '@/components/ui/document-viewer';

interface InvestmentProof {
  id: string;
  investmentType: string;
  amount: number;
  documentName: string;
  documentUrl?: string;
  uploadDate: string;
  status: string;
}

export default function InvestmentProofs() {
  const { user, organizationId } = useAuth();
  const [proofs, setProofs] = useState<InvestmentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProof, setNewProof] = useState({
    investmentType: '',
    amount: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      loadProofs();
    }
  }, [user]);

  const loadProofs = async () => {
    try {
      const q = query(
        collection(db, 'investment_proofs'),
        where('userId', '==', user?.uid),
        orderBy('uploadDate', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InvestmentProof[];
      setProofs(data);
    } catch (error) {
      console.error('Error loading investment proofs:', error);
      toast.error('Failed to load investment proofs');
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

  const handleUpload = async () => {
    if (!newProof.investmentType || !newProof.amount || !selectedFile) {
      toast.error('Please fill all fields and select a file');
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

      // Fetch employee name
      const employeeDoc = await getDoc(doc(db, 'employees', user?.uid || ''));
      const employeeName = employeeDoc.exists() ? employeeDoc.data().name : 'Unknown';

      // Upload file to Firebase Storage
      const storageRef = ref(storage, `investment_proofs/${user?.uid}/${Date.now()}_${selectedFile.name}`);
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Get organizationId from employee document
      const organizationId = employeeDoc.exists() ? employeeDoc.data().organizationId : null;

      await addDoc(collection(db, 'investment_proofs'), {
        userId: user?.uid,
        employeeId: user?.uid,
        employeeName: employeeName,
        organizationId: organizationId,
        category: newProof.investmentType,
        investmentType: newProof.investmentType,
        amount: parseFloat(newProof.amount),
        documentName: selectedFile.name,
        documentUrl: downloadURL,
        uploadDate: new Date().toISOString(),
        uploadedDate: new Date().toISOString(),
        status: 'pending'
      });

      // Reset form
      setNewProof({ investmentType: '', amount: '' });
      setSelectedFile(null);
      setUploadProgress(0);
      
      toast.success('Investment proof uploaded successfully');
      loadProofs();
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('Failed to upload investment proof');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this investment proof?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'investment_proofs', id));
      toast.success('Proof removed successfully');
      loadProofs();
    } catch (error) {
      console.error('Error deleting proof:', error);
      toast.error('Failed to delete proof');
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
      default:
        return <FileCheck className="h-3 w-3" />;
    }
  };

  // Calculate stats
  const totalProofs = proofs.length;
  const totalAmount = proofs.reduce((sum, proof) => sum + proof.amount, 0);
  const approvedProofs = proofs.filter(proof => proof.status === 'approved').length;
  const pendingProofs = proofs.filter(proof => proof.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-600 font-medium">Total Proofs</div>
          </div>
          <div className="text-lg font-bold text-blue-900 mt-1">{totalProofs}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-green-600" />
            <div className="text-xs text-green-600 font-medium">Total Amount</div>
          </div>
          <div className="text-lg font-bold text-green-900 mt-1">
            ₹{totalAmount.toLocaleString()}
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-orange-600" />
            <div className="text-xs text-orange-600 font-medium">Approved</div>
          </div>
          <div className="text-lg font-bold text-orange-900 mt-1">{approvedProofs}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <div className="text-xs text-purple-600 font-medium">Pending</div>
          </div>
          <div className="text-lg font-bold text-purple-900 mt-1">{pendingProofs}</div>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CloudUpload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl">Upload Investment Proof</CardTitle>
              <CardDescription>Submit documents for your tax-saving investments</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="investmentType" className="text-sm font-medium">
                    Investment Type
                  </Label>
                  <Select 
                    value={newProof.investmentType} 
                    onValueChange={(value) => setNewProof({ ...newProof, investmentType: value })}
                    disabled={uploading}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select investment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PPF">Public Provident Fund (PPF)</SelectItem>
                      <SelectItem value="ELSS">ELSS Mutual Funds</SelectItem>
                      <SelectItem value="NSC">National Savings Certificate</SelectItem>
                      <SelectItem value="LIC">LIC Premium</SelectItem>
                      <SelectItem value="Health Insurance">Health Insurance</SelectItem>
                      <SelectItem value="Home Loan">Home Loan Principal</SelectItem>
                      <SelectItem value="Education Loan">Education Loan Interest</SelectItem>
                      <SelectItem value="Other">Other Investments</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount" className="text-sm font-medium">
                    Investment Amount
                  </Label>
                  <div className="relative mt-1">
                    <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      value={newProof.amount}
                      onChange={(e) => setNewProof({ ...newProof, amount: e.target.value })}
                      placeholder="Enter investment amount"
                      className="pl-10"
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="document" className="text-sm font-medium">
                  Upload Document
                </Label>
                
                {selectedFile ? (
                  <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-green-600">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
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
                      <div className="mt-3 space-y-2">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-xs text-green-600 text-center">
                          Uploading... {uploadProgress}%
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                    <Input
                      id="document"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={uploading}
                    />
                    <label htmlFor="document" className="cursor-pointer block">
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Click to upload document</p>
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

            <Button 
              onClick={handleUpload}
              disabled={!newProof.investmentType || !newProof.amount || !selectedFile || uploading}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <CloudUpload className="h-4 w-4 mr-2" />
                  Upload Investment Proof
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Proofs Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl">Uploaded Proofs</CardTitle>
              <CardDescription>Your submitted investment documents and their status</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-3">Loading your proofs...</p>
            </div>
          ) : proofs.length === 0 ? (
            <Card className="text-center py-16 border-dashed bg-muted/20">
              <CardContent>
                <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No proofs uploaded yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Upload your investment proofs to start tracking your tax-saving declarations
                </p>
                <Button 
                  onClick={() => document.getElementById('investmentType')?.focus()}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload First Proof
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile View */}
              <div className="lg:hidden space-y-4">
                {proofs.map((proof) => (
                  <Card key={proof.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-base">{proof.investmentType}</h3>
                          <div className="text-lg font-bold text-green-600">
                            ₹{proof.amount.toLocaleString()}
                          </div>
                        </div>
                        <Badge 
                          variant={getStatusVariant(proof.status)} 
                          className="flex items-center gap-1"
                        >
                          {getStatusIcon(proof.status)}
                          {proof.status}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Document</div>
                          <div className="font-medium truncate">{proof.documentName}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Upload Date</div>
                          <div className="flex items-center gap-1 font-medium">
                            <Calendar className="h-3 w-3" />
                            {new Date(proof.uploadDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => {
                            setSelectedDoc({ url: proof.documentUrl!, name: proof.documentName });
                            setViewerOpen(true);
                          }}
                          disabled={!proof.documentUrl}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDelete(proof.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden lg:block">
                <ScrollArea className="h-[500px] rounded-lg border">
                  <div className="min-w-[800px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="w-[200px]">Investment Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Document</TableHead>
                          <TableHead>Upload Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {proofs.map((proof) => (
                          <TableRow key={proof.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                </div>
                                {proof.investmentType}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="font-bold text-green-600 text-lg">
                                ₹{proof.amount.toLocaleString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 max-w-[200px]">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate text-sm">{proof.documentName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {new Date(proof.uploadDate).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={getStatusVariant(proof.status)} 
                                className="flex items-center gap-1 w-fit"
                              >
                                {getStatusIcon(proof.status)}
                                {proof.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDoc({ url: proof.documentUrl!, name: proof.documentName });
                                    setViewerOpen(true);
                                  }}
                                  disabled={!proof.documentUrl}
                                  className="hover:bg-blue-50"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(proof.id)}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
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
                </ScrollArea>
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
