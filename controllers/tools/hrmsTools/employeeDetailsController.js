const { outputSequelize, dbOutput, Op, db } = require("../../../models/index");
// const { attribute } = require("../../../test/mockData/platform/userMockData");
const { createUUIDV4 } = require("../../../utilities/uuidV4Generator");
import { 
  sendOnboardingEmail, 
  sendEmployeePersonalDetailsUpdateMail,
  sendPersonalDetailsApprovedMail,
  sendPersonalDetailsRejectedMail,
} from "../../../middlewares/sendHrmsEmail";
import { fetchEmployeeCurrentJobDetails, getEmployeeDetailsMailRecipients } from "../../../utilities/hrmsUtilities/dbCalls";
import { createHRMSNotification } from "../../../utilities/hrmsUtilities/dbCalls";
import { hrmsNotificationTypes } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import { generateUpdateMessage, updateEmployeeLeaveBalanceOnTypeChange, filterUpcomingBirthdays, filterWorkAnniversariesByConversionDate } from "../../../utilities/hrmsUtilities/helperFunctions";
const { checkHrmsPermission } = require("../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices");
import { offboardingStatus } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
const EmployeeBasicDetails = dbOutput.employeeBasicDetails;
const EmployeeContactDetails = dbOutput.employeeContactDetails;
const EmployeeJobDetails = dbOutput.employeeJobDetails;
const EmployeeJobDetailHistory = dbOutput.employeeJobDetailHistory;
const EmployeeSalaryDetails = dbOutput.employeeSalaryDetails;
const EmployeeSalaryDetailHistory = dbOutput.employeeSalaryDetailHistory;
const EmployeeAddressDetails = dbOutput.employeeAddressDetails;
const EmployeeBankAccountDetails = dbOutput.employeeBankAccountDetails;
const EmployeeBankAccountDetailHistory = dbOutput.employeeBankAccountDetailHistory;
const EmployeeAdvanceSalaryDetails = dbOutput.employeeAdvanceSalaryDetails;
const EmployeeAdvanceSalaryDetailHistory = dbOutput.employeeAdvanceSalaryDetailHistory;
const EmploymentHistory = dbOutput.employmentHistory;
const EmployeeLoginHistory = dbOutput.employeeLoginHistory;
const EmployeeDataRequest = dbOutput.employeeDataRequest;
const hrmsEmployeeRole = dbOutput.hrmsEmployeeRole;
const hrmsAccessRole = dbOutput.hrmsAccessRole;
const EmployeeOffboarding = dbOutput.employeeOffboarding;
const Winner = dbOutput.winner;
const RewardCycle = dbOutput.rewardCycle;
const TmsUsers = dbOutput.tmsUsers;
const { reconcilePayrollForEmployees } = require("./PayrollController");

const tableToFieldsMap = {
  EmployeeBasicDetails: [
    "empCompanyId", "empFirstName", "empLastName", "empDob", "empGender", 
    "empBloodGroup", "empFatherName", "empMotherName", "empMaritalStatus", 
    "empGovId", "empHireDate", "isManager", "isLead", "empLastLogin", 
    "empPanCard", "empNationality"
  ],
  EmployeeContactDetails: [
    "empPersonalPhone", "empPersonalEmail", "empOfficialPhone", 
    "empOfficialEmail", "empEmergencyContactName", "empEmergencyContactNumber", 
    "empEmergencyContactRelation"
  ],
  EmployeeJobDetails: [
    "empType", "empDepartment", "empTitle", "empLevel", "empManager", 
    "lastDate", "empConversionDate","empYearOfStudy"
  ],
  EmployeeSalaryDetails: [
    "empAnnualSalary", "empMonthlySalary", "empNumberOfBonuses","empPaymentCountryCode"
  ],
  EmployeeAdvanceSalaryDetails: [
    "empCurrentAdvanceSalaryAmount", "empCurrentAdvanceSalaryEmi", "empPaymentCountryCode"
  ],
  EmployeeBankAccountDetails: [
    "empIFSCCode", "empAccountNumber", "empBenefeciaryName", "empAccType", "empUanNumber"
  ],
  EmployeeAddressDetails: [
    "addressType", "addressLine1", "addressLine2", "addressLine3", 
    "city", "pin", "state", "country", "TerminationDate",
    "secondaryLocation", "isSecondarySameAsPrimary"
  ],
  EmploymentHistory: [
    "empStartDate", "empEndDate", "updatedBy"
  ],
  EmployeeLoginHistory: [
    "loginTimeStamp", "isDeleted"
  ]
};

const formatWorkLocation = (locationKey) => {
  if (!locationKey) {
    return null;
  }

  const parts = String(locationKey).split("_");
  if (parts.length <= 1) {
    return locationKey;
  }

  return parts
    .slice(0, -1)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};


