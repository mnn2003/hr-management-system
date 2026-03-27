import Layout from '@/components/Layout';
import DashboardSettings from '@/components/dashboard/DashboardSettings';

const Settings = () => {
  return (
    <Layout pageTitle="Settings">
      <div className="space-y-4 p-4 sm:p-6">
        <DashboardSettings />
      </div>
    </Layout>
  );
};

export default Settings;
