import Layout from '@/components/Layout';
import NotificationManager from '@/components/notifications/NotificationManager';

const Notifications = () => {
  return (
    <Layout pageTitle="Notifications">
      <div className="space-y-4 p-4 sm:p-6">
        <NotificationManager />
      </div>
    </Layout>
  );
};

export default Notifications;
