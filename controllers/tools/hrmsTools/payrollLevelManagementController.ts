import { Request, Response } from "express";
import { Op, Transaction } from "sequelize";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";
import { dbOutput } from "../../../models/index";
import { createUUIDV4 } from "../../../utilities/uuidV4Generator";
import { checkHrmsPermission } from "../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices";

type DropdownConfigMap = Record<string, string>;

type SalaryCategorySeed = {
  employeeType: string;
  employeeLocation: string;
  employeeLevel: string;
  department: string | null;
  yearOfStudy: string | null;
};

type ComponentConfigRow = {
  id: number;
  componentType: string;
  componentValue: string;
};

const EmployeeComponentConfigurator = dbOutput.employeeComponentConfigurator;
const SalaryCategories = dbOutput.salaryCategories;
const SalaryComponents = dbOutput.salaryComponents;
const { sequelize } = dbOutput;

const HR_TOOL_NAME = "HR Repository";
const COMPONENT_TYPES = {
  LEVEL_DROPDOWN: "level_dropdown",
  LOCATION_DROPDOWN: "location_dropdown",
  DEPARTMENT_DROPDOWN: "department_type_dropdown",
  YEAR_OF_STUDY: "year_of_study",
  DEFAULT_ADDITION: "defaultAddition",
  DEFAULT_DEDUCTION: "defaultDeduction",
};

const PAYROLL_LEVEL_PERMISSIONS = {
  READ: "PayrollLevelManagement_read",
  CREATE: "PayrollLevelManagement_create",
  UPDATE: "PayrollLevelManagement_update",
};

const TARGET_EMPLOYEE_TYPES = {
  STANDARD: ["fte_key", "ofte_key", "pte_key"],
  INTERN: ["intern_key", "extended_intern_key"],
};

const normalizeName = (value: unknown): string => String(value || "").trim();

const parseJsonConfig = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const categoryUniqueKey = (category: SalaryCategorySeed): string => {
  return [
    category.employeeType || "",
    category.employeeLocation || "",
    category.employeeLevel || "",
    category.department || "",
    category.yearOfStudy || "",
  ].join("::");
};

const componentNameLower = (name: unknown): string => String(name || "").toLowerCase();

