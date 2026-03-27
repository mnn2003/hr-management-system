import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  MapPin, 
  Clock, 
  Shield, 
  LogOut,
  AlertTriangle,
  Ban,
  CheckCircle,
  Users,
  Settings,
  Loader2,
  Search,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getOrganizationSessions,
  getUserSessions,
  terminateSession,
  blockDevice,
  unblockDevice,
  getDeviceLimit,
  setDeviceLimit,
  DeviceSession 
} from '@/lib/deviceSessionService';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, formatDistanceToNow } from 'date-fns';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
}

const DeviceAccessControl = () => {
  const { organizationId } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [allActiveSessions, setAllActiveSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Device limit settings
  const [orgDeviceLimit, setOrgDeviceLimit] = useState<number>(1);
  const [userDeviceLimit, setUserDeviceLimit] = useState<number>(1);
  const [savingLimit, setSavingLimit] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitDialogType, setLimitDialogType] = useState<'org' | 'user'>('org');

  // Load employees
  useEffect(() => {
    const loadEmployees = async () => {
      if (!organizationId) return;
      try {
        const employeesQuery = query(
          collection(db, 'employees'),
          where('organizationId', '==', organizationId)
        );
        const snapshot = await getDocs(employeesQuery);
        const employeeList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Employee[];
        setEmployees(employeeList);
      } catch (error) {
        console.error('Error loading employees:', error);
      }
    };
    loadEmployees();
  }, [organizationId]);

  // Load all active sessions for organization
  useEffect(() => {
    const loadAllSessions = async () => {
      if (!organizationId) return;
      setLoadingAll(true);
      try {
        const orgSessions = await getOrganizationSessions(organizationId);
        setAllActiveSessions(orgSessions);
        
        // Load org device limit
        const limit = await getDeviceLimit('', organizationId);
        setOrgDeviceLimit(limit);
      } catch (error) {
        console.error('Error loading sessions:', error);
      } finally {
        setLoadingAll(false);
      }
    };
    loadAllSessions();
  }, [organizationId]);

  // Load sessions for selected employee
  useEffect(() => {
    const loadEmployeeSessions = async () => {
      if (!selectedEmployeeId) {
        setSessions([]);
        return;
      }
      setLoading(true);
      try {
        const userSessions = await getUserSessions(selectedEmployeeId);
        setSessions(userSessions);
        
        // Load user-specific device limit
        const limit = await getDeviceLimit(selectedEmployeeId, organizationId || undefined);
        setUserDeviceLimit(limit);
      } catch (error) {
        console.error('Error loading employee sessions:', error);
      } finally {
        setLoading(false);
      }
    };
    loadEmployeeSessions();
  }, [selectedEmployeeId, organizationId]);

  const handleTerminateSession = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      await terminateSession(sessionId, 'admin_terminated');
      toast.success('Session terminated successfully');
      // Refresh sessions
      if (selectedEmployeeId) {
        const userSessions = await getUserSessions(selectedEmployeeId);
        setSessions(userSessions);
      }
      if (organizationId) {
        const orgSessions = await getOrganizationSessions(organizationId);
        setAllActiveSessions(orgSessions);
      }
    } catch (error) {
      console.error('Error terminating session:', error);
      toast.error('Failed to terminate session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockDevice = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      await blockDevice(sessionId);
      toast.success('Device blocked successfully');
      // Refresh sessions
      if (selectedEmployeeId) {
        const userSessions = await getUserSessions(selectedEmployeeId);
        setSessions(userSessions);
      }
      if (organizationId) {
        const orgSessions = await getOrganizationSessions(organizationId);
        setAllActiveSessions(orgSessions);
      }
    } catch (error) {
      console.error('Error blocking device:', error);
      toast.error('Failed to block device');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblockDevice = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      await unblockDevice(sessionId);
      toast.success('Device unblocked successfully');
      // Refresh sessions
      if (selectedEmployeeId) {
        const userSessions = await getUserSessions(selectedEmployeeId);
        setSessions(userSessions);
      }
    } catch (error) {
      console.error('Error unblocking device:', error);
      toast.error('Failed to unblock device');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveDeviceLimit = async () => {
    setSavingLimit(true);
    try {
      if (limitDialogType === 'org' && organizationId) {
        await setDeviceLimit(orgDeviceLimit, 'organization', undefined, organizationId);
        toast.success('Organization device limit updated');
      } else if (limitDialogType === 'user' && selectedEmployeeId) {
        await setDeviceLimit(userDeviceLimit, 'user', selectedEmployeeId, organizationId || undefined);
        toast.success('User device limit updated');
      }
      setShowLimitDialog(false);
    } catch (error) {
      console.error('Error saving device limit:', error);
      toast.error('Failed to save device limit');
    } finally {
      setSavingLimit(false);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const getEmployeeName = (userId: string) => {
    const employee = employees.find(e => e.id === userId);
    return employee?.name || 'Unknown';
  };

  const renderSessionCard = (session: DeviceSession, showEmployeeName: boolean = false) => (
    <div 
      key={session.id} 
      className={`p-4 border rounded-lg ${
        session.isBlocked 
          ? 'bg-destructive/5 border-destructive/30' 
          : session.isActive 
            ? 'bg-muted/30' 
            : 'bg-muted/10'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${
            session.isBlocked 
              ? 'bg-destructive/10 text-destructive' 
              : session.isActive 
                ? 'bg-primary/10 text-primary' 
                : 'bg-muted text-muted-foreground'
          }`}>
            {getDeviceIcon(session.deviceType)}
          </div>
          <div>
            {showEmployeeName && (
              <p className="text-sm font-semibold text-primary mb-1">
                {getEmployeeName(session.userId)}
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className="font-medium">{session.deviceName}</span>
              {session.isBlocked && (
                <Badge variant="destructive" className="text-xs">
                  <Ban className="h-3 w-3 mr-1" />
                  Blocked
                </Badge>
              )}
              {session.isActive && !session.isBlocked && (
                <Badge variant="default" className="text-xs bg-emerald-600 dark:bg-emerald-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" />
              <span>{session.location}</span>
              <span className="text-muted-foreground/50">•</span>
              <span>IP: {session.ipAddress}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span>
                Logged in {format(session.loginTimestamp.toDate(), 'MMM d, yyyy h:mm a')}
              </span>
              {session.isActive && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span>
                    Last active {formatDistanceToNow(session.lastActivityTimestamp.toDate(), { addSuffix: true })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.isActive && !session.isBlocked && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    disabled={actionLoading === session.id}
                  >
                    {actionLoading === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Terminate Session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will log out the user from this device immediately. They will need to log in again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleTerminateSession(session.id!)}>
                      Terminate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={actionLoading === session.id}
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Block This Device?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will terminate the session and prevent the user from logging in from this device in the future.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleBlockDevice(session.id!)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Block Device
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {session.isBlocked && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleUnblockDevice(session.id!)}
              disabled={actionLoading === session.id}
            >
              {actionLoading === session.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Unblock
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="user-sessions">User Sessions</TabsTrigger>
          <TabsTrigger value="settings">Device Limits</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="shadow-lg border-primary/20">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Shield className="h-6 w-6 text-primary" />
                  All Active Sessions
                </CardTitle>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {allActiveSessions.length} Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loadingAll ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : allActiveSessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active sessions found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allActiveSessions.map(session => renderSessionCard(session, true))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Sessions Tab */}
        <TabsContent value="user-sessions" className="space-y-4">
          <Card className="shadow-lg border-primary/20">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-6 w-6 text-primary" />
                User Device Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="mb-2 block">Select Employee</Label>
                  <SearchableEmployeeSelect
                    employees={employees}
                    value={selectedEmployeeId}
                    onValueChange={setSelectedEmployeeId}
                    placeholder="Search employee..."
                  />
                </div>
                {selectedEmployeeId && (
                  <div className="pt-6">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setLimitDialogType('user');
                        setShowLimitDialog(true);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Set Device Limit
                    </Button>
                  </div>
                )}
              </div>

              {selectedEmployeeId && (
                <div className="pt-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Monitor className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p>No device sessions found for this user</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-muted-foreground">
                          Device Limit: <span className="font-semibold">{userDeviceLimit}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Active: <span className="font-semibold">{sessions.filter(s => s.isActive && !s.isBlocked).length}</span>
                        </p>
                      </div>
                      <div className="space-y-3">
                        {sessions.map(session => renderSessionCard(session))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="shadow-lg border-primary/20">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Settings className="h-6 w-6 text-primary" />
                Device Limit Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Organization-wide limit */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Organization Default Limit</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Maximum number of devices each employee can be logged in simultaneously.
                        This applies to all users unless overridden.
                      </p>
                      <p className="text-lg font-bold text-primary mt-2">
                        {orgDeviceLimit} device{orgDeviceLimit > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setLimitDialogType('org');
                      setShowLimitDialog(true);
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Change
                  </Button>
                </div>
              </div>

              {/* Info about user-specific limits */}
              <div className="p-4 border rounded-lg bg-accent/30 border-accent">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">User-Specific Limits</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      You can set a different device limit for specific users. Go to the "User Sessions" tab, 
                      select an employee, and click "Set Device Limit" to customize their limit.
                    </p>
                  </div>
                </div>
              </div>

              {/* Auto-logout explanation */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <LogOut className="h-4 w-4" />
                  Auto-Logout Behavior
                </h4>
                <p className="text-sm text-muted-foreground">
                  When a user exceeds their device limit, the oldest session will be automatically 
                  terminated in real-time. The affected user will be logged out from that device immediately.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Device Limit Dialog */}
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {limitDialogType === 'org' ? 'Organization Device Limit' : 'User Device Limit'}
            </DialogTitle>
            <DialogDescription>
              {limitDialogType === 'org' 
                ? 'Set the maximum number of devices for all employees in the organization.'
                : 'Set a custom device limit for this specific user. This overrides the organization default.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="deviceLimit">Maximum Devices</Label>
            <Input
              id="deviceLimit"
              type="number"
              min={1}
              max={10}
              value={limitDialogType === 'org' ? orgDeviceLimit : userDeviceLimit}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                if (limitDialogType === 'org') {
                  setOrgDeviceLimit(Math.max(1, Math.min(10, value)));
                } else {
                  setUserDeviceLimit(Math.max(1, Math.min(10, value)));
                }
              }}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter a value between 1 and 10
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLimitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDeviceLimit} disabled={savingLimit}>
              {savingLimit ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceAccessControl;