exports.createEmployeeData = async (req, res) => {
  const { user } = req;
  const toolsAccess = user?.toolsAccess || {};
  const toolName = "HR Repository";
  const employeeUuid = req.body?.employeeUuid || user?.employeeUuid;

  // Check permission: admin access (>= 900) OR ActiveEmployee_onBoarding permission
  const hasPermission = await checkHrmsPermission(
    employeeUuid,
    "ActiveEmployee_onBoarding",
    toolName,
    toolsAccess
  );

  if (!hasPermission) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to onboard employee",
    });
  }

  const {
    emp_type,
    emp_first_name,
    emp_last_name,
    emp_official_email,
    emp_company_id,
    emp_isManger,
    emp_latest_hire_date,
    emp_job_title,
    emp_department,
    emp_reporting_manager,
    emp_latest_annual_salary,
    emp_latest_location_state,
    emp_level,
    emp_salary_iso_code,
    emp_year_of_study,
  } = req.body;
  if (
    !emp_company_id ||
    !emp_type ||
    !emp_first_name ||
    !emp_official_email ||
    !emp_latest_location_state ||
    !emp_salary_iso_code || !emp_job_title || !emp_department
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide all required fields" });
  }

  // A super admin without an employee profile is completing their own first
  // onboarding. The email must remain the authenticated TMS email so the HRMS
  // profile can be resolved on later requests.
  const isInitialAdminSelfOnboarding =
    user?.userType === 900 && !user?.employeeUuid;
  if (
    isInitialAdminSelfOnboarding &&
    user?.email?.toLowerCase() !== emp_official_email.toLowerCase()
  ) {
    return res.status(400).json({
      success: false,
      message: "Use your signed-in TMS email to create your admin profile",
    });
  }

  // Start a transaction
  const transaction = await outputSequelize.transaction();

  try {
    const existingEmployee = await EmployeeContactDetails.findAll({
      where: {
        empOfficialEmail: emp_official_email,
      },
    });
    if (existingEmployee.length !== 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Employee already exists" });
    }
    let employeeUuid = await createUUIDV4();
    let contactId = await createUUIDV4();
    let jobId = await createUUIDV4();
    let salaryId = await createUUIDV4();
    let accountId = await createUUIDV4();
    let addressId = await createUUIDV4();
    let empHistoryId = await createUUIDV4();
    let loginId = await createUUIDV4();
    let advanceSalaryId = await createUUIDV4();
    let jobHistoryId = await createUUIDV4();
    let salaryHistoryId = await createUUIDV4();
    let advanceSalaryHistoryId = await createUUIDV4();
    let bankAccountHistoryId = await createUUIDV4();
    let currentTimeStamp = new Date();

    await EmployeeBasicDetails.create({
      empUuid: employeeUuid,
      isManager: emp_isManger,
      empFirstName: emp_first_name,
      empLastName: emp_last_name,
      empHireDate: emp_latest_hire_date,
      empCompanyId: emp_company_id,
    }, { transaction });

    await EmployeeContactDetails.create({
      contactId: contactId,
      empOfficialEmail: emp_official_email,
      empUuid: employeeUuid,
    }, { transaction });

    await EmployeeJobDetails.create({
      jobId: jobId,
      empType: emp_type,
      empTitle: emp_job_title,
      empLevel: emp_level,
      empDepartment: emp_department,
      empManager: emp_reporting_manager || null,
      empUuid: employeeUuid,
      empConversionDate: emp_latest_hire_date,
      effectiveDate: currentTimeStamp,
      empYearOfStudy: emp_year_of_study,
    }, { transaction });

    await EmployeeJobDetailHistory.create({
      jobHistoryId: jobHistoryId,
      jobId: jobId,
      empType: emp_type,
      empTitle: emp_job_title,
      empLevel: emp_level,
      empDepartment: emp_department,
      empManager: emp_reporting_manager || null,
      empUuid: employeeUuid,
      empConversionDate: emp_latest_hire_date,
      effectiveDate: currentTimeStamp,
      empYearOfStudy: emp_year_of_study,
    }, { transaction });
    
    await EmployeeSalaryDetails.create({
      salaryId: salaryId,
      empAnnualSalary: emp_latest_annual_salary,
      empMonthlySalary: emp_latest_annual_salary / 12,
      empUuid: employeeUuid,
      effectiveDate: currentTimeStamp,
      empPaymentCountryCode:emp_salary_iso_code
    }, { transaction });

    await EmployeeSalaryDetailHistory.create({
      salaryHistoryId: salaryHistoryId,
      salaryId: salaryId,
      empAnnualSalary: emp_latest_annual_salary,
      empMonthlySalary: emp_latest_annual_salary / 12,
      empUuid: employeeUuid,
      effectiveDate: currentTimeStamp,
      empPaymentCountryCode:emp_salary_iso_code
    }, { transaction });

    await EmployeeBankAccountDetails.create({
      accountId: accountId,
      empUuid: employeeUuid,
      effectiveDate: currentTimeStamp,
    }, { transaction });

    await EmployeeBankAccountDetailHistory.create({
      bankAccountHistoryId: bankAccountHistoryId,
      accountId: accountId,
      empUuid: employeeUuid,
      effectiveDate: currentTimeStamp,
    }, { transaction });

    await EmployeeAdvanceSalaryDetails.create({
      advanceSalaryId: advanceSalaryId,
      empUuid: employeeUuid,
      effectiveDate: currentTimeStamp,
      empPaymentCountryCode:emp_salary_iso_code
    }, { transaction });

    await EmployeeAdvanceSalaryDetailHistory.create({
      advanceSalaryHistoryId: advanceSalaryHistoryId,
      advanceSalaryId: advanceSalaryId,
      empUuid: employeeUuid,
      effectiveDate: currentTimeStamp,
      empPaymentCountryCode:emp_salary_iso_code
    }, { transaction });

    await EmployeeAddressDetails.create({
      addressId: addressId,
      empUuid: employeeUuid,
      state: emp_latest_location_state,
      effectiveDate: currentTimeStamp,
    }, { transaction });

    await EmploymentHistory.create({
      empHistoryId: empHistoryId,
      empUuid: employeeUuid,
    }, { transaction });

    await EmployeeLoginHistory.create({
      loginId: loginId,
      empUuid: employeeUuid,
      employmentStartDate: emp_latest_hire_date,
    }, { transaction });

    // An organization admin creates their own employee profile through this
    // onboarding form. Assign the HRMS role only after the submitted profile
    // exists, so profile data is never replaced by login-time placeholders.
    const isSelfOnboardingAdmin =
      isInitialAdminSelfOnboarding &&
      user?.email?.toLowerCase() === emp_official_email?.toLowerCase();
    if (isSelfOnboardingAdmin) {
      const superAdminRole = await hrmsAccessRole.findOne({
        where: { roleName: "Super Admin", isDeleted: false },
        transaction,
      });

      if (superAdminRole) {
        await hrmsEmployeeRole.findOrCreate({
          where: {
            empUuid: employeeUuid,
            roleId: superAdminRole.roleId,
            isDeleted: false,
          },
          defaults: {
            empUuid: employeeUuid,
            roleId: superAdminRole.roleId,
            assignedBy: employeeUuid,
            isDeleted: false,
          },
          transaction,
        });
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Employee data created successfully",
      employeeUuid,
    });

    // Send onboarding email asynchronously (non-blocking)
    (async () => {
      try {
        await sendOnboardingEmail(emp_official_email, employeeUuid);
      } catch (emailError) {
        console.error("Error sending onboarding email:", emailError);
      }
    })();
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

// Function to fetch employee details by employee UUID
exports.getEmployeeDetailsByUuid = async (req, res) => {
  try {
    // Extract the employee UUID from the request parameters
    const empUuid = req.params.empUuid;

    if (!empUuid) {
      return res.status(400).json({ success: false, message: "Employee UUID is required" });
    }

    // Permission check: user must be viewing their own profile, or have admin access, or have required HRMS permissions
    const { toolsAccess, employeeUuid: loggedInEmployeeUuid } = req.user;
    const toolName = "HR Repository";
    const isOwnProfile = loggedInEmployeeUuid === empUuid;

    if (!isOwnProfile && req.user.userType !== 900) {
      const hasPermission = await checkHrmsPermission(
        loggedInEmployeeUuid,
        [
          "ActiveEmployee_read",
          "ActiveEmployee_update",
          "ActiveEmployee_onBoarding",
          "EmployeeDirectoryAdmin_View",
          "Offboarding_View",
          "Offboarding_Initiate",
          "Offboarding_HR_Clearance",
          "Offboarding_Finance_Clearance",
          "Offboarding_Approve",
          "View_Offboarded_Employees",
          "LeaveAttendance_write",
          "LeaveAttendanceAdmin_read",
        ],
        toolName,
        toolsAccess
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view this employee's details",
        });
      }
    }

    // Fetch the employee's basic details
    const employeeBasicDetails = await EmployeeBasicDetails.findOne({ where: { empUuid } });
    if (!employeeBasicDetails) {
      return res.status(404).json({ success: false, message: "Employee basic details not found" });
    }

    // Fetch the employee's contact details
    const employeeContactDetails = await EmployeeContactDetails.findOne({ where: { empUuid } });
    if (!employeeContactDetails) {
      return res.status(404).json({ success: false, message: "Employee contact details not found" });
    }

    // Fetch the employee's job details
    const employeeLatestJobDetails = await EmployeeJobDetails.findOne({ where: { empUuid } });
    if (!employeeLatestJobDetails) {
      return res.status(404).json({ success: false, message: "Employee job details not found" });
    }
    
    // Fetch the employee's earliest job details
    // This will help in getting the job details as of the current date
    // job details might have conversion date in future so we need to get the job detail whose conversion date is earliest and less than current date
    const employeeCurrentJobDetails = await fetchEmployeeCurrentJobDetails(empUuid);

    // Fetch the employee's salary details
    const employeeSalaryDetails = await EmployeeSalaryDetails.findOne({ where: { empUuid } });

    // Fetch the employee's address details
    const employeeAddressDetails = await EmployeeAddressDetails.findOne({ where: { empUuid } });

    // Fetch the employee's bank account details
    const employeeBankDetails = await EmployeeBankAccountDetails.findOne({ where: { empUuid } });

    // Fetch the employee's advance salary details
    const employeeAdvanceSalaryDetails = await EmployeeAdvanceSalaryDetails.findOne({ where: { empUuid } });

    // Fetch the employee's offboarding details
    const employeeOffboardingDetails = await EmployeeOffboarding.findOne({
      where: { empUuid }, 
      attributes:['hrClearanceStatus', 'financeClearanceStatus', 'lastWorkingDay', 'offboardingStatus'],
      raw: true,
    });


    // Tms user details
    let tmsUserDetails = null;
    if (employeeContactDetails?.empOfficialEmail) {
      tmsUserDetails = await TmsUsers.findOne(
        {where: {email: employeeContactDetails.empOfficialEmail}}
      );
    }

    // Tms user profile image
    const tmsUserProfileImage = tmsUserDetails?.profilePic;

    // Fetch employee's award history (all past awards)
    let employeeAwards = [];
    let currentWinnerStatus = null;
    try {
      if (Winner && RewardCycle) {
        // Get all awards for this employee
        const awards = await Winner.findAll({
          where: { employeeEmpUuid: empUuid },
          include: [{ model: RewardCycle, as: "cycle", attributes: ["id", "month", "year", "currentPhase"] }],
          order: [["createdAt", "DESC"]],
        });
        employeeAwards = awards.map((a) => a.get({ plain: true }));

        // Determine current winner status (for dashboard banner)
        // Show banner if:
        // 1. Current cycle is in PENDING or WINNERS phase
        // 2. Employee is a winner for a cycle that's in WINNERS phase, OR
        //    Employee is a winner for the previous cycle and current cycle is still PENDING
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Find the current cycle
        const currentCycle = await RewardCycle.findOne({
          where: { month: currentMonth, year: currentYear },
        });

        if (currentCycle) {
          const currentPhase = currentCycle.currentPhase;
          
          // If current cycle is in WINNERS phase, check if this employee is a winner for this cycle
          if (currentPhase === "winners") {
            const currentWins = awards.filter((a) => a.cycleId === currentCycle.id);
            if (currentWins.length > 0) {
              currentWinnerStatus = {
                month: currentMonth,
                year: currentYear,
                awards: currentWins.map((w) => ({
                  awardType: w.awardType,
                  finalCitation: w.finalCitation,
                  voteCount: w.voteCount,
                })),
              };
            }
          }
          // If current cycle is PENDING, check if employee won in the previous cycle
          else if (currentPhase === "pending") {
            const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
            const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
            
            const prevCycle = await RewardCycle.findOne({
              where: { month: prevMonth, year: prevYear },
            });
            
            if (prevCycle && prevCycle.currentPhase === "winners") {
              const prevWins = awards.filter((a) => a.cycleId === prevCycle.id);
              if (prevWins.length > 0) {
                currentWinnerStatus = {
                  month: prevMonth,
                  year: prevYear,
                  awards: prevWins.map((w) => ({
                    awardType: w.awardType,
                    finalCitation: w.finalCitation,
                    voteCount: w.voteCount,
                  })),
                };
              }
            }
          }
        }
      }
    } catch (awardError) {
      console.error("Error fetching employee awards:", awardError);
      // Continue without awards data - don't fail the entire request
    }

    // successful response with the fetched data
    return res.status(200).json({
      success: true,
      message: "Employee details fetched successfully",
      employeeBasicDetails,
      employeeContactDetails,
      employeeLatestJobDetails,
      employeeCurrentJobDetails,
      employeeSalaryDetails,
      employeeAddressDetails,
      employeeBankDetails,
      employeeAdvanceSalaryDetails,
      employeeProfileImage : tmsUserProfileImage || null,
      employeeOffboardingDetails: employeeOffboardingDetails || {},
      employeeAwards,
      currentWinnerStatus,
    });

  } catch (error) {
    console.error("Error fetching employee details: ", error);

    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching employee details",
      error: error.message,
    });
  }
};

