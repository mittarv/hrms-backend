// Define the enum for event types
export enum HolidayEventType {
  MANDATORY = 'mandatory',
  OPTIONAL_RESTRICTED = 'optional_restricted'
}

// Define the enum for event types
export enum LeaveApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROOF_REQUIRED = 'proof_required',
}

// Define the enum for event types
export enum AttendanceStatusType {
  WORKING = 'working',
  HALF_DAY = 'half_day',
  ON_LEAVE = 'on_leave'
}

// Define the enum for register attendance action types
export enum RegisterAttendanceActionType {
  CREATE = 'create',
  UPDATE = 'update'
}

export enum hrmsNotificationTypes {
  MY_UPDATES = "my_updates",
  ORGANIZATION_UPDATES = "organization_updates",
}

export enum hrmsConstants {
  HR_REPOSITORY = 'HR Repository'
}

export enum LeaveAccrualFrequency {
  monthly_key = "monthly_key",
  annually_key = "annually_key", 
  quarterly_key = "quarterly_key",
  half_yearly_key = "half_yearly_key",
  one_time_key = "one_time_key"
}

export enum accessLevelConstant {
  SUPER_ADMIN = 900,
  TOOL_ADMIN = 500,
  VIEWER = 200,
  USER = 100
}

export enum componentTypes {
  DEFAULT_ADDITION = "defaultAddition",
  DEFAULT_DEDUCTION = "defaultDeduction",
  ADDITION = "addition",
  DEDUCTION = "deduction",
  ALL = "All",
}

export enum salaryConfigActions {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete"
}

export enum payrollStatus {
  PENDING = "pending",
  PAYROLL_FINALIZED = "payroll_finalized",
  PAYROLL_GENERATED = "payroll_generated",
  SKIPPED = "skipped",
}
export enum offboardingStatus {
  NOT_INITIATED = "not_initiated",
  INITIATED = "initiated",
  APPROVED = "approved",
  ON_HOLD = "on_hold",
  REJECTED = "rejected",
}

export enum SecondaryLocationLogStatus {
  UPCOMING = "Upcoming",
  PENDING = "Pending",
  ACTIVE = "Active",
  COMPLETED = "Completed",
  REJECTED = "Rejected",
}

export enum SecondaryLocationRequestType {
  LOG = "Log",
  EDIT = "Edit",
  DELETE = "Delete",
}

export enum SecondaryLocationRequestStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}
