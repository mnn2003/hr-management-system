import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { Upload, Image as ImageIcon, Bell, BellOff } from 'lucide-react';
import {
  isPushSupported,
  getPushPermissionStatus,
  requestPushPermission,
  savePushPreference,
  getPushPreference,
} from '@/lib/pushNotificationService';


interface Preferences {
  menuPreferences: {
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
  };
  dashboardWidgets: {
    birthdayWidget: boolean;
    recentPunch: boolean;
    weatherWidget: boolean;
    myCalendar: boolean;
    todayAttendance: boolean;
    profileCard: boolean;
    workStats: boolean;
    teamStats: boolean;
    quickActions: boolean;
    statsCards: boolean;
    recentActivity: boolean;
  };
}

const DashboardSettings = () => {
  const { user, userRole, organizationId } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>({
    menuPreferences: {
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
    },
    dashboardWidgets: {
      birthdayWidget: true,
      weatherWidget: true,
      recentPunch: true,
      myCalendar: true,
      todayAttendance: true,
      profileCard: true,
      workStats: true,
      teamStats: true,
      quickActions: true,
      statsCards: true,
      recentActivity: true,
    },
  });
  const [loading, setLoading] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    systemName: 'HR Management System',
    logoUrl: ''
  });
  const [organizationSettings, setOrganizationSettings] = useState({
    name: '',
    logoUrl: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pushNotifEnabled, setPushNotifEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const isSuperAdmin = userRole === 'super-admin';
  const isHrOrHod = userRole === 'hr' || userRole === 'hod';
  const isEmployee = userRole === 'staff' || userRole === 'intern';

  useEffect(() => {
    loadPreferences();
    loadPushPreference();
    if (isSuperAdmin) {
      loadSystemSettings();
    } else if (isHrOrHod && organizationId) {
      loadOrganizationSettings();
    }
  }, [user, userRole, organizationId]);

  const loadPushPreference = async () => {
    if (!user) return;
    const enabled = await getPushPreference(user.uid);
    setPushNotifEnabled(enabled);
  };

  const togglePushNotifications = async () => {
    if (!user) return;
    setPushLoading(true);
    try {
      if (!pushNotifEnabled) {
        // Enabling - request permission first
        if (isPushSupported()) {
          const permission = await requestPushPermission();
          if (permission !== 'granted') {
            toast.error('Please allow notifications in your browser settings');
            setPushLoading(false);
            return;
          }
        }
        await savePushPreference(user.uid, true);
        setPushNotifEnabled(true);
        toast.success('Push notifications enabled!');
      } else {
        await savePushPreference(user.uid, false);
        setPushNotifEnabled(false);
        toast.success('Push notifications disabled');
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      toast.error('Failed to update push notification settings');
    } finally {
      setPushLoading(false);
    }
  };

  const loadPreferences = async () => {
    if (!user) return;
    try {
      const prefsDoc = await getDoc(doc(db, 'user_preferences', user.uid));
      if (prefsDoc.exists()) {
        setPreferences(prev => ({
          ...prev,
          ...prefsDoc.data()
        }));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const loadSystemSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'system_settings', 'general'));
      if (settingsDoc.exists()) {
        setSystemSettings(settingsDoc.data() as any);
      }
    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  };

  const loadOrganizationSettings = async () => {
    if (!organizationId) return;
    try {
      const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
      if (orgDoc.exists()) {
        const data = orgDoc.data();
        setOrganizationSettings({
          name: data.name || '',
          logoUrl: data.logoUrl || ''
        });
      }
    } catch (error) {
      console.error('Error loading organization settings:', error);
    }
  };

  const savePreferences = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'user_preferences', user.uid), {
        ...preferences,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      });
      toast.success('Settings saved successfully!');
      window.location.reload(); // Reload to apply changes
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleMenuPreference = (key: keyof typeof preferences.menuPreferences) => {
    setPreferences(prev => ({
      ...prev,
      menuPreferences: {
        ...prev.menuPreferences,
        [key]: !prev.menuPreferences[key]
      }
    }));
  };

  const toggleWidgetPreference = (key: keyof typeof preferences.dashboardWidgets) => {
    setPreferences(prev => ({
      ...prev,
      dashboardWidgets: {
        ...prev.dashboardWidgets,
        [key]: !prev.dashboardWidgets[key]
      }
    }));
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      toast.error('Please select a logo file');
      return;
    }
    setUploadingLogo(true);
    try {
      const timestamp = Date.now();
      const logoRef = ref(storage, isSuperAdmin 
        ? `system/logo-${timestamp}` 
        : `organization-logos/${organizationId}-${timestamp}`
      );
      await uploadBytes(logoRef, logoFile);
      const logoUrl = await getDownloadURL(logoRef);
      
      if (isSuperAdmin) {
        await setDoc(doc(db, 'system_settings', 'general'), {
          ...systemSettings,
          logoUrl,
          updatedAt: new Date().toISOString()
        });
        setSystemSettings(prev => ({ ...prev, logoUrl }));
      } else if (organizationId) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'organizations', organizationId), {
          logoUrl,
          updatedAt: new Date().toISOString()
        });
        setOrganizationSettings(prev => ({ ...prev, logoUrl }));
      }
      
      setLogoFile(null);
      toast.success('Logo uploaded successfully!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveSystemSettings = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'system_settings', 'general'), {
        ...systemSettings,
        updatedAt: new Date().toISOString()
      });
      toast.success('System settings saved successfully!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error saving system settings:', error);
      toast.error('Failed to save system settings');
    } finally {
      setLoading(false);
    }
  };

  const saveOrganizationSettings = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'organizations', organizationId), {
        name: organizationSettings.name,
        updatedAt: new Date().toISOString()
      });
      toast.success('Organization settings saved successfully!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error saving organization settings:', error);
      toast.error('Failed to save organization settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="w-full shadow-sm border-0 sm:border">
        <CardHeader className="pb-4 sm:pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Dashboard Settings
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Customize your dashboard experience and preferences
              </CardDescription>
            </div>
          </div>

          {/* Active Section Header */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ImageIcon className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Preferences</h3>
              <p className="text-sm text-blue-600">Manage your menu items and dashboard widgets</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 space-y-6">

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Manage system-wide logo and name (Super Admin only)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="system-name">System Name</Label>
              <Input
                id="system-name"
                value={systemSettings.systemName}
                onChange={(e) => setSystemSettings(prev => ({ ...prev, systemName: e.target.value }))}
                placeholder="Enter system name"
              />
            </div>

            <div className="space-y-2">
              <Label>System Logo</Label>
              {systemSettings.logoUrl && (
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                  <img 
                    src={systemSettings.logoUrl} 
                    alt="System Logo" 
                    className="w-16 h-16 object-contain rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Current Logo</p>
                    <p className="text-xs text-muted-foreground">Upload a new logo to replace</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleLogoUpload} 
                  disabled={!logoFile || uploadingLogo}
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>

            <Button onClick={saveSystemSettings} disabled={loading}>
              {loading ? 'Saving...' : 'Save System Settings'}
            </Button>
          </CardContent>
        </Card>
      )}

      {isHrOrHod && !isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Settings</CardTitle>
            <CardDescription>Manage your organization's logo and name</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={organizationSettings.name}
                onChange={(e) => setOrganizationSettings(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter organization name"
              />
            </div>

            <div className="space-y-2">
              <Label>Organization Logo</Label>
              {organizationSettings.logoUrl && (
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                  <img 
                    src={organizationSettings.logoUrl} 
                    alt="Organization Logo" 
                    className="w-16 h-16 object-contain rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Current Logo</p>
                    <p className="text-xs text-muted-foreground">Upload a new logo to replace</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleLogoUpload} 
                  disabled={!logoFile || uploadingLogo}
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>

            <Button onClick={saveOrganizationSettings} disabled={loading}>
              {loading ? 'Saving...' : 'Save Organization Settings'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Push Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive browser notifications for attendance reminders, leave updates, birthdays, and announcements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="push-notifications">Enable Push Notifications</Label>
              <p className="text-xs text-muted-foreground">
                {getPushPermissionStatus() === 'denied' 
                  ? 'Notifications blocked in browser. Please update browser settings.' 
                  : 'Get notified even when the app is in the background'}
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={pushNotifEnabled}
              onCheckedChange={togglePushNotifications}
              disabled={pushLoading || getPushPermissionStatus() === 'denied'}
            />
          </div>
          {pushNotifEnabled && (
            <div className="rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground space-y-1">
              <p>✅ Attendance reminders</p>
              <p>✅ Leave approval/rejection alerts</p>
              <p>✅ Birthday wishes</p>
              <p>✅ Admin announcements</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Menu Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Menu Items</CardTitle>
            <CardDescription>Select which menu items to display in the sidebar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="menu-overview">Overview</Label>
              <Switch
                id="menu-overview"
                checked={preferences.menuPreferences.overview}
                onCheckedChange={() => toggleMenuPreference('overview')}
              />
            </div>

            {isEmployee && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-profile">Profile</Label>
                  <Switch
                    id="menu-profile"
                    checked={preferences.menuPreferences.profile}
                    onCheckedChange={() => toggleMenuPreference('profile')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-report">Report</Label>
                  <Switch
                    id="menu-report"
                    checked={preferences.menuPreferences.report}
                    onCheckedChange={() => toggleMenuPreference('report')}
                  />
                </div>
              </>
            )}

            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="menu-attendance">Attendance</Label>
              <Switch
                id="menu-attendance"
                checked={preferences.menuPreferences.attendance}
                onCheckedChange={() => toggleMenuPreference('attendance')}
              />
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="menu-leave">Leave</Label>
              <Switch
                id="menu-leave"
                checked={preferences.menuPreferences.leave}
                onCheckedChange={() => toggleMenuPreference('leave')}
              />
            </div>

            {isEmployee && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-salary">Salary</Label>
                  <Switch
                    id="menu-salary"
                    checked={preferences.menuPreferences.salary}
                    onCheckedChange={() => toggleMenuPreference('salary')}
                  />
                </div>
              </>
            )}

            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="menu-exit">Exit / Resignation</Label>
              <Switch
                id="menu-exit"
                checked={preferences.menuPreferences.exit}
                onCheckedChange={() => toggleMenuPreference('exit')}
              />
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="menu-helpdesk">Helpdesk</Label>
              <Switch
                id="menu-helpdesk"
                checked={preferences.menuPreferences.helpdesk}
                onCheckedChange={() => toggleMenuPreference('helpdesk')}
              />
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="menu-self-service">Self Service</Label>
              <Switch
                id="menu-self-service"
                checked={preferences.menuPreferences.selfService}
                onCheckedChange={() => toggleMenuPreference('selfService')}
              />
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="menu-attendance-report">Attendance Report</Label>
              <Switch
                id="menu-attendance-report"
                checked={preferences.menuPreferences.attendanceReport}
                onCheckedChange={() => toggleMenuPreference('attendanceReport')}
              />
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="menu-employee-directory">Employee Directory</Label>
              <Switch
                id="menu-employee-directory"
                checked={preferences.menuPreferences.employeeDirectory}
                onCheckedChange={() => toggleMenuPreference('employeeDirectory')}
              />
            </div>

            {userRole === 'hr' && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-employees">Employees</Label>
                  <Switch
                    id="menu-employees"
                    checked={preferences.menuPreferences.employees}
                    onCheckedChange={() => toggleMenuPreference('employees')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-departments">Departments</Label>
                  <Switch
                    id="menu-departments"
                    checked={preferences.menuPreferences.departments}
                    onCheckedChange={() => toggleMenuPreference('departments')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-attendance-mgmt">Attendance Management</Label>
                  <Switch
                    id="menu-attendance-mgmt"
                    checked={preferences.menuPreferences.attendanceManagement}
                    onCheckedChange={() => toggleMenuPreference('attendanceManagement')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-holidays">Holidays</Label>
                  <Switch
                    id="menu-holidays"
                    checked={preferences.menuPreferences.holidays}
                    onCheckedChange={() => toggleMenuPreference('holidays')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-salary-slips">Salary Slips</Label>
                  <Switch
                    id="menu-salary-slips"
                    checked={preferences.menuPreferences.salarySlips}
                    onCheckedChange={() => toggleMenuPreference('salarySlips')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-leave-management">Leave Management</Label>
                  <Switch
                    id="menu-leave-management"
                    checked={preferences.menuPreferences.leaveManagement}
                    onCheckedChange={() => toggleMenuPreference('leaveManagement')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-self-service-mgmt">Self Service Management</Label>
                  <Switch
                    id="menu-self-service-mgmt"
                    checked={preferences.menuPreferences.selfServiceManagement}
                    onCheckedChange={() => toggleMenuPreference('selfServiceManagement')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-hr-analytics">HR Analytics</Label>
                  <Switch
                    id="menu-hr-analytics"
                    checked={preferences.menuPreferences.hrAnalytics}
                    onCheckedChange={() => toggleMenuPreference('hrAnalytics')}
                  />
                </div>
              </>
            )}

            {isHrOrHod && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-exit-management">Exit Management</Label>
                  <Switch
                    id="menu-exit-management"
                    checked={preferences.menuPreferences.exitManagement}
                    onCheckedChange={() => toggleMenuPreference('exitManagement')}
                  />
                </div>
              </>
            )}

            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="menu-chat">Chat</Label>
              <Switch
                id="menu-chat"
                checked={preferences.menuPreferences.chat}
                onCheckedChange={() => toggleMenuPreference('chat')}
              />
            </div>

            {isHrOrHod && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-shift-management">Shift Management</Label>
                  <Switch
                    id="menu-shift-management"
                    checked={preferences.menuPreferences.shiftManagement}
                    onCheckedChange={() => toggleMenuPreference('shiftManagement')}
                  />
                </div>
              </>
            )}

            {userRole === 'hr' && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-device-access">Device Access</Label>
                  <Switch
                    id="menu-device-access"
                    checked={preferences.menuPreferences.deviceAccess}
                    onCheckedChange={() => toggleMenuPreference('deviceAccess')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-notifications">Notifications</Label>
                  <Switch
                    id="menu-notifications"
                    checked={preferences.menuPreferences.notifications}
                    onCheckedChange={() => toggleMenuPreference('notifications')}
                  />
                </div>
              </>
            )}

            {isHrOrHod && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-leave-approvals">Leave Approvals</Label>
                  <Switch
                    id="menu-leave-approvals"
                    checked={preferences.menuPreferences.leaveApprovals}
                    onCheckedChange={() => toggleMenuPreference('leaveApprovals')}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dashboard Widgets */}
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Widgets</CardTitle>
            <CardDescription>Choose which widgets to display on your overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="widget-birthday">Birthday Widget</Label>
              <Switch
                id="widget-birthday"
                checked={preferences.dashboardWidgets.birthdayWidget}
                onCheckedChange={() => toggleWidgetPreference('birthdayWidget')}
              />
            </div>

            {isEmployee && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-recent-punch">Recent Punch Card</Label>
                  <Switch
                    id="widget-recent-punch"
                    checked={preferences.dashboardWidgets.recentPunch}
                    onCheckedChange={() => toggleWidgetPreference('recentPunch')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-my-calendar">My Calendar</Label>
                  <Switch
                    id="widget-my-calendar"
                    checked={preferences.dashboardWidgets.myCalendar}
                    onCheckedChange={() => toggleWidgetPreference('myCalendar')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-weathe-rWidget">Weather</Label>
                  <Switch
                    id="widget-recent-punch"
                    checked={preferences.dashboardWidgets.weatherWidget}
                    onCheckedChange={() => toggleWidgetPreference('weatherWidget')}
                  />
                </div>
                <Separator />
              </>
            )}

            {isEmployee && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-today-attendance">Today's Attendance</Label>
                  <Switch
                    id="widget-today-attendance"
                    checked={preferences.dashboardWidgets.todayAttendance}
                    onCheckedChange={() => toggleWidgetPreference('todayAttendance')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-profile">Profile Card</Label>
                  <Switch
                    id="widget-profile"
                    checked={preferences.dashboardWidgets.profileCard}
                    onCheckedChange={() => toggleWidgetPreference('profileCard')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-work-stats">Work Statistics</Label>
                  <Switch
                    id="widget-work-stats"
                    checked={preferences.dashboardWidgets.workStats}
                    onCheckedChange={() => toggleWidgetPreference('workStats')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-team-stats">Team Statistics</Label>
                  <Switch
                    id="widget-team-stats"
                    checked={preferences.dashboardWidgets.teamStats}
                    onCheckedChange={() => toggleWidgetPreference('teamStats')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-quick-actions">Quick Actions</Label>
                  <Switch
                    id="widget-quick-actions"
                    checked={preferences.dashboardWidgets.quickActions}
                    onCheckedChange={() => toggleWidgetPreference('quickActions')}
                  />
                </div>
              </>
            )}

            {isHrOrHod && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-stats-cards">Statistics Cards</Label>
                  <Switch
                    id="widget-stats-cards"
                    checked={preferences.dashboardWidgets.statsCards}
                    onCheckedChange={() => toggleWidgetPreference('statsCards')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-recent-activity">Recent Activity</Label>
                  <Switch
                    id="widget-recent-activity"
                    checked={preferences.dashboardWidgets.recentActivity}
                    onCheckedChange={() => toggleWidgetPreference('recentActivity')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-quick-actions-admin">Quick Actions</Label>
                  <Switch
                    id="widget-quick-actions-admin"
                    checked={preferences.dashboardWidgets.quickActions}
                    onCheckedChange={() => toggleWidgetPreference('quickActions')}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>


          <div className="flex justify-end pt-4">
            <Button onClick={savePreferences} disabled={loading} size="lg" className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSettings;
