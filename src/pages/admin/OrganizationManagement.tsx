import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { collection, getDocs, addDoc, updateDoc, doc, setDoc, query, where, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Building2, Plus, Edit, Ban, CheckCircle, KeyRound, Users, ArrowRight, Search, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Organization {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  subscriptionStatus: 'active' | 'inactive' | 'trial';
  subscriptionEndDate?: string;
  createdAt: string;
  contactEmail?: string;
  contactPhone?: string;
  hrAdminEmail?: string;
  hrAdminName?: string;
  logoUrl?: string;
}

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  role: string;
  organizationId?: string;
  department?: string;
}

const OrganizationManagement = () => {
  const { userRole } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [targetOrgId, setTargetOrgId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [selectedOrgForReset, setSelectedOrgForReset] = useState<Organization | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    isActive: true,
    subscriptionStatus: 'trial' as 'active' | 'inactive' | 'trial',
    subscriptionEndDate: '',
    contactEmail: '',
    contactPhone: '',
    hrAdminName: '',
    hrAdminEmail: '',
    hrAdminEmployeeCode: '',
    hrAdminPan: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string>('');

  useEffect(() => {
    if (userRole === 'super-admin') {
      fetchOrganizations();
      fetchAllEmployees();
    }
  }, [userRole]);

  useEffect(() => {
    let filtered = employees;
    
    if (selectedOrgFilter !== 'all') {
      filtered = filtered.filter(emp => emp.organizationId === selectedOrgFilter);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredEmployees(filtered);
  }, [employees, selectedOrgFilter, searchTerm]);

  const fetchOrganizations = async () => {
    try {
      const orgsSnapshot = await getDocs(collection(db, 'organizations'));
      const orgsData = orgsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Organization[];
      setOrganizations(orgsData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Failed to load organizations');
    }
  };

  const fetchAllEmployees = async () => {
    try {
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      const employeesData = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(employeesData);
      setFilteredEmployees(employeesData);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    }
  };

  const handleTransferEmployee = async () => {
    if (!selectedEmployee || !targetOrgId) {
      toast.error('Please select a target organization');
      return;
    }

    try {
      await updateDoc(doc(db, 'employees', selectedEmployee.id), {
        organizationId: targetOrgId
      });

      const userRoleDoc = await getDoc(doc(db, 'user_roles', selectedEmployee.id));
      if (userRoleDoc.exists()) {
        await updateDoc(doc(db, 'user_roles', selectedEmployee.id), {
          organizationId: targetOrgId
        });
      }

      toast.success('Employee transferred successfully');
      setTransferDialogOpen(false);
      setSelectedEmployee(null);
      setTargetOrgId('');
      fetchAllEmployees();
    } catch (error) {
      console.error('Error transferring employee:', error);
      toast.error('Failed to transfer employee');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let logoUrl = editingOrg?.logoUrl || '';
      
      if (logoFile) {
        const timestamp = Date.now();
        const storageRef = ref(storage, `organization-logos/${timestamp}_${logoFile.name}`);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }

      if (editingOrg) {
        const updateData: any = {
          name: formData.name,
          code: formData.code,
          isActive: formData.isActive,
          subscriptionStatus: formData.subscriptionStatus,
          subscriptionEndDate: formData.subscriptionEndDate,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          updatedAt: new Date().toISOString()
        };
        
        if (logoUrl) {
          updateData.logoUrl = logoUrl;
        }
        
        await updateDoc(doc(db, 'organizations', editingOrg.id), updateData);
        toast.success('Organization updated successfully');
      } else {
        const orgData: any = {
          name: formData.name,
          code: formData.code,
          isActive: formData.isActive,
          subscriptionStatus: formData.subscriptionStatus,
          subscriptionEndDate: formData.subscriptionEndDate,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          createdAt: new Date().toISOString()
        };
        
        if (logoUrl) {
          orgData.logoUrl = logoUrl;
        }
        
        const orgRef = await addDoc(collection(db, 'organizations'), orgData);
        
        if (formData.hrAdminName && formData.hrAdminEmail && formData.hrAdminEmployeeCode && formData.hrAdminPan) {
          try {
            const authEmail = formData.hrAdminEmail.trim();
            const authPassword = formData.hrAdminPan.toUpperCase();
            
            // Create secondary auth instance to prevent auto-login
            const { initializeApp, deleteApp } = await import('firebase/app');
            const { getAuth, createUserWithEmailAndPassword: createUser } = await import('firebase/auth');
            const secondaryApp = initializeApp(
              {
                apiKey: "AIzaSyBFHgyqk16_cxG1o7EF2OQ8ksxsjA1ENKk",
                authDomain: "pq-hub-906ed.firebaseapp.com",
                projectId: "pq-hub-906ed"
              },
              `Secondary_${Date.now()}`
            );
            const secondaryAuth = getAuth(secondaryApp);
            const { user } = await createUser(secondaryAuth, authEmail, authPassword);
            await deleteApp(secondaryApp);
            
            await setDoc(doc(db, 'user_roles', user.uid), {
              role: 'hr',
              organizationId: orgRef.id,
              createdAt: new Date().toISOString()
            });
            
            await setDoc(doc(db, 'employees', user.uid), {
              name: formData.hrAdminName,
              email: formData.hrAdminEmail,
              employeeCode: formData.hrAdminEmployeeCode,
              pan: formData.hrAdminPan.toUpperCase(),
              role: 'hr',
              userId: user.uid,
              organizationId: orgRef.id,
              createdAt: new Date().toISOString()
            });
            
            await updateDoc(orgRef, {
              hrAdminEmail: formData.hrAdminEmail,
              hrAdminName: formData.hrAdminName
            });
            
            toast.success(`Organization and HR admin created!\nLogin: ${authEmail}\nPassword: ${authPassword}`, { duration: 8000 });
          } catch (authError: any) {
            toast.error(`Organization created but HR admin failed: ${authError.message}`);
          }
        } else {
          toast.success('Organization created successfully');
        }
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchOrganizations();
    } catch (error) {
      console.error('Error saving organization:', error);
      toast.error('Failed to save organization');
    }
  };

  const toggleOrganizationStatus = async (org: Organization) => {
    try {
      await updateDoc(doc(db, 'organizations', org.id), {
        isActive: !org.isActive,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Organization ${!org.isActive ? 'activated' : 'disabled'}`);
      fetchOrganizations();
    } catch (error) {
      console.error('Error toggling organization status:', error);
      toast.error('Failed to update organization status');
    }
  };

  const openEditDialog = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      code: org.code,
      isActive: org.isActive,
      subscriptionStatus: org.subscriptionStatus,
      subscriptionEndDate: org.subscriptionEndDate || '',
      contactEmail: org.contactEmail || '',
      contactPhone: org.contactPhone || '',
      hrAdminName: org.hrAdminName || '',
      hrAdminEmail: org.hrAdminEmail || '',
      hrAdminEmployeeCode: '',
      hrAdminPan: ''
    });
    setPreviewLogoUrl(org.logoUrl || '');
    setLogoFile(null);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingOrg(null);
    setFormData({
      name: '',
      code: '',
      isActive: true,
      subscriptionStatus: 'trial',
      subscriptionEndDate: '',
      contactEmail: '',
      contactPhone: '',
      hrAdminName: '',
      hrAdminEmail: '',
      hrAdminEmployeeCode: '',
      hrAdminPan: ''
    });
    setLogoFile(null);
    setPreviewLogoUrl('');
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOrgForReset || !newPassword) {
      toast.error('Please enter a new password');
      return;
    }

    try {
      const userRolesQuery = query(
        collection(db, 'user_roles'),
        where('organizationId', '==', selectedOrgForReset.id),
        where('role', '==', 'hr')
      );
      const userRolesSnapshot = await getDocs(userRolesQuery);
      
      if (userRolesSnapshot.empty) {
        toast.error('No HR admin found for this organization');
        return;
      }

      const hrAdminDoc = userRolesSnapshot.docs[0];
      const employeeDoc = await getDoc(doc(db, 'employees', hrAdminDoc.id));
      if (!employeeDoc.exists()) {
        toast.error('HR admin employee record not found');
        return;
      }

      toast.error('Password reset requires backend implementation. Please ask HR admin to use "Forgot Password" feature.');
      
      setIsPasswordResetOpen(false);
      setNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
    }
  };

  if (userRole !== 'super-admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Access denied. Super admin only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getOrgName = (orgId?: string) => {
    if (!orgId) return 'No Organization';
    const org = organizations.find(o => o.id === orgId);
    return org?.name || 'Unknown';
  };

  return (
    <Layout pageTitle="Organization Management">
      <div className="space-y-4 p-4 sm:p-6">
              <Tabs defaultValue="organizations" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                  <TabsTrigger value="organizations">
                    <Building2 className="h-4 w-4 mr-2" />
                    Organizations
                  </TabsTrigger>
                  <TabsTrigger value="users">
                    <Users className="h-4 w-4 mr-2" />
                    All Users
                  </TabsTrigger>
                </TabsList>

                {/* Organizations Tab */}
                <TabsContent value="organizations" className="space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">Manage organizations and their settings</p>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) resetForm();
                    }}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Organization
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {editingOrg ? 'Edit Organization' : 'Create New Organization'}
                          </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="logo">Organization Logo</Label>
                            <Input
                              id="logo"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                            />
                            {previewLogoUrl && (
                              <div className="mt-2">
                                <img 
                                  src={previewLogoUrl} 
                                  alt="Logo preview" 
                                  className="w-20 h-20 object-contain border rounded"
                                />
                              </div>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="name">Organization Name *</Label>
                              <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="code">Organization Code *</Label>
                              <Input
                                id="code"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                required
                                placeholder="e.g., ORG001"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="contactEmail">Contact Email</Label>
                              <Input
                                id="contactEmail"
                                type="email"
                                value={formData.contactEmail}
                                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="contactPhone">Contact Phone</Label>
                              <Input
                                id="contactPhone"
                                value={formData.contactPhone}
                                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="subscriptionStatus">Subscription Status</Label>
                              <select
                                id="subscriptionStatus"
                                className="w-full rounded-md border border-input bg-background px-3 py-2"
                                value={formData.subscriptionStatus}
                                onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value as any })}
                              >
                                <option value="trial">Trial</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="subscriptionEndDate">Subscription End Date</Label>
                              <Input
                                id="subscriptionEndDate"
                                type="date"
                                value={formData.subscriptionEndDate}
                                onChange={(e) => setFormData({ ...formData, subscriptionEndDate: e.target.value })}
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="isActive"
                              checked={formData.isActive}
                              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            />
                            <Label htmlFor="isActive">Organization Active</Label>
                          </div>

                          {!editingOrg && (
                            <>
                              <div className="border-t pt-4 mt-4">
                                <h3 className="text-lg font-semibold mb-3">HR Admin Account (Optional)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="hrAdminName">HR Admin Name</Label>
                                    <Input
                                      id="hrAdminName"
                                      value={formData.hrAdminName}
                                      onChange={(e) => setFormData({ ...formData, hrAdminName: e.target.value })}
                                      placeholder="Admin Full Name"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="hrAdminEmail">HR Admin Email</Label>
                                    <Input
                                      id="hrAdminEmail"
                                      type="email"
                                      value={formData.hrAdminEmail}
                                      onChange={(e) => setFormData({ ...formData, hrAdminEmail: e.target.value })}
                                      placeholder="admin@company.com"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="hrAdminEmployeeCode">HR Admin Employee Code</Label>
                                    <Input
                                      id="hrAdminEmployeeCode"
                                      value={formData.hrAdminEmployeeCode}
                                      onChange={(e) => setFormData({ ...formData, hrAdminEmployeeCode: e.target.value })}
                                      placeholder="EMP001"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="hrAdminPan">HR Admin PAN</Label>
                                    <Input
                                      id="hrAdminPan"
                                      value={formData.hrAdminPan}
                                      onChange={(e) => setFormData({ ...formData, hrAdminPan: e.target.value.toUpperCase() })}
                                      placeholder="ABCDE1234F"
                                      maxLength={10}
                                    />
                                    <p className="text-xs text-muted-foreground">Will be used as password (in uppercase)</p>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                          
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">
                              {editingOrg ? 'Update' : 'Create'} Organization
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Organizations ({organizations.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Subscription</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {organizations.map((org) => (
                            <TableRow key={org.id}>
                              <TableCell className="font-medium">{org.name}</TableCell>
                              <TableCell>{org.code}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {org.contactEmail && <div>{org.contactEmail}</div>}
                                  {org.contactPhone && <div className="text-muted-foreground">{org.contactPhone}</div>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  org.subscriptionStatus === 'active' ? 'default' :
                                  org.subscriptionStatus === 'trial' ? 'secondary' : 'destructive'
                                }>
                                  {org.subscriptionStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={org.isActive ? 'default' : 'secondary'}>
                                  {org.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditDialog(org)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleOrganizationStatus(org)}
                                  >
                                    {org.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                  </Button>
                                  {org.hrAdminEmail && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedOrgForReset(org);
                                        setIsPasswordResetOpen(true);
                                      }}
                                      title="Reset HR Admin Password"
                                    >
                                      <KeyRound className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* All Users Tab */}
                <TabsContent value="users" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>All Users ({filteredEmployees.length})</CardTitle>
                      <div className="flex gap-4 mt-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm('')}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <Select value={selectedOrgFilter} onValueChange={setSelectedOrgFilter}>
                          <SelectTrigger className="w-64">
                            <SelectValue placeholder="Filter by Organization" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Organizations</SelectItem>
                            {organizations.map(org => (
                              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Employee Code</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                              <TableCell className="font-medium">{employee.name}</TableCell>
                              <TableCell>{employee.employeeCode}</TableCell>
                              <TableCell>{employee.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{employee.role}</Badge>
                              </TableCell>
                              <TableCell>{getOrgName(employee.organizationId)}</TableCell>
                              <TableCell>{employee.department || '-'}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedEmployee(employee);
                                    setTransferDialogOpen(true);
                                  }}
                                >
                                  <ArrowRight className="h-4 w-4 mr-1" />
                                  Transfer
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
        </div>

      {/* Transfer Employee Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Employee to Another Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Input
                value={selectedEmployee?.name || ''}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Current Organization</Label>
              <Input
                value={getOrgName(selectedEmployee?.organizationId)}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Target Organization *</Label>
              <Select value={targetOrgId} onValueChange={setTargetOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations
                    .filter(org => org.id !== selectedEmployee?.organizationId)
                    .map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setTransferDialogOpen(false);
                setSelectedEmployee(null);
                setTargetOrgId('');
              }}>
                Cancel
              </Button>
              <Button onClick={handleTransferEmployee}>
                Transfer Employee
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordResetOpen} onOpenChange={setIsPasswordResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset HR Admin Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Input value={selectedOrgForReset?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>HR Admin Email</Label>
              <Input value={selectedOrgForReset?.hrAdminEmail || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Note: Due to Firebase security, password reset requires the HR admin to use the "Forgot Password" feature.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsPasswordResetOpen(false);
                  setNewPassword('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Reset Password</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default OrganizationManagement;
