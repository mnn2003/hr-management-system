import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  FileText,
  DollarSign,
  Settings,
  Building2,
  UserCog,
  CalendarCheck,
  LogOut,
  MessageSquare,
  FileBarChart,
  BarChart3,
  Building,
  Shield,
  Bell,
  Timer,
  ScanFace,
  UserCheck,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface MenuPreferences {
  overview: boolean;
  profile: boolean;
  attendance: boolean;
  report: boolean;
  attendanceReport: boolean;
  employeeDirectory: boolean;
  leave: boolean;
  salary: boolean;
  employees: boolean;
  departments: boolean;
  leaveApprovals: boolean;
  leaveManagement: boolean;
  attendanceManagement: boolean;
  holidays: boolean;
  salarySlips: boolean;
  exitManagement: boolean;
  exit: boolean;
  helpdesk: boolean;
  selfService: boolean;
  selfServiceManagement: boolean;
  hrAnalytics: boolean;
  deviceAccess: boolean;
  notifications: boolean;
  chat: boolean;
  shiftManagement: boolean;
  faceEnrollment: boolean;
  faceAttendance: boolean;
}

const DEFAULT_MENU_PREFERENCES: MenuPreferences = {
  overview: true,
  profile: true,
  attendance: true,
  report: true,
  attendanceReport: true,
  employeeDirectory: true,
  leave: true,
  salary: true,
  employees: true,
  departments: true,
  leaveApprovals: true,
  leaveManagement: true,
  attendanceManagement: true,
  holidays: true,
  salarySlips: true,
  exitManagement: true,
  exit: true,
  helpdesk: true,
  selfService: true,
  selfServiceManagement: true,
  hrAnalytics: true,
  deviceAccess: true,
  notifications: true,
  chat: true,
  shiftManagement: true,
  faceEnrollment: true,
  faceAttendance: true,
};