// Function to fetch employee directory card details by employee UUID
exports.getEmployeeDirectoryDetailsByUuid = async (req, res) => {
  try {
    const empUuid = req.params.empUuid;

    if (!empUuid) {
      return res.status(400).json({ success: false, message: "Employee UUID is required" });
    }

    const { toolsAccess, employeeUuid: loggedInEmployeeUuid } = req.user;
    const toolName = "HR Repository";

    const hasDirectoryAdminAccess = await checkHrmsPermission(
      loggedInEmployeeUuid,
      "EmployeeDirectoryAdmin_View",
      toolName,
      toolsAccess
    );

    const employeeBasicDetails = await EmployeeBasicDetails.findOne({
      where: { empUuid },
      attributes: ["empUuid", "empFirstName", "empLastName", "empHireDate", "empCompanyId"],
      raw: true,
    });

    if (!employeeBasicDetails) {
      return res.status(404).json({ success: false, message: "Employee basic details not found" });
    }

    const employeeContactDetails = await EmployeeContactDetails.findOne({
      where: { empUuid },
      attributes: ["empOfficialPhone", "empOfficialEmail"],
      raw: true,
    });

    const employeeCurrentJobDetails = await fetchEmployeeCurrentJobDetails(empUuid);

    const employeeAddressDetails = await EmployeeAddressDetails.findOne({
      where: { empUuid },
      attributes: ["state"],
      raw: true,
    });

    let reportingManager = null;
    if (hasDirectoryAdminAccess && employeeCurrentJobDetails?.empManager) {
      const managerDetails = await EmployeeBasicDetails.findOne({
        where: { empUuid: employeeCurrentJobDetails.empManager },
        attributes: ["empUuid", "empFirstName", "empLastName"],
        raw: true,
      });

      if (managerDetails) {
        reportingManager = {
          empUuid: managerDetails.empUuid,
          name: `${managerDetails.empFirstName || ""} ${managerDetails.empLastName || ""}`.trim() || null,
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: "Employee directory details fetched successfully",
      employeeDirectoryDetails: {
        employeeUuid: empUuid,
        employeeName: `${employeeBasicDetails.empFirstName || ""} ${employeeBasicDetails.empLastName || ""}`.trim() || null,
        workLocation: formatWorkLocation(employeeAddressDetails?.state),
        hiringDate: employeeBasicDetails.empHireDate || null,
        phone: employeeContactDetails?.empOfficialPhone || null,
        emailId: employeeContactDetails?.empOfficialEmail || null,
        employeeId: hasDirectoryAdminAccess ? employeeBasicDetails.empCompanyId || null : null,
        reportingManager,
        canViewSensitiveFields: hasDirectoryAdminAccess,
      },
    });
  } catch (error) {
    console.error("Error fetching employee directory details:", error);

    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching employee directory details",
      error: error.message,
    });
  }
};

