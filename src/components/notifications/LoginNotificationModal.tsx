import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'general' | 'birthday';
  createdAt: string;
  readBy: string[];
  recipientId?: string;
  organizationId?: string;
}

const LoginNotificationModal = () => {
  const { user, organizationId } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    
    const checkUnreadNotifications = async () => {
      try {
        // Get current user's employee ID and organization
        const employeesSnapshot = await getDocs(collection(db, 'employees'));
        const currentEmployee = employeesSnapshot.docs.find(doc => doc.data().userId === user.uid);
        const currentEmployeeId = currentEmployee?.id;
        const userOrgId = currentEmployee?.data()?.organizationId || organizationId;

        const snapshot = await getDocs(collection(db, 'notifications'));
        const notifs = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Notification[];
        
        // Filter notifications by organization and type
        const filteredNotifs = notifs.filter(n => {
          // Only show notifications from the same organization
          if (n.organizationId && n.organizationId !== userOrgId) {
            return false;
          }
          // Show general notifications or birthday wishes to the recipient
          return n.type === 'general' || (n.type === 'birthday' && n.recipientId === currentEmployeeId);
        });
        
        const unread = filteredNotifs.filter(n => !n.readBy?.includes(user.uid));
        
        if (unread.length > 0) {
          setNotifications(unread);
          setOpen(true);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    // Small delay to ensure user is fully loaded
    const timer = setTimeout(checkUnreadNotifications, 1000);
    return () => clearTimeout(timer);
  }, [user, organizationId]);

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await Promise.all(
        notifications.map(notif =>
          updateDoc(doc(db, 'notifications', notif.id), {
            readBy: [...(notif.readBy || []), user.uid]
          })
        )
      );
      setOpen(false);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            You have {notifications.length} new notification{notifications.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="p-4 rounded-lg border bg-card"
              >
                <h4 className="font-semibold text-sm mb-1">{notification.title}</h4>
                <p className="text-sm text-muted-foreground">{notification.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(notification.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginNotificationModal;
