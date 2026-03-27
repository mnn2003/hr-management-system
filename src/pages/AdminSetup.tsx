import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Shield } from 'lucide-react';

const AdminSetup = () => {
  const [step, setStep] = useState<'register' | 'add-employees'>('register');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    employeeCode: '',
    phone: '',
    role: 'hr' as 'hr' | 'hod'
  });
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    employeeCode: '',
    email: '',
    phone: '',
    address: ''
  });
  const { register, user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already logged in as admin, show add employees step
    if (user && (userRole === 'hr' || userRole === 'hod')) {
      setStep('add-employees');
    }
  }, [user, userRole]);

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(
        formData.email,
        formData.password,
        formData.role,
        {
          name: formData.name,
          employeeCode: formData.employeeCode,
          email: formData.email,
          phone: formData.phone,
          address: ''
        }
      );
      toast.success('Admin account created successfully!');
      setStep('add-employees');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create admin account');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate email
      if (!newEmployee.email || !newEmployee.email.includes('@')) {
        toast.error('Valid email address is required');
        return;
      }
      
      // Create employee with actual email
      const email = newEmployee.email.trim();
      await register(
        email,
        newEmployee.employeeCode, // Default password = employee code
        'staff',
        {
          name: newEmployee.name,
          employeeCode: newEmployee.employeeCode,
          email: newEmployee.email,
          phone: newEmployee.phone,
          address: newEmployee.address
        }
      );
      toast.success('Employee added successfully!');
      setNewEmployee({
        name: '',
        employeeCode: '',
        email: '',
        phone: '',
        address: ''
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to add employee');
    }
  };

  if (step === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Setup</CardTitle>
            <CardDescription>Create your admin account to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="employeeCode">Employee Code</Label>
                <Input
                  id="employeeCode"
                  value={formData.employeeCode}
                  onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  placeholder="ADMIN001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1234567890"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'hr' | 'hod') => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="hod">HOD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter secure password"
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full">
                Create Admin Account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-accent/10 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Add Employee</CardTitle>
            <CardDescription>
              Add new employees to the system. Default password will be their employee code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emp-name">Full Name</Label>
                  <Input
                    id="emp-name"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    placeholder="Employee Name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emp-code">Employee Code</Label>
                  <Input
                    id="emp-code"
                    value={newEmployee.employeeCode}
                    onChange={(e) => setNewEmployee({ ...newEmployee, employeeCode: e.target.value })}
                    placeholder="W0115"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emp-email">Email</Label>
                  <Input
                    id="emp-email"
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    placeholder="employee@company.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emp-phone">Phone Number</Label>
                  <Input
                    id="emp-phone"
                    type="tel"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                    placeholder="+1234567890"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="emp-address">Address</Label>
                  <Input
                    id="emp-address"
                    value={newEmployee.address}
                    onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}
                    placeholder="Full address"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  Add Employee
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Go to Dashboard
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Important:</strong> After adding all required users, disable or remove the link to this page to prevent unauthorized access.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminSetup;