// Function to fetch all employee details
exports.getAllEmployees = async (req, res) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) {
      return res.status(400).json({ success: false, message: "Employee UUID is required to fetch directory" });
    }

    // Determine the user's organization (tenantId)
    const callerBasicDetails = await EmployeeBasicDetails.findOne({
      where: { empUuid: employeeUuid, isDeleted: false }
    });

    if (!callerBasicDetails || !callerBasicDetails.empCompanyId) {
      return res.status(403).json({ success: false, message: "You must belong to an organization to view employees" });
    }

    const tenantId = callerBasicDetails.empCompanyId;

    // Fetch all employee UUIDs within the SAME organization
    const employeeUuids = await EmployeeBasicDetails.findAll({
      where: { isDeleted: false, isActive: true, empCompanyId: tenantId },
      attributes: ['empUuid']
    });

    // Fetch the employee details for each employee UUID
    const employeeDetailsPromises = employeeUuids.map(async (employee) => {
      const empUuid = employee.dataValues.empUuid; // Extract empUuid from the Sequelize instance

      // Fetch the employee's first name, last name, job type, and department
      const employeeBasicDetails = await EmployeeBasicDetails.findOne({
        attributes: ['empFirstName', 'empLastName', 'createdAt', "isActive"],
        where: { empUuid: empUuid },
      });

      const employeeCurrentJobDetails = await fetchEmployeeCurrentJobDetails(empUuid);

      // Fetch the employee's contact details
      const employeeContactDetails = await EmployeeContactDetails.findOne({ where: { empUuid } });

      // Tms user details
      let tmsUserDetails = null;
      if (employeeContactDetails?.empOfficialEmail) {
        tmsUserDetails = await TmsUsers.findOne(
          {where: {email: employeeContactDetails.empOfficialEmail}}
        );
      }

      // Tms user profile image
      const employeeProfileImage = tmsUserDetails?.profilePic;

      const employeeHrmsRoleDetails = await hrmsEmployeeRole.findOne({ 
        where: { empUuid: empUuid, isDeleted: false },
        include: [
          {
            model: hrmsAccessRole,
            as: 'role',
            attributes: ['roleId', 'roleName', 'description'],
            where: {
              isDeleted: false,
            },
          }
        ]
      });

      // Offboarding: null if not initiated, otherwise the current offboarding status
      const offboardingRecord = await EmployeeOffboarding.findOne({
        where: { empUuid, isDeleted: false },
        attributes: ['offboardingStatus'],
        order: [['createdAt', 'DESC']],
        raw: true,
      });

      const offboarding_status = offboardingRecord ? offboardingRecord.offboardingStatus : offboardingStatus.NOT_INITIATED;

      return {
        employeeUuid: empUuid,
        employeeFirstName: employeeBasicDetails ? employeeBasicDetails.empFirstName : null,
        employeeLastName: employeeBasicDetails ? employeeBasicDetails.empLastName : null,
        employeeJobType: employeeCurrentJobDetails ? employeeCurrentJobDetails.empType : null,
        employeeDepartment: employeeCurrentJobDetails ? employeeCurrentJobDetails.empDepartment : null,
        employeeProfileImage: employeeProfileImage || null,
        employeeOfficialEmail: employeeContactDetails ? employeeContactDetails.empOfficialEmail : null,
        employeeAddedOn: employeeBasicDetails ? employeeBasicDetails.createdAt : null,
        employeeHrmsRoleDetails: employeeHrmsRoleDetails ? employeeHrmsRoleDetails.role : null,
        employeeIsActive: employeeBasicDetails ? employeeBasicDetails.isActive : null,
        offboarding_status,
      };
    });

    const allEmployeeDetails = await Promise.all(employeeDetailsPromises);

    // Return the fetched employee details
    res.status(200).json({
      success: true,
      message: "Employee details fetched successfully",
      allEmployeeDetails,
    });
  } catch (error) {
    // Return an error response in case of any issues
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Function to update employee details by employee UUID
exports.updateEmployeeDetailsByUuid = async (req, res) => {
  const { user } = req;
  const toolsAccess = user?.toolsAccess || {};
  const toolName = "HR Repository";
  const employeeUuid = user?.employeeUuid;
  const targetEmployeeUuid = req.params.empUuid;

  // Allow users to update their own details without permission check
  const isUpdatingOwnProfile = employeeUuid && targetEmployeeUuid && employeeUuid === targetEmployeeUuid;

  // If not updating own profile, check permission: admin access (>= 900) OR ActiveEmployee_update permission
  if (!isUpdatingOwnProfile) {
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "ActiveEmployee_update",
      toolName,
      toolsAccess
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update employee details",
      });
    }
  }

  // Map table names to their corresponding fields
  const tableToFieldsMap = {
    EmployeeBasicDetails: [
      "empCompanyId", "empFirstName", "empLastName", "empDob", "empGender", 
      "empBloodGroup", "empFatherName", "empMotherName", "empMaritalStatus", 
      "empGovId", "empHireDate", "isManager", "isLead", "empLastLogin", 
      "empPanCard", "empNationality"
    ],
    EmployeeContactDetails: [
      "empPersonalPhone", "empPersonalEmail", "empOfficialPhone", 
      "empOfficialEmail", "empEmergencyContactName", "empEmergencyContactNumber", 
      "empEmergencyContactRelation"
    ],
    EmployeeJobDetails: [
      "empType", "empDepartment", "empTitle", "empLevel", "empManager", 
      "lastDate", "empConversionDate", "empYearOfStudy"
    ],
    EmployeeSalaryDetails: [
      "empAnnualSalary", "empMonthlySalary", "empNumberOfBonuses","empPaymentCountryCode"
    ],
    EmployeeAdvanceSalaryDetails: [
      "empCurrentAdvanceSalaryAmount", "empCurrentAdvanceSalaryEmi", "empPaymentCountryCode"
    ],
    EmployeeBankAccountDetails: [
      "empIFSCCode", "empAccountNumber", "empBenefeciaryName", "empAccType", "empUanNumber"
    ],
    EmployeeAddressDetails: [
      "addressType", "addressLine1", "addressLine2", "addressLine3", 
      "city", "pin", "state", "country", "TerminationDate",
      "secondaryLocation", "isSecondarySameAsPrimary"
    ],
    EmploymentHistory: [
      "empStartDate", "empEndDate", "updatedBy"
    ],
    EmployeeLoginHistory: [
      "loginTimeStamp", "isDeleted"
    ]
  };
  
  // Map field names to their corresponding table names
  const fieldToTableMap = Object.entries(tableToFieldsMap).reduce((map, [table, fields]) => {
    fields.forEach(field => {
      map[field] = table;
    });
    return map;
  }, {});

  // Added transaction to avoid partial updates
  // Start a transaction
  const transaction = await outputSequelize.transaction();

  try {
    const updatedEmployeeInfo = req.body;
    const employeeUuid = req.params.empUuid;

    // Check if the employee UUID is provided
    if (!employeeUuid) {
      return res.status(400).json({ success: false, message: "Employee UUID is required" });
    }

    // Check if the updated employee details are provided
    if (!updatedEmployeeInfo) {
      return res.status(400).json({ success: false, message: "Employee details are required" });
    }

    // Check if the updated employee details are empty
    if (Object.keys(updatedEmployeeInfo).length === 0) {
      return res.status(400).json({ success: false, message: "No employee details provided for update" });
    }

    // Initialize the update objects for each table
    const employeeBasicDetailUpdates = {};
    const employeeContactDetailUpdates = {};
    const employeeJobDetailUpdates = {};
    const employeeSalaryDetailUpdates = {};
    const employeeAdvanceSalaryDetailUpdates = {};
    const employeeBankAccountDetailUpdates = {};
    const employeeAddressDetailUpdates = {};
    const employmentHistoryUpdates = {};
    const employeeLoginHistoryUpdates = {};

    // Iterate through the updated employee details and map them to the respective table objects
    for (const [field, rawValue] of Object.entries(updatedEmployeeInfo)) {
      const value = (field === 'empManager' || field === 'updatedBy') && rawValue === "" ? null : rawValue;
      switch (fieldToTableMap[field]) {
        case "EmployeeBasicDetails":
          employeeBasicDetailUpdates[field] = value;
          break;
        case "EmployeeContactDetails":
          employeeContactDetailUpdates[field] = value;
          break;
        case "EmployeeJobDetails":
          employeeJobDetailUpdates[field] = value;
          break;
        case "EmployeeSalaryDetails":
          employeeSalaryDetailUpdates[field] = value;
          break;
        case "EmployeeAdvanceSalaryDetails":
          employeeAdvanceSalaryDetailUpdates[field] = value;
          break;
        case "EmployeeBankAccountDetails":
          employeeBankAccountDetailUpdates[field] = value;
          break;
        case "EmployeeAddressDetails":
          employeeAddressDetailUpdates[field] = value;
          break;
        case "EmploymentHistory":
          employmentHistoryUpdates[field] = value;
          break;
        case "EmployeeLoginHistory":
          employeeLoginHistoryUpdates[field] = value;
          break;
        default:
          break;
      }
    }

    // Update the employee basic details
    if (Object.keys(employeeBasicDetailUpdates).length > 0) {
      await EmployeeBasicDetails.update(employeeBasicDetailUpdates, {
        where: {empUuid: employeeUuid},
        transaction
      });
    } 

    // Update the employee contact details
    if (Object.keys(employeeContactDetailUpdates).length > 0) {
      await EmployeeContactDetails.update(employeeContactDetailUpdates, {
        where : {empUuid : employeeUuid},
        transaction
      });
    }

    // Update the employee job details and job detail history
    if (Object.keys(employeeJobDetailUpdates).length > 0) {
      // Set the effective date
      employeeJobDetailUpdates.effectiveDate = new Date();

      // Get the previous data
      const previousDataInstance = await EmployeeJobDetails.findOne({where: {empUuid: employeeUuid}})

      // Create a new history record
      const previousData = previousDataInstance.toJSON();
      previousData.jobHistoryId = await createUUIDV4();

      // Create a new job history record
      await EmployeeJobDetailHistory.create({...previousData, createdAt: new Date(), updatedAt: new Date()}, {
        where : {empUuid: employeeUuid},
        transaction
      });

      // Update the employee job details
      await EmployeeJobDetails.update(employeeJobDetailUpdates, {
        where : {empUuid: employeeUuid},
        transaction
      });
    }
    

    // Update the employee salary details and salary detail history
    if (Object.keys(employeeSalaryDetailUpdates).length > 0) {
      // Set the effective date
      employeeSalaryDetailUpdates.effectiveDate = new Date();

      // Get the previous data
      const previousDataInstance = await EmployeeSalaryDetails.findOne({where: {empUuid: employeeUuid}})

      // Create a new history record
      const previousData = previousDataInstance.toJSON();
      previousData.salaryHistoryId = await createUUIDV4();

      // Create a new salary history record
      await EmployeeSalaryDetailHistory.create({...previousData, createdAt: new Date(), updatedAt: new Date()}, {
        where : {empUuid: employeeUuid},
        transaction
      });

      // Update the employee salary details
      await EmployeeSalaryDetails.update(employeeSalaryDetailUpdates, {
        where : {empUuid: employeeUuid},
        transaction
      });
    }

    // Update the employee advance salary details and advance salary detail history
    if (Object.keys(employeeAdvanceSalaryDetailUpdates).length > 0) {
      // Set the effective date
      employeeAdvanceSalaryDetailUpdates.effectiveDate = new Date();

      // Get the previous data
      const previousDataInstance = await EmployeeAdvanceSalaryDetails.findOne({where: {empUuid: employeeUuid}});

      // Create a new history record
      const previousData = previousDataInstance.toJSON();
      previousData.advanceSalaryHistoryId = await createUUIDV4();

      // Create a new advance salary history record
      await EmployeeAdvanceSalaryDetailHistory.create({...previousData, createdAt: new Date(), updatedAt: new Date()}, {
        where : {empUuid: employeeUuid},
        transaction
      });

      // Update the employee advance salary details
      await EmployeeAdvanceSalaryDetails.update(employeeAdvanceSalaryDetailUpdates, {
        where : {empUuid: employeeUuid},
        transaction
      });
    }    

    // Update the employee bank account details and bank account detail history
    if (Object.keys(employeeBankAccountDetailUpdates).length > 0) {
      // Set the effective date
      employeeBankAccountDetailUpdates.effecTiveDate = new Date();

      // Get the previous data
      const previousDataInstance = await EmployeeBankAccountDetails.findOne({where: {empUuid: employeeUuid}});

      if (previousDataInstance) {
        // Create a new history record
        const previousData = previousDataInstance.toJSON();
        previousData.bankAccountHistoryId = await createUUIDV4();
        
        // Remove effecTiveDate since it does not exist in the history table
        delete previousData.effecTiveDate;
        delete previousData.effectiveDate;

        // Create a new bank account history record
        await EmployeeBankAccountDetailHistory.create({...previousData, createdAt: new Date(), updatedAt: new Date()}, {
          transaction
        });

        // Update the employee bank account details
        await EmployeeBankAccountDetails.update(employeeBankAccountDetailUpdates, {
          where : {empUuid: employeeUuid},
          transaction
        });
      } else {
        // If no previous record exists, create a new one
        employeeBankAccountDetailUpdates.accountId = await createUUIDV4();
        employeeBankAccountDetailUpdates.empUuid = employeeUuid;
        await EmployeeBankAccountDetails.create(employeeBankAccountDetailUpdates, { transaction });
        
        // And optionally create its history
        const historyData = { ...employeeBankAccountDetailUpdates };
        delete historyData.effecTiveDate;
        delete historyData.effectiveDate;
        historyData.bankAccountHistoryId = await createUUIDV4();
        
        await EmployeeBankAccountDetailHistory.create({...historyData, createdAt: new Date(), updatedAt: new Date()}, {
          transaction
        });
      }
    }

    // Update the employee address details
    if (Object.keys(employeeAddressDetailUpdates).length > 0) {
      // Set the effective date
      employeeAddressDetailUpdates.effectiveDate = new Date();

      // update the employee address details
      await EmployeeAddressDetails.update(employeeAddressDetailUpdates,{
        where : {empUuid: employeeUuid},
        transaction
      });
    }

    // Create a new employment history record
    if(Object.keys(employmentHistoryUpdates).length > 0) {
      await EmploymentHistory.create(employmentHistoryUpdates, {
        where : {empUuid: employeeUuid},
        transaction
      });
    }

    // Create a new employee login history record
    if(Object.keys(employeeLoginHistoryUpdates).length > 0) {
      await EmployeeLoginHistory.create(employeeLoginHistoryUpdates, {
        where : {empUuid: employeeUuid},
        transaction
      });
    } 
    

    // Commit the transaction if all update are successful
    await transaction.commit();
    return res.status(200).json({ success: true, message: "Employee details updated successfully" });
  } catch(error) {
    // Rollback the transaction if any update fails
    await transaction.rollback();
    console.error("Error during transaction: ", error);
    
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating employee details",
      error: error.message,
    });
  }
};


