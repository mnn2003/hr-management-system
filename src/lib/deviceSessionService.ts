// Device session management service
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getDeviceInfo, DeviceInfo } from '@/lib/deviceFingerprint';

export interface DeviceSession {
  id?: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  ipAddress: string;
  location: string;
  city?: string;
  country?: string;
  loginTimestamp: Timestamp;
  lastActivityTimestamp: Timestamp;
  isActive: boolean;
  isBlocked: boolean;
  organizationId?: string;
}

export interface DeviceLimitSettings {
  id?: string;
  userId?: string;
  organizationId?: string;
  maxDevices: number;
  scope: 'user' | 'organization';
}

// Get IP and location info from external API
export const getLocationInfo = async (): Promise<{ ip: string; city: string; country: string; location: string }> => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    return {
      ip: data.ip || 'Unknown',
      city: data.city || 'Unknown',
      country: data.country_name || 'Unknown',
      location: `${data.city || 'Unknown'}, ${data.country_name || 'Unknown'}`
    };
  } catch (error) {
    console.error('Failed to get location info:', error);
    return {
      ip: 'Unknown',
      city: 'Unknown',
      country: 'Unknown',
      location: 'Unknown'
    };
  }
};

// Get device limit for a user
export const getDeviceLimit = async (userId: string, organizationId?: string): Promise<number> => {
  try {
    // First check user-specific limit
    const userLimitQuery = query(
      collection(db, 'device_limits'),
      where('userId', '==', userId),
      where('scope', '==', 'user')
    );
    const userLimitSnap = await getDocs(userLimitQuery);
    
    if (!userLimitSnap.empty) {
      return userLimitSnap.docs[0].data().maxDevices;
    }
    
    // Then check organization limit
    if (organizationId) {
      const orgLimitQuery = query(
        collection(db, 'device_limits'),
        where('organizationId', '==', organizationId),
        where('scope', '==', 'organization')
      );
      const orgLimitSnap = await getDocs(orgLimitQuery);
      
      if (!orgLimitSnap.empty) {
        return orgLimitSnap.docs[0].data().maxDevices;
      }
    }
    
    // Default limit
    return 1;
  } catch (error) {
    console.error('Error getting device limit:', error);
    return 1;
  }
};

// Set device limit for user or organization
export const setDeviceLimit = async (
  maxDevices: number, 
  scope: 'user' | 'organization',
  userId?: string,
  organizationId?: string
): Promise<void> => {
  try {
    const limitQuery = scope === 'user'
      ? query(collection(db, 'device_limits'), where('userId', '==', userId), where('scope', '==', 'user'))
      : query(collection(db, 'device_limits'), where('organizationId', '==', organizationId), where('scope', '==', 'organization'));
    
    const snapshot = await getDocs(limitQuery);
    
    if (!snapshot.empty) {
      await updateDoc(doc(db, 'device_limits', snapshot.docs[0].id), { maxDevices });
    } else {
      await addDoc(collection(db, 'device_limits'), {
        userId: scope === 'user' ? userId : null,
        organizationId,
        maxDevices,
        scope,
        createdAt: Timestamp.now()
      });
    }
  } catch (error) {
    console.error('Error setting device limit:', error);
    throw error;
  }
};

// Get active sessions count for a user
export const getActiveSessionsCount = async (userId: string): Promise<number> => {
  try {
    const sessionsQuery = query(
      collection(db, 'device_sessions'),
      where('userId', '==', userId),
      where('isActive', '==', true),
      where('isBlocked', '==', false)
    );
    const snapshot = await getDocs(sessionsQuery);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting active sessions count:', error);
    return 0;
  }
};

// Get all active sessions for a user
export const getActiveSessions = async (userId: string): Promise<DeviceSession[]> => {
  try {
    const sessionsQuery = query(
      collection(db, 'device_sessions'),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('lastActivityTimestamp', 'desc')
    );
    const snapshot = await getDocs(sessionsQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeviceSession));
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return [];
  }
};

