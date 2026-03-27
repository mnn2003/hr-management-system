import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, query, where } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'react-hot-toast';
import { UserPlus, Search, FileSpreadsheet, X } from 'lucide-react';
import { UserRole, useAuth } from '@/contexts/AuthContext';
import { EmployeeForm } from './employee/EmployeeForm';
import { EmployeeCard } from './employee/EmployeeCard';
import { downloadTemplate, importFromExcel } from './employee/EmployeeExcelImport';

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  phone?: string;
  address?: string;
  role: UserRole;
  designation?: string;
  dateOfBirth?: string;
  dateOfJoining?: string;
  departmentId?: string;
  department?: string;
  departmentName?: string;
  salary?: number;
  experience?: number;
  userId: string;
  organizationId?: string;
  createdAt: string;
  isBlocked?: boolean;
  pan?: string;
  profileImageUrl?: string;
  gender?: 'Male' | 'Female';
  currentAddress?: string;
  nativeAddress?: string;
  mobile?: string;
  akaName?: string;
  placeOfBirth?: string;
  nationality?: string;
  nameAsPerBankPassbook?: string;
  nameAsPerPAN?: string;
  nameAsPerAadhar?: string;
  bloodGroup?: string;
  height?: string;
  weight?: string;
  qualification?: string;
  previousExperience?: string;
  familyDetails?: string;
  drivingLicense?: string;
  passport?: string;
  visa?: string;
  panCardUrl?: string;
  aadharCardUrl?: string;
  qualificationDocUrl?: string;
}

interface Department {
  id: string;
  name: string;
}