// Function to fetch all manager information
// This function fetches the UUID, first name, last name, and isManager status of all managers
// The isManager status is used to identify if the employee is a manager or not
// The isManager status is set to true for all managers

exports.getAllManagerInformation = async (req, res) => {
  try {
    const managerInfo = await EmployeeBasicDetails.findAll({
      attributes: ['empUuid', 'empFirstName', 'empLastName','isManager'],
      where: {
        isManager: true,
        isActive: true,
        isDeleted: false,
      }
    });
    // console.log(managerInfo);

    return res.status(200).json({
      success: true,
      message: "Manager information fetched successfully",
      managerInfo
    });
  } catch (error) {
    console.error("Error fetching manager information: ", error);

    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching manager information",
      error: error.message,
    });
  }
};

exports.getEmployeeDashboardDetails = async (req, res) => {
  const timezone = req.query.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  try {
    const now = new Date();  
    // Get today's date in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const today_date = formatter.format(now);

    // Extract month, day, and year from today's date for birthday/anniversary comparison
    const [year, month, day] = today_date.split('-');
    const todayMonth = parseInt(month);
    const todayDay = parseInt(day);
    const todayYear = parseInt(year);

    // Fetch all employees with their DOB (only non-null DOB values)
    const allEmployeesWithDob = await EmployeeBasicDetails.findAll({
      where: {
        empDob: { [Op.ne]: null },
        isDeleted: false,
        isActive: true 
      },
      attributes: ['empUuid', 'empFirstName', 'empLastName', 'empDob'],
      raw: true
    });

    // Filter employees whose birthdays fall within the remaining days of the current month
    const employeeBirthdayDetails = filterUpcomingBirthdays(allEmployeesWithDob, todayMonth, todayDay);

    // Work anniversaries: use employeejobdetails (conversion date) for active employees only.
    // Get active employee UUIDs from basic details.
    const activeEmployees = await EmployeeBasicDetails.findAll({
      where: { isDeleted: false, isActive: true },
      attributes: ['empUuid', 'empFirstName', 'empLastName'],
      raw: true
    });
    const activeUuidSet = new Set(activeEmployees.map((e) => e.empUuid));

    // Get job details with conversion date (latest per employee when multiple rows exist)
    const jobDetailsWithConversion = await EmployeeJobDetails.findAll({
      where: {
        empConversionDate: { [Op.ne]: null },
        isDeleted: false
      },
      attributes: ['empUuid', 'empConversionDate'],
      order: [['effectiveDate', 'DESC']],
      raw: true
    });

    // Merge: only active employees, with names from basic details; one row per empUuid
    const empUuidSeen = new Set();
    const employeesWithConversionDate = [];
    for (const j of jobDetailsWithConversion) {
      if (!activeUuidSet.has(j.empUuid) || empUuidSeen.has(j.empUuid)) continue;
      empUuidSeen.add(j.empUuid);
      const basic = activeEmployees.find((b) => b.empUuid === j.empUuid);
      if (basic) {
        employeesWithConversionDate.push({
          empUuid: j.empUuid,
          empFirstName: basic.empFirstName,
          empLastName: basic.empLastName,
          empConversionDate: j.empConversionDate
        });
      }
    }

    // 12th month = conversion + 12 months in current month; 14th month = conversion + 14 months in current month
    const { workAnniversary12Month, workAnniversary14Month } = filterWorkAnniversariesByConversionDate(
      employeesWithConversionDate,
      todayMonth,
      todayYear
    );

    // Serialize dates for JSON (anniversaryDate is Date)
    const serializeAnniversary = (list) => list.map((e) => ({ ...e, anniversaryDate: e.anniversaryDate?.toISOString?.() ?? e.anniversaryDate }));

    // Return the results
    return res.status(200).json({
      success: true,
      message: "Employee dashboard details fetched successfully",
      employeeBirthdayDetails,
      employeeWorkAnniversaryDetails: {
        workAnniversary12Month: serializeAnniversary(workAnniversary12Month),
        workAnniversary14Month: serializeAnniversary(workAnniversary14Month)
      }
    });
  } catch (error) {
    console.error("Error fetching employee dashboard details: ", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching employee details.",
    });
  }
};


