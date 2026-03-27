export type LeaveType = "PL"|"CL"|"SL"|"MATERNITY"|"PATERNITY"|"ADOPTION"|"SABBATICAL"|"WFH"|"BEREAVEMENT"|"PARENTAL"|"COMP_OFF"|"LWP"|"VACATION";

export interface LeaveRequest {
  id?: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  duration: number;
  reason?: string;
  attachmentUrl?: string;
  status: "PENDING"|"APPROVED"|"REJECTED"|"CANCELLED";
  appliedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  notes?: string;
  isPaid?: boolean;
  approverIds?: string[];
  createdAt?: any;
  organizationId?: string;
}

export interface LeaveBalance {
  employeeId: string;
  PL: number;
  CL: number;
  SL: number;
  WFH: number;
  MATERNITY: number;
  PATERNITY: number;
  ADOPTION: number;
  SABBATICAL: number;
  BEREAVEMENT: number;
  PARENTAL: number;
  COMP_OFF: number;
  lastUpdated: string;
}

export interface LeavePolicies {
  PL: {
    annual: number;
    accrual: string;
    accrualPerMonth: number;
    carryForwardMax: number;
    encashableOnExit: boolean;
    eligibleAfterProbation: boolean;
  };
  SL: {
    annual: number;
    medicalCertificateThresholdDays: number;
    excessBecomesLWP: boolean;
  };
  CL: {
    annualStaff: number;
    probationEligible: boolean;
  };
  FACULTY: {
    vacationPolicy: string;
    casualLeaveAnnual: number;
    casualLeaveCalendarYear: boolean;
    casualLapseAtYearEnd: boolean;
  };
  MATERNITY: {
    preBirthWeeks: number;
    postBirthWeeks: number;
    maxTotalWeeks: number;
    eligibleAfterDays: number;
    paidIfChildrenCountAtMost: number;
  };
  PATERNITY: {
    days: number;
    eligibleAfterMonths: number;
    paidIfChildrenCountAtMost: number;
  };
  ADOPTION: {
    under3MonthsWeeks: number;
    "3to6MonthsWeeks": number;
    "6to12MonthsWeeks": number;
  };
  SABBATICAL: {
    eligibleAfterYears: number;
    durationMonths: number;
    educationPayFraction: number;
    recuperationPayFraction: number;
    minYearsBetween: number;
  };
  WFH: {
    annualLimitDays: number;
    workingHoursWindowStart: string;
    workingHoursWindowEnd: string;
  };
  BEREAVEMENT: {
    days: number;
    immediateFamily: string[];
  };
  PARENTAL: {
    unpaidDaysPerChild: number;
    eligibleAfterMonths: number;
  };
  accountingYearStart: string;
}
