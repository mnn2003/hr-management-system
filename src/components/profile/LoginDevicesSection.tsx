import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  MapPin, 
  Clock, 
  Shield, 
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Globe,
  Laptop
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getAllSessions, 
  terminateSession, 
  terminateAllOtherSessions,
  DeviceSession 
} from '@/lib/deviceSessionService';
import { getDeviceInfo } from '@/lib/deviceFingerprint';
import { format, formatDistanceToNow } from 'date-fns';
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

const LoginDevicesSection = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const currentDeviceId = getDeviceInfo().deviceId;

  const loadSessions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userSessions = await getAllSessions(user.uid);
      setSessions(userSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast.error('Failed to load device sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [user]);

  const handleTerminateSession = async (sessionId: string) => {
    setTerminatingId(sessionId);
    try {
      await terminateSession(sessionId, 'user_terminated');
      toast.success('Device session terminated');
      loadSessions();
    } catch (error) {
      console.error('Error terminating session:', error);
      toast.error('Failed to terminate session');
    } finally {
      setTerminatingId(null);
    }
  };

  const handleTerminateAllOthers = async () => {
    if (!user) return;
    try {
      await terminateAllOtherSessions(user.uid, currentDeviceId);
      toast.success('All other sessions terminated');
      loadSessions();
    } catch (error) {
      console.error('Error terminating sessions:', error);
      toast.error('Failed to terminate sessions');
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />;
      case 'tablet':
        return <Tablet className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />;
      case 'laptop':
        return <Laptop className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />;
      default:
        return <Monitor className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />;
    }
  };

  const activeSessions = sessions.filter(s => s.isActive && !s.isBlocked);
  const pastSessions = sessions.filter(s => !s.isActive || s.isBlocked);

  if (loading) {
    return (
      <Card className="shadow-lg border-primary/20 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            Login Devices
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-primary/20 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            Login Devices
          </CardTitle>
          {activeSessions.length > 1 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                  Sign out all other devices
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[95vw] max-w-md mx-auto p-4 sm:p-6">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base sm:text-lg">
                    Sign out all other devices?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs sm:text-sm">
                    This will terminate all active sessions except your current device. 
                    Other users will need to log in again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                  <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleTerminateAllOthers}
                    className="w-full sm:w-auto text-xs sm:text-sm"
                  >
                    Sign out all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {/* Active Sessions */}
        <div>
          <h3 className="text-xs sm:text-sm font-semibold text-primary mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
            <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            Active Sessions ({activeSessions.length})
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {activeSessions.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-4 sm:py-6">
                No active sessions
              </p>
            ) : (
              activeSessions.map((session) => (
                <div 
                  key={session.id} 
                  className={`p-3 sm:p-4 border rounded-lg ${
                    session.deviceId === currentDeviceId 
                      ? 'bg-primary/5 border-primary/30' 
                      : 'bg-muted/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${
                        session.deviceId === currentDeviceId 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {getDeviceIcon(session.deviceType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                          <span className="font-medium text-sm sm:text-base truncate">
                            {session.deviceName}
                          </span>
                          {session.deviceId === currentDeviceId && (
                            <Badge variant="default" className="text-[10px] sm:text-xs whitespace-nowrap">
                              This device
                            </Badge>
                          )}
                        </div>
                        
                        {/* Location and IP - Responsive */}
                        <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 text-xs sm:text-sm text-muted-foreground mb-1">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{session.location}</span>
                          </div>
                          <span className="hidden xs:inline text-muted-foreground/50">•</span>
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">IP: {session.ipAddress}</span>
                          </div>
                        </div>
                        
                        {/* Timestamps - Responsive */}
                        <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                            <span className="truncate">
                              {format(session.loginTimestamp.toDate(), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <span className="hidden xs:inline text-muted-foreground/50">•</span>
                          <span className="truncate">
                            Last active {formatDistanceToNow(session.lastActivityTimestamp.toDate(), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Terminate Button - Mobile Optimized */}
                    {session.deviceId !== currentDeviceId && (
                      <div className="flex justify-end sm:items-start sm:self-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleTerminateSession(session.id!)}
                          disabled={terminatingId === session.id}
                          className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                        >
                          {terminatingId === session.id ? (
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                          <span className="sr-only">Terminate session</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Past Sessions */}
        {pastSessions.length > 0 && (
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              Past Sessions ({pastSessions.length})
            </h3>
            <div className="space-y-2">
              {pastSessions.slice(0, 5).map((session) => (
                <div 
                  key={session.id} 
                  className={`p-2 sm:p-3 border rounded-lg bg-muted/20 ${
                    session.isBlocked ? 'border-destructive/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="p-1 sm:p-1.5 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                      {getDeviceIcon(session.deviceType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-0.5">
                        <span className="text-xs sm:text-sm text-muted-foreground truncate">
                          {session.deviceName}
                        </span>
                        {session.isBlocked && (
                          <Badge variant="destructive" className="text-[8px] sm:text-[10px] px-1 py-0 whitespace-nowrap">
                            <AlertTriangle className="h-2 w-2 sm:h-2.5 sm:w-2.5 mr-0.5 sm:mr-1" />
                            Blocked
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                          <span className="truncate">{session.location}</span>
                        </div>
                        <span className="hidden xs:inline text-muted-foreground/50">•</span>
                        <span className="truncate">
                          {format(session.loginTimestamp.toDate(), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {pastSessions.length > 5 && (
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center pt-1 sm:pt-2">
                  And {pastSessions.length - 5} more session{pastSessions.length - 5 > 1 ? 's' : ''}...
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LoginDevicesSection;
