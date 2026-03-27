import Layout from '@/components/Layout';
import EmployeeManagement from '@/components/dashboard/admin/EmployeeManagement';

const Employees = () => {
  return (
    <Layout pageTitle="Employee Management">
      <div className="space-y-4 p-4 sm:p-6">
        <EmployeeManagement />
      </div>
    </Layout>
  );
};

export default Employees;
