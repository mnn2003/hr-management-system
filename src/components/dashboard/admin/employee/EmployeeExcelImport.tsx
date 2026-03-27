import { toast } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserRole } from '@/contexts/AuthContext';

interface ImportProgress {
  current: number;
  total: number;
}

export const downloadTemplate = async () => {
  try {
    const templateHeaders = {
      name: 'Employee Name *',
      employeeCode: 'Employee Code *',
      email: 'Email *',
      pan: 'PAN Number *',
      phone: 'Phone',
      role: 'Role (staff/hr/hod/intern)',
      designation: 'Designation',
      dateOfBirth: 'Date of Birth (YYYY-MM-DD)',
      dateOfJoining: 'Date of Joining (YYYY-MM-DD)',
      departmentId: 'Department ID',
      salary: 'Salary',
      experience: 'Experience (years)',
      gender: 'Gender (Male/Female)',
      mobile: 'Mobile Number',
      address: 'Address',
      currentAddress: 'Current Address',
      nativeAddress: 'Native Address',
      akaName: 'Also Known As',
      placeOfBirth: 'Place of Birth',
      nationality: 'Nationality',
      nameAsPerBankPassbook: 'Name as per Bank Passbook',
      nameAsPerPAN: 'Name as per PAN',
      nameAsPerAadhar: 'Name as per Aadhar',
      bloodGroup: 'Blood Group',
      height: 'Height',
      weight: 'Weight',
      qualification: 'Qualification',
      previousExperience: 'Previous Experience',
      familyDetails: 'Family Details',
      drivingLicense: 'Driving License',
      passport: 'Passport',
      visa: 'Visa',
      aadharNumber: 'Aadhar Number',
      bankAccountNumber: 'Bank Account Number',
      bankName: 'Bank Name',
      ifscCode: 'IFSC Code',
      emergencyContactName: 'Emergency Contact Name',
      emergencyContactPhone: 'Emergency Contact Phone',
      emergencyContactRelation: 'Emergency Contact Relation'
    };

    const sampleData = {
      name: 'John Doe',
      employeeCode: 'EMP001',
      email: 'john.doe@example.com',
      pan: 'ABCDE1234F',
      phone: '+1234567890',
      role: 'staff',
      designation: 'Software Engineer',
      dateOfBirth: '1990-01-15',
      dateOfJoining: '2023-01-01',
      departmentId: '',
      salary: '50000',
      experience: '5',
      gender: 'Male',
      mobile: '+1234567890',
      address: '123 Main St, City',
      currentAddress: '123 Main St, City',
      nativeAddress: '456 Home St, Town',
      akaName: 'Johnny',
      placeOfBirth: 'City Name',
      nationality: 'Indian',
      nameAsPerBankPassbook: 'John Doe',
      nameAsPerPAN: 'John Doe',
      nameAsPerAadhar: 'John Doe',
      bloodGroup: 'O+',
      height: '175 cm',
      weight: '70 kg',
      qualification: 'Bachelor of Engineering',
      previousExperience: 'Worked at Company XYZ for 3 years',
      familyDetails: 'Father: John Sr., Mother: Jane',
      drivingLicense: 'DL1234567890',
      passport: 'P1234567',
      visa: '',
      aadharNumber: '1234 5678 9012',
      bankAccountNumber: '1234567890123456',
      bankName: 'State Bank',
      ifscCode: 'SBIN0001234',
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+1234567891',
      emergencyContactRelation: 'Spouse'
    };

    const workbook = new ExcelJS.Workbook();
    
    // Employee Data Sheet
    const worksheet = workbook.addWorksheet('Employee Data');
    
    // Add headers
    const headerRow = Object.values(templateHeaders);
    worksheet.addRow(headerRow);
    
    // Add sample data
    const sampleRow = Object.keys(templateHeaders).map(key => sampleData[key as keyof typeof sampleData]);
    worksheet.addRow(sampleRow);
    
    // Set column widths
    worksheet.columns.forEach((column, index) => {
      const headerValue = headerRow[index] || '';
      column.width = Math.max(headerValue.length + 2, 15);
    });

    // Instructions Sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    const instructionsData = [
      ['Employee Import Template Instructions'],
      [''],
      ['1. Fields marked with * are mandatory'],
      ['2. Organization ID will be automatically added based on your organization'],
      ['3. Employee password will be set to their PAN number (uppercase)'],
      ['4. PAN must be exactly 10 characters'],
      ['5. Email must be unique and valid'],
      ['6. Date format: YYYY-MM-DD (e.g., 1990-01-15)'],
      ['7. Role options: staff, hr, hod, intern'],
      ['8. Gender options: Male, Female'],
      [''],
      ['Note: Delete this sample row before importing your data']
    ];
    
    instructionsData.forEach(row => {
      instructionsSheet.addRow(row);
    });
    instructionsSheet.getColumn(1).width = 70;

    // Generate and download file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Employee_Import_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Template downloaded successfully!');
  } catch (error) {
    console.error('Error generating template:', error);
    toast.error('Failed to generate template');
  }
};

