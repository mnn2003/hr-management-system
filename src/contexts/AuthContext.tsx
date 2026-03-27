import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { 
  createDeviceSession, 
  terminateSession, 
  subscribeToSessionChanges,
  updateSessionActivity 
} from '@/lib/deviceSessionService';
import { getDeviceInfo } from '@/lib/deviceFingerprint';
import { toast } from 'sonner';

export type UserRole = 'staff' | 'hr' | 'hod' | 'intern' | 'super-admin';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  organizationId: string | null;
  organizationName: string | null;
  loading: boolean;
  currentSessionId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  register: (email: string, password: string, role: UserRole, employeeData: any) => Promise<void>;
  setOrganization: (orgId: string, orgName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const sessionUnsubscribeRef = useRef<(() => void) | null>(null);
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load organization from localStorage on mount
  useEffect(() => {
    const storedOrgId = localStorage.getItem('organizationId');
    const storedOrgName = localStorage.getItem('organizationName');
    if (storedOrgId && storedOrgName) {
      setOrganizationId(storedOrgId);
      setOrganizationName(storedOrgName);
    }
  }, []);

  // Handle session termination from another device
  const handleSessionTerminated = useCallback(async () => {
    toast.error('Your session was terminated. You have been logged out.', {
      duration: 5000,
    });
    await signOut(auth);
  }, []);

  // Setup session monitoring
  const setupSessionMonitoring = useCallback((userId: string, sessionId: string) => {
    const deviceId = getDeviceInfo().deviceId;
    
    // Subscribe to session changes for real-time logout
    sessionUnsubscribeRef.current = subscribeToSessionChanges(
      userId,
      deviceId,
      handleSessionTerminated
    );

    // Update activity every 5 minutes
    activityIntervalRef.current = setInterval(() => {
      updateSessionActivity(sessionId);
    }, 5 * 60 * 1000);
  }, [handleSessionTerminated]);

  // Cleanup session monitoring
  const cleanupSessionMonitoring = useCallback(() => {
    if (sessionUnsubscribeRef.current) {
      sessionUnsubscribeRef.current();
      sessionUnsubscribeRef.current = null;
    }
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const roleDoc = await getDoc(doc(db, 'user_roles', user.uid));
        if (roleDoc.exists()) {
          const roleData = roleDoc.data();
          const role = roleData.role;
          // Handle legacy 'employee' role as 'staff'
          setUserRole(role === 'employee' ? 'staff' : role);
          
          // Set organization if available and not super-admin
          if (roleData.organizationId && role !== 'super-admin') {
            const orgDocRef = doc(db, 'organizations', roleData.organizationId);
            const orgSnap = await getDoc(orgDocRef);
            if (orgSnap.exists()) {
              const orgData = orgSnap.data();
              setOrganizationId(roleData.organizationId);
              setOrganizationName(orgData.name);
            }
          }
        }
        
        // Only restore session monitoring if we have a valid stored session
        // Don't set up monitoring here during login - login() handles it after creating the session
        const storedSessionId = localStorage.getItem('currentSessionId');
        if (storedSessionId && !currentSessionId) {
          // Verify the session is still active before monitoring
          const { doc: docRef, getDoc: getDocSnap } = await import('firebase/firestore');
          try {
            const sessionSnap = await getDocSnap(docRef(db, 'device_sessions', storedSessionId));
            if (sessionSnap.exists() && sessionSnap.data().isActive) {
              setCurrentSessionId(storedSessionId);
              setupSessionMonitoring(user.uid, storedSessionId);
            } else {
              // Stale session - clean up
              localStorage.removeItem('currentSessionId');
            }
          } catch (e) {
            console.error('Error verifying session:', e);
            localStorage.removeItem('currentSessionId');
          }
        }
      } else {
        setUserRole(null);
        setCurrentSessionId(null);
        cleanupSessionMonitoring();
      }
      setLoading(false);
    });
    
    return () => {
      unsubscribe();
      cleanupSessionMonitoring();
    };
  }, [setupSessionMonitoring, cleanupSessionMonitoring]);

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    
    // Get organization ID for the user
    const roleDoc = await getDoc(doc(db, 'user_roles', userId));
    let orgId: string | undefined;
    if (roleDoc.exists()) {
      orgId = roleDoc.data().organizationId;
    }
    
    try {
      // Create device session
      const result = await createDeviceSession(userId, orgId);
      
      if (result.success && result.sessionId) {
        setCurrentSessionId(result.sessionId);
        localStorage.setItem('currentSessionId', result.sessionId);
        setupSessionMonitoring(userId, result.sessionId);
        
        // Silently handle old device termination - no toast needed for seamless login
      }
    } catch (error: any) {
      // If device is blocked, sign out and throw error
      if (error.message?.includes('blocked')) {
        await signOut(auth);
        throw new Error('This device has been blocked by administrator. Please contact HR.');
      }
      console.error('Error creating device session:', error);
    }
  };

  const logout = async () => {
    // Terminate the current session
    if (currentSessionId) {
      try {
        await terminateSession(currentSessionId, 'user_logout');
      } catch (error) {
        console.error('Error terminating session:', error);
      }
    }
    
    cleanupSessionMonitoring();
    localStorage.removeItem('currentSessionId');
    
    await signOut(auth);
    // Keep organization in localStorage for next login
    // Only clear the context state
    setOrganizationId(null);
    setOrganizationName(null);
    setCurrentSessionId(null);
  };

  const setOrganization = (orgId: string, orgName: string) => {
    setOrganizationId(orgId);
    setOrganizationName(orgName);
    localStorage.setItem('organizationId', orgId);
    localStorage.setItem('organizationName', orgName);
  };

  const changePassword = async (newPassword: string) => {
    if (user) {
      await updatePassword(user, newPassword);
    }
  };

  const register = async (email: string, password: string, role: UserRole, employeeData: any) => {
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc, addDoc, collection } = await import('firebase/firestore');
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    
    // Set user role
    await addDoc(collection(db, 'user_roles'), {
      userId,
      role,
      organizationId: employeeData.organizationId || organizationId,
      createdAt: new Date().toISOString()
    });
    
    // Create employee record
    await setDoc(doc(db, 'employees', userId), {
      ...employeeData,
      userId,
      organizationId: employeeData.organizationId || organizationId,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userRole, 
      organizationId, 
      organizationName, 
      loading,
      currentSessionId,
      login, 
      logout, 
      changePassword, 
      register,
      setOrganization 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
