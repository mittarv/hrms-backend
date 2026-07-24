const { dbOutput, sequelize } = require("../../../models/index");
const { createUUIDV4 } = require("../../../utilities/uuidV4Generator");
const { checkHrmsPermission } = require("../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices");

const EmployeeLeaveConfigurator = dbOutput.employeeLeaveConfigurator;
exports.createLeave = async (req, res) => {

  const {
        leaveType,
        accuralFrequency,
        totalAllotedLeaves,
        accuralRate,
        leaveExpiresAfter,
        
    } = req.body;

    // Validate required fields (No transaction opened yet, so no leak)
    if (!leaveType || !accuralFrequency || totalAllotedLeaves === undefined || accuralRate === undefined) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields. Please check your input.",
        });
    }

    if (leaveExpiresAfter !== null && leaveExpiresAfter <= 0) {
        return res.status(400).json({
            success: false,
            message: "Leave Expires After must be greater than 0",
        });
    }
  const t = await sequelize.transaction();
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
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "You don't have permission to create leave configuration",
      });
    }

    let leaveConfigId = await createUUIDV4();
    

    const empCompanyId = req.empCompanyId || req.body.empCompanyId || "DEFAULT_COMPANY";
    if (leaveExpiresAfter !== null && leaveExpiresAfter !== undefined) {
      await EmployeeLeaveConfigurator.update(
      { leaveExpiresAfter: null },
      {
        where: { leaveExpiresAfter: { [Op.ne]: null }, empCompanyId, isActive: true },
        transaction: t
      }
      );
    }
    const leaveConfig = await EmployeeLeaveConfigurator.create({
      ...req.body,
      empCompanyId,
      leaveConfigId,
      isHalfDayAllowed: req.body.isHalfDayAllowed || false,
      effectiveDate: req.body.effectiveDate || new Date(),
      isDefault: req.body.isDefault || false,
      leaveApplicableTo : JSON.stringify(req.body.leaveApplicableTo) || null,
      allotAllLeaves: req.body.allotAllLeaves || false,
      leaveExpiresAfter : leaveExpiresAfter ?? null
    },{ transaction: t});

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Leave created successfully",
      data: leaveConfig,
    });
  } catch (error) {
    await t.rollback();
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
      leaveExpiresAfter,
    } = req.body;
    // Check if leaveConfigId exists
    if (!leaveConfigId) {
      return res.status(400).json({
        success: false,
        message: "leaveConfigId is required.",
      });
    }
    const empCompanyId = req.empCompanyId || req.body.empCompanyId || "DEFAULT_COMPANY";

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
        leaveExpiresAfter: leaveExpiresAfter !== undefined ? leaveExpiresAfter : null,
      },
      { where: { leaveConfigId, empCompanyId, isActive: true } }
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
    const empCompanyId = req.empCompanyId || req.body.empCompanyId || "DEFAULT_COMPANY";
    let leaves = await EmployeeLeaveConfigurator.findAll({
      where: { empCompanyId, isActive: true }
    });

    if (leaves.length === 0 && empCompanyId !== "DEFAULT_COMPANY") {
      const defaultLeaves = await EmployeeLeaveConfigurator.findAll({
        where: { empCompanyId: "DEFAULT_COMPANY", isActive: true }
      });
      if (defaultLeaves.length > 0) {
        const newLeaves = defaultLeaves.map(leave => {
          const leaveObj = leave.toJSON();
          delete leaveObj.id; // Let DB auto-increment or generate new ID
          return {
            ...leaveObj,
            empCompanyId,
            isActive: true
          };
        });
        
        leaves = await EmployeeLeaveConfigurator.bulkCreate(newLeaves, { individualHooks: true });
      }
    }

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
    const empCompanyId = req.empCompanyId || req.body.empCompanyId || "DEFAULT_COMPANY";
    const leaveDetails = await EmployeeLeaveConfigurator.findOne({ where: { leaveConfigId, empCompanyId, isActive: true } });
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
