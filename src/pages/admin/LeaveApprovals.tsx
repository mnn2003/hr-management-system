import Layout from '@/components/Layout';
import LeaveApprovalsComponent from '@/components/dashboard/admin/LeaveApprovals';

const LeaveApprovals = () => {
  return (
    <Layout pageTitle="Leave Approvals">
      <div className="space-y-4 p-4 sm:p-6">
        <LeaveApprovalsComponent />
      </div>
    </Layout>
  );
};

export default LeaveApprovals;
