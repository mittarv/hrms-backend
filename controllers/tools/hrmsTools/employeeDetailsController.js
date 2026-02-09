const { outputSequelize, dbOutput, Op } = require("../../../models/index");
// const { attribute } = require("../../../test/mockData/platform/userMockData");
const { createUUIDV4 } = require("../../../utilities/uuidV4Generator");
import { 
  sendOnboardingEmail, 
  sendEmployeePersonalDetailsUpdateMail,
  sendPersonalDetailsApprovedMail,
  sendPersonalDetailsRejectedMail,
} from "../../../middlewares/sendEmail";
import { fetchEmployeeCurrentJobDetails, findHRRepositoryToolAdminUsers } from "../../../utilities/hrmsUtilities/dbCalls";
import { createHRMSNotification } from "../../../utilities/hrmsUtilities/dbCalls";
import { hrmsNotificationTypes } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import { generateUpdateMessage, updateEmployeeLeaveBalanceOnTypeChange, filterUpcomingBirthdays, filterWorkAnniversaries } from "../../../utilities/hrmsUtilities/helperFunctions";
const { checkHrmsPermission } = require("../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices");
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
const TmsUsers = dbOutput.tmsUsers;

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
    "empIFSCCode", "empAccountNumber", "empBenefeciaryName", "empAccType"
  ],
  EmployeeAddressDetails: [
    "addressType", "addressLine1", "addressLine2", "addressLine3", 
    "city", "pin", "state", "country", "TerminationDate"
  ],
  EmploymentHistory: [
    "empStartDate", "empEndDate", "updatedBy"
  ],
  EmployeeLoginHistory: [
    "loginTimeStamp", "isDeleted"
  ]
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

    await sendOnboardingEmail(emp_official_email, employeeUuid, transaction);

    // Commit the transaction only if everything succeeds (including email)
    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Employee data created successfully and onboarding email sent",
    });
  } catch (error) {
    // Rollback the transaction if any error occurs (including email failure)
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
    if (!employeeSalaryDetails) {
      return res.status(404).json({ success: false, message: "Employee salary details not found" });
    }

    // Fetch the employee's address details
    const employeeAddressDetails = await EmployeeAddressDetails.findOne({ where: { empUuid } });
    if (!employeeAddressDetails) {
      return res.status(404).json({ success: false, message: "Employee address details not found" });
    }

    // Fetch the employee's bank account details
    const employeeBankDetails = await EmployeeBankAccountDetails.findOne({ where: { empUuid } });
    if (!employeeBankDetails) {
      return res.status(404).json({ success: false, message: "Employee Bank account details not found" });
    }

    // Fetch the employee's advance salary details
    const employeeAdvanceSalaryDetails = await EmployeeAdvanceSalaryDetails.findOne({ where: { empUuid } });
    if (!employeeAdvanceSalaryDetails) {
      return res.status(404).json({ success: false, message: "Employee advance salary details not found" });
    }

    // Tms user details
    const tmsUserDetails = await TmsUsers.findOne(
      {where: {email: employeeContactDetails?.empOfficialEmail}}
    );

    // Tms user profile image
    const tmsUserProfileImage = tmsUserDetails?.profilePic;
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

// Function to fetch all employee details
exports.getAllEmployees = async (req, res) => {
  try {
    // Fetch all employee UUIDs
    const employeeUuids = await EmployeeBasicDetails.findAll({
      attributes: ['empUuid']
    });

    // Fetch the employee details for each employee UUID
    const employeeDetailsPromises = employeeUuids.map(async (employee) => {
      const empUuid = employee.dataValues.empUuid; // Extract empUuid from the Sequelize instance

      // Fetch the employee's first name, last name, job type, and department
      const employeeBasicDetails = await EmployeeBasicDetails.findOne({
        attributes: ['empFirstName', 'empLastName', 'createdAt'],
        where: { empUuid: empUuid },
      });

      const employeeCurrentJobDetails = await fetchEmployeeCurrentJobDetails(empUuid);

      // Fetch the employee's contact details
      const employeeContactDetails = await EmployeeContactDetails.findOne({ where: { empUuid } });

      // Tms user details
      const tmsUserDetails = await TmsUsers.findOne(
        {where: {email: employeeContactDetails?.empOfficialEmail}}
      );

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
      "empIFSCCode", "empAccountNumber", "empBenefeciaryName", "empAccType"
    ],
    EmployeeAddressDetails: [
      "addressType", "addressLine1", "addressLine2", "addressLine3", 
      "city", "pin", "state", "country", "TerminationDate"
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

      // Create a new history record
      const previousData = previousDataInstance.toJSON();
      previousData.bankAccountHistoryId = await createUUIDV4();

      // Create a new bank account history record
      await EmployeeBankAccountDetailHistory.create({...previousData, createdAt: new Date(), updatedAt: new Date()}, {
        where : {empUuid: employeeUuid},
        transaction
      });

      // Update the employee bank account details
      await EmployeeBankAccountDetails.update(employeeBankAccountDetailUpdates, {
        where : {empUuid: employeeUuid},
        transaction
      });
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
        isManager: true
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
        empDob: { [Op.ne]: null }
      },
      attributes: ['empUuid', 'empFirstName', 'empLastName', 'empDob'],
      raw: true
    });

    // Filter employees whose birthdays fall within the remaining days of the current month
    const employeeBirthdayDetails = filterUpcomingBirthdays(allEmployeesWithDob, todayMonth, todayDay);

    // Fetch all employees with their hire date (only non-null hire date values)
    const allEmployeesWithHireDate = await EmployeeBasicDetails.findAll({
      where: {
        empHireDate: { [Op.ne]: null }
      },
      attributes: ['empUuid', 'empFirstName', 'empLastName', 'empHireDate'],
      raw: true
    });

    // Filter employees whose work anniversaries fall on today and have completed at least one year
    const employeeWorkAnniversaryDetails = filterWorkAnniversaries(allEmployeesWithHireDate, todayMonth, todayDay, todayYear);

    // Return the results
    return res.status(200).json({
      success: true,
      message: "Employee dashboard details fetched successfully",
      employeeBirthdayDetails,
      employeeWorkAnniversaryDetails,
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

    if(userType < 500) {
      const users = await findHRRepositoryToolAdminUsers();
      
      // Fetch employee name from basic details
      const employeeName = await EmployeeBasicDetails.findOne({
        where: { empUuid: requestedFor },
        attributes: ["empFirstName", "empLastName"],
        raw: true,
      });
      
      const fullName = employeeName ? `${employeeName.empFirstName} ${employeeName.empLastName}` : "Unknown Employee";
      
      await sendEmployeePersonalDetailsUpdateMail(users, fullName, transaction);
    } else {
      await createHRMSNotification({
          notification_type: hrmsNotificationTypes.MY_UPDATES,
          message: generateUpdateMessage(sectionChanged),
          sender_employee_id: requestedBy,
          recipient_employee_id: requestedFor,
      }, transaction);
    }

    await transaction.commit();

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

  const { checkHrmsPermission } = require("../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices");
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

  // Start a transaction
  const transaction = await outputSequelize.transaction();

try{
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
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Request not found",
        });
      }

      const {
        requestedFor,
        requestedBy,
        newData
      } = request;

      if(requestedBy === actionedBy) {
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
      }

      // Update the employee advance salary details and advance salary detail history
      if (Object.keys(employeeAdvanceSalaryDetailUpdates).length > 0) {
        // Set the effective date
        employeeAdvanceSalaryDetailUpdates.effectiveDate = new Date();

        // Get the previous data
        const previousDataInstance = await EmployeeAdvanceSalaryDetails.findOne(
          { where: { empUuid: requestedFor } }
        );

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
      }

      // Update the employee bank account details and bank account detail history
      if (Object.keys(employeeBankAccountDetailUpdates).length > 0) {
        // Set the effective date
        employeeBankAccountDetailUpdates.effecTiveDate = new Date();

        // Get the previous data
        const previousDataInstance = await EmployeeBankAccountDetails.findOne({
          where: { empUuid: requestedFor },
        });

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
      }

      // Update the employee address details
      if (Object.keys(employeeAddressDetailUpdates).length > 0) {
        // Set the effective date
        employeeAddressDetailUpdates.effectiveDate = new Date();

        // update the employee address details
        await EmployeeAddressDetails.update(employeeAddressDetailUpdates, {
          where: { empUuid: requestedFor },
          transaction,
        });
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
      await sendPersonalDetailsApprovedMail(employeeEmailId?.empOfficialEmail, requestedFor, transaction, employeeName?.empFirstName+" "+employeeName?.empLastName);
    }
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "Request(s) approved successfully and notified to employee",
    });
  }else{
    for (const requestId of requestIds) {
      
      const request = await EmployeeDataRequest.findOne({
        where: { requestId },
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Request not found",
        });
      }

      const {
        requestedFor,
        requestedBy,
      } = request;

      if(requestedBy === actionedBy) {
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
    await sendPersonalDetailsRejectedMail(employeeEmailId?.empOfficialEmail, requestedFor, transaction, employeeName?.empFirstName+" "+employeeName?.empLastName);
    }


    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "Request(s) rejected successfully",
    });
  }

  } catch (error) {
    await transaction.rollback();
    console.error("Error processing approval/rejection: ", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing request",
    });
  }
};

exports.getPendingRequests = async (req, res) => {
  try {
    const { user } = req;
    const toolsAccess = user?.toolsAccess || {};
    const toolName = "HR Repository";
    const employeeUuid = user?.employeeUuid;

    // Check permission: admin access (>= 900) OR EmployeeDetailsRequest_read permission
    const { checkHrmsPermission } = require("../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices");
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
        });

        const requestedByName = await EmployeeBasicDetails.findOne({
          where: { empUuid: request.requestedBy },
          attributes: ["empFirstName", "empLastName"],
          raw: true,
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

