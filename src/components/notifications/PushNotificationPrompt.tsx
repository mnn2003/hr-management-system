import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import {
  isPushSupported,
  getPushPermissionStatus,
  requestPushPermission,
  savePushPreference,
  getPushPreference,
  registerFCMToken,
  setupForegroundMessageHandler,
} from '@/lib/pushNotificationService';
import { toast } from 'sonner';

const PushNotificationPrompt = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Set up foreground message handler when user has push enabled
  useEffect(() => {
    if (!user) return;

    let cleanup: (() => void) | null = null;

    const init = async () => {
      const enabled = await getPushPreference(user.uid);
      if (enabled && getPushPermissionStatus() === 'granted') {
        cleanup = setupForegroundMessageHandler();
      }
    };

    init();
    return () => cleanup?.();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const checkPrompt = async () => {
      if (!isPushSupported()) return;

      const status = getPushPermissionStatus();
      if (status === 'granted' || status === 'denied') {
        // If already granted, ensure token is registered
        if (status === 'granted') {
          const pref = await getPushPreference(user.uid);
          if (pref) {
            await registerFCMToken(user.uid);
          }
        }
        return;
      }

      const pref = await getPushPreference(user.uid);
      if (pref) return;

      const prompted = sessionStorage.getItem('push_prompt_shown');
      if (prompted) return;

      setTimeout(() => {
        setOpen(true);
        sessionStorage.setItem('push_prompt_shown', 'true');
      }, 2000);
    };

    checkPrompt();
  }, [user]);

  const handleEnable = async () => {
    if (!user) return;

    const permission = await requestPushPermission();

    if (permission === 'granted') {
      await savePushPreference(user.uid, true);
      setupForegroundMessageHandler();
      toast.success('Push notifications enabled! You\'ll receive alerts even when the app is closed.');
    } else {
      toast.info('Notifications blocked. You can enable them in browser settings.');
    }

    setOpen(false);
  };

  const handleDismiss = async () => {
    if (user) {
      await savePushPreference(user.uid, false);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="h-8 w-8 text-primary animate-bounce" />
            </div>
          </div>
          <DialogTitle className="text-center">Enable Push Notifications</DialogTitle>
          <DialogDescription className="text-center">
            Get real-time alerts even when the app is closed — attendance reminders, leave updates, birthday wishes, and announcements.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleEnable} className="w-full">
            <Bell className="mr-2 h-4 w-4" />
            Enable Push Notifications
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full">
            <BellOff className="mr-2 h-4 w-4" />
            Not Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PushNotificationPrompt;
