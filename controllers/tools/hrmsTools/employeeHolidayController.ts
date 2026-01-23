import { dbOutput } from "../../../models/index";
import { createUUIDV4 } from "../../../utilities/uuidV4Generator";
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";
import { AuthenticatedUser } from "../../../interfaces/hrmsTool/interface/hrmsInterface";
import { checkHrmsPermission } from "../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices";
import { hrmsConstants } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
const employeeHoliday = dbOutput.employeeHolidayDetails;

// Function to create a new holiday
export const CreateHoliday = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    // Check permission: admin access (>= 900) OR Holiday_Create permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "Holiday_Create",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to create holidays",
      });
      return;
    }

    const requestData = req.body;

    // Check if request is an array or single object
    const isArray = Array.isArray(requestData);
    const holidaysData = isArray ? requestData : [requestData];

    // Validate that we have data
    if (!holidaysData.length) {
      res.status(400).json({
        success: false,
        message: "No holiday data provided",
      });
      return;
    }

    // Validate each holiday entry
    const validationErrors: string[] = [];
    for (let i = 0; i < holidaysData.length; i++) {
      const holiday = holidaysData[i];
      const errors: string[] = [];

      if (!holiday.eventName) errors.push("eventName is required");
      if (!holiday.eventType) errors.push("eventType is required");
      if (!holiday.createdBy) errors.push("createdBy is required");

      if (errors.length > 0) {
        validationErrors.push(`Holiday ${i + 1}: ${errors.join(", ")}`);
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
      return;
    }

    // Prepare data for bulk creation
    const holidaysToCreate = await Promise.all(
      holidaysData.map(async (holiday) => ({
        holidayId: await createUUIDV4(),
        eventName: holiday.eventName,
        eventDate: holiday.eventDate,
        eventType: holiday.eventType,
        remarks: holiday.remarks,
        createdBy: holiday.createdBy,
      }))
    );

    // Create holidays (bulk insert for better performance)
    const createdHolidays = await employeeHoliday.bulkCreate(holidaysToCreate);

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdHolidays.length} holiday(s)`,
      data: isArray ? createdHolidays : createdHolidays[0],
      count: createdHolidays.length,
    });
    return;
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      res.status(422).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((e) => e.message),
      });
      return;
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      res.status(409).json({
        success: false,
        message: "Duplicate entry detected",
        errors: error.errors.map((e) => e.message),
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error. Please try again later.",
      error: error.message,
    });
    return;
  }
};

// Function to get all holidays
export const GetAllHolidays = async (req: Request, res: Response) => {
  try {
    // Note: Everyone can view holidays (no permission check needed for viewing)
    // If you want to restrict viewing, uncomment the following:
    // const { user } = req as AuthenticatedRequest;
    // const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    // const toolName = "HR Repository";
    // const hasPermission = await checkHrmsPermission(
    //   employeeUuid,
    //   "HolidayAdmin_view",
    //   toolName,
    //   toolsAccess as Record<string, number> | undefined
    // );
    // if (!hasPermission) {
    //   res.status(403).json({
    //     success: false,
    //     message: "You don't have permission to view holidays",
    //   });
    //   return;
    // }

    const holidays = await employeeHoliday.findAll({
      where: {
        isDeleted: false,
      },
    });

    if (!holidays || holidays.length === 0) {
      res.status(200).json({
        success: true,
        message: "No holidays found",
        data: holidays,
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: "Holidays retrieved successfully",
      data: holidays,
    });
    return;
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error. Please try again later.",
      error: error.message,
    });
    return;
  }
};

//function to Delete a Holiday
export const DeleteHoliday = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    // Check permission: admin access (>= 900) OR Holiday_Delete permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "Holiday_Delete",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to delete holidays",
      });
      return;
    }

    const { holidayIds } = req.body;
    
    // Validate input
    if (!holidayIds || !Array.isArray(holidayIds) || holidayIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "holidayIds array is required and cannot be empty",
      });
      return;
    }
    
    // Perform bulk soft delete directly
    const [updatedCount] = await employeeHoliday.update(
      { isDeleted: true },
      { 
        where: { 
          holidayId: holidayIds,
          isDeleted: false 
        } 
      }
    );
    
    if (updatedCount === 0) {
      res.status(404).json({
        success: false,
        message: "No such holidays found to delete",
      });
      return;
    }
    
    // Simple response
    const response = {
      success: true,
      message: `Successfully deleted ${updatedCount} holiday(s)`,
      data: {
        deletedCount: updatedCount,
      }
    };
    
    res.status(200).json(response);
    return;
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error. Please try again later.",
      error: error.message,
    });
    return;
  }
};

type HolidayUpdate = {
  holidayId: string;
  eventName?: string;
  eventDate?: string;
  eventType?: string;
  remarks?: string;
  createdBy?: string;
};

export const UpdateHoliday = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    // Check permission: admin access (>= 900) OR Holiday_Update permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "Holiday_Update",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to update holidays",
      });
      return;
    }

    const holidaysData: HolidayUpdate[] = req.body;

    // Validate input
    if (!Array.isArray(holidaysData) || holidaysData.length === 0) {
      res.status(400).json({
        success: false,
        message: "Request body must be a non-empty array of holidays",
      });
      return;
    }

    const validationErrors: string[] = [];
    const updateResults: { holidayId: string; updated: boolean }[] = [];

    for (let i = 0; i < holidaysData.length; i++) {
      const holiday = holidaysData[i];
      if (!holiday.holidayId) {
        validationErrors.push(`Holiday ${i + 1}: holidayId is required`);
        continue;
      }

      // Prepare update fields
      const updateFields: Partial<HolidayUpdate> = {};
      if (holiday.eventName !== undefined) updateFields.eventName = holiday.eventName;
      if (holiday.eventDate !== undefined) updateFields.eventDate = holiday.eventDate;
      if (holiday.eventType !== undefined) updateFields.eventType = holiday.eventType;
      if (holiday.remarks !== undefined) updateFields.remarks = holiday.remarks;
      if (holiday.createdBy !== undefined) updateFields.createdBy = holiday.createdBy;

      // Only update if there are fields to update
      if (Object.keys(updateFields).length === 0) {
        validationErrors.push(`Holiday ${i + 1}: No fields to update`);
        continue;
      }

      // Perform update
      const [updatedCount] = await employeeHoliday.update(
        updateFields,
        {
          where: {
            holidayId: holiday.holidayId,
            isDeleted: false,
          },
        }
      );

      updateResults.push({
        holidayId: holiday.holidayId,
        updated: updatedCount > 0,
      });
    }

    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
        results: updateResults,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Holidays updated successfully",
      results: updateResults,
    });
    return;
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error. Please try again later.",
      error: error.message,
    });
    return;
  }
};