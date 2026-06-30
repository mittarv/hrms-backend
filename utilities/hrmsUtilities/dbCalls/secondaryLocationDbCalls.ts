import { Op, Transaction, WhereOptions } from "sequelize";
import { dbOutput, outputSequelize } from "../../../models";
import {
  SecondaryLocationLogAttributes,
  SecondaryLocationRequestAttributes,
} from "../../../interfaces/hrmsTool/interface/hrmsInterface";
import {
  SecondaryLocationLogStatus,
  SecondaryLocationRequestStatus,
  SecondaryLocationRequestType,
} from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import { createUUIDV4 } from "../../uuidV4Generator";

const configureSecondaryLocation = dbOutput.configureSecondaryLocation;
const configEmployeeType = dbOutput.configEmployeeType;
const secondaryLocationLog = dbOutput.secondaryLocationLog;
const secondaryLocationRequest = dbOutput.secondaryLocationRequest;
const employeeAddressDetails = dbOutput.employeeAddressDetails;
const employeeJobDetails = dbOutput.employeeJobDetails;
const employeeBasicDetails = dbOutput.employeeBasicDetails;
const employeeComponentConfigurator = dbOutput.employeeComponentConfigurator;

const DAY_MS = 24 * 60 * 60 * 1000;

const SECONDARY_LOCATION_CONSTANTS = {
  COMPONENT_TYPE: {
    EMP_TYPE: "emp_type_dropdown",
    LOCATION: "location_dropdown",
  },
  DEFAULTS: {
    SORT_BY: "createdAt" as const,
    SORT_ORDER: "DESC" as const,
    REVIEW_SORT_BY: "reviewedAt" as const,
    REVIEW_SORT_ORDER: "DESC" as const,
    PAGE: 1,
    LIMIT: 10,
  },
  REVIEW_ACTION: {
    APPROVE: "approve" as const,
    REJECT: "reject" as const,
  },
  RESPONSE_STATUS: {
    APPROVED: "Approved",
    PENDING_APPROVAL: "Pending Approval",
    DELETED: "Deleted",
    REJECTED: "Rejected",
  },
  ERROR: {
    INVALID_DATE: "Invalid startDate or endDate",
    INVALID_DATE_RANGE: "endDate should be greater than or equal to startDate",
    REASON_REQUIRED_EDIT: "Reason is required for edit request",
    REASON_REQUIRED_DELETE: "Reason is required for delete request",
    COMPLETED_LOG_ACTION_NOT_ALLOWED: "Completed logs cannot be edited or deleted",
    REJECTION_REASON_REQUIRED: "Rejection reason is required",
    DUPLICATE_CONFIG_LOCATION: "Configuration for this location already exists",
  },
};

type ListOptions = {
  month?: number;
  year?: number;
  statuses?: string[];
  sortBy?: "startDate" | "endDate" | "createdAt" | "durationDays" | "employeeName";
  sortOrder?: "ASC" | "DESC";
  page?: number;
  limit?: number;
  lastId?: string;
};

type SecondaryLocationConfigPayload = {
  location: string;
  durationWeeks: number;
  maximumSplitsPerYear: number;
  minimumIntimationPeriodDays: number;
  employeeTypes: string[];
};

type ConfigListOptions = {
  search?: string;
  employeeTypes?: string[];
  sortBy?: "durationWeeks" | "maximumSplitsPerYear" | "createdAt";
  sortOrder?: "ASC" | "DESC";
  lastId?: string;
  limit?: number;
};

type LogPayload = {
  employeeUuid: string;
  secondaryLocation?: string;
  startDate: string;
  endDate: string;
  reason?: string;
};

type ReviewPayload = {
  action:
    | typeof SECONDARY_LOCATION_CONSTANTS.REVIEW_ACTION.APPROVE
    | typeof SECONDARY_LOCATION_CONSTANTS.REVIEW_ACTION.REJECT;
  rejectionReason?: string;
};

type ComponentValueMap = Record<string, string>;

const fetchComponentValueMap = async (componentType: string): Promise<ComponentValueMap> => {
  const row = await employeeComponentConfigurator.findOne({
    where: {
      componentType,
      isDeleted: false,
    },
    attributes: ["componentValue"],
    raw: true,
  });

  if (!row?.componentValue) {
    throw new Error(`Missing component configuration for ${componentType}`);
  }

  try {
    return JSON.parse(row.componentValue) as ComponentValueMap;
  } catch {
    throw new Error(`Invalid JSON configuration for ${componentType}`);
  }
};

const resolveComponentKey = (input: string, map: ComponentValueMap, componentType: string): string => {
  if (!input?.trim()) {
    throw new Error(`Invalid ${componentType} input`);
  }

  const normalizedInput = input.trim();
  if (map[normalizedInput]) {
    return normalizedInput;
  }

  const matchedKey = Object.entries(map).find(([, label]) => label === normalizedInput)?.[0];
  if (matchedKey) {
    return matchedKey;
  }

  throw new Error(`Unsupported ${componentType} value: ${normalizedInput}`);
};

const toDayStart = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDurationDays = (startDate: Date, endDate: Date): number => {
  return Math.floor((toDayStart(endDate).getTime() - toDayStart(startDate).getTime()) / DAY_MS) + 1;
};

const getYearRangeForDate = (date: Date): { yearStart: Date; yearEnd: Date } => {
  const year = date.getFullYear();
  return {
    yearStart: new Date(year, 0, 1),
    yearEnd: new Date(year, 11, 31),
  };
};

const getLifecycleStatus = (startDate: Date, endDate: Date): SecondaryLocationLogStatus => {
  const today = toDayStart(new Date());
  const start = toDayStart(startDate);
  const end = toDayStart(endDate);

  if (end.getTime() < today.getTime()) return SecondaryLocationLogStatus.COMPLETED;
  if (start.getTime() > today.getTime()) return SecondaryLocationLogStatus.UPCOMING;
  return SecondaryLocationLogStatus.ACTIVE;
};

