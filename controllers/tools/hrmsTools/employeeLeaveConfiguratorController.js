const { dbOutput } = require("../../../models/index");
const { createUUIDV4 } = require("../../../utilities/uuidV4Generator");
const { checkHrmsPermission } = require("../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices");

const EmployeeLeaveConfigurator = dbOutput.employeeLeaveConfigurator;

exports.createLeave = async (req, res) => {
  try {
    const { user } = req;
    const toolsAccess = user?.toolsAccess || {};
    const toolName = "HR Repository";
    const employeeUuid = user?.employeeUuid;

    // Check permission: admin access (>= 900) OR LeaveConfigurator_Create permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "LeaveConfigurator_Create",
      toolName,
      toolsAccess
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to create leave configuration",
      });
    }

    let leaveConfigId = await createUUIDV4();
    const {
      leaveType,
      employeeType,
      accuralFrequency,
      totalAllotedLeaves,
      accuralRate,
      minimumNoticePeriod,
      maximumNoticePeriod,
      continuousLeavesLimit,
      excludePaidWeekend,
      appliedGender,
      isHalfDayAllowed,
      isProofRequired,
      isReasonRequired,
      isActive,
      effectiveDate,
      terminationDate,
      isDefault,
      leaveApplicableTo,
      allotAllLeaves,
    } = req.body;

    // Validate required fields
    if (
      !leaveType ||
      !accuralFrequency ||
      totalAllotedLeaves === undefined ||
      accuralRate === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields. Please check your input.",
      });
    }

    const leaveConfig = await EmployeeLeaveConfigurator.create({
      leaveConfigId,
      leaveType,
      employeeType,
      accuralFrequency,
      totalAllotedLeaves,
      accuralRate,
      minimumNoticePeriod,
      maximumNoticePeriod,
      continuousLeavesLimit,
      excludePaidWeekend,
      appliedGender,
      isHalfDayAllowed: isHalfDayAllowed || false,
      isProofRequired,
      isReasonRequired,
      effectiveDate: effectiveDate || new Date(),
      terminationDate: terminationDate || null,
      isActive: isActive,
      isDefault: isDefault || false,
      leaveApplicableTo : JSON.stringify(leaveApplicableTo) || null,
      allotAllLeaves: allotAllLeaves || false,
    });

    return res.status(201).json({
      success: true,
      message: "Leave created successfully",
      data: leaveConfig,
    });
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      // For checking whether the error is due to validation
      return res.status(422).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((e) => e.message),
      });
    }

    // For any other unexpected errors
    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Please try again later.",
      error: error.message,
    });
  }
};


// This function is used for updating the leave configuration
// It is a patch request
exports.updateLeaveConfiguration = async (req, res) => {
  try {
    const { user } = req;
    const toolsAccess = user?.toolsAccess || {};
    const toolName = "HR Repository";
    const employeeUuid = user?.employeeUuid;

    // Check permission: admin access (>= 900) OR LeaveConfigurator_update permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "LeaveConfigurator_update",
      toolName,
      toolsAccess
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update leave configuration",
      });
    }

    const {
      leaveConfigId,
      leaveType,
      employeeType,
      accuralFrequency,
      totalAllotedLeaves,
      accuralRate,
      minimumNoticePeriod,
      maximumNoticePeriod,
      continuousLeavesLimit,
      excludePaidWeekend,
      appliedGender,
      isHalfDayAllowed,
      isProofRequired,
      isReasonRequired,
      isActive,
      effectiveDate,
      terminationDate,
      isDefault,
      leaveApplicableTo,
      allotAllLeaves,
    } = req.body;
    // Check if leaveConfigId exists
    if (!leaveConfigId) {
      return res.status(400).json({
        success: false,
        message: "leaveConfigId is required.",
      });
    }
    const [updated] = await EmployeeLeaveConfigurator.update(
      {
        leaveType,
        employeeType,
        accuralFrequency,
        totalAllotedLeaves,
        accuralRate,
        minimumNoticePeriod,
        maximumNoticePeriod,
        continuousLeavesLimit,
        excludePaidWeekend,
        appliedGender,
        isHalfDayAllowed,
        isProofRequired,
        isReasonRequired,
        effectiveDate,
        terminationDate,
        isActive,
        isDefault,
        leaveApplicableTo : JSON.stringify(leaveApplicableTo) || null,
        allotAllLeaves,
      },
      { where: { leaveConfigId } }
    );

    // Check if the update was successful
    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: "No record found with the provided leaveConfigId.",
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: "Leave configuration updated successfully.",
    });
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      // For checking whether the error is due to validation
      return res.status(422).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((e) => e.message),
      });
    }

    // For any other unexpected errors
    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Please try again later.",
      error: error.message,
    });
  }
};

exports.getAllLeaves = async (req, res) => {
  try {
    const leaves = await EmployeeLeaveConfigurator.findAll();
    return res.status(200).json({
      success: true,
      leaveDetails: leaves.map((leave) => ({
        ...leave.dataValues,
        leaveApplicableTo : JSON.parse(leave.leaveApplicableTo),
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error. Please try again later.",
      error: error.message,
    });
  }
};


exports.getLeaveDetailsByUuid = async (req, res) => {
  try {
    const { user } = req;
    const toolsAccess = user?.toolsAccess || {};
    const toolName = "HR Repository";
    const employeeUuid = user?.employeeUuid;

    // Check permission: admin access (>= 900) OR LeaveConfigurator_Read permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "LeaveConfigurator_Read",
      toolName,
      toolsAccess
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view leave details",
      });
    }

    // Extract the employee UUID from the request parameters
    const leaveConfigId = req.params.id;
    if (!leaveConfigId) {
      return res.status(400).json({ success: false, message: "leave UUID is required" });
    }

    // Fetch the employee's basic details
    const leaveDetails = await EmployeeLeaveConfigurator.findOne({ where: { leaveConfigId } });
    if (!leaveDetails) {
      return res.status(404).json({ success: false, message: "leave details not found" });
    }

    // successful response with the fetched data
    return res.status(200).json({
      success: true,
      message: "leave details fetched successfully",
      leaveDetails : {...leaveDetails.dataValues, leaveApplicableTo : JSON.parse(leaveDetails.leaveApplicableTo)},
    });

  } catch (error) {
    console.error("Error fetching leave details: ", error);

    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching leave details",
      error: error.message,
    });
  }
};