export const importFromExcel = async (
  file: File,
  organizationId: string,
  setImportProgress: (progress: ImportProgress) => void
): Promise<{ successCount: number; errorCount: number; errors: string[] }> => {
  setImportProgress({ current: 0, total: 0 });

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { successCount: 0, errorCount: 1, errors: ['No worksheet found in the file'] };
  }

  // Get headers from first row
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || '');
  });

  // Parse data rows (skip header)
  const jsonData: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    const rowData: Record<string, unknown> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        rowData[header] = cell.value;
      }
    });
    
    if (Object.keys(rowData).length > 0) {
      jsonData.push(rowData);
    }
  });

  const totalRows = jsonData.length;
  setImportProgress({ current: 0, total: totalRows });

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < jsonData.length; i++) {
    setImportProgress({ current: i + 1, total: totalRows });
    const row = jsonData[i] as Record<string, unknown>;
    const rowNumber = i + 2;
    
    try {
      const employeeCode = row['Employee Code'] || row['Employee Code *'] || row.employeeCode || row.EmployeeCode;
      if (!employeeCode || typeof employeeCode !== 'string' || String(employeeCode).trim() === '') {
        errors.push(`Row ${rowNumber}: Missing or invalid Employee Code`);
        errorCount++;
        continue;
      }

      const pan = row['PAN Number'] || row['PAN Number *'] || row.pan || row.PAN;
      if (!pan) {
        errors.push(`Row ${rowNumber} (${employeeCode}): Missing PAN Number`);
        errorCount++;
        continue;
      }
      
      const panStr = String(pan).trim();
      if (panStr.length !== 10) {
        errors.push(`Row ${rowNumber} (${employeeCode}): PAN must be exactly 10 characters (found: ${panStr.length})`);
        errorCount++;
        continue;
      }

      const name = row['Employee Name'] || row['Employee Name *'] || row.name || row.Name;
      if (!name || String(name).trim() === '') {
        errors.push(`Row ${rowNumber} (${employeeCode}): Missing Employee Name`);
        errorCount++;
        continue;
      }
      
      const emailField = row['Email'] || row['Email *'] || row.email || row.EMAIL;
      if (!emailField || !String(emailField).includes('@')) {
        errors.push(`Row ${rowNumber} (${employeeCode}): Valid email address is required`);
        errorCount++;
        continue;
      }
      
      const email = String(emailField).trim();
      const password = panStr.toUpperCase();

      let userCredential;
      try {
        const { initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth, createUserWithEmailAndPassword: createUser } = await import('firebase/auth');
        const secondaryApp = initializeApp(
          {
            apiKey: "AIzaSyBFHgyqk16_cxG1o7EF2OQ8ksxsjA1ENKk",
            authDomain: "pq-hub-906ed.firebaseapp.com",
            projectId: "pq-hub-906ed"
          },
          `Secondary_${Date.now()}_${Math.random()}`
        );
        const secondaryAuth = getAuth(secondaryApp);
        userCredential = await createUser(secondaryAuth, email, password);
        await deleteApp(secondaryApp);
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          errors.push(`Row ${rowNumber} (${employeeCode}): Employee already exists in system`);
        } else if (authError.code === 'auth/invalid-email') {
          errors.push(`Row ${rowNumber} (${employeeCode}): Invalid email format`);
        } else if (authError.code === 'auth/weak-password') {
          errors.push(`Row ${rowNumber} (${employeeCode}): Password too weak`);
        } else {
          errors.push(`Row ${rowNumber} (${employeeCode}): Authentication error - ${authError.message}`);
        }
        errorCount++;
        continue;
      }
      
      const employeeData = {
        name: String(name).trim(),
        employeeCode: String(employeeCode).trim(),
        email: String(row['Email *'] || row['Email'] || row.email || row.Email || '').trim(),
        phone: String(row['Phone'] || row.phone || row.Phone || ''),
        address: String(row['Address'] || row.address || row.Address || ''),
        role: (row['Role (staff/hr/hod/intern)'] || row.role || row.Role || 'staff') as UserRole,
        designation: String(row['Designation'] || row.designation || row.Designation || ''),
        dateOfBirth: String(row['Date of Birth (YYYY-MM-DD)'] || row.dateOfBirth || row.DateOfBirth || ''),
        dateOfJoining: String(row['Date of Joining (YYYY-MM-DD)'] || row.dateOfJoining || row.DateOfJoining || ''),
        departmentId: row['Department ID'] || row.departmentId || row.DepartmentId || null,
        salary: row['Salary'] || row.salary || row.Salary || null,
        experience: row['Experience (years)'] || row.experience || row.Experience || null,
        pan: panStr.toUpperCase(),
        gender: row['Gender (Male/Female)'] || row.gender || row.Gender || null,
        currentAddress: String(row['Current Address'] || row.currentAddress || row.CurrentAddress || ''),
        nativeAddress: String(row['Native Address'] || row.nativeAddress || row.NativeAddress || ''),
        mobile: String(row['Mobile Number'] || row.mobile || row.Mobile || ''),
        akaName: String(row['Also Known As'] || row.akaName || row.AkaName || ''),
        placeOfBirth: String(row['Place of Birth'] || row.placeOfBirth || row.PlaceOfBirth || ''),
        nationality: String(row['Nationality'] || row.nationality || row.Nationality || ''),
        nameAsPerBankPassbook: String(row['Name as per Bank Passbook'] || row.nameAsPerBankPassbook || row.NameAsPerBankPassbook || ''),
        nameAsPerPAN: String(row['Name as per PAN'] || row.nameAsPerPAN || row.NameAsPerPAN || ''),
        nameAsPerAadhar: String(row['Name as per Aadhar'] || row.nameAsPerAadhar || row.NameAsPerAadhar || ''),
        bloodGroup: String(row['Blood Group'] || row.bloodGroup || row.BloodGroup || ''),
        height: String(row['Height'] || row.height || row.Height || ''),
        weight: String(row['Weight'] || row.weight || row.Weight || ''),
        qualification: String(row['Qualification'] || row.qualification || row.Qualification || ''),
        previousExperience: String(row['Previous Experience'] || row.previousExperience || row.PreviousExperience || ''),
        familyDetails: String(row['Family Details'] || row.familyDetails || row.FamilyDetails || ''),
        drivingLicense: String(row['Driving License'] || row.drivingLicense || row.DrivingLicense || ''),
        passport: String(row['Passport'] || row.passport || row.Passport || ''),
        visa: String(row['Visa'] || row.visa || row.Visa || ''),
        aadharNumber: String(row['Aadhar Number'] || row.aadharNumber || row.AadharNumber || ''),
        bankAccountNumber: String(row['Bank Account Number'] || row.bankAccountNumber || row.BankAccountNumber || ''),
        bankName: String(row['Bank Name'] || row.bankName || row.BankName || ''),
        ifscCode: String(row['IFSC Code'] || row.ifscCode || row.IFSCCode || ''),
        emergencyContactName: String(row['Emergency Contact Name'] || row.emergencyContactName || row.EmergencyContactName || ''),
        emergencyContactPhone: String(row['Emergency Contact Phone'] || row.emergencyContactPhone || row.EmergencyContactPhone || ''),
        emergencyContactRelation: String(row['Emergency Contact Relation'] || row.emergencyContactRelation || row.EmergencyContactRelation || ''),
        organizationId: organizationId,
        userId: userCredential.user.uid,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'employees', userCredential.user.uid), employeeData);
      await setDoc(doc(db, 'user_roles', userCredential.user.uid), {
        role: employeeData.role,
        organizationId: organizationId,
        createdAt: new Date().toISOString()
      });

      successCount++;
    } catch (error: any) {
      console.error(`Error importing row ${rowNumber}:`, error);
      errors.push(`Row ${rowNumber}: ${error.message || 'Unknown error'}`);
      errorCount++;
    }
  }

  return { successCount, errorCount, errors };
};