export function AppSidebar() {
  const { userRole, user, logout, organizationId, organizationName } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();

  const normalizedRole = userRole ? String(userRole).toLowerCase() : '';

  const [displaySettings, setDisplaySettings] = useState({
    displayName: 'HR System',
    logoUrl: ''
  });

  const [menuPreferences, setMenuPreferences] = useState<MenuPreferences>(DEFAULT_MENU_PREFERENCES);

  useEffect(() => {
    loadMenuPreferences();
    loadDisplaySettings();
  }, [user, organizationId]);

  const loadMenuPreferences = async () => {
    if (!user) return;
    try {
      const prefsRef = doc(db, 'user_preferences', user.uid);
      const prefsDoc = await getDoc(prefsRef);

      if (prefsDoc.exists()) {
        const firestorePrefs = prefsDoc.data().menuPreferences ?? {};
        const merged: MenuPreferences = {
          ...DEFAULT_MENU_PREFERENCES,
          ...firestorePrefs,
        };
        setMenuPreferences(merged);
      } else {
        await setDoc(prefsRef, {
          menuPreferences: DEFAULT_MENU_PREFERENCES,
          createdAt: new Date().toISOString(),
        });
        setMenuPreferences(DEFAULT_MENU_PREFERENCES);
      }
    } catch (error) {
      console.error('Error loading menu preferences:', error);
      setMenuPreferences(DEFAULT_MENU_PREFERENCES);
    }
  };

  const loadDisplaySettings = async () => {
    try {
      // Super admin sees system settings
      if (normalizedRole === 'super-admin') {
        const settingsDoc = await getDoc(doc(db, 'system_settings', 'general'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setDisplaySettings({
            displayName: data.systemName || 'HR System',
            logoUrl: data.logoUrl || ''
          });
        }
      } 
      // HR/HOD/Staff see their organization settings
      else if (organizationId) {
        const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          setDisplaySettings({
            displayName: orgData.name || organizationName || 'HR System',
            logoUrl: orgData.logoUrl || ''
          });
        } else {
          setDisplaySettings({
            displayName: organizationName || 'HR System',
            logoUrl: ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading display settings:', error);
    }
  };

  const handleNavigation = (path: string) => navigate(path);
  const handleLogout = async () => await logout();

  const isHrOrHod = normalizedRole === 'hr' || normalizedRole === 'hod';
  const isEmployee = normalizedRole === 'staff' || normalizedRole === 'intern';
  const isSuperAdmin = normalizedRole === 'super-admin';

  const superAdminMenuItems = [
    { id: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    { id: '/admin/organizations', label: 'Organizations', icon: Building, visible: true },
    { id: '/settings', label: 'System Settings', icon: Settings, visible: true },
  ];

  const employeeMenuItems = [
    { id: '/dashboard', label: 'Overview', icon: LayoutDashboard, visible: menuPreferences.overview },
    { id: '/profile', label: 'Profile', icon: UserCog, visible: menuPreferences.profile },
    { id: '/attendance', label: 'Attendance', icon: Clock, visible: menuPreferences.attendance },
    { id: '/report', label: 'Report', icon: FileText, visible: menuPreferences.report },
    { id: '/attendance-report', label: 'Attendance Report', icon: FileBarChart, visible: menuPreferences.attendanceReport },
    { id: '/employee-directory', label: 'Employee Directory', icon: Users, visible: menuPreferences.employeeDirectory },
    { id: '/leave', label: 'Leave', icon: Calendar, visible: menuPreferences.leave },
    { id: '/salary', label: 'Salary', icon: DollarSign, visible: menuPreferences.salary },
    { id: '/chat', label: 'Chat', icon: MessageSquare, visible: menuPreferences.chat },
    { id: '/exit', label: 'Exit / Resignation', icon: UserCog, visible: menuPreferences.exit },
    { id: '/helpdesk', label: 'Helpdesk', icon: MessageSquare, visible: menuPreferences.helpdesk },
    { id: '/self-service', label: 'Self Service', icon: FileText, visible: menuPreferences.selfService },
  ];

  const adminMenuItems = [
    { id: '/dashboard', label: 'Overview', icon: LayoutDashboard, visible: menuPreferences.overview },
    { id: '/attendance', label: 'My Attendance', icon: Clock, visible: menuPreferences.attendance },
    { id: '/leave', label: 'My Leave', icon: Calendar, visible: menuPreferences.leave },
    { id: '/chat', label: 'Chat', icon: MessageSquare, visible: Boolean(menuPreferences.chat) },
    { id: '/exit', label: 'My Resignation', icon: UserCog, visible: menuPreferences.exit },
    { id: '/employees', label: 'Employees', icon: Users, visible: Boolean(menuPreferences.employees) && normalizedRole === 'hr' },
    { id: '/departments', label: 'Departments', icon: Building2, visible: Boolean(menuPreferences.departments) && normalizedRole === 'hr' },
    { id: '/leave-approvals', label: 'Leave Approvals', icon: CalendarCheck, visible: Boolean(menuPreferences.leaveApprovals) },
    { id: '/leave-management', label: 'Leave Management', icon: Calendar, visible: Boolean(menuPreferences.leaveManagement) && normalizedRole === 'hr' },
    { id: '/attendance-management', label: 'Attendance Mgmt', icon: Clock, visible: Boolean(menuPreferences.attendanceManagement) && (normalizedRole === 'hr' || normalizedRole === 'hod') },
    { id: '/attendance-report', label: 'Attendance Report', icon: FileBarChart, visible: Boolean(menuPreferences.attendanceReport) && (normalizedRole === 'hr' || normalizedRole === 'hod') },
    { id: '/shift-management', label: 'Shift Management', icon: Timer, visible: Boolean(menuPreferences.shiftManagement) && (normalizedRole === 'hr' || normalizedRole === 'hod') },
    { id: '/employee-directory', label: 'Employee Directory', icon: Users, visible: Boolean(menuPreferences.employeeDirectory) },
    { id: '/holidays', label: 'Holidays', icon: Calendar, visible: Boolean(menuPreferences.holidays) && normalizedRole === 'hr' },
    { id: '/salary-slips', label: 'Salary Slips', icon: DollarSign, visible: Boolean(menuPreferences.salarySlips) && normalizedRole === 'hr' },
    { id: '/exit-management', label: 'Exit Management', icon: UserCog, visible: Boolean(menuPreferences.exitManagement) && (normalizedRole === 'hr' || normalizedRole === 'hod') },
    { id: '/notifications', label: 'Notifications', icon: Bell, visible: Boolean(menuPreferences.notifications) && normalizedRole === 'hr' },
    { id: '/helpdesk', label: 'Helpdesk', icon: MessageSquare, visible: Boolean(menuPreferences.helpdesk) },
    { id: '/self-service', label: 'Self Service', icon: FileText, visible: Boolean(menuPreferences.selfService) },
    { id: '/self-service-management', label: 'Self Service Mgmt', icon: Settings, visible: Boolean(menuPreferences.selfServiceManagement) && normalizedRole === 'hr' },
    { id: '/hr-analytics', label: 'HR Analytics', icon: BarChart3, visible: Boolean(menuPreferences.hrAnalytics) && normalizedRole === 'hr' },
    { id: '/device-access', label: 'Device Access', icon: Shield, visible: Boolean(menuPreferences.deviceAccess) && normalizedRole === 'hr' },
    { id: '/face-enrollment', label: 'Face Enrollment', icon: ScanFace, visible: Boolean(menuPreferences.faceEnrollment) && normalizedRole === 'hr' },
    { id: '/face-enrollment-management', label: 'Face Data Mgmt', icon: UserCheck, visible: Boolean(menuPreferences.faceEnrollment) && normalizedRole === 'hr' },
    { id: '/face-attendance', label: 'Face Attendance', icon: ScanFace, visible: Boolean(menuPreferences.faceAttendance) && (normalizedRole === 'hr' || normalizedRole === 'hod') },
  ];

  const menuItems = isSuperAdmin ? superAdminMenuItems : (isEmployee ? employeeMenuItems : adminMenuItems);
  const visibleMenuItems = menuItems.filter(item => item.visible);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {displaySettings.logoUrl ? (
                <img src={displaySettings.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {displaySettings.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              {state !== 'collapsed' && (
                <div>
                  <h2 className="font-semibold text-sm">{displaySettings.displayName}</h2>
                  <p className="text-xs text-muted-foreground capitalize">{userRole || 'User'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {isSuperAdmin ? (
          <SidebarGroup>
            {state !== 'collapsed' && <SidebarGroupLabel>Super Admin</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMenuItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => handleNavigation(item.id)}
                      isActive={location.pathname === item.id}
                      tooltip={state === 'collapsed' ? item.label : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      {state !== 'collapsed' && <span>{item.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup>
              {state !== 'collapsed' && <SidebarGroupLabel>Personal</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleMenuItems.filter(item =>
                    ['/dashboard', '/profile', '/attendance', '/report', '/attendance-report', '/employee-directory', '/leave', '/salary', '/chat', '/exit', '/helpdesk', '/self-service'].includes(item.id)
                  ).map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => handleNavigation(item.id)}
                        isActive={location.pathname === item.id}
                        tooltip={state === 'collapsed' ? item.label : undefined}
                      >
                        <item.icon className="h-4 w-4" />
                        {state !== 'collapsed' && <span>{item.label}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isHrOrHod && (
              <>
                <Separator />
                <SidebarGroup>
                  {state !== 'collapsed' && <SidebarGroupLabel>Admin Tools</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleMenuItems.filter(item =>
                        !['/dashboard', '/profile', '/attendance', '/report', '/attendance-report', '/employee-directory', '/leave', '/salary', '/chat', '/exit', '/helpdesk', '/self-service'].includes(item.id)
                      ).map((item) => (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            onClick={() => handleNavigation(item.id)}
                            isActive={location.pathname === item.id}
                            tooltip={state === 'collapsed' ? item.label : undefined}
                          >
                            <item.icon className="h-4 w-4" />
                            {state !== 'collapsed' && <span>{item.label}</span>}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            )}

            <Separator />

            <SidebarGroup>
              {state !== 'collapsed' && <SidebarGroupLabel>Account</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation('/settings')}
                      isActive={location.pathname === '/settings'}
                      tooltip={state === 'collapsed' ? 'Settings' : undefined}
                    >
                      <Settings className="h-4 w-4" />
                      {state !== 'collapsed' && <span>Settings</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          onClick={handleLogout}
          variant="outline"
          size={state === 'collapsed' ? 'icon' : 'default'}
          className="w-full"
        >
          <LogOut className="h-4 w-4" />
          {state !== 'collapsed' && <span className="ml-2">Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
