import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { User, Edit, Plus, AlertCircle, Search, Users, Calendar, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Indian leave rules - days as per statutory requirements
const DEFAULT_LEAVE_BALANCE = {
  PL: 30,          // Privilege/Earned Leave - 30 days annually
  CL: 12,          // Casual Leave - 12 days annually
  SL: 12,          // Sick Leave - 12 days annually
  WFH: 15,         // Work From Home - company policy
  MATERNITY: 182,  // 26 weeks (182 days) - Female only
  PATERNITY: 15,   // 15 days - Male only (as per company policy, no statutory requirement)
  ADOPTION: 84,    // 12 weeks (84 days) - Female only
  SABBATICAL: 0,
  BEREAVEMENT: 5,  // 5 days for immediate family
  PARENTAL: 0,     // Not commonly used in India
  COMP_OFF: 0,
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  PL: 'Privilege Leave',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  WFH: 'Work From Home',
  MATERNITY: 'Maternity Leave (Female)',
  PATERNITY: 'Paternity Leave (Male)',
  ADOPTION: 'Adoption Leave (Female)',
  SABBATICAL: 'Sabbatical',
  BEREAVEMENT: 'Bereavement Leave',
  PARENTAL: 'Parental Leave',
  COMP_OFF: 'Compensatory Off',
};

// Gender-specific leave types as per Indian rules
const GENDER_SPECIFIC_LEAVES: Record<string, 'Male' | 'Female'> = {
  MATERNITY: 'Female',
  PATERNITY: 'Male',
  ADOPTION: 'Female',
};

const LeaveManagement = () => {
  const { organizationId } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editBalance, setEditBalance] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lastAllocation, setLastAllocation] = useState(null);
  const [canAllocate, setCanAllocate] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await fetchEmployeesWithBalances();
      await checkLastAllocation();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const checkLastAllocation = async () => {
    try {
      const allocationDoc = await getDoc(doc(db, 'system_settings', 'leave_allocation'));
      if (allocationDoc.exists()) {
        const lastDate = allocationDoc.data().lastAllocation;
        setLastAllocation(lastDate);

        const lastAllocationDate = new Date(lastDate);
        const now = new Date();
        const isSameMonth =
          lastAllocationDate.getMonth() === now.getMonth() &&
          lastAllocationDate.getFullYear() === now.getFullYear();
        setCanAllocate(!isSameMonth);
      }
    } catch (error) {
      console.error('Error checking last allocation:', error);
    }
  };

  const fetchEmployeesWithBalances = async () => {
    try {
      setLoading(true);
      let employeesSnapshot;
      if (organizationId) {
        const q = query(collection(db, 'employees'), where('organizationId', '==', organizationId));
        employeesSnapshot = await getDocs(q);
      } else {
        employeesSnapshot = await getDocs(collection(db, 'employees'));
      }

      const data = await Promise.all(
        employeesSnapshot.docs.map(async (employeeDoc) => {
          const empData = employeeDoc.data();
          const balanceRef = doc(db, 'leave_balances', employeeDoc.id);
          const balanceDoc = await getDoc(balanceRef);

          let balance;
          if (balanceDoc.exists()) {
            balance = balanceDoc.data();
          } else {
            balance = {
              employeeId: employeeDoc.id,
              ...DEFAULT_LEAVE_BALANCE,
              lastUpdated: new Date().toISOString(),
            };
            await setDoc(balanceRef, balance);
          }

          return {
            id: employeeDoc.id,
            name: empData.name || 'Unknown',
            employeeCode: empData.employeeCode || '',
            department: empData.department || '—',
            gender: empData.gender || null,
            balance,
          };
        })
      );

      setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBalance = (employee) => {
    setSelectedEmployee(employee);
    setEditBalance(JSON.parse(JSON.stringify(employee.balance)));
    setIsDialogOpen(true);
  };

  const handleUpdateBalance = async () => {
    if (!selectedEmployee || !editBalance) return;

    try {
      await updateDoc(doc(db, 'leave_balances', selectedEmployee.id), {
        ...editBalance,
        lastUpdated: new Date().toISOString(),
      });
      toast.success('Leave balance updated successfully');
      setIsDialogOpen(false);
      setEmployees((prev) =>
        prev.map((e) => (e.id === selectedEmployee.id ? { ...e, balance: editBalance } : e))
      );
    } catch (error) {
      console.error('Error updating balance:', error);
      toast.error('Failed to update leave balance');
    }
  };

  const handleBalanceChange = (leaveType, value) => {
    if (!editBalance) return;
    const numeric = parseFloat(value);
    setEditBalance({
      ...editBalance,
      [leaveType]: Number.isNaN(numeric) ? 0 : numeric,
    });
  };

  const handleAllocateLeaves = async () => {
    if (!canAllocate) {
      toast.error('Monthly leaves have already been allocated this month');
      return;
    }

    const confirmed = window.confirm('Allocate monthly leaves to all employees? This can only be done once per month.');
    if (!confirmed) return;

    try {
      setLoading(true);
      const batch = writeBatch(db);

      employees.forEach((emp) => {
        const balanceRef = doc(db, 'leave_balances', emp.id);
        const current = emp.balance || {};
        const newBalance = {
          employeeId: emp.id,
          PL: (current.PL || 0) + 2.5,
          CL: current.CL ?? DEFAULT_LEAVE_BALANCE.CL,
          SL: current.SL ?? DEFAULT_LEAVE_BALANCE.SL,
          WFH: current.WFH ?? DEFAULT_LEAVE_BALANCE.WFH,
          MATERNITY: current.MATERNITY ?? DEFAULT_LEAVE_BALANCE.MATERNITY,
          PATERNITY: current.PATERNITY ?? DEFAULT_LEAVE_BALANCE.PATERNITY,
          ADOPTION: current.ADOPTION ?? DEFAULT_LEAVE_BALANCE.ADOPTION,
          SABBATICAL: current.SABBATICAL ?? DEFAULT_LEAVE_BALANCE.SABBATICAL,
          BEREAVEMENT: current.BEREAVEMENT ?? DEFAULT_LEAVE_BALANCE.BEREAVEMENT,
          PARENTAL: current.PARENTAL ?? DEFAULT_LEAVE_BALANCE.PARENTAL,
          COMP_OFF: current.COMP_OFF ?? DEFAULT_LEAVE_BALANCE.COMP_OFF,
          lastUpdated: new Date().toISOString(),
        };
        batch.set(balanceRef, newBalance);
      });

      const allocRef = doc(db, 'system_settings', 'leave_allocation');
      batch.set(allocRef, { lastAllocation: new Date().toISOString() });

      await batch.commit();

      toast.success('Monthly leaves allocated to all employees successfully');
      await checkLastAllocation();
      await fetchEmployeesWithBalances();
    } catch (error) {
      console.error('Error allocating leaves:', error);
      toast.error('Failed to allocate leaves');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => `${e.name} ${e.employeeCode} ${e.department}`.toLowerCase().includes(q));
  }, [employees, queryText]);

  const toggleExpand = (id) => setExpandedEmployee((prev) => (prev === id ? null : id));

  // Calculate total leave days across all employees
  const totalPL = employees.reduce((sum, e) => sum + (e.balance?.PL || 0), 0);
  const totalCL = employees.reduce((sum, e) => sum + (e.balance?.CL || 0), 0);
  const totalSL = employees.reduce((sum, e) => sum + (e.balance?.SL || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Leave Balance Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and allocate employee leave balances</p>
        </div>

        <Button onClick={handleAllocateLeaves} disabled={!canAllocate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Allocate Monthly Leaves
        </Button>
      </div>

      {/* Mobile Quick Stats */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
          <span className="text-sm font-medium text-blue-600">{employees.length} Employees</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="text-sm font-medium text-green-600">{totalPL.toFixed(1)} Total PL</span>
        </div>
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
          <span className="text-sm font-medium text-purple-600">{totalCL} Total CL</span>
        </div>
      </div>

      {/* Stats Cards - Desktop */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold text-blue-600">{employees.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total PL Balance</p>
                <p className="text-2xl font-bold text-green-600">{totalPL.toFixed(1)}</p>
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
                <p className="text-sm text-muted-foreground">Total CL Balance</p>
                <p className="text-2xl font-bold text-purple-600">{totalCL}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/20">
                <Wallet className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total SL Balance</p>
                <p className="text-2xl font-bold text-orange-600">{totalSL}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/20">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Allocation Alert */}
      {!canAllocate && lastAllocation && (
        <Alert className="border-yellow-500/30 bg-yellow-500/5">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="ml-2 text-yellow-700">
            Monthly leaves were already allocated on <span className="font-medium">{new Date(lastAllocation).toLocaleDateString()}</span>. You can allocate again next month.
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, code or department..."
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          className="pl-10"
          aria-label="Search employees"
        />
      </div>

      {/* Employee List */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Employee Leave Balances
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No employees found</p>
                </div>
              )}

              {filteredEmployees.map((employee) => (
                <div 
                  key={employee.id} 
                  className="p-4 border rounded-xl transition-all hover:shadow-md hover:border-primary/30 bg-gradient-to-br from-background to-muted/20"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{employee.name}</p>
                          {employee.employeeCode && (
                            <Badge variant="outline" className="text-xs">
                              {employee.employeeCode}
                            </Badge>
                          )}
                          <Badge className="text-xs bg-primary/10 text-primary border-0 hover:bg-primary/20">
                            {employee.department}
                          </Badge>
                        </div>
                        
                        {/* Quick Balance View */}
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {['PL', 'CL', 'SL', 'WFH'].map((type, idx) => {
                            const colors = [
                              'bg-blue-500/10 text-blue-600 border-blue-500/20',
                              'bg-green-500/10 text-green-600 border-green-500/20',
                              'bg-orange-500/10 text-orange-600 border-orange-500/20',
                              'bg-purple-500/10 text-purple-600 border-purple-500/20',
                            ];
                            return (
                              <div key={type} className={`p-2 rounded-lg border ${colors[idx]} text-center`}>
                                <p className="text-xs font-medium opacity-70">{type}</p>
                                <p className="text-lg font-bold">{employee.balance?.[type] ?? 0}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 flex-shrink-0">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => toggleExpand(employee.id)}
                        className="flex-1 sm:flex-none"
                      >
                        {expandedEmployee === employee.id ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            More
                          </>
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEditBalance(employee)}
                        className="flex-1 sm:flex-none"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedEmployee === employee.id && (
                    <div className="mt-4 pt-4 border-t border-dashed">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Additional Leave Balances</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        {['COMP_OFF', 'PARENTAL', 'BEREAVEMENT', 'SABBATICAL', 'MATERNITY', 'PATERNITY', 'ADOPTION']
                          .filter((type) => {
                            const requiredGender = GENDER_SPECIFIC_LEAVES[type];
                            if (!requiredGender) return true; // Not gender-specific
                            return employee.gender === requiredGender;
                          })
                          .map((type) => (
                          <div key={type} className="p-2 rounded-lg bg-muted/50 text-center">
                            <p className="text-xs text-muted-foreground truncate">{LEAVE_TYPE_LABELS[type]?.split(' ')[0] || type}</p>
                            <p className="text-lg font-semibold">{employee.balance?.[type] ?? 0}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit Leave Balance {selectedEmployee ? `- ${selectedEmployee.name}` : ''}
            </DialogTitle>
          </DialogHeader>

          {editBalance && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.keys(DEFAULT_LEAVE_BALANCE)
                  .filter((type) => {
                    const requiredGender = GENDER_SPECIFIC_LEAVES[type];
                    if (!requiredGender) return true; // Not gender-specific
                    return selectedEmployee?.gender === requiredGender;
                  })
                  .map((type) => (
                  <div key={type} className="space-y-2">
                    <Label className="text-sm">{LEAVE_TYPE_LABELS[type] || type}</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={editBalance[type]}
                      onChange={(e) => handleBalanceChange(type, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateBalance}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;
