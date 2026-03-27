import Layout from '@/components/Layout';
import DepartmentManagement from '@/components/dashboard/admin/DepartmentManagement';

const Departments = () => {
  return (
    <Layout pageTitle="Department Management">
      <div className="space-y-4 p-4 sm:p-6">
        <DepartmentManagement />
      </div>
    </Layout>
  );
};

export default Departments;
