import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Plus, Trash2, IndianRupee, Calculator, Calendar, TrendingUp, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface TaxDeclaration {
  id: string;
  section: string;
  category: string;
  amount: number;
  financialYear: string;
  status: string;
  submittedDate: string;
  createdAt: string;
}

// Get current Indian Financial Year
const getCurrentFinancialYear = (): string => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // January is 0
  
  // Indian Financial Year: April to March
  if (currentMonth >= 4) {
    // April to December - Current year to next year
    return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  } else {
    // January to March - Previous year to current year
    return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
  }
};

// Get previous financial year
const getPreviousFinancialYear = (): string => {
  const currentFY = getCurrentFinancialYear();
  const [startYear, endYear] = currentFY.split('-').map(Number);
  return `${startYear - 1}-${(endYear - 1).toString().padStart(2, '0')}`;
};

// Get list of available financial years (current and previous 2 years)
const getAvailableFinancialYears = (): string[] => {
  const currentFY = getCurrentFinancialYear();
  const [startYear] = currentFY.split('-').map(Number);
  
  return [
    currentFY,
    `${startYear - 1}-${(startYear).toString().padStart(2, '0')}`,
    `${startYear - 2}-${(startYear - 1).toString().padStart(2, '0')}`
  ];
};

export default function TaxDeclaration() {
  const { user, organizationId } = useAuth();
  const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const currentFY = getCurrentFinancialYear();
  const previousFY = getPreviousFinancialYear();
  const availableFYs = getAvailableFinancialYears();

  const [newDeclaration, setNewDeclaration] = useState({
    section: '',
    category: '',
    amount: '',
    financialYear: currentFY,
  });

  useEffect(() => {
    if (user) {
      loadDeclarations();
    }
  }, [user]);

  const loadDeclarations = async () => {
    try {
      const q = query(
        collection(db, 'tax_declarations'),
        where('userId', '==', user?.uid),
        orderBy('financialYear', 'desc'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaxDeclaration[];
      setDeclarations(data);
    } catch (error) {
      console.error('Error loading tax declarations:', error);
      toast.error('Failed to load declarations');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDeclaration = async () => {
    if (!newDeclaration.section || !newDeclaration.category || !newDeclaration.amount) {
      toast.error('Please fill in all fields');
      return;
    }

    const amount = parseFloat(newDeclaration.amount);
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Check section limits
    const sectionLimit = getSectionLimit(newDeclaration.section);
    if (sectionLimit > 0 && amount > sectionLimit) {
      toast.error(`Amount exceeds maximum limit of ₹${sectionLimit.toLocaleString()} for ${newDeclaration.section}`);
      return;
    }

    // Check if declaration already exists for same section and financial year
    const existingDeclaration = declarations.find(
      dec => dec.section === newDeclaration.section && 
             dec.financialYear === newDeclaration.financialYear
    );

    if (existingDeclaration) {
      const update = confirm(
        `You already have a declaration for ${newDeclaration.section} in ${newDeclaration.financialYear}. Do you want to update it?`
      );
      
      if (update) {
        await updateDeclaration(existingDeclaration.id, amount);
        return;
      } else {
        return;
      }
    }

    setSubmitting(true);

    try {
      const employeeDoc = await getDoc(doc(db, 'employees', user?.uid || ''));
      const employeeName = employeeDoc.exists() ? employeeDoc.data().name : 'Unknown';

      await addDoc(collection(db, 'tax_declarations'), {
        userId: user?.uid,
        employeeId: user?.uid,
        employeeName: employeeName,
        organizationId: organizationId,
        section: newDeclaration.section,
        category: newDeclaration.category,
        amount: amount,
        financialYear: newDeclaration.financialYear,
        status: 'pending',
        submittedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setNewDeclaration({ section: '', category: '', amount: '', financialYear: currentFY });
      toast.success('Tax declaration added successfully');
      loadDeclarations();
    } catch (error) {
      console.error('Error adding declaration:', error);
      toast.error('Failed to add declaration');
    } finally {
      setSubmitting(false);
    }
  };

  const updateDeclaration = async (id: string, newAmount: number) => {
    try {
      await updateDoc(doc(db, 'tax_declarations', id), {
        amount: newAmount,
        category: newDeclaration.category,
        updatedAt: new Date().toISOString(),
        status: 'pending' // Reset status when updated
      });

      setNewDeclaration({ section: '', category: '', amount: '', financialYear: currentFY });
      toast.success('Tax declaration updated successfully');
      loadDeclarations();
    } catch (error) {
      console.error('Error updating declaration:', error);
      toast.error('Failed to update declaration');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tax declaration?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'tax_declarations', id));
      toast.success('Declaration removed successfully');
      loadDeclarations();
    } catch (error) {
      console.error('Error deleting declaration:', error);
      toast.error('Failed to delete declaration');
    }
  };

  const getSectionLimit = (section: string) => {
    const limits: { [key: string]: number } = {
      '80C': 150000,
      '80D': 25000, // Self, spouse, children
      '80CCD(1B)': 50000, // NPS additional deduction
      '80D_parents': 50000, // Parents (senior citizens)
      '80E': 0, // No limit, but interest paid
      '80G': 0, // Varies based on donation
      'HRA': 0, // Based on salary structure
      'LTA': 0, // Based on actual travel
    };
    return limits[section] || 0;
  };

  const getSectionDescription = (section: string) => {
    const descriptions: { [key: string]: string } = {
      '80C': 'Investments in PPF, ELSS, EPF, Life Insurance, etc. (Limit: ₹1.5L)',
      '80D': 'Medical Insurance Premium (Limit: ₹25K)',
      '80CCD(1B)': 'Additional NPS Contribution (Limit: ₹50K)',
      '80D_parents': 'Medical Insurance for Parents (Limit: ₹50K for senior citizens)',
      '80E': 'Education Loan Interest (No limit)',
      '80G': 'Donations to Charitable Institutions',
      'HRA': 'House Rent Allowance Exemption',
      'LTA': 'Leave Travel Allowance Exemption',
    };
    return descriptions[section] || 'Tax saving investment';
  };

  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'destructive';
      case 'pending':
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <CheckCircle className="h-3 w-3" />;
      case 'rejected':
        return <AlertCircle className="h-3 w-3" />;
      case 'pending':
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  // Calculate stats
  const totalDeclarations = declarations.length;
  const totalAmount = declarations.reduce((sum, dec) => sum + dec.amount, 0);
  const currentFYTotal = declarations
    .filter(dec => dec.financialYear === currentFY)
    .reduce((sum, dec) => sum + dec.amount, 0);
  const pendingDeclarations = declarations.filter(dec => dec.status === 'pending').length;
  const approvedDeclarations = declarations.filter(dec => dec.status === 'approved').length;

  // Calculate utilization for each section in current FY
  const sectionUtilization = declarations
    .filter(dec => dec.financialYear === currentFY)
    .reduce((acc, dec) => {
      if (!acc[dec.section]) {
        acc[dec.section] = 0;
      }
      acc[dec.section] += dec.amount;
      return acc;
    }, {} as { [key: string]: number });

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-600 font-medium">Total Declarations</div>
          </div>
          <div className="text-lg font-bold text-blue-900 mt-1">{totalDeclarations}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-green-600" />
            <div className="text-xs text-green-600 font-medium">Total Amount</div>
          </div>
          <div className="text-lg font-bold text-green-900 mt-1">
            ₹{totalAmount.toLocaleString()}
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-600" />
            <div className="text-xs text-orange-600 font-medium">{currentFY} Total</div>
          </div>
          <div className="text-lg font-bold text-orange-900 mt-1">
            ₹{currentFYTotal.toLocaleString()}
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <div className="text-xs text-purple-600 font-medium">Pending</div>
          </div>
          <div className="text-lg font-bold text-purple-900 mt-1">{pendingDeclarations}</div>
        </div>
      </div>

      {/* Section Utilization */}
      {Object.keys(sectionUtilization).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Section-wise Utilization ({currentFY})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(sectionUtilization).map(([section, amount]) => {
              const limit = getSectionLimit(section);
              const percentage = limit > 0 ? (amount / limit) * 100 : 0;
              return (
                <div key={section} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{section}</span>
                    <span>₹{amount.toLocaleString()} / ₹{limit.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        percentage >= 100 ? 'bg-red-500' : 
                        percentage >= 80 ? 'bg-orange-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calculator className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl">Tax Declaration</CardTitle>
              <CardDescription>
                Declare your tax-saving investments and expenses for {currentFY}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Add Declaration Form */}
          <Card className="border-dashed bg-blue-50/50">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="section" className="text-sm font-medium">
                        Section
                      </Label>
                      <Select
                        value={newDeclaration.section}
                        onValueChange={(value) => setNewDeclaration({ ...newDeclaration, section: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select tax section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="80C">Section 80C (₹1.5L)</SelectItem>
                          <SelectItem value="80D">Section 80D (₹25K)</SelectItem>
                          <SelectItem value="80CCD(1B)">Section 80CCD(1B) - NPS (₹50K)</SelectItem>
                          <SelectItem value="80D_parents">Section 80D - Parents (₹50K)</SelectItem>
                          <SelectItem value="80E">Section 80E (Education Loan)</SelectItem>
                          <SelectItem value="80G">Section 80G (Donations)</SelectItem>
                          <SelectItem value="HRA">HRA Exemption</SelectItem>
                          <SelectItem value="LTA">LTA Exemption</SelectItem>
                        </SelectContent>
                      </Select>
                      {newDeclaration.section && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {getSectionDescription(newDeclaration.section)}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="category" className="text-sm font-medium">
                        Category
                      </Label>
                      <Select
                        value={newDeclaration.category}
                        onValueChange={(value) => setNewDeclaration({ ...newDeclaration, category: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PPF">Public Provident Fund (PPF)</SelectItem>
                          <SelectItem value="ELSS">ELSS Mutual Funds</SelectItem>
                          <SelectItem value="EPF">Employee Provident Fund (EPF)</SelectItem>
                          <SelectItem value="NPS">National Pension System (NPS)</SelectItem>
                          <SelectItem value="NSC">National Savings Certificate (NSC)</SelectItem>
                          <SelectItem value="LIC">Life Insurance Premium</SelectItem>
                          <SelectItem value="Home Loan">Home Loan Principal</SelectItem>
                          <SelectItem value="Health Insurance">Health Insurance</SelectItem>
                          <SelectItem value="Education Loan">Education Loan Interest</SelectItem>
                          <SelectItem value="Tuition Fees">Children Tuition Fees</SelectItem>
                          <SelectItem value="Other">Other Investments</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="amount" className="text-sm font-medium">
                        Amount (₹)
                      </Label>
                      <div className="relative mt-1">
                        <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="amount"
                          type="number"
                          value={newDeclaration.amount}
                          onChange={(e) => setNewDeclaration({ ...newDeclaration, amount: e.target.value })}
                          placeholder="Enter amount"
                          className="pl-10"
                        />
                      </div>
                      {newDeclaration.section && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Section limit: ₹{getSectionLimit(newDeclaration.section).toLocaleString()}
                          {sectionUtilization[newDeclaration.section] && (
                            <span className="ml-2">
                              (Used: ₹{sectionUtilization[newDeclaration.section].toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="financialYear" className="text-sm font-medium">
                        Financial Year
                      </Label>
                      <Select
                        value={newDeclaration.financialYear}
                        onValueChange={(value) => setNewDeclaration({ ...newDeclaration, financialYear: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFYs.map(fy => (
                            <SelectItem key={fy} value={fy}>
                              {fy} {fy === currentFY ? '(Current)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleAddDeclaration} 
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                  disabled={!newDeclaration.section || !newDeclaration.category || !newDeclaration.amount || submitting}
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Declaration
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Declarations List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-3">Loading declarations...</p>
            </div>
          ) : declarations.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <CardContent>
                <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No declarations yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your tax-saving declarations to get started with tax planning for {currentFY}
                </p>
                <Button 
                  onClick={() => document.getElementById('section')?.focus()}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Declaration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <ScrollArea className="h-[400px] rounded-lg border">
                  <div className="min-w-[700px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Financial Year</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {declarations.map((declaration) => (
                          <TableRow key={declaration.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {declaration.financialYear}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="p-1 bg-blue-100 rounded">
                                  <FileText className="h-3 w-3 text-blue-600" />
                                </div>
                                {declaration.section}
                              </div>
                            </TableCell>
                            <TableCell>{declaration.category}</TableCell>
                            <TableCell className="text-right font-semibold">
                              ₹{declaration.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(declaration.status)} className="flex items-center gap-1 w-fit">
                                {getStatusIcon(declaration.status)}
                                {declaration.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(declaration.submittedDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDelete(declaration.id)}
                                className="hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
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
              <div className="lg:hidden space-y-3">
                {declarations.map((declaration) => (
                  <Card key={declaration.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-base">{declaration.section}</h3>
                            <p className="text-sm text-muted-foreground">{declaration.category}</p>
                          </div>
                        </div>
                        <Badge variant={getStatusVariant(declaration.status)} className="flex items-center gap-1">
                          {getStatusIcon(declaration.status)}
                          {declaration.status}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">Amount</div>
                          <div className="text-lg font-bold text-green-600">
                            ₹{declaration.amount.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">Financial Year</div>
                          <div className="text-sm font-semibold">{declaration.financialYear}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs text-muted-foreground font-medium">Submitted</div>
                          <div className="text-sm">
                            {new Date(declaration.submittedDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex justify-end pt-2 border-t">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDelete(declaration.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Summary */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div className="font-medium">Summary for {currentFY}:</div>
                    <div className="flex items-center gap-4">
                      <span className="text-green-600 font-bold">
                        ₹{currentFYTotal.toLocaleString()} declared
                      </span>
                      <span className="text-blue-600">
                        {approvedDeclarations} approved
                      </span>
                      <span className="text-orange-600">
                        {pendingDeclarations} pending
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
