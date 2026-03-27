import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'react-hot-toast';
import { 
  User, Lock, Upload, MapPin, GraduationCap, Briefcase, 
  Users, FileText, Heart, Pencil, X, Check, ChevronDown, 
  ChevronUp, Mail, Phone, MapPinned, Droplet, Ruler, Weight,
  IdCard, BriefcaseBusiness, VenetianMask, Globe, UserCog,
  Shield, Eye, EyeOff, Camera
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { query, collection, where, getDocs } from 'firebase/firestore';
import LoginDevicesSection from '@/components/profile/LoginDevicesSection';

interface ProfileData {
  name: string;
  employeeCode: string;
  address: string;
  phone: string;
  profileImageUrl: string;
  departmentId: string;
  currentAddress: string;
  nativeAddress: string;
  email: string;
  mobile: string;
  akaName: string;
  placeOfBirth: string;
  nationality: string;
  nameAsPerBankPassbook: string;
  nameAsPerPAN: string;
  nameAsPerAadhar: string;
  bloodGroup: string;
  height: string;
  weight: string;
  qualification: string;
  previousExperience: string;
  familyDetails: string;
  drivingLicense: string;
  passport: string;
  visa: string;
  [key: string]: string; // Index signature for dynamic access
}

interface Approver {
  name: string;
  email: string;
  role: string;
}

const ProfileTab = () => {
  const { user, changePassword } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    employeeCode: '',
    address: '',
    phone: '',
    profileImageUrl: '',
    departmentId: '',
    currentAddress: '',
    nativeAddress: '',
    email: '',
    mobile: '',
    akaName: '',
    placeOfBirth: '',
    nationality: '',
    nameAsPerBankPassbook: '',
    nameAsPerPAN: '',
    nameAsPerAadhar: '',
    bloodGroup: '',
    height: '',
    weight: '',
    qualification: '',
    previousExperience: '',
    familyDetails: '',
    drivingLicense: '',
    passport: '',
    visa: ''
  });
  
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({
    personal: false,
    contact: false,
    personalDetails: false,
    qualification: false,
    experience: false,
    family: false,
    documents: false
  });
  
  const [editedProfile, setEditedProfile] = useState<ProfileData>(profile);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hodInfo, setHodInfo] = useState<Approver | null>(null);
  const [leaveApprovers, setLeaveApprovers] = useState<Approver[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    approvers: true,
    personal: true,
    contact: true,
    personalDetails: true,
    qualification: true,
    experience: true,
    family: true,
    documents: true,
    password: false
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const profileDoc = await getDoc(doc(db, 'employees', user.uid));
        if (profileDoc.exists()) {
          const profileData = profileDoc.data() as ProfileData;
          setProfile(profileData);
          setEditedProfile(profileData);
          
          if (profileData.departmentId) {
            await fetchHOD(profileData.departmentId);
          }
        }
        await fetchLeaveApprovers();
      }
    };
    fetchProfile();
  }, [user]);

  const fetchHOD = async (departmentId: string) => {
    try {
      const deptDoc = await getDoc(doc(db, 'departments', departmentId));
      if (deptDoc.exists()) {
        const deptData = deptDoc.data();
        if (deptData.hodId) {
          const hodDoc = await getDoc(doc(db, 'employees', deptData.hodId));
          if (hodDoc.exists()) {
            const hodData = hodDoc.data();
            setHodInfo({
              name: hodData.name || 'N/A',
              email: hodData.email || 'N/A',
              role: 'HOD'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching HOD:', error);
    }
  };

  const fetchLeaveApprovers = async () => {
    try {
      if (!user) return;
      
      const currentEmpDoc = await getDoc(doc(db, 'employees', user.uid));
      const currentEmpData = currentEmpDoc.exists() ? currentEmpDoc.data() : null;
      const employeeOrgId = currentEmpData?.organizationId;
      
      const approvers: Approver[] = [];
      
      const rolesQuery = query(collection(db, 'user_roles'));
      const rolesSnapshot = await getDocs(rolesQuery);
      
      for (const roleDoc of rolesSnapshot.docs) {
        const roleData = roleDoc.data();
        const role = roleData.role;
        const userId = roleData.userId || roleDoc.id;
        
        if ((role === 'hr' || role === 'hod') && roleData.organizationId === employeeOrgId) {
          const empDoc = await getDoc(doc(db, 'employees', userId));
          if (empDoc.exists()) {
            const empData = empDoc.data();
            approvers.push({
              name: empData.name || 'N/A',
              email: empData.email || 'N/A',
              role: role.toUpperCase()
            });
          }
        }
      }
      
      setLeaveApprovers(approvers);
    } catch (error) {
      console.error('Error fetching leave approvers:', error);
    }
  };

  const handleEdit = (section: string) => {
    setEditingSections(prev => ({ ...prev, [section]: true }));
    setEditedProfile(profile);
  };

  const handleCancel = (section: string) => {
    setEditingSections(prev => ({ ...prev, [section]: false }));
    setEditedProfile(profile);
  };

  const handleSave = async (section: string) => {
    try {
      await updateDoc(doc(db, 'employees', user!.uid), editedProfile);
      setProfile(editedProfile);
      setEditingSections(prev => ({ ...prev, [section]: false }));
      toast.success(`${section} updated successfully!`);
    } catch (error) {
      toast.error(`Failed to update ${section}`);
    }
  };

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `profile-photos/${user!.uid}`);
      await uploadBytes(storageRef, file);
      const profileImageUrl = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'employees', user!.uid), { profileImageUrl });
      setProfile(prev => ({ ...prev, profileImageUrl }));
      setEditedProfile(prev => ({ ...prev, profileImageUrl }));
      toast.success('Profile photo updated successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await changePassword(newPassword);
      toast.success('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setEditingSections(prev => ({ ...prev, password: false }));
    } catch (error) {
      toast.error('Failed to change password');
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const SectionHeader = ({ title, icon: Icon, section, isExpanded }: any) => (
    <div 
      className="flex items-center justify-between cursor-pointer p-4 hover:bg-muted/50 transition-colors rounded-t-lg"
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">{title}</h3>
        {editingSections[section] && (
          <Badge variant="secondary" className="ml-2">Editing</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!editingSections[section] && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(section);
            }}
            className="hover:bg-primary/10"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </div>
    </div>
  );

  const EditActions = ({ section }: { section: string }) => (
    <div className="flex gap-2 mt-4">
      <Button onClick={() => handleSave(section)} size="sm" className="flex-1 md:flex-none">
        <Check className="h-4 w-4 mr-2" /> Save Changes
      </Button>
      <Button onClick={() => handleCancel(section)} size="sm" variant="outline" className="flex-1 md:flex-none">
        <X className="h-4 w-4 mr-2" /> Cancel
      </Button>
    </div>
  );

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground block">{label}</span>
      <span className="text-sm font-medium">{value || 'Not provided'}</span>
    </div>
  );

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Profile Header Card */}
      <Card className="shadow-lg border-primary/20 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-primary/20">
                <AvatarImage src={profile.profileImageUrl} />
                <AvatarFallback className="text-2xl sm:text-3xl bg-primary/10 text-primary">
                  {profile.name?.charAt(0) || 'E'}
                </AvatarFallback>
              </Avatar>
              <label 
                htmlFor="photo-upload" 
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="h-6 w-6 text-white" />
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold">{profile.name || 'Your Name'}</h2>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                <IdCard className="h-4 w-4" />
                Employee Code: {profile.employeeCode || 'Not assigned'}
              </p>
              <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                <Badge variant="secondary" className="text-xs">
                  {profile.email || 'No email'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {profile.mobile || 'No phone'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Approvers Section */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors p-4"
          onClick={() => toggleSection('approvers')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              My Approvers
            </CardTitle>
            {expandedSections.approvers ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSections.approvers && (
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {hodInfo && (
                <div className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <UserCog className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">Head of Department</h4>
                  </div>
                  <p className="text-sm font-medium">{hodInfo.name}</p>
                  <p className="text-xs text-muted-foreground break-all">{hodInfo.email}</p>
                </div>
              )}
              
              {leaveApprovers.map((approver, index) => (
                <div key={index} className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold">Leave Approver</h4>
                    </div>
                    <Badge variant="secondary" className="text-xs">{approver.role}</Badge>
                  </div>
                  <p className="text-sm font-medium">{approver.name}</p>
                  <p className="text-xs text-muted-foreground break-all">{approver.email}</p>
                </div>
              ))}
              
              {leaveApprovers.length === 0 && !hodInfo && (
                <div className="col-span-2 text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No approvers assigned yet</p>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Personal Information Section */}
      <Card className="shadow-lg border-primary/20">
        <SectionHeader 
          title="Personal Information" 
          icon={User} 
          section="personal"
          isExpanded={expandedSections.personal}
        />
        {expandedSections.personal && (
          <CardContent className="p-4 pt-0">
            {editingSections.personal ? (
              <div className="space-y-3">
                <Input
                  value={editedProfile.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Full Name"
                  className="bg-muted/50"
                />
                <Input
                  value={editedProfile.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Email"
                  type="email"
                  className="bg-muted/50"
                />
                <Input
                  value={editedProfile.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Phone Number"
                  className="bg-muted/50"
                />
                <Textarea
                  value={editedProfile.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Address"
                  className="bg-muted/50"
                  rows={3}
                />
                <EditActions section="personal" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoRow label="Full Name" value={profile.name} />
                <InfoRow label="Employee Code" value={profile.employeeCode} />
                <InfoRow label="Email" value={profile.email} />
                <InfoRow label="Phone" value={profile.phone} />
                <InfoRow label="Address" value={profile.address} />
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Contact Details Section */}
      <Card className="shadow-lg border-primary/20">
        <SectionHeader 
          title="Contact Details" 
          icon={MapPin} 
          section="contact"
          isExpanded={expandedSections.contact}
        />
        {expandedSections.contact && (
          <CardContent className="p-4 pt-0">
            {editingSections.contact ? (
              <div className="space-y-3">
                <Input
                  value={editedProfile.mobile}
                  onChange={(e) => handleInputChange('mobile', e.target.value)}
                  placeholder="Mobile Number"
                  className="bg-muted/50"
                />
                <Textarea
                  value={editedProfile.currentAddress}
                  onChange={(e) => handleInputChange('currentAddress', e.target.value)}
                  placeholder="Current Address"
                  className="bg-muted/50"
                  rows={3}
                />
                <Textarea
                  value={editedProfile.nativeAddress}
                  onChange={(e) => handleInputChange('nativeAddress', e.target.value)}
                  placeholder="Native Address"
                  className="bg-muted/50"
                  rows={3}
                />
                <EditActions section="contact" />
              </div>
            ) : (
              <div className="space-y-2">
                <InfoRow label="Mobile" value={profile.mobile} />
                <InfoRow label="Current Address" value={profile.currentAddress} />
                <InfoRow label="Native Address" value={profile.nativeAddress} />
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Personal Details Section */}
      <Card className="shadow-lg border-primary/20">
        <SectionHeader 
          title="Personal Details" 
          icon={Heart} 
          section="personalDetails"
          isExpanded={expandedSections.personalDetails}
        />
        {expandedSections.personalDetails && (
          <CardContent className="p-4 pt-0">
            {editingSections.personalDetails ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    value={editedProfile.akaName}
                    onChange={(e) => handleInputChange('akaName', e.target.value)}
                    placeholder="A.K.A. Name"
                    className="bg-muted/50"
                  />
                  <Input
                    value={editedProfile.placeOfBirth}
                    onChange={(e) => handleInputChange('placeOfBirth', e.target.value)}
                    placeholder="Place of Birth"
                    className="bg-muted/50"
                  />
                  <Input
                    value={editedProfile.nationality}
                    onChange={(e) => handleInputChange('nationality', e.target.value)}
                    placeholder="Nationality"
                    className="bg-muted/50"
                  />
                  <Input
                    value={editedProfile.bloodGroup}
                    onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                    placeholder="Blood Group"
                    className="bg-muted/50"
                  />
                  <Input
                    value={editedProfile.height}
                    onChange={(e) => handleInputChange('height', e.target.value)}
                    placeholder="Height (cm)"
                    type="number"
                    className="bg-muted/50"
                  />
                  <Input
                    value={editedProfile.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    placeholder="Weight (kg)"
                    type="number"
                    className="bg-muted/50"
                  />
                </div>
                <EditActions section="personalDetails" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoRow label="A.K.A. Name" value={profile.akaName} />
                <InfoRow label="Place of Birth" value={profile.placeOfBirth} />
                <InfoRow label="Nationality" value={profile.nationality} />
                <InfoRow label="Blood Group" value={profile.bloodGroup} />
                <InfoRow label="Height" value={profile.height ? `${profile.height} cm` : ''} />
                <InfoRow label="Weight" value={profile.weight ? `${profile.weight} kg` : ''} />
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Qualification Section */}
      <Card className="shadow-lg border-primary/20">
        <SectionHeader 
          title="Qualification" 
          icon={GraduationCap} 
          section="qualification"
          isExpanded={expandedSections.qualification}
        />
        {expandedSections.qualification && (
          <CardContent className="p-4 pt-0">
            {editingSections.qualification ? (
              <div className="space-y-3">
                <Textarea
                  value={editedProfile.qualification}
                  onChange={(e) => handleInputChange('qualification', e.target.value)}
                  placeholder="Educational Qualifications"
                  className="bg-muted/50"
                  rows={4}
                />
                <EditActions section="qualification" />
              </div>
            ) : (
              <InfoRow label="Qualifications" value={profile.qualification} />
            )}
          </CardContent>
        )}
      </Card>

      {/* Previous Experience Section */}
      <Card className="shadow-lg border-primary/20">
        <SectionHeader 
          title="Previous Experience" 
          icon={Briefcase} 
          section="experience"
          isExpanded={expandedSections.experience}
        />
        {expandedSections.experience && (
          <CardContent className="p-4 pt-0">
            {editingSections.experience ? (
              <div className="space-y-3">
                <Textarea
                  value={editedProfile.previousExperience}
                  onChange={(e) => handleInputChange('previousExperience', e.target.value)}
                  placeholder="Previous Work Experience"
                  className="bg-muted/50"
                  rows={4}
                />
                <EditActions section="experience" />
              </div>
            ) : (
              <InfoRow label="Experience" value={profile.previousExperience} />
            )}
          </CardContent>
        )}
      </Card>

      {/* Family Details Section */}
      <Card className="shadow-lg border-primary/20">
        <SectionHeader 
          title="Family Details" 
          icon={Users} 
          section="family"
          isExpanded={expandedSections.family}
        />
        {expandedSections.family && (
          <CardContent className="p-4 pt-0">
            {editingSections.family ? (
              <div className="space-y-3">
                <Textarea
                  value={editedProfile.familyDetails}
                  onChange={(e) => handleInputChange('familyDetails', e.target.value)}
                  placeholder="Family Information"
                  className="bg-muted/50"
                  rows={4}
                />
                <EditActions section="family" />
              </div>
            ) : (
              <InfoRow label="Family Details" value={profile.familyDetails} />
            )}
          </CardContent>
        )}
      </Card>

      {/* Documents Section */}
      <Card className="shadow-lg border-primary/20">
        <SectionHeader 
          title="Documents" 
          icon={FileText} 
          section="documents"
          isExpanded={expandedSections.documents}
        />
        {expandedSections.documents && (
          <CardContent className="p-4 pt-0">
            {editingSections.documents ? (
              <div className="space-y-3">
                <Input
                  value={editedProfile.drivingLicense}
                  onChange={(e) => handleInputChange('drivingLicense', e.target.value)}
                  placeholder="Driving License Number"
                  className="bg-muted/50"
                />
                <Input
                  value={editedProfile.passport}
                  onChange={(e) => handleInputChange('passport', e.target.value)}
                  placeholder="Passport Number"
                  className="bg-muted/50"
                />
                <Input
                  value={editedProfile.visa}
                  onChange={(e) => handleInputChange('visa', e.target.value)}
                  placeholder="VISA Number"
                  className="bg-muted/50"
                />
                <EditActions section="documents" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoRow label="Driving License" value={profile.drivingLicense} />
                <InfoRow label="Passport" value={profile.passport} />
                <InfoRow label="VISA" value={profile.visa} />
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Change Password Section */}
      <Card className="shadow-lg border-primary/20">
        <SectionHeader 
          title="Security" 
          icon={Lock} 
          section="password"
          isExpanded={expandedSections.password}
        />
        {expandedSections.password && (
          <CardContent className="p-4 pt-0">
            {editingSections.password ? (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New Password"
                    className="bg-muted/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  className="bg-muted/50"
                />
                <div className="flex gap-2">
                  <Button onClick={handleChangePassword} size="sm" className="flex-1">
                    <Check className="h-4 w-4 mr-2" /> Change Password
                  </Button>
                  <Button onClick={() => handleCancel('password')} size="sm" variant="outline" className="flex-1">
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleEdit('password')}
                className="w-full"
              >
                <Lock className="h-4 w-4 mr-2" /> Change Password
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {/* Login Devices Section */}
      <LoginDevicesSection />
    </div>
  );
};

export default ProfileTab;
