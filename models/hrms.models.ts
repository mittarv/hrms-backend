import { initEmployeeComponentConfigurator } from "./tools/hrmsTools/employeeComponentConfiguratorModel";
import { initEmployeeAddressDetails } from "./tools/hrmsTools/employeeAddressDetailsModel";
import { initEmployeeAdvanceSalaryDetailHistory } from "./tools/hrmsTools/employeeAdvanceSalaryDetailHistoryModel";
import { initEmployeeAdvanceSalaryDetails } from "./tools/hrmsTools/employeeAdvanceSalaryDetailsModel";
import { initEmployeeBankAccountDetails } from "./tools/hrmsTools/employeeBankAccountDetailsModel";
import { initEmployeeBankAccountDetailHistory } from "./tools/hrmsTools/employeeBankAccountDetailHistoryModel";
import { initEmployeeBasicDetails } from "./tools/hrmsTools/employeeBasicDetailsModel";
import { initEmployeeContactDetails } from "./tools/hrmsTools/employeeContactDetailsModel";
import { initEmployeeJobDetailHistory } from "./tools/hrmsTools/employeeJobDetailHistoryModel";
import { initEmployeeJobDetails } from "./tools/hrmsTools/employeeJobDetailsModel";
import { initEmployeeLoginHistory } from "./tools/hrmsTools/employeeLoginHistoryModel";
import { initEmployeeSalaryDetailHistory } from "./tools/hrmsTools/employeeSalaryDetailHistoryModel";
import { initEmployeeSalaryDetails } from "./tools/hrmsTools/employeeSalaryDetailsModel";
import { initEmploymentHistory } from "./tools/hrmsTools/employmentHistoryModel";
import { initEmployeeDataRequest } from "./tools/hrmsTools/employeeDataRequestModel";
import { initEmployeeLeaveConfigurator } from "./tools/hrmsTools/employeeLeaveConfiguratorModel";
import { initEmployeeHolidayDetails } from "./tools/hrmsTools/employeeHolidayDetailsModel";
import { initEmployeeLeaveBalanceDetails } from "./tools/hrmsTools/employeeLeaveBalanceModel";
import { initEmployeeAttendanceDetails } from "./tools/hrmsTools/employeeAttendanceModel";
import { initEmployeeLeaveRequestDetails } from "./tools/hrmsTools/employeeLeaveRequestModel";
import { initHrmsEmailLogs } from "./tools/hrmsTools/hrmsEmailLogsModel";
import { initHrmsNotificationLogs } from "./tools/hrmsTools/hrmsNotificationModel";
import { initEmployeeExtraWorkDay } from "./tools/hrmsTools/employee_extra_work_day";
import { initEmployeePayslip } from "./tools/hrmsTools/Payroll/employeePayslipRecordsModel";
import { initEmployeePayslipItems } from "./tools/hrmsTools/Payroll/employeePayslipItemsModel";
import { initEmployeeComponentAdjustments } from "./tools/hrmsTools/Payroll/employeeComponentAdjustmentsModel";
import { initHrmsAccessRole } from "./tools/hrmsTools/HrmsAccess/hrms_access_role_model";
import { initHrmsAccessPermission } from "./tools/hrmsTools/HrmsAccess/hrms_access_permission_model";
import { initHrmsAccessRolePermission } from "./tools/hrmsTools/HrmsAccess/hrms_access_role_permission_model";
import { initHrmsEmployeeRole } from "./tools/hrmsTools/HrmsAccess/hrms_employee_role_model";
import { initEmployeeOffboarding } from "./tools/hrmsTools/employeeOffboarding/employee_offboarding_Model";
import { initRewardCycle } from "./tools/hrmsTools/rewards/rewardCycleModel";
import { initNomination } from "./tools/hrmsTools/rewards/nominationModel";
import { initGroupedCitation } from "./tools/hrmsTools/rewards/groupedCitationModel";
import { initVote } from "./tools/hrmsTools/rewards/voteModel";
import { initWinner } from "./tools/hrmsTools/rewards/winnerModel";
import { initPhaseAuditLog } from "./tools/hrmsTools/rewards/phaseAuditLogModel";
import { initSalaryCategories } from "./tools/hrmsTools/salaryConfigurator/salary_categories_model";
import { initSalaryComponents } from "./tools/hrmsTools/salaryConfigurator/salary_components_model";
import { DataTypes, Sequelize } from "sequelize";
import { initTmsUsers } from "./tools/tmsUsersModel";
import { initUamUserGroups } from "./tools/uam/uamUserGroupsModel";
import { initUamRequest } from "./tools/uam/uamRequestModel";
import { initUamToolsDetails } from "./tools/uam/uamToolDetailsModel";
import { initUamToolsUser } from "./tools/uam/uamToolUsersModel";
import { initImportantLinkList } from "./tools/hrRepository/importantLinkList";
import { initPolicyList } from "./tools/hrRepository/policyList";
import { initAllCountryDetails } from "./platform/regionalSettings/allCountryDetailsModel";
import { initConfigureSecondaryLocation } from "./tools/hrmsTools/secondaryLocation/configureSecondaryLocationModel";
import { initConfigEmployeeType } from "./tools/hrmsTools/secondaryLocation/configEmployeeTypeModel";
import { initSecondaryLocationLog } from "./tools/hrmsTools/secondaryLocation/secondaryLocationLogModel";
import { initSecondaryLocationRequest } from "./tools/hrmsTools/secondaryLocation/secondaryLocationRequestsModel";


