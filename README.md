# HR Management System (ChronoStaff Suite)

A comprehensive multi-organization web-based HR Management System built with React, TypeScript, and Firebase. This application streamlines employee management, attendance tracking, leave requests, salary slip generation, device-based security, exit management, self-service portal, and more across multiple organizations.

## Features

### Employee Features
- **Dashboard Overview**: 
  - Personalized dashboard with greeting, quick stats, and customizable widgets
  - Direct punch-in/punch-out functionality from dashboard
  - Birthday widget showing colleagues' birthdays
- **Profile Management**: 
  - View and update comprehensive personal information
  - Contact Details (current address, native address, email, mobile)
  - Personal Details (blood group, height, weight, place of birth, nationality)
  - Qualification and Previous Experience
  - Family Details
  - Document uploads (PAN card, Aadhar card, qualification documents)
  - View assigned HOD and Leave Approvers
  - **Login Devices Section**: View and manage active login sessions
- **Attendance Tracking**: 
  - Mark punch-in/out times from dashboard or attendance page
  - Request attendance edits for forgotten punch-outs
  - View daily, weekly, and monthly attendance records
  - Generate attendance reports
- **Leave Management**: 
  - Submit leave requests with gender-specific leave types
  - Track leave status (pending, approved, rejected)
  - Cancel pending leave requests before approval
  - View leave history and approvers
  - Leave days exclude Sundays and company holidays
  - Multiple leave types: PL, SL, CL, Faculty, Maternity, Paternity, Adoption, Sabbatical, WFH, Bereavement, Parental, Comp Off, LWP, Vacation
- **Salary Slips**: View and download monthly salary slips with detailed breakdowns
- **Self-Service Portal**:
  - Tax Declaration submission
  - Investment Proofs upload
  - ITR Assistance
  - Reimbursement requests
  - Loan Applications
  - Payslip Downloads
  - Policy Documents access
- **Exit Management** (Employee Side):
  - Submit resignation with notice period
  - Track clearance process status
  - View settlement details
- **Birthday Wishes**: 
  - View colleagues with birthdays today
  - Send personalized birthday wishes using templates or custom messages
  - Receive private birthday notifications
- **Notifications**: View system-wide announcements and birthday wishes in notification center
- **Device Session Management**: View all logged-in devices and terminate sessions remotely
- **Chat / Messaging**:
  - Real-time one-on-one and group messaging within the organization
  - Send text messages, images, and file attachments
  - Conversation list with unread message counts
  - Mobile-responsive chat interface with back navigation
  - Floating chat widget accessible from any page (with unread badge)
- **Helpdesk**:
  - Submit support tickets with subject, category, priority, and description
  - Track ticket status (open, in-progress, resolved, closed)
  - Search and filter tickets by status and priority
  - View ticket responses and conversation history

### Super Admin Features
- **Organization Management**:
  - Create and manage multiple organizations
  - Configure organization-specific settings
  - View all organizations and their employees
  - Transfer employees between organizations
  - Update system-wide branding (logo and name)
- **Global Access**: Full access to all features across all organizations
- **All Users Management**: View and manage all employees across organizations in a unified view

### HR/Admin Features
- **Employee Management**: 
  - Add, edit, and delete employee records within their organization
  - Import employee data from Excel files (.xlsx, .xls) with automatic organizationId injection
  - Searchable employee dropdown in all admin forms
  - Manage comprehensive employee details (name, email, department, position, salary, gender, contact info)
  - Upload employee profile pictures
  - View detailed employee profiles
  - Block/unblock employee accounts
  - Reset employee passwords (defaults to employee code)
  - Edit employee codes and PAN numbers
- **Attendance Management**: 
  - View all employee attendance records within their organization
  - Approve or reject attendance edit requests
  - Filter by date range and employee with searchable dropdown
  - Export attendance reports