const normalizeEmployeeTypes = async (employeeTypes: string[]): Promise<string[]> => {
  const employeeTypeMap = await fetchComponentValueMap(SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.EMP_TYPE);
  return employeeTypes.map((value) =>
    resolveComponentKey(value, employeeTypeMap, SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.EMP_TYPE)
  );
};

const getApplicableConfigForEmployee = async (
  employeeUuid: string,
  preferredLocationKey?: string
): Promise<{
  config: {
    durationWeeks: number;
    maximumSplitsPerYear: number;
    minimumIntimationPeriodDays: number;
  } | null;
  matchedLocationKey: string | null;
}> => {
  const locationMap = await fetchComponentValueMap(SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION);
  const employeeTypeMap = await fetchComponentValueMap(SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.EMP_TYPE);

  const [address, job] = await Promise.all([
    employeeAddressDetails.findOne({
      where: { empUuid: employeeUuid },
      attributes: ["state", "secondaryLocation"],
      raw: true,
    }),
    employeeJobDetails.findOne({
      where: { empUuid: employeeUuid, isDeleted: false },
      attributes: ["empType"],
      raw: true,
    }),
  ]);

  const employeeTypeKey = resolveComponentKey(
    String(job?.empType || ""),
    employeeTypeMap,
    SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.EMP_TYPE
  );

  const candidateLocationKeys = Array.from(
    new Set(
      [preferredLocationKey, String(address?.state || "").trim()]
        .filter(Boolean)
        .map((value) => {
          try {
            return resolveComponentKey(
              value as string,
              locationMap,
              SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION
            );
          } catch {
            return null;
          }
        })
        .filter(Boolean) as string[]
    )
  );

  if (!candidateLocationKeys.length) {
    return { config: null, matchedLocationKey: null };
  }

  const configRows = await configureSecondaryLocation.findAll({
    where: {
      location: {
        [Op.in]: candidateLocationKeys,
      },
      isDeleted: false,
    },
    include: [
      {
        model: configEmployeeType,
        as: "employeeTypes",
        attributes: ["employeeType"],
        required: true,
      },
    ],
    raw: false,
  });

  for (const locationKey of candidateLocationKeys) {
    const matchingConfig = configRows.find((cfg) => {
      const assignedTypes = (cfg as { employeeTypes?: Array<{ employeeType: string }> }).employeeTypes || [];
      return (
        String((cfg as { location: string }).location) === locationKey &&
        assignedTypes.some((typeRow) => typeRow.employeeType === employeeTypeKey)
      );
    });

    if (matchingConfig) {
      return {
        config: {
          durationWeeks: Number(matchingConfig.durationWeeks) || 0,
          maximumSplitsPerYear: Number(matchingConfig.maximumSplitsPerYear) || 0,
          minimumIntimationPeriodDays: Number(matchingConfig.minimumIntimationPeriodDays) || 0,
        },
        matchedLocationKey: locationKey,
      };
    }
  }

  return { config: null, matchedLocationKey: null };
};

const resolveIntimationEligibility = async (
  employeeUuid: string,
  startDate: Date
): Promise<{ withinIntimation: boolean; minimumIntimationPeriodDays: number }> => {
  const { config } = await getApplicableConfigForEmployee(employeeUuid);
  const minDays = Number(config?.minimumIntimationPeriodDays) || 0;

  const today = toDayStart(new Date());
  const daysToStart = Math.floor((toDayStart(startDate).getTime() - today.getTime()) / DAY_MS);
  return {
    withinIntimation: daysToStart >= minDays,
    minimumIntimationPeriodDays: minDays,
  };
};

const validatePolicyConstraintsForLog = async (
  employeeUuid: string,
  startDate: Date,
  endDate: Date,
  excludeLogId?: string
): Promise<void> => {
  const { config } = await getApplicableConfigForEmployee(employeeUuid);
  if (!config) return;

  const requiredDurationDays = (Number(config.durationWeeks) || 0) * 5;
  const maximumSplitsPerYear = Number(config.maximumSplitsPerYear) || 0;
  const selectedDurationDays = getDurationDays(startDate, endDate);

  if (requiredDurationDays <= 0) return;

  const { yearStart, yearEnd } = getYearRangeForDate(startDate);
  const existingLogs = await secondaryLocationLog.findAll({
    where: {
      employeeUuid,
      isDeleted: false,
      status: {
        [Op.ne]: SecondaryLocationLogStatus.REJECTED,
      },
      ...(excludeLogId
        ? {
            logId: {
              [Op.ne]: excludeLogId,
            },
          }
        : {}),
      startDate: {
        [Op.between]: [yearStart, yearEnd],
      },
    },
    attributes: ["durationDays", "logId"],
    raw: true,
  });

  const usedDurationDays = existingLogs.reduce(
    (sum: number, log: { durationDays: number }) => sum + (Number(log.durationDays) || 0),
    0
  );
  const usedSplits = existingLogs.length;
  const remainingDurationDays = Math.max(requiredDurationDays - usedDurationDays, 0);

  if (selectedDurationDays > remainingDurationDays) {
    throw new Error(
      "You have reached the maximum allotted Work From Office duration. Please adjust the selected dates."
    );
  }

  if (maximumSplitsPerYear > 0) {
    if (usedSplits >= maximumSplitsPerYear) {
      throw new Error(
        "You are allowed up to the configured period splits annually. You have no split remaining. Please adjust the selected dates."
      );
    }
  }
};

const validateNoOverlappingLogs = async (
  employeeUuid: string,
  startDate: Date,
  endDate: Date,
  excludeLogId?: string
): Promise<void> => {
  const overlappingLog = await secondaryLocationLog.findOne({
    where: {
      employeeUuid,
      isDeleted: false,
      status: {
        [Op.ne]: SecondaryLocationLogStatus.REJECTED,
      },
      ...(excludeLogId
        ? {
            logId: {
              [Op.ne]: excludeLogId,
            },
          }
        : {}),
      [Op.and]: [
        {
          startDate: {
            [Op.lte]: endDate,
          },
        },
        {
          endDate: {
            [Op.gte]: startDate,
          },
        },
      ],
    },
    attributes: ["logId", "startDate", "endDate"],
    raw: true,
  });

  if (overlappingLog) {
    throw new Error("Selected dates overlap with an existing secondary location log. Please adjust the dates.");
  }
};

