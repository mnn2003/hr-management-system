import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Eye, Receipt, DollarSign, FileText, Briefcase, ChevronLeft, ChevronRight, Calendar, Clock, TrendingUp, IndianRupee, AlertCircle } from 'lucide-react';
import { DocumentViewer } from '@/components/ui/document-viewer';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface TaxDeclaration {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  amount: number;
  status: string;
  submittedDate: string;
}

interface InvestmentProof {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  amount: number;
  documentName: string;
  documentUrl?: string;
  status: string;
  uploadedDate: string;
}

interface LoanApplication {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  amount: number;
  reason: string;
  status: string;
  appliedDate: string;
}

interface Reimbursement {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  amount: number;
  description: string;
  documentName?: string;
  documentUrl?: string;
  status: string;
  submittedDate: string;
}

export default function SelfServiceManagement() {
  const { organizationId } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('tax');
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const tabsListRef = useRef<HTMLDivElement>(null);
  
  const [taxDeclarations, setTaxDeclarations] = useState<TaxDeclaration[]>([]);
  const [investmentProofs, setInvestmentProofs] = useState<InvestmentProof[]>([]);
  const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    checkScreenSize();
    checkScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    checkScrollButtons();
  }, [activeTab, isSmallScreen]);

  useEffect(() => {
    if (organizationId) {
      fetchAllData();
    }
  }, [organizationId]);

  const handleResize = () => {
    checkScreenSize();
    checkScrollButtons();
  };

  const checkScreenSize = () => {
    const width = window.innerWidth;
    setIsSmallScreen(width >= 768 && width <= 1024);
  };

  const checkScrollButtons = () => {
    if (tabsListRef.current) {
      const { scrollWidth, clientWidth } = tabsListRef.current;
      setShowScrollButtons(scrollWidth > clientWidth && !isSmallScreen);
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsListRef.current) {
      const scrollAmount = 200;
      tabsListRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const fetchAllData = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    
    try {
      const [taxDocs, investmentDocs, loanDocs, reimbursementDocs] = await Promise.all([
        getDocs(query(collection(db, 'tax_declarations'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'investment_proofs'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'loan_applications'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'reimbursements'), where('organizationId', '==', organizationId)))
      ]);

      setTaxDeclarations(taxDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaxDeclaration)));
      setInvestmentProofs(investmentDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvestmentProof)));
      setLoanApplications(loanDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoanApplication)));
      setReimbursements(reimbursementDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reimbursement)));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (collectionName: string, id: string, status: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), { status });
      toast.success('Status updated successfully');
      fetchAllData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusStyles = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'approved':
          return 'bg-green-100 text-green-800';
        case 'rejected':
          return 'bg-red-100 text-red-800';
        case 'pending':
          return 'bg-yellow-100 text-yellow-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };
    
    const getStatusIcon = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'approved':
          return <CheckCircle className="h-3 w-3" />;
        case 'rejected':
          return <XCircle className="h-3 w-3" />;
        default:
          return <Clock className="h-3 w-3" />;
      }
    };
    
    return (
      <Badge className={`${getStatusStyles(status)} flex items-center gap-1 w-fit`}>
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'tax':
        return <Receipt className="h-4 w-4" />;
      case 'investment':
        return <DollarSign className="h-4 w-4" />;
      case 'loan':
        return <Briefcase className="h-4 w-4" />;
      case 'reimbursement':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const tabLabels = {
    tax: { full: 'Tax Declarations', short: 'Tax' },
    investment: { full: 'Investment Proofs', short: 'Investments' },
    loan: { full: 'Loan Applications', short: 'Loans' },
    reimbursement: { full: 'Reimbursements', short: 'Claims' }
  };

  const mobileTabLabels = {
    tax: 'Tax',
    investment: 'Invest',
    loan: 'Loan',
    reimbursement: 'Claims'
  };

  // Calculate overall stats
  const pendingCount = 
    taxDeclarations.filter(t => t.status === 'pending').length +
    investmentProofs.filter(t => t.status === 'pending').length +
    loanApplications.filter(t => t.status === 'pending').length +
    reimbursements.filter(t => t.status === 'pending').length;
  
  const totalRequests = taxDeclarations.length + investmentProofs.length + loanApplications.length + reimbursements.length;
  const approvedCount = 
    taxDeclarations.filter(t => t.status === 'approved').length +
    investmentProofs.filter(t => t.status === 'approved').length +
    loanApplications.filter(t => t.status === 'approved').length +
    reimbursements.filter(t => t.status === 'approved').length;

  const renderTabGrid = () => {
    return (
      <div className="grid grid-cols-4 gap-2 p-2 bg-muted/30 rounded-lg">
        {Object.entries(tabLabels).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`
              relative flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium
              transition-all duration-200 ease-in-out border
              ${activeTab === value 
                ? 'bg-background shadow-sm border-border text-blue-600 font-semibold' 
                : 'bg-transparent border-transparent text-muted-foreground hover:bg-background/50'
              }
            `}
          >
            <div className="text-lg">
              {getTabIcon(value)}
            </div>
            <span className="font-medium text-center leading-tight">
              {mobileTabLabels[value as keyof typeof mobileTabLabels]}
            </span>
            <div 
              className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 
                w-1 h-1 bg-blue-600 rounded-full transition-all duration-200
                ${activeTab === value ? 'opacity-100' : 'opacity-0'}
              `}
            />
          </button>
        ))}
      </div>
    );
  };

  const renderHorizontalTabs = () => {
    return (
      <div className="relative px-3 sm:px-4 md:px-6">
        {showScrollButtons && (
          <>
            <button
              onClick={() => scrollTabs('left')}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm border rounded-full p-2 shadow-sm hover:bg-accent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollTabs('right')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm border rounded-full p-2 shadow-sm hover:bg-accent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
        
        <div 
          ref={tabsListRef}
          className="tabs-list-container overflow-x-auto scrollbar-hide scroll-smooth"
          onScroll={checkScrollButtons}
        >
          <TabsList className="w-full inline-flex h-auto p-1 gap-1 bg-muted/50 min-w-max">
            {Object.entries(tabLabels).map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className={`
                  relative flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-medium
                  whitespace-nowrap transition-all duration-200 ease-in-out
                  hover:bg-background/50
                  ${isMobile ? 'flex-col min-w-[70px] h-16' : 'min-w-[120px] h-11'}
                  data-[state=active]:bg-background data-[state=active]:shadow-sm
                  data-[state=active]:border data-[state=active]:border-border
                  data-[state=active]:text-blue-600 data-[state=active]:font-semibold
                `}
              >
                <div className={`${isMobile ? 'text-lg' : ''}`}>
                  {getTabIcon(value)}
                </div>
                <span className={`font-medium ${isMobile ? 'text-xs mt-1' : ''}`}>
                  {isMobile 
                    ? mobileTabLabels[value as keyof typeof mobileTabLabels]
                    : label.short
                  }
                </span>
                <div 
                  className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 
                    w-1 h-1 bg-blue-600 rounded-full transition-all duration-200
                    ${activeTab === value ? 'opacity-100' : 'opacity-0'}
                    ${isMobile ? 'w-6' : 'w-8'}
                  `}
                />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>
    );
  };

  // Tax Declarations Tab Content
  const renderTaxDeclarationsTab = () => {
    const total = taxDeclarations.length;
    const pending = taxDeclarations.filter(t => t.status === 'pending').length;
    const approved = taxDeclarations.filter(t => t.status === 'approved').length;
    const totalAmount = taxDeclarations.reduce((sum, t) => sum + t.amount, 0);

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div className="text-xs text-blue-600 font-medium">Total Declarations</div>
            </div>
            <div className="text-lg font-bold text-blue-900 mt-1">{total}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-green-600" />
              <div className="text-xs text-green-600 font-medium">Total Amount</div>
            </div>
            <div className="text-lg font-bold text-green-900 mt-1">₹{totalAmount.toLocaleString()}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div className="text-xs text-orange-600 font-medium">Pending</div>
            </div>
            <div className="text-lg font-bold text-orange-900 mt-1">{pending}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <div className="text-xs text-purple-600 font-medium">Approved</div>
            </div>
            <div className="text-lg font-bold text-purple-900 mt-1">{approved}</div>
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Tax Declarations</CardTitle>
                <CardDescription>Review and approve employee tax declarations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {taxDeclarations.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Receipt className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No tax declarations</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Employee tax declarations will appear here once submitted
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxDeclarations.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{item.employeeName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">₹{item.amount.toLocaleString()}</TableCell>
                            <TableCell>{new Date(item.submittedDate).toLocaleDateString()}</TableCell>
                            <TableCell><StatusBadge status={item.status} /></TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-2">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus('tax_declarations', item.id, 'approved')}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => updateStatus('tax_declarations', item.id, 'rejected')}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3 p-4">
                  {taxDeclarations.map((item) => (
                    <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{item.employeeName}</h4>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 mt-1">{item.category}</Badge>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3">
                          <div className="text-xs text-green-600 font-medium">Amount</div>
                          <div className="text-xl font-bold text-green-900">₹{item.amount.toLocaleString()}</div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Submitted: {new Date(item.submittedDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => updateStatus('tax_declarations', item.id, 'approved')}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => updateStatus('tax_declarations', item.id, 'rejected')}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Investment Proofs Tab Content
  const renderInvestmentProofsTab = () => {
    const total = investmentProofs.length;
    const pending = investmentProofs.filter(t => t.status === 'pending').length;
    const approved = investmentProofs.filter(t => t.status === 'approved').length;
    const totalAmount = investmentProofs.reduce((sum, t) => sum + t.amount, 0);

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div className="text-xs text-blue-600 font-medium">Total Proofs</div>
            </div>
            <div className="text-lg font-bold text-blue-900 mt-1">{total}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-green-600" />
              <div className="text-xs text-green-600 font-medium">Total Amount</div>
            </div>
            <div className="text-lg font-bold text-green-900 mt-1">₹{totalAmount.toLocaleString()}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div className="text-xs text-orange-600 font-medium">Pending</div>
            </div>
            <div className="text-lg font-bold text-orange-900 mt-1">{pending}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <div className="text-xs text-purple-600 font-medium">Approved</div>
            </div>
            <div className="text-lg font-bold text-purple-900 mt-1">{approved}</div>
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Investment Proofs</CardTitle>
                <CardDescription>Review and approve employee investment documents</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {investmentProofs.length === 0 ? (
              <div className="text-center py-16 px-4">
                <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No investment proofs</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Employee investment proofs will appear here once submitted
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Document</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {investmentProofs.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{item.employeeName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-green-50 text-green-700">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">₹{item.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              {item.documentUrl ? (
                                <Button variant="ghost" size="sm" className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => { setSelectedDoc({ url: item.documentUrl!, name: item.documentName }); setViewerOpen(true); }}>
                                  <Eye className="h-4 w-4" /> View
                                </Button>
                              ) : <span className="text-muted-foreground text-sm">No document</span>}
                            </TableCell>
                            <TableCell>{new Date(item.uploadedDate).toLocaleDateString()}</TableCell>
                            <TableCell><StatusBadge status={item.status} /></TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-2">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus('investment_proofs', item.id, 'approved')}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => updateStatus('investment_proofs', item.id, 'rejected')}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3 p-4">
                  {investmentProofs.map((item) => (
                    <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{item.employeeName}</h4>
                            <Badge variant="outline" className="bg-green-50 text-green-700 mt-1">{item.category}</Badge>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3">
                          <div className="text-xs text-green-600 font-medium">Amount</div>
                          <div className="text-xl font-bold text-green-900">₹{item.amount.toLocaleString()}</div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Uploaded: {new Date(item.uploadedDate).toLocaleDateString()}</span>
                          {item.documentUrl && (
                            <Button variant="ghost" size="sm" className="text-blue-600"
                              onClick={() => { setSelectedDoc({ url: item.documentUrl!, name: item.documentName }); setViewerOpen(true); }}>
                              <Eye className="h-4 w-4 mr-1" /> View Doc
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => updateStatus('investment_proofs', item.id, 'approved')}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => updateStatus('investment_proofs', item.id, 'rejected')}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Loan Applications Tab Content
  const renderLoanApplicationsTab = () => {
    const total = loanApplications.length;
    const pending = loanApplications.filter(t => t.status === 'pending').length;
    const approved = loanApplications.filter(t => t.status === 'approved').length;
    const totalAmount = loanApplications.reduce((sum, t) => sum + t.amount, 0);

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div className="text-xs text-blue-600 font-medium">Total Applications</div>
            </div>
            <div className="text-lg font-bold text-blue-900 mt-1">{total}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-green-600" />
              <div className="text-xs text-green-600 font-medium">Total Amount</div>
            </div>
            <div className="text-lg font-bold text-green-900 mt-1">₹{totalAmount.toLocaleString()}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div className="text-xs text-orange-600 font-medium">Pending</div>
            </div>
            <div className="text-lg font-bold text-orange-900 mt-1">{pending}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <div className="text-xs text-purple-600 font-medium">Approved</div>
            </div>
            <div className="text-lg font-bold text-purple-900 mt-1">{approved}</div>
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Briefcase className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Loan Applications</CardTitle>
                <CardDescription>Review and approve employee loan requests</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loanApplications.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Briefcase className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No loan applications</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Employee loan applications will appear here once submitted
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loanApplications.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{item.employeeName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-purple-50 text-purple-700">{item.type}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">₹{item.amount.toLocaleString()}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={item.reason}>{item.reason}</TableCell>
                            <TableCell>{new Date(item.appliedDate).toLocaleDateString()}</TableCell>
                            <TableCell><StatusBadge status={item.status} /></TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-2">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus('loan_applications', item.id, 'approved')}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => updateStatus('loan_applications', item.id, 'rejected')}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3 p-4">
                  {loanApplications.map((item) => (
                    <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{item.employeeName}</h4>
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 mt-1">{item.type}</Badge>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="bg-gradient-to-r from-green-50 to-purple-50 border border-green-200 rounded-lg p-3">
                          <div className="text-xs text-green-600 font-medium">Amount Requested</div>
                          <div className="text-xl font-bold text-green-900">₹{item.amount.toLocaleString()}</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground font-medium mb-1">Reason</div>
                          <p className="text-sm">{item.reason}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Applied: {new Date(item.appliedDate).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => updateStatus('loan_applications', item.id, 'approved')}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => updateStatus('loan_applications', item.id, 'rejected')}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Reimbursements Tab Content
  const renderReimbursementsTab = () => {
    const total = reimbursements.length;
    const pending = reimbursements.filter(t => t.status === 'pending').length;
    const approved = reimbursements.filter(t => t.status === 'approved').length;
    const totalAmount = reimbursements.reduce((sum, t) => sum + t.amount, 0);

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-600" />
              <div className="text-xs text-blue-600 font-medium">Total Claims</div>
            </div>
            <div className="text-lg font-bold text-blue-900 mt-1">{total}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-green-600" />
              <div className="text-xs text-green-600 font-medium">Total Amount</div>
            </div>
            <div className="text-lg font-bold text-green-900 mt-1">₹{totalAmount.toLocaleString()}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div className="text-xs text-orange-600 font-medium">Pending</div>
            </div>
            <div className="text-lg font-bold text-orange-900 mt-1">{pending}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <div className="text-xs text-purple-600 font-medium">Approved</div>
            </div>
            <div className="text-lg font-bold text-purple-900 mt-1">{approved}</div>
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Receipt className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Reimbursements</CardTitle>
                <CardDescription>Review and approve employee expense claims</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {reimbursements.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Receipt className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No reimbursements</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Employee reimbursement claims will appear here once submitted
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Document</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reimbursements.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{item.employeeName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-orange-50 text-orange-700">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">₹{item.amount.toLocaleString()}</TableCell>
                            <TableCell className="max-w-[150px] truncate" title={item.description}>{item.description}</TableCell>
                            <TableCell>
                              {item.documentUrl ? (
                                <Button variant="ghost" size="sm" className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => { setSelectedDoc({ url: item.documentUrl!, name: item.documentName! }); setViewerOpen(true); }}>
                                  <Eye className="h-4 w-4" /> View
                                </Button>
                              ) : <span className="text-muted-foreground text-sm">No doc</span>}
                            </TableCell>
                            <TableCell>{new Date(item.submittedDate).toLocaleDateString()}</TableCell>
                            <TableCell><StatusBadge status={item.status} /></TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-2">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus('reimbursements', item.id, 'approved')}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => updateStatus('reimbursements', item.id, 'rejected')}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3 p-4">
                  {reimbursements.map((item) => (
                    <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{item.employeeName}</h4>
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 mt-1">{item.category}</Badge>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="bg-gradient-to-r from-green-50 to-orange-50 border border-green-200 rounded-lg p-3">
                          <div className="text-xs text-green-600 font-medium">Amount</div>
                          <div className="text-xl font-bold text-green-900">₹{item.amount.toLocaleString()}</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground font-medium mb-1">Description</div>
                          <p className="text-sm">{item.description}</p>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Submitted: {new Date(item.submittedDate).toLocaleDateString()}</span>
                          {item.documentUrl && (
                            <Button variant="ghost" size="sm" className="text-blue-600"
                              onClick={() => { setSelectedDoc({ url: item.documentUrl!, name: item.documentName! }); setViewerOpen(true); }}>
                              <Eye className="h-4 w-4 mr-1" /> View Doc
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => updateStatus('reimbursements', item.id, 'approved')}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => updateStatus('reimbursements', item.id, 'rejected')}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <Layout pageTitle="Self Service Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!organizationId) {
    return (
      <Layout pageTitle="Self Service Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No organization selected. Please log in again.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout pageTitle="Self Service Management">
        <div className="space-y-4 p-4 sm:p-6">
          {/* Overall Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <div className="text-xs text-blue-600 font-medium">Total Requests</div>
              </div>
              <div className="text-lg font-bold text-blue-900 mt-1">{totalRequests}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <div className="text-xs text-orange-600 font-medium">Pending</div>
              </div>
              <div className="text-lg font-bold text-orange-900 mt-1">{pendingCount}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="text-xs text-green-600 font-medium">Approved</div>
              </div>
              <div className="text-lg font-bold text-green-900 mt-1">{approvedCount}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div className="text-xs text-purple-600 font-medium">Categories</div>
              </div>
              <div className="text-lg font-bold text-purple-900 mt-1">4</div>
            </div>
          </div>

          <Card className="w-full shadow-sm border-0 sm:border">
            <CardHeader className="pb-4 sm:pb-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Self Service Management
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    Manage employee self-service requests and submissions
                  </CardDescription>
                </div>
                
                {!isMobile && (
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="px-3 py-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      Updated Today
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1 bg-orange-50 text-orange-700 border-orange-200">
                      <Clock className="h-3 w-3 mr-1" />
                      {pendingCount} Pending
                    </Badge>
                  </div>
                )}
              </div>

              {/* Active Section Header */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="p-2 bg-blue-100 rounded-lg">
                  {getTabIcon(activeTab)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">
                    {tabLabels[activeTab as keyof typeof tabLabels].full}
                  </h3>
                  <p className="text-sm text-blue-600">
                    Review and manage {tabLabels[activeTab as keyof typeof tabLabels].full.toLowerCase()}
                  </p>
                </div>
                <Badge variant="outline" className="bg-white">
                  Active
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0 sm:p-2">
              <Tabs 
                value={activeTab} 
                onValueChange={setActiveTab}
                className="w-full"
              >
                {isSmallScreen ? renderTabGrid() : renderHorizontalTabs()}

                <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
                  <TabsContent value="tax" className="mt-0 animate-in fade-in duration-300">
                    {renderTaxDeclarationsTab()}
                  </TabsContent>

                  <TabsContent value="investment" className="mt-0 animate-in fade-in duration-300">
                    {renderInvestmentProofsTab()}
                  </TabsContent>

                  <TabsContent value="loan" className="mt-0 animate-in fade-in duration-300">
                    {renderLoanApplicationsTab()}
                  </TabsContent>

                  <TabsContent value="reimbursement" className="mt-0 animate-in fade-in duration-300">
                    {renderReimbursementsTab()}
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <style>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </Layout>
      
      {selectedDoc && (
        <DocumentViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          documentUrl={selectedDoc.url}
          documentName={selectedDoc.name}
        />
      )}
    </>
  );
}
