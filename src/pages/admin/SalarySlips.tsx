import Layout from '@/components/Layout';
import SalarySlipManagement from '@/components/dashboard/admin/SalarySlipManagement';

const SalarySlips = () => {
  return (
    <Layout pageTitle="Salary Slip Management">
      <div className="space-y-4 p-4 sm:p-6">
        <SalarySlipManagement />
      </div>
    </Layout>
  );
};

export default SalarySlips;