- **Leave Management**:
  - Configure leave types and balances
  - Review pending leave requests from organization employees
  - Approve or reject leaves with comments
  - View complete leave history
  - Track approval timestamps and approvers
- **Salary Slip Management**:
  - Generate monthly salary slips
  - Customize allowances (HRA, travel, other)
  - Manage deductions (tax, PF, other)
  - Automatic net salary calculation
  - Searchable employee selection
- **Department Management**: 
  - Create and manage departments within their organization
  - Assign HODs to departments
  - Searchable employee dropdown for HOD assignment
- **Holiday Management**: 
  - Create and manage company holidays for their organization
  - Set holiday dates and descriptions
- **Shift Management**:
  - Create, edit, and delete work shifts with custom start/end times
  - Assign shifts to individual employees via searchable dropdown
  - Set a default shift for the organization
  - View all shift assignments in a tabular format
  - Accessible to both HR and HOD roles
- **Device Access Control** (Security):
  - View all active device sessions per user
  - Configure simultaneous device login limits (per user or organization-wide)
  - Force logout any device manually
  - Block/unblock suspicious devices
  - Real-time session monitoring
- **Exit Management** (Admin Side):
  - Track employee resignations
  - Manage knowledge transfer processes
  - Conduct clearance processes
  - Schedule and conduct exit interviews
  - Process full and final settlements
  - Generate experience certificates
- **Self-Service Management**:
  - Review and approve tax declarations
  - Verify investment proofs
  - Process reimbursement requests
  - Manage loan applications
- **Notification System**:
  - Send organization-wide notifications
  - Pre-compose birthday wish templates
  - Manage notification visibility and delivery
  - Login notifications for new device logins
  - Login notification modal displayed on sign-in
- **Organization Branding**:
  - Update organization logo and name
  - Customize organization appearance
- **Dashboard Customization**: Employees can customize sidebar visibility and dashboard widgets
- **HR Analytics**: View organization-wide HR metrics and reports
- **Helpdesk Management**:
  - View and respond to all employee support tickets
  - Update ticket statuses (open → in-progress → resolved → closed)
  - Filter and search across all organization tickets
  - Stats overview with total, open, resolved, and personal ticket counts

### HOD Features
- **Leave Approvals**: Approve or reject leave requests for department employees only
- **Department View**: View employees within assigned department
- **Shift Management**: View and manage shift assignments for department employees
- **Attendance Management & Reporting**: Access attendance management and reports for the department
- **Exit Management**: Participate in exit management processes
- **Restricted Access**: Cannot manage employees, departments, attendance, or holidays

### Pricing & Subscriptions
- **Tiered Pricing Plans**:
  - **Starter** (₹4,099/mo): Up to 50 employees, basic attendance, leave management, monthly reports, email support
  - **Professional** (₹8,299/mo): Up to 200 employees, advanced attendance, salary slips, custom branding, analytics dashboard, priority support
  - **Enterprise**: Unlimited employees, multi-organization, custom integrations, dedicated account manager, SLA guarantee
- **Razorpay Payment Integration**: Seamless online payment for plan subscriptions with INR currency support
- **Subscription Tracking**: Payment records stored in Firebase with status tracking (pending, success, failed, cancelled)

## Design System & Styling

The application uses a comprehensive design system with semantic HSL color tokens:

- **Primary**: Teal/green accent (`162 73% 46%`) for primary actions and branding
- **Secondary**: Sky blue (`200 95% 65%`) for secondary elements
- **Accent**: Green (`140 65% 55%`) for highlights
- **Success/Warning/Destructive**: Contextual feedback colors
- **Dark Mode**: Full dark mode support with separate token set
- **Sidebar Theming**: Dedicated sidebar color tokens for consistent navigation styling
- **Chart Colors**: Five distinct chart colors for data visualization consistency
- **Rounded Design**: `1rem` border radius for a modern, soft UI feel
- **Component Library**: Built on shadcn/ui (Radix UI primitives) with Tailwind CSS utility classes
- **Responsive Layout**: Mobile-first design with collapsible sidebar and adaptive grid layouts
- **Animations**: Framer Motion for smooth transitions and interactive elements

