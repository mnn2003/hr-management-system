import { useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, ImageIcon, MapPin, Heart, GraduationCap, Briefcase, Users, FileText } from 'lucide-react';
import { UserRole } from '@/contexts/AuthContext';

interface Department {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  employeeCode: string;
  email: string;
  phone: string;
  address: string;
  role: UserRole;
  designation: string;
  dateOfBirth: string;
  dateOfJoining: string;
  departmentId: string;
  salary: string;
  experience: string;
  pan: string;
  gender: 'Male' | 'Female' | '';
  currentAddress: string;
  nativeAddress: string;
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
}

interface EmployeeFormProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  isEditMode: boolean;
  departments: Department[];
  profileImagePreview: string;
  panCardFile: File | null;
  aadharCardFile: File | null;
  qualificationDocFile: File | null;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setPanCardFile: (file: File | null) => void;
  setAadharCardFile: (file: File | null) => void;
  setQualificationDocFile: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const EmployeeForm = ({
  formData,
  setFormData,
  isEditMode,
  departments,
  profileImagePreview,
  panCardFile,
  aadharCardFile,
  qualificationDocFile,
  onImageChange,
  setPanCardFile,
  setAadharCardFile,
  setQualificationDocFile,
  onSubmit
}: EmployeeFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panCardInputRef = useRef<HTMLInputElement>(null);
  const aadharCardInputRef = useRef<HTMLInputElement>(null);
  const qualificationDocInputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Profile Image</Label>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
            <AvatarImage src={profileImagePreview} />
            <AvatarFallback>
              <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 w-full sm:w-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImageChange}
              accept="image/*"
              className="hidden"
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Image
            </Button>
            <p className="text-xs text-muted-foreground mt-1 text-center sm:text-left">Max 5MB</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="employeeCode">Employee Code</Label>
          <Input
            id="employeeCode"
            placeholder="e.g., W0115"
            value={formData.employeeCode}
            onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
            required
            minLength={4}
          />
          <p className="text-xs text-muted-foreground">Min 4 chars - used as username</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pan">PAN Number</Label>
          <Input
            id="pan"
            placeholder="e.g., ABCDE1234F"
            value={formData.pan}
            onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
            required={!isEditMode}
            maxLength={10}
            minLength={10}
          />
          <p className="text-xs text-muted-foreground">10 chars - used as password</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="hod">HOD</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Input
            id="designation"
            placeholder="e.g., Software Engineer, Manager"
            value={formData.designation}
            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select value={formData.gender} onValueChange={(value: 'Male' | 'Female') => setFormData({ ...formData, gender: value })}>
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Personal Email</Label>
        <Input
          id="email"
          placeholder="employee@email.com"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          placeholder="Phone Number"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          placeholder="Full Address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateOfJoining">Date of Joining</Label>
          <Input
            id="dateOfJoining"
            type="date"
            value={formData.dateOfJoining}
            onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="departmentId">Department</Label>
          <Select 
            value={formData.departmentId} 
            onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
          >
            <SelectTrigger id="departmentId">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="experience">Experience (years)</Label>
          <Input
            id="experience"
            type="number"
            placeholder="Years of experience"
            value={formData.experience}
            onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="salary">Salary</Label>
        <Input
          id="salary"
          type="number"
          placeholder="Monthly salary"
          value={formData.salary}
          onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
          required
        />
      </div>

      {/* Contact Details Section */}
      <div className="pt-4 border-t">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Contact Details
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile Number</Label>
            <Input
              id="mobile"
              placeholder="Mobile number"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentAddress">Current Address</Label>
            <Textarea
              id="currentAddress"
              placeholder="Current residential address"
              value={formData.currentAddress}
              onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nativeAddress">Native Address</Label>
            <Textarea
              id="nativeAddress"
              placeholder="Native/Permanent address"
              value={formData.nativeAddress}
              onChange={(e) => setFormData({ ...formData, nativeAddress: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Personal Details Section */}
      <div className="pt-4 border-t">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          Personal Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="akaName">A.K.A. Name</Label>
            <Input
              id="akaName"
              placeholder="Also Known As"
              value={formData.akaName}
              onChange={(e) => setFormData({ ...formData, akaName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="placeOfBirth">Place of Birth</Label>
            <Input
              id="placeOfBirth"
              placeholder="City, State"
              value={formData.placeOfBirth}
              onChange={(e) => setFormData({ ...formData, placeOfBirth: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nationality">Nationality</Label>
            <Input
              id="nationality"
              placeholder="e.g., Indian"
              value={formData.nationality}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nameAsPerBankPassbook">Name as per Bank Passbook</Label>
            <Input
              id="nameAsPerBankPassbook"
              placeholder="As per bank records"
              value={formData.nameAsPerBankPassbook}
              onChange={(e) => setFormData({ ...formData, nameAsPerBankPassbook: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nameAsPerPAN">Name as per PAN Card</Label>
            <Input
              id="nameAsPerPAN"
              placeholder="As per PAN card"
              value={formData.nameAsPerPAN}
              onChange={(e) => setFormData({ ...formData, nameAsPerPAN: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nameAsPerAadhar">Name as per Aadhar Card</Label>
            <Input
              id="nameAsPerAadhar"
              placeholder="As per Aadhar card"
              value={formData.nameAsPerAadhar}
              onChange={(e) => setFormData({ ...formData, nameAsPerAadhar: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bloodGroup">Blood Group</Label>
            <Input
              id="bloodGroup"
              placeholder="e.g., A+ve"
              value={formData.bloodGroup}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">Height (cm)</Label>
            <Input
              id="height"
              type="number"
              placeholder="Height in cm"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              placeholder="Weight in kg"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Qualification Section */}
      <div className="pt-4 border-t">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          Qualification
        </h3>
        <div className="space-y-2">
          <Label htmlFor="qualification">Educational Qualification</Label>
          <Textarea
            id="qualification"
            placeholder="List educational qualifications..."
            value={formData.qualification}
            onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      {/* Previous Experience Section */}
      <div className="pt-4 border-t">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          Previous Experience
        </h3>
        <div className="space-y-2">
          <Label htmlFor="previousExperience">Work Experience</Label>
          <Textarea
            id="previousExperience"
            placeholder="List previous work experience..."
            value={formData.previousExperience}
            onChange={(e) => setFormData({ ...formData, previousExperience: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      {/* Family Details Section */}
      <div className="pt-4 border-t">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Family Details
        </h3>
        <div className="space-y-2">
          <Label htmlFor="familyDetails">Family Information</Label>
          <Textarea
            id="familyDetails"
            placeholder="Provide family details..."
            value={formData.familyDetails}
            onChange={(e) => setFormData({ ...formData, familyDetails: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      {/* Documents Section */}
      <div className="pt-4 border-t">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Documents
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="drivingLicense">Driving License Number</Label>
            <Input
              id="drivingLicense"
              placeholder="DL number"
              value={formData.drivingLicense}
              onChange={(e) => setFormData({ ...formData, drivingLicense: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passport">Passport Number</Label>
            <Input
              id="passport"
              placeholder="Passport number"
              value={formData.passport}
              onChange={(e) => setFormData({ ...formData, passport: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="visa">VISA Number</Label>
            <Input
              id="visa"
              placeholder="VISA number"
              value={formData.visa}
              onChange={(e) => setFormData({ ...formData, visa: e.target.value })}
            />
          </div>
        </div>
        
        {/* Document Uploads */}
        <div className="space-y-4 mt-4">
          <h4 className="text-sm font-semibold">Upload Documents</h4>
          
          {/* PAN Card Upload */}
          <div className="space-y-2">
            <Label>PAN Card</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={panCardInputRef}
                onChange={(e) => setPanCardFile(e.target.files?.[0] || null)}
                accept="image/*,application/pdf"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => panCardInputRef.current?.click()}
                className="flex-1"
                size="sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                {panCardFile ? panCardFile.name : 'Choose File'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">PDF or Image (Max 10MB)</p>
          </div>

          {/* Aadhar Card Upload */}
          <div className="space-y-2">
            <Label>Aadhar Card</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={aadharCardInputRef}
                onChange={(e) => setAadharCardFile(e.target.files?.[0] || null)}
                accept="image/*,application/pdf"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => aadharCardInputRef.current?.click()}
                className="flex-1"
                size="sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                {aadharCardFile ? aadharCardFile.name : 'Choose File'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">PDF or Image (Max 10MB)</p>
          </div>

          {/* Qualification Document Upload */}
          <div className="space-y-2">
            <Label>Qualification Certificate</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={qualificationDocInputRef}
                onChange={(e) => setQualificationDocFile(e.target.files?.[0] || null)}
                accept="image/*,application/pdf"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => qualificationDocInputRef.current?.click()}
                className="flex-1"
                size="sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                {qualificationDocFile ? qualificationDocFile.name : 'Choose File'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">PDF or Image (Max 10MB)</p>
          </div>
        </div>
      </div>
      
      <Button type="submit" className="w-full text-sm sm:text-base py-2.5">
        {isEditMode ? 'Update Employee' : 'Add Employee'}
      </Button>
    </form>
  );
};