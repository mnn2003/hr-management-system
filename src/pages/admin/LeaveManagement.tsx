import Layout from '@/components/Layout';
import LeaveManagementComponent from '@/components/dashboard/admin/LeaveManagement';

const LeaveManagement = () => {
  return (
    <Layout pageTitle="Leave Management">
      <div className="space-y-4 p-4 sm:p-6">
        <LeaveManagementComponent />
      </div>
    </Layout>
  );
};

export default LeaveManagement;
