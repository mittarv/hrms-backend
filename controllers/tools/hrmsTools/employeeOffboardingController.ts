import { Request, Response } from "express";
import { outputSequelize } from "../../../models";
import { Transaction } from "sequelize";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";
import { hrmsConstants } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import {
  AuthenticatedUser,
  GetOffboardingInitiatedEmployeeDetailsParams,
  GetOffboardingInitiatedEmployeeDetailsResponse,
  InitiateOffboardingResponse,
  HrClearanceResponse,
  FinanceClearanceResponse,
  ApproveOffboardingResponse,
} from "../../../interfaces/hrmsTool/interface/hrmsInterface";
import {
  approveOffboardingService,
  financeClearanceService,
  getAllOffboardedEmployeesService,
  getAllOffboardingInitiatedEmployeeDetailsService,
  hrClearanceService,
  initiateOffboardingService,
  setLastWorkingDayService,
} from "../../../utilities/hrmsUtilities/dbCalls/employeeOffboardingServices";
import {
  checkIsEmployeeManager,
  getActiveEmployeesOfficialEmails,
} from "../../../utilities/hrmsUtilities/dbCalls";
import { checkHrmsPermission } from "../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices";
import {
  sendOffboardingClearanceEmail,
  sendOffboardingManagerEmail,
} from "../../../middlewares/sendHrmsEmail";

/**
 * Get offboarding initiated employee details controller
 * @param req - The request
 * @param res - The response
 * @returns The offboarding initiated employee details
 */
export const getAllOffboardingInitiatedEmployeeDetails = async (
  req: Request,
  res: Response,
) => {
  const { user } = req as AuthenticatedRequest;
  const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
  const toolName = hrmsConstants.HR_REPOSITORY;

  try {
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "Offboarding_View",
      toolName,
      toolsAccess as Record<string, number> | undefined,
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message:
          "You don't have permission to get offboarding initiated employee details",
      });
      return;
    }

    const getOffboardingInitiatedEmployeeDetailsResult =
      await outputSequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (transaction: Transaction) => {
          return await getAllOffboardingInitiatedEmployeeDetailsService(
            transaction,
          );
        },
      );

    const response: GetOffboardingInitiatedEmployeeDetailsResponse = {
      success: true,
      message: "Offboarding initiated employee details fetched successfully",
      offboardingInitiatedEmployeeDetails:
        getOffboardingInitiatedEmployeeDetailsResult,
    };
    res.status(200).json(response);
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      message:
        "Failed to get offboarding initiated employee details. Please try again later.",
      error: errorMessage,
    });
    return;
  }
};

/**
 * Initiate offboarding controller
 * @param req - The request
 * @param res - The response
 * @returns The offboarding with employee name
 */
export const initiateOffboarding = async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
  const toolName = hrmsConstants.HR_REPOSITORY;
  const { empUuid } =
    req.params as unknown as GetOffboardingInitiatedEmployeeDetailsParams;

  if(!employeeUuid){
    res.status(400).json({
        success:false,
        message: "EmployeeID required to do this action!",
    })
    return;
  }

  const createdBy = employeeUuid as string;
  const updatedBy = employeeUuid as string;

  if (!empUuid) {
    res.status(400).json({
      success: false,
      message: "Employee UUID is required",
    });
    return;
  }

  try {
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "Offboarding_Initiate",
      toolName,
      toolsAccess as Record<string, number> | undefined,
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to initiate offboarding",
      });
      return;
    }

    const initiateOffboardingResult = await outputSequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction: Transaction) => {
        return await initiateOffboardingService(
          empUuid,
          createdBy,
          updatedBy,
          transaction,
        );
      },
    );

    const response: InitiateOffboardingResponse = {
      success: true,
      message: `Offboarding initiated successfully for ${initiateOffboardingResult.employeeName}`,
      data: initiateOffboardingResult,
    };
    res.status(201).json(response);

    // Send offboarding notification emails asynchronously (non-blocking)
    // This runs after the response is already sent so it doesn't slow down the API
    (async () => {
      try {
        const permissionNames = [
          "Offboarding_View",
          "Offboarding_Initiate",
          "Offboarding_HR_Clearance",
          "Offboarding_Finance_Clearance",
          "View_Offboarded_Employees",
          "Offboarding_Approve",
        ];

        const isManager = await checkIsEmployeeManager(empUuid);

        // Step 1: get active employees' official emails
        const activeContacts = await getActiveEmployeesOfficialEmails();
        if (!activeContacts || activeContacts.length === 0) {
          console.log(
            "No active employees with official emails found to evaluate permissions",
          );
          return;
        }

        // Step 2: Filter active employees by permissions and keep official email only
        const users: Array<{ email: string; userId?: string }> = [];
        for (const c of activeContacts) {
          try {
            const hasPerm = await checkHrmsPermission(
              c.empUuid,
              permissionNames,
              hrmsConstants.HR_REPOSITORY,
              undefined,
            );
            if (hasPerm && c.empOfficialEmail) {
              users.push({ email: c.empOfficialEmail, userId: c.empUuid });
            }
          } catch (permErr) {
            console.error(
              `Error checking permissions for emp ${c.empUuid}:`,
              permErr,
            );
          }
        }

        if (users.length === 0) {
          console.log(
            "No users with offboarding permissions (official email) found to send emails",
          );
          return;
        }

        const employeeName = initiateOffboardingResult.employeeName;
        if (isManager) {
          await sendOffboardingManagerEmail(users, employeeName);
        } else {
          await sendOffboardingClearanceEmail(users, employeeName);
        }
      } catch (emailError) {
        console.error(
          "Error sending offboarding notification emails:",
          emailError,
        );
      }
    })();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("Employee not found")) {
      res.status(404).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    if (
      errorMessage.includes("already initiated") ||
      errorMessage.includes("already approved")
    ) {
      res.status(409).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to initiate offboarding. Please try again later.",
      error: errorMessage,
    });
  }
};