export function initializeHrmsModels(dbOutput: any, outputSequelize: Sequelize, dataTypes: typeof DataTypes) {
  // Initialize HRMS models here
  dbOutput.employeeComponentConfigurator = initEmployeeComponentConfigurator(outputSequelize, dataTypes);
  dbOutput.employeeAddressDetails = initEmployeeAddressDetails(outputSequelize, dataTypes);
  dbOutput.employeeAdvanceSalaryDetailHistory = initEmployeeAdvanceSalaryDetailHistory(outputSequelize, dataTypes);
  dbOutput.employeeAdvanceSalaryDetails = initEmployeeAdvanceSalaryDetails(outputSequelize, dataTypes);
  dbOutput.employeeBankAccountDetails = initEmployeeBankAccountDetails(outputSequelize, dataTypes);
  dbOutput.employeeBankAccountDetailHistory = initEmployeeBankAccountDetailHistory(outputSequelize, dataTypes);
  dbOutput.employeeBasicDetails = initEmployeeBasicDetails(outputSequelize, dataTypes);
  dbOutput.employeeContactDetails = initEmployeeContactDetails(outputSequelize, dataTypes);
  dbOutput.employeeJobDetailHistory = initEmployeeJobDetailHistory(outputSequelize, dataTypes);
  dbOutput.employeeJobDetails = initEmployeeJobDetails(outputSequelize, dataTypes);
  dbOutput.employeeLoginHistory = initEmployeeLoginHistory(outputSequelize, dataTypes);
  dbOutput.employeeSalaryDetailHistory = initEmployeeSalaryDetailHistory(outputSequelize, dataTypes);
  dbOutput.employeeSalaryDetails = initEmployeeSalaryDetails(outputSequelize, dataTypes);
  dbOutput.employmentHistory = initEmploymentHistory(outputSequelize, dataTypes);
  dbOutput.employeeDataRequest = initEmployeeDataRequest(outputSequelize, dataTypes);

  dbOutput.employeeLeaveConfigurator = initEmployeeLeaveConfigurator(outputSequelize, dataTypes);
  dbOutput.employeeHolidayDetails = initEmployeeHolidayDetails(outputSequelize, dataTypes);
  dbOutput.employeeLeaveBalanceDetails = initEmployeeLeaveBalanceDetails(outputSequelize, dataTypes);
  dbOutput.employeeAttendanceDetails = initEmployeeAttendanceDetails(outputSequelize, dataTypes);
  dbOutput.employeeLeaveRequestDetails = initEmployeeLeaveRequestDetails(outputSequelize, dataTypes);
  dbOutput.hrmsEmailLogs = initHrmsEmailLogs(outputSequelize, dataTypes);
  dbOutput.hrmsNotificationLogs = initHrmsNotificationLogs(outputSequelize, dataTypes);
  dbOutput.employeeExtraWorkDay = initEmployeeExtraWorkDay(outputSequelize, dataTypes);

  //salary Configurator and Components
  dbOutput.salaryCategories = initSalaryCategories(outputSequelize, dataTypes);
  dbOutput.salaryComponents = initSalaryComponents(outputSequelize, dataTypes);

  //Payroll related models
  dbOutput.employeePayslipRecords = initEmployeePayslip(outputSequelize, dataTypes);
  dbOutput.employeePayslipItems = initEmployeePayslipItems(outputSequelize, dataTypes);
  dbOutput.employeeComponentAdjustments = initEmployeeComponentAdjustments(outputSequelize, dataTypes);

  //HRMS Access Management Models
  dbOutput.hrmsAccessRole = initHrmsAccessRole(outputSequelize, dataTypes);
  dbOutput.hrmsAccessPermission = initHrmsAccessPermission(outputSequelize, dataTypes);
  dbOutput.hrmsAccessRolePermission = initHrmsAccessRolePermission(outputSequelize, dataTypes);
  dbOutput.hrmsEmployeeRole = initHrmsEmployeeRole(outputSequelize, dataTypes);
  dbOutput.employeePayslips = initEmployeePayslipItems(outputSequelize, dataTypes);

  //HRMS Offboarding Models
  dbOutput.employeeOffboarding = initEmployeeOffboarding(outputSequelize, dataTypes);

  // Rewards & Recognition Models
  dbOutput.rewardCycle = initRewardCycle(outputSequelize, dataTypes);
  dbOutput.nomination = initNomination(outputSequelize, dataTypes);
  dbOutput.groupedCitation = initGroupedCitation(outputSequelize, dataTypes);
  dbOutput.vote = initVote(outputSequelize, dataTypes);
  dbOutput.winner = initWinner(outputSequelize, dataTypes);
  dbOutput.phaseAuditLog = initPhaseAuditLog(outputSequelize, dataTypes);

  // Shared accross HRMS and Mittarv
  dbOutput.tmsUsers = initTmsUsers(outputSequelize, dataTypes);
  dbOutput.uamUserGroups = initUamUserGroups(outputSequelize, dataTypes);
  dbOutput.uamRequest = initUamRequest(outputSequelize, dataTypes);
  dbOutput.uamToolDetails = initUamToolsDetails(outputSequelize, dataTypes);
  dbOutput.uamToolUsers = initUamToolsUser(outputSequelize, dataTypes);
  dbOutput.importantLinkList = initImportantLinkList(outputSequelize, dataTypes);
  dbOutput.policyList = initPolicyList(outputSequelize, dataTypes);

  // ====================================partner feature tool models ============================================================
dbOutput.allCountryDetails = initAllCountryDetails(outputSequelize, DataTypes);

  // Secondary Location models
  dbOutput.configureSecondaryLocation = initConfigureSecondaryLocation(outputSequelize, dataTypes);
  dbOutput.configEmployeeType = initConfigEmployeeType(outputSequelize, dataTypes);
  dbOutput.secondaryLocationLog = initSecondaryLocationLog(outputSequelize, dataTypes);
  dbOutput.secondaryLocationRequest = initSecondaryLocationRequest(outputSequelize, dataTypes);
}