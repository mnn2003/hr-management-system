import Layout from '@/components/Layout';
import DeviceAccessControl from '@/components/dashboard/admin/DeviceAccessControl';

const DeviceAccess = () => {
  return (
    <Layout pageTitle="Device Access Control">
      <div className="space-y-4 p-4 sm:p-6">
        <DeviceAccessControl />
      </div>
    </Layout>
  );
};

export default DeviceAccess;
