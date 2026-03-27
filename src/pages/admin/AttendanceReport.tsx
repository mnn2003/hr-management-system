import Layout from '@/components/Layout';
import AttendanceReportHR from '@/components/dashboard/admin/AttendanceReport';

const AttendanceReport = () => {
  return (
    <Layout pageTitle="Attendance Report">
      <div className="space-y-4 p-3 sm:p-6">
        <AttendanceReportHR />
      </div>
    </Layout>
  );
};

export default AttendanceReport;
