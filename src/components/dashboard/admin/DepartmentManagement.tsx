import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, Edit, Trash2, Plus, User } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  hodId?: string;
  hodName?: string;
  createdAt: string;
}

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  role: string;
}

const DepartmentManagement = () => {
  const { toast } = useToast();
  const { organizationId } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    hodId: ''
  });

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, [organizationId]);

  const fetchEmployees = async () => {
    try {
      // Filter employees by organizationId
      const q = organizationId 
        ? query(collection(db, 'employees'), where('organizationId', '==', organizationId))
        : collection(db, 'employees');
      const snapshot = await getDocs(q);
      const employeeData = snapshot.docs.map(doc => ({
        id: doc.id, 
        ...doc.data() 
      })) as Employee[];
      // Filter only HODs and HR for HOD selection
      const hods = employeeData.filter(emp => emp.role === 'hod' || emp.role === 'hr');
      setEmployees(hods);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      // Filter departments by organizationId
      const q = organizationId 
        ? query(collection(db, 'departments'), where('organizationId', '==', organizationId))
        : collection(db, 'departments');
      const snapshot = await getDocs(q);
      const deptData = await Promise.all(
        snapshot.docs.map(async (deptDoc) => {
          const data = deptDoc.data();
          let hodName = '';
          
          if (data.hodId) {
            try {
              // Filter employees by organizationId when fetching HOD
              const empQuery = organizationId 
                ? query(collection(db, 'employees'), where('organizationId', '==', organizationId))
                : collection(db, 'employees');
              const employeesSnap = await getDocs(empQuery);
              const employee = employeesSnap.docs.find(doc => doc.id === data.hodId);
              if (employee) {
                hodName = employee.data().name || '';
              }
            } catch (error) {
              console.error('Error fetching HOD name:', error);
            }
          }
          
          return {
            id: deptDoc.id,
            ...data,
            hodName
          } as Department;
        })
      );
      setDepartments(deptData);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch departments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditMode && editingId) {
        await updateDoc(doc(db, 'departments', editingId), {
          name: formData.name,
          hodId: formData.hodId || null,
          organizationId: organizationId || null
        });
        toast({
          title: "Success",
          description: "Department updated successfully!",
        });
      } else {
        await addDoc(collection(db, 'departments'), {
          name: formData.name,
          hodId: formData.hodId || null,
          organizationId: organizationId || null,
          createdAt: new Date().toISOString()
        });
        toast({
          title: "Success",
          description: "Department added successfully!",
        });
      }
      
      setIsDialogOpen(false);
      setIsEditMode(false);
      setEditingId(null);
      setFormData({ name: '', hodId: '' });
      fetchDepartments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Operation failed',
        variant: "destructive",
      });
    }
  };

  const handleEdit = (dept: Department) => {
    setFormData({
      name: dept.name,
      hodId: dept.hodId || ''
    });
    setEditingId(dept.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setFormData({ name: '', hodId: '' });
    setIsEditMode(false);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this department?')) {
      try {
        await deleteDoc(doc(db, 'departments', id));
        toast({
          title: "Success",
          description: "Department deleted successfully!",
        });
        fetchDepartments();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete department",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Department Management
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditMode ? 'Edit Department' : 'Add New Department'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Department Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., IT, HR, Finance"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="hodId">Head of Department (HOD)</Label>
                  <SearchableEmployeeSelect
                    employees={employees}
                    value={formData.hodId || ''}
                    onValueChange={(value) => setFormData({ ...formData, hodId: value })}
                    placeholder="Select HOD (optional)"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty if no HOD assigned</p>
                </div>
                
                <Button type="submit" className="w-full">
                  {isEditMode ? 'Update Department' : 'Add Department'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3">
            {departments.map(dept => (
              <div key={dept.id} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <p className="font-semibold text-lg">{dept.name}</p>
                    </div>
                    {dept.hodName && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>HOD: {dept.hodName}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(dept)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(dept.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {departments.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No departments added yet</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DepartmentManagement;
