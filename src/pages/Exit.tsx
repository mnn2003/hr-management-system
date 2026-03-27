import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ResignationSubmission } from '@/components/dashboard/employee/exit/ResignationSubmission';
import { MyResignation } from '@/components/dashboard/employee/exit/MyResignation';
import { MyClearance } from '@/components/dashboard/employee/exit/MyClearance';
import { MySettlement } from '@/components/dashboard/employee/exit/MySettlement';
import { FileText, ClipboardCheck, DollarSign, Send, ChevronLeft, ChevronRight, Calendar, User, Briefcase } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const Exit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('submit');
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const tabsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    checkScrollButtons();
    window.addEventListener('resize', checkScrollButtons);
    return () => window.removeEventListener('resize', checkScrollButtons);
  }, []);

  const checkScrollButtons = () => {
    if (tabsListRef.current) {
      const { scrollWidth, clientWidth } = tabsListRef.current;
      setShowScrollButtons(scrollWidth > clientWidth);
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
      case 'submit':
        return <Send className="h-4 w-4" />;
      case 'status':
        return <FileText className="h-4 w-4" />;
      case 'clearance':
        return <ClipboardCheck className="h-4 w-4" />;
      case 'settlement':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const tabLabels = {
    submit: { full: 'Submit Resignation', short: 'Submit' },
    status: { full: 'My Resignation', short: 'Status' },
    clearance: { full: 'Clearance Status', short: 'Clearance' },
    settlement: { full: 'Settlement', short: 'Settlement' }
  };

  const mobileTabLabels = {
    submit: 'Submit',
    status: 'Status',
    clearance: 'Clear',
    settlement: 'Settle'
  };

  return (
    <Layout pageTitle="Exit / Resignation">
      <div className="space-y-4 p-4 sm:p-6">
        {/* Quick Stats Bar - Mobile Only */}
        {isMobile && (
          <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg">
            <div className="text-center">
              <div className="font-bold text-lg text-orange-900">0</div>
              <div className="text-xs text-orange-600 font-medium">Pending</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-blue-900">0</div>
              <div className="text-xs text-blue-600 font-medium">Clearance</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-green-900">0</div>
              <div className="text-xs text-green-600 font-medium">Settled</div>
            </div>
          </div>
        )}

        <Card className="w-full shadow-sm border-0 sm:border">
          <CardHeader className="pb-4 sm:pb-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  Resignation Management
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Submit resignation requests and track your exit process
                </CardDescription>
              </div>
              
              {/* Desktop Quick Actions */}
              {!isMobile && (
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="px-3 py-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    Exit Process
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1">
                    <User className="h-3 w-3 mr-1" />
                    Employee
                  </Badge>
                </div>
              )}
            </div>

            {/* Active Section Header */}
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="p-2 bg-orange-100 rounded-lg">
                {getTabIcon(activeTab)}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900">
                  {tabLabels[activeTab as keyof typeof tabLabels].full}
                </h3>
                <p className="text-sm text-orange-600">
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
              {/* Tab Navigation */}
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
                          data-[state=active]:text-orange-600 data-[state=active]:font-semibold
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
                            w-1 h-1 bg-orange-600 rounded-full transition-all duration-200
                            ${activeTab === value ? 'opacity-100' : 'opacity-0'}
                            ${isMobile ? 'w-6' : 'w-8'}
                          `}
                        />
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>

              {/* Tab Content Area */}
              <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 min-h-[400px]">
                <TabsContent value="submit" className="mt-0 animate-in fade-in duration-300">
                  <ResignationSubmission />
                </TabsContent>
                
                <TabsContent value="status" className="mt-0 animate-in fade-in duration-300">
                  <MyResignation />
                </TabsContent>
                
                <TabsContent value="clearance" className="mt-0 animate-in fade-in duration-300">
                  <MyClearance />
                </TabsContent>
                
                <TabsContent value="settlement" className="mt-0 animate-in fade-in duration-300">
                  <MySettlement />
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
              <button 
                onClick={() => setActiveTab('submit')}
                className="flex items-center justify-center gap-2 p-3 border rounded-lg text-xs font-medium hover:bg-orange-50 hover:text-orange-600 transition-colors"
              >
                <Send className="h-3 w-3" />
                New Request
              </button>
              <button 
                onClick={() => setActiveTab('status')}
                className="flex items-center justify-center gap-2 p-3 border rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <FileText className="h-3 w-3" />
                View Status
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
};

export default Exit;
