import { Request, Response } from "express";
import { Op } from "sequelize";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";
import { AuthenticatedUser } from "../../../interfaces/hrmsTool/interface/hrmsInterface";
import { checkHrmsPermission } from "../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices";
import { hrmsConstants, SecondaryLocationLogStatus } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import { dbOutput } from "../../../models/index";
import {
  createSecondaryLocationConfigService,
  listSecondaryLocationConfigsService,
  updateSecondaryLocationConfigService,
  deleteSecondaryLocationConfigService,
  getEmployeeLocationSummaryService,
  createSecondaryLocationLogService,
  listSecondaryLocationLogsService,
  updateSecondaryLocationLogService,
  deleteSecondaryLocationLogService,
  listSecondaryLocationRequestsService,
  reviewSecondaryLocationRequestService,
} from "../../../utilities/hrmsUtilities/dbCalls/secondaryLocationDbCalls";

const toolName = hrmsConstants.HR_REPOSITORY;
const DUPLICATE_CONFIG_LOCATION_MESSAGE = "Configuration for this location already exists";

const getParamString = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
};

const secondaryLocationLogModel = dbOutput.secondaryLocationLog;

export const markSecondaryLocationLogsAsCompleted = async (): Promise<{ updatedCount: number }> => {
  if (!secondaryLocationLogModel) {
    throw new Error("Secondary location log model not initialized");
  }

  // `endDate` is DATEONLY; compare against a UTC YYYY-MM-DD string.
  const todayUtc = new Date().toISOString().slice(0, 10);

  const result = await secondaryLocationLogModel.update(
    {
      status: SecondaryLocationLogStatus.COMPLETED,
    },
    {
      where: {
        isDeleted: false,
        endDate: {
          [Op.lt]: todayUtc,
        },
        status: {
          [Op.notIn]: [SecondaryLocationLogStatus.COMPLETED, SecondaryLocationLogStatus.REJECTED],
        },
      },
    }
  );

  // Sequelize can return [affectedCount] or [affectedCount, affectedRows] depending on dialect/options.
  const affected = Array.isArray(result) ? Number(result[0]) : Number(result);
  return { updatedCount: Number.isFinite(affected) ? affected : 0 };
};

const hasPermission = async (
  user: AuthenticatedUser,
  permissionName: string
): Promise<boolean> => {
  return checkHrmsPermission(
    user?.employeeUuid,
    permissionName,
    toolName,
    user?.toolsAccess as Record<string, number> | undefined
  );
};

export const createSecondaryLocationConfig = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    if (!(await hasPermission(user as AuthenticatedUser, "SecondaryLocationConfig_create"))) {
      res.status(403).json({ success: false, message: "You don't have permission to create location config" });
      return;
    }

    const employeeUuid = (user as AuthenticatedUser)?.employeeUuid;
    const configId = await createSecondaryLocationConfigService(req.body, employeeUuid || "");

    res.status(201).json({ success: true, message: "Secondary location config created", configId });
  } catch (error) {
    const message = (error as Error).message;
    if (message === DUPLICATE_CONFIG_LOCATION_MESSAGE) {
      res.status(409).json({ success: false, message });
      return;
    }

    res.status(500).json({ success: false, message });
  }
};

