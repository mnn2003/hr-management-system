import Layout from '@/components/Layout';
import ProfileTab from '@/components/dashboard/employee/ProfileTab';

const Profile = () => {
  return (
    <Layout pageTitle="Profile">
      <div className="space-y-4 p-4 sm:p-6">
        <ProfileTab />
      </div>
    </Layout>
  );
};

export default Profile;