exports.sendChangesToApprover = async (req, res) => {
  const { requestedFor, requestedBy, sectionChanged, userType } = req.body;
  const { user } = req;
  const toolsAccess = user?.toolsAccess || {};
  const toolName = "HR Repository";
  const employeeUuid = user?.employeeUuid;

  if (!requestedFor || !requestedBy || !userType) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }
  else if(!sectionChanged || sectionChanged.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No changes to send for approval" });
  }

  // Allow users to send their own changes for approval without permission check
  const isUpdatingOwnProfile = employeeUuid && requestedFor && employeeUuid === requestedFor;

  // If not updating own profile, check permission: admin access (>= 900) OR ActiveEmployee_update permission
  if (!isUpdatingOwnProfile) {
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "ActiveEmployee_update",
      toolName,
      toolsAccess
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update employee details",
      });
    }
  }

  // Start a transaction
  const transaction = await outputSequelize.transaction();

  try {
    // Map field names to their corresponding table names
    const fieldToTableMap = Object.entries(tableToFieldsMap).reduce(
      (map, [table, fields]) => {
        fields.forEach((field) => {
          map[field] = table;
        });
        return map;
      },
      {}
    );

    // Initialize the update objects for each table
    const employeeBasicDetailUpdates = {};
    const employeeContactDetailUpdates = {};
    const employeeJobDetailUpdates = {};
    const employeeSalaryDetailUpdates = {};
    const employeeAdvanceSalaryDetailUpdates = {};
    const employeeBankAccountDetailUpdates = {};
    const employeeAddressDetailUpdates = {};
    const employmentHistoryUpdates = {};
    const employeeLoginHistoryUpdates = {};
    for (const eachSection of sectionChanged) {
      const requestId = await createUUIDV4();
      const section = Object.keys(eachSection)[0];
      const fields = eachSection[section];
      let oldDataTemp = {}; // Stores previous values
      let newFieldsForApproval = {}; // Stores only fields not pending


      // Fetch all currently pending attributes for the employee in this section
      const pendingRequests = await EmployeeDataRequest.findAll({
        where: {
          requestedFor,
          isApproved: false,
          isRejected: false,
          sectionChanged: section,
        },
        attributes: ["attributesChanged"],
      });

      let pendingAttributes = new Set();
      if (pendingRequests.length > 0) {
        pendingRequests.forEach((req) => {
          const attributes = JSON.parse(req.attributesChanged);
          attributes.forEach((attr) => pendingAttributes.add(attr));
        });
      }

      for (const [field, rawValue] of Object.entries(fields)) {
        const value = (field === 'empManager' || field === 'updatedBy') && rawValue === "" ? null : rawValue;
        // Skip fields that are already pending approval
        if (pendingAttributes.has(field)) {
          continue;
        }

        let data = null;

        switch (fieldToTableMap[field]) {
          case "EmployeeBasicDetails":
            employeeBasicDetailUpdates[field] = value;
            data = await EmployeeBasicDetails.findOne({
              where: { empUuid: requestedFor },
              attributes: [field],
            });
            break;
          case "EmployeeContactDetails":
            employeeContactDetailUpdates[field] = value;
            data = await EmployeeContactDetails.findOne({
              where: { empUuid: requestedFor },
              attributes: [field],
            });
            break;
          case "EmployeeJobDetails":
            employeeJobDetailUpdates[field] = value;
            data = await EmployeeJobDetails.findOne({
              where: { empUuid: requestedFor },
              attributes: [field],
            });
            break;
          case "EmployeeSalaryDetails":
            employeeSalaryDetailUpdates[field] = value;
            data = await EmployeeSalaryDetails.findOne({
              where: { empUuid: requestedFor },
              attributes: [field],
            });
            break;
          case "EmployeeAdvanceSalaryDetails":
            employeeAdvanceSalaryDetailUpdates[field] = value;
            data = await EmployeeAdvanceSalaryDetails.findOne({
              where: { empUuid: requestedFor },
              attributes: [field],
            });
            break;
          case "EmployeeBankAccountDetails":
            employeeBankAccountDetailUpdates[field] = value;
            data = await EmployeeBankAccountDetails.findOne({
              where: { empUuid: requestedFor },
              attributes: [field],
            });
            break;
          case "EmployeeAddressDetails":
            employeeAddressDetailUpdates[field] = value;
            data = await EmployeeAddressDetails.findOne({
              where: { empUuid: requestedFor },
              attributes: [field],
            });
            break;
          case "EmploymentHistory":
            employmentHistoryUpdates[field] = value;
            data = await EmploymentHistory.findOne({
              where: { empUuid: requestedFor },
              attributes: [field],
            });
            break;
          case "EmployeeLoginHistory":
            employeeLoginHistoryUpdates[field] = value;
            break;
          default:
            break;
        }

        if (data) {
          oldDataTemp[field] = data[field]; // Store old value
        }
        newFieldsForApproval[field] = value; // Store new value only if it's not pending
      }

      // If there are new fields to approve, create a request entry
      if (Object.keys(newFieldsForApproval).length > 0) {
        await EmployeeDataRequest.create({
          requestId: requestId,
          requestedFor,
          requestedBy,
          newData: newFieldsForApproval,
          oldData: oldDataTemp,
          isApproved: false,
          isRejected: false,
          actionedBy: null,
          actionedAt: null,
          attributesChanged: JSON.stringify(Object.keys(newFieldsForApproval)), // Store only new attributes
          sectionChanged: section,
        });
      }
    }

    // Capture email data before committing
    const employeeName = await EmployeeBasicDetails.findOne({
      where: { empUuid: requestedFor },
      attributes: ["empFirstName", "empLastName"],
      raw: true,
    });
    const emailFullName = employeeName ? `${employeeName.empFirstName} ${employeeName.empLastName}` : "Unknown Employee";

    // Always notify users with Employee Details permissions when a change is sent for approval
    const recipients = await getEmployeeDetailsMailRecipients();
    const emailUsersData = recipients.map((r) => ({ email: r.empOfficialEmail, userId: r.empUuid }));

    if (recipients.length === 0) {
      console.log("Employee personal details update mail: no recipients (no users with EmployeeDetailsRequest_* or ActiveEmployee_* permissions)");
    }

    const canApproveRequests = await checkHrmsPermission(
      employeeUuid,
      "EmployeeDetailsRequest_write",
      toolName,
      toolsAccess
    );

    if (canApproveRequests) {
      await createHRMSNotification({
          notification_type: hrmsNotificationTypes.MY_UPDATES,
          message: generateUpdateMessage(sectionChanged),
          sender_employee_id: requestedBy,
          recipient_employee_id: requestedFor,
      }, transaction);
    }

    await transaction.commit();

    // Send email asynchronously (non-blocking) after transaction commits
    if (emailUsersData && emailUsersData.length > 0 && emailFullName) {
      console.log(`sendChangesToApprover: triggering personal details update email to ${emailUsersData.length} recipient(s) for ${emailFullName}`);
      (async () => {
        try {
          await sendEmployeePersonalDetailsUpdateMail(emailUsersData, emailFullName);
        } catch (emailError) {
          console.error("Error sending personal details update email:", emailError);
        }
      })();
    }

    return res.status(200).json({
      success: true,
      message: "Employee details changes sent for approval",
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error processing request: ", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing request",
    });
  }
};


