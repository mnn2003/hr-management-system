import Layout from '@/components/Layout';
import EmployeeDirectoryContent from '@/components/employee/EmployeeDirectoryContent';

const EmployeeDirectory = () => {
  return (
    <Layout pageTitle="Employee Directory">
      <div className="space-y-4 p-4 sm:p-6">
        <EmployeeDirectoryContent />
      </div>
    </Layout>
  );
};

export default EmployeeDirectory;
