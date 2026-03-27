import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Download, FileText, Shield, DollarSign, Receipt, Home, Briefcase, Calendar, User } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import Layout from '@/components/Layout';
import PayslipDownloads from '@/components/self-service/PayslipDownloads';
import TaxDeclaration from '@/components/self-service/TaxDeclaration';
import InvestmentProofs from '@/components/self-service/InvestmentProofs';
import LoanApplications from '@/components/self-service/LoanApplications';
import ITRAssistance from '@/components/self-service/ITRAssistance';
import Reimbursements from '@/components/self-service/Reimbursements';
import PolicyDocuments from '@/components/self-service/PolicyDocuments';

export default function SelfService() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('payslips');
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const tabsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkScreenSize();
    checkScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    checkScrollButtons();
  }, [activeTab, isSmallScreen]);

  const handleResize = () => {
    checkScreenSize();
    checkScrollButtons();
  };

  const checkScreenSize = () => {
    // Check if screen width is between 768px and 1024px (small laptop screens)
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

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'payslips':
        return <Download className="h-4 w-4" />;
      case 'tax':
        return <Receipt className="h-4 w-4" />;
      case 'investment':
        return <DollarSign className="h-4 w-4" />;
      case 'loans':
        return <Briefcase className="h-4 w-4" />;
      case 'itr':
        return <FileText className="h-4 w-4" />;
      case 'reimbursements':
        return <Home className="h-4 w-4" />;
      case 'policies':
        return <Shield className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const tabLabels = {
    payslips: { full: 'Payslips', short: 'Payslips' },
    tax: { full: 'Tax Declaration', short: 'Tax' },
    investment: { full: 'Investment Proofs', short: 'Investments' },
    loans: { full: 'Loan Applications', short: 'Loans' },
    itr: { full: 'ITR Assistance', short: 'ITR' },
    reimbursements: { full: 'Reimbursements', short: 'Claims' },
    policies: { full: 'Policy Documents', short: 'Policies' }
  };

  const mobileTabLabels = {
    payslips: 'Payslip',
    tax: 'Tax',
    investment: 'Invest',
    loans: 'Loan',
    itr: 'ITR',
    reimbursements: 'Claim',
    policies: 'Docs'
  };

  // Quick stats data
  const quickStats = {
    totalDocuments: 15,
    pendingActions: 3,
    recentUploads: 5
  };

  // For small screens, we'll use a grid layout instead of horizontal scroll
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
            
            {/* Active indicator */}
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
                
                {/* Active indicator */}
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

  return (
    <Layout pageTitle="Self-Service Portal">
      <div className="space-y-4 p-4 sm:p-6">
        {/* Quick Stats Bar - Mobile Only */}
        {isMobile && (
          <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="text-center">
              <div className="font-bold text-lg text-blue-900">{quickStats.totalDocuments}</div>
              <div className="text-xs text-blue-600 font-medium">Documents</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-orange-900">{quickStats.pendingActions}</div>
              <div className="text-xs text-orange-600 font-medium">Pending</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-green-900">{quickStats.recentUploads}</div>
              <div className="text-xs text-green-600 font-medium">Recent</div>
            </div>
          </div>
        )}

        <Card className="w-full shadow-sm border-0 sm:border">
          <CardHeader className="pb-4 sm:pb-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Self-Service Portal
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Manage your HR documents and requests in one place
                </CardDescription>
              </div>
              
              {/* Desktop Quick Actions */}
              {!isMobile && (
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="px-3 py-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    Last Login: Today
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1">
                    <User className="h-3 w-3 mr-1" />
                    {quickStats.pendingActions} Pending
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
                  Manage your {tabLabels[activeTab as keyof typeof tabLabels].full.toLowerCase()}
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
              {/* Conditional Tab Navigation */}
              {isSmallScreen ? renderTabGrid() : renderHorizontalTabs()}

              {/* Tab Content Area */}
              <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 min-h-[500px]">
                <TabsContent value="payslips" className="mt-0 animate-in fade-in duration-300">
                  <PayslipDownloads />
                </TabsContent>

                <TabsContent value="tax" className="mt-0 animate-in fade-in duration-300">
                  <TaxDeclaration />
                </TabsContent>

                <TabsContent value="investment" className="mt-0 animate-in fade-in duration-300">
                  <InvestmentProofs />
                </TabsContent>

                <TabsContent value="loans" className="mt-0 animate-in fade-in duration-300">
                  <LoanApplications />
                </TabsContent>

                <TabsContent value="itr" className="mt-0 animate-in fade-in duration-300">
                  <ITRAssistance />
                </TabsContent>

                <TabsContent value="reimbursements" className="mt-0 animate-in fade-in duration-300">
                  <Reimbursements />
                </TabsContent>

                <TabsContent value="policies" className="mt-0 animate-in fade-in duration-300">
                  <PolicyDocuments />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Mobile Quick Actions */}
        {isMobile && (
          <div className="bg-card border rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-2 p-3 border rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <Download className="h-3 w-3" />
                Download All
              </button>
              <button className="flex items-center justify-center gap-2 p-3 border rounded-lg text-xs font-medium hover:bg-green-50 hover:text-green-600 transition-colors">
                <FileText className="h-3 w-3" />
                View History
              </button>
            </div>
          </div>
        )}
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
  );
}
