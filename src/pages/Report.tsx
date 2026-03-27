import Layout from '@/components/Layout';
import AttendanceReport from '@/components/dashboard/employee/AttendanceReport';

const Report = () => {
  return (
    <Layout pageTitle="Report">
      <div className="space-y-4 p-4 sm:p-6">
        <AttendanceReport />
      </div>
    </Layout>
  );
};

export default Report;
