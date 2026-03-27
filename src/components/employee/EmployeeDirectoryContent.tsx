import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Mail, Phone, Building2, Users, Calendar, User, Briefcase, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';

interface Employee {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  employeeCode: string;
  photoURL?: string;
  designation?: string;
}

const EmployeeDirectoryContent = () => {
  const { organizationId } = useAuth();
  const isMobile = useIsMobile();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchEmployees();
  }, [organizationId]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const q = organizationId 
        ? query(collection(db, 'employees'), where('organizationId', '==', organizationId))
        : collection(db, 'employees');
      const empSnapshot = await getDocs(q);
      
      const empList = empSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          userId: data.userId,
          name: data.name || 'N/A',
          email: data.email || 'N/A',
          phone: data.phone || data.mobile || '',
          department: data.department || 'N/A',
          employeeCode: data.employeeCode || 'N/A',
          photoURL: data.profileImageUrl || data.photoURL || '',
          designation: data.designation || ''
        };
      });
      
      setEmployees(empList);

      const uniqueDepts = Array.from(
        new Set(
          empList
            .map(e => e.department)
            .filter(d => d && d !== 'N/A' && d.trim() !== '')
        )
      ).sort();
      
      setDepartments(uniqueDepts);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = 
      selectedDepartment === 'all' || employee.department === selectedDepartment;

    return matchesSearch && matchesDepartment;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Stats
  const totalEmployees = employees.length;
  const departmentCount = departments.length;
  const filteredCount = filteredEmployees.length;

  return (
    <div className="space-y-6">
      {/* Quick Stats Bar - Mobile Only */}
      {isMobile && (
        <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="text-center">
            <div className="font-bold text-lg text-blue-900">{totalEmployees}</div>
            <div className="text-xs text-blue-600 font-medium">Total</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-purple-900">{departmentCount}</div>
            <div className="text-xs text-purple-600 font-medium">Depts</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-green-900">{filteredCount}</div>
            <div className="text-xs text-green-600 font-medium">Showing</div>
          </div>
        </div>
      )}

      <Card className="w-full shadow-sm border-0 sm:border">
        <CardHeader className="pb-4 sm:pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Employee Directory
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                View and search employee information across your organization
              </CardDescription>
            </div>
            
            {/* Desktop Quick Actions */}
            {!isMobile && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1 bg-blue-100 text-blue-700">
                  <Users className="h-3 w-3 mr-1" />
                  {totalEmployees} Employees
                </Badge>
                <Badge variant="outline" className="px-3 py-1">
                  <Building2 className="h-3 w-3 mr-1" />
                  {departmentCount} Departments
                </Badge>
              </div>
            )}
          </div>

          {/* Active Section Header */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Team Directory</h3>
              <p className="text-sm text-blue-600">Search and browse employee profiles</p>
            </div>
            <Badge variant="outline" className="bg-white">
              {filteredCount} Results
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 space-y-4">
          {/* Search and Filter */}
          <Card className="border-blue-200">
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-blue-900">Search</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-blue-900">Department</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="mt-1 bg-background">
                      <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.length > 0 ? (
                        departments.map(dept => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-dept" disabled>
                          No departments found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards - Desktop */}
          {!isMobile && (
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-900">Total Employees</CardTitle>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900">{totalEmployees}</div>
                  <p className="text-xs text-blue-600 mt-1">In your organization</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-900">Departments</CardTitle>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Building2 className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900">{departmentCount}</div>
                  <p className="text-xs text-purple-600 mt-1">Active departments</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-900">Showing</CardTitle>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Search className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900">{filteredCount}</div>
                  <p className="text-xs text-green-600 mt-1">Matching results</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Employee Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-3">Loading employees...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <Card className="text-center py-16 border-dashed bg-muted/20">
              <CardContent>
                <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Employees Found</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {searchQuery || selectedDepartment !== 'all' 
                    ? 'Try adjusting your search or filter criteria' 
                    : 'No employees in your organization yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map((employee) => (
                <Card key={employee.userId} className="bg-gradient-to-br from-blue-50/30 to-transparent border-blue-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14 border-2 border-blue-200">
                        <AvatarImage src={employee.photoURL} alt={employee.name} />
                        <AvatarFallback className="bg-blue-600 text-white text-lg">
                          {getInitials(employee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate text-blue-900">{employee.name}</CardTitle>
                        <Badge variant="secondary" className="mt-1 bg-blue-100 text-blue-700">
                          {employee.employeeCode}
                        </Badge>
                        {employee.designation && (
                          <p className="text-sm text-blue-600 mt-1 truncate">{employee.designation}</p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <div className="flex items-center gap-2 text-sm p-2 bg-white/50 rounded-lg">
                      <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="truncate text-muted-foreground">{employee.email}</span>
                    </div>
                    
                    {employee.phone && (
                      <div className="flex items-center gap-2 text-sm p-2 bg-white/50 rounded-lg">
                        <Phone className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-muted-foreground">{employee.phone}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm p-2 bg-white/50 rounded-lg">
                      <Building2 className="h-4 w-4 text-purple-500 flex-shrink-0" />
                      <span className="text-muted-foreground">{employee.department}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Quick Actions */}
      {isMobile && (
        <div className="bg-card border rounded-lg shadow-sm p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Summary
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600">Total Staff</p>
              <p className="text-lg font-bold text-blue-900">{totalEmployees}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-xs text-purple-600">Departments</p>
              <p className="text-lg font-bold text-purple-900">{departmentCount}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDirectoryContent;
