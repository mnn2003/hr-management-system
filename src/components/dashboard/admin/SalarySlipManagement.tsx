import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Receipt, Plus, Edit, Trash2, Search, Download, Calendar, FileText, Users, IndianRupee, TrendingUp, CalendarDays, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SalarySlip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  month: string;
  year: string;
  basicSalary: number;
  hra: number;
  travelAllowance: number;
  otherAllowances: number;
  taxDeduction: number;
  pfDeduction: number;
  otherDeductions: number;
  netSalary: number;
  createdAt: string;
}

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  salary?: number;
}

const SalarySlipManagement = () => {
  const { toast } = useToast();
  const { organizationId } = useAuth();
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [filteredSlips, setFilteredSlips] = useState<SalarySlip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'recent'>('all');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    employeeId: '',
    month: '',
    year: '',
    basicSalary: '',
    hra: '',
    travelAllowance: '',
    otherAllowances: '',
    taxDeduction: '',
    pfDeduction: '',
    otherDeductions: ''
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const currentMonth = months[new Date().getMonth()];
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  useEffect(() => {
    fetchSalarySlips();
    fetchEmployees();
  }, []);

  useEffect(() => {
    let filtered = salarySlips;

    if (searchTerm) {
      filtered = filtered.filter(slip =>
        slip.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        slip.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterMonth && filterMonth !== 'all') {
      filtered = filtered.filter(slip => slip.month === filterMonth);
    }

    if (filterYear && filterYear !== 'all') {
      filtered = filtered.filter(slip => slip.year === filterYear);
    }

    setFilteredSlips(filtered);
  }, [searchTerm, filterMonth, filterYear, salarySlips]);

  const fetchEmployees = async () => {
    try {
      let snapshot;
      if (organizationId) {
        const q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'employees'));
      }
      const employeeData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(employeeData);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchSalarySlips = async () => {
    try {
      setLoading(true);
      let slipsData: SalarySlip[] = [];
      
      try {
        let q;
        if (organizationId) {
          q = query(
            collection(db, 'salary_slips'),
            where('organizationId', '==', organizationId),
            orderBy('year', 'desc'),
            orderBy('month', 'desc')
          );
        } else {
          q = query(collection(db, 'salary_slips'), orderBy('year', 'desc'), orderBy('month', 'desc'));
        }
        const snapshot = await getDocs(q);
        slipsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as any)
        })) as SalarySlip[];
      } catch (indexError: any) {
        let q;
        if (organizationId) {
          q = query(
            collection(db, 'salary_slips'),
            where('organizationId', '==', organizationId)
          );
        } else {
          q = query(collection(db, 'salary_slips'));
        }
        const snapshot = await getDocs(q);
        slipsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as any)
        })) as SalarySlip[];
      }
      
      slipsData.sort((a, b) => {
        if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
        return months.indexOf(b.month) - months.indexOf(a.month);
      });
      
      setSalarySlips(slipsData);
      setFilteredSlips(slipsData);
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      toast({
        title: "Error",
        description: "Failed to fetch salary slips",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateNetSalary = () => {
    const basic = parseFloat(formData.basicSalary) || 0;
    const hra = parseFloat(formData.hra) || 0;
    const travel = parseFloat(formData.travelAllowance) || 0;
    const otherAllow = parseFloat(formData.otherAllowances) || 0;
    const tax = parseFloat(formData.taxDeduction) || 0;
    const pf = parseFloat(formData.pfDeduction) || 0;
    const otherDed = parseFloat(formData.otherDeductions) || 0;

    const totalEarnings = basic + hra + travel + otherAllow;
    const totalDeductions = tax + pf + otherDed;
    return totalEarnings - totalDeductions;
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (employee && employee.salary) {
      setFormData({
        ...formData,
        employeeId,
        basicSalary: employee.salary.toString(),
        hra: (employee.salary * 0.4).toFixed(2),
        pfDeduction: (employee.salary * 0.12).toFixed(2)
      });
    } else {
      setFormData({ ...formData, employeeId });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const employee = employees.find(e => e.id === formData.employeeId);
      if (!employee) {
        toast({
          title: "Error",
          description: "Please select an employee",
          variant: "destructive",
        });
        return;
      }

      const netSalary = calculateNetSalary();
      const totalAllowances = (parseFloat(formData.hra) || 0) + 
                             (parseFloat(formData.travelAllowance) || 0) + 
                             (parseFloat(formData.otherAllowances) || 0);
      const totalDeductions = (parseFloat(formData.taxDeduction) || 0) + 
                             (parseFloat(formData.pfDeduction) || 0) + 
                             (parseFloat(formData.otherDeductions) || 0);
      
      const slipData = {
        employeeId: formData.employeeId,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        organizationId: organizationId,
        month: formData.month,
        year: formData.year,
        basicSalary: parseFloat(formData.basicSalary) || 0,
        hra: parseFloat(formData.hra) || 0,
        travelAllowance: parseFloat(formData.travelAllowance) || 0,
        otherAllowances: parseFloat(formData.otherAllowances) || 0,
        allowances: totalAllowances,
        taxDeduction: parseFloat(formData.taxDeduction) || 0,
        pfDeduction: parseFloat(formData.pfDeduction) || 0,
        otherDeductions: parseFloat(formData.otherDeductions) || 0,
        deductions: totalDeductions,
        netSalary,
        status: 'paid'
      };

      if (isEditMode && editingId) {
        await updateDoc(doc(db, 'salary_slips', editingId), slipData);
        toast({
          title: "Success",
          description: "Salary slip updated successfully!",
        });
      } else {
        await addDoc(collection(db, 'salary_slips'), {
          ...slipData,
          createdAt: new Date().toISOString()
        });
        toast({
          title: "Success",
          description: "Salary slip generated successfully!",
        });
      }

      setIsDialogOpen(false);
      setIsEditMode(false);
      setEditingId(null);
      resetForm();
      fetchSalarySlips();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Operation failed',
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      month: '',
      year: '',
      basicSalary: '',
      hra: '',
      travelAllowance: '',
      otherAllowances: '',
      taxDeduction: '',
      pfDeduction: '',
      otherDeductions: ''
    });
  };

  const handleEdit = (slip: SalarySlip) => {
    setFormData({
      employeeId: slip.employeeId,
      month: slip.month,
      year: slip.year,
      basicSalary: slip.basicSalary.toString(),
      hra: slip.hra.toString(),
      travelAllowance: slip.travelAllowance.toString(),
      otherAllowances: slip.otherAllowances.toString(),
      taxDeduction: slip.taxDeduction.toString(),
      pfDeduction: slip.pfDeduction.toString(),
      otherDeductions: slip.otherDeductions.toString()
    });
    setEditingId(slip.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    resetForm();
    setIsEditMode(false);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this salary slip?')) {
      try {
        await deleteDoc(doc(db, 'salary_slips', id));
        toast({
          title: "Success",
          description: "Salary slip deleted successfully!",
        });
        fetchSalarySlips();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete salary slip",
          variant: "destructive",
        });
      }
    }
  };

  const handleDownload = (slip: SalarySlip) => {
    const content = `
SALARY SLIP
${slip.month} ${slip.year}

Employee: ${slip.employeeName}
Employee Code: ${slip.employeeCode}

EARNINGS:
Basic Salary: ₹${slip.basicSalary.toFixed(2)}
HRA: ₹${slip.hra.toFixed(2)}
Travel Allowance: ₹${slip.travelAllowance.toFixed(2)}
Other Allowances: ₹${slip.otherAllowances.toFixed(2)}
Total Earnings: ₹${(slip.basicSalary + slip.hra + slip.travelAllowance + slip.otherAllowances).toFixed(2)}

DEDUCTIONS:
Tax: ₹${slip.taxDeduction.toFixed(2)}
PF: ₹${slip.pfDeduction.toFixed(2)}
Other Deductions: ₹${slip.otherDeductions.toFixed(2)}
Total Deductions: ₹${(slip.taxDeduction + slip.pfDeduction + slip.otherDeductions).toFixed(2)}

NET SALARY: ₹${slip.netSalary.toFixed(2)}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Salary_Slip_${slip.employeeCode}_${slip.month}_${slip.year}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculate stats
  const totalPayout = salarySlips.reduce((sum, s) => sum + s.netSalary, 0);
  const currentMonthSlips = salarySlips.filter(s => s.month === currentMonth && s.year === currentYear.toString());
  const currentMonthPayout = currentMonthSlips.reduce((sum, s) => sum + s.netSalary, 0);
  const uniqueEmployees = new Set(salarySlips.map(s => s.employeeId)).size;

  const recentSlips = salarySlips.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Salary Slip Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Generate and manage employee salary slips</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Generate Salary Slip
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Edit Salary Slip' : 'Generate New Salary Slip'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="employeeId">Employee</Label>
                  <SearchableEmployeeSelect
                    employees={employees}
                    value={formData.employeeId}
                    onValueChange={handleEmployeeSelect}
                    placeholder="Select employee"
                    disabled={isEditMode}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="month">Month</Label>
                  <Select value={formData.month} onValueChange={(value) => setFormData({ ...formData, month: value })}>
                    <SelectTrigger id="month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Select value={formData.year} onValueChange={(value) => setFormData({ ...formData, year: value })}>
                    <SelectTrigger id="year">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 text-green-600">Earnings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="basicSalary">Basic Salary (₹)</Label>
                    <Input
                      id="basicSalary"
                      type="number"
                      step="0.01"
                      value={formData.basicSalary}
                      onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hra">HRA (₹)</Label>
                    <Input
                      id="hra"
                      type="number"
                      step="0.01"
                      value={formData.hra}
                      onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="travelAllowance">Travel Allowance (₹)</Label>
                    <Input
                      id="travelAllowance"
                      type="number"
                      step="0.01"
                      value={formData.travelAllowance}
                      onChange={(e) => setFormData({ ...formData, travelAllowance: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otherAllowances">Other Allowances (₹)</Label>
                    <Input
                      id="otherAllowances"
                      type="number"
                      step="0.01"
                      value={formData.otherAllowances}
                      onChange={(e) => setFormData({ ...formData, otherAllowances: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 text-red-600">Deductions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxDeduction">Tax Deduction (₹)</Label>
                    <Input
                      id="taxDeduction"
                      type="number"
                      step="0.01"
                      value={formData.taxDeduction}
                      onChange={(e) => setFormData({ ...formData, taxDeduction: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pfDeduction">PF Deduction (₹)</Label>
                    <Input
                      id="pfDeduction"
                      type="number"
                      step="0.01"
                      value={formData.pfDeduction}
                      onChange={(e) => setFormData({ ...formData, pfDeduction: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otherDeductions">Other Deductions (₹)</Label>
                    <Input
                      id="otherDeductions"
                      type="number"
                      step="0.01"
                      value={formData.otherDeductions}
                      onChange={(e) => setFormData({ ...formData, otherDeductions: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                  <span className="font-semibold text-lg">Net Salary:</span>
                  <span className="text-2xl font-bold text-primary">₹{calculateNetSalary().toFixed(2)}</span>
                </div>
              </div>

              <Button type="submit" className="w-full">
                {isEditMode ? 'Update Salary Slip' : 'Generate Salary Slip'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile Quick Stats */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
          <span className="text-sm font-medium text-blue-600">{salarySlips.length} Slips</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="text-sm font-medium text-green-600">{uniqueEmployees} Employees</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
          <span className="text-sm font-medium text-purple-600">₹{(totalPayout / 100000).toFixed(1)}L Total</span>
        </div>
      </div>

      {/* Stats Cards - Desktop */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Slips</p>
                <p className="text-2xl font-bold text-blue-600">{salarySlips.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/20">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold text-green-600">{currentMonthSlips.length}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/20">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Employees Paid</p>
                <p className="text-2xl font-bold text-purple-600">{uniqueEmployees}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/20">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Payout</p>
                <p className="text-2xl font-bold text-orange-600">₹{(totalPayout / 100000).toFixed(1)}L</p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/20">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'recent')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="all" className="gap-2">
            <FileText className="h-4 w-4" />
            All Slips ({salarySlips.length})
          </TabsTrigger>
          <TabsTrigger value="recent" className="gap-2">
            <Calendar className="h-4 w-4" />
            Recent ({recentSlips.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-primary" />
                All Salary Slips
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by employee name or code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {months.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-full md:w-32">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {years.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSlips.map(slip => (
                    <div 
                      key={slip.id} 
                      className="p-4 border rounded-xl space-y-4 hover:border-primary/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <p className="font-semibold text-lg">{slip.employeeName}</p>
                            <Badge variant="outline" className="text-xs">{slip.employeeCode}</Badge>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">
                              <CalendarDays className="h-3 w-3 mr-1" />
                              {slip.month} {slip.year}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Net Salary</p>
                          <p className="text-xl font-bold text-primary">₹{slip.netSalary.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Basic</p>
                          <p className="font-medium">₹{slip.basicSalary.toFixed(2)}</p>
                        </div>
                        <div className="bg-green-500/5 p-3 rounded-lg border border-green-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Allowances</p>
                          <p className="font-medium text-green-600">+₹{(slip.hra + slip.travelAllowance + slip.otherAllowances).toFixed(2)}</p>
                        </div>
                        <div className="bg-red-500/5 p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Deductions</p>
                          <p className="font-medium text-red-600">-₹{(slip.taxDeduction + slip.pfDeduction + slip.otherDeductions).toFixed(2)}</p>
                        </div>
                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                          <p className="text-xs text-muted-foreground mb-1">Net Pay</p>
                          <p className="font-medium text-primary">₹{slip.netSalary.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleDownload(slip)} className="gap-2">
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(slip)} className="gap-2">
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(slip.id)} className="gap-2">
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredSlips.length === 0 && (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <Receipt className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-medium">No salary slips found</p>
                      <p className="text-muted-foreground">Generate a new salary slip to get started</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="mt-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Recent Salary Slips
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentSlips.map(slip => (
                    <div 
                      key={slip.id} 
                      className="p-4 border rounded-xl space-y-4 hover:border-primary/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <p className="font-semibold text-lg">{slip.employeeName}</p>
                            <Badge variant="outline" className="text-xs">{slip.employeeCode}</Badge>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">
                              <CalendarDays className="h-3 w-3 mr-1" />
                              {slip.month} {slip.year}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Net Salary</p>
                          <p className="text-xl font-bold text-primary">₹{slip.netSalary.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Basic</p>
                          <p className="font-medium">₹{slip.basicSalary.toFixed(2)}</p>
                        </div>
                        <div className="bg-green-500/5 p-3 rounded-lg border border-green-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Allowances</p>
                          <p className="font-medium text-green-600">+₹{(slip.hra + slip.travelAllowance + slip.otherAllowances).toFixed(2)}</p>
                        </div>
                        <div className="bg-red-500/5 p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Deductions</p>
                          <p className="font-medium text-red-600">-₹{(slip.taxDeduction + slip.pfDeduction + slip.otherDeductions).toFixed(2)}</p>
                        </div>
                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                          <p className="text-xs text-muted-foreground mb-1">Net Pay</p>
                          <p className="font-medium text-primary">₹{slip.netSalary.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleDownload(slip)} className="gap-2">
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(slip)} className="gap-2">
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(slip.id)} className="gap-2">
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {recentSlips.length === 0 && (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <Receipt className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-medium">No recent salary slips</p>
                      <p className="text-muted-foreground">Generate a new salary slip to get started</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalarySlipManagement;
