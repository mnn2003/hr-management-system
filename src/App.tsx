import { Toaster } from "@/components/ui/toaster";
import Pricing from "./pages/Pricing";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster as HotToaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AdminSetup from "./pages/AdminSetup";
import SuperAdminSetup from "./pages/SuperAdminSetup";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Salary from "./pages/Salary";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import Employees from "./pages/admin/Employees";
import EmployeeDetails from "./pages/admin/EmployeeDetails";
import Departments from "./pages/admin/Departments";
import LeaveApprovals from "./pages/admin/LeaveApprovals";
import LeaveManagement from "./pages/admin/LeaveManagement";
import AttendanceManagement from "./pages/admin/AttendanceManagement";
import AttendanceReportAdmin from "./pages/admin/AttendanceReport";
import EmployeeDirectory from "./pages/EmployeeDirectory";
import Holidays from "./pages/admin/Holidays";
import SalarySlips from "./pages/admin/SalarySlips";
import ExitManagement from "./pages/admin/ExitManagement";
import Exit from "./pages/Exit";
import Helpdesk from "./pages/Helpdesk";
import SelfService from "./pages/SelfService";
import SelfServiceManagement from "./pages/admin/SelfServiceManagement";
import HRAnalytics from "./pages/admin/HRAnalytics";
import OrganizationManagement from "./pages/admin/OrganizationManagement";
import DeviceAccess from "./pages/admin/DeviceAccess";
import Notifications from "./pages/admin/Notifications";
import Chat from "./pages/Chat";
import ShiftManagement from "./pages/admin/ShiftManagement";
import FaceEnrollment from "./pages/admin/FaceEnrollment";
import FaceAttendance from "./pages/admin/FaceAttendance";
import InstallApp from "./components/InstallApp";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HotToaster position="top-right" />

        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin-setup" element={<AdminSetup />} />
            <Route path="/super-admin-setup" element={<SuperAdminSetup />} />
            <Route path="/pricing" element={<Pricing />} />

            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
            <Route path="/salary" element={<ProtectedRoute><Salary /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetails /></ProtectedRoute>} />
            <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
            <Route path="/leave-approvals" element={<ProtectedRoute><LeaveApprovals /></ProtectedRoute>} />
            <Route path="/leave-management" element={<ProtectedRoute><LeaveManagement /></ProtectedRoute>} />
            <Route path="/attendance-management" element={<ProtectedRoute><AttendanceManagement /></ProtectedRoute>} />
            <Route path="/attendance-report" element={<ProtectedRoute><AttendanceReportAdmin /></ProtectedRoute>} />
            <Route path="/employee-directory" element={<ProtectedRoute><EmployeeDirectory /></ProtectedRoute>} />
            <Route path="/holidays" element={<ProtectedRoute><Holidays /></ProtectedRoute>} />
            <Route path="/salary-slips" element={<ProtectedRoute><SalarySlips /></ProtectedRoute>} />
            <Route path="/exit-management" element={<ProtectedRoute><ExitManagement /></ProtectedRoute>} />
            <Route path="/exit" element={<ProtectedRoute><Exit /></ProtectedRoute>} />
            <Route path="/helpdesk" element={<ProtectedRoute><Helpdesk /></ProtectedRoute>} />
            <Route path="/self-service" element={<ProtectedRoute><SelfService /></ProtectedRoute>} />
            <Route path="/self-service-management" element={<ProtectedRoute><SelfServiceManagement /></ProtectedRoute>} />
            <Route path="/hr-analytics" element={<ProtectedRoute><HRAnalytics /></ProtectedRoute>} />
            <Route path="/admin/organizations" element={<ProtectedRoute><OrganizationManagement /></ProtectedRoute>} />
            <Route path="/device-access" element={<ProtectedRoute><DeviceAccess /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/shift-management" element={<ProtectedRoute><ShiftManagement /></ProtectedRoute>} />
            <Route path="/face-enrollment" element={<ProtectedRoute><FaceEnrollment /></ProtectedRoute>} />
            <Route path="/face-attendance" element={<ProtectedRoute><FaceAttendance /></ProtectedRoute>} />

            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
        <InstallApp />

      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