exports.approveOrRejectRequest = async (req, res) => {
  const { requestIds, action, actionedBy } = req.body; // action = "approve" or "reject"

  if (!requestIds || !action) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }
  else if(!actionedBy){
    return res
    .status(400)
    .json({ success: false, message: "Employee can't send request as it has been not onboarded" });
  }

  // Check permission: admin access (>= 900) OR EmployeeDetailsRequest_write permission
  const { user } = req;
  const toolsAccess = user?.toolsAccess || {};
  const toolName = "HR Repository";
  const employeeUuid = user?.employeeUuid;

  const hasPermission = await checkHrmsPermission(
    employeeUuid,
    "EmployeeDetailsRequest_write",
    toolName,
    toolsAccess
  );

  if (!hasPermission) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to approve or reject employee detail requests",
    });
  }

  const ER_LOCK_WAIT_TIMEOUT = 'ER_LOCK_WAIT_TIMEOUT';
  const maxRetries = 2; // initial attempt + 1 retry on lock timeout
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await outputSequelize.transaction();
    try {
      // Map field names to their corresponding table names
      const fieldToTableMap = Object.entries(tableToFieldsMap).reduce(
    (map, [table, fields]) => {
      fields.forEach((field) => {
        map[field] = table;
      });
      return map;
    },
    {}
  );
  
  if(action.toLowerCase() === "approve") {
    const approvalEmailsToSend = [];
    const payrollEmployeesToSync = new Set();
    const payrollImpactingFields = new Set([
      "empType",
      "empLevel",
      "empDepartment",
      "empYearOfStudy",
      "empConversionDate",
      "state",
    ]);
    for (const requestId of requestIds) {
      const employeeBasicDetailUpdates = {};
      const employeeContactDetailUpdates = {};
      const employeeJobDetailUpdates = {};
      const employeeSalaryDetailUpdates = {};
      const employeeAdvanceSalaryDetailUpdates = {};
      const employeeBankAccountDetailUpdates = {};
      const employeeAddressDetailUpdates = {};
      const employmentHistoryUpdates = {};
      const employeeLoginHistoryUpdates = {};

      const request = await EmployeeDataRequest.findOne({
        where: { requestId },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!request) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Request not found",
        });
      }

      if (request.isApproved || request.isRejected) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Request already processed (approved or rejected)",
        });
      }

      const {
        requestedFor,
        requestedBy,
        newData
      } = request;

      const hasPayrollImpactingChanges = Object.keys(newData || {}).some((field) =>
        payrollImpactingFields.has(field)
      );

      if (hasPayrollImpactingChanges && requestedFor) {
        payrollEmployeesToSync.add(requestedFor);
      }

      if(requestedBy === actionedBy && user?.userType !== 900) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Employee can't approve/reject their own requests",
        });
      } 

      for (const [field, rawValue] of Object.entries(newData)) {
        const value = (field === 'empManager' || field === 'updatedBy') && rawValue === "" ? null : rawValue;
        switch (fieldToTableMap[field]) {
          case "EmployeeBasicDetails":
            employeeBasicDetailUpdates[field] = value;
            break;
          case "EmployeeContactDetails":
            employeeContactDetailUpdates[field] = value;
            break;
          case "EmployeeJobDetails":
            employeeJobDetailUpdates[field] = value;
            break;
          case "EmployeeSalaryDetails":
            employeeSalaryDetailUpdates[field] = value;
            break;
          case "EmployeeAdvanceSalaryDetails":
            employeeAdvanceSalaryDetailUpdates[field] = value;
            break;
          case "EmployeeBankAccountDetails":
            employeeBankAccountDetailUpdates[field] = value;
            break;
          case "EmployeeAddressDetails":
            employeeAddressDetailUpdates[field] = value;
            break;
          case "EmploymentHistory":
            employmentHistoryUpdates[field] = value;
            break;
          case "EmployeeLoginHistory":
            employeeLoginHistoryUpdates[field] = value;
            break;
          default:
            break;
        }
      }

      if (Object.keys(employeeBasicDetailUpdates).length > 0) {
        await EmployeeBasicDetails.update(employeeBasicDetailUpdates, {
          where: { empUuid: requestedFor },
          transaction,
        });
      }

      // Update the employee contact details
      if (Object.keys(employeeContactDetailUpdates).length > 0) {
        await EmployeeContactDetails.update(employeeContactDetailUpdates, {
          where: { empUuid: requestedFor },
          transaction,
        });
      }

      // Update the employee job details and job detail history
      if (Object.keys(employeeJobDetailUpdates).length > 0) {
        // Set the effective date
        employeeJobDetailUpdates.effectiveDate = new Date();

        // Get the previous data
        // Create a new history record
        const [previousDataInstance, newUuid] = await Promise.all([fetchEmployeeCurrentJobDetails(requestedFor), createUUIDV4()]);
        
        if (previousDataInstance) {
          previousDataInstance.jobHistoryId = newUuid;

          // Update previous data with any fields that are being changed
          Object.assign(previousDataInstance, employeeJobDetailUpdates);

          // Create a new job history record
          await EmployeeJobDetailHistory.create({...previousDataInstance, createdAt: new Date(), updatedAt: new Date()}, { transaction });

          // Update the employee job details
          await EmployeeJobDetails.update(employeeJobDetailUpdates, {
            where: { empUuid: requestedFor },
            transaction,
          });
        } else {
          employeeJobDetailUpdates.jobId = await createUUIDV4();
          employeeJobDetailUpdates.empUuid = requestedFor;
          await EmployeeJobDetails.create(employeeJobDetailUpdates, { transaction });
        }

        // Update the employee leave balance
        if(requestedFor && employeeJobDetailUpdates.empConversionDate) {
          await updateEmployeeLeaveBalanceOnTypeChange(requestedFor, employeeJobDetailUpdates.empType, employeeJobDetailUpdates.empConversionDate, transaction);
        }
      }

      // Update the employee salary details and salary detail history
      if (Object.keys(employeeSalaryDetailUpdates).length > 0) {
        // Set the effective date
        employeeSalaryDetailUpdates.effectiveDate = new Date();

        // Get the previous data
        const previousDataInstance = await EmployeeSalaryDetails.findOne({
          where: { empUuid: requestedFor },
        });

        if (previousDataInstance) {
          // Create a new history record
          const previousData = previousDataInstance.toJSON();
          previousData.salaryHistoryId = await createUUIDV4();

          // Create a new salary history record
          await EmployeeSalaryDetailHistory.create({...previousData, createdAt: new Date(), updatedAt: new Date()}, { transaction });

          // Update the employee salary details
          await EmployeeSalaryDetails.update(employeeSalaryDetailUpdates, {
            where: { empUuid: requestedFor },
            transaction,
          });
        } else {
          employeeSalaryDetailUpdates.salaryId = await createUUIDV4();
          employeeSalaryDetailUpdates.empUuid = requestedFor;
          await EmployeeSalaryDetails.create(employeeSalaryDetailUpdates, { transaction });
        }
      }

      // Update the employee advance salary details and advance salary detail history
      if (Object.keys(employeeAdvanceSalaryDetailUpdates).length > 0) {
        // Set the effective date
        employeeAdvanceSalaryDetailUpdates.effectiveDate = new Date();

        // Get the previous data
        const previousDataInstance = await EmployeeAdvanceSalaryDetails.findOne(
          { where: { empUuid: requestedFor } }
        );

        if (previousDataInstance) {
          // Create a new history record
          const previousData = previousDataInstance.toJSON();
          previousData.advanceSalaryHistoryId = await createUUIDV4();

          // Create a new advance salary history record
          await EmployeeAdvanceSalaryDetailHistory.create({...previousData, createdAt: new Date(), updatedAt: new Date()}, { transaction });

          // Update the employee advance salary details
          await EmployeeAdvanceSalaryDetails.update(
            employeeAdvanceSalaryDetailUpdates,
            {
              where: { empUuid: requestedFor },
              transaction,
            }
          );
        } else {
          employeeAdvanceSalaryDetailUpdates.advanceSalaryId = await createUUIDV4();
          employeeAdvanceSalaryDetailUpdates.empUuid = requestedFor;
          await EmployeeAdvanceSalaryDetails.create(employeeAdvanceSalaryDetailUpdates, { transaction });
        }
      }

      // Update the employee bank account details and bank account detail history
      if (Object.keys(employeeBankAccountDetailUpdates).length > 0) {
        // Set the effective date
        employeeBankAccountDetailUpdates.effecTiveDate = new Date();

        // Get the previous data
        const previousDataInstance = await EmployeeBankAccountDetails.findOne({
          where: { empUuid: requestedFor },
        });

        if (previousDataInstance) {
          // Create a new history record
          const previousData = previousDataInstance.toJSON();
          previousData.bankAccountHistoryId = await createUUIDV4();

          // Create a new bank account history record
          await EmployeeBankAccountDetailHistory.create({...previousData, createdAt: new Date(), updatedAt: new Date()}, { transaction });

          // Update the employee bank account details
          await EmployeeBankAccountDetails.update(
            employeeBankAccountDetailUpdates,
            {
              where: { empUuid: requestedFor },
              transaction,
            }
          );
        } else {
          employeeBankAccountDetailUpdates.accountId = await createUUIDV4();
          employeeBankAccountDetailUpdates.empUuid = requestedFor;
          await EmployeeBankAccountDetails.create(employeeBankAccountDetailUpdates, { transaction });
        }
      }

      // Update the employee address details
      if (Object.keys(employeeAddressDetailUpdates).length > 0) {
        // Set the effective date
        employeeAddressDetailUpdates.effectiveDate = new Date();

        const previousDataInstance = await EmployeeAddressDetails.findOne({ where: { empUuid: requestedFor } });

        if (previousDataInstance) {
          // update the employee address details
          await EmployeeAddressDetails.update(employeeAddressDetailUpdates, {
            where: { empUuid: requestedFor },
            transaction,
          });
        } else {
          employeeAddressDetailUpdates.addressId = await createUUIDV4();
          employeeAddressDetailUpdates.empUuid = requestedFor;
          await EmployeeAddressDetails.create(employeeAddressDetailUpdates, { transaction });
        }
      }

      // Create a new employment history record
      if (Object.keys(employmentHistoryUpdates).length > 0) {
        await EmploymentHistory.create(employmentHistoryUpdates, { transaction });
      }

      // Create a new employee login history record
      if (Object.keys(employeeLoginHistoryUpdates).length > 0) {
        await EmployeeLoginHistory.create(employeeLoginHistoryUpdates, { transaction });
      }

      // Update the request status
      await EmployeeDataRequest.update(
        { isApproved: true, actionedBy, actionedAt: new Date() },
        { where: { requestId }, transaction }
      );

      const employeeEmailId = await EmployeeContactDetails.findOne({
        where: { empUuid: requestedFor },
        attributes: ["empOfficialEmail"],
        raw: true,
      });
      const employeeName = await EmployeeBasicDetails.findOne({
        where: { empUuid: requestedFor },
        attributes: ["empFirstName", "empLastName"],
        raw: true,
      });
      // Collect email data for async sending
      if (employeeEmailId?.empOfficialEmail) {
        approvalEmailsToSend.push({
          email: employeeEmailId.empOfficialEmail,
          empUuid: requestedFor,
          name: (employeeName?.empFirstName || '') + " " + (employeeName?.empLastName || ''),
        });
      }
    }
    await transaction.commit();

    // Send approval emails asynchronously (non-blocking)
    (async () => {
      try {
        for (const emailData of approvalEmailsToSend) {
          await sendPersonalDetailsApprovedMail(emailData.email, emailData.empUuid, undefined, emailData.name);
        }
      } catch (emailError) {
        console.error("Error sending personal details approval email:", emailError);
      }
    })();

    // Run payroll reconciliation asynchronously for employees whose approved changes
    // can affect payroll category resolution.
    if (payrollEmployeesToSync.size > 0) {
      const affectedEmployees = Array.from(payrollEmployeesToSync);
      console.log(
        `approveOrRejectRequest: triggering async payroll reconciliation for ${affectedEmployees.length} employee(s)`
      );
      (async () => {
        try {
          await reconcilePayrollForEmployees(affectedEmployees);
        } catch (syncError) {
          console.error("Error during async payroll reconciliation after approval:", syncError);
        }
      })();
    }

    return res.status(200).json({
      success: true,
      message: "Request(s) approved successfully and notified to employee",
    });
  }else{
    const rejectionEmailsToSend = [];
    for (const requestId of requestIds) {
      const request = await EmployeeDataRequest.findOne({
        where: { requestId },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!request) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Request not found",
        });
      }

      if (request.isApproved || request.isRejected) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Request already processed (approved or rejected)",
        });
      }

      const {
        requestedFor,
        requestedBy,
      } = request;

      if(requestedBy === actionedBy) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Employee can't approve/reject their own requests",
        });
      }

      await EmployeeDataRequest.update(
        { isRejected: true, actionedBy, actionedAt: new Date() },
        { where: { requestId }, transaction }
      );

      const employeeEmailId = await EmployeeContactDetails.findOne({
        where: { empUuid: requestedFor },
        attributes: ["empOfficialEmail"],
        raw: true,
      });
      const employeeName = await EmployeeBasicDetails.findOne({
        where: { empUuid: requestedFor },
        attributes: ["empFirstName", "empLastName"],
        raw: true,
      });
      // Collect email data for async sending
      if (employeeEmailId?.empOfficialEmail) {
        rejectionEmailsToSend.push({
          email: employeeEmailId.empOfficialEmail,
          empUuid: requestedFor,
          name: (employeeName?.empFirstName || '') + " " + (employeeName?.empLastName || ''),
        });
      }
    }


    await transaction.commit();

    // Send rejection emails asynchronously (non-blocking)
    (async () => {
      try {
        for (const emailData of rejectionEmailsToSend) {
          await sendPersonalDetailsRejectedMail(emailData.email, emailData.empUuid, undefined, emailData.name);
        }
      } catch (emailError) {
        console.error("Error sending personal details rejection email:", emailError);
      }
    })();

    return res.status(200).json({
      success: true,
      message: "Request(s) rejected successfully",
    });
  }

    } catch (error) {
      await transaction.rollback();
      lastError = error;
      const isLockTimeout = error?.parent?.code === ER_LOCK_WAIT_TIMEOUT || error?.code === ER_LOCK_WAIT_TIMEOUT;
      if (isLockTimeout && attempt < maxRetries) {
        continue; // retry once
      }
      console.error("Error processing approval/rejection: ", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while processing request",
      });
    }
  }

  console.error("Error processing approval/rejection (retries exhausted): ", lastError);
  return res.status(500).json({
    success: false,
    message: "An error occurred while processing request",
  });
};

