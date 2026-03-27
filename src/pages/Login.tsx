import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import LoginCharacter from '@/components/login/LoginCharacter';
import Confetti from '@/components/login/Confetti';
import { Building2, Shield, ArrowLeft, Mail, Lock, Search, ChevronRight, Users, Calendar, FileText, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const Login = () => {
  const [step, setStep] = useState<'company' | 'login'>('company');
  const [companySearch, setCompanySearch] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [characterEmotion, setCharacterEmotion] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isWaving, setIsWaving] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [systemSettings, setSystemSettings] = useState({
    systemName: 'HR Management System',
    logoUrl: ''
  });
  const { login, logout, setOrganization, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadSystemSettings();
    checkCachedOrganization();
    
    // Load remembered credentials
    const savedUser = localStorage.getItem('rememberedUser');
    const savedPass = localStorage.getItem('rememberedPass');
    if (savedUser && savedPass) {
      setEmployeeCode(savedUser);
      setPassword(atob(savedPass));
      setRememberMe(true);
    }
  }, []);

  // Sync peeking state with showPassword
  useEffect(() => {
    setIsPeeking(showPassword);
  }, [showPassword]);

  const checkCachedOrganization = async () => {
    const cachedOrgId = localStorage.getItem('organizationId');
    const cachedOrgName = localStorage.getItem('organizationName');
    if (cachedOrgId && cachedOrgName) {
      try {
        const orgDoc = await getDoc(doc(db, 'organizations', cachedOrgId));
        if (orgDoc.exists()) {
          setSelectedOrganization({ id: cachedOrgId, ...orgDoc.data() });
        } else {
          setSelectedOrganization({ id: cachedOrgId, name: cachedOrgName });
        }
      } catch (error) {
        console.error('Error loading cached organization:', error);
        setSelectedOrganization({ id: cachedOrgId, name: cachedOrgName });
      }
      setStep('login');
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

  const searchOrganizations = async () => {
    if (!companySearch.trim()) {
      toast.error('Please enter company name or code');
      return;
    }
    
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const orgsRef = collection(db, 'organizations');
      const q = query(orgsRef, where('isActive', '==', true));
      
      const snapshot = await getDocs(q);
      const orgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((org: any) => 
          org.name.toLowerCase().includes(companySearch.toLowerCase()) ||
          org.code?.toLowerCase().includes(companySearch.toLowerCase())
        );
      
      setOrganizations(orgs);
      
      if (orgs.length === 0) {
        toast.error('No active organizations found');
      }
    } catch (error) {
      console.error('Error searching organizations:', error);
      toast.error('Failed to search organizations');
    }
  };

  const selectOrganization = async (org: any) => {
    try {
      const orgDoc = await getDoc(doc(db, 'organizations', org.id));
      const orgData = orgDoc.exists() ? { id: org.id, ...orgDoc.data() } : org;
      setSelectedOrganization(orgData);
      setOrganization(org.id, org.name);
      setStep('login');
    } catch (error) {
      console.error('Error fetching organization details:', error);
      setSelectedOrganization(org);
      setOrganization(org.id, org.name);
      setStep('login');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      let loginEmail = employeeCode;
      
      if (!employeeCode.includes('@')) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const employeesRef = collection(db, 'employees');
        const q = query(
          employeesRef,
          where('employeeCode', '==', employeeCode.trim()),
          where('organizationId', '==', selectedOrganization?.id || '')
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const employeeData = snapshot.docs[0].data();
          loginEmail = employeeData.email || `${employeeCode}@company.local`;
        } else {
          loginEmail = `${employeeCode}@company.local`;
        }
      }
      
      await login(loginEmail, password);
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsLoading(false);
        toast.error('Login failed');
        return;
      }
      
      const roleDoc = await getDoc(doc(db, 'user_roles', currentUser.uid));
      const isSuperAdmin = roleDoc.exists() && roleDoc.data().role === 'super-admin';
      
      if (isSuperAdmin) {
        setCharacterEmotion('success');
        setShowConfetti(true);
        toast.success('Welcome Super Admin!');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
        return;
      }
      
      if (!selectedOrganization) {
        setIsLoading(false);
        toast.error('Please select an organization first');
        await logout();
        return;
      }
      
      const employeeDoc = await getDoc(doc(db, 'employees', currentUser.uid));
      if (!employeeDoc.exists()) {
        setIsLoading(false);
        toast.error('Employee record not found');
        await logout();
        return;
      }
      
      const employeeData = employeeDoc.data();
      
      if (employeeData.isBlocked) {
        setIsLoading(false);
        toast.error('Your account has been blocked. Please contact HR.');
        await logout();
        return;
      }
      
      if (employeeData.organizationId !== selectedOrganization.id) {
        setIsLoading(false);
        toast.error('You do not belong to this organization');
        await logout();
        return;
      }
      
      // Save or clear remembered credentials
      if (rememberMe) {
        localStorage.setItem('rememberedUser', employeeCode);
        localStorage.setItem('rememberedPass', btoa(password));
      } else {
        localStorage.removeItem('rememberedUser');
        localStorage.removeItem('rememberedPass');
      }

      setCharacterEmotion('success');
      setShowConfetti(true);
      toast.success('Login successful!');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1200);
    } catch (error: any) {
      console.error('Login error:', error);
      setIsLoading(false);
      setCharacterEmotion('error');
      toast.error('Invalid credentials');
      setTimeout(() => setCharacterEmotion('neutral'), 1500);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let emailToReset = resetEmail.trim();
      
      if (!emailToReset.includes('@')) {
        if (!selectedOrganization) {
          toast.error('Please select your organization first');
          setShowForgotPassword(false);
          setStep('company');
          return;
        }
        
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const employeesRef = collection(db, 'employees');
        const q = query(
          employeesRef,
          where('employeeCode', '==', emailToReset),
          where('organizationId', '==', selectedOrganization.id)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const employeeData = snapshot.docs[0].data();
          if (!employeeData.email) {
            toast.error('No email address found for this employee code. Please contact HR.');
            return;
          }
          emailToReset = employeeData.email;
        } else {
          toast.error('Employee not found. Please check your employee code.');
          return;
        }
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailToReset)) {
        toast.error('Invalid email address format.');
        return;
      }
      
      await sendPasswordResetEmail(auth, emailToReset);
      toast.success('Password reset email sent! Please check your inbox and spam folder.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address format.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please try again later.');
      } else {
        toast.error('Failed to send reset email. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-background via-background to-muted/30">
      {/* Confetti animation */}
      <Confetti isActive={showConfetti} />
      
      {/* Left side - Characters & Animation (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col items-center justify-center p-8 xl:p-16 relative overflow-hidden bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-accent/10 rounded-full blur-3xl" />
          
          {/* Decorative patterns */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
        
        <div className="relative z-10 text-center max-w-xl">
          {/* Characters Row */}
          <div className="flex items-end justify-center gap-4 mb-8">
            {/* Left helper character - smaller */}
            <div className="transform hover:scale-105 transition-transform duration-500 translate-y-4">
              <LoginCharacter 
                isPasswordFocused={isPasswordFocused || showPassword}
                isUsernameFocused={isUsernameFocused}
                usernameValue={employeeCode}
                isPeeking={isPeeking}
                variant="helper"
                size="md"
                emotion={characterEmotion}
                isWaving={isWaving}
              />
            </div>
            
            {/* Main character - larger, center */}
            <div className="transform hover:scale-105 transition-transform duration-500">
              <LoginCharacter 
                isPasswordFocused={isPasswordFocused || showPassword}
                isUsernameFocused={isUsernameFocused}
                usernameValue={employeeCode}
                isPeeking={isPeeking}
                variant="main"
                size="lg"
                emotion={characterEmotion}
                isWaving={isWaving}
              />
            </div>
            
            {/* Right assistant character - smaller */}
            <div className="transform hover:scale-105 transition-transform duration-500 translate-y-4">
              <LoginCharacter 
                isPasswordFocused={isPasswordFocused || showPassword}
                isUsernameFocused={isUsernameFocused}
                usernameValue={employeeCode}
                isPeeking={isPeeking}
                variant="assistant"
                size="md"
                emotion={characterEmotion}
                isWaving={isWaving}
              />
            </div>
          </div>
          
          {/* Welcome text */}
          <div className="space-y-4 mb-10">
            <h1 className="text-4xl xl:text-5xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
              Welcome to HR Portal
            </h1>
            <p className="text-lg xl:text-xl text-muted-foreground max-w-md mx-auto">
              Your friendly HR team is ready to help you manage your work life seamlessly.
            </p>
          </div>
          
          {/* Features grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">Employee Management</p>
                <p className="text-xs text-muted-foreground mt-1">Complete HR suite</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-secondary/30 transition-all duration-300 hover:shadow-lg hover:shadow-secondary/5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-secondary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">Leave & Attendance</p>
                <p className="text-xs text-muted-foreground mt-1">Track with ease</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-accent/30 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">Payroll & Reports</p>
                <p className="text-xs text-muted-foreground mt-1">Automated processing</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-6">
              <div className="flex flex-col items-center">
                {step === 'login' && selectedOrganization && (
                  <>
                    {selectedOrganization.logoUrl ? (
                      <img 
                        src={selectedOrganization.logoUrl} 
                        alt={selectedOrganization.name} 
                        className="w-16 h-16 object-contain"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                          {selectedOrganization.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="text-center">
                  <CardTitle className="text-2xl font-bold">
                    {step === 'company' ? 'Select Organization' : 
                     showForgotPassword ? 'Reset Password' :
                     selectedOrganization ? selectedOrganization.name : 
                     'Super Admin Login'}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {step === 'company' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      placeholder="Search by company name or code"
                      className="pl-10 h-12"
                      onKeyDown={(e) => e.key === 'Enter' && searchOrganizations()}
                    />
                  </div>
                  <Button onClick={searchOrganizations} className="w-full h-12 text-base font-medium">
                    <Search className="w-4 h-4 mr-2" />
                    Search Organization
                  </Button>
                  
                  {organizations.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-sm font-medium text-muted-foreground">Select your organization</p>
                      {organizations.map((org) => (
                        <Button
                          key={org.id}
                          variant="outline"
                          className="w-full justify-between h-auto py-3 px-4 hover:bg-primary/5 hover:border-primary/30 transition-all"
                          onClick={() => selectOrganization(org)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-left">
                              <div className="font-medium">{org.name}</div>
                              {org.code && <div className="text-xs text-muted-foreground">Code: {org.code}</div>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-3 text-muted-foreground font-medium">
                        Or continue as
                      </span>
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full h-12 border-dashed hover:bg-secondary/5 hover:border-secondary/30"
                    onClick={() => {
                      setSelectedOrganization(null);
                      setStep('login');
                    }}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Login as Super Admin
                  </Button>
                </div>
              ) : !showForgotPassword ? (
                <div className="space-1">
                  {selectedOrganization && (
                    <div className="bg-muted/50 p-4 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{selectedOrganization?.name}</div>
                          {selectedOrganization?.code && (
                            <div className="text-xs text-muted-foreground">Code: {selectedOrganization.code}</div>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setStep('company');
                          setOrganizations([]);
                          setCompanySearch('');
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  )}
                  
                  {!selectedOrganization && (
                    <div className="bg-secondary/10 border border-secondary/20 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-secondary" />
                        <p className="text-sm font-medium">Super Admin Login</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use your email address to login as super admin
                      </p>
                    </div>
                  )}
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-4">
                      <label className="text-sm font-medium">
                        {selectedOrganization ? 'Employee Code or Email' : 'Email Address'}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={employeeCode}
                          onChange={(e) => setEmployeeCode(e.target.value)}
                          onFocus={() => setIsUsernameFocused(true)}
                          onBlur={() => setIsUsernameFocused(false)}
                          placeholder={selectedOrganization ? "e.g., W0115 or email@company.com" : "admin@example.com"}
                          type="text"
                          required
                          className="pl-10 h-12"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={passwordInputRef}
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            // Close peeking when typing (only if password is hidden)
                            if (!showPassword) {
                              setIsPeeking(false);
                            }
                          }}
                          onKeyDown={(e) => {
                            // Open peeking when backspace/delete is pressed (only if password is hidden)
                            if ((e.key === 'Backspace' || e.key === 'Delete') && !showPassword) {
                              setIsPeeking(true);
                              setTimeout(() => setIsPeeking(false), 800);
                            }
                          }}
                          onFocus={() => {
                            setIsPasswordFocused(true);
                          }}
                          onBlur={() => {
                            setIsPasswordFocused(false);
                            if (!showPassword) {
                              setIsPeeking(false);
                            }
                          }}
                          required
                          className="pl-10 pr-10 h-12"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            // Prevent the input from losing focus when clicking the button
                            e.preventDefault();
                          }}
                          onClick={() => {
                            setShowPassword((v) => !v);
                            // Keep cursor in the password input
                            queueMicrotask(() => passwordInputRef.current?.focus());
                          }}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rememberMe"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                      />
                      <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                        Remember me
                      </label>
                    </div>
                    </div>
                    
                    <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Signing In...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                    
                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-muted-foreground hover:text-primary"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot your password?
                    </Button>
                    
                    {!selectedOrganization && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setStep('company')}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Organization Selection
                      </Button>
                    )}
                  </form>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address or Employee Code</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Enter your email or employee code"
                        required
                        className="pl-10 h-12"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We'll send you a link to reset your password
                    </p>
                  </div>
                  <Button type="submit" className="w-full h-12 text-base font-medium">
                    Send Reset Link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
          
          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} HR Management System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
