import { useAuth } from '@/contexts/AuthContext';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import HodDashboard from '@/components/dashboard/HodDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import Layout from '@/components/Layout';

const Dashboard = () => {
  const { userRole, user } = useAuth();

  return (
    <Layout pageTitle="Dashboard">
      <div className="space-y-4 p-4 sm:p-6">
              {!userRole ? (
                <Card className="max-w-md mx-auto mt-8">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                      <AlertCircle className="h-12 w-12 text-destructive" />
                      <div>
                        <h3 className="font-semibold text-lg">Role Not Assigned</h3>
                        <p className="text-sm text-muted-foreground mt-2">Your account doesn't have a role assigned.</p>
                        <p className="text-xs text-muted-foreground mt-2">User ID: {user?.uid}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : userRole === 'super-admin' ? (
                <SuperAdminDashboard />
              ) : userRole === 'hod' ? (
                <HodDashboard />
              ) : userRole === 'hr' ? (
                <AdminDashboard />
              ) : (
                <EmployeeDashboard />
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
