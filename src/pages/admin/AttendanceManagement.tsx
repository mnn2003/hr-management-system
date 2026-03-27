import Layout from '@/components/Layout';
import AttendanceManagementComponent from '@/components/dashboard/admin/AttendanceManagement';

const AttendanceManagement = () => {
  return (
    <Layout pageTitle="Attendance Management">
      <div className="space-y-4 p-4 sm:p-6">
        <AttendanceManagementComponent />
      </div>
    </Layout>
  );
};

export default AttendanceManagement;
