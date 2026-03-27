import Layout from '@/components/Layout';
import SalaryTab from '@/components/dashboard/employee/SalaryTab';

const Salary = () => {
  return (
    <Layout pageTitle="Salary">
      <div className="space-y-4 p-4 sm:p-6">
        <SalaryTab />
      </div>
    </Layout>
  );
};

export default Salary;
