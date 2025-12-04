import { 
  HolidayEventType, 
  LeaveApprovalStatus, 
  AttendanceStatusType, 
  RegisterAttendanceActionType, 
  hrmsNotificationTypes, 
  payrollStatus,
} from "../enum/hrmsEnum";

// Define the interface for the model attributes
export interface EmployeeHolidayDetailsAttributes {
  holidayId: string;
  eventName: string;
  eventDate: Date | null;
  eventType: HolidayEventType;
  isDeleted: boolean;
  remarks?: string | null;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for model creation (optional fields for creation)
export interface EmployeeHolidayDetailsCreationAttributes {
  holidayId: string;
  eventName: string;
  eventDate?: Date | null;
  eventType: HolidayEventType;
  isDeleted?: boolean;
  remarks?: string | null;
  createdBy: string;
}


// Define the interface for the model attributes
export interface EmployeeLeaveRequestAttributes {
  leaveRequestId: string;
  empUuid: string;
  leaveConfigId: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  isHalfDay: boolean;
  remarks?: string;
  applicationDate?: Date;
  approvalStatus: LeaveApprovalStatus;
  approvedBy?: string;
  approvalDate?: Date;
  attachmentPath?: string;
  checkIn?: string;
  checkOut?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for model creation (required attributes during record creation)
export interface EmployeeLeaveRequestCreationAttributes {
  leaveRequestId: string;
  empUuid: string;
  leaveConfigId: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  isHalfDay: boolean;
  remarks?: string;
  approvalStatus: LeaveApprovalStatus;
  approvedBy?: string;
  approvalDate?: Date;
  attachmentPath?: string;
  checkIn?: string;
  checkOut?: string;
}

// Define the interface for the model attributes
export interface EmployeeLeaveBalanceAttributes {
  balanceId: string;
  empUuid: string;
  leaveConfigId: string;
  totalLeaveUsed: number;
  fiscalYear: number;
  empType: string;
  fiscalYearStart: Date;
  fiscalYearEnd: Date;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for model creation (required attributes during record creation)
export interface EmployeeLeaveBalanceCreationAttributes {
  balanceId: string;
  empUuid: string;
  leaveConfigId: string;
  totalLeaveUsed: number;
  fiscalYear: number;
  empType: string;
  fiscalYearStart: Date;
  fiscalYearEnd: Date;
}

// Define the interface for the model attributes
export interface EmployeeAttendanceAttributes {
  attendanceId: string;
  empUuid: string;
  attendanceDate: Date;
  checkIn?: string;
  checkOut?: string;
  workHours?: number;
  attendanceStatus: AttendanceStatusType;
  remarks?: string;
  leaveRequestId?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for model creation (required attributes during record creation)
export interface EmployeeAttendanceCreationAttributes {
  attendanceId: string;
  empUuid: string;
  attendanceDate: Date;
  checkIn?: string;
  checkOut?: string;
  attendanceStatus: AttendanceStatusType;
  remarks?: string;
  leaveRequestId?: string;
}

export interface EmployeeAttendanceRequestPayload {
  empUuid: string,
  actionType: RegisterAttendanceActionType,
  attendanceId: string,
  attendanceStatus: AttendanceStatusType,
  attendanceDate?: string,
  checkIn?: string,
  checkOut?: string,
  leaveConfigId?: string,
  unpaidLeaveConfigId?: string,
  sickLeaveConfigId?: string,
  startDate?: string,
  endDate?: string,
  remarks?: string,
  attachmentPath?: string
}

export interface EmployeeLeaveAttendanceAttributes {
  attendanceId: string;
  empUuid: string;
  attendanceDate: Date;
  leaveConfigId: string;
  leaveRequestId?: string;
}

export interface hrmsEmailLogsAttributes {
  email_log_id: string;
  recipient_employee_id?: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  sent_at: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface hrmsEmailLogsCreationAttributes {
  email_log_id: string;
  recipient_employee_id?: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  sent_at: Date;
}
export interface hrmsNotificationAttributes {
  notificationId: string,
  message: string,
  notificationType: hrmsNotificationTypes,
  recipient_employee_id?: string,
  sender_employee_id: string,
  read_at?: Date,
  notification_effective_date: Date,
  notification_expiry_date?: Date,
  priority: number,
  is_deleted: boolean,
  createdAt?: Date,
  updatedAt?: Date
}

export interface CreateNotificationParams {
  notification_type: hrmsNotificationTypes;
  message: string;
  sender_employee_id: string;
  recipient_employee_id?: string;
  notification_effective_date?: Date;
}

// Interface for accrual leave calculation result
export interface AccrualLeaveResult {
  accruedLeaves: number;
  unusedLeaves: number;
  totalAvailableLeaves: number;
  paidLeaves: number;
  unpaidLeaves: number;
  maxContinuousLeaves: number;
  canApplyLeave: boolean;
  message?: string;
}

// Interface for leave configuration with accrual details
export interface LeaveConfigWithAccrual {
  leaveConfigId: string;
  leaveType: string;
  employeeType: string;
  accuralFrequency: string;
  totalAllotedLeaves: number;
  accuralRate: number;
  continuousLeavesLimit: number;
  excludePaidWeekend: boolean;
  allotAllLeaves?: boolean;
  effectiveDate: Date;
  terminationDate?: Date;
  isActive: boolean;
}

export interface SalaryCategoriesAttributes {
  salaryCategoryId: string;
  employeeType: string;
  employeeLocation: string;
  employeeLevel?: string;
  department?: string;
  yearOfStudy?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface salaryComponentsAttributes {
  componentId: string;
  salaryCategoryId: string;
  componentName: string;
  componentType: string;
  amount: number;
  percentageOfBasicSalary?: number;
  thresholdAmount?: number;
  frequency?: string;
  isVariable?: boolean;
  includeinLop?: boolean;
  effectiveFrom?: Date;
  effectiveTill?: Date;
  isDeleted?: boolean;
  isDefault?: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for user with required properties
export interface AuthenticatedUser {
  email?: string;
  userId?: string;
  toolsAccess: unknown;
}

export interface CategoryData {
  employeeType: string;
  employeeLocation: string;
  employeeLevel?: string;
  department?: string;
  yearOfStudy?: string;
}

export interface ComponentData {
  componentName: string;
  componentType: string;
  amount?: number;
  percentageOfBasicSalary?: number;
  thresholdAmount?: number;
  frequency?: string;
  isVariable?: boolean;
  includeinLop?: boolean;
  effectiveFrom?: Date;
  effectiveTill?: Date;
}

export interface CreateRequest {
  action: string;
  categoryDetails?: CategoryData;
  componentDetails: ComponentData[];
}

export interface CreateResult {
  categoriesCreated: unknown[];
  componentsCreated: unknown[];
  errors: Array<{
    categoryDetails?: CategoryData;
    componentDetails: ComponentData[];
    error: string;
  }>;
}

// Type definition for better type safety
export interface DeleteData {
  action: string;
  componentId: string;
  salaryCategoryId?: string;
  updatedBy?: string;
  isDefault?: boolean;
}

// Interface for update operations
export interface UpdateData {
  action: 'update';
  componentId: string;
  componentDetails: {
    componentName?: string;
    amount?: number;
    percentageOfBasicSalary?: number;
    thresholdAmount?: number;
    frequency?: string;
    isVariable?: boolean;
    includeinLop?: boolean;
    effectiveFrom?: Date;
    effectiveTill?: Date;
  };
}

export interface getRequestQuery {
  employeeType?: string;
  employeeLocation?: string;
  employeeLevel?: string;
  department?: string;
  yearOfStudy?: string;
}

export interface employeeComponentAdjustmentsAttributes {
  adjustmentId: string;
  employeeId: string;
  componentId: string;
  adjustedAmount: number;
  adjustedFrequency?: string;
  startDate: Date;
  endDate?: Date;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface employeePayslipAttributes {
  payslipId: string;
  employeeId: string;
  payrollStartDate: Date;
  payrollEndDate: Date;
  status: payrollStatus;
  netPay: number;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface employeePayslipItemAttributes {
  payrollItemId: string;
  payslipId: string;
  componentName: string;
  componentType: string;
  amount: number;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee address details
export interface EmployeeAddressDetailsAttributes {
  addressId: string;
  empUuid?: string | null;
  addressType?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  city?: string | null;
  pin?: number | null;
  state: string;
  country?: string | null;
  effectiveDate?: Date | null;
  terminationDate?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee advance salary details
export interface EmployeeAdvanceSalaryDetailsAttributes {
  advanceSalaryId: string;
  empUuid: string;
  empCurrentAdvanceSalaryAmount?: number | null;
  empCurrentAdvanceSalaryEmi?: number | null;
  empPaymentCountryCode: string;
  effectiveDate?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee advance salary details history
export interface EmployeeAdvanceSalaryDetailHistoryAttributes
  extends EmployeeAdvanceSalaryDetailsAttributes {
  advanceSalaryHistoryId: string;
}

// Interface for employee bank account details history
export interface EmployeeBankAccountDetailHistoryAttributes {
  bankAccountHistoryId: string;
  accountId: string;
  empUuid: string;
  empIFSCCode?: string | null;
  empAccountNumber?: string | null;
  empBenefeciaryName?: string | null;
  empAccType?: string | null;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee bank account details
export interface EmployeeBankAccountDetailsAttributes {
  accountId: string;
  empUuid: string;
  empIFSCCode?: string | null;
  empAccountNumber?: string | null;
  empBenefeciaryName?: string | null;
  empAccType?: string | null;
  effecTiveDate?: Date | null;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee basic details
export interface EmployeeBasicDetailsAttributes {
  empUuid: string;
  empCompanyId?: string | null;
  empFirstName: string;
  empLastName?: string | null;
  empDob?: Date | null;
  empGender?: string | null;
  empBloodGroup?: number | null;
  empFatherName?: string | null;
  empMotherName?: string | null;
  empMaritalStatus?: number | null;
  empGovId?: string | null;
  empNationality?: string | null;
  empHireDate?: Date | null;
  isManager?: boolean | null;
  isLead?: boolean | null;
  empLastLogin?: Date | null;
  empPanCard?: string | null;
  isDeleted: boolean;
  isActive?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee component configurator
export interface EmployeeComponentConfiguratorAttributes {
  id: number;
  componentType: string;
  componentValue: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee contact details
export interface EmployeContactDetailsAttributes {
  contactId: string;
  empUuid?: string;
  empPersonalPhone?: string;
  empPersonalEmail?: string;
  empOfficialPhone?: string;
  empOfficialEmail: string;
  empEmergencyContactName?: string;
  empEmergencyContactNumber?: string;
  empEmergencyContactRelation?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee data request
export interface EmployeeDataRequestAttributes {
  requestId: string;
  requestedFor: string;
  requestedBy: string;
  actionedBy?: string;
  oldData?: Record<string, any>;
  newData: Record<string, any>;
  attributesChanged: string;
  sectionChanged: string;
  isApproved?: boolean;
  isRejected?: boolean;
  actionedAt?: Date;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee job details
export interface EmployeeJobDetailsAttributes {
  jobId: string;
  empType?: string;
  empUuid?: string;
  empDepartment?: string;
  empTitle?: string;
  empLevel?: string;
  empManager?: string;
  isDeleted?: boolean;
  effectiveDate?: Date;
  lastDate?: Date;
  empConversionDate?: Date;
  empYearOfStudy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee job detail history
export interface EmployeeJobDetailHistoryAttributes
  extends EmployeeJobDetailsAttributes {
  jobHistoryId: string;
}

// Interface for employee leave configurator
export interface EmployeeLeaveConfiguratorAttributes {
  leaveConfigId: string;
  leaveType: string;
  employeeType: string;
  accuralFrequency: string;
  totalAllotedLeaves: number;
  accuralRate: number;
  minimumNoticePeriod: number;
  maximumNoticePeriod: number;
  continuousLeavesLimit: number;
  excludePaidWeekend: boolean;
  appliedGender: string;
  isHalfDayAllowed: boolean;
  isProofRequired: boolean;
  isReasonRequired: boolean;
  effectiveDate: Date;
  terminationDate?: Date;
  isActive: boolean;
  isDefault: boolean;
  leaveApplicableTo?: string;
  allotAllLeaves: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee login history
export interface EmployeeLoginHistoryAttributes {
  loginId: string;
  empUuid?: string;
  loginTimeStamp?: Date;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee salary details
export interface EmployeeSalaryDetailsAttributes {
  salaryId: string;
  empUuid: string;
  empAnnualSalary?: number;
  empMonthlySalary?: number;
  empNumberOfBonuses?: number;
  empPaymentCountryCode?: string;
  isDeleted?: boolean;
  effectiveDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for employee salary detail history
export interface EmployeeSalaryDetailHistoryAttributes
  extends EmployeeSalaryDetailsAttributes {
  salaryHistoryId: string;
}

// Interface for employment history
export interface EmploymentHistoryAttributes {
  empHistoryId: string;
  empUuid?: string;
  empStartDate?: Date;
  empEndDate?: Date;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PayrollDataItem {
    payslipId: string | null;
    empUuid: string;
    empName: string;
    monthlyCTC: number;
    defaultAdditions: Array<{ componentName: string; amount: number; frequency?: string | null }>;
    additions: Array<{ componentName: string; amount: number; effectiveTill?: string | null; frequency?: string | null }>;
    defaultDeductions: Array<{ componentName: string; amount: number; frequency?: string | null }>;
    deductions: Array<{ componentName: string; amount: number; effectiveTill?: string | null; frequency?: string | null }>;
    unpaidLeave: number;
    status: string;
    netPay?: number;
}

export interface CreatedAdjustment {
    adjustmentId: string;
    componentId: string;
    componentName: string;
    adjustedAmount: number;
}

export interface AdjustmentError {
    componentId?: string;
    error: string;
}