const parseNumericKey = (key: string): number | null => {
  const parsed = Number.parseInt(String(key), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getMaxNumericKey = (keys: string[]): number => {
  const numericKeys = keys
    .map((key) => parseNumericKey(key))
    .filter((value): value is number => value !== null);

  if (numericKeys.length === 0) {
    return -1;
  }

  return Math.max(...numericKeys);
};

const hasPermission = async (req: Request, permissionName: string): Promise<boolean> => {
  const authReq = req as AuthenticatedRequest;
  const toolsAccess = authReq.user?.toolsAccess || {};
  const employeeUuid = authReq.user?.employeeUuid;

  return checkHrmsPermission(employeeUuid, permissionName, HR_TOOL_NAME, toolsAccess);
};

export const getAllComponentType = async (_req: Request, res: Response) => {
  try {
    const allComponentType = await EmployeeComponentConfigurator.findAll({
      where: { isDeleted: false },
      attributes: ["componentType", "componentValue"],
      raw: true,
    });

    const allComponent = allComponentType.reduce((acc: Record<string, unknown>, item: { componentType: string; componentValue: string }) => {
      acc[item.componentType] = JSON.parse(item.componentValue);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      message: "All employee component types fetched successfully",
      allComponent,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getPayrollLevels = async (req: Request, res: Response) => {
  try {
    const allowed = await hasPermission(req, PAYROLL_LEVEL_PERMISSIONS.READ);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view payroll levels",
      });
    }

    const levelConfig = await EmployeeComponentConfigurator.findOne({
      where: {
        componentType: COMPONENT_TYPES.LEVEL_DROPDOWN,
        isDeleted: false,
      },
      attributes: ["componentValue"],
      raw: true,
    });

    const levelMap = parseJsonConfig<DropdownConfigMap>(levelConfig?.componentValue || "{}", {});
    const levels = Object.entries(levelMap)
      .map(([key, name]) => ({
        key: String(key),
        name: String(name),
      }))
      .sort((a, b) => {
        const aKey = parseNumericKey(a.key);
        const bKey = parseNumericKey(b.key);

        if (aKey !== null && bKey !== null) {
          return aKey - bKey;
        }

        if (aKey !== null) {
          return -1;
        }

        if (bKey !== null) {
          return 1;
        }

        return a.key.localeCompare(b.key);
      });

    return res.status(200).json({
      success: true,
      message: "Payroll levels fetched successfully",
      levels,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payroll levels",
      error: (error as Error).message,
    });
  }
};

export const createPayrollLevel = async (req: Request, res: Response) => {
  const levelName = normalizeName((req.body as { levelName?: string })?.levelName);

  if (!levelName) {
    return res.status(400).json({
      success: false,
      message: "levelName is required",
    });
  }

  if (levelName.length > 100) {
    return res.status(400).json({
      success: false,
      message: "levelName should not exceed 100 characters",
    });
  }

  const transaction: Transaction = await sequelize.transaction();

  try {
    const allowed = await hasPermission(req, PAYROLL_LEVEL_PERMISSIONS.CREATE);

    if (!allowed) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You don't have permission to create payroll level",
      });
    }

    const authReq = req as AuthenticatedRequest;
    const actor = authReq.user?.email || String(authReq.user?.userId || "system");

    const configRows = (await EmployeeComponentConfigurator.findAll({
      where: {
        componentType: {
          [Op.in]: [
            COMPONENT_TYPES.LEVEL_DROPDOWN,
            COMPONENT_TYPES.LOCATION_DROPDOWN,
            COMPONENT_TYPES.DEPARTMENT_DROPDOWN,
            COMPONENT_TYPES.YEAR_OF_STUDY,
          ],
        },
        isDeleted: false,
      },
      attributes: ["id", "componentType", "componentValue"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as ComponentConfigRow[];

    const configMap = new Map<string, ComponentConfigRow>(
      configRows.map((row) => [row.componentType, row])
    );

    const levelConfig = configMap.get(COMPONENT_TYPES.LEVEL_DROPDOWN);
    if (!levelConfig) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Level dropdown configuration not found",
      });
    }

    const locationConfig = configMap.get(COMPONENT_TYPES.LOCATION_DROPDOWN);
    const departmentConfig = configMap.get(COMPONENT_TYPES.DEPARTMENT_DROPDOWN);
    const yearOfStudyConfig = configMap.get(COMPONENT_TYPES.YEAR_OF_STUDY);

    if (!locationConfig || !departmentConfig || !yearOfStudyConfig) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Required dropdown configuration missing for payroll level setup",
      });
    }

    const levelsMap = parseJsonConfig<DropdownConfigMap>(levelConfig.componentValue, {});

    const duplicateLevel = Object.values(levelsMap).some(
      (value) => normalizeName(value).toLowerCase() === levelName.toLowerCase()
    );

    if (duplicateLevel) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Payroll level already exists",
      });
    }

    const nextLevelKey = String(getMaxNumericKey(Object.keys(levelsMap)) + 1);
    levelsMap[nextLevelKey] = levelName;

    await EmployeeComponentConfigurator.update(
      {
        componentValue: JSON.stringify(levelsMap),
      },
      {
        where: {
          id: levelConfig.id,
        },
        transaction,
      }
    );

    const locationKeys = Object.keys(parseJsonConfig<DropdownConfigMap>(locationConfig.componentValue, {}));
    const departmentKeys = Object.keys(parseJsonConfig<DropdownConfigMap>(departmentConfig.componentValue, {}));
    const yearOfStudyKeys = Object.keys(parseJsonConfig<DropdownConfigMap>(yearOfStudyConfig.componentValue, {}));

    if (!locationKeys.length || !departmentKeys.length || !yearOfStudyKeys.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot create payroll level because required dropdown values are empty",
      });
    }

    const requiredCategories: SalaryCategorySeed[] = [];

    for (const employeeType of TARGET_EMPLOYEE_TYPES.STANDARD) {
      for (const employeeLocation of locationKeys) {
        requiredCategories.push({
          employeeType,
          employeeLocation,
          employeeLevel: nextLevelKey,
          department: null,
          yearOfStudy: null,
        });
      }
    }

    for (const employeeType of TARGET_EMPLOYEE_TYPES.INTERN) {
      for (const employeeLocation of locationKeys) {
        for (const department of departmentKeys) {
          for (const yearOfStudy of yearOfStudyKeys) {
            requiredCategories.push({
              employeeType,
              employeeLocation,
              employeeLevel: nextLevelKey,
              department,
              yearOfStudy,
            });
          }
        }
      }
    }

    const existingCategories = await SalaryCategories.findAll({
      where: {
        employeeLevel: nextLevelKey,
        employeeType: {
          [Op.in]: [...TARGET_EMPLOYEE_TYPES.STANDARD, ...TARGET_EMPLOYEE_TYPES.INTERN],
        },
        isDeleted: false,
      },
      attributes: [
        "salaryCategoryId",
        "employeeType",
        "employeeLocation",
        "employeeLevel",
        "department",
        "yearOfStudy",
      ],
      transaction,
    });

    const existingCategoryMap = new Map<string, string>(
      existingCategories.map((category: SalaryCategorySeed & { salaryCategoryId: string }) => [categoryUniqueKey(category), category.salaryCategoryId])
    );

    const categoriesToInsert: Array<SalaryCategorySeed & { salaryCategoryId: string; isDeleted: boolean }> = [];
    for (const category of requiredCategories) {
      const key = categoryUniqueKey(category);
      if (!existingCategoryMap.has(key)) {
        const salaryCategoryId = await createUUIDV4();
        categoriesToInsert.push({
          salaryCategoryId,
          ...category,
          isDeleted: false,
        });
        existingCategoryMap.set(key, salaryCategoryId);
      }
    }

    if (categoriesToInsert.length) {
      await SalaryCategories.bulkCreate(categoriesToInsert, { transaction });
    }

    const categoryIds: string[] = Array.from(existingCategoryMap.values());

    const existingComponents = categoryIds.length
      ? await SalaryComponents.findAll({
          where: {
            salaryCategoryId: {
              [Op.in]: categoryIds,
            },
            isDeleted: false,
            componentType: {
              [Op.in]: [COMPONENT_TYPES.DEFAULT_ADDITION, COMPONENT_TYPES.DEFAULT_DEDUCTION],
            },
          },
          attributes: ["salaryCategoryId", "componentType", "componentName"],
          transaction,
        })
      : [];

    const componentMap = new Map<string, { hasBasicSalary: boolean; hasLossOfPay: boolean }>();
    for (const component of existingComponents) {
      const categoryId = component.salaryCategoryId as string;
      if (!componentMap.has(categoryId)) {
        componentMap.set(categoryId, {
          hasBasicSalary: false,
          hasLossOfPay: false,
        });
      }

      const existing = componentMap.get(categoryId)!;
      const normalizedComponentName = componentNameLower(component.componentName);

      if (
        component.componentType === COMPONENT_TYPES.DEFAULT_ADDITION &&
        normalizedComponentName === "basic salary"
      ) {
        existing.hasBasicSalary = true;
      }

      if (
        component.componentType === COMPONENT_TYPES.DEFAULT_DEDUCTION &&
        (normalizedComponentName.includes("loss of pay") || normalizedComponentName.includes("lop"))
      ) {
        existing.hasLossOfPay = true;
      }
    }

    const componentsToInsert: Array<{
      componentId: string;
      salaryCategoryId: string;
      componentName: string;
      componentType: string;
      amount: number;
      isVariable: boolean;
      includeinLop: boolean;
      isDeleted: boolean;
      isDefault: boolean;
      createdBy: string;
      updatedBy: string;
    }> = [];

    for (const categoryId of categoryIds) {
      const existing = componentMap.get(categoryId) || {
        hasBasicSalary: false,
        hasLossOfPay: false,
      };

      if (!existing.hasBasicSalary) {
        componentsToInsert.push({
          componentId: await createUUIDV4(),
          salaryCategoryId: categoryId,
          componentName: "Basic Salary",
          componentType: COMPONENT_TYPES.DEFAULT_ADDITION,
          amount: 0,
          isVariable: false,
          includeinLop: false,
          isDeleted: false,
          isDefault: true,
          createdBy: actor,
          updatedBy: actor,
        });
      }

      if (!existing.hasLossOfPay) {
        componentsToInsert.push({
          componentId: await createUUIDV4(),
          salaryCategoryId: categoryId,
          componentName: "Loss of Pay(per day)",
          componentType: COMPONENT_TYPES.DEFAULT_DEDUCTION,
          amount: 0,
          isVariable: false,
          includeinLop: false,
          isDeleted: false,
          isDefault: true,
          createdBy: actor,
          updatedBy: actor,
        });
      }
    }

    if (componentsToInsert.length) {
      await SalaryComponents.bulkCreate(componentsToInsert, { transaction });
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Payroll level created successfully",
      data: {
        levelKey: nextLevelKey,
        levelName,
        categoriesCreated: categoriesToInsert.length,
        categoriesSkipped: requiredCategories.length - categoriesToInsert.length,
        componentsCreated: componentsToInsert.length,
        componentsSkipped: categoryIds.length * 2 - componentsToInsert.length,
      },
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to create payroll level",
      error: (error as Error).message,
    });
  }
};

