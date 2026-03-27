import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Calendar, TrendingUp, User, Briefcase, FileText } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const SalaryTab = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [salarySlips, setSalarySlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalarySlips();
  }, [user]);

  const fetchSalarySlips = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const q = query(
        collection(db, 'salary_slips'),
        where('employeeId', '==', user.uid),
        orderBy('month', 'desc')
      );
      const snapshot = await getDocs(q);
      setSalarySlips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching salary slips:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalEarnings = salarySlips.reduce((sum, slip) => sum + (slip.netSalary || 0), 0);
  const avgSalary = salarySlips.length > 0 ? totalEarnings / salarySlips.length : 0;
  const latestSalary = salarySlips[0]?.netSalary || 0;

  return (
    <div className="space-y-6">
      {/* Quick Stats Bar - Mobile Only */}
      {isMobile && (
        <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
          <div className="text-center">
            <div className="font-bold text-lg text-green-900">{salarySlips.length}</div>
            <div className="text-xs text-green-600 font-medium">Slips</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-blue-900">₹{(latestSalary / 1000).toFixed(0)}K</div>
            <div className="text-xs text-blue-600 font-medium">Latest</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-purple-900">₹{(avgSalary / 1000).toFixed(0)}K</div>
            <div className="text-xs text-purple-600 font-medium">Average</div>
          </div>
        </div>
      )}

      <Card className="w-full shadow-sm border-0 sm:border">
        <CardHeader className="pb-4 sm:pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Salary Slips
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                View your salary history and payment details
              </CardDescription>
            </div>
            
            {/* Desktop Quick Actions */}
            {!isMobile && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1 bg-green-100 text-green-700">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {salarySlips.length} Slips
                </Badge>
                <Badge variant="outline" className="px-3 py-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </Badge>
              </div>
            )}
          </div>

          {/* Active Section Header */}
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">Payment History</h3>
              <p className="text-sm text-green-600">Your salary slip records and breakdowns</p>
            </div>
            <Badge variant="outline" className="bg-white">
              Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6">
          {/* Stats Cards - Desktop */}
          {!isMobile && salarySlips.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-900">Latest Salary</CardTitle>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900">₹{latestSalary.toLocaleString()}</div>
                  <p className="text-xs text-green-600 mt-1">{salarySlips[0]?.month} {salarySlips[0]?.year}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-900">Average Salary</CardTitle>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900">₹{avgSalary.toLocaleString()}</div>
                  <p className="text-xs text-blue-600 mt-1">Monthly average</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-900">Total Earnings</CardTitle>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900">₹{totalEarnings.toLocaleString()}</div>
                  <p className="text-xs text-purple-600 mt-1">{salarySlips.length} pay periods</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Salary Slips List */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-muted-foreground mt-3">Loading salary slips...</p>
              </div>
            ) : salarySlips.length > 0 ? (
              salarySlips.map(slip => (
                <Card key={slip.id} className="bg-gradient-to-r from-green-50/50 to-transparent border-green-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                          <FileText className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-lg text-green-900">{slip.month} {slip.year}</p>
                          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Basic Salary</p>
                              <p className="text-sm font-medium">₹{slip.basicSalary?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">HRA</p>
                              <p className="text-sm font-medium">₹{slip.hra?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Travel Allowance</p>
                              <p className="text-sm font-medium">₹{slip.travelAllowance?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Other Allowances</p>
                              <p className="text-sm font-medium">₹{slip.otherAllowances?.toLocaleString() || 0}</p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-green-200 grid grid-cols-2 gap-x-6 gap-y-2">
                            <div>
                              <p className="text-xs text-red-600">Tax Deduction</p>
                              <p className="text-sm font-medium text-red-700">-₹{slip.taxDeduction?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-red-600">PF Deduction</p>
                              <p className="text-sm font-medium text-red-700">-₹{slip.pfDeduction?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-red-600">Other Deductions</p>
                              <p className="text-sm font-medium text-red-700">-₹{slip.otherDeductions?.toLocaleString() || 0}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row md:flex-col items-center md:items-end gap-3">
                        <Badge className="bg-green-100 text-green-700 border-green-300">
                          Paid
                        </Badge>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Net Salary</p>
                          <p className="text-xl font-bold text-green-600">₹{slip.netSalary?.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="text-center py-16 border-dashed bg-muted/20">
                <CardContent>
                  <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No Salary Slips</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Your salary slip records will appear here once they are generated.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mobile Quick Actions */}
      {isMobile && salarySlips.length > 0 && (
        <div className="bg-card border rounded-lg shadow-sm p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Summary
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-600">Total Earnings</p>
              <p className="text-lg font-bold text-green-900">₹{(totalEarnings / 1000).toFixed(0)}K</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600">Pay Periods</p>
              <p className="text-lg font-bold text-blue-900">{salarySlips.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryTab;