const EmployeeManagement = () => {
  const navigate = useNavigate();
  const { organizationId, userRole } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');
  const [panCardFile, setPanCardFile] = useState<File | null>(null);
  const [aadharCardFile, setAadharCardFile] = useState<File | null>(null);
  const [qualificationDocFile, setQualificationDocFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    employeeCode: '',
    email: '',
    phone: '',
    address: '',
    role: 'staff' as UserRole,
    designation: '',
    dateOfBirth: '',
    dateOfJoining: '',
    departmentId: '',
    salary: '',
    experience: '',
    pan: '',
    gender: '' as 'Male' | 'Female' | '',
    currentAddress: '',
    nativeAddress: '',
    mobile: '',
    akaName: '',
    placeOfBirth: '',
    nationality: '',
    nameAsPerBankPassbook: '',
    nameAsPerPAN: '',
    nameAsPerAadhar: '',
    bloodGroup: '',
    height: '',
    weight: '',
    qualification: '',
    previousExperience: '',
    familyDetails: '',
    drivingLicense: '',
    passport: '',
    visa: ''
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      let snapshot;
      if (organizationId && userRole !== 'super-admin') {
        const q = query(collection(db, 'departments'), where('organizationId', '==', organizationId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'departments'));
      }
      const deptData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Department[];
      setDepartments(deptData);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  useEffect(() => {
    const filtered = employees.filter(emp =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      let q;
      if (organizationId && userRole !== 'super-admin') {
        q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
      } else {
        q = collection(db, 'employees');
      }
      const snapshot = await getDocs(q);
      const employeeData = await Promise.all(
        snapshot.docs.map(async (empDoc) => {
          const data = empDoc.data() as Employee;
          let departmentName = '';
          
          if (data.departmentId) {
            try {
              const deptSnapshot = await getDocs(collection(db, 'departments'));
              const dept = deptSnapshot.docs.find(doc => doc.id === data.departmentId);
              if (dept) {
                departmentName = dept.data().name || '';
                
                if (!data.department && departmentName) {
                  await updateDoc(doc(db, 'employees', empDoc.id), {
                    department: departmentName
                  });
                }
              }
            } catch (error) {
              console.error('Error fetching department name:', error);
            }
          }
          
          return {
            id: empDoc.id,
            ...data,
            department: data.department || departmentName,
            departmentName
          } as Employee;
        })
      );
      setEmployees(employeeData);
      setFilteredEmployees(employeeData);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadProfileImage = async (employeeId: string): Promise<string | null> => {
    if (!profileImage) return null;
    
    try {
      const storageRef = ref(storage, `profile_images/${employeeId}`);
      await uploadBytes(storageRef, profileImage);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload profile image');
      return null;
    }
  };

  const uploadDocument = async (file: File, employeeId: string, docType: string): Promise<string | null> => {
    if (!file) return null;
    
    try {
      const storageRef = ref(storage, `employee_documents/${employeeId}/${docType}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error(`Error uploading ${docType}:`, error);
      toast.error(`Failed to upload ${docType}`);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for organizationId if not super-admin
    if (!organizationId && userRole !== 'super-admin') {
      toast.error('Organization ID is required to add employees');
      return;
    }
    
    if (formData.employeeCode.length < 4) {
      toast.error('Employee code must be at least 4 characters');
      return;
    }
    
    if (!isEditMode && (!formData.pan || formData.pan.length !== 10)) {
      toast.error('PAN must be exactly 10 characters');
      return;
    }
    
    if (isEditMode && formData.pan && formData.pan.length !== 10) {
      toast.error('PAN must be exactly 10 characters');
      return;
    }
    
    try {
      let departmentName = '';
      if (formData.departmentId) {
        const dept = departments.find(d => d.id === formData.departmentId);
        departmentName = dept?.name || '';
      }

      if (isEditMode && editingId) {
        let profileImageUrl = undefined;
        let panCardUrl = undefined;
        let aadharCardUrl = undefined;
        let qualificationDocUrl = undefined;
        
        if (profileImage) {
          profileImageUrl = await uploadProfileImage(editingId);
        }
        if (panCardFile) {
          panCardUrl = await uploadDocument(panCardFile, editingId, 'pan_card');
        }
        if (aadharCardFile) {
          aadharCardUrl = await uploadDocument(aadharCardFile, editingId, 'aadhar_card');
        }
        if (qualificationDocFile) {
          qualificationDocUrl = await uploadDocument(qualificationDocFile, editingId, 'qualification');
        }

        const updateData: any = {
          name: formData.name,
          employeeCode: formData.employeeCode,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          role: formData.role,
          designation: formData.designation,
          dateOfBirth: formData.dateOfBirth,
          dateOfJoining: formData.dateOfJoining,
          departmentId: formData.departmentId || null,
          department: departmentName || null,
          salary: formData.salary ? Number(formData.salary) : null,
          experience: formData.experience ? Number(formData.experience) : null,
          pan: formData.pan ? formData.pan.toUpperCase() : '',
          gender: formData.gender || null,
          currentAddress: formData.currentAddress,
          nativeAddress: formData.nativeAddress,
          mobile: formData.mobile,
          akaName: formData.akaName,
          placeOfBirth: formData.placeOfBirth,
          nationality: formData.nationality,
          nameAsPerBankPassbook: formData.nameAsPerBankPassbook,
          nameAsPerPAN: formData.nameAsPerPAN,
          nameAsPerAadhar: formData.nameAsPerAadhar,
          bloodGroup: formData.bloodGroup,
          height: formData.height,
          weight: formData.weight,
          qualification: formData.qualification,
          previousExperience: formData.previousExperience,
          familyDetails: formData.familyDetails,
          drivingLicense: formData.drivingLicense,
          passport: formData.passport,
          visa: formData.visa,
          organizationId: organizationId || null // Ensure organizationId is always set
        };

        if (profileImageUrl) updateData.profileImageUrl = profileImageUrl;
        if (panCardUrl) updateData.panCardUrl = panCardUrl;
        if (aadharCardUrl) updateData.aadharCardUrl = aadharCardUrl;
        if (qualificationDocUrl) updateData.qualificationDocUrl = qualificationDocUrl;

        await updateDoc(doc(db, 'employees', editingId), updateData);
        
        const employeeDoc = await getDoc(doc(db, 'employees', editingId));
        if (employeeDoc.exists()) {
          const userId = employeeDoc.data().userId;
          await updateDoc(doc(db, 'user_roles', userId), {
            role: formData.role,
            organizationId: organizationId || null // Update organizationId in user_roles as well
          });
        }
        
        toast.success('Employee updated successfully!');
      } else {
        if (!formData.email || !formData.email.includes('@')) {
          toast.error('Valid email address is required');
          return;
        }
        
        const email = formData.email.trim();
        const password = formData.pan.toUpperCase();
        
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
        const userCredential = await createUser(secondaryAuth, email, password);
        await deleteApp(secondaryApp);
        
        const profileImageUrl = await uploadProfileImage(userCredential.user.uid);
        const panCardUrl = panCardFile ? await uploadDocument(panCardFile, userCredential.user.uid, 'pan_card') : null;
        const aadharCardUrl = aadharCardFile ? await uploadDocument(aadharCardFile, userCredential.user.uid, 'aadhar_card') : null;
        const qualificationDocUrl = qualificationDocFile ? await uploadDocument(qualificationDocFile, userCredential.user.uid, 'qualification') : null;

        // Create employee document with organizationId
        await setDoc(doc(db, 'employees', userCredential.user.uid), {
          name: formData.name,
          employeeCode: formData.employeeCode,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          role: formData.role,
          designation: formData.designation,
          dateOfBirth: formData.dateOfBirth,
          dateOfJoining: formData.dateOfJoining,
          departmentId: formData.departmentId || null,
          department: departmentName || null,
          salary: formData.salary ? Number(formData.salary) : null,
          experience: formData.experience ? Number(formData.experience) : null,
          pan: formData.pan.toUpperCase(),
          gender: formData.gender || null,
          userId: userCredential.user.uid,
          organizationId: organizationId, // Add organizationId here - THIS IS THE CRITICAL FIX
          createdAt: new Date().toISOString(),
          ...(profileImageUrl && { profileImageUrl }),
          ...(panCardUrl && { panCardUrl }),
          ...(aadharCardUrl && { aadharCardUrl }),
          ...(qualificationDocUrl && { qualificationDocUrl }),
          currentAddress: formData.currentAddress,
          nativeAddress: formData.nativeAddress,
          mobile: formData.mobile,
          akaName: formData.akaName,
          placeOfBirth: formData.placeOfBirth,
          nationality: formData.nationality,
          nameAsPerBankPassbook: formData.nameAsPerBankPassbook,
          nameAsPerPAN: formData.nameAsPerPAN,
          nameAsPerAadhar: formData.nameAsPerAadhar,
          bloodGroup: formData.bloodGroup,
          height: formData.height,
          weight: formData.weight,
          qualification: formData.qualification,
          previousExperience: formData.previousExperience,
          familyDetails: formData.familyDetails,
          drivingLicense: formData.drivingLicense,
          passport: formData.passport,
          visa: formData.visa
        });

        // Create user_roles document with organizationId
        await setDoc(doc(db, 'user_roles', userCredential.user.uid), {
          role: formData.role,
          organizationId: organizationId!, // Make sure organizationId is included here
          createdAt: new Date().toISOString(),
          email: formData.email,
          employeeId: userCredential.user.uid
        });

        toast.success(`Employee added successfully!\nLogin: ${email}\nPassword: ${password}`, { duration: 6000 });
      }
      
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message || 'Operation failed');
    }
  };

  const resetForm = () => {
    setIsDialogOpen(false);
    setIsEditMode(false);
    setEditingId(null);
    setProfileImage(null);
    setProfileImagePreview('');
    setPanCardFile(null);
    setAadharCardFile(null);
    setQualificationDocFile(null);
    setFormData({ 
      name: '', employeeCode: '', email: '', phone: '', address: '', role: 'staff', 
      designation: '', dateOfBirth: '', dateOfJoining: '', departmentId: '', salary: '', 
      experience: '', pan: '', gender: '', currentAddress: '', nativeAddress: '', mobile: '', 
      akaName: '', placeOfBirth: '', nationality: '', nameAsPerBankPassbook: '', 
      nameAsPerPAN: '', nameAsPerAadhar: '', bloodGroup: '', height: '', weight: '', 
      qualification: '', previousExperience: '', familyDetails: '', drivingLicense: '', 
      passport: '', visa: '' 
    });
  };

  const handleEdit = (emp: Employee) => {
    setFormData({
      name: emp.name,
      employeeCode: emp.employeeCode,
      email: emp.email,
      phone: emp.phone || '',
      address: emp.address || '',
      role: emp.role || 'staff',
      designation: emp.designation || '',
      dateOfBirth: emp.dateOfBirth || '',
      dateOfJoining: emp.dateOfJoining || '',
      departmentId: emp.departmentId || '',
      salary: emp.salary?.toString() || '',
      experience: emp.experience?.toString() || '',
      pan: emp.pan || '',
      gender: emp.gender || '',
      currentAddress: emp.currentAddress || '',
      nativeAddress: emp.nativeAddress || '',
      mobile: emp.mobile || '',
      akaName: emp.akaName || '',
      placeOfBirth: emp.placeOfBirth || '',
      nationality: emp.nationality || '',
      nameAsPerBankPassbook: emp.nameAsPerBankPassbook || '',
      nameAsPerPAN: emp.nameAsPerPAN || '',
      nameAsPerAadhar: emp.nameAsPerAadhar || '',
      bloodGroup: emp.bloodGroup || '',
      height: emp.height || '',
      weight: emp.weight || '',
      qualification: emp.qualification || '',
      previousExperience: emp.previousExperience || '',
      familyDetails: emp.familyDetails || '',
      drivingLicense: emp.drivingLicense || '',
      passport: emp.passport || '',
      visa: emp.visa || ''
    });
    setProfileImagePreview(emp.profileImageUrl || '');
    setEditingId(emp.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId) return;

    setIsImporting(true);
    
    try {
      const { successCount, errorCount, errors } = await importFromExcel(file, organizationId, setImportProgress);
      
      if (successCount > 0) {
        toast.success(`Import completed: ${successCount} successful, ${errorCount} failed`);
      } else {
        toast.error(`Import failed: ${errorCount} errors`);
      }

      if (errors.length > 0) {
        console.error('Import errors:', errors);
        toast.error(
          <div className="max-h-60 overflow-y-auto">
            <p className="font-semibold mb-2">Import Errors:</p>
            <ul className="text-xs space-y-1">
              {errors.slice(0, 10).map((err, idx) => (
                <li key={idx}>• {err}</li>
              ))}
              {errors.length > 10 && <li>... and {errors.length - 10} more errors (check console)</li>}
            </ul>
          </div>,
          { duration: 10000 }
        );
      }

      fetchEmployees();
      if (excelInputRef.current) {
        excelInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error reading Excel file:', error);
      toast.error('Failed to read Excel file');
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      try {
        await deleteDoc(doc(db, 'employees', id));
        toast.success('Employee deleted successfully!');
        fetchEmployees();
      } catch (error) {
        toast.error('Failed to delete employee');
      }
    }
  };

  const handleBlockUnblock = async (emp: Employee) => {
    try {
      const newBlockedStatus = !emp.isBlocked;
      await updateDoc(doc(db, 'employees', emp.id), {
        isBlocked: newBlockedStatus
      });
      toast.success(`Employee ${newBlockedStatus ? 'blocked' : 'unblocked'} successfully!`);
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to update employee status');
    }
  };

  const handleResetPassword = async (emp: Employee) => {
    if (!confirm(`Reset password for ${emp.name} to their employee code (${emp.employeeCode})?`)) {
      return;
    }

    try {
      await setDoc(doc(db, 'password_resets', emp.userId), {
        employeeCode: emp.employeeCode,
        requestedAt: new Date().toISOString(),
        userId: emp.userId
      });
      
      toast.success(
        `Password reset initiated. The employee should logout and login again with:\nUsername: ${emp.employeeCode}\nPassword: ${emp.employeeCode}`,
        { duration: 6000 }
      );
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error('Failed to reset password. Please try again.');
    }
  };

  const handleViewDetails = (emp: Employee) => {
    navigate(`/employees/${emp.id}`);
  };

  return (
    <Card className="w-full">
      <CardHeader className="px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4">
          <CardTitle className="text-xl sm:text-2xl">Employee Management</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 py-2 text-base"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <input
              type="file"
              ref={excelInputRef}
              onChange={handleExcelImport}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => downloadTemplate()}
                className="flex-1 sm:flex-none text-sm"
                size="sm"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <Button 
                variant="outline" 
                onClick={() => excelInputRef.current?.click()}
                className="flex-1 sm:flex-none text-sm"
                size="sm"
                disabled={isImporting}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Import Excel'}</span>
                <span className="sm:hidden">{isImporting ? 'Importing...' : 'Import'}</span>
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleAddNew}
                    className="flex-1 sm:flex-none text-sm"
                    size="sm"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Add Employee</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                  <DialogHeader className="pb-4">
                    <DialogTitle className="text-lg sm:text-xl">
                      {isEditMode ? 'Edit Employee' : 'Add New Employee'}
                    </DialogTitle>
                  </DialogHeader>
                  <EmployeeForm
                    formData={formData}
                    setFormData={setFormData}
                    isEditMode={isEditMode}
                    departments={departments}
                    profileImagePreview={profileImagePreview}
                    panCardFile={panCardFile}
                    aadharCardFile={aadharCardFile}
                    qualificationDocFile={qualificationDocFile}
                    onImageChange={handleImageChange}
                    setPanCardFile={setPanCardFile}
                    setAadharCardFile={setAadharCardFile}
                    setQualificationDocFile={setQualificationDocFile}
                    onSubmit={handleSubmit}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
        
        {isImporting && importProgress.total > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Importing employees...</span>
              <span>{importProgress.current} / {importProgress.total}</span>
            </div>
            <Progress value={(importProgress.current / importProgress.total) * 100} />
          </div>
        )}
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading employees...</div>
        ) : (
          <div className="space-y-3">
            {filteredEmployees.map(emp => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                onEdit={handleEdit}
                onDelete={handleDeleteEmployee}
                onBlockUnblock={handleBlockUnblock}
                onResetPassword={handleResetPassword}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeManagement;
