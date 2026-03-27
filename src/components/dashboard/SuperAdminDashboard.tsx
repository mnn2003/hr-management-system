import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Building2, Users, TrendingUp, CheckCircle, XCircle, Calendar, User, Briefcase, Settings, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface OrganizationStats {
  totalOrganizations: number;
  activeOrganizations: number;
  inactiveOrganizations: number;
  totalEmployees: number;
  activeSubscriptions: number;
}

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<OrganizationStats>({
    totalOrganizations: 0,
    activeOrganizations: 0,
    inactiveOrganizations: 0,
    totalEmployees: 0,
    activeSubscriptions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch organizations
      const orgsSnapshot = await getDocs(collection(db, 'organizations'));
      const organizations = orgsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const activeOrgs = organizations.filter((org: any) => org.isActive);
      const inactiveOrgs = organizations.filter((org: any) => !org.isActive);
      const activeSubs = organizations.filter((org: any) => org.subscriptionStatus === 'active');
      
      // Fetch total employees across all organizations
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      const totalEmployees = employeesSnapshot.size;

      setStats({
        totalOrganizations: organizations.length,
        activeOrganizations: activeOrgs.length,
        inactiveOrganizations: inactiveOrgs.length,
        totalEmployees,
        activeSubscriptions: activeSubs.length,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Quick Stats Bar - Mobile Only */}
      {isMobile && (
        <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="text-center">
            <div className="font-bold text-lg text-blue-900">{loading ? '...' : stats.totalOrganizations}</div>
            <div className="text-xs text-blue-600 font-medium">Organizations</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-green-900">{loading ? '...' : stats.activeOrganizations}</div>
            <div className="text-xs text-green-600 font-medium">Active</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-purple-900">{loading ? '...' : stats.totalEmployees}</div>
            <div className="text-xs text-purple-600 font-medium">Employees</div>
          </div>
        </div>
      )}

      <Card className="w-full shadow-sm border-0 sm:border">
        <CardHeader className="pb-4 sm:pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Super Admin Dashboard
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Overview of all organizations and system statistics
              </CardDescription>
            </div>
            
            {/* Desktop Quick Actions */}
            {!isMobile && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Badge>
                <Badge variant="outline" className="px-3 py-1">
                  <User className="h-3 w-3 mr-1" />
                  Super Admin
                </Badge>
              </div>
            )}
          </div>

          {/* Active Section Header */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">System Overview</h3>
              <p className="text-sm text-blue-600">Manage all organizations and monitor system health</p>
            </div>
            <Badge variant="outline" className="bg-white">
              Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 space-y-4 md:space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card 
              className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/admin/organizations')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-900">Total Organizations</CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900">{loading ? '...' : stats.totalOrganizations}</div>
                <p className="text-xs text-blue-600 mt-1">Click to manage</p>
              </CardContent>
            </Card>

            <Card 
              className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/admin/organizations')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-900">Active Organizations</CardTitle>
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-900">{loading ? '...' : stats.activeOrganizations}</div>
                <p className="text-xs text-green-600 mt-1">Currently active</p>
              </CardContent>
            </Card>

            <Card 
              className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/admin/organizations')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-900">Inactive Organizations</CardTitle>
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-900">{loading ? '...' : stats.inactiveOrganizations}</div>
                <p className="text-xs text-red-600 mt-1">Needs attention</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-900">Total Employees</CardTitle>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-900">{loading ? '...' : stats.totalEmployees}</div>
                <p className="text-xs text-purple-600 mt-1">Across all organizations</p>
              </CardContent>
            </Card>

            <Card 
              className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/admin/organizations')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900">Active Subscriptions</CardTitle>
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-900">{loading ? '...' : stats.activeSubscriptions}</div>
                <p className="text-xs text-emerald-600 mt-1">Paid subscriptions</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions and System Health */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <button
                  onClick={() => navigate('/admin/organizations')}
                  className="w-full text-left p-3 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">Manage Organizations</p>
                      <p className="text-xs text-blue-600">Create and manage organizations</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full text-left p-3 rounded-lg hover:bg-purple-50 transition-colors border border-purple-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Settings className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-purple-900">System Settings</p>
                      <p className="text-xs text-purple-600">Configure system preferences</p>
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>

            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-sm font-medium text-green-900">Database</span>
                    <Badge className="bg-green-100 text-green-700 border-green-300">Operational</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-sm font-medium text-green-900">Authentication</span>
                    <Badge className="bg-green-100 text-green-700 border-green-300">Operational</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-sm font-medium text-green-900">Storage</span>
                    <Badge className="bg-green-100 text-green-700 border-green-300">Operational</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
              onClick={() => navigate('/admin/organizations')}
              className="flex items-center justify-center gap-2 p-3 border rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Building2 className="h-3 w-3" />
              Organizations
            </button>
            <button 
              onClick={() => navigate('/settings')}
              className="flex items-center justify-center gap-2 p-3 border rounded-lg text-xs font-medium hover:bg-purple-50 hover:text-purple-600 transition-colors"
            >
              <Settings className="h-3 w-3" />
              Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
