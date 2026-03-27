import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Upload, Download, Eye, Calendar, FileCheck, CloudUpload, CheckCircle, AlertCircle, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { DocumentViewer } from '@/components/ui/document-viewer';

interface ITRDocument {
  id: string;
  name: string;
  url: string;
  date: string;
  type: string;
  size?: string;
}

interface SampleDocument {
  name: string;
  description: string;
  downloadUrl: string;
  size: string;
  type: string;
}

export default function ITRAssistance() {
  const { user, organizationId } = useAuth();
  const [uploadedDocuments, setUploadedDocuments] = useState<ITRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);

  // Real sample documents with actual download URLs
  const sampleDocuments: SampleDocument[] = [
    {
      name: "Form 16 Template",
      description: "Standard Form 16 format for salary TDS",
      downloadUrl: "https://www.incometax.gov.in/iec/foportal/help/static/downloads/Form16.pdf",
      size: "1.2 MB",
      type: "PDF"
    },
    {
      name: "Form 26AS Sample",
      description: "Sample Form 26AS showing tax credits",
      downloadUrl: "https://www.incometax.gov.in/iec/foportal/help/static/downloads/Form26AS.pdf",
      size: "0.8 MB",
      type: "PDF"
    },
    {
      name: "ITR-1 Sahaj Form",
      description: "ITR-1 form for individuals with salary income",
      downloadUrl: "https://www.incometax.gov.in/iec/foportal/help/static/downloads/ITR1_Sahaj.pdf",
      size: "1.5 MB",
      type: "PDF"
    },
    {
      name: "Investment Proof Checklist",
      description: "Complete checklist for tax-saving documents",
      downloadUrl: "https://www.incometax.gov.in/iec/foportal/help/static/downloads/Checklist_80C.pdf",
      size: "0.5 MB",
      type: "PDF"
    }
  ];

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user]);

  const loadDocuments = async () => {
    try {
      const q = query(
        collection(db, 'itr_documents'),
        where('userId', '==', user?.uid),
        orderBy('uploadDate', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().documentName,
        url: doc.data().documentUrl,
        date: doc.data().uploadDate,
        type: doc.data().documentType || 'Other',
        size: doc.data().fileSize || 'N/A'
      }));
      setUploadedDocuments(data);
    } catch (error) {
      console.error('Error loading ITR documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max for ITR documents)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
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
    if (!selectedFile) {
      toast.error('Please select a file to upload');
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

      // Upload file to Firebase Storage
      const storageRef = ref(storage, `itr_documents/${user?.uid}/${Date.now()}_${selectedFile.name}`);
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Determine document type based on filename
      const docType = getDocumentType(selectedFile.name);

      // Fetch employee data for organizationId
      const employeeDoc = await getDoc(doc(db, 'employees', user?.uid || ''));
      const empOrganizationId = employeeDoc.exists() ? employeeDoc.data().organizationId : organizationId;

      await addDoc(collection(db, 'itr_documents'), {
        userId: user?.uid,
        employeeId: user?.uid,
        organizationId: empOrganizationId,
        documentName: selectedFile.name,
        documentUrl: downloadURL,
        documentType: docType,
        fileSize: formatFileSize(selectedFile.size),
        uploadDate: new Date().toISOString()
      });

      setSelectedFile(null);
      setUploadProgress(0);
      toast.success('Document uploaded successfully');
      loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const getDocumentType = (filename: string): string => {
    const lowerName = filename.toLowerCase();
    if (lowerName.includes('form16')) return 'Form 16';
    if (lowerName.includes('form26as')) return 'Form 26AS';
    if (lowerName.includes('itr')) return 'ITR Form';
    if (lowerName.includes('investment')) return 'Investment Proof';
    if (lowerName.includes('bank')) return 'Bank Statement';
    return 'Other';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadSampleDocument = async (doc: SampleDocument) => {
    try {
      // Create a temporary anchor element to trigger download
      const response = await fetch(doc.downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Downloading ${doc.name}`);
    } catch (error) {
      console.error('Error downloading sample document:', error);
      toast.error('Failed to download document');
    }
  };

  // Calculate stats
  const totalDocuments = uploadedDocuments.length;
  const form16Count = uploadedDocuments.filter(doc => doc.type === 'Form 16').length;
  const form26asCount = uploadedDocuments.filter(doc => doc.type === 'Form 26AS').length;

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-600 font-medium">Total Documents</div>
          </div>
          <div className="text-lg font-bold text-blue-900 mt-1">{totalDocuments}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-green-600" />
            <div className="text-xs text-green-600 font-medium">Form 16</div>
          </div>
          <div className="text-lg font-bold text-green-900 mt-1">{form16Count}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-orange-600" />
            <div className="text-xs text-orange-600 font-medium">Form 26AS</div>
          </div>
          <div className="text-lg font-bold text-orange-900 mt-1">{form26asCount}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <div className="text-xs text-purple-600 font-medium">Ready to File</div>
          </div>
          <div className="text-lg font-bold text-purple-900 mt-1">
            {form16Count > 0 && form26asCount > 0 ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upload Section */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CloudUpload className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl">Upload ITR Documents</CardTitle>
                <CardDescription>Upload your tax documents for filing</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedFile ? (
              <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-green-600">
                      {formatFileSize(selectedFile.size)} • {getDocumentType(selectedFile.name)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    disabled={uploading}
                  >
                    <Eye className="h-4 w-4" />
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
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="document-upload"
                  disabled={uploading}
                />
                <label htmlFor="document-upload" className="cursor-pointer block">
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Click to upload document</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, JPG, PNG (Max 10MB)
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            )}

            <Button 
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full bg-blue-600 hover:bg-blue-700"
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
                  Upload Document
                </>
              )}
            </Button>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Recommended Documents</p>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    <li>Form 16 from employer</li>
                    <li>Form 26AS from TRACES</li>
                    <li>Investment proofs (Section 80C, 80D)</li>
                    <li>Bank statements</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sample Documents */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Download className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl">Sample Documents</CardTitle>
                <CardDescription>Download official ITR forms and templates</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {sampleDocuments.map((doc, index) => (
                  <Card key={index} className="p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-green-600" />
                          <h4 className="font-medium text-sm truncate">{doc.name}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{doc.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {doc.type}
                          </Badge>
                          <span>{doc.size}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadSampleDocument(doc)}
                        className="ml-2 shrink-0 hover:bg-green-50"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Uploaded Documents */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl">Your Documents</CardTitle>
              <CardDescription>Manage your uploaded ITR documents</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-3">Loading documents...</p>
            </div>
          ) : uploadedDocuments.length === 0 ? (
            <Card className="text-center py-12 border-dashed bg-muted/20">
              <CardContent>
                <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No documents uploaded</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your ITR documents to get started with tax filing
                </p>
                <Button 
                  onClick={() => document.getElementById('document-upload')?.click()}
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload First Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block">
                <ScrollArea className="h-[300px] rounded-lg border">
                  <div className="min-w-[600px]">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">Document</th>
                          <th className="text-left p-3 font-medium">Type</th>
                          <th className="text-left p-3 font-medium">Size</th>
                          <th className="text-left p-3 font-medium">Upload Date</th>
                          <th className="text-center p-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadedDocuments.map((doc) => (
                          <tr key={doc.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="font-medium text-sm">{doc.name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-xs">
                                {doc.type}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">{doc.size}</td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {new Date(doc.date).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedDoc({ url: doc.url, name: doc.name });
                                  setViewerOpen(true);
                                }}
                                className="hover:bg-blue-50"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>

              {/* Mobile View */}
              <div className="lg:hidden space-y-3">
                {uploadedDocuments.map((doc) => (
                  <Card key={doc.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-blue-600" />
                          <div>
                            <h3 className="font-semibold text-sm">{doc.name}</h3>
                            <Badge variant="outline" className="text-xs mt-1">
                              {doc.type}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedDoc({ url: doc.url, name: doc.name });
                            setViewerOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Size</div>
                          <div className="font-medium">{doc.size}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Uploaded</div>
                          <div className="flex items-center gap-1 font-medium">
                            <Calendar className="h-3 w-3" />
                            {new Date(doc.date).toLocaleDateString()}
                          </div>
                        </div>
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