// Get all sessions (active and past) for a user
export const getAllSessions = async (userId: string): Promise<DeviceSession[]> => {
  try {
    const sessionsQuery = query(
      collection(db, 'device_sessions'),
      where('userId', '==', userId),
      orderBy('loginTimestamp', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(sessionsQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeviceSession));
  } catch (error) {
    console.error('Error getting all sessions:', error);
    return [];
  }
};

// Create or update a device session
export const createDeviceSession = async (
  userId: string, 
  organizationId?: string
): Promise<{ success: boolean; sessionId?: string; terminatedSessions?: string[] }> => {
  try {
    const deviceInfo = getDeviceInfo();
    const locationInfo = await getLocationInfo();
    const deviceLimit = await getDeviceLimit(userId, organizationId);
    console.log('Device limit for user:', deviceLimit, 'userId:', userId, 'orgId:', organizationId);
    
    // Check if this device already has an active session
    const existingSessionQuery = query(
      collection(db, 'device_sessions'),
      where('userId', '==', userId),
      where('deviceId', '==', deviceInfo.deviceId),
      where('isActive', '==', true)
    );
    const existingSnapshot = await getDocs(existingSessionQuery);
    
    if (!existingSnapshot.empty) {
      // Update existing session
      const sessionDoc = existingSnapshot.docs[0];
      await updateDoc(doc(db, 'device_sessions', sessionDoc.id), {
        lastActivityTimestamp: Timestamp.now(),
        ipAddress: locationInfo.ip,
        location: locationInfo.location,
        city: locationInfo.city,
        country: locationInfo.country
      });
      return { success: true, sessionId: sessionDoc.id };
    }
    
    // Check if device is blocked
    const blockedQuery = query(
      collection(db, 'device_sessions'),
      where('userId', '==', userId),
      where('deviceId', '==', deviceInfo.deviceId),
      where('isBlocked', '==', true)
    );
    const blockedSnapshot = await getDocs(blockedQuery);
    
    if (!blockedSnapshot.empty) {
      throw new Error('This device has been blocked by administrator');
    }
    
    // Get active sessions count
    const activeSessions = await getActiveSessions(userId);
    const terminatedSessions: string[] = [];
    
    // If limit exceeded, terminate oldest sessions to make room for new one
    if (activeSessions.length >= deviceLimit) {
      console.log(`Active sessions (${activeSessions.length}) >= limit (${deviceLimit}), terminating oldest`);
      const sessionsToTerminate = activeSessions
        .sort((a, b) => a.lastActivityTimestamp.toMillis() - b.lastActivityTimestamp.toMillis())
        .slice(0, activeSessions.length - deviceLimit + 1);
      
      for (const session of sessionsToTerminate) {
        if (session.id) {
          await updateDoc(doc(db, 'device_sessions', session.id), {
            isActive: false,
            logoutTimestamp: Timestamp.now(),
            logoutReason: 'new_device_login'
          });
          terminatedSessions.push(session.id);
        }
      }
    }
    
    // Create new session - exclude undefined organizationId for super-admins
    const sessionData: Omit<DeviceSession, 'id'> = {
      userId,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      deviceType: deviceInfo.deviceType,
      ipAddress: locationInfo.ip,
      location: locationInfo.location,
      city: locationInfo.city,
      country: locationInfo.country,
      loginTimestamp: Timestamp.now(),
      lastActivityTimestamp: Timestamp.now(),
      isActive: true,
      isBlocked: false,
      ...(organizationId ? { organizationId } : {})
    };
    
    const docRef = await addDoc(collection(db, 'device_sessions'), sessionData);
    
    return { 
      success: true, 
      sessionId: docRef.id,
      terminatedSessions: terminatedSessions.length > 0 ? terminatedSessions : undefined
    };
  } catch (error) {
    console.error('Error creating device session:', error);
    throw error;
  }
};

// Update last activity timestamp
export const updateSessionActivity = async (sessionId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'device_sessions', sessionId), {
      lastActivityTimestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating session activity:', error);
  }
};

// Terminate a session (logout)
export const terminateSession = async (sessionId: string, reason: string = 'user_logout'): Promise<void> => {
  try {
    await updateDoc(doc(db, 'device_sessions', sessionId), {
      isActive: false,
      logoutTimestamp: Timestamp.now(),
      logoutReason: reason
    });
  } catch (error) {
    console.error('Error terminating session:', error);
    throw error;
  }
};

// Terminate all sessions for a user except current
export const terminateAllOtherSessions = async (userId: string, currentDeviceId: string): Promise<void> => {
  try {
    const sessionsQuery = query(
      collection(db, 'device_sessions'),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(sessionsQuery);
    
    for (const sessionDoc of snapshot.docs) {
      if (sessionDoc.data().deviceId !== currentDeviceId) {
        await updateDoc(doc(db, 'device_sessions', sessionDoc.id), {
          isActive: false,
          logoutTimestamp: Timestamp.now(),
          logoutReason: 'user_terminated_all'
        });
      }
    }
  } catch (error) {
    console.error('Error terminating all sessions:', error);
    throw error;
  }
};

// Block a device
export const blockDevice = async (sessionId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'device_sessions', sessionId), {
      isActive: false,
      isBlocked: true,
      logoutTimestamp: Timestamp.now(),
      logoutReason: 'admin_blocked'
    });
  } catch (error) {
    console.error('Error blocking device:', error);
    throw error;
  }
};

// Unblock a device
export const unblockDevice = async (sessionId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'device_sessions', sessionId), {
      isBlocked: false
    });
  } catch (error) {
    console.error('Error unblocking device:', error);
    throw error;
  }
};

// Get all sessions for organization (admin view)
export const getOrganizationSessions = async (organizationId: string): Promise<DeviceSession[]> => {
  try {
    const sessionsQuery = query(
      collection(db, 'device_sessions'),
      where('organizationId', '==', organizationId),
      where('isActive', '==', true),
      orderBy('lastActivityTimestamp', 'desc')
    );
    const snapshot = await getDocs(sessionsQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeviceSession));
  } catch (error) {
    console.error('Error getting organization sessions:', error);
    return [];
  }
};

// Subscribe to session changes for real-time updates
export const subscribeToSessionChanges = (
  userId: string, 
  currentDeviceId: string,
  onSessionTerminated: () => void
): (() => void) => {
  const sessionQuery = query(
    collection(db, 'device_sessions'),
    where('userId', '==', userId),
    where('deviceId', '==', currentDeviceId),
    where('isActive', '==', true)
  );
  
  const unsubscribe = onSnapshot(sessionQuery, (snapshot) => {
    if (snapshot.empty) {
      // Session was terminated
      onSessionTerminated();
    }
  });
  
  return unsubscribe;
};

// Get all sessions for a specific user (admin view)
export const getUserSessions = async (userId: string): Promise<DeviceSession[]> => {
  try {
    const sessionsQuery = query(
      collection(db, 'device_sessions'),
      where('userId', '==', userId),
      orderBy('loginTimestamp', 'desc')
    );
    const snapshot = await getDocs(sessionsQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeviceSession));
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
};
