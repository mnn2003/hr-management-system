import Layout from '@/components/Layout';
import AttendanceTab from '@/components/dashboard/employee/AttendanceTab';
import AttendanceRequests from '@/components/dashboard/employee/AttendanceRequests';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, FileText } from 'lucide-react';

const Attendance = () => {
  return (
    <Layout pageTitle="Attendance">
      <div className="space-y-4 p-4 sm:p-6">
        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              My Requests
            </TabsTrigger>
          </TabsList>
          <TabsContent value="attendance">
            <AttendanceTab />
          </TabsContent>
          <TabsContent value="requests">
            <AttendanceRequests />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Attendance;