## Security Features

### Device-Based Login Control
- **Unique Device Fingerprinting**: Each device is assigned a unique fingerprint for identification
- **Login Device History**: 
  - Device name (browser/OS/device type)
  - Location (city, country, IP-based)
  - Login date and time
  - Last active status
- **Device Limit Control**:
  - Configurable simultaneous device limits (default: 1)
  - Per-user or per-organization settings
  - Auto-logout of older sessions when limit exceeded
- **Real-Time Session Management**:
  - Automatic session termination on new login (when limit is 1)
  - Real-time token revocation
  - Users can view and terminate their own sessions
- **Admin Controls**:
  - View all active sessions across organization
  - Force logout any device
  - Block/unblock suspicious devices

### Data Isolation
- All employee data filtered by organizationId at database query level
- Firebase Security Rules enforce organization-based access
- Super-admins have cross-organization visibility
- HR admins restricted to their assigned organization

## Technologies Used

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with semantic design tokens
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Backend & Database**: Firebase
  - Authentication
  - Firestore Database
  - Cloud Storage
  - Security Rules
- **Payments**: Razorpay (checkout integration for subscription plans)
- **Routing**: React Router DOM (HashRouter)
- **State Management**: React Query (@tanstack/react-query)
- **Form Handling**: React Hook Form with Zod validation
- **Date Handling**: date-fns, react-day-picker, react-calendar
- **Charts**: Recharts
- **Icons**: Lucide React
- **Notifications**: React Hot Toast & Sonner
- **Animations**: Framer Motion
- **Excel Processing**: ExcelJS

## Prerequisites

- Node.js (v16 or higher)
- npm, yarn, or bun
- Firebase account

## Installation

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Firebase Configuration**
   
   The project is pre-configured with Firebase credentials in `src/lib/firebase.ts`. If you need to use your own Firebase project:
   
   a. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   
   b. Enable the following services:
      - Authentication (Email/Password)
      - Firestore Database
      - Storage
   
   c. Update `src/lib/firebase.ts` with your Firebase configuration:
   ```typescript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     databaseURL: "YOUR_DATABASE_URL",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID",
     measurementId: "YOUR_MEASUREMENT_ID"
   };
   ```

4. **Set up Firestore Database**
   
   Create the following collections in Firestore:
   - `employees` - Employee records with organizationId
   - `user_roles` - User role assignments
   - `attendance` - Attendance records
   - `leaves` - Leave requests
   - `holidays` - Company holidays
   - `departments` - Department information
   - `salary_slips` - Salary slip records
   - `organizations` - Organization details and branding
   - `device_sessions` - Device login sessions
   - `device_limits` - Device limit configurations
   - `notifications` - System notifications
   - `resignations` - Employee resignation records
   - `clearance_processes` - Exit clearance tracking
   - `exit_interviews` - Exit interview records
   - `settlements` - Full and final settlement records
   - `conversations` - Chat conversations between employees
   - `messages` - Individual chat messages
   - `helpdesk_tickets` - Support ticket records
   - `shifts` - Work shift definitions
   - `shift_assignments` - Employee-to-shift mappings
   - `subscriptions` - Payment/subscription records (Razorpay)
   - `user_preferences` - User menu and dashboard preferences
   - `system_settings` - Global system configuration (logo, name)

5. **Razorpay Configuration** (Optional — for payment features)
   
   Update `src/lib/razorpay.ts` with your Razorpay Key ID, or set the `VITE_RAZORPAY_KEY_ID` environment variable.

6. **Deploy Firebase Security Rules**
   
   Deploy the storage rules from `storage.rules` file to ensure proper data isolation.

7. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:8080`

## User Roles & Access Control

The system supports five user roles with specific permissions:

1. **Super Admin** - System administrator with global access to:
   - Create and manage multiple organizations
   - Configure system-wide branding (logo and name)
   - Full access to all features across all organizations
   - View and manage all employees across organizations
   - Transfer employees between organizations

2. **Staff** - Regular employees with access to:
   - Personal dashboard with punch-in/out functionality
   - Profile management with login device history
   - Attendance marking and edit requests
   - Leave applications with cancellation option
   - Salary slip viewing
   - Self-service portal (tax, investments, reimbursements, loans)
   - Exit management (resignation submission, clearance tracking)
   - Birthday wishes and notifications
   - Device session management
   - Real-time chat / messaging with colleagues
   - Helpdesk ticket submission and tracking

3. **HR** - Human resources personnel with organization-level administrative access to:
   - Employee management within their organization
   - Excel import with searchable employee selection
   - Attendance and leave management
   - Salary slip generation
   - Department and holiday management
   - Shift management (create shifts, assign to employees)
   - Device access control and security management
   - Exit management (resignations, clearance, interviews, settlements)
   - Self-service request approvals
   - Organization-wide notifications
   - User account management (block/unblock, password reset)
   - Organization branding configuration
   - HR Analytics dashboard
   - Helpdesk ticket management and responses
   - Chat / messaging with employees

4. **HOD** - Head of Department with limited administrative access:
   - Leave approvals for department employees only
   - View department employee records
   - Shift management and attendance reports for department
   - Exit management participation
   - Cannot manage employees, departments, attendance records, or holidays

5. **Intern** - Temporary employees with access similar to Staff role

## Authentication & Security

### Initial Setup
1. Create the first Super Admin account through the `/super-admin-setup` route
2. Super Admin creates organizations with HR admin details (email and PAN)
3. HR can then add employees through Employee Management or Excel import

### Login Flow
1. **Organization Selection**: Users first select their organization (cached in localStorage)
2. **Credentials Entry**: Enter email/employee code and password
3. **Device Session Creation**: System creates device session and enforces limits
4. **Organization Branding**: Organization logo and name are displayed after selection
5. **Login Notification Modal**: Unread notifications displayed immediately after login

### Login Credentials
- **Email**: Employee's actual email address (primary login method)
- **Employee Code**: Can also be used to login (system resolves to email)
- **Initial Password**: Employee's PAN number in uppercase

### Password Management
- Employees can change their password after first login
- HR can reset any employee's password (resets to employee code)
- Forgot password option available on login page
- Blocked employees cannot log in until unblocked by HR

### Device Session Security
- Each login creates a device session record
- Sessions track device fingerprint, IP, location, timestamps
- Device limits enforced (older sessions terminated automatically)
- Blocked devices cannot log in
- Real-time session monitoring with automatic logout

## Leave Policy

The system implements a comprehensive leave policy with multiple leave types:

- **PL (Privileged Leave)**: 30 annual days, 2.5 monthly accrual, 63 max carry-forward, encashable on exit
- **SL (Sick Leave)**: 7 annual days, medical certificate required after 3 days
- **CL (Casual Leave)**: 2 optional holidays for staff (not during probation)
- **Faculty Leave**: 15 casual days on calendar year basis
- **Maternity Leave**: 26 weeks maximum (12 pre + 12 post birth), paid if ≤2 children (Female only)
- **Paternity Leave**: 14 days after 12 months service, paid if ≤2 children (Male only)
- **Adoption Leave**: Varies by child age (12/6/3 weeks)
- **Sabbatical Leave**: After 10 years, 3 months duration, partial pay
- **WFH**: 15 annual days with defined working window
- **Bereavement Leave**: 10 days for immediate family
- **Parental Leave**: 10 unpaid days per child after 12 months
- **Comp Off**: Compensatory time off
- **LWP**: Leave without pay
- **Vacation**: As per organization policy

**Leave Calculation**: Leave days exclude Sundays and company holidays - only working days are deducted.

**Leave Routing**: All leave requests route to HR and assigned HOD for approval. Gender-specific leave types are displayed based on employee profile.

## Self-Service Portal

Employees have access to a self-service portal for:
- **Tax Declaration**: Submit annual tax declarations
- **Investment Proofs**: Upload investment proof documents
- **ITR Assistance**: Get help with income tax return filing
- **Reimbursements**: Submit expense reimbursement requests
- **Loan Applications**: Apply for company loans
- **Payslip Downloads**: Download historical payslips
- **Policy Documents**: Access company policy documents

## Exit Management

### For Employees
- Submit resignation with reason and notice period
- Track clearance process status across departments
- View settlement calculation details

### For HR/Admin
- **Resignation Tracking**: Monitor all resignations with searchable employee selection
- **Knowledge Transfer**: Manage handover processes
- **Clearance Process**: Track department-wise clearance with searchable selection
- **Exit Interviews**: Schedule and conduct exit interviews
- **Full & Final Settlement**: Calculate and process final settlements
- **Experience Certificates**: Generate employment certificates

## Chat & Messaging

- **Real-time Messaging**: Firebase-powered real-time chat between organization employees
- **Conversation Types**: One-on-one and group conversations
- **Rich Media**: Send text, images, and file attachments with cloud storage
- **Unread Tracking**: Per-user unread message counts with badge notifications
- **Floating Widget**: Accessible chat widget from any page with minimizable UI
- **Mobile Optimized**: Responsive layout with list/detail navigation on mobile
- **Organization Scoped**: Conversations isolated per organization

## Helpdesk / Support Ticketing

- **Ticket Creation**: Employees submit tickets with subject, category (payroll, leave, attendance, technical, benefits, other), priority (low/medium/high), and description
- **Ticket Lifecycle**: Open → In Progress → Resolved → Closed
- **Threaded Responses**: HR and employees can add responses to tickets
- **Search & Filters**: Full-text search, status filter, and priority filter
- **Dashboard Stats**: Total, open, resolved, and personal ticket counts at a glance
- **Auto Ticket Numbers**: Unique ticket IDs generated automatically

## Shift Management

- **Shift Definitions**: Create named shifts with start and end times
- **Default Shifts**: Mark one shift as the organization default
- **Employee Assignment**: Assign specific shifts to employees via searchable dropdown
- **Tabbed Interface**: Separate tabs for managing shifts and viewing assignments
- **Role-Based Access**: Available to HR (full CRUD) and HOD (view and assign)

## Usage

### For Super Admin
1. Log in with Super Admin credentials (no organization selection required)
2. Create and manage organizations with HR admin details
3. Configure system-wide branding (logo and name)
4. View and manage all employees across organizations
5. Transfer employees between organizations
6. Access all features globally

### For Employees
1. Select your organization from the list
2. Log in with your email/employee code and PAN (initial password)
3. Punch in/out directly from dashboard
4. Complete your profile with comprehensive details
5. View and manage login devices from profile
6. Submit leave requests and track approvals (cancel if pending)
7. Access self-service portal for tax, investments, reimbursements
8. View salary slips and download as needed
9. Send birthday wishes to colleagues
10. Use the chat feature to message colleagues in real time
11. Submit helpdesk tickets for any support needs
12. Submit resignation through exit management if needed

### For HR/Admin
1. Select your organization from the list
2. Log in with HR credentials
3. Import or manually add employee records (searchable dropdowns)
4. Configure device access limits and monitor sessions
5. Review and approve attendance edits and leave requests
6. Generate monthly salary slips
7. Manage departments, holidays, and notifications
8. Create and assign work shifts to employees
9. Handle exit processes (resignations, clearance, settlements)
10. Review self-service requests
11. Respond to helpdesk tickets and update statuses
12. Update organization branding
13. View HR Analytics

### For HOD
1. Select your organization from the list
2. Log in with HOD credentials
3. Review leave requests for your department
4. Approve or reject leaves with comments
5. View department employee records
6. Manage shift assignments for department employees

## Project Structure

```
src/
├── components/
│   ├── chat/                    # Chat/messaging components
│   │   ├── ChatWindow.tsx       # Real-time chat window
│   │   ├── ConversationList.tsx  # Conversation sidebar
│   │   └── FloatingChatWidget.tsx # Floating chat overlay
│   ├── dashboard/
│   │   ├── admin/               # Admin-specific components
│   │   │   ├── employee/        # Employee management components
│   │   │   ├── exit/            # Exit management components
│   │   │   └── ShiftManagement.tsx # Shift CRUD & assignment
│   │   ├── employee/            # Employee-specific components
│   │   │   └── exit/            # Employee exit components
│   │   ├── BirthdayWidget.tsx
│   │   ├── DashboardSettings.tsx
│   │   └── WeatherWidget.tsx
│   ├── employee/                # Employee directory components
│   ├── login/                   # Login page components
│   │   ├── Confetti.tsx         # Login celebration animation
│   │   └── LoginCharacter.tsx   # Animated login character
│   ├── notifications/           # Notification components
│   │   ├── LoginNotificationModal.tsx # Post-login notification popup
│   │   ├── NotificationBell.tsx
│   │   └── NotificationManager.tsx
│   ├── profile/                 # Profile components
│   │   └── LoginDevicesSection.tsx
│   ├── self-service/            # Self-service portal components
│   └── ui/                      # Reusable UI components (shadcn/ui)
│       ├── searchable-employee-select.tsx
│       └── document-viewer.tsx
├── contexts/
│   └── AuthContext.tsx          # Authentication context with device session management
├── hooks/
│   ├── use-mobile.tsx           # Mobile breakpoint detection
│   └── use-toast.ts
├── lib/
│   ├── firebase.ts              # Firebase configuration
│   ├── chatService.ts           # Chat messaging service (conversations, messages, attachments)
│   ├── dateUtils.ts             # Date utility functions
│   ├── deviceFingerprint.ts     # Device fingerprint generation
│   ├── deviceSessionService.ts  # Device session management service
│   ├── razorpay.ts              # Razorpay payment integration
│   └── utils.ts                 # Utility functions
├── pages/
│   ├── admin/                   # Admin pages
│   │   ├── DeviceAccess.tsx     # Device access control page
│   │   ├── ExitManagement.tsx   # Exit management page
│   │   ├── HRAnalytics.tsx      # HR analytics dashboard
│   │   ├── ShiftManagement.tsx  # Shift management page
│   │   ├── OrganizationManagement.tsx
│   │   └── ...
│   ├── Chat.tsx                 # Full-page chat interface
│   ├── Dashboard.tsx            # Main dashboard
│   ├── Helpdesk.tsx             # Helpdesk ticketing page
│   ├── Login.tsx                # Login page
│   ├── Pricing.tsx              # Subscription pricing page
│   ├── Profile.tsx              # Profile page
│   ├── SelfService.tsx          # Self-service portal
│   ├── Exit.tsx                 # Employee exit page
│   └── ...
├── types/
│   └── leave.ts                 # Leave type definitions
├── App.tsx                      # Root component with routes
├── index.css                    # Global styles with HSL design tokens
└── main.tsx
```

## Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

## Deployment

This project can be deployed to various platforms:

- **Lovable**: Built-in publishing with custom domain support
- **Vercel/Netlify**: Connect your GitHub repository
- **Firebase Hosting**: Use Firebase CLI to deploy

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is available for use under standard terms.

## Acknowledgments

- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Charts from [Recharts](https://recharts.org/)
- Animations from [Framer Motion](https://www.framer.com/motion/)
- Payments by [Razorpay](https://razorpay.com/)
