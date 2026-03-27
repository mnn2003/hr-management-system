import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Plus, Edit, Trash2, Search, Filter, Calendar, BookOpen, Shield, Users, Briefcase, Heart, Upload, File, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface PolicyDocument {
  id: string;
  title: string;
  category: string;
  description: string;
  lastUpdated: string;
  fileSize?: string;
  downloads?: number;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'pdf' | 'text';
  textContent?: string;
  organizationId?: string;
}

export default function PolicyDocuments() {
  const { userRole, organizationId } = useAuth();
  const isAdmin = userRole === 'hr' || userRole === 'hod';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingPolicy, setViewingPolicy] = useState<PolicyDocument | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    textContent: '',
    fileType: 'pdf' as 'pdf' | 'text',
  });

  useEffect(() => {
    fetchPolicies();
  }, [organizationId]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const q = organizationId
        ? query(collection(db, 'policy_documents'), where('organizationId', '==', organizationId), orderBy('lastUpdated', 'desc'))
        : query(collection(db, 'policy_documents'), orderBy('lastUpdated', 'desc'));
      
      const snapshot = await getDocs(q);
      const policiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PolicyDocument[];
      
      setPolicies(policiesData);
    } catch (error) {
      console.error('Error fetching policies:', error);
      toast.error('Failed to load policy documents');
    } finally {
      setLoading(false);
    }
  };

  // Filter policies based on search and category
  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         policy.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || policy.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter
  const categories = ['all', ...new Set(policies.map(policy => policy.category))];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'General':
        return <BookOpen className="h-4 w-4" />;
      case 'Leave Management':
        return <Calendar className="h-4 w-4" />;
      case 'Ethics':
        return <Shield className="h-4 w-4" />;
      case 'Benefits':
        return <Heart className="h-4 w-4" />;
      case 'Work Arrangements':
        return <Briefcase className="h-4 w-4" />;
      case 'Security':
        return <Shield className="h-4 w-4" />;
      case 'Compliance':
        return <Shield className="h-4 w-4" />;
      case 'HR':
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'General': 'bg-blue-100 text-blue-800',
      'Leave Management': 'bg-green-100 text-green-800',
      'Ethics': 'bg-purple-100 text-purple-800',
      'Benefits': 'bg-orange-100 text-orange-800',
      'Work Arrangements': 'bg-indigo-100 text-indigo-800',
      'Security': 'bg-red-100 text-red-800',
      'Compliance': 'bg-yellow-100 text-yellow-800',
      'HR': 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'text/plain'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please select a PDF or text file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setFormData(prev => ({
        ...prev,
        fileType: file.type === 'application/pdf' ? 'pdf' : 'text'
      }));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async (policy: PolicyDocument) => {
    try {
      if (policy.fileUrl) {
        window.open(policy.fileUrl, '_blank');
      } else if (policy.textContent) {
        // Download text content as file
        const blob = new Blob([policy.textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${policy.title}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      // Update download count
      const policyRef = doc(db, 'policy_documents', policy.id);
      await updateDoc(policyRef, {
        downloads: (policy.downloads || 0) + 1
      });
      
      setPolicies(policies.map(p => 
        p.id === policy.id 
          ? { ...p, downloads: (p.downloads || 0) + 1 }
          : p
      ));
      toast.success(`Downloading ${policy.title}`);
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Failed to download file');
    }
  };

  const handleAddNew = () => {
    setEditingPolicy(null);
    setSelectedFile(null);
    setFormData({ title: '', category: '', description: '', textContent: '', fileType: 'pdf' });
    setIsDialogOpen(true);
  };

  const handleEdit = (policy: PolicyDocument) => {
    setEditingPolicy(policy);
    setSelectedFile(null);
    setFormData({
      title: policy.title,
      category: policy.category,
      description: policy.description,
      textContent: policy.textContent || '',
      fileType: policy.fileType || 'pdf',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (policy: PolicyDocument) => {
    if (!confirm('Are you sure you want to delete this policy document?')) return;
    
    try {
      // Delete file from storage if exists
      if (policy.fileUrl && policy.fileName) {
        try {
          const fileRef = ref(storage, `policy_documents/${organizationId}/${policy.fileName}`);
          await deleteObject(fileRef);
        } catch (e) {
          console.log('File not found in storage');
        }
      }
      
      await deleteDoc(doc(db, 'policy_documents', policy.id));
      setPolicies(policies.filter(p => p.id !== policy.id));
      toast.success('Policy document deleted');
    } catch (error) {
      console.error('Error deleting policy:', error);
      toast.error('Failed to delete policy');
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.category || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.fileType === 'pdf' && !selectedFile && !editingPolicy?.fileUrl) {
      toast.error('Please upload a PDF file');
      return;
    }

    if (formData.fileType === 'text' && !formData.textContent && !editingPolicy?.textContent) {
      toast.error('Please enter text content');
      return;
    }

    try {
      setUploading(true);
      let fileUrl = editingPolicy?.fileUrl || '';
      let fileName = editingPolicy?.fileName || '';
      let fileSize = editingPolicy?.fileSize || '';

      // Upload file if selected
      if (selectedFile) {
        const uniqueFileName = `${Date.now()}_${selectedFile.name}`;
        const fileRef = ref(storage, `policy_documents/${organizationId}/${uniqueFileName}`);
        await uploadBytes(fileRef, selectedFile);
        fileUrl = await getDownloadURL(fileRef);
        fileName = uniqueFileName;
        fileSize = formatFileSize(selectedFile.size);

        // Delete old file if updating
        if (editingPolicy?.fileName && editingPolicy.fileName !== uniqueFileName) {
          try {
            const oldFileRef = ref(storage, `policy_documents/${organizationId}/${editingPolicy.fileName}`);
            await deleteObject(oldFileRef);
          } catch (e) {
            console.log('Old file not found');
          }
        }
      }

      const policyData = {
        title: formData.title,
        category: formData.category,
        description: formData.description,
        lastUpdated: new Date().toISOString(),
        fileType: formData.fileType,
        ...(formData.fileType === 'pdf' && { fileUrl, fileName, fileSize }),
        ...(formData.fileType === 'text' && { textContent: formData.textContent }),
        ...(organizationId && { organizationId }),
      };

      if (editingPolicy) {
        await updateDoc(doc(db, 'policy_documents', editingPolicy.id), policyData);
        toast.success('Policy document updated');
      } else {
        await addDoc(collection(db, 'policy_documents'), {
          ...policyData,
          downloads: 0,
        });
        toast.success('Policy document added');
      }

      setIsDialogOpen(false);
      setFormData({ title: '', category: '', description: '', textContent: '', fileType: 'pdf' });
      setSelectedFile(null);
      fetchPolicies();
    } catch (error) {
      console.error('Error saving policy:', error);
      toast.error('Failed to save policy document');
    } finally {
      setUploading(false);
    }
  };

  // Calculate stats
  const totalPolicies = policies.length;
  const totalDownloads = policies.reduce((sum, policy) => sum + (policy.downloads || 0), 0);
  const recentPolicies = policies.filter(policy => {
    const policyDate = new Date(policy.lastUpdated);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return policyDate >= thirtyDaysAgo;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-600 font-medium">Total Policies</div>
          </div>
          <div className="text-lg font-bold text-blue-900 mt-1">{totalPolicies}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-green-600" />
            <div className="text-xs text-green-600 font-medium">Total Downloads</div>
          </div>
          <div className="text-lg font-bold text-green-900 mt-1">{totalDownloads}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-600" />
            <div className="text-xs text-orange-600 font-medium">Recent Updates</div>
          </div>
          <div className="text-lg font-bold text-orange-900 mt-1">{recentPolicies}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-600" />
            <div className="text-xs text-purple-600 font-medium">Categories</div>
          </div>
          <div className="text-lg font-bold text-purple-900 mt-1">
            {new Set(policies.map(p => p.category)).size}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl">Policy Documents</CardTitle>
                <CardDescription>Access and download company policy documents</CardDescription>
              </div>
            </div>
            
            {isAdmin && (
              <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Policy
              </Button>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.filter(cat => cat !== 'all').map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredPolicies.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No policies found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || selectedCategory !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'No policy documents available'
                }
              </p>
              {(searchQuery || selectedCategory !== 'all') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Grid View */}
              <div className="hidden lg:block p-4">
                <ScrollArea className="h-[500px]">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pr-4">
                    {filteredPolicies.map((policy) => (
                      <Card key={policy.id} className="hover:shadow-md transition-shadow group">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                                {getCategoryIcon(policy.category)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg truncate">{policy.title}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant="outline" 
                                    className={getCategoryColor(policy.category) + " text-xs"}
                                  >
                                    {policy.category}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {policy.fileType === 'pdf' ? 'PDF' : 'Text'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {policy.description}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Updated: {new Date(policy.lastUpdated).toLocaleDateString()}
                              </div>
                              {policy.fileSize && (
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {policy.fileSize}
                                </div>
                              )}
                            </div>
                            {policy.downloads !== undefined && (
                              <div className="flex items-center gap-1">
                                <Download className="h-3 w-3" />
                                {policy.downloads} downloads
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex gap-2">
                              {policy.fileType === 'text' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setViewingPolicy(policy)}
                                  className="hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDownload(policy)}
                                className="hover:bg-green-50 hover:text-green-600"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                            
                            {isAdmin && (
                              <div className="flex gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleEdit(policy)}
                                  className="hover:bg-blue-50"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleDelete(policy)}
                                  className="hover:bg-red-50 text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Mobile List View */}
              <div className="lg:hidden space-y-3 p-4">
                {filteredPolicies.map((policy) => (
                  <Card key={policy.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            {getCategoryIcon(policy.category)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-base">{policy.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className={getCategoryColor(policy.category) + " text-xs"}
                              >
                                {policy.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {policy.fileType === 'pdf' ? 'PDF' : 'Text'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {policy.description}
                      </p>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(policy.lastUpdated).toLocaleDateString()}
                        </div>
                        {policy.fileSize && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {policy.fileSize}
                          </div>
                        )}
                        {policy.downloads !== undefined && (
                          <div className="col-span-2 flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {policy.downloads} downloads
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t">
                        {policy.fileType === 'text' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setViewingPolicy(policy)}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownload(policy)}
                          className="flex-1 hover:bg-green-50 hover:text-green-600"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        
                        {isAdmin && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEdit(policy)}
                              className="hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDelete(policy)}
                              className="hover:bg-red-50 text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
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

      {/* Add/Edit Policy Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {editingPolicy ? 'Edit Policy Document' : 'Add New Policy Document'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Employee Handbook"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Leave Management">Leave Management</SelectItem>
                  <SelectItem value="Ethics">Ethics</SelectItem>
                  <SelectItem value="Benefits">Benefits</SelectItem>
                  <SelectItem value="Work Arrangements">Work Arrangements</SelectItem>
                  <SelectItem value="Security">Security</SelectItem>
                  <SelectItem value="Compliance">Compliance</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the policy document"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Document Type *</Label>
              <Select value={formData.fileType} onValueChange={(value: 'pdf' | 'text') => setFormData({ ...formData, fileType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Upload</SelectItem>
                  <SelectItem value="text">Text Content</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.fileType === 'pdf' ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Upload PDF File *</Label>
                <div 
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <File className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                  ) : editingPolicy?.fileName ? (
                    <div className="flex items-center justify-center gap-2">
                      <File className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">Current file: {editingPolicy.fileName.split('_').slice(1).join('_')}</p>
                        <p className="text-sm text-muted-foreground">Click to replace</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF or TXT (max 10MB)</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="textContent" className="text-sm font-medium">Policy Content *</Label>
                <Textarea
                  id="textContent"
                  value={formData.textContent}
                  onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                  placeholder="Enter the policy text content here..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{editingPolicy ? 'Update' : 'Add'} Policy</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Text Policy Dialog */}
      <Dialog open={!!viewingPolicy} onOpenChange={() => setViewingPolicy(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingPolicy?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] mt-4">
            <div className="whitespace-pre-wrap font-mono text-sm p-4 bg-muted rounded-lg">
              {viewingPolicy?.textContent}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingPolicy(null)}>
              Close
            </Button>
            <Button onClick={() => viewingPolicy && handleDownload(viewingPolicy)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