exports.getPendingRequests = async (req, res) => {
  try {
    const { user } = req;
    const toolsAccess = user?.toolsAccess || {};
    const toolName = "HR Repository";
    const employeeUuid = user?.employeeUuid;

    // Check permission: admin access (>= 900) OR EmployeeDetailsRequest_read permission

    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "EmployeeDetailsRequest_read",
      toolName,
      toolsAccess
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view employee detail requests",
      });
    }

    const pendingRequests = await EmployeeDataRequest.findAll({
      where: {
        isApproved: false,
        isRejected: false,
      },
      raw: true,
    });
    
    const updatedRequests = await Promise.all(
      pendingRequests.map(async (request) => {
        const requestedForName = await EmployeeBasicDetails.findOne({
          where: { empUuid: request.requestedFor },
          attributes: ["empFirstName", "empLastName"],
          raw: true,
          order: [['createdAt', 'DESC']]
        });

        const requestedByName = await EmployeeBasicDetails.findOne({
          where: { empUuid: request.requestedBy },
          attributes: ["empFirstName", "empLastName"],
          raw: true,
           order: [['createdAt', 'DESC']]
        });

        return {
          ...request,
          requestedFor: requestedForName
            ? `${requestedForName.empFirstName} ${requestedForName.empLastName}`
            : "Unknown",
          requestedBy: requestedByName
            ? `${requestedByName.empFirstName} ${requestedByName.empLastName}`
            : "Unknown",
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: updatedRequests,
    });
  } catch (error) {
    console.error("Error fetching pending requests: ", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching pending requests",
    });
  }
};



// Ensure you import your models correctly here
// const { EmployeeDataRequest, EmployeeBasicDetails } = require('../models'); 

exports.getProcessedRequests = async (req, res) => {
  try {
    const { user } = req;
    const toolsAccess = user?.toolsAccess || {};
    const toolName = "HR Repository";
    const employeeUuid = user?.employeeUuid;

    // 1. Check Permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "EmployeeDetailsRequest_read",
      toolName,
      toolsAccess
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view employee detail requests",
      });
    }

    // 2. Extract and Parse Pagination Params with strict defaults
    const { startDate, endDate, page, pageSize } = req.query;
    
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(pageSize) || 10);
    const offset = (pageNum - 1) * limitNum;

    const whereConditions = {
      [Op.or]: [
        { isApproved: true },
        { isRejected: true }
      ]
    }; 

    if (startDate && endDate) {
      whereConditions.createdAt = {
        [Op.between]: [
          new Date(startDate + " 00:00:00"), 
          new Date(endDate + " 23:59:59")
        ]
      };
    }

    // 3. Query Database
    // We use [Op.or] but also ensure we are looking for actual truthy values
    const { count, rows } = await EmployeeDataRequest.findAndCountAll({
      where: whereConditions,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset: offset,
      raw: true,
      // Check your terminal to see the generated SQL!
    });

    // If no rows found, return early with empty data to avoid mapping errors
    if (!rows || rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No processed requests found",
        data: [],
        pagination: {
          totalRecords: count,
          totalPages: Math.ceil(count / limitNum),
          currentPage: pageNum,
          pageSize: limitNum,
        },
      });
    }

    // 4. Resolve Employee Names
    // Optimized with Promise.all to fetch names in parallel
    const updatedRequests = await Promise.all(
      rows.map(async (request) => {
        const [requestedForName, requestedByName] = await Promise.all([
          EmployeeBasicDetails.findOne({
            where: { empUuid: request.requestedFor },
            attributes: ["empFirstName", "empLastName"],
            raw: true,
          }),
          EmployeeBasicDetails.findOne({
            where: { empUuid: request.requestedBy },
            attributes: ["empFirstName", "empLastName"],
            raw: true,
          }),
        ]);

        return {
          ...request,
          requestedFor: requestedForName
            ? `${requestedForName.empFirstName} ${requestedForName.empLastName}`
            : "Unknown",
          requestedBy: requestedByName
            ? `${requestedByName.empFirstName} ${requestedByName.empLastName}`
            : "Unknown",
        };
      })
    );

    // 5. Final Response
    return res.status(200).json({
      success: true,
      message: "Processed requests fetched successfully",
      allProcessedRequests: updatedRequests,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limitNum) || 1,
        currentPage: pageNum,
        pageSize: limitNum,
      },
    });

  } catch (error) {
    console.error("Error fetching processed requests: ", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching processed requests",
      error: error.message // Helpful for debugging, remove in production
    });
  }
};
