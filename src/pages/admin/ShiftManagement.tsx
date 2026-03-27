import Layout from '@/components/Layout';
import ShiftManagementComponent from '@/components/dashboard/admin/ShiftManagement';

const ShiftManagement = () => {
  return (
    <Layout pageTitle="Shift Management">
      <div className="space-y-4 p-4 sm:p-6">
        <ShiftManagementComponent />
      </div>
    </Layout>
  );
};

export default ShiftManagement;
