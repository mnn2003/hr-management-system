import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, Calendar, IndianRupee, TrendingUp, FileCheck, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Payslip {
  id: string;
  month: string;
  year: number;
  basicSalary: number;
  hra?: number;
  travelAllowance?: number;
  otherAllowances?: number;
  taxDeduction?: number;
  pfDeduction?: number;
  otherDeductions?: number;
  allowances?: number;
  deductions?: number;
  netSalary: number;
  status: string;
}

export default function PayslipDownloads() {
  const { user, organizationId } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && organizationId) {
      fetchPayslips();
    }
  }, [user, organizationId]);

  const fetchPayslips = async () => {
    try {
      // First try with organizationId filter
      let q = query(
        collection(db, 'salary_slips'),
        where('employeeId', '==', user?.uid),
        where('organizationId', '==', organizationId)
      );
      
      let snapshot = await getDocs(q);
      
      // Sort the data manually since composite indexes might not exist
      let data = snapshot.docs.map(doc => {
        const docData = doc.data();
        // Calculate allowances and deductions from individual fields
        const allowances = (docData.hra || 0) + (docData.travelAllowance || 0) + (docData.otherAllowances || 0);
        const deductions = (docData.taxDeduction || 0) + (docData.pfDeduction || 0) + (docData.otherDeductions || 0);
        
        return {
          id: doc.id,
          ...docData,
          allowances: docData.allowances || allowances,
          deductions: docData.deductions || deductions
        };
      }) as Payslip[];
      
      // Sort by year and month descending
      data.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
        return months.indexOf(b.month) - months.indexOf(a.month);
      });
      
      setPayslips(data);
    } catch (error) {
      console.error('Error fetching payslips:', error);
      toast.error('Failed to load payslips');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (payslip: Payslip) => {
    toast.success(`Downloading payslip for ${payslip.month} ${payslip.year}`);
  };

  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'success';
      case 'pending':
        return 'secondary';
      case 'processing':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'pending':
        return <Clock className="h-3 w-3" />;
      default:
        return <FileCheck className="h-3 w-3" />;
    }
  };

  // Calculate stats
  const totalPayslips = payslips.length;
  const totalEarnings = payslips.reduce((sum, slip) => sum + (slip.netSalary || 0), 0);
  const currentYearPayslips = payslips.filter(slip => slip.year === new Date().getFullYear()).length;
  const averageSalary = totalPayslips > 0 ? totalEarnings / totalPayslips : 0;

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-600 font-medium">Total Payslips</div>
          </div>
          <div className="text-lg font-bold text-blue-900 mt-1">{totalPayslips}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-green-600" />
            <div className="text-xs text-green-600 font-medium">Total Earnings</div>
          </div>
          <div className="text-lg font-bold text-green-900 mt-1">
            ₹{totalEarnings.toLocaleString()}
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-600" />
            <div className="text-xs text-orange-600 font-medium">This Year</div>
          </div>
          <div className="text-lg font-bold text-orange-900 mt-1">{currentYearPayslips}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <div className="text-xs text-purple-600 font-medium">Avg. Salary</div>
          </div>
          <div className="text-lg font-bold text-purple-900 mt-1">
            ₹{averageSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl">Payslip Downloads</CardTitle>
              <CardDescription>Download your monthly salary slips and view earnings history</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-3">Loading payslips...</p>
            </div>
          ) : payslips.length === 0 ? (
            <Card className="text-center py-16 mx-4 my-4 border-dashed bg-muted/20">
              <CardContent>
                <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No payslips available</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Your payslips will appear here once they are processed by the payroll department.
                </p>
                <Button onClick={fetchPayslips} variant="outline">
                  Refresh
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <ScrollArea className="h-[500px]">
                  <div className="min-w-[800px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Basic Salary</TableHead>
                          <TableHead className="text-right">Allowances</TableHead>
                          <TableHead className="text-right">Deductions</TableHead>
                          <TableHead className="text-right">Net Salary</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payslips.map((payslip) => (
                          <TableRow key={payslip.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {payslip.month} {payslip.year}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ₹{(payslip.basicSalary || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              +₹{(payslip.allowances || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              -₹{(payslip.deductions || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-bold text-blue-600 text-lg">
                              ₹{(payslip.netSalary || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={getStatusVariant(payslip.status)} 
                                className="flex items-center gap-1 w-fit"
                              >
                                {getStatusIcon(payslip.status)}
                                {payslip.status || 'pending'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDownload(payslip)}
                                className="hover:bg-green-50 hover:text-green-600"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3 p-4">
                {payslips.map((payslip) => (
                  <Card key={payslip.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Calendar className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-base">{payslip.month} {payslip.year}</h3>
                            <Badge 
                              variant={getStatusVariant(payslip.status)} 
                              className="flex items-center gap-1 mt-1"
                            >
                              {getStatusIcon(payslip.status)}
                              {payslip.status || 'pending'}
                            </Badge>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownload(payslip)}
                          className="shrink-0 hover:bg-green-50 hover:text-green-600"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Net Salary Highlight */}
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-3">
                        <div className="text-xs text-blue-600 font-medium">Net Salary</div>
                        <div className="text-xl font-bold text-blue-900">
                          ₹{(payslip.netSalary || 0).toLocaleString()}
                        </div>
                      </div>

                      {/* Breakdown Grid */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Basic Salary</div>
                          <div className="font-semibold">₹{(payslip.basicSalary || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Allowances</div>
                          <div className="font-semibold text-green-600">+₹{(payslip.allowances || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Deductions</div>
                          <div className="font-semibold text-red-600">-₹{(payslip.deductions || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Take Home</div>
                          <div className="font-bold text-blue-600">₹{(payslip.netSalary || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Summary Bar */}
                      <div className="flex items-center justify-between pt-3 border-t text-xs">
                        <div className="text-muted-foreground">
                          {payslip.month} {payslip.year}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-green-600 font-medium">
                            +{(((payslip.allowances || 0) / (payslip.basicSalary || 1)) * 100).toFixed(1)}%
                          </div>
                          <div className="text-red-600 font-medium">
                            -{(((payslip.deductions || 0) / (payslip.basicSalary || 1)) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Summary Footer */}
              <div className="border-t p-4 bg-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                  <div className="font-medium">Showing {payslips.length} payslips</div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileCheck className="h-3 w-3" />
                      <span>Latest: {payslips[0]?.month} {payslips[0]?.year}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" />
                      <span>Total: ₹{totalEarnings.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
