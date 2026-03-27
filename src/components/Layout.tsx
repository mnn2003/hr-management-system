import { useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, User, LogOut, Settings } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import NotificationBell from '@/components/notifications/NotificationBell';
import LoginNotificationModal from '@/components/notifications/LoginNotificationModal';
// FloatingChatWidget hidden - chat notifications now shown in notification bell
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
interface LayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export default function Layout({ children, pageTitle }: LayoutProps) {
  const { userRole, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [userName, setUserName] = useState('');
  const [userPhotoURL, setUserPhotoURL] = useState('');
  
  const [displaySettings, setDisplaySettings] = useState({
    systemName: 'HR System',
    logoUrl: ''
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    loadDisplaySettings();
    if (user) {
      loadUserName();
    }
  }, [user]);

  const loadDisplaySettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'system_settings', 'general'));
      if (settingsDoc.exists()) {
        setDisplaySettings(settingsDoc.data() as any);
      }
    } catch (error) {
      console.error('Error loading display settings:', error);
    }
  };

  const loadUserName = async () => {
    try {
      if (user?.uid) {
        const employeeDoc = await getDoc(doc(db, 'employees', user.uid));
        if (employeeDoc.exists()) {
          const empData = employeeDoc.data();
          setUserName(empData.name || user.email || 'User');
          setUserPhotoURL(empData.profileImageUrl || empData.photoURL || '');
        } else {
          setUserName(user.email || 'User');
        }
      }
    } catch (error) {
      console.error('Error loading user name:', error);
      setUserName(user?.email || 'User');
    }
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      {pageTitle === 'Dashboard' && <LoginNotificationModal />}
      <div className="flex min-h-screen w-full bg-background">
        {userRole && <AppSidebar />}
        
        <div className="flex-1 flex flex-col w-full">
          <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 md:px-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </SidebarTrigger>
                <h1 className="text-lg font-semibold">
                  {pageTitle || displaySettings.systemName}
                </h1>
              </div>
              
              <div className="flex items-center gap-2">
                <NotificationBell />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 hover:bg-muted rounded-full p-1 transition-colors">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={userPhotoURL} alt={userName || user?.email || 'User'} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{userName || user?.email || 'User'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="mr-2 h-4 w-4" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <SidebarTrigger className="hidden lg:flex" />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