export const updatePayrollLevel = async (req: Request, res: Response) => {
  const payload = req.body as { levelKey?: string; levelName?: string };
  const levelKey = normalizeName(payload?.levelKey);
  const levelName = normalizeName(payload?.levelName);

  if (!levelKey || !levelName) {
    return res.status(400).json({
      success: false,
      message: "levelKey and levelName are required",
    });
  }

  if (levelName.length > 100) {
    return res.status(400).json({
      success: false,
      message: "levelName should not exceed 100 characters",
    });
  }

  const transaction: Transaction = await sequelize.transaction();

  try {
    const allowed = await hasPermission(req, PAYROLL_LEVEL_PERMISSIONS.UPDATE);

    if (!allowed) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update payroll level",
      });
    }

    const levelConfig = await EmployeeComponentConfigurator.findOne({
      where: {
        componentType: COMPONENT_TYPES.LEVEL_DROPDOWN,
        isDeleted: false,
      },
      attributes: ["id", "componentValue"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!levelConfig) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Level dropdown configuration not found",
      });
    }

    const levelsMap = parseJsonConfig<DropdownConfigMap>(levelConfig.componentValue, {});

    if (!Object.prototype.hasOwnProperty.call(levelsMap, levelKey)) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Payroll level not found",
      });
    }

    const duplicateLevel = Object.entries(levelsMap).some(([key, value]) => {
      if (String(key) === levelKey) {
        return false;
      }
      return normalizeName(value).toLowerCase() === levelName.toLowerCase();
    });

    if (duplicateLevel) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Payroll level already exists",
      });
    }

    levelsMap[levelKey] = levelName;

    await EmployeeComponentConfigurator.update(
      {
        componentValue: JSON.stringify(levelsMap),
      },
      {
        where: {
          id: levelConfig.id,
        },
        transaction,
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Payroll level updated successfully",
      data: {
        levelKey,
        levelName,
      },
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to update payroll level",
      error: (error as Error).message,
    });
  }
};
