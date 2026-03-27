import Layout from '@/components/Layout';
import LeaveTab from '@/components/dashboard/employee/LeaveTab';

const Leave = () => {
  return (
    <Layout pageTitle="Leave">
      <div className="space-y-4 p-4 sm:p-6">
        <LeaveTab />
      </div>
    </Layout>
  );
};

export default Leave;