/**
 * HR clearance controller
 * @param req - The request
 * @param res - The response
 * @returns The HR clearance
 */
export const hrClearance = async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
  const toolName = hrmsConstants.HR_REPOSITORY;
  const { empUuid } =
    req.params as unknown as GetOffboardingInitiatedEmployeeDetailsParams;

  if(!employeeUuid){
    res.status(400).json({
        success:false,
        message: "EmployeeID required to do this action!",
    })
    return;
  }

  if (!empUuid) {
    res.status(400).json({
      success: false,
      message: "Employee UUID is required",
    });
    return;
  }

  const updatedBy = employeeUuid as string;

  try {
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "Offboarding_HR_Clearance",
      toolName,
      toolsAccess as Record<string, number> | undefined,
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message:
          "You don't have permission to manage HR clearance for offboarding",
      });
      return;
    }

    const hrClearanceResult = await outputSequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction: Transaction) => {
        return await hrClearanceService(empUuid, updatedBy, transaction);
      },
    );

    const action = hrClearanceResult.newStatus ? "granted" : "revoked";
    const message = `HR clearance ${action} successfully for ${hrClearanceResult.employeeName}`;

    const response: HrClearanceResponse = {
      success: true,
      message,
      hrClearanceResult: hrClearanceResult,
    };
    res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("not found")) {
      res.status(404).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    if (errorMessage.includes("not initiated")) {
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to update HR clearance. Please try again later.",
      error: errorMessage,
    });
  }
};

/**
 * Finance clearance controller
 * @param req - The request
 * @param res - The response
 * @returns The finance clearance
 */
export const financeClearance = async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
  const toolName = hrmsConstants.HR_REPOSITORY;
  const { empUuid } =
    req.params as unknown as GetOffboardingInitiatedEmployeeDetailsParams;

  if(!employeeUuid){
    res.status(400).json({
        success:false,
        message: "EmployeeID required to do this action!",
    })
    return;
  }

  if (!empUuid) {
    res.status(400).json({
      success: false,
      message: "Employee UUID is required",
    });
    return;
  }

  const updatedBy = employeeUuid as string;

  try {
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "Offboarding_Finance_Clearance",
      toolName,
      toolsAccess as Record<string, number> | undefined,
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message:
          "You don't have permission to manage Finance clearance for offboarding",
      });
      return;
    }

    const financeClearanceResult = await outputSequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction: Transaction) => {
        return await financeClearanceService(empUuid, updatedBy, transaction);
      },
    );

    const action = financeClearanceResult.newStatus ? "granted" : "revoked";
    const message = `Finance clearance ${action} successfully for ${financeClearanceResult.employeeName}`;

    const response: FinanceClearanceResponse = {
      success: true,
      message,
      financeClearanceResult: financeClearanceResult,
    };
    res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("not found")) {
      res.status(404).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    if (errorMessage.includes("not initiated")) {
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to update Finance clearance. Please try again later.",
      error: errorMessage,
    });
  }
};

/**
 * Set last working day controller
 * @param req - The request
 * @param res - The response
 * @returns The last working day
 */
