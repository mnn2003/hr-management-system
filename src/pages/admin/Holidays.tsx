import Layout from '@/components/Layout';
import HolidayManagement from '@/components/dashboard/admin/HolidayManagement';

const Holidays = () => {
  return (
    <Layout pageTitle="Holiday Management">
      <div className="space-y-4 p-4 sm:p-6">
        <HolidayManagement />
      </div>
    </Layout>
  );
};

export default Holidays;
