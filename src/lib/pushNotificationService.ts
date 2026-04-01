import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { db, getFirebaseMessaging } from '@/lib/firebase';

const PUSH_PREF_COLLECTION = 'push_preferences';
const FCM_TOKENS_COLLECTION = 'fcm_tokens';

// ⚠️ REPLACE THIS with your VAPID key from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE';

export const isPushSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

export const getPushPermissionStatus = (): NotificationPermission | 'unsupported' => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestPushPermission = async (): Promise<NotificationPermission> => {
  if (!isPushSupported()) return 'denied';
  return await Notification.requestPermission();
};

// --- FCM Token Management ---

export const registerFCMToken = async (userId: string): Promise<string | null> => {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.warn('Firebase Messaging not supported');
      return null;
    }

    // Register the FCM service worker
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      // Save token to Firestore
      await setDoc(doc(db, FCM_TOKENS_COLLECTION, `${userId}_${token.substring(0, 10)}`), {
        userId,
        token,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'unknown',
      });
      console.log('FCM token registered:', token.substring(0, 20) + '...');
      return token;
    }
    
    console.warn('No FCM token received');
    return null;
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return null;
  }
};

export const removeFCMToken = async (userId: string): Promise<void> => {
  try {
    const q = query(collection(db, FCM_TOKENS_COLLECTION), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, FCM_TOKENS_COLLECTION, d.id))));
  } catch (error) {
    console.error('Error removing FCM tokens:', error);
  }
};

export const setupForegroundMessageHandler = (callback?: (payload: any) => void): (() => void) | null => {
  let unsubscribe: (() => void) | null = null;

  getFirebaseMessaging().then(messaging => {
    if (!messaging) return;

    unsubscribe = onMessage(messaging, (payload) => {
      console.log('[Foreground] FCM message received:', payload);

      // Show browser notification for foreground messages
      const title = payload.notification?.title || payload.data?.title || 'New Notification';
      const body = payload.notification?.body || payload.data?.body || '';

      showBrowserNotification(title, { body, tag: payload.data?.tag || `fcm-${Date.now()}` });

      callback?.(payload);
    });
  });

  return () => unsubscribe?.();
};

// --- Push Preferences ---

export const savePushPreference = async (userId: string, enabled: boolean): Promise<void> => {
  await setDoc(doc(db, PUSH_PREF_COLLECTION, userId), {
    userId,
    enabled,
    updatedAt: new Date().toISOString(),
  });

  // Register or remove FCM token based on preference
  if (enabled) {
    await registerFCMToken(userId);
  } else {
    await removeFCMToken(userId);
  }
};

export const getPushPreference = async (userId: string): Promise<boolean> => {
  try {
    const prefDoc = await getDoc(doc(db, PUSH_PREF_COLLECTION, userId));
    if (prefDoc.exists()) {
      return prefDoc.data().enabled ?? false;
    }
    return false;
  } catch {
    return false;
  }
};

// --- Browser Notification Helpers ---

export const showBrowserNotification = (title: string, options?: NotificationOptions): void => {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 8000);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

export const showAttendanceReminder = (type: 'punch-in' | 'punch-out'): void => {
  const title = type === 'punch-in' ? '⏰ Time to Punch In!' : '⏰ Time to Punch Out!';
  const body = type === 'punch-in'
    ? 'Good morning! Don\'t forget to mark your attendance.'
    : 'It\'s time to punch out. Have a great evening!';
  showBrowserNotification(title, { body, tag: `attendance-${type}` });
};

export const showLeaveNotification = (status: 'approved' | 'rejected', leaveType: string): void => {
  const title = status === 'approved' ? '✅ Leave Approved' : '❌ Leave Rejected';
  const body = `Your ${leaveType} leave request has been ${status}.`;
  showBrowserNotification(title, { body, tag: `leave-${Date.now()}` });
};

export const showBirthdayNotification = (employeeName: string): void => {
  showBrowserNotification('🎂 Birthday Wishes!', {
    body: `Happy Birthday, ${employeeName}! Wishing you a wonderful day!`,
    tag: `birthday-${employeeName}`,
  });
};

export const showAdminAnnouncementNotification = (title: string, message: string): void => {
  showBrowserNotification(`📢 ${title}`, {
    body: message,
    tag: `announcement-${Date.now()}`,
  });
};
