import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, FileText, Heart, GraduationCap, Users, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Separator } from '@/components/ui/separator';

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  phone?: string;
  address?: string;
  role: string;
  designation?: string;
  dateOfBirth?: string;
  dateOfJoining?: string;
  departmentName?: string;
  salary?: number;
  experience?: number;
  pan?: string;
  profileImageUrl?: string;
  gender?: 'Male' | 'Female';
  currentAddress?: string;
  nativeAddress?: string;
  mobile?: string;
  akaName?: string;
  placeOfBirth?: string;
  nationality?: string;
  nameAsPerBankPassbook?: string;
  nameAsPerPAN?: string;
  nameAsPerAadhar?: string;
  bloodGroup?: string;
  height?: string;
  weight?: string;
  qualification?: string;
  previousExperience?: string;
  familyDetails?: string;
  drivingLicense?: string;
  passport?: string;
  visa?: string;
  panCardUrl?: string;
  aadharCardUrl?: string;
  qualificationDocUrl?: string;
}

const EmployeeDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeDetails();
  }, [id]);

  const fetchEmployeeDetails = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const empDoc = await getDoc(doc(db, 'employees', id));
      
      if (empDoc.exists()) {
        const data = empDoc.data();
        
        // Fetch department name if available
        let departmentName = '';
        if (data.departmentId) {
          const deptDoc = await getDoc(doc(db, 'departments', data.departmentId));
          if (deptDoc.exists()) {
            departmentName = deptDoc.data().name;
          }
        }
        
        setEmployee({
          id: empDoc.id,
          ...data,
          departmentName
        } as Employee);
      } else {
        toast.error('Employee not found');
        navigate('/employees');
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
      toast.error('Failed to load employee details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!employee) return null;

  const InfoItem = ({ label, value }: { label: string; value?: string | number }) => (
    value ? (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    ) : null
  );

  const DocumentLink = ({ label, url }: { label: string; url?: string }) => (
    url ? (
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <span className="text-sm font-medium">{label}</span>
        <Button size="sm" variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4 mr-2" />
            View
          </a>
        </Button>
      </div>
    ) : null
  );

  return (
    <Layout pageTitle="Employee Details">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/employees')}
        className="gap-2 mx-4 mt-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Employees
      </Button>
      
      <div className="space-y-4 p-4 sm:p-6">
              {/* Profile Header */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={employee.profileImageUrl} alt={employee.name} />
                      <AvatarFallback className="text-2xl">{employee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h2 className="text-2xl font-bold">{employee.name}</h2>
                        <p className="text-muted-foreground">{employee.designation || 'Employee'}</p>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {employee.employeeCode}
                          </Badge>
                          <Badge className="capitalize">
                            {employee.role}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {employee.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{employee.email}</span>
                          </div>
                        )}
                        {employee.mobile && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{employee.mobile}</span>
                          </div>
                        )}
                        {employee.departmentName && (
                          <div className="flex items-center gap-2 text-sm">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <span>{employee.departmentName}</span>
                          </div>
                        )}
                        {employee.dateOfJoining && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Joined: {new Date(employee.dateOfJoining).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contact Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Contact Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InfoItem label="Email" value={employee.email} />
                    <InfoItem label="Phone" value={employee.phone} />
                    <InfoItem label="Mobile" value={employee.mobile} />
                    <Separator />
                    <InfoItem label="Current Address" value={employee.currentAddress} />
                    <InfoItem label="Native Address" value={employee.nativeAddress} />
                  </CardContent>
                </Card>

                {/* Personal Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5" />
                      Personal Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InfoItem label="A.K.A. Name" value={employee.akaName} />
                    <InfoItem label="Place of Birth" value={employee.placeOfBirth} />
                    <InfoItem label="Nationality" value={employee.nationality} />
                    <InfoItem label="Gender" value={employee.gender} />
                    <InfoItem label="Blood Group" value={employee.bloodGroup} />
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem label="Height (cm)" value={employee.height} />
                      <InfoItem label="Weight (kg)" value={employee.weight} />
                    </div>
                    <Separator />
                    <InfoItem label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : undefined} />
                  </CardContent>
                </Card>

                {/* Professional Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Professional Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InfoItem label="Designation" value={employee.designation} />
                    <InfoItem label="Department" value={employee.departmentName} />
                    <InfoItem label="Date of Joining" value={employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : undefined} />
                    <InfoItem label="Experience (years)" value={employee.experience} />
                    <InfoItem label="Salary" value={employee.salary ? `₹${employee.salary.toLocaleString()}` : undefined} />
                  </CardContent>
                </Card>

                {/* Qualification */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Qualification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">
                      {employee.qualification || 'Not provided'}
                    </p>
                  </CardContent>
                </Card>

                {/* Previous Experience */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Previous Experience
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">
                      {employee.previousExperience || 'Not provided'}
                    </p>
                  </CardContent>
                </Card>

                {/* Family Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Family Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">
                      {employee.familyDetails || 'Not provided'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Identity Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Identity & Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="PAN Card" value={employee.pan} />
                    <InfoItem label="Name as per PAN" value={employee.nameAsPerPAN} />
                    <InfoItem label="Name as per Aadhar" value={employee.nameAsPerAadhar} />
                    <InfoItem label="Name as per Bank" value={employee.nameAsPerBankPassbook} />
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-medium">Uploaded Documents</h4>
                    <div className="grid gap-3">
                      <DocumentLink label="PAN Card" url={employee.panCardUrl} />
                      <DocumentLink label="Aadhar Card" url={employee.aadharCardUrl} />
                      <DocumentLink label="Qualification Certificate" url={employee.qualificationDocUrl} />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoItem label="Driving License" value={employee.drivingLicense} />
                    <InfoItem label="Passport" value={employee.passport} />
                    <InfoItem label="VISA" value={employee.visa} />
                  </div>
                </CardContent>
          </Card>
      </div>
    </Layout>
  );
};

export default EmployeeDetails;