const getEmployeeSecondaryLocationContext = async (
  employeeUuid: string,
  requestedLocation?: string
): Promise<{
  secondaryLocationKey: string;
  secondaryLocationLabel: string;
  primaryLocationKey: string | null;
  primaryLocationLabel: string | null;
  isSecondarySameAsPrimary: boolean;
}> => {
  const locationMap = await fetchComponentValueMap(SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION);
  const address = await employeeAddressDetails.findOne({
    where: { empUuid: employeeUuid },
    attributes: ["state", "secondaryLocation", "isSecondarySameAsPrimary"],
    raw: true,
  });

  const secondaryLocationRaw = String(address?.secondaryLocation || "").trim();
  const isSecondarySameAsPrimary = Boolean(address?.isSecondarySameAsPrimary);

  if (!secondaryLocationRaw) {
    throw new Error("Please set your secondary location before logging dates");
  }

  if (isSecondarySameAsPrimary) {
    throw new Error("You are not eligible for secondary location logs because it is marked as same as primary location");
  }

  // Secondary location is employee-entered city/state (e.g. "Bihar"),
  // not necessarily a policy/location-dropdown key. Keep and validate it as raw text.
  const secondaryLocationKey = secondaryLocationRaw;

  if (requestedLocation?.trim()) {
    const requestedKey = requestedLocation.trim();
    if (requestedKey.toLowerCase() !== secondaryLocationKey.toLowerCase()) {
      throw new Error("Logged location must match the employee's configured secondary location");
    }
  }

  const primaryLocationRaw = String(address?.state || "").trim();
  let primaryLocationKey: string | null = null;
  if (primaryLocationRaw) {
    try {
      primaryLocationKey = resolveComponentKey(
        primaryLocationRaw,
        locationMap,
        SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION
      );
    } catch {
      primaryLocationKey = null;
    }
  }

  return {
    secondaryLocationKey,
    secondaryLocationLabel: locationMap[secondaryLocationKey] || secondaryLocationRaw,
    primaryLocationKey,
    primaryLocationLabel: primaryLocationKey ? locationMap[primaryLocationKey] || primaryLocationRaw : null,
    isSecondarySameAsPrimary,
  };
};

const ensureEmployeeConfigAvailability = async (
  employeeUuid: string,
  preferredLocationKey?: string | null,
  preferredLocationLabel?: string | null
): Promise<void> => {
  const { config } = await getApplicableConfigForEmployee(
    employeeUuid,
    preferredLocationKey || undefined
  );

  if (config) return;

  const locationLabel = String(preferredLocationLabel || "selected location").trim() || "selected location";
  throw new Error(`Configuration for ${locationLabel} is not available`);
};