export const getSecondaryLocationConfigs = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    if (!(await hasPermission(user as AuthenticatedUser, "SecondaryLocationConfig_read"))) {
      res.status(403).json({ success: false, message: "You don't have permission to view location config" });
      return;
    }

    const employeeTypes = (req.query.employeeTypes as string | undefined)
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const data = await listSecondaryLocationConfigsService({
      search: (req.query.search as string | undefined) || "",
      employeeTypes,
      sortBy: (req.query.sortBy as "durationWeeks" | "maximumSplitsPerYear" | "createdAt") || "createdAt",
      sortOrder: (req.query.sortOrder as "ASC" | "DESC") || "DESC",
      lastId:
        (req.query.last_id as string | undefined) ||
        (req.query.lastId as string | undefined) ||
        "",
      limit: req.query.limit ? Number(req.query.limit) : 10,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updateSecondaryLocationConfig = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    if (!(await hasPermission(user as AuthenticatedUser, "SecondaryLocationConfig_update"))) {
      res.status(403).json({ success: false, message: "You don't have permission to update location config" });
      return;
    }

    const configId = getParamString(req.params.configId);
    const updated = await updateSecondaryLocationConfigService(configId, req.body);
    if (!updated) {
      res.status(404).json({ success: false, message: "Configuration not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Configuration updated" });
  } catch (error) {
    const message = (error as Error).message;
    if (message === DUPLICATE_CONFIG_LOCATION_MESSAGE) {
      res.status(409).json({ success: false, message });
      return;
    }

    res.status(500).json({ success: false, message });
  }
};

export const deleteSecondaryLocationConfig = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    if (!(await hasPermission(user as AuthenticatedUser, "SecondaryLocationConfig_delete"))) {
      res.status(403).json({ success: false, message: "You don't have permission to delete location config" });
      return;
    }

    const configId = getParamString(req.params.configId);
    const deleted = await deleteSecondaryLocationConfigService(configId);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Configuration not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Configuration deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getSecondaryLocationOverview = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const requestedEmployeeUuid = req.query.employeeUuid as string | undefined;
    const actorUuid = (user as AuthenticatedUser)?.employeeUuid || "";
    const targetEmployeeUuid = requestedEmployeeUuid || actorUuid;

    if (requestedEmployeeUuid && requestedEmployeeUuid !== actorUuid) {
      const canAccessOthers = await hasPermission(user as AuthenticatedUser, "SecondaryLocationLogOthers_create");
      if (!canAccessOthers) {
        res.status(403).json({ success: false, message: "You don't have permission to view logs for other employees" });
        return;
      }
    }

    const summary = await getEmployeeLocationSummaryService(targetEmployeeUuid);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const createSecondaryLocationLog = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const actorUuid = (user as AuthenticatedUser)?.employeeUuid || "";
    const targetEmployeeUuid = req.body.employeeUuid || actorUuid;

    if (!actorUuid) {
      res.status(400).json({ success: false, message: "Unable to resolve acting employee" });
      return;
    }

    if (targetEmployeeUuid !== actorUuid) {
      const canMarkForOthers = await hasPermission(user as AuthenticatedUser, "SecondaryLocationLogOthers_create");
      if (!canMarkForOthers) {
        res.status(403).json({ success: false, message: "You don't have permission to create logs for other employees" });
        return;
      }
    }

    const data = await createSecondaryLocationLogService(
      { ...req.body, employeeUuid: targetEmployeeUuid },
      actorUuid
    );

    res.status(201).json({ success: true, message: "Secondary location log submitted", data });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getSecondaryLocationLogs = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const actorUuid = (user as AuthenticatedUser)?.employeeUuid || "";
    const requestedEmployeeUuid = req.query.employeeUuid as string | undefined;
    const targetEmployeeUuid = requestedEmployeeUuid || actorUuid;

    if (requestedEmployeeUuid && requestedEmployeeUuid !== actorUuid) {
      const canReadOthers = await hasPermission(user as AuthenticatedUser, "SecondaryLocationLogOthers_create");
      if (!canReadOthers) {
        res.status(403).json({ success: false, message: "You don't have permission to view logs for other employees" });
        return;
      }
    }

    const cursorLastId =
      (req.query.last_id as string | undefined) ||
      (req.query.lastId as string | undefined) ||
      (req.query.cursor as string | undefined) ||
      "";

    const statuses = (req.query.status as string | undefined)?.split(",").filter(Boolean);
    const data = await listSecondaryLocationLogsService(targetEmployeeUuid, {
      month: req.query.month ? Number(req.query.month) : undefined,
      year: req.query.year ? Number(req.query.year) : undefined,
      statuses,
      sortBy: (req.query.sortBy as "startDate" | "endDate" | "createdAt") || "createdAt",
      sortOrder: (req.query.sortOrder as "ASC" | "DESC") || "DESC",
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 10,
      lastId: cursorLastId,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const updateSecondaryLocationLog = async (req: Request, res: Response) => {
  try {
    const logId = getParamString(req.params.logId);
    const updated = await updateSecondaryLocationLogService(logId, req.body);
    if (!updated.updated) {
      res.status(404).json({ success: false, message: "Log not found" });
      return;
    }

    res.status(200).json({ success: true, message: `Log updated (${updated.status})` });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const deleteSecondaryLocationLog = async (req: Request, res: Response) => {
  try {
    const logId = getParamString(req.params.logId);
    const deleted = await deleteSecondaryLocationLogService(logId, req.body.reason);

    if (!deleted.deleted) {
      res.status(404).json({ success: false, message: "Log not found" });
      return;
    }

    res.status(200).json({ success: true, message: `Log delete processed (${deleted.status})` });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getSecondaryLocationRequests = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const canRead = await hasPermission(user as AuthenticatedUser, "SecondaryLocationRequests_read");
    if (!canRead) {
      res.status(403).json({ success: false, message: "You don't have permission to view location requests" });
      return;
    }

    const requestTypes = (req.query.requestType as string | undefined)?.split(",").filter(Boolean);
    const statuses = (req.query.status as string | undefined)?.split(",").filter(Boolean);
    const cursorLastId =
      (req.query.last_id as string | undefined) ||
      (req.query.lastId as string | undefined) ||
      "";

    const data = await listSecondaryLocationRequestsService({
      month: req.query.month ? Number(req.query.month) : undefined,
      year: req.query.year ? Number(req.query.year) : undefined,
      requestTypes,
      statuses,
      pendingOnly: (req.query.pendingOnly as string) === "true",
      sortBy:
        (req.query.sortBy as "startDate" | "endDate" | "createdAt" | "durationDays" | "employeeName") ||
        "createdAt",
      sortOrder: (req.query.sortOrder as "ASC" | "DESC") || "DESC",
      limit: req.query.limit ? Number(req.query.limit) : 20,
      lastId: cursorLastId,
    });

    res.status(200).json({ success: true, data: data.requests, meta: data.meta });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const reviewSecondaryLocationRequest = async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const canWrite = await hasPermission(user as AuthenticatedUser, "SecondaryLocationRequests_write");
    if (!canWrite) {
      res.status(403).json({ success: false, message: "You don't have permission to review location requests" });
      return;
    }

    const reviewerEmpUuid = (user as AuthenticatedUser)?.employeeUuid || "";
    const requestId = getParamString(req.params.requestId);
    const result = await reviewSecondaryLocationRequestService(requestId, req.body, reviewerEmpUuid);

    if (!result.updated) {
      res.status(404).json({ success: false, message: "Request not found or already actioned" });
      return;
    }

    res.status(200).json({ success: true, message: `Request ${result.status}` });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};


export const markSecondaryLocationComplete = async(req: Request, res: Response) => {
  try {
    const { updatedCount } = await markSecondaryLocationLogsAsCompleted();
    res.status(200).json({ success: true, message: `Marked ${updatedCount} log(s) as completed`, updatedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
}