export const setLastWorkingDay = async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
  const toolName = hrmsConstants.HR_REPOSITORY;
  const { empUuid } =
    req.params as unknown as GetOffboardingInitiatedEmployeeDetailsParams;
  const { lastWorkingDay: lastWorkingDayStr } = req.body as {
    lastWorkingDay?: string;
  };

  if(!employeeUuid){
    res.status(400).json({
        success:false,
        message: "EmployeeID required to do this action!",
    })
    return;
  }

  if (!empUuid) {
    res.status(400).json({
      success: false,
      message: "Employee UUID is required",
    });
    return;
  }

  if (!lastWorkingDayStr || typeof lastWorkingDayStr !== "string") {
    res.status(400).json({
      success: false,
      message:
        "lastWorkingDay is required and must be a valid date string (e.g., YYYY-MM-DD or ISO 8601)",
    });
    return;
  }

  const lastWorkingDay = new Date(lastWorkingDayStr);
  if (Number.isNaN(lastWorkingDay.getTime())) {
    res.status(400).json({
      success: false,
      message: "lastWorkingDay must be a valid date",
    });
    return;
  }

  lastWorkingDay.setHours(0, 0, 0, 0);

  const updatedBy = employeeUuid as string;

  try {
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      ["Offboarding_HR_Clearance", "Offboarding_Finance_Clearance"],
      toolName,
      toolsAccess as Record<string, number> | undefined,
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message:
          "You don't have permission to set last working day for offboarding",
      });
      return;
    }

    const result = await outputSequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction: Transaction) => {
        return await setLastWorkingDayService(
          empUuid,
          lastWorkingDay,
          updatedBy,
          transaction,
        );
      },
    );

    res.status(200).json({
      success: true,
      message: `Last working day set to ${lastWorkingDayStr} for ${result.employeeName}`,
      data: {
        empUuid: result.empUuid,
        employeeName: result.employeeName,
        lastWorkingDay: result.lastWorkingDay,
        offboardingStatus: result.offboardingStatus,
        updatedBy: result.updatedBy,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("not found")) {
      res.status(404).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    if (errorMessage.includes("not initiated")) {
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to set last working day. Please try again later.",
      error: errorMessage,
    });
  }
};

/**
 * Approve offboarding controller.
 * Only allows approval when hrClearanceStatus=true, financeClearanceStatus=true and lastWorkingDay is set.
 */
export const approveOffboarding = async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
  const toolName = hrmsConstants.HR_REPOSITORY;
  const { empUuid } =
    req.params as unknown as GetOffboardingInitiatedEmployeeDetailsParams;

  if(!employeeUuid){
    res.status(400).json({
        success:false,
        message: "EmployeeID required to do this action!",
    })
    return;
  }

  if (!empUuid) {
    res.status(400).json({
      success: false,
      message: "Employee UUID is required",
    });
    return;
  }

  const updatedBy = employeeUuid as string;

  try {
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "Offboarding_Approve",
      toolName,
      toolsAccess as Record<string, number> | undefined,
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to approve offboarding",
      });
      return;
    }

    const result = await outputSequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction: Transaction) => {
        return await approveOffboardingService(empUuid, updatedBy, transaction);
      },
    );

    const response: ApproveOffboardingResponse = {
      success: true,
      message: `Offboarding approved successfully for ${result.employeeName}`,
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("not found")) {
      res.status(404).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    if (errorMessage.includes("not initiated")) {
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    if (
      errorMessage.includes("HR clearance must be completed") ||
      errorMessage.includes("Finance clearance must be completed") ||
      errorMessage.includes("Last working day must be set")
    ) {
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to approve offboarding. Please try again later.",
      error: errorMessage,
    });
  }
};

export const getAllOffboardedEmployees = async (
  req: Request,
  res: Response,
) => {
  const { user } = req as AuthenticatedRequest;
  const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
  const toolName = hrmsConstants.HR_REPOSITORY;

  try {
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "View_Offboarded_Employees",
      toolName,
      toolsAccess as Record<string, number> | undefined,
    );
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to get offboarded employees",
      });
      return;
    }

    const offboardedEmployees = await outputSequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction: Transaction) => {
        return await getAllOffboardedEmployeesService(transaction);
      },
    );
    res.status(200).json({
      success: true,
      message: "Offboarded employees fetched successfully",
      data: offboardedEmployees,
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      message: "Failed to get offboarded employees. Please try again later.",
      error: errorMessage,
    });
  }
};