export const createSecondaryLocationConfigService = async (
  payload: SecondaryLocationConfigPayload,
  createdBy: string
) => {
  const tx = await outputSequelize.transaction();
  try {
    const configId = await createUUIDV4();
    const locationMap = await fetchComponentValueMap(SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION);
    const locationKey = resolveComponentKey(
      payload.location,
      locationMap,
      SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION
    );

    const existingConfig = await configureSecondaryLocation.findOne({
      where: {
        location: locationKey,
        isDeleted: false,
      },
      attributes: ["configId"],
      transaction: tx,
      raw: true,
    });

    if (existingConfig) {
      throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.DUPLICATE_CONFIG_LOCATION);
    }

    const employeeTypeKeys = await normalizeEmployeeTypes(payload.employeeTypes || []);

    await configureSecondaryLocation.create(
      {
        configId,
        location: locationKey,
        durationWeeks: payload.durationWeeks,
        maximumSplitsPerYear: payload.maximumSplitsPerYear,
        minimumIntimationPeriodDays: payload.minimumIntimationPeriodDays,
        createdBy,
        isDeleted: false,
      },
      { transaction: tx }
    );

    if (employeeTypeKeys?.length) {
      const typeRows = await Promise.all(
        employeeTypeKeys.map(async (employeeType: string) => ({
          id: await createUUIDV4(),
          configId,
          employeeType,
        }))
      );
      await configEmployeeType.bulkCreate(typeRows, { transaction: tx });
    }

    await tx.commit();
    return configId;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const listSecondaryLocationConfigsService = async (options: ConfigListOptions = {}) => {
  const limit =
    options.limit && options.limit > 0
      ? options.limit
      : SECONDARY_LOCATION_CONSTANTS.DEFAULTS.LIMIT;

  const whereClause: WhereOptions = { isDeleted: false };

  const searchTerm = options.search?.trim().toLowerCase() || "";
  if (searchTerm) {
    const locationMap = await fetchComponentValueMap(SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION);
    const matchedLocationKeys = Object.entries(locationMap)
      .filter(([key, label]) => {
        const keyValue = String(key || "").toLowerCase();
        const labelValue = String(label || "").toLowerCase();
        return keyValue.includes(searchTerm) || labelValue.includes(searchTerm);
      })
      .map(([key]) => key);

    if (!matchedLocationKeys.length) {
      return {
        limit,
        data: [],
        nextLastId: null,
        hasNext: false,
      };
    }

    whereClause.location = { [Op.in]: matchedLocationKeys };
  }

  const employeeTypeFilter = options.employeeTypes?.length
    ? await normalizeEmployeeTypes(options.employeeTypes)
    : [];

  const sortBy = options.sortBy || SECONDARY_LOCATION_CONSTANTS.DEFAULTS.SORT_BY;
  const sortOrder = options.sortOrder || SECONDARY_LOCATION_CONSTANTS.DEFAULTS.SORT_ORDER;
  const lastId = options.lastId?.trim() || "";

  if (lastId) {
    const anchorRow = (await configureSecondaryLocation.findOne({
      where: { configId: lastId, isDeleted: false },
      attributes: ["configId", sortBy],
      raw: true,
    })) as
      | {
          configId: string;
          createdAt?: Date | string;
          durationWeeks?: number;
          maximumSplitsPerYear?: number;
        }
      | null;

    if (anchorRow) {
      const anchorSortValue =
        sortBy === "createdAt"
          ? new Date(anchorRow.createdAt || new Date())
          : sortBy === "durationWeeks"
            ? Number(anchorRow.durationWeeks || 0)
            : Number(anchorRow.maximumSplitsPerYear || 0);

      const sortComparator = sortOrder === "ASC" ? Op.gt : Op.lt;

      const cursorWhere = whereClause as WhereOptions & { [Op.and]?: unknown[] };
      cursorWhere[Op.and] = [
        {
          [Op.or]: [
            {
              [sortBy]: {
                [sortComparator]: anchorSortValue,
              },
            },
            {
              [sortBy]: anchorSortValue,
              configId: {
                [sortComparator]: anchorRow.configId,
              },
            },
          ],
        },
      ];
    }
  }

  const rows = await configureSecondaryLocation.findAll({
    where: whereClause,
    include: [
      {
        model: configEmployeeType,
        as: "employeeTypes",
        attributes: ["id", "employeeType"],
        required: employeeTypeFilter.length > 0,
        ...(employeeTypeFilter.length
          ? {
              where: {
                employeeType: {
                  [Op.in]: employeeTypeFilter,
                },
              },
            }
          : {}),
      },
    ],
    order: [
      [sortBy, sortOrder],
      ["configId", sortOrder],
    ],
    limit: limit + 1,
  });

  const hasNext = rows.length > limit;
  const pagedRows = hasNext ? rows.slice(0, limit) : rows;
  const lastRow = pagedRows[pagedRows.length - 1] as
    | {
        configId: string;
        createdAt?: Date;
        durationWeeks?: number;
        maximumSplitsPerYear?: number;
      }
    | undefined;

  const nextLastId = hasNext && lastRow ? lastRow.configId : null;

  return {
    limit,
    data: pagedRows,
    nextLastId,
    hasNext,
  };
};

export const updateSecondaryLocationConfigService = async (
  configId: string,
  payload: SecondaryLocationConfigPayload
) => {
  const tx = await outputSequelize.transaction();
  try {
    const config = await configureSecondaryLocation.findOne({
      where: { configId, isDeleted: false },
      transaction: tx,
    });

    if (!config) return false;

    const locationMap = await fetchComponentValueMap(SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION);
    const locationKey = resolveComponentKey(
      payload.location,
      locationMap,
      SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION
    );

    const duplicateConfig = await configureSecondaryLocation.findOne({
      where: {
        location: locationKey,
        isDeleted: false,
        configId: {
          [Op.ne]: configId,
        },
      },
      attributes: ["configId"],
      transaction: tx,
      raw: true,
    });

    if (duplicateConfig) {
      throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.DUPLICATE_CONFIG_LOCATION);
    }

    const employeeTypeKeys = await normalizeEmployeeTypes(payload.employeeTypes || []);

    await configureSecondaryLocation.update(
      {
        location: locationKey,
        durationWeeks: payload.durationWeeks,
        maximumSplitsPerYear: payload.maximumSplitsPerYear,
        minimumIntimationPeriodDays: payload.minimumIntimationPeriodDays,
      },
      { where: { configId }, transaction: tx }
    );

    await configEmployeeType.destroy({ where: { configId }, transaction: tx });

    const typeRows = await Promise.all(
      employeeTypeKeys.map(async (employeeType: string) => ({
        id: await createUUIDV4(),
        configId,
        employeeType,
      }))
    );

    if (typeRows.length) {
      await configEmployeeType.bulkCreate(typeRows, { transaction: tx });
    }

    await tx.commit();
    return true;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const deleteSecondaryLocationConfigService = async (configId: string) => {
  const [updated] = await configureSecondaryLocation.update(
    { isDeleted: true },
    { where: { configId, isDeleted: false } }
  );
  return updated > 0;
};

export const getEmployeeLocationSummaryService = async (employeeUuid: string) => {
  const [address, logs, locationMap, job] = await Promise.all([
    employeeAddressDetails.findOne({
      where: { empUuid: employeeUuid },
      attributes: ["state", "secondaryLocation", "isSecondarySameAsPrimary"],
      raw: true,
    }),
    secondaryLocationLog.findAll({
      where: { employeeUuid, isDeleted: false },
      attributes: ["logId"],
      raw: true,
    }),
    fetchComponentValueMap(SECONDARY_LOCATION_CONSTANTS.COMPONENT_TYPE.LOCATION),
    employeeJobDetails.findOne({
      where: { empUuid: employeeUuid, isDeleted: false },
      attributes: ["empType"],
      raw: true,
    }),
  ]);

  const toLocationLabel = (value?: string | null) => {
    const normalized = String(value || "").trim();
    if (!normalized) return null;

    if (locationMap[normalized]) {
      return locationMap[normalized];
    }

    const matched = Object.entries(locationMap).find(([, label]) => label === normalized);
    return matched?.[1] || normalized;
  };

  const toLocationKey = (value?: string | null) => {
    const normalized = String(value || "").trim();
    if (!normalized) return null;

    if (locationMap[normalized]) return normalized;
    const matched = Object.entries(locationMap).find(([, label]) => label === normalized);
    return matched?.[0] || null;
  };

  const secondaryLocationRaw = String(address?.secondaryLocation || "").trim();
  const secondaryLocationKey = toLocationKey(address?.secondaryLocation);
  const primaryLocationKey = toLocationKey(address?.state);
  const secondaryLocationLabel = toLocationLabel(address?.secondaryLocation);
  const primaryLocationLabel = toLocationLabel(address?.state);
  const isSecondarySameAsPrimary = Boolean(address?.isSecondarySameAsPrimary);

  let isEligible = true;
  let eligibilityMessage: string | null = null;

  if (!secondaryLocationRaw) {
    isEligible = false;
    eligibilityMessage = "Please set your secondary location to continue";
  } else if (isSecondarySameAsPrimary) {
    isEligible = false;
    eligibilityMessage = "You are not eligible for secondary location logs because your secondary location is marked same as primary";
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);

  const yearlyLogs = await secondaryLocationLog.findAll({
    where: {
      employeeUuid,
      isDeleted: false,
      startDate: {
        [Op.between]: [yearStart, yearEnd],
      },
    },
    attributes: ["durationDays", "status"],
    raw: true,
  });

  const usableLogs = yearlyLogs.filter(
    (log: { status: SecondaryLocationLogStatus }) => log.status !== SecondaryLocationLogStatus.REJECTED
  );

  let requiredDurationWeeks = 0;
  let requiredDurationDays = 0;
  let maximumSplitsPerYear = 0;
  let minimumIntimationPeriodDays = 0;

  if (isEligible && primaryLocationKey && job?.empType) {
    const preferredLocation = primaryLocationKey || undefined;
    const { config } = await getApplicableConfigForEmployee(employeeUuid, preferredLocation);
    if (config) {
      requiredDurationWeeks = Number(config.durationWeeks) || 0;
      requiredDurationDays = requiredDurationWeeks * 5;
      maximumSplitsPerYear = Number(config.maximumSplitsPerYear) || 0;
      minimumIntimationPeriodDays = Number(config.minimumIntimationPeriodDays) || 0;
    } else {
      isEligible = false;
      eligibilityMessage = `Configuration for ${primaryLocationLabel || "selected location"} is not available`;
    }
  }

  const usedDurationDays = usableLogs.reduce(
    (sum: number, log: { durationDays: number }) => sum + (Number(log.durationDays) || 0),
    0
  );
  const usedSplits = usableLogs.length;

  return {
    primaryLocation: primaryLocationKey,
    primaryLocationLabel,
    secondaryLocation: secondaryLocationRaw || secondaryLocationKey,
    secondaryLocationLabel: secondaryLocationLabel || secondaryLocationRaw,
    isSecondarySameAsPrimary,
    isEligible,
    eligibilityMessage,
    progress: {
      year: currentYear,
      requiredDurationWeeks,
      requiredDurationDays,
      minimumIntimationPeriodDays,
      usedDurationDays,
      maximumSplitsPerYear,
      usedSplits,
    },
    hasLogs: logs.length > 0,
  };
};

export const createSecondaryLocationLogService = async (payload: LogPayload, loggedBy: string) => {
  const { secondaryLocationKey, primaryLocationKey, primaryLocationLabel } = await getEmployeeSecondaryLocationContext(
    payload.employeeUuid,
    payload.secondaryLocation
  );

  await ensureEmployeeConfigAvailability(payload.employeeUuid, primaryLocationKey, primaryLocationLabel);

  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.INVALID_DATE);
  }

  if (toDayStart(endDate).getTime() < toDayStart(startDate).getTime()) {
    throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.INVALID_DATE_RANGE);
  }

  const durationDays = getDurationDays(startDate, endDate);
  await validateNoOverlappingLogs(payload.employeeUuid, startDate, endDate);
  await validatePolicyConstraintsForLog(payload.employeeUuid, startDate, endDate);
  const { withinIntimation, minimumIntimationPeriodDays } = await resolveIntimationEligibility(payload.employeeUuid, startDate);

  const tx = await outputSequelize.transaction();
  try {
    const logId = await createUUIDV4();
    const isPending = !withinIntimation;

    await secondaryLocationLog.create(
      {
        logId,
        employeeUuid: payload.employeeUuid,
        secondaryLocation: secondaryLocationKey,
        startDate,
        endDate,
        durationDays,
        status: isPending ? SecondaryLocationLogStatus.PENDING : getLifecycleStatus(startDate, endDate),
        loggedBy,
        isDeleted: false,
      },
      { transaction: tx }
    );

    if (isPending) {
      if (!payload.reason?.trim()) {
        throw new Error(
          `Reason is required for logs created after intimation period of ${minimumIntimationPeriodDays} day(s)`
        );
      }
      await secondaryLocationRequest.create(
        {
          requestId: await createUUIDV4(),
          employeeUuid: payload.employeeUuid,
          originalLogId: logId,
          startDate,
          endDate,
          durationDays,
          requestType: SecondaryLocationRequestType.LOG,
          reason: payload.reason,
          status: SecondaryLocationRequestStatus.PENDING,
        },
        { transaction: tx }
      );
    }

    await tx.commit();
    return {
      logId,
      status: isPending
        ? SECONDARY_LOCATION_CONSTANTS.RESPONSE_STATUS.PENDING_APPROVAL
        : SECONDARY_LOCATION_CONSTANTS.RESPONSE_STATUS.APPROVED,
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const listSecondaryLocationLogsService = async (employeeUuid: string, options: ListOptions) => {
  const whereClause: WhereOptions<SecondaryLocationLogAttributes> = {
    employeeUuid,
    isDeleted: false,
  };

  if (options.statuses?.length) {
    whereClause.status = { [Op.in]: options.statuses };
  }

  if (options.month && options.year) {
    const start = new Date(options.year, options.month - 1, 1);
    const end = new Date(options.year, options.month, 0);
    whereClause.startDate = { [Op.between]: [start, end] };
  }

  const sortBy = options.sortBy || SECONDARY_LOCATION_CONSTANTS.DEFAULTS.SORT_BY;
  const sortOrder = options.sortOrder || SECONDARY_LOCATION_CONSTANTS.DEFAULTS.SORT_ORDER;
  const limit =
    options.limit && options.limit > 0
      ? options.limit
      : SECONDARY_LOCATION_CONSTANTS.DEFAULTS.LIMIT;

  const mapRowsWithComments = async (
    rows: Array<{ toJSON: () => SecondaryLocationLogAttributes; logId: string }>
  ) => {
    const logIds = rows.map((row) => row.logId);
    const rejectedRequests = logIds.length
      ? await secondaryLocationRequest.findAll({
          where: {
            originalLogId: { [Op.in]: logIds },
            status: SecondaryLocationRequestStatus.REJECTED,
          },
          attributes: ["originalLogId", "rejectionReason", "reviewedAt"],
          order: [
            [
              SECONDARY_LOCATION_CONSTANTS.DEFAULTS.REVIEW_SORT_BY,
              SECONDARY_LOCATION_CONSTANTS.DEFAULTS.REVIEW_SORT_ORDER,
            ],
          ],
          raw: true,
        })
      : [];

    const rejectionMap = new Map<string, string>();
    rejectedRequests.forEach((req: { originalLogId: string; rejectionReason?: string }) => {
      if (!rejectionMap.has(req.originalLogId) && req.rejectionReason) {
        rejectionMap.set(req.originalLogId, req.rejectionReason);
      }
    });

    return rows.map((row) => ({
      ...row.toJSON(),
      comments: rejectionMap.get(row.logId) || null,
    }));
  };

  const lastId = options.lastId?.trim() || "";

  if (lastId || !options.page) {
    if (lastId) {
      const anchorRow = (await secondaryLocationLog.findOne({
        where: { logId: lastId, employeeUuid, isDeleted: false },
        attributes: ["logId", sortBy],
        raw: true,
      })) as
        | {
            logId: string;
            startDate?: Date | string;
            endDate?: Date | string;
            createdAt?: Date | string;
          }
        | null;

      if (anchorRow) {
        const rawAnchorSortValue = anchorRow[sortBy];
        const anchorSortValue =
          sortBy === "createdAt" || sortBy === "startDate" || sortBy === "endDate"
            ? new Date(rawAnchorSortValue as Date | string)
            : rawAnchorSortValue;

        const sortComparator = sortOrder === "ASC" ? Op.gt : Op.lt;
        const cursorWhere = whereClause as WhereOptions & { [Op.and]?: unknown[] };
        cursorWhere[Op.and] = [
          {
            [Op.or]: [
              {
                [sortBy]: {
                  [sortComparator]: anchorSortValue,
                },
              },
              {
                [sortBy]: anchorSortValue,
                logId: {
                  [sortComparator]: anchorRow.logId,
                },
              },
            ],
          },
        ];
      }
    }

    const rows = await secondaryLocationLog.findAll({
      where: whereClause,
      order: [
        [sortBy, sortOrder],
        ["logId", sortOrder],
      ],
      limit: limit + 1,
    });

    const hasNext = rows.length > limit;
    const pagedRows = hasNext ? rows.slice(0, limit) : rows;
    const data = await mapRowsWithComments(
      pagedRows as Array<{ toJSON: () => SecondaryLocationLogAttributes; logId: string }>
    );
    const lastRow = pagedRows[pagedRows.length - 1] as { logId: string } | undefined;

    return {
      limit,
      nextLastId: hasNext && lastRow ? lastRow.logId : null,
      hasNext,
      data,
    };
  }

  const page = options.page > 0 ? options.page : SECONDARY_LOCATION_CONSTANTS.DEFAULTS.PAGE;
  const offset = (page - 1) * limit;

  const { rows, count } = await secondaryLocationLog.findAndCountAll({
    where: whereClause,
    order: [
      [
        sortBy,
        sortOrder,
      ],
    ],
    limit,
    offset,
  });
  const data = await mapRowsWithComments(
    rows as Array<{ toJSON: () => SecondaryLocationLogAttributes; logId: string }>
  );

  return {
    page,
    limit,
    total: count,
    data,
  };
};

export const updateSecondaryLocationLogService = async (
  logId: string,
  payload: Omit<LogPayload, "employeeUuid">
) => {
  const tx = await outputSequelize.transaction();
  try {
    const log = await secondaryLocationLog.findOne({
      where: { logId, isDeleted: false },
      transaction: tx,
      raw: true,
    });

    if (!log) {
      await tx.rollback();
      return { updated: false };
    }

    if (String(log.status) === SecondaryLocationLogStatus.COMPLETED) {
      throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.COMPLETED_LOG_ACTION_NOT_ALLOWED);
    }

    const { secondaryLocationKey, primaryLocationKey, primaryLocationLabel } = await getEmployeeSecondaryLocationContext(
      log.employeeUuid,
      payload.secondaryLocation
    );

    await ensureEmployeeConfigAvailability(log.employeeUuid, primaryLocationKey, primaryLocationLabel);

    const startDate = new Date(payload.startDate);
    const endDate = new Date(payload.endDate);

    if (toDayStart(endDate).getTime() < toDayStart(startDate).getTime()) {
      throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.INVALID_DATE_RANGE);
    }

    const durationDays = getDurationDays(startDate, endDate);
    await validateNoOverlappingLogs(log.employeeUuid, startDate, endDate, logId);
    await validatePolicyConstraintsForLog(log.employeeUuid, startDate, endDate, logId);

    if (!payload.reason?.trim()) {
      throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.REASON_REQUIRED_EDIT);
    }

    await secondaryLocationLog.update(
      {
        status: SecondaryLocationLogStatus.PENDING,
      },
      { where: { logId }, transaction: tx }
    );

    // If an already rejected log is edited and re-submitted outside intimation,
    // treat it as a fresh log request, not an edit request.
    const requestType =
      String(log.status) === SecondaryLocationLogStatus.REJECTED
        ? SecondaryLocationRequestType.LOG
        : SecondaryLocationRequestType.EDIT;

    await secondaryLocationRequest.create(
      {
        requestId: await createUUIDV4(),
        employeeUuid: log.employeeUuid,
        originalLogId: logId,
        startDate,
        endDate,
        durationDays,
        requestType,
        reason: payload.reason,
        status: SecondaryLocationRequestStatus.PENDING,
      },
      { transaction: tx }
    );

    await tx.commit();
    return { updated: true, status: SECONDARY_LOCATION_CONSTANTS.RESPONSE_STATUS.PENDING_APPROVAL };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const deleteSecondaryLocationLogService = async (
  logId: string,
  reason?: string
) => {
  const tx = await outputSequelize.transaction();
  try {
    const log = await secondaryLocationLog.findOne({
      where: { logId, isDeleted: false },
      transaction: tx,
      raw: true,
    });

    if (!log) {
      await tx.rollback();
      return { deleted: false };
    }

    if (String(log.status) === SecondaryLocationLogStatus.COMPLETED) {
      throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.COMPLETED_LOG_ACTION_NOT_ALLOWED);
    }

    if (!reason?.trim()) {
      throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.REASON_REQUIRED_DELETE);
    }

    await secondaryLocationLog.update(
      { status: SecondaryLocationLogStatus.PENDING },
      { where: { logId }, transaction: tx }
    );

    await secondaryLocationRequest.create(
      {
        requestId: await createUUIDV4(),
        employeeUuid: log.employeeUuid,
        originalLogId: logId,
        startDate: new Date(log.startDate),
        endDate: new Date(log.endDate),
        durationDays: log.durationDays,
        requestType: SecondaryLocationRequestType.DELETE,
        reason,
        status: SecondaryLocationRequestStatus.PENDING,
      },
      { transaction: tx }
    );

    await tx.commit();
    return { deleted: true, status: SECONDARY_LOCATION_CONSTANTS.RESPONSE_STATUS.PENDING_APPROVAL };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const listSecondaryLocationRequestsService = async (
  options: ListOptions & {
    requestTypes?: string[];
    statuses?: string[];
    pendingOnly?: boolean;
  }
) => {
  const baseWhereClause: WhereOptions<SecondaryLocationRequestAttributes> = {};

  if (options.requestTypes?.length) {
    baseWhereClause.requestType = { [Op.in]: options.requestTypes };
  }

  if (options.month && options.year) {
    const start = new Date(options.year, options.month - 1, 1);
    const end = new Date(options.year, options.month, 0);
    baseWhereClause.startDate = { [Op.between]: [start, end] };
  }

  const [pendingCount, historyCount] = await Promise.all([
    secondaryLocationRequest.count({
      where: {
        ...baseWhereClause,
        status: SecondaryLocationRequestStatus.PENDING,
      },
    }),
    secondaryLocationRequest.count({
      where: {
        ...baseWhereClause,
        status: {
          [Op.ne]: SecondaryLocationRequestStatus.PENDING,
        },
      },
    }),
  ]);

  const totalCount = pendingCount + historyCount;

  const listWhereClause: WhereOptions<SecondaryLocationRequestAttributes> = {
    ...baseWhereClause,
  };

  if (options.pendingOnly) {
    listWhereClause.status = SecondaryLocationRequestStatus.PENDING;
  } else if (options.statuses?.length) {
    listWhereClause.status = { [Op.in]: options.statuses };
  } else {
    listWhereClause.status = {
      [Op.ne]: SecondaryLocationRequestStatus.PENDING,
    };
  }

  const sortBy = options.sortBy || SECONDARY_LOCATION_CONSTANTS.DEFAULTS.SORT_BY;
  const sortOrder = options.sortOrder || SECONDARY_LOCATION_CONSTANTS.DEFAULTS.SORT_ORDER;
  const dbSortBy = sortBy === "employeeName" || sortBy === "durationDays" ? "createdAt" : sortBy;
  const limit =
    options.limit && options.limit > 0
      ? options.limit
      : 20;
  const lastId = options.lastId?.trim() || "";

  const shouldUseInMemorySort = sortBy === "employeeName" || sortBy === "durationDays";

  const queryWhereClause = { ...listWhereClause } as WhereOptions<SecondaryLocationRequestAttributes>;

  if (!shouldUseInMemorySort && lastId) {
    const anchorRow = (await secondaryLocationRequest.findOne({
      where: { requestId: lastId },
      attributes: ["requestId", dbSortBy],
      raw: true,
    })) as
      | {
          requestId: string;
          startDate?: Date | string;
          endDate?: Date | string;
          createdAt?: Date | string;
        }
      | null;

    if (anchorRow) {
      const rawAnchorSortValue = anchorRow[dbSortBy as "startDate" | "endDate" | "createdAt"];
      const anchorSortValue =
        dbSortBy === "createdAt" || dbSortBy === "startDate" || dbSortBy === "endDate"
          ? new Date(rawAnchorSortValue as Date | string)
          : rawAnchorSortValue;
      const sortComparator = sortOrder === "ASC" ? Op.gt : Op.lt;

      const cursorWhere = queryWhereClause as WhereOptions & { [Op.and]?: unknown[] };
      cursorWhere[Op.and] = [
        {
          [Op.or]: [
            {
              [dbSortBy]: {
                [sortComparator]: anchorSortValue,
              },
            },
            {
              [dbSortBy]: anchorSortValue,
              requestId: {
                [sortComparator]: anchorRow.requestId,
              },
            },
          ],
        },
      ];
    }
  }

  const requests = await secondaryLocationRequest.findAll({
    where: queryWhereClause,
    order: [
      [dbSortBy, sortOrder],
      ["requestId", sortOrder],
    ],
    ...(shouldUseInMemorySort ? {} : { limit: limit + 1 }),
    raw: true,
  });

  const employeeIds = [
    ...new Set(
      requests
        .flatMap((r: { employeeUuid: string; reviewedBy?: string | null }) => [
          r.employeeUuid,
          r.reviewedBy || "",
        ])
        .filter(Boolean)
    ),
  ];
  const employees = employeeIds.length
    ? await employeeBasicDetails.findAll({
        where: { empUuid: { [Op.in]: employeeIds }, isDeleted: false },
        attributes: ["empUuid", "empFirstName", "empLastName"],
        raw: true,
      })
    : [];

  const employeeMap = new Map<string, string>();
  employees.forEach((emp: { empUuid: string; empFirstName: string; empLastName?: string }) => {
    employeeMap.set(emp.empUuid, `${emp.empFirstName || ""} ${emp.empLastName || ""}`.trim());
  });

  let mappedRequests = requests.map((request: SecondaryLocationRequestAttributes & { reviewedBy?: string | null }) => ({
    ...request,
    employeeName: employeeMap.get(request.employeeUuid) || "",
    reviewedByName: request.reviewedBy ? employeeMap.get(request.reviewedBy) || "" : "",
  }));

  if (sortBy === "employeeName") {
    mappedRequests = mappedRequests.sort((a, b) => {
      const left = String(a.employeeName || "").toLowerCase();
      const right = String(b.employeeName || "").toLowerCase();
      if (left === right) return 0;
      const result = left > right ? 1 : -1;
      return sortOrder === "ASC" ? result : -result;
    });
  }

  if (sortBy === "durationDays") {
    mappedRequests = mappedRequests.sort((a, b) => {
      const result = (Number(a.durationDays) || 0) - (Number(b.durationDays) || 0);
      return sortOrder === "ASC" ? result : -result;
    });
  }

  let pagedRequests = mappedRequests;
  let hasNext = false;
  let nextLastId: string | null = null;

  if (shouldUseInMemorySort) {
    const anchorIndex = lastId
      ? mappedRequests.findIndex((request) => request.requestId === lastId)
      : -1;
    const startIndex = anchorIndex >= 0 ? anchorIndex + 1 : 0;
    pagedRequests = mappedRequests.slice(startIndex, startIndex + limit);
    hasNext = startIndex + limit < mappedRequests.length;
    nextLastId = hasNext && pagedRequests.length
      ? pagedRequests[pagedRequests.length - 1].requestId
      : null;
  } else {
    hasNext = mappedRequests.length > limit;
    pagedRequests = hasNext ? mappedRequests.slice(0, limit) : mappedRequests;
    nextLastId = hasNext && pagedRequests.length
      ? pagedRequests[pagedRequests.length - 1].requestId
      : null;
  }

  return {
    requests: pagedRequests,
    meta: {
      pendingCount,
      historyCount,
      totalCount,
      limit,
      nextLastId,
      hasNext,
    },
  };
};

export const reviewSecondaryLocationRequestService = async (
  requestId: string,
  payload: ReviewPayload,
  reviewerEmpUuid: string
) => {
  const tx: Transaction = await outputSequelize.transaction();
  try {
    const request = await secondaryLocationRequest.findOne({
      where: { requestId },
      transaction: tx,
      raw: true,
    });

    if (!request || request.status !== SecondaryLocationRequestStatus.PENDING) {
      await tx.rollback();
      return { updated: false };
    }

    const now = new Date();
    const originalLogId = request.originalLogId;

    const existingLog = originalLogId
      ? await secondaryLocationLog.findOne({
          where: { logId: originalLogId, isDeleted: false },
          attributes: ["logId", "startDate", "endDate", "status"],
          transaction: tx,
          raw: true,
        })
      : null;

    if (payload.action === SECONDARY_LOCATION_CONSTANTS.REVIEW_ACTION.APPROVE) {
      if (originalLogId) {
        if (request.requestType === SecondaryLocationRequestType.DELETE) {
          await secondaryLocationLog.update(
            { isDeleted: true, reviewedBy: reviewerEmpUuid, reviewedAt: now },
            { where: { logId: originalLogId }, transaction: tx }
          );
        } else {
          await secondaryLocationLog.update(
            {
              startDate: request.startDate,
              endDate: request.endDate,
              durationDays: request.durationDays,
              status: getLifecycleStatus(new Date(request.startDate), new Date(request.endDate)),
              reviewedBy: reviewerEmpUuid,
              reviewedAt: now,
            },
            { where: { logId: originalLogId }, transaction: tx }
          );
        }
      }

      await secondaryLocationRequest.update(
        {
          status: SecondaryLocationRequestStatus.APPROVED,
          reviewedBy: reviewerEmpUuid,
          reviewedAt: now,
        },
        { where: { requestId }, transaction: tx }
      );

      await tx.commit();
      return { updated: true, status: SECONDARY_LOCATION_CONSTANTS.RESPONSE_STATUS.APPROVED };
    }

    if (!payload.rejectionReason?.trim()) {
      throw new Error(SECONDARY_LOCATION_CONSTANTS.ERROR.REJECTION_REASON_REQUIRED);
    }

    if (originalLogId) {
      let resolvedStatus: SecondaryLocationLogStatus = SecondaryLocationLogStatus.REJECTED;

      if (request.requestType === SecondaryLocationRequestType.LOG) {
        resolvedStatus = SecondaryLocationLogStatus.REJECTED;
      } else if (existingLog) {
        // For rejected Edit/Delete requests, restore lifecycle status based on the
        // currently stored log dates (the pending request should not mutate dates).
        const previousStatus = String(existingLog.status || "");
        if (previousStatus === SecondaryLocationLogStatus.REJECTED) {
          resolvedStatus = SecondaryLocationLogStatus.REJECTED;
        } else {
          resolvedStatus = getLifecycleStatus(new Date(existingLog.startDate), new Date(existingLog.endDate));
        }
      }

      await secondaryLocationLog.update(
        {
          status: resolvedStatus,
          reviewedBy: reviewerEmpUuid,
          reviewedAt: now,
        },
        { where: { logId: originalLogId }, transaction: tx }
      );
    }

    await secondaryLocationRequest.update(
      {
        status: SecondaryLocationRequestStatus.REJECTED,
        rejectionReason: payload.rejectionReason,
        reviewedBy: reviewerEmpUuid,
        reviewedAt: now,
      },
      { where: { requestId }, transaction: tx }
    );

    await tx.commit();
    return { updated: true, status: SECONDARY_LOCATION_CONSTANTS.RESPONSE_STATUS.REJECTED };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};
