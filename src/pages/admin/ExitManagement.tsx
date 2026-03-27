import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResignationTracking } from '@/components/dashboard/admin/exit/ResignationTracking';
import { ExitInterview } from '@/components/dashboard/admin/exit/ExitInterview';
import { ClearanceProcess } from '@/components/dashboard/admin/exit/ClearanceProcess';
import { FullFinalSettlement } from '@/components/dashboard/admin/exit/FullFinalSettlement';
import { ExperienceCertificate } from '@/components/dashboard/admin/exit/ExperienceCertificate';
import { KnowledgeTransfer } from '@/components/dashboard/admin/exit/KnowledgeTransfer';
import { 
  UserMinus, 
  MessageSquare, 
  CheckCircle, 
  DollarSign, 
  FileText, 
  BookOpen,
  Users,
  Clock,
  Award,
  TrendingUp
} from 'lucide-react';

const ExitManagement = () => {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('resignations');

  useEffect(() => {
    const normalizedRole = userRole?.toLowerCase();
    if (normalizedRole !== 'hr' && normalizedRole !== 'hod') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  const tabs = [
    { value: 'resignations', label: 'Resignations', icon: UserMinus },
    { value: 'interviews', label: 'Exit Interviews', icon: MessageSquare },
    { value: 'clearance', label: 'Clearance', icon: CheckCircle },
    { value: 'settlement', label: 'Settlement', icon: DollarSign },
    { value: 'certificates', label: 'Certificates', icon: FileText },
    { value: 'knowledge', label: 'Knowledge Transfer', icon: BookOpen },
  ];

  const stats = [
    { label: 'Active Exits', value: '12', icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'Pending Clearance', value: '5', icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: 'Completed', value: '24', icon: Award, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: 'This Month', value: '8', icon: TrendingUp, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  ];

  return (
    <Layout pageTitle="Exit Management">
      <div className="space-y-4 p-4 sm:p-6">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 p-6 text-white shadow-lg">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <UserMinus className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Exit Management System</h1>
                <p className="text-white/80 text-sm">
                  Manage employee exits, clearances, settlements, and documentation
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content with Tabs */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b bg-muted/30 px-4 pt-4">
                <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0 flex-wrap">
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 font-medium text-muted-foreground shadow-none transition-all data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none hover:text-foreground"
                    >
                      <tab.icon className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              
              <div className="p-4 sm:p-6">
                <TabsContent value="resignations" className="m-0">
                  <ResignationTracking />
                </TabsContent>
                
                <TabsContent value="interviews" className="m-0">
                  <ExitInterview />
                </TabsContent>
                
                <TabsContent value="clearance" className="m-0">
                  <ClearanceProcess />
                </TabsContent>
                
                <TabsContent value="settlement" className="m-0">
                  <FullFinalSettlement />
                </TabsContent>
                
                <TabsContent value="certificates" className="m-0">
                  <ExperienceCertificate />
                </TabsContent>
                
                <TabsContent value="knowledge" className="m-0">
                  <KnowledgeTransfer />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ExitManagement;
