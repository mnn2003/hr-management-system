# Firebase Setup Instructions

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name your project (e.g., "HR Management System")
4. Follow the setup wizard

## 2. Get Firebase Configuration

1. In Firebase Console, click the gear icon → Project settings
2. Scroll down to "Your apps" section
3. Click the web icon (</>) to create a web app
4. Copy the `firebaseConfig` object

## 3. Update Firebase Config

Open `src/lib/firebase.ts` and replace the placeholder config with your actual Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 4. Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** authentication

## 5. Create Firestore Database

1. Go to **Firestore Database** in Firebase Console
2. Click **Create database**
3. Choose **Start in production mode** (we'll add security rules later)
4. Select your preferred location

## 6. Set Up Firestore Collections & Indexes

The app uses these collections (they'll be created automatically when data is added):
- `employees` - Employee profiles
- `user_roles` - User role assignments
- `attendance` - Attendance records
- `leaves` - Leave applications
- `salary_slips` - Salary information

### ⚠️ IMPORTANT: Create Required Composite Indexes

Firestore requires composite indexes for queries with multiple filters. You MUST create these:

#### Method 1: Click Error Links (Easiest)
When you see "Query requires an index" errors in the console, Firebase provides direct links. Click them to auto-create indexes.

#### Method 2: Manual Creation
Go to **Firestore Database** → **Indexes** → **Composite** and create:

**Index 1: Attendance by Employee and Date**
- Collection ID: `attendance`
- Fields indexed:
  - `employeeId` - Ascending
  - `date` - Ascending
  - `__name__` - Ascending

**Index 2: Leaves by Employee and Date**
- Collection ID: `leaves`
- Fields indexed:
  - `employeeId` - Ascending
  - `createdAt` - Ascending
  - `__name__` - Ascending

**Index 3: Salary Slips by Employee and Month**
- Collection ID: `salary_slips`
- Fields indexed:
  - `employeeId` - Ascending
  - `month` - Ascending
  - `__name__` - Ascending

**Index 4: Attendance by Date (Admin View)**
- Collection ID: `attendance`
- Fields indexed:
  - `date` - Descending
  - `__name__` - Ascending

## 7. Firestore Security Rules

⚠️ **IMPORTANT**: These rules enforce organization-level data isolation. Deploy these rules to prevent cross-organization data access.

Add these security rules in Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to get user's organization ID
    function getUserOrg() {
      return get(/databases/$(database)/documents/user_roles/$(request.auth.uid)).data.organizationId;
    }
    
    // Helper function to check if user is super-admin
    function isSuperAdmin() {
      return exists(/databases/$(database)/documents/user_roles/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/user_roles/$(request.auth.uid)).data.role == 'super-admin';
    }
    
    // Helper function to check if user is HR or HOD (admin within their org)
    function isAdmin() {
      return exists(/databases/$(database)/documents/user_roles/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/user_roles/$(request.auth.uid)).data.role in ['hr', 'hod'];
    }
    
    // Helper to check organization membership
    function belongsToSameOrg(resourceOrgId) {
      return resourceOrgId == getUserOrg();
    }
    
    // Organizations collection
    match /organizations/{orgId} {
      allow read: if request.auth != null && (isSuperAdmin() || getUserOrg() == orgId);
      allow write: if isSuperAdmin();
    }
    
    // Employees collection - enforce organization boundaries
    match /employees/{employeeId} {
      allow read: if request.auth != null && 
                     (isSuperAdmin() || 
                      belongsToSameOrg(resource.data.organizationId) ||
                      request.auth.uid == resource.data.userId);
      allow update: if request.auth.uid == resource.data.userId || 
                       (isAdmin() && belongsToSameOrg(resource.data.organizationId));
      allow create: if isAdmin() && belongsToSameOrg(request.resource.data.organizationId);
      allow delete: if isAdmin() && belongsToSameOrg(resource.data.organizationId);
    }
    
    // User roles - users read own, admins manage within org
    match /user_roles/{userId} {
      allow read: if request.auth.uid == userId || isAdmin() || isSuperAdmin();
      allow create: if isSuperAdmin() || 
                       (isAdmin() && request.resource.data.organizationId == getUserOrg());
      allow update: if isSuperAdmin() || 
                       (isAdmin() && resource.data.organizationId == getUserOrg());
      allow delete: if isSuperAdmin() || 
                       (isAdmin() && resource.data.organizationId == getUserOrg());
    }
    
    // Attendance - enforce organization boundaries
    match /attendance/{attendanceId} {
      allow read: if request.auth != null &&
                     (isSuperAdmin() ||
                      belongsToSameOrg(resource.data.organizationId) ||
                      request.auth.uid == resource.data.employeeId);
      allow create: if request.auth.uid == request.resource.data.employeeId &&
                       belongsToSameOrg(request.resource.data.organizationId);
      allow update: if (request.auth.uid == resource.data.employeeId || isAdmin()) &&
                       belongsToSameOrg(resource.data.organizationId);
      allow delete: if isAdmin() && belongsToSameOrg(resource.data.organizationId);
    }
    
    // Leaves - enforce organization boundaries
    match /leaves/{leaveId} {
      allow read: if request.auth != null &&
                     (isSuperAdmin() ||
                      belongsToSameOrg(resource.data.organizationId) ||
                      request.auth.uid == resource.data.employeeId);
      allow create: if request.auth.uid == request.resource.data.employeeId &&
                       belongsToSameOrg(request.resource.data.organizationId);
      allow update: if (isAdmin() || request.auth.uid == resource.data.employeeId) &&
                       belongsToSameOrg(resource.data.organizationId);
      allow delete: if (request.auth.uid == resource.data.employeeId || isAdmin()) &&
                       belongsToSameOrg(resource.data.organizationId);
    }
    
    // Salary slips - strict access with org boundaries
    match /salary_slips/{slipId} {
      allow read: if request.auth.uid == resource.data.employeeId ||
                     (isAdmin() && belongsToSameOrg(resource.data.organizationId)) ||
                     isSuperAdmin();
      allow write: if isAdmin() && belongsToSameOrg(request.resource.data.organizationId);
    }
    
    // Departments - organization scoped
    match /departments/{deptId} {
      allow read: if request.auth != null && 
                     (isSuperAdmin() || belongsToSameOrg(resource.data.organizationId));
      allow write: if isAdmin() && belongsToSameOrg(request.resource.data.organizationId);
    }
    
    // Holidays - organization scoped
    match /holidays/{holidayId} {
      allow read: if request.auth != null && 
                     (isSuperAdmin() || belongsToSameOrg(resource.data.organizationId));
      allow write: if isAdmin() && belongsToSameOrg(request.resource.data.organizationId);
    }
    
    // Notifications
    match /notifications/{notificationId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow create: if isAdmin() || isSuperAdmin();
      allow update, delete: if request.auth.uid == resource.data.userId;
    }
    
    // Loan applications
    match /loan_applications/{loanId} {
      allow read: if request.auth.uid == resource.data.userId ||
                     (isAdmin() && belongsToSameOrg(resource.data.organizationId)) ||
                     isSuperAdmin();
      allow create: if request.auth.uid == request.resource.data.userId;
      allow update: if isAdmin() && belongsToSameOrg(resource.data.organizationId);
    }
    
    // ITR documents
    match /itr_documents/{docId} {
      allow read: if request.auth.uid == resource.data.userId || isAdmin() || isSuperAdmin();
      allow create: if request.auth.uid == request.resource.data.userId;
      allow delete: if request.auth.uid == resource.data.userId;
    }
    
    // Investment proofs
    match /investment_proofs/{proofId} {
      allow read: if request.auth.uid == resource.data.userId || isAdmin() || isSuperAdmin();
      allow create: if request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth.uid == resource.data.userId || isAdmin();
    }
    
    // Reimbursements
    match /reimbursements/{reimbId} {
      allow read: if request.auth.uid == resource.data.userId ||
                     (isAdmin() && belongsToSameOrg(resource.data.organizationId)) ||
                     isSuperAdmin();
      allow create: if request.auth.uid == request.resource.data.userId;
      allow update: if isAdmin() && belongsToSameOrg(resource.data.organizationId);
    }
    
    // Password resets audit log
    match /password_resets/{resetId} {
      allow read: if isAdmin() || isSuperAdmin();
      allow create: if isAdmin() || isSuperAdmin();
    }
    
    // Exit management
    match /resignations/{resignId} {
      allow read: if request.auth.uid == resource.data.employeeId ||
                     (isAdmin() && belongsToSameOrg(resource.data.organizationId)) ||
                     isSuperAdmin();
      allow create: if request.auth.uid == request.resource.data.employeeId;
      allow update: if isAdmin() && belongsToSameOrg(resource.data.organizationId);
    }
  }
}
```

## 8. Firebase Storage Security Rules

⚠️ **IMPORTANT**: Storage rules protect uploaded files. A `storage.rules` file is included in this repository.

Deploy the storage rules using Firebase CLI:

```bash
firebase deploy --only storage
```

Or copy the rules from `storage.rules` file to Firebase Console → Storage → Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAdmin() {
      return request.auth != null && 
        firestore.get(/databases/(default)/documents/user_roles/$(request.auth.uid)).data.role in ['hr', 'hod', 'super-admin'];
    }

    // Profile photos - users can only write their own
    match /profile-photos/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|jpg|png|webp)');
    }
    
    // ITR documents - private to user and admins
    match /itr_documents/{userId}/{document=**} {
      allow read: if request.auth.uid == userId || isAdmin();
      allow write: if request.auth.uid == userId
        && request.resource.size < 10 * 1024 * 1024;
    }
    
    // Investment proofs - private to user and admins
    match /investment_proofs/{userId}/{document=**} {
      allow read: if request.auth.uid == userId || isAdmin();
      allow write: if request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024;
    }
    
    // Reimbursements - private to user and admins
    match /reimbursements/{userId}/{document=**} {
      allow read: if request.auth.uid == userId || isAdmin();
      allow write: if request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024;
    }
    
    // Employee documents - admin only write
    match /documents/{userId}/{document=**} {
      allow read: if request.auth.uid == userId || isAdmin();
      allow write: if isAdmin();
    }
    
    // Organization logos
    match /organization_logos/{orgId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    
    // Default deny
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 9. Create Initial Admin User

You'll need to manually create your first HR/HOD user:

1. Go to **Authentication** in Firebase Console
2. Click **Add user**
3. Create a user with email format: `ADMIN@company.local` and password: `ADMIN`
4. Copy the UID of the created user
5. Go to **Firestore Database**
6. Create a document in `user_roles` collection:
   - Document ID: [paste the UID you copied]
   - Fields:
     - `userId`: [same UID]
     - `role`: `hr` (or `hod`)
     - `organizationId`: [your organization document ID]
7. Create a document in `employees` collection:
   - Document ID: auto-generated
   - Fields:
     - `userId`: [same UID]
     - `organizationId`: [same organization ID as in user_roles]
     - `name`: "Admin User"
     - `employeeCode`: "ADMIN"
     - `email`: "admin@company.com"
     - `phone`: ""
     - `address`: ""
     - `createdAt`: [current timestamp]

## 10. Deploy Security Rules

Deploy both Firestore and Storage rules using Firebase CLI:

```bash
# Deploy all rules
firebase deploy --only firestore:rules,storage

# Or deploy individually
firebase deploy --only firestore:rules
firebase deploy --only storage
```

**⚠️ CRITICAL**: Always deploy security rules after any changes. Test rules using the Firebase Emulator before deploying to production.

## Default Login

Once set up:
- **Employee Code**: Your employee code (e.g., W0115)
- **Password**: Same as employee code on first login
- Employees must change password after first login

## Features Included

✅ Employee Dashboard
- Profile management with photo upload
- Password change
- Attendance tracking with GPS location
- Monthly attendance calendar
- Leave application system
- Salary slip viewing

✅ HR/HOD Dashboard
- Employee management (add, edit, delete)
- Leave approval system
- Attendance monitoring
- Full employee data access

✅ Leave Types (as per specification)
- Earned Leave (EL) - 30 days/year
- Sick Leave (SL) - 7 days/year
- Casual Leave (CL) - 10 days/year
- Maternity Leave (ML) - 182 days
- Paternity Leave (PL) - 15 days
- Compensatory Leave (CO)

## Development

```bash
npm install
npm run dev
```

The app will run at `http://localhost:8080`
