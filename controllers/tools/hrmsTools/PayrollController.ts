import { Request, Response } from "express";
import { dbOutput, outputSequelize, sequelize } from "../../../models";
import { Transaction, Op } from "sequelize";
import { createUUIDV4 } from "../../../utilities/uuidV4Generator";
import { 
    payrollStatus, 
    componentTypes,
    AttendanceStatusType, 
    hrmsConstants,
    // AttendanceStatusType
} from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import { 
    PayrollDataItem,
    CreatedAdjustment,
    AdjustmentError,
    salaryComponentsAttributes,
    employeePayslipAttributes,
    employeePayslipItemAttributes,
    AuthenticatedUser,
    // employeeComponentAdjustmentsAttributes,
    // EmployeeAttendanceAttributes,
    // EmployeeLeaveRequestAttributes
 } from "../../../interfaces/hrmsTool/interface/hrmsInterface";
import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import { fetchEmployeeLeavesData, fetchEmployeeCurrentJobDetails } from "../../../utilities/hrmsUtilities/dbCalls";
import { formatItems, generatePayrollCSV, getMonthYearDateRange, getYearDateRange } from "../../../utilities/hrmsUtilities/helperFunctions";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";
import { checkHrmsPermission } from "../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const formatLocalDate = (value?: string | Date | null): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const parseDateInput = (value?: string | Date | null): Date | null => {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (DATE_ONLY_REGEX.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        const parsed = new Date(year, month - 1, day);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getMonthStartDate = (value?: string | Date | null): Date | null => {
    const parsed = parseDateInput(value);
    if (!parsed) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
};

const rangesOverlap = (
    startA: Date,
    endA: Date | null,
    startB: Date,
    endB: Date | null
): boolean => {
    const startATime = startA.getTime();
    const endATime = endA ? endA.getTime() : Number.POSITIVE_INFINITY;
    const startBTime = startB.getTime();
    const endBTime = endB ? endB.getTime() : Number.POSITIVE_INFINITY;

    return startATime <= endBTime && startBTime <= endATime;
};

const getGlobalSalaryCategoryWhere = (): Record<string, unknown> => ({
    employeeType: componentTypes.ALL,
    employeeLocation: componentTypes.ALL,
    employeeLevel: componentTypes.ALL,
    department: null,
    yearOfStudy: null,
    isDeleted: false
});

const buildComponentMergeKey = (component: Partial<salaryComponentsAttributes>): string => {
    const componentType = String(component.componentType || "").trim().toLowerCase();
    const componentName = String(component.componentName || "").trim().toLowerCase();
    return `${componentType}::${componentName}`;
};

const mergeSalaryComponentsWithSpecificPriority = <T extends Partial<salaryComponentsAttributes>>(
    globalComponents: T[],
    specificComponents: T[]
): T[] => {
    const merged = new Map<string, T>();

    for (const component of globalComponents) {
        merged.set(buildComponentMergeKey(component), component);
    }

    for (const component of specificComponents) {
        merged.set(buildComponentMergeKey(component), component);
    }

    return Array.from(merged.values());
};


export const getAllEmployeePayrollDetails = async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthenticatedRequest;
    
    // Check user permissions
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;
    
    // Check permission: admin access (>= 900) OR Payroll_read permission
    const hasPermission = await checkHrmsPermission(
        employeeUuid,
        "Payroll_read",
        toolName,
        toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
        res.status(403).json({
            status: "error",
            message: "You don't have permission to view payroll"
        });
        return;
    }

    try {
        // ============================================
        // 1. EXTRACT AND VALIDATE REQUEST PARAMETERS
        // ============================================
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 15));
        const offset = (page - 1) * limit;
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const searchQuery = (req.query.search as string || '').trim();

        // ============================================
        // 2. BUILD FILTER CONDITIONS
        // ============================================
        // Filter for payslip records by month/year (database-agnostic)
        const { startDate: monthStart, endDate: monthEnd } = getMonthYearDateRange(month, year);
        const monthYearFilter = {
            payrollStartDate: { [Op.between]: [monthStart, monthEnd] },
            isDeleted: false
        };

        // Search conditions for employee name matching
        const searchConditions = searchQuery ? {
            [Op.or]: [
                { empFirstName: { [Op.like]: `%${searchQuery}%` } },
                { empLastName: { [Op.like]: `%${searchQuery}%` } },
                sequelize.where(
                    sequelize.fn('concat', sequelize.col('empFirstName'), ' ', sequelize.col('empLastName')),
                    { [Op.like]: `%${searchQuery}%` }
                )
            ]
        } : {};

        // ============================================
        // 3. FETCH CONFIGURATION DATA
        // ============================================
        // Fetch unpaid leave configuration for later calculation
        const [unpaidLeaveConfig, leaveAccrualFrequency] = await Promise.all([
            dbOutput.employeeLeaveConfigurator.findOne({
                where: {
                    [Op.and]: [
                        outputSequelize.where(
                            outputSequelize.fn('LOWER', outputSequelize.col('leaveType')),
                            { [Op.like]: '%unpaid%' }
                        ),
                        { isActive: true }
                    ]
                },
                attributes: ['leaveConfigId']
            }),
            dbOutput.employeeComponentConfigurator.findOne({
                where: {
                    componentType: 'leave_accural_frequency',
                    isDeleted: false
                },
                attributes: ['componentValue'],
                raw: true
            })
        ]);

        const unpaidLeaveConfigId = unpaidLeaveConfig?.leaveConfigId || null;
        const componentFrequencies = leaveAccrualFrequency ? JSON.parse(leaveAccrualFrequency.componentValue) : {};

        // ============================================
        // 4. CALCULATE PAGINATION COUNTS
        // ============================================
        // Get employee UUIDs matching search query for count filtering
        let employeeUuidsForCount: string[] | null = null;
        if (searchQuery) {
            const matchingEmployees = await dbOutput.employeeBasicDetails.findAll({
                where: { isDeleted: false, ...searchConditions },
                attributes: ['empUuid'],
                raw: true
            });
            employeeUuidsForCount = matchingEmployees.map(e => e.empUuid);
            
            // Early return if no employees match the search
            if (!employeeUuidsForCount || employeeUuidsForCount.length === 0) {
                res.status(200).json({
                    success: true,
                    message: "No employees found",
                    data: [],
                    isPayrollGenerated: false,
                    pagination: {
                        currentPage: page,
                        pageSize: limit,
                        totalRecords: 0,
                        totalPages: 0
                    }
                });
                return;
            }
        }

        // Count payslip records with and without search filter
        const countFilter = employeeUuidsForCount 
            ? { ...monthYearFilter, employeeId: { [Op.in]: employeeUuidsForCount } }
            : monthYearFilter;

        const [totalWithSearch, totalWithoutSearch] = await Promise.all([
            dbOutput.employeePayslipRecords.count({
                where: countFilter,
                distinct: true,
                col: 'employeeId'
            }),
            employeeUuidsForCount ? dbOutput.employeePayslipRecords.count({
                where: monthYearFilter,
                distinct: true,
                col: 'employeeId'
            }) : Promise.resolve(0)
        ]);

        const finalTotalWithoutSearch = employeeUuidsForCount ? totalWithoutSearch : totalWithSearch;

        // ============================================
        // 5. FETCH EMPLOYEES WITH PAYSLIP RECORDS (WITH PAGINATION)
        // ============================================
        // Strategy: Get paginated payslip records, then fetch employee details
        // This avoids cross-database JOIN issues
        
        // Step 1: Get paginated payslip records with distinct employee IDs
        const paginatedPayslips = await dbOutput.employeePayslipRecords.findAll({
            where: countFilter,
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('employeeId')), 'employeeId']
            ],
            raw: true,
            group: ['employeeId']
        });

        // Get all unique employee IDs
        const allEmpIdsWithPayslips = paginatedPayslips.map((p: any) => p.employeeId);
        const notFetchedEmployees: Array<{
            empUuid: string;
            empName: string;
            reason: string;
            resolution: string;
        }> = [];
        const notFetchedEmployeeSet = new Set<string>();

        const addNotFetchedEmployee = (
            empUuid: string,
            empName: string | null | undefined,
            reason: string,
            resolution: string
        ) => {
            if (!empUuid || notFetchedEmployeeSet.has(empUuid)) return;
            notFetchedEmployeeSet.add(empUuid);
            notFetchedEmployees.push({
                empUuid,
                empName: empName?.trim() || empUuid,
                reason,
                resolution
            });
        };

        // Early return if no payslip records found
        if (!allEmpIdsWithPayslips || allEmpIdsWithPayslips.length === 0) {
            res.status(200).json({
                success: true,
                message: "No payroll records found",
                data: [],
                notFetchedEmployees: [],
                isPayrollGenerated: false,
                pagination: {
                    currentPage: page,
                    pageSize: limit,
                    totalRecords: finalTotalWithoutSearch,
                    totalPages: Math.ceil(totalWithSearch / limit)
                }
            });
            return;
        }

        // Step 2: Fetch employee basic details and address details
        const employeesBasicData = await dbOutput.employeeBasicDetails.findAll({
            include: [
                {
                    model: dbOutput.employeeAddressDetails,
                    as: 'addressDetails',
                    required: false,
                    attributes: ['state']
                }
            ],
            where: { 
                empUuid: { [Op.in]: allEmpIdsWithPayslips },
                isDeleted: false
            },
            attributes: ['empUuid', 'empFirstName', 'empLastName'],
            order: [['empFirstName', 'ASC'], ['empLastName', 'ASC']],
            raw: true,
            nest: true
        });

        const employeeBasicMap = new Map<string, any>();
        employeesBasicData.forEach((emp: any) => {
            employeeBasicMap.set(emp.empUuid, emp);
        });
        allEmpIdsWithPayslips.forEach((empUuid: string) => {
            if (!employeeBasicMap.has(empUuid)) {
                addNotFetchedEmployee(
                    empUuid,
                    empUuid,
                    'Payroll not fetched because employee profile is missing or deleted',
                    'Please verify employee basic profile exists and is not deleted'
                );
            }
        });

        // Step 2b: Fetch current job details using the helper function (handles conversion date logic)
        const jobDetailsMap = await fetchEmployeeCurrentJobDetails(allEmpIdsWithPayslips);

        // Step 2c: Combine employee basic data with job details
        const employeesWithJobDetails = employeesBasicData.map(emp => {
            const empData = emp as any;
            const jobDetails = jobDetailsMap.get(empData.empUuid);
            return {
                ...empData,
                jobDetails: jobDetails || null
            };
        });

        const employeeNameByUuid = new Map<string, string>();
        employeesWithJobDetails.forEach((employee: any) => {
            const fullName = `${employee.empFirstName || ''} ${employee.empLastName || ''}`.trim();
            employeeNameByUuid.set(employee.empUuid, fullName || employee.empUuid);
            if (!employee.jobDetails) {
                addNotFetchedEmployee(
                    employee.empUuid,
                    fullName,
                    'Payroll not fetched because employee job details are unavailable',
                    'Please update employee job details before payroll processing'
                );
            }
        });

        // Step 3: Pre-filter to include only employees with valid salary categories
        // Build all salary category queries first
        const salaryCategoryQueriesForFiltering = employeesWithJobDetails
            .filter(e => e.jobDetails)
            .map(e => {
                const empData = e as any;
                const { empType, empDepartment, empLevel, empYearOfStudy } = empData.jobDetails;
                const employeeLocation = empData.addressDetails?.state || null;

                const whereClause: Record<string, unknown> = {
                    employeeType: empType,
                    employeeLocation: employeeLocation,
                    isDeleted: false
                };

                if (empType === 'fte_key' || empType === 'ofte_key' || empType === 'pte_key') {
                    whereClause.employeeLevel = empLevel || null;
                    // Don't include department and yearOfStudy in where clause - they can be null or not null, doesn't matter
                } else if (empType === 'intern_key' || empType === 'extended_intern_key') {
                    whereClause.employeeLevel = empLevel || null;
                    whereClause.department = empDepartment || null;
                    whereClause.yearOfStudy = empYearOfStudy || null;
                } else {
                    // For other types: Only check empType and location (not level, department, or yearOfStudy)
                    // Don't include these fields in where clause
                }

                return { 
                    empUuid: empData.empUuid, 
                    whereClause,
                    empType,
                    empLevel,
                    empDepartment,
                    empYearOfStudy
                };
            });

        // Fetch all salary categories in one query
        const allSalaryCategoriesForFiltering = salaryCategoryQueriesForFiltering.length > 0
            ? await dbOutput.salaryCategories.findAll({
                where: {
                    [Op.or]: salaryCategoryQueriesForFiltering.map(q => q.whereClause)
                },
                attributes: ['salaryCategoryId', 'employeeType', 'employeeLocation', 'employeeLevel', 'department', 'yearOfStudy'],
                raw: true
            })
            : [];

        // Map employees to their salary categories and filter valid ones
        const employeesWithValidCategories: string[] = [];
        salaryCategoryQueriesForFiltering.forEach(query => {
            const wc = query.whereClause;
            const match = allSalaryCategoriesForFiltering.find(cat => {
                // Base matching: always check empType and location
                if (cat.employeeType !== wc.employeeType || cat.employeeLocation !== wc.employeeLocation) {
                    return false;
                }

                // For FTE/OFTE/PTE: Only check empType, location, and level. Don't check department and yearOfStudy.
                if (query.empType === 'fte_key' || query.empType === 'ofte_key' || query.empType === 'pte_key') {
                    return cat.employeeLevel === (query.empLevel || null);
                } 
                // For interns: Check all fields including department and yearOfStudy
                else if (query.empType === 'intern_key' || query.empType === 'extended_intern_key') {
                    return cat.employeeLevel === (query.empLevel || null) &&
                        cat.department === (query.empDepartment || null) &&
                        cat.yearOfStudy === (query.empYearOfStudy || null);
                } 
                // For other types: Only check empType and location (not level, department, or yearOfStudy)
                else {
                    return true; // Already matched empType and location above
                }
            });
            
            if (match) {
                employeesWithValidCategories.push(query.empUuid);
            } else {
                addNotFetchedEmployee(
                    query.empUuid,
                    employeeNameByUuid.get(query.empUuid) || query.empUuid,
                    'Payroll not fetched due to salary configuration mismatch',
                    'Please align salary category with employee type, location, level, department, and year of study'
                );
            }
        });

        // Update total counts to reflect only valid employees
        const validEmployeeCount = employeesWithValidCategories.length;
        
        // Early return if no valid employees found
        if (validEmployeeCount === 0) {
            res.status(200).json({
                success: true,
                message: "No employees with valid salary categories found",
                data: [],
                notFetchedEmployees,
                isPayrollGenerated: false,
                pagination: {
                    currentPage: page,
                    pageSize: limit,
                    totalRecords: 0,
                    totalPages: 0
                }
            });
            return;
        }

        // Step 4: Apply pagination to filtered and sorted employee IDs
        const paginatedEmpUuids = employeesWithValidCategories.slice(offset, offset + limit);

        // Early return if no employees in this page
        if (paginatedEmpUuids.length === 0) {
            res.status(200).json({
                success: true,
                message: "No employees found on this page",
                data: [],
                notFetchedEmployees,
                isPayrollGenerated: false,
                pagination: {
                    currentPage: page,
                    pageSize: limit,
                    totalRecords: finalTotalWithoutSearch,
                    totalPages: Math.ceil(totalWithSearch / limit)
                }
            });
            return;
        }

        // Step 4: Fetch full employee details with address for paginated employees
        const employeesBasicDataPaginated = await dbOutput.employeeBasicDetails.findAll({
            include: [
                {
                    model: dbOutput.employeeAddressDetails,
                    as: 'addressDetails',
                    required: false,
                    attributes: ['state']
                }
            ],
            where: { 
                empUuid: { [Op.in]: paginatedEmpUuids },
                isDeleted: false
            },
            attributes: ['empUuid', 'empFirstName', 'empLastName'],
            order: [['empFirstName', 'ASC'], ['empLastName', 'ASC']],
            raw: true,
            nest: true
        });

        // Step 4b: Fetch current job details using the helper function (handles conversion date logic)
        const paginatedJobDetailsMap = await fetchEmployeeCurrentJobDetails(paginatedEmpUuids);

        // Step 4c: Combine employee basic data with job details
        const employees = employeesBasicDataPaginated.map(emp => {
            const empData = emp as any;
            const jobDetails = paginatedJobDetailsMap.get(empData.empUuid);
            return {
                ...empData,
                jobDetails: jobDetails || null
            };
        });

        const empUuids = employees.map(e => e.empUuid);

        // ============================================
        // 6. BATCH FETCH PAYSLIP DATA
        // ============================================
        // Fetch all payslip records for current employees in one query
        const payslipRecords: employeePayslipAttributes[] = await dbOutput.employeePayslipRecords.findAll({
            where: {
                employeeId: { [Op.in]: empUuids },
                ...monthYearFilter
            },
            attributes: ['payslipId', 'employeeId', 'payrollStartDate', 'payrollEndDate', 'status', 'netPay'],
            order: [['payrollStartDate', 'DESC']],
            raw: true
        });

        // Create map for O(1) lookup of payslip by employee ID
        const payslipMap = new Map(payslipRecords.map(p => [p.employeeId, p]));

        // Get payslip IDs for generated payslips
        const generatedPayslipIds = payslipRecords
            .filter(p => p.status === payrollStatus.PAYROLL_GENERATED)
            .map(p => p.payslipId);

        // Batch fetch all payslip items for generated payslips
        const payslipItemsMap = new Map<string, employeePayslipItemAttributes[]>();
        if (generatedPayslipIds.length > 0) {
            const allPayslipItems = await dbOutput.employeePayslipItems.findAll({
                where: {
                    payslipId: { [Op.in]: generatedPayslipIds },
                    isDeleted: false
                },
                attributes: ['payslipId', 'payrollItemId', 'componentName', 'componentType', 'amount'],
                raw: true
            });

            // Group items by payslip ID for quick lookup
            allPayslipItems.forEach(item => {
                if (!payslipItemsMap.has(item.payslipId)) {
                    payslipItemsMap.set(item.payslipId, []);
                }
                payslipItemsMap.get(item.payslipId)!.push(item);
            });
        }

        // ============================================
        // 7. BATCH FETCH SALARY CATEGORIES
        // ============================================
        // Build salary category queries for all employees
        const salaryCategoryQueries = employees
            .filter(e => (e as any).jobDetails)
            .map(e => {
                const emp = e as any;
                const { empType, empDepartment, empLevel, empYearOfStudy } = emp.jobDetails;
                const employeeLocation = emp.addressDetails?.state || null;

                // Build where clause based on employee type
                const whereClause: Record<string, unknown> = {
                    employeeType: empType,
                    employeeLocation: employeeLocation,
                    isDeleted: false
                };

                // Different employee types have different applicable fields
                if (empType === 'fte_key' || empType === 'ofte_key' || empType === 'pte_key') {
                    // Full-time employees: have level but don't check department/year (they can be null or not null)
                    whereClause.employeeLevel = empLevel || null;
                    // Don't include department and yearOfStudy in where clause
                } else if (empType === 'intern_key' || empType === 'extended_intern_key') {
                    // Interns: have all fields
                    whereClause.employeeLevel = empLevel || null;
                    whereClause.department = empDepartment || null;
                    whereClause.yearOfStudy = empYearOfStudy || null;
                } else {
                    // Other types (consultants, contractors): only type and location
                    // Don't include level, department, or yearOfStudy in where clause
                }

                return { 
                    empUuid: emp.empUuid, 
                    whereClause,
                    empType,
                    empLevel,
                    empDepartment,
                    empYearOfStudy
                };
            });

        // Fetch all matching salary categories in one query
        const [salaryCategories, globalSalaryCategory] = await Promise.all([
            dbOutput.salaryCategories.findAll({
                where: {
                    [Op.or]: salaryCategoryQueries.map(q => q.whereClause)
                },
                attributes: ['salaryCategoryId', 'employeeType', 'employeeLocation', 'employeeLevel', 'department', 'yearOfStudy'],
                raw: true
            }),
            dbOutput.salaryCategories.findOne({
                where: getGlobalSalaryCategoryWhere(),
                attributes: ['salaryCategoryId'],
                raw: true
            })
        ]);

        const globalSalaryCategoryId = globalSalaryCategory?.salaryCategoryId || null;

        // Map employees to their salary categories
        const salaryCategoryMap = new Map<string, string>();
        salaryCategoryQueries.forEach(query => {
            const wc = query.whereClause;
            const match = salaryCategories.find(cat => {
                // Base matching: always check empType and location
                if (cat.employeeType !== wc.employeeType || cat.employeeLocation !== wc.employeeLocation) {
                    return false;
                }

                // For FTE/OFTE/PTE: Only check empType, location, and level. Don't check department and yearOfStudy.
                if (query.empType === 'fte_key' || query.empType === 'ofte_key' || query.empType === 'pte_key') {
                    return cat.employeeLevel === (query.empLevel || null);
                } 
                // For interns: Check all fields including department and yearOfStudy
                else if (query.empType === 'intern_key' || query.empType === 'extended_intern_key') {
                    return cat.employeeLevel === (query.empLevel || null) &&
                        cat.department === (query.empDepartment || null) &&
                        cat.yearOfStudy === (query.empYearOfStudy || null);
                } 
                // For other types: Only check empType and location (not level, department, or yearOfStudy)
                else {
                    return true; // Already matched empType and location above
                }
            });
            if (match) {
                salaryCategoryMap.set(query.empUuid, match.salaryCategoryId);
            }
        });

        // ============================================
        // 8. BATCH FETCH SALARY COMPONENTS
        // ============================================
        const categoriesWithSalary = Array.from(new Set([
            ...salaryCategoryMap.values(),
            ...(globalSalaryCategoryId ? [globalSalaryCategoryId] : [])
        ]));
        
        // Calculate the requested month's date range for effectiveFrom filtering
        const monthStartDate = new Date(year, month - 1, 1);
        const monthEndDate = new Date(year, month, 0, 23, 59, 59, 999);
        
        const allSalaryComponents = categoriesWithSalary.length > 0 ? await dbOutput.salaryComponents.findAll({
            where: {
                salaryCategoryId: { [Op.in]: categoriesWithSalary },
                isDeleted: false,
                // Filter by effectiveFrom: include if effectiveFrom is null or <= month end
                [Op.and]: [
                    {
                        [Op.or]: [
                            { effectiveFrom: null },
                            { effectiveFrom: { [Op.lte]: monthEndDate } }
                        ]
                    },
                    // Filter by effectiveTill: include if effectiveTill is null or >= month start
                    {
                        [Op.or]: [
                            { effectiveTill: null },
                            { effectiveTill: { [Op.gte]: monthStartDate } }
                        ]
                    }
                ]
            },
            raw: true
        }) : [];

        // Group components by category ID for quick lookup
        const salaryComponentsMap = new Map<string, typeof allSalaryComponents>();
        allSalaryComponents.forEach(comp => {
            if (!salaryComponentsMap.has(comp.salaryCategoryId)) {
                salaryComponentsMap.set(comp.salaryCategoryId, []);
            }
            salaryComponentsMap.get(comp.salaryCategoryId)!.push(comp);
        });

        // ============================================
        // 9. BATCH FETCH AND FILTER ADJUSTMENTS
        // ============================================
        // Fetch all employee-specific component adjustments
        const allAdjustments = await dbOutput.employeeComponentAdjustments.findAll({
            where: {
                employeeId: { [Op.in]: empUuids },
                startDate: { [Op.lte]: new Date(year, month, 0) },
                [Op.or]: [
                    { endDate: { [Op.gte]: new Date(year, month - 1, 1) } },
                    { endDate: null }
                ],
                isDeleted: false
            },
            include: [
                {
                    model: dbOutput.salaryComponents,
                    as: 'salaryComponent',
                    attributes: ['componentId', 'componentName', 'componentType', 'frequency', 'isVariable', 'thresholdAmount', 'percentageOfBasicSalary'],
                    required: true
                }
            ],
            attributes: ['adjustmentId', 'employeeId', 'componentId', 'adjustedAmount', 'adjustedFrequency', 'startDate', 'endDate']
        });

        // Determine if an adjustment is applicable for the current payroll month.
        // Frequency rules:
        //   one_time: only in the exact startDate month+year
        //   monthly / null: every month within the date range
        //   quarterly: startDate month, then every 3 months
        //   half_yearly: startDate month, then every 6 months
        //   annually: startDate month, then every 12 months
        // effectiveTill (endDate) acts as the hard stop — no occurrence after that month.
        const isApplicableThisMonth = (adj: any): boolean => {
            const startDate = new Date(adj.startDate);
            const startYear = startDate.getFullYear();
            const startMonth = startDate.getMonth() + 1;
            const monthStartDate = new Date(year, month - 1, 1);

            if (adj.endDate && new Date(adj.endDate) < monthStartDate) return false;

            if (adj.adjustedFrequency === 'one_time_key') {
                return startMonth === month && startYear === year;
            }

            const frequencyConfig = componentFrequencies[adj.adjustedFrequency];
            if (!frequencyConfig || !frequencyConfig[1]) return true;

            const frequencyNum = 12 / parseInt(frequencyConfig[1]);
            if (isNaN(frequencyNum) || frequencyNum <= 0) return true;

            const monthsElapsed = (year - startYear) * 12 + (month - startMonth);
            return monthsElapsed >= 0 && monthsElapsed % frequencyNum === 0;
        };

        // Filter to only applicable adjustments, then group by employee ID
        const applicableAdjustments = allAdjustments.filter(isApplicableThisMonth);
        const adjustmentsMap = new Map<string, typeof applicableAdjustments>();
        applicableAdjustments.forEach(adj => {
            if (!adjustmentsMap.has(adj.employeeId)) {
                adjustmentsMap.set(adj.employeeId, []);
            }
            adjustmentsMap.get(adj.employeeId)!.push(adj);
        });

        // ============================================
        // 10. BATCH FETCH UNPAID LEAVE DATA
        // ============================================
        const unpaidLeaveMap = new Map<string, number>();
        if (unpaidLeaveConfigId && payslipRecords.length > 0) {
            // Determine date range to check for unpaid leaves
            const dateRanges = payslipRecords.map(p => ({
                empUuid: p.employeeId,
                startDate: new Date(year, month - 1, 1),
                endDate: new Date(year, month - 1 + 1, 0)
            }));

            const minDate = new Date(Math.min(...dateRanges.map(d => d.startDate.getTime())));
            const maxDate = new Date(Math.max(...dateRanges.map(d => d.endDate.getTime())));

            // Fetch all unpaid leave attendance records in one query
            const unpaidAttendance = await dbOutput.employeeAttendanceDetails.findAll({
                where: {
                    empUuid: { [Op.in]: empUuids },
                    attendanceDate: { [Op.between]: [minDate, maxDate] },
                    attendanceStatus: {[Op.in]: [AttendanceStatusType.HALF_DAY, AttendanceStatusType.ON_LEAVE]},
                    isDeleted: false
                },
                include: [
                    {
                        model: dbOutput.employeeLeaveRequestDetails,
                        as: 'leaveRequest',
                        where: { leaveConfigId: unpaidLeaveConfigId },
                        required: true,
                        attributes: ['leaveRequestId']
                    }
                ],
                attributes: ['empUuid', 'attendanceDate', 'attendanceStatus'],
                raw: true
            });

            // Count unpaid leaves per employee
            unpaidAttendance.forEach(att => {
                const leaveCount = att?.attendanceStatus === AttendanceStatusType.ON_LEAVE ? 1 : 0.5;
                unpaidLeaveMap.set(att.empUuid, (unpaidLeaveMap.get(att.empUuid) || 0) + leaveCount); // todo: adjust for half day
            });
        }

        // ============================================
        // 11. PROCESS AND FORMAT PAYROLL DATA
        // ============================================
        const payrollData: PayrollDataItem[] = [];

        for (const employee of employees) {
            const emp = employee as any;
            const empUuid = emp.empUuid;
            const empName = `${emp.empFirstName} ${emp.empLastName}`;
            const jobDetails = emp.jobDetails;
            const payslipRecord = payslipMap.get(empUuid);

            // Skip if missing required data
            if (!jobDetails || !payslipRecord) continue;

            const payslipStatus = payslipRecord.status || 'not_created';

            // ============================================
            // 11a. HANDLE GENERATED PAYSLIPS
            // ============================================
            // For generated payslips, use stored payslip items
            if (payslipStatus === payrollStatus.PAYROLL_GENERATED) {
                const payslipItems = payslipItemsMap.get(payslipRecord.payslipId) || [];

                const defaultAdditions = formatItems(componentTypes.DEFAULT_ADDITION, payslipItems);
                const monthlyCTC = defaultAdditions.reduce((sum, item) => sum + item.amount, 0);

                payrollData.push({
                    payslipId: payslipRecord.payslipId,
                    empUuid,
                    empName,
                    monthlyCTC,
                    defaultAdditions,
                    additions: formatItems(componentTypes.ADDITION, payslipItems),
                    defaultDeductions: formatItems(componentTypes.DEFAULT_DEDUCTION, payslipItems),
                    deductions: formatItems(componentTypes.DEDUCTION, payslipItems),
                    unpaidLeave: unpaidLeaveMap.get(empUuid) || 0,
                    status: payslipStatus,
                    netPay: payslipRecord.netPay ? parseFloat(String(payslipRecord.netPay)) : 0
                });
                continue;
            }

            // ============================================
            // 11b. HANDLE NON-GENERATED PAYSLIPS
            // ============================================
            // Calculate payroll on-the-fly from configurations and adjustments
            const salaryCategoryId = salaryCategoryMap.get(empUuid) || null;
            if (!salaryCategoryId && !globalSalaryCategoryId) continue;

            // Get merged salary components: global defaults + specific category (specific overrides global by type+name)
            const specificComponents = salaryCategoryId ? (salaryComponentsMap.get(salaryCategoryId) || []) : [];
            const globalComponents = globalSalaryCategoryId ? (salaryComponentsMap.get(globalSalaryCategoryId) || []) : [];
            const components = mergeSalaryComponentsWithSpecificPriority(globalComponents, specificComponents);
            const defaultAdditions = components.filter(c => c.componentType === componentTypes.DEFAULT_ADDITION);
            const defaultDeductions = components.filter(c => c.componentType === componentTypes.DEFAULT_DEDUCTION);
            const monthlyCTC = defaultAdditions.reduce((sum, c) => sum + (parseFloat(String(c.amount)) || 0), 0);

            // Get adjustments for this employee
            const empAdjustments = adjustmentsMap.get(empUuid) || [];
            const additions = empAdjustments.filter(adj => adj.salaryComponent?.componentType === componentTypes.ADDITION);
            const deductions = empAdjustments.filter(adj => adj.salaryComponent?.componentType === componentTypes.DEDUCTION);

            // Format adjustment data for response
            const formatAdjustment = (adj: any) => {
                const sc = adj.salaryComponent;
                const effectiveFrequency = adj.adjustedFrequency || sc?.frequency || null;
                const realAmount = parseFloat(String(adj.adjustedAmount)) || 0;
                
                return {
                    adjustmentId: adj.adjustmentId,
                    componentId: adj.componentId,
                    componentName: sc?.componentName || 'Unknown',
                    adjustedAmount: realAmount,
                    amount: realAmount,
                    startDate: formatLocalDate(adj.startDate),
                    endDate: formatLocalDate(adj.endDate),
                    effectiveTill: formatLocalDate(adj.endDate),
                    adjustedFrequency: adj.adjustedFrequency || null,
                    frequency: sc?.frequency || null,
                    effectiveFrequency: effectiveFrequency,
                    isVariable: sc?.isVariable ?? true,
                    thresholdAmount: sc?.thresholdAmount ? parseFloat(String(sc.thresholdAmount)) : null,
                    percentageOfBasicSalary: sc?.percentageOfBasicSalary ? parseFloat(String(sc.percentageOfBasicSalary)) : null
                };
            };

            // Format component data for response
            const formatComponent = (comp: any) => ({
                componentId: comp.componentId,
                componentName: comp.componentName,
                amount: parseFloat(String(comp.amount)) || 0,
                percentageOfBasicSalary: comp.percentageOfBasicSalary ? parseFloat(String(comp.percentageOfBasicSalary)) : null,
                thresholdAmount: comp.thresholdAmount ? parseFloat(String(comp.thresholdAmount)) : null,
                frequency: comp.frequency,
                isVariable: comp.isVariable,
                includeinLop: comp.includeinLop,
                effectiveFrom: formatLocalDate(comp.effectiveFrom),
                effectiveTill: formatLocalDate(comp.effectiveTill)
            });

            const daysInMonth = new Date(year, month, 0).getDate();
            const formatDefaultDeduction = (comp: any, unpaidLeaveDays: number, allComponents: any[] = []): Promise<any | null> => {
                const componentNameLower = String(comp.componentName || '').toLowerCase();
                const isLopComponent = componentNameLower.includes('loss of pay') || componentNameLower.includes('lop');
                const baseAmount = parseFloat(String(comp.amount)) || 0;
                
                let amount = baseAmount;
                if (isLopComponent) {
                    // Calculate LOP dynamically by summing up components with includeinLop = true
                    const lopIncludedAmount = allComponents
                        .filter(c => c.componentType === 'defaultAddition' && c.includeinLop)
                        .reduce((sum, c) => sum + (parseFloat(String(c.amount)) || 0), 0);
                    
                    // If no components have includeinLop, fallback to baseAmount
                    const totalLopBase = lopIncludedAmount > 0 ? lopIncludedAmount : baseAmount;
                    const dailyRate = totalLopBase / daysInMonth;
                    amount = dailyRate * unpaidLeaveDays;
                }

                if (isLopComponent && unpaidLeaveDays === 0) {
                    return Promise.resolve(null);
                }

                return Promise.resolve({
                    ...formatComponent(comp),
                    amount
                });
            };

            const actualUnpaidLeaveDays = unpaidLeaveMap.get(empUuid) || 0;
            const formattedDefaultDeductions = await Promise.all(
                defaultDeductions.map(comp => formatDefaultDeduction(comp, actualUnpaidLeaveDays, components))
            );

            payrollData.push({
                payslipId: payslipRecord.payslipId || null,
                empUuid,
                empName,
                monthlyCTC,
                defaultAdditions: defaultAdditions.map(formatComponent),
                additions: additions.map(formatAdjustment),
                defaultDeductions: formattedDefaultDeductions.filter((item): item is any => item !== null),
                deductions: deductions.map(formatAdjustment),
                unpaidLeave: actualUnpaidLeaveDays,
                status: payslipStatus
            });
        }

        // ============================================
        // 12. DETERMINE PAYROLL GENERATION STATUS
        // ============================================
        // Check if any payslip is not yet generated
        const nonFinalizedCount = await dbOutput.employeePayslipRecords.count({
        where: {
            ...monthYearFilter,
            status: { [Op.ne]: payrollStatus.PAYROLL_FINALIZED }
            }
        });

        const isAllPayrollFinalized = nonFinalizedCount === 0;

        const totalRecords = await dbOutput.employeePayslipRecords.count({
        where: monthYearFilter
        });

        const generatedRecords = await dbOutput.employeePayslipRecords.count({
        where: {
            ...monthYearFilter,
            status: payrollStatus.PAYROLL_GENERATED
        }
        });

        const isAllPayrollGenerated = totalRecords > 0 && totalRecords === generatedRecords;



        // ============================================
        // 13. SEND RESPONSE
        // ============================================
        res.status(200).json({
            success: true,
            message: "Payroll details fetched successfully",
            data: payrollData,
            notFetchedEmployees,
            isAllPayrollFinalized,
            isAllPayrollGenerated,
            pagination: {
                currentPage: page,
                pageSize: limit,
                totalRecords: validEmployeeCount,
                totalPages: Math.ceil(validEmployeeCount / limit)
            }
        });

    } catch (error) {
        console.error("Error fetching payroll details:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while fetching payroll details",
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const updatePayrollItems = async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthenticatedRequest;
    
    // Check user permissions
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;
    
    // Check permission: admin access (>= 900) OR Payroll_Edit permission
    const hasPermission = await checkHrmsPermission(
        employeeUuid,
        "Payroll_Edit",
        toolName,
        toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
        res.status(403).json({
            status: "error",
            message: "You don't have permission to edit payroll"
        });
        return;
    }

    const transaction: Transaction = await outputSequelize.transaction();

    try {
        const { employeeId, payslipId, componentType, adjustments } = req.body;

        // Validate required fields
        if (!employeeId || !payslipId || !componentType || !adjustments || !Array.isArray(adjustments)) {
            await transaction.rollback();
            res.status(400).json({
                success: false,
                message: "Missing required fields: employeeId, payslipId, componentType, and adjustments array"
            });
            return;
        }

        // Validate componentType
        if (!['addition', 'deduction'].includes(componentType)) {
            await transaction.rollback();
            res.status(400).json({
                success: false,
                message: "Invalid componentType. Must be 'addition' or 'deduction'"
            });
            return;
        }

        // Verify employee exists and is active
        const employee = await dbOutput.employeeBasicDetails.findOne({
            where: { empUuid: employeeId, isDeleted: false }
        });

        if (!employee) {
            await transaction.rollback();
            res.status(404).json({
                success: false,
                message: "Employee not found"
            });
            return;
        }

        // Verify payroll record exists
        const payrollRecord = await dbOutput.employeePayslipRecords.findOne({
            where: { 
                payslipId: payslipId,
                employeeId: employeeId,
                isDeleted: false
            }
        });

        if (!payrollRecord) {
            await transaction.rollback();
            res.status(404).json({
                success: false,
                message: "Payroll record not found for this employee"
            });
            return;
        }

        // Process adjustments - update if exists, create if new, delete if marked.
        // First pass: apply all deletions so "already added" checks only consider non-deleted records.
        const createdAdjustments: CreatedAdjustment[] = [];
        const updatedAdjustments: CreatedAdjustment[] = [];
        const deletedAdjustments: string[] = [];
        const errors: AdjustmentError[] = [];

        for (const adjustment of adjustments) {
            const { adjustmentId, isDeleted } = adjustment;
            if (isDeleted && adjustmentId) {
                const existingAdjustment = await dbOutput.employeeComponentAdjustments.findOne({
                    where: {
                        adjustmentId: adjustmentId,
                        employeeId: employeeId,
                        isDeleted: false
                    }
                });
                if (existingAdjustment) {
                    await existingAdjustment.update({ isDeleted: true }, { transaction });
                    deletedAdjustments.push(adjustmentId);
                }
            }
        }

        // Second pass: create/update. Duplicate check only finds non-deleted, active records (so deleted in this request are ignored).
        for (const adjustment of adjustments) {
            try {
                const { adjustmentId, componentId, adjustedAmount, adjustedFrequency, startDate, endDate, isDeleted } = adjustment;

                if (isDeleted && adjustmentId) continue;

                // Validate required fields for create/update adjustments
                if (!componentId || adjustedAmount === undefined || adjustedAmount === null) {
                    errors.push({
                        componentId,
                        error: "Missing required fields: componentId and adjustedAmount"
                    });
                    continue;
                }

                // Verify component exists and matches the type
                const component = await dbOutput.salaryComponents.findOne({
                    where: {
                        componentId: componentId,
                        componentType: componentType === 'addition' ? componentTypes.ADDITION : componentTypes.DEDUCTION,
                        isDeleted: false
                    }
                });

                if (!component) {
                    errors.push({
                        componentId,
                        error: `Component not found or type mismatch. Expected ${componentType}`
                    });
                    continue;
                }

                // Check if adjustmentId is provided and exists
                if (adjustmentId) {
                    // Try to find existing adjustment
                    const existingAdjustment = await dbOutput.employeeComponentAdjustments.findOne({
                        where: {
                            adjustmentId: adjustmentId,
                            employeeId: employeeId,
                            isDeleted: false
                        }
                    });

                    if (existingAdjustment) {
                        // If changing to a different component, check that component isn't already active for this employee
                        const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                        const freqLabels: Record<string, string> = {
                            'monthly_key': 'Monthly',
                            'quarterly_key': 'Quarterly',
                            'half_yearly_key': 'Half-Yearly',
                            'annually_key': 'Annually',
                            'one_time_key': 'One Time'
                        };

                        if (existingAdjustment.componentId !== componentId) {
                            const candidateStartDate = parseDateInput(startDate) || existingAdjustment.startDate;
                            const candidateEndDate = parseDateInput(endDate);
                            if (candidateEndDate && candidateEndDate < new Date(candidateStartDate)) {
                                errors.push({
                                    componentId,
                                    error: "Effective till date cannot be earlier than start date"
                                });
                                continue;
                            }

                            const potentialDuplicates = await dbOutput.employeeComponentAdjustments.findAll({
                                where: {
                                    employeeId: employeeId,
                                    componentId: componentId,
                                    adjustmentId: { [Op.ne]: adjustmentId },
                                    isDeleted: false
                                }
                            });

                            const alreadyAdded = potentialDuplicates.find((dup) =>
                                rangesOverlap(
                                    new Date(dup.startDate),
                                    dup.endDate ? new Date(dup.endDate) : null,
                                    new Date(candidateStartDate),
                                    candidateEndDate
                                )
                            );

                            if (alreadyAdded) {
                                const dupFreq = (alreadyAdded as { adjustedFrequency?: string }).adjustedFrequency;
                                const dupStart = new Date(alreadyAdded.startDate);
                                const dupDate = dupStart.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                const dupFreqLabel = freqLabels[dupFreq || ''] || dupFreq || 'Monthly';
                                errors.push({
                                    componentId,
                                    error: `"${component.componentName}" is already added on ${dupDate} with ${dupFreqLabel} frequency`
                                });
                                continue;
                            }
                        }

                        // Update existing adjustment
                        await existingAdjustment.update({
                            componentId: componentId,
                            adjustedAmount: parseFloat(String(adjustedAmount)),
                            adjustedFrequency: adjustedFrequency || existingAdjustment.adjustedFrequency,
                            startDate: parseDateInput(startDate) || existingAdjustment.startDate,
                            endDate: parseDateInput(endDate)
                        }, { transaction });

                        updatedAdjustments.push({
                            adjustmentId: existingAdjustment.adjustmentId,
                            componentId: componentId,
                            componentName: component.componentName,
                            adjustedAmount: parseFloat(String(adjustedAmount))
                        });
                        continue;
                    }
                }

                // Check for duplicate: only block if same component is already active (not expired).
                // If effectiveTill has passed, user can add the same component again.
                // Enforce month-start semantics for NEW adjustments:
                // startDate is always the 1st day of the selected payroll month.
                const normalizedStartDate = getMonthStartDate(payrollRecord.payrollStartDate) || new Date(payrollRecord.payrollStartDate);
                const normalizedEndDate = parseDateInput(endDate);
                if (normalizedEndDate && normalizedEndDate < normalizedStartDate) {
                    errors.push({
                        componentId,
                        error: "Effective till date cannot be earlier than start date"
                    });
                    continue;
                }

                const potentialDuplicates = await dbOutput.employeeComponentAdjustments.findAll({
                    where: {
                        employeeId: employeeId,
                        componentId: componentId,
                        isDeleted: false
                    },
                    include: [{
                        model: dbOutput.salaryComponents,
                        as: 'salaryComponent',
                        attributes: ['componentName']
                    }]
                });

                const existingDuplicate = potentialDuplicates.find((dup) =>
                    rangesOverlap(
                        new Date(dup.startDate),
                        dup.endDate ? new Date(dup.endDate) : null,
                        normalizedStartDate,
                        normalizedEndDate
                    )
                );

                if (existingDuplicate) {
                    const freqLabels: Record<string, string> = {
                        'monthly_key': 'Monthly',
                        'quarterly_key': 'Quarterly',
                        'half_yearly_key': 'Half-Yearly',
                        'annually_key': 'Annually',
                        'one_time_key': 'One Time'
                    };
                    const dupFreq = (existingDuplicate as any).adjustedFrequency;
                    const dupStart = new Date(existingDuplicate.startDate);
                    const dupDate = dupStart.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const dupFreqLabel = freqLabels[dupFreq] || dupFreq || 'Monthly';

                    errors.push({
                        componentId,
                        error: `"${component.componentName}" is already added on ${dupDate} with ${dupFreqLabel} frequency`
                    });
                    continue;
                }

                // Create new adjustment
                const newAdjustmentId = await createUUIDV4();

                const newAdjustment = await dbOutput.employeeComponentAdjustments.create({
                    adjustmentId: newAdjustmentId,
                    employeeId: employeeId,
                    componentId: componentId,
                    adjustedAmount: parseFloat(String(adjustedAmount)),
                    adjustedFrequency: adjustedFrequency || null,
                    startDate: normalizedStartDate,
                    endDate: normalizedEndDate,
                    isDeleted: false
                }, { transaction });

                createdAdjustments.push({
                    adjustmentId: newAdjustment.adjustmentId,
                    componentId: componentId,
                    componentName: component.componentName,
                    adjustedAmount: newAdjustment.adjustedAmount
                });

            } catch (adjError) {
                errors.push({
                    componentId: adjustment.componentId,
                    error: adjError instanceof Error ? adjError.message : 'Unknown error'
                });
            }
        }

        const duplicateErrors = errors.filter((e: AdjustmentError) => e.error?.includes('already added'));
        if (duplicateErrors.length > 0) {
            await transaction.rollback();
            const message = duplicateErrors.map((e: AdjustmentError) => e.error).join('; ');
            res.status(400).json({
                success: false,
                message
            });
            return;
        }

        await transaction.commit();

        res.status(200).json({
            success: true,
            message: `Payroll ${componentType}s updated successfully`,
            data: {
                employeeId,
                payslipId,
                componentType,
                adjustmentsCreated: createdAdjustments.length,
                adjustmentsUpdated: updatedAdjustments.length,
                adjustmentsDeleted: deletedAdjustments.length,
                errorCount: errors.length,
                createdAdjustments,
                updatedAdjustments,
                deletedAdjustments,
                errors
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error("Error updating payroll items:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while updating payroll items",
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Generate Payroll
// TODO: send payslip mails to employees after payroll generation
export const generatePayroll = async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthenticatedRequest;
    
    // Check user permissions
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;
    
    // Check permission: admin access (>= 900) OR Payroll_Generate permission
    const hasPermission = await checkHrmsPermission(
        employeeUuid,
        "Payroll_Generate",
        toolName,
        toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
        res.status(403).json({
            status: "error",
            message: "You don't have permission to generate payroll"
        });
        return;
    }

    try {
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        // validate month and year
        if(isNaN(month) || isNaN(year)) {
            res.status(400).json({
                success: false,
                message: "Invalid month provided",
            });
            return;
        }

        const result = await outputSequelize.transaction(async (t) => {
            const transaction = t;

            const generatedPayrolls: Array<{ payslipId: string; empUuid: string; netPay: number }> = [];
            const errors: Array<{ empUuid: string; error: string }> = [];

            // Fetch all payslip records for the given month
            // Fetch unpaid leave config
            const { startDate: payrollMonthStart, endDate: payrollMonthEnd } = getMonthYearDateRange(month, year);
            const [finalizedPayrollRecords, unpaidLeaveConfig] = await Promise.all([
                dbOutput.employeePayslipRecords.findAll({
                    where: {
                        payrollStartDate: { [Op.between]: [payrollMonthStart, payrollMonthEnd] },
                        isDeleted: false
                    }
                }),
                dbOutput.employeeLeaveConfigurator.findOne({
                    where: {
                        [Op.and]: [
                            outputSequelize.where(
                                outputSequelize.fn('LOWER', outputSequelize.col('leaveType')),
                                { [Op.like]: '%unpaid%' }
                            ),
                            { isActive: true }
                        ]
                    },
                    attributes: ['leaveConfigId']
                })
            ]) as [employeePayslipAttributes[], any];

            if(finalizedPayrollRecords.some(record => record.status != payrollStatus.PAYROLL_FINALIZED)) {
                throw new Error("INVALID_PAYROLL_STATUS");
            }
            if(!unpaidLeaveConfig) {
                throw new Error("UNPAID_LEAVE_CONFIG_NOT_FOUND");
            }

            const unpaidLeaveConfigId = unpaidLeaveConfig?.leaveConfigId || null;

            // Fetch frequency config for filtering adjustments during generation
            const generateFreqConfig = await dbOutput.employeeComponentConfigurator.findOne({
                where: { componentType: 'leave_accural_frequency', isDeleted: false }
            });
            const generateFrequencies: Record<string, string[]> = generateFreqConfig?.componentValue 
                ? (typeof generateFreqConfig.componentValue === 'string' 
                    ? JSON.parse(generateFreqConfig.componentValue) 
                    : generateFreqConfig.componentValue) 
                : {};

            // Create a map for quick lookup of payroll records by employeeId
            const payrollRecordMap = new Map();
            finalizedPayrollRecords.forEach(record => {
                payrollRecordMap.set(record.employeeId, record);
            });

            // Get unique employeeIds
            const employeeIds = Array.from(payrollRecordMap.keys());

            // Bulk fetch employees with payslip records for the selected month.
            // Keep offboarded employees eligible if a month payslip already exists.
            const employeesBasicDataForPayroll = await dbOutput.employeeBasicDetails.findAll({
                include: [
                    {
                        model: dbOutput.employeeAddressDetails,
                        as: 'addressDetails',
                        required: false,
                        attributes: ['state']
                    }
                ],
                where: { 
                    empUuid: { [Op.in]: employeeIds },
                    isDeleted: false
                },
                attributes: ['empUuid', 'empFirstName', 'empLastName']
            });

            // Fetch current job details using the helper function (handles conversion date logic)
            const payrollJobDetailsMap = await fetchEmployeeCurrentJobDetails(employeeIds, transaction);

            // Combine employee basic data with job details
            const employees = employeesBasicDataForPayroll.map(emp => {
                const empData = emp as any;
                const jobDetails = payrollJobDetailsMap.get(empData.empUuid);
                return {
                    ...empData,
                    empUuid: empData.empUuid,
                    empFirstName: empData.empFirstName,
                    empLastName: empData.empLastName,
                    addressDetails: empData.addressDetails,
                    jobDetails: jobDetails || null
                };
            });

            const globalSalaryCategory = await dbOutput.salaryCategories.findOne({
                where: getGlobalSalaryCategoryWhere(),
                attributes: ['salaryCategoryId']
            });
            const globalSalaryCategoryId = globalSalaryCategory?.salaryCategoryId || null;

            // Process each employee
            for (const employee of employees) {
                const empUuid = employee.empUuid;
                
                try {
                    const payrollRecord = payrollRecordMap.get(empUuid);
                    if (!payrollRecord) {
                        errors.push({
                            empUuid,
                            error: "No pending payroll record found for this employee"
                        });
                        continue;
                    }

                    const jobDetails = (employee as any).jobDetails;
                    const addressDetails = (employee as any).addressDetails;

                    if (!jobDetails) {
                        errors.push({
                            empUuid,
                            error: "Employee job details not found"
                        });
                        continue;
                    }

                    const { empType, empDepartment, empLevel, empYearOfStudy } = jobDetails;
                    const employeeLocation = addressDetails?.state || null;

                    // Build where clause for salary category
                    const whereClause: Record<string, unknown> = {
                        employeeType: empType,
                        employeeLocation: employeeLocation,
                        isDeleted: false
                    };

                    if (empType === 'fte_key' || empType === 'ofte_key' || empType === 'pte_key') {
                        whereClause.employeeLevel = empLevel || null;
                        // Don't include department and yearOfStudy in where clause - they can be null or not null, doesn't matter
                    } else if (empType === 'intern_key' || empType === 'extended_intern_key') {
                        whereClause.employeeLevel = empLevel || null;
                        whereClause.department = empDepartment || null;
                        whereClause.yearOfStudy = empYearOfStudy || null;
                    } else {
                        // For other types: Only check empType and location (not level, department, or yearOfStudy)
                        // Don't include these fields in where clause
                    }

                    // Find salary category
                    const salaryCategory = await dbOutput.salaryCategories.findOne({
                        where: whereClause,
                        attributes: ['salaryCategoryId']
                    });

                    if (!salaryCategory) {
                        errors.push({
                            empUuid,
                            error: "Salary category not found for this employee"
                        });
                        continue;
                    }

                    const categoryIdsToFetch = [
                        salaryCategory.salaryCategoryId,
                        ...(globalSalaryCategoryId ? [globalSalaryCategoryId] : [])
                    ];

                    // Fetch all component configurations for specific + global categories
                    const allComponents: salaryComponentsAttributes[] = await dbOutput.salaryComponents.findAll({
                        where: {
                            salaryCategoryId: { [Op.in]: categoryIdsToFetch },
                            componentType: { [Op.or]: [componentTypes.DEFAULT_ADDITION, componentTypes.DEFAULT_DEDUCTION] },
                            isDeleted: false
                        }
                    });

                    const specificComponents = allComponents.filter(comp => comp.salaryCategoryId === salaryCategory.salaryCategoryId);
                    const globalComponents = globalSalaryCategoryId
                        ? allComponents.filter(comp => comp.salaryCategoryId === globalSalaryCategoryId)
                        : [];
                    const mergedComponents = mergeSalaryComponentsWithSpecificPriority(globalComponents, specificComponents);

                    // Get default additions
                    const defaultAdditionComponents = mergedComponents.filter(comp => comp.componentType === componentTypes.DEFAULT_ADDITION);

                    let monthlyCTC = 0;
                    const payrollItemsToCreate: Array<{
                        payrollItemId: string;
                        payslipId: string;
                        componentName: string;
                        componentType: string;
                        amount: number;
                        isDeleted: boolean;
                    }> = [];

                    // Process default additions
                    for (const configComp of defaultAdditionComponents) {
                        monthlyCTC += parseFloat(String(configComp.amount));

                        payrollItemsToCreate.push({
                            payrollItemId: await createUUIDV4(),
                            payslipId: payrollRecord.payslipId,
                            componentName: configComp.componentName,
                            componentType: configComp.componentType,
                            amount: parseFloat(String(configComp.amount)),
                            isDeleted: false
                        });
                    }

                    // Get default deductions
                    const defaultDeductionComponents = mergedComponents.filter(comp => comp.componentType === componentTypes.DEFAULT_DEDUCTION);

                    let totalDefaultDeductions = 0;

                    // Calculate unpaid leave days for the ENTIRE MONTH
                    const payrollStartDate = payrollRecord.payrollStartDate;
                    const startMonth = new Date(payrollStartDate);
                    
                    // Use first day and last day of the payroll month
                    const monthStartDate = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
                    const monthEndDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 0, 23, 59, 59);
                    
                    // Set payroll end date to end of month
                    const payrollEndDate = monthEndDate;

                    let unpaidLeaveDays = 0;
                    if (unpaidLeaveConfigId) {
                        const employeeLeaveData = await fetchEmployeeLeavesData(empUuid, monthStartDate, monthEndDate);
                        
                        // Find approved unpaid leave requests that fall within the ENTIRE MONTH
                        const unpaidLeaves = employeeLeaveData.filter(leave => 
                            leave.leaveConfigId === unpaidLeaveConfigId
                        );
                        unpaidLeaveDays = unpaidLeaves.length;

                        console.log(`Total unpaid leave days for ${empUuid}: ${unpaidLeaveDays} (month period: ${monthStartDate.toISOString().split('T')[0]} to ${monthEndDate.toISOString().split('T')[0]})`);
                    }

                    // Process default deductions
                    console.log(`Processing ${defaultDeductionComponents.length} default deductions for ${empUuid}`);
                    
                    for (const configComp of defaultDeductionComponents) {
                        const componentName = configComp.componentName.toLowerCase();
                        const isLopComponent = componentName.includes('loss of pay') || componentName.includes('lop');

                        console.log(`Checking component: "${configComp.componentName}" (lowercase: "${componentName}"), isLOP: ${isLopComponent}, unpaidLeaveDays: ${unpaidLeaveDays}`);

                        if (isLopComponent) {
                            const daysInMonth = monthEndDate.getDate();
                            
                            // Calculate LOP dynamically by summing up components with includeinLop = true
                            const lopIncludedAmount = defaultAdditionComponents
                                .filter(c => c.includeinLop)
                                .reduce((sum, c) => sum + (parseFloat(String(c.amount)) || 0), 0);
                            
                            // If no components have includeinLop, fallback to the config component amount
                            const baseAmount = parseFloat(String(configComp.amount));
                            const totalLopBase = lopIncludedAmount > 0 ? lopIncludedAmount : baseAmount;
                            
                            const lopPerDay = totalLopBase / daysInMonth;
                            console.log(`LOP component found! LOP base: ₹${totalLopBase}, daysInMonth: ${daysInMonth}, LOP per day: ₹${lopPerDay}, Unpaid leave days: ${unpaidLeaveDays}`);
                            
                            // Only add LOP deduction if there are unpaid leaves
                            if (unpaidLeaveDays > 0) {
                                const lopDeduction = lopPerDay * unpaidLeaveDays;
                                totalDefaultDeductions += lopDeduction;

                                console.log(`Adding LOP deduction: ${unpaidLeaveDays} days × ₹${lopPerDay} = ₹${lopDeduction}`);

                                payrollItemsToCreate.push({
                                    payrollItemId: await createUUIDV4(),
                                    payslipId: payrollRecord.payslipId,
                                    componentName: configComp.componentName,
                                    componentType: configComp.componentType,
                                    amount: lopDeduction,
                                    isDeleted: false
                                });
                            } else {
                                console.log(`Skipping LOP deduction because unpaidLeaveDays = 0`);
                            }
                        } else {
                            totalDefaultDeductions += parseFloat(String(configComp.amount));

                            payrollItemsToCreate.push({
                                payrollItemId: await createUUIDV4(),
                                payslipId: payrollRecord.payslipId,
                                componentName: configComp.componentName,
                                componentType: configComp.componentType,
                                amount: parseFloat(String(configComp.amount)),
                                isDeleted: false
                            });
                        }
                    }
                    
                    console.log(`Total items to create for ${empUuid}: ${payrollItemsToCreate.length}`);

                    // Get custom additions/deductions (adjustments)
                    const customComponents = await dbOutput.employeeComponentAdjustments.findAll({
                        where: {
                            employeeId: empUuid,
                            isDeleted: false,
                            startDate: { [Op.lte]: new Date(year, month, 0) },
                            [Op.or]: [
                                { endDate: null },
                                { endDate: { [Op.gte]: payrollStartDate } }
                            ]
                        },
                        include: [{
                            model: dbOutput.salaryComponents,
                            as: 'salaryComponent',
                            required: true,
                            where: {
                                componentType: { [Op.or]: [componentTypes.ADDITION, componentTypes.DEDUCTION] },
                                isDeleted: false
                            },
                            attributes: ['componentId', 'componentName', 'componentType']
                        }]
                    });

                    // Filter by frequency — only include components applicable for this payroll month
                    const applicableComponents = customComponents.filter(adj => {
                        const freq = (adj as any).adjustedFrequency;
                        const sd = new Date(adj.startDate);

                        if (freq === 'one_time_key') {
                            return (sd.getMonth() + 1) === month && sd.getFullYear() === year;
                        }

                        const fc = generateFrequencies[freq];
                        if (!fc || !fc[1]) return true;
                        const interval = 12 / parseInt(fc[1]);
                        if (isNaN(interval) || interval <= 0) return true;

                        const elapsed = (year - sd.getFullYear()) * 12 + (month - (sd.getMonth() + 1));
                        return elapsed >= 0 && elapsed % interval === 0;
                    });

                    const customAdditions = applicableComponents.filter(comp => comp.salaryComponent.componentType === componentTypes.ADDITION);

                    let totalAdditions = 0;
                    for (const adjustment of customAdditions) {
                        totalAdditions += parseFloat(String(adjustment.adjustedAmount));

                        payrollItemsToCreate.push({
                            payrollItemId: await createUUIDV4(),
                            payslipId: payrollRecord.payslipId,
                            componentName: (adjustment as any).salaryComponent.componentName,
                            componentType: (adjustment as any).salaryComponent.componentType,
                            amount: parseFloat(String(adjustment.adjustedAmount)),
                            isDeleted: false
                        });
                    }

                    // Get custom deductions (adjustments)
                    const customDeductions = applicableComponents.filter(comp => comp.salaryComponent.componentType === componentTypes.DEDUCTION);

                    let totalCustomDeductions = 0;
                    for (const adjustment of customDeductions) {
                        totalCustomDeductions += parseFloat(String(adjustment.adjustedAmount));

                        payrollItemsToCreate.push({
                            payrollItemId: await createUUIDV4(),
                            payslipId: payrollRecord.payslipId,
                            componentName: (adjustment as any).salaryComponent.componentName,
                            componentType: (adjustment as any).salaryComponent.componentType,
                            amount: parseFloat(String(adjustment.adjustedAmount)),
                            isDeleted: false
                        });
                    }

                    // Bulk insert all payroll items
                    if (payrollItemsToCreate.length > 0) {
                        await dbOutput.employeePayslipItems.bulkCreate(payrollItemsToCreate, { transaction });
                    }

                    // Calculate net pay
                    const netPay = monthlyCTC + totalAdditions - totalDefaultDeductions - totalCustomDeductions;

                    // Update payroll record with net pay, end date, and status
                    await payrollRecord.update({
                        netPay: netPay,
                        payrollEndDate: payrollEndDate,
                        status: payrollStatus.PAYROLL_GENERATED
                    }, { transaction });

                    generatedPayrolls.push({
                        payslipId: payrollRecord.payslipId,
                        empUuid: empUuid,
                        netPay: netPay
                    });

                } catch (empError) {

                    errors.push({
                        empUuid: empUuid,
                        error: empError instanceof Error ? empError.message : 'Unknown error'
                    });
                }
            }

            return { generatedPayrolls, errors, employeeIds};
        });

        res.status(200).json({
            success: true,
            message: "Payroll generated successfully",
            data: {
                totalEmployees: result.employeeIds.length,
                generatedCount: result.generatedPayrolls.length,
                errorCount: result.errors.length,
                generatedPayrolls: result.generatedPayrolls,
                errors: result.errors
            }
        });

    } catch (error) {
        console.error("Error generating payroll:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while generating payroll",
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Finalize Payslips
export const finalizePayslips = async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthenticatedRequest;
    
    // Check user permissions
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;
    
    // Check permission: admin access (>= 900) OR Payroll_finalize permission
    const hasPermission = await checkHrmsPermission(
        employeeUuid,
        "Payroll_finalize",
        toolName,
        toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
        res.status(403).json({
            status: "error",
            message: "You don't have permission to finalize payroll"
        });
        return;
    }
    const { payslipIds } = req.body as { payslipIds: string[] };

    if (!payslipIds?.length) {
        res.status(400).json({
            success: false,
            message: "payslipIds are required",
        });
        return;
    }

    try {
        const result = await outputSequelize.transaction(async (transaction) => {
            // Fetch all payslip records for the given IDs
            const payslips: employeePayslipAttributes[] = await dbOutput.employeePayslipRecords.findAll({
                where: {
                    payslipId: payslipIds,
                    isDeleted: false,
                },
                attributes: ['payslipId', 'status'],
                raw: true,
                transaction
            });

            // Validate
            const foundIds = payslips.map(p => p.payslipId);
            const missingIds = payslipIds.filter(id => !foundIds.includes(id));
            if (missingIds.length > 0) {
                throw new Error('NOT_FOUND');
            }
            
            // Filter payslips that are in PENDING status and get their IDs
            const validPayslipIds = payslips
                .filter((p) => p.status === payrollStatus.PENDING)
                .map((p) => p.payslipId);

            if (validPayslipIds.length === 0) {
                throw new Error('NO_PENDING_PAYSLIPS');
            }

            // Bulk update statuses
            await dbOutput.employeePayslipRecords.update(
                { status: payrollStatus.PAYROLL_FINALIZED },
                {
                    where: { payslipId: validPayslipIds },
                    transaction,
                }
            );

            return payslips.length;
        });

        res.status(200).json({
            success: true,
            message: `Payroll finalized successfully for ${result} payslips`,
        });
    } catch (error) {
        console.error("Error finalizing payroll:", error);

        if (error instanceof Error) {
            if (error.message.startsWith("NOT_FOUND")) {
                res.status(404).json({
                    success: false,
                    message: "One or more payslip records not found. None were finalized.",
                });
                return;
            }
            if (error.message.startsWith("NO_PENDING_PAYSLIPS")) {
                res.status(400).json({
                    success: false,
                    message: "No payslips with PENDING status found. Only pending payrolls can be finalized.",
                });
                return;
            }
        }

        res.status(500).json({
            success: false,
            message: "Internal server error while finalizing payroll",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};

// Mark payslips as pending
export const markPayslipsAsPending = async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthenticatedRequest;
    
    // Check user permissions
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;
    
    // Check permission: admin access (>= 900) OR Payroll_Edit permission
    const hasPermission = await checkHrmsPermission(
        employeeUuid,
        "Payroll_Edit",
        toolName,
        toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
        res.status(403).json({
            status: "error",
            message: "You don't have permission to edit payroll"
        });
        return;
    }
    const { payslipIds } = req.body as { payslipIds: string[] };

    if (!payslipIds?.length) {
        res.status(400).json({
            success: false,
            message: "payslipIds are required",
        });
        return;
    }

    try {
        const result = await outputSequelize.transaction(async (transaction) => {
            // Fetch all payslip records for the given IDs
            const payslips: employeePayslipAttributes[] = await dbOutput.employeePayslipRecords.findAll({
                where: {
                    payslipId: payslipIds,
                    isDeleted: false,
                },
                attributes: ['payslipId', 'status'],
                raw: true,
                transaction
            });

            // Validate
            const foundIds = payslips.map(p => p.payslipId);
            const missingIds = payslipIds.filter(id => !foundIds.includes(id));
            if (missingIds.length > 0) {
                throw new Error('NOT_FOUND');
            }

            // Filter payslips that are in PAYROLL_FINALIZED status and get their IDs
            const validPayslipIds = payslips
                .filter(p => p.status === payrollStatus.PAYROLL_FINALIZED)
                .map(p => p.payslipId);

            if (validPayslipIds.length === 0) {
                throw new Error('NO_FINALIZED_PAYSLIPS');
            }

            // Bulk update statuses
            await dbOutput.employeePayslipRecords.update(
                { status: payrollStatus.PENDING },
                {
                    where: { payslipId: validPayslipIds },
                    transaction,
                }
            );

            return payslips.length;
        });

        res.status(200).json({
            success: true,
            message: `Payroll marked as pending for ${result} payslips`
        });
    } catch (error) {
        console.error("Error marking payroll as pending:", error);

        if (error instanceof Error) {
            if (error.message.startsWith("NOT_FOUND")) {
                res.status(404).json({
                    success: false,
                    message: "One or more payslip records not found. None were marked as pending.",
                });
                return;
            }
            if (error.message.startsWith("NO_FINALIZED_PAYSLIPS")) {
                res.status(400).json({
                    success: false,
                    message: "No payslips with PAYROLL_FINALIZED status found. Only finalized payrolls can be edited.",
                });
                return;
            }
        }

        res.status(500).json({
            success: false,
            message: "Internal server error while marking payroll as pending",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};


// API to fetch all payslips details of employee for the given year
export const fetchEmployeePayslipsForYear = async (req: Request, res: Response): Promise<void> => {
    try {
        const employeeId = req.query.employeeId as string | undefined;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        if (!employeeId) {
            res.status(400).json({
                success: false,
                message: "Employee ID is required",
            });
            return;
        }

        if (isNaN(year)) {
            res.status(400).json({
                success: false,
                message: "Invalid year provided",
            });
            return;
        }

        // Generate year date range for database-agnostic filtering
        const { startDate: yearStart, endDate: yearEnd } = getYearDateRange(year);
        
        const payslips = await dbOutput.employeePayslipRecords.findAll({
            include: [
                {
                    model: dbOutput.employeePayslipItems,
                    as: 'payslipItems',
                    required: true,
                    attributes: ['payrollItemId', 'componentName', 'componentType', 'amount']
                }
            ],
            where: {
                employeeId: employeeId,
                payrollStartDate: { [Op.between]: [yearStart, yearEnd] },
                isDeleted: false,
            },
            attributes: ['payslipId', 'payrollStartDate', 'payrollEndDate', 'status', 'netPay'],
            order: [['payrollStartDate', 'ASC']]
        });

        res.status(200).json({
            success: true,
            message: "Payslips fetched successfully",
            data: payslips
        });
    } catch (error) {
        console.error("Error fetching employee payslips:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while fetching employee payslips",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};

// API to export payroll as CSV for the given month and year
// TODO: Enable Export when payroll is not generated
export const exportPayrollAsCSV = async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthenticatedRequest;
    
    // Check user permissions
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;
    
    // Check permission: admin access (>= 900) OR Payroll_Edit permission
    const hasPermission = await checkHrmsPermission(
        employeeUuid,
        "Payroll_Edit",
        toolName,
        toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
        res.status(403).json({
            status: "error",
            message: "You don't have permission to export payroll"
        });
        return;
    }

    try {
        const monthQuery = req.query.month as string | undefined;
        const yearQuery = req.query.year as string | undefined;

        const month = monthQuery !== undefined
            ? parseInt(monthQuery, 10)
            : new Date().getMonth() + 1;
        const year = yearQuery !== undefined
            ? parseInt(yearQuery, 10)
            : new Date().getFullYear();

        if (isNaN(month) || month < 1 || month > 12 || isNaN(year)) {
            res.status(400).json({
                success: false,
                message: "Invalid month or year provided",
            });
            return;
        }

        // Fetch all payslip records for the given month and year (database-agnostic)
        const { startDate: csvMonthStart, endDate: csvMonthEnd } = getMonthYearDateRange(month, year);
        const payslips: employeePayslipAttributes[] = await dbOutput.employeePayslipRecords.findAll({
            where: {
                payrollStartDate: { [Op.between]: [csvMonthStart, csvMonthEnd] },
                isDeleted: false,
            },
            attributes: ['payslipId', 'employeeId', 'payrollStartDate', 'payrollEndDate', 'status', 'netPay'],
            order: [['payrollStartDate', 'ASC']],
        });

        if (payslips.length === 0) {
            res.status(404).json({
                success: false,
                message: "No payslips found for the given month and year",
            });
            return;
        }

        // Fetch employee basic details for all payslips
        // Fetch employee attendance details for all payslips
        // Fetch unpaid leave config
        const employeeUuidsForCSV = payslips.map(p => p.employeeId);
        
        const [employeeBasicDetails, employeeJobDetailsMapForCSV] = await Promise.all([
            dbOutput.employeeBasicDetails.findAll({
                where: {
                    empUuid: {
                        [Op.in]: employeeUuidsForCSV
                    },
                    isDeleted: false
                },
                attributes: ['empUuid', 'empFirstName', 'empLastName'],
                raw: true,
            }),
            // Use fetchEmployeeCurrentJobDetails for proper conversion date handling
            fetchEmployeeCurrentJobDetails(employeeUuidsForCSV)
        ]);

        // Convert job details map to array format for compatibility
        const employeeJobDetailsMapForCSVTyped = employeeJobDetailsMapForCSV as Map<string, any>;
        const employeeJobDetails = Array.from(employeeJobDetailsMapForCSVTyped.entries()).map(([empUuid, job]: [string, any]) => ({
            empUuid,
            empConversionDate: job?.empConversionDate
        }));

        // const employeeLeaveDetails = await dbOutput.employeeAttendanceDetails.findAll({
        //     include: [
        //         {
        //             model: dbOutput.employeeLeaveRequestDetails,
        //             as: 'leaveRequest',
        //             attributes: [],
        //             where: {
        //                 leaveConfigId: unpaidLeaveConfig?.leaveConfigId,
        //                 isDeleted: false,
        //             },
        //             required: true,
        //         },
        //     ],
        //     where: {
        //         empUuid: {
        //             [Op.in]: payslips.map(p => p.employeeId),
        //         },
        //         attendanceStatus: {
        //             [Op.in]: [AttendanceStatusType.ON_LEAVE, AttendanceStatusType.HALF_DAY],
        //         },
        //         [Op.or]: [
        //             {
        //                 attendanceDate: {
        //                     [Op.lte]: new Date(year, month, 0),
        //                 },
        //             },
        //             {
        //                 createdAt: {
        //                     [Op.lte]: new Date(year, month, 0),
        //                 },
        //             },
        //         ],
        //         isDeleted: false,
        //     },
        //     attributes: ['empUuid', 'attendanceStatus', 'attendanceDate'],
        //     raw: true,
        // });

        // Create a map of employeeUuid to employee basic details
        // const employeeLeaveDetailsMap: Record<string, any[]> = {};
        // employeeLeaveDetails.forEach(detail => {
        //     employeeLeaveDetailsMap[detail.empUuid] = employeeLeaveDetailsMap[detail.empUuid] || [];
        //     employeeLeaveDetailsMap[detail.empUuid].push(detail);
        // });

        const employeeBasicDetailsMap: Record<string, any> = {};
        employeeBasicDetails.forEach(detail => {
            employeeBasicDetailsMap[detail.empUuid] = detail;
        });

        const employeeJobDetailsMap: Record<string, any> = {};
        employeeJobDetails.forEach(detail => {
            employeeJobDetailsMap[detail.empUuid] = detail;
        });

        const isPayRollGenerate = !payslips.some(p => p.status !== payrollStatus.PAYROLL_GENERATED);

        let formattedPayslips: {name: string, monthlyCTC: number, additions: number, taxesAndDeductions: number, deductions:number, netPay:number}[] = [];

        if(!isPayRollGenerate) {
            res.status(400).json({ success: false, message: "Payroll is not generated yet" });
            return;
        }

        const allGeneratedPayslipItems: employeePayslipItemAttributes[] = await dbOutput.employeePayslipItems.findAll({
            where: {
                payslipId: {
                    [Op.in]: payslips.map(p => p.payslipId)
                },
                isDeleted: false
            }
        });

        const generatedPayslipItemsMap: Record<string, employeePayslipItemAttributes[]> = {};
        allGeneratedPayslipItems.forEach(item => {
            generatedPayslipItemsMap[item.payslipId] = generatedPayslipItemsMap[item.payslipId] || [];
            generatedPayslipItemsMap[item.payslipId].push(item);
        });

        formattedPayslips = payslips.map(payslip => {
            const employeeBasicData = employeeBasicDetailsMap[payslip.employeeId];
            // const employeeJobData = employeeJobDetailsMap[payslip.employeeId];
            const payslipItems = generatedPayslipItemsMap[payslip.payslipId] || [];

            // Filter leaves after conversion date
            // const unpaidLeaves = employeeLeaveDetailsMap[payslip.employeeId] || [];
            // const filteredUnpaidLeaves = unpaidLeaves.filter(leave => {
            //     return new Date(leave.attendanceDate) >= new Date(employeeJobData?.empConversionDate)
            // });

            const name = `${employeeBasicData.empFirstName} ${employeeBasicData.empLastName}`;
            let monthlyCTC = 0;
            let additions = 0;
            let deductions = 0;
            let taxesAndDeductions = 0
            const netPay = payslip.netPay || 0;
            

            payslipItems.forEach(item => {
                if (item.componentType === componentTypes.DEFAULT_ADDITION) {
                    monthlyCTC += parseFloat(String(item.amount)) || 0;
                } else if (item.componentType === componentTypes.ADDITION) {
                    additions += parseFloat(String(item.amount)) || 0;
                } else if (item.componentType === componentTypes.DEDUCTION) {
                    deductions += parseFloat(String(item.amount)) || 0;
                } else if (item.componentType === componentTypes.DEFAULT_DEDUCTION) {
                    taxesAndDeductions += parseFloat(String(item.amount)) || 0;
                }
            });

            return {
                name,
                monthlyCTC,
                additions,   
                taxesAndDeductions,
                deductions,
                netPay
            };
        });

        // condition if payroll is not generated
        // else {
        //     const allAdjustedComponents: employeeComponentAdjustmentsAttributes[] = await dbOutput.employeeComponentAdjustments.findAll({
        //         where: {
        //             employeeId: {
        //                 [Op.in]: payslips.map(p => p.employeeId)
        //             },
        //             isDeleted: false
        //         }
        //     });

        //     const componentDetails: salaryComponentsAttributes[] = await dbOutput.salaryComponents.findAll({
        //         where: {
        //             componentId: {
        //                 [Op.in]: allAdjustedComponents.map(c => c.componentId)
        //             },
        //             isDeleted: false
        //         },
        //         attributes: ['componentId', 'componentName', 'componentType']
        //     })

        //     const adjustedComponentsMap: Record<string, employeeComponentAdjustmentsAttributes[]> = {};
        //     allAdjustedComponents.forEach(component => {
        //         adjustedComponentsMap[component.employeeId] = adjustedComponentsMap[component.employeeId] || [];
        //         adjustedComponentsMap[component.employeeId].push(component);
        //     });

        //     formattedPayslips = payslips.map(payslip => {
        //         const employeeBasicData = employeeBasicDetailsMap[payslip.employeeId];
        //         const employeeJobData = employeeJobDetailsMap[payslip.employeeId];
        //         const adjustedComponents = adjustedComponentsMap[payslip.employeeId] || [];

        //         // Filter leaves after conversion date
        //         const unpaidLeaves = employeeLeaveDetailsMap[payslip.employeeId] || [];
        //         const filteredUnpaidLeaves = unpaidLeaves.filter(leave => {
        //             return new Date(leave.attendanceDate) >= new Date(employeeJobData?.empConversionDate)
        //         });

        //         const name = `${employeeBasicData.empFirstName} ${employeeBasicData.empLastName}`;
        //         let monthlyCTC = 0;
        //         let additions = 0;
        //         let deductions = 0;
        //         let netPay = 0;
        //         const lopDeductions = filteredUnpaidLeaves.length * lopDeductionDetails?.amount || 0;

        //         adjustedComponents.forEach(component => {
        //             const matchingComponent = componentDetails.find(c => c.componentId === component.componentId);

        //             if (matchingComponent) {
        //                 if (matchingComponent.componentType === componentTypes.DEFAULT_ADDITION) {
        //                     monthlyCTC += parseFloat(String(component.adjustedAmount)) || 0;
        //                 } else if (matchingComponent.componentType === componentTypes.ADDITION) {
        //                     additions += parseFloat(String(component.adjustedAmount)) || 0;
        //                 } else if (matchingComponent.componentType === componentTypes.DEDUCTION) {
        //                     deductions += parseFloat(String(component.adjustedAmount)) || 0;
        //                 }
        //             }
        //         })

        //         netPay = monthlyCTC + additions - deductions;

        //         return {
        //             name,
        //             monthlyCTC,
        //             additions,
        //             lopDeductions,
        //             deductions,
        //             netPay
        //         };
        //     });
        // }

        const csvData = generatePayrollCSV(formattedPayslips);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=payroll.csv');

        res.status(200).send(csvData);
    } catch (error) {
        console.error("Error exporting payroll as CSV:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while exporting payroll as CSV",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};

// API to download payslip as PDF
export const downloadPayslip = async (req: Request, res: Response): Promise<void> => {
    try {
        const { payslipId } = req.query;
 
        if (!payslipId) {
            res.status(400).json({
                success: false,
                message: "payslipId is required"
            });
            return;
        }

        // Fetch payslip record with items
        const payslip: employeePayslipAttributes | null = await dbOutput.employeePayslipRecords.findOne({
            include: [
                {
                    model: dbOutput.employeePayslipItems,
                    as: 'payslipItems',
                    required: true,
                    attributes: ['payrollItemId', 'componentName', 'componentType', 'amount']
                }
            ],
            where: {
                payslipId: payslipId,
                isDeleted: false
            },
            attributes: ['payslipId', 'employeeId', 'payrollStartDate', 'payrollEndDate', 'status', 'netPay']
        });

        if (!payslip) {
            res.status(404).json({
                success: false,
                message: "Payslip not found"
            });
            return;
        }

        // Fetch employee details - use fetchEmployeeCurrentJobDetails for proper conversion date handling
        const [employeeBasic, employeeJob, employeeBank] = await Promise.all([
            dbOutput.employeeBasicDetails.findOne({
                where: { empUuid: payslip.employeeId, isDeleted: false },
                attributes: ['empFirstName', 'empLastName', 'empCompanyId', 'empPanCard', 'empHireDate'],
                raw: true
            }),
            fetchEmployeeCurrentJobDetails(payslip.employeeId),
            dbOutput.employeeBankAccountDetails.findOne({
                where: { empUuid: payslip.employeeId, isDeleted: false },
                attributes: ['empBenefeciaryName', 'empAccountNumber', 'empUanNumber'],
                raw: true
            })
        ]);

        if (!employeeBasic) {
            res.status(404).json({
                success: false,
                message: "Employee details not found"
            });
            return;
        }

        // Get component type details for department
        const componentType = await dbOutput.employeeComponentConfigurator.findOne({
            where: {
                componentType: 'department_type_dropdown',
                isDeleted: false
            },
            attributes: ['componentValue'],
            raw: true
        });

        const departmentOptions = componentType ? JSON.parse(componentType.componentValue) : {};
        const departmentName = departmentOptions[employeeJob?.empDepartment] || employeeJob?.empDepartment || '-';

        // Calculate earnings and deductions from payslip items
        const payslipItems = (payslip as unknown as { payslipItems: employeePayslipItemAttributes[] }).payslipItems || [];
        
        const getOrderScore = (componentName: string | undefined | null) => {
            if (!componentName) return 4;
            const name = componentName.trim().toLowerCase();
            if (name === "basic salary") return 1;
            if (name === "house rent allowance (hra)" || name === "house rent allowance" || name === "hra") return 2;
            if (name === "special allowance") return 3;
            return 4;
        };

        const earnings = payslipItems
            .filter(
                item => item.componentType === componentTypes.ADDITION || item.componentType === componentTypes.DEFAULT_ADDITION
            )
            .sort((a, b) => getOrderScore(a.componentName) - getOrderScore(b.componentName));

        const deductions = payslipItems.filter(
            item => item.componentType === componentTypes.DEDUCTION || item.componentType === componentTypes.DEFAULT_DEDUCTION
        );

        const grossPay = earnings.reduce((sum, item) => sum + parseFloat(String(item.amount || 0)), 0);
        const totalDeductions = deductions.reduce((sum, item) => sum + parseFloat(String(item.amount || 0)), 0);

        // Format date
        const payrollDate = new Date(payslip.payrollStartDate);
        const payrollMonth = payrollDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Format bank account number
        const bankAccountNo = employeeBank?.empAccountNumber 
            ? `XXXX-XXXX-${String(employeeBank.empAccountNumber).slice(-4)}`
            : '-';

        // Format date of joining
        const dateOfJoining = employeeBasic.empHireDate
            ? new Date(employeeBasic.empHireDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            })
            : '-';

        // Prepare template data
        const templateData = {
            companyAddress: 'Ashoka Bhopal Chambers, 205, Above Standard Chartered Bank,\nSindhi Colony, Begumpet, Secunderabad, Hyderabad, Telangana 500003',
            payrollMonth,
            employeeName: `${employeeBasic.empFirstName} ${employeeBasic.empLastName}`,
            department: departmentName,
            bankName: employeeBank?.empBenefeciaryName || '-',
            employeeCode: employeeBasic.empCompanyId || '-',
            pan: employeeBasic.empPanCard || '-',
            bankAccountNo,
            designation: employeeJob?.empTitle || '-',
            uanNumber: employeeBank?.empUanNumber || '-',
            dateOfJoining,
            grossPay: grossPay.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            deductions: totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            netPay: parseFloat(String(payslip.netPay)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            earnings: earnings.map(e => ({
                componentName: e.componentName,
                amount: parseFloat(String(e.amount)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            })),
            deductionsList: deductions.map(d => ({
                componentName: d.componentName,
                amount: parseFloat(String(d.amount)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            })),
            totalEarnings: grossPay.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            totalDeductions: totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        };

        // Register Handlebars helpers
        handlebars.registerHelper('eq', function(a, b) {
            return a === b;
        });
        
        handlebars.registerHelper('or', function(...args) {
            // Remove the last argument which is the Handlebars options object
            const values = args.slice(0, -1);
            return values.some(val => val);
        });

        // Read and compile the Handlebars template
        const templatePath = path.join(__dirname, '../../../views/employee_payslip.handlebars');
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        const template = handlebars.compile(templateSource);
        const html = template(templateData);

        // Generate filename: firstname_lastname_month_year_payslip.pdf
        const firstName = employeeBasic.empFirstName.toLowerCase().replace(/\s+/g, '_');
        const lastName = employeeBasic.empLastName.toLowerCase().replace(/\s+/g, '_');
        const monthName = payrollDate.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
        const yearValue = payrollDate.getFullYear();
        const filename = `${firstName}_${lastName}_${monthName}_${yearValue}_payslip.pdf`;

        // Return HTML for frontend PDF conversion
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('X-Filename', filename);
        res.setHeader('Access-Control-Expose-Headers', 'X-Filename');
        res.send(html);

    } catch (error) {
        console.error("Error downloading payslip:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while downloading payslip",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// API to get netPayAmount of combined employee for given month and year
export const getNetPayAmount = async (req: Request, res: Response) => {
    try {
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        // Generate date range for database-agnostic filtering
        const { startDate: netPayMonthStart, endDate: netPayMonthEnd } = getMonthYearDateRange(month, year);
        
        const allPayslipRecords = await dbOutput.employeePayslipRecords.findAll({
            where: {
                payrollStartDate: { [Op.between]: [netPayMonthStart, netPayMonthEnd] },
                isDeleted: false
            }
        });

        const isPayrollGenerated = !allPayslipRecords.some((payslip) => payslip.status  !== payrollStatus.PAYROLL_GENERATED);

        let netPayAmount = 0;

        if(isPayrollGenerated) {
            netPayAmount = allPayslipRecords.reduce((total, payslip) => total + parseFloat(String(payslip.netPay || 0)), 0);
        } else {
            // Get employee IDs from payslip records
            const employeeIds = allPayslipRecords.map(payslip => payslip.employeeId);
            
            // Calculate month start and end dates
            const monthStartDate = new Date(year, month - 1, 1);
            const monthEndDate = new Date(year, month, 0, 23, 59, 59, 999);

            // Fetch frequency config for filtering
            const netPayFreqConfig = await dbOutput.employeeComponentConfigurator.findOne({
                where: { componentType: 'leave_accural_frequency', isDeleted: false }
            });
            const netPayFrequencies: Record<string, string[]> = netPayFreqConfig?.componentValue 
                ? (typeof netPayFreqConfig.componentValue === 'string' 
                    ? JSON.parse(netPayFreqConfig.componentValue) 
                    : netPayFreqConfig.componentValue) 
                : {};

            // Fetch adjusted components only for employees with payslip records
            const allAdjustedComponents = employeeIds.length > 0 ? await dbOutput.employeeComponentAdjustments.findAll({
                include: [
                    {
                        model: dbOutput.salaryComponents,
                        as: 'salaryComponent'
                    }
                ],
                where: {
                    employeeId: { [Op.in]: employeeIds },
                    startDate: { [Op.lte]: monthEndDate },
                    [Op.or]: [
                        { endDate: { [Op.gte]: monthStartDate } },
                        { endDate: null }
                    ],
                    isDeleted: false
                }
            }) : [];

            // Filter by frequency — only include applicable adjustments in net pay
            const applicableAdjusted = allAdjustedComponents.filter(adj => {
                const freq = (adj as any).adjustedFrequency;
                const sd = new Date(adj.startDate);

                if (adj.endDate && new Date(adj.endDate) < monthStartDate) return false;

                if (freq === 'one_time_key') {
                    return (sd.getMonth() + 1) === month && sd.getFullYear() === year;
                }

                const fc = netPayFrequencies[freq];
                if (!fc || !fc[1]) return true;
                const interval = 12 / parseInt(fc[1]);
                if (isNaN(interval) || interval <= 0) return true;

                const elapsed = (year - sd.getFullYear()) * 12 + (month - (sd.getMonth() + 1));
                return elapsed >= 0 && elapsed % interval === 0;
            });

            const allAdjustedAdditions = applicableAdjusted.filter(component => component.salaryComponent.componentType === componentTypes.ADDITION);
            const allAdjustedDeductions = applicableAdjusted.filter(component => component.salaryComponent.componentType === componentTypes.DEDUCTION);

            netPayAmount += allAdjustedAdditions.reduce((total, component) => total + parseFloat(String(component.adjustedAmount || 0)), 0) - allAdjustedDeductions.reduce((total, component) => total + parseFloat(String(component.adjustedAmount || 0)), 0);

            const employeeUuidsForNetPay = allPayslipRecords.map(payslip => payslip.employeeId);
            
            // Fetch active employee basic details and address
            const employeesBasicDataForNetPay = await dbOutput.employeeBasicDetails.findAll({
                include: [
                    {
                        model: dbOutput.employeeAddressDetails,
                        as: 'addressDetails',
                        required: false,
                        attributes: ['state']
                    }
                ],
                where: { 
                    empUuid: { [Op.in]: employeeUuidsForNetPay },
                    isDeleted: false
                },
                attributes: ['empUuid', 'empFirstName', 'empLastName'],
                order: [['empFirstName', 'ASC'], ['empLastName', 'ASC']],
                raw: true,
                nest: true
            });

            // Fetch current job details using the helper function (handles conversion date logic)
            const netPayJobDetailsMap = await fetchEmployeeCurrentJobDetails(employeeUuidsForNetPay);

            // Combine employee basic data with job details
            const employeesWithJobDetails = employeesBasicDataForNetPay.map(emp => {
                const empData = emp as any;
                const jobDetails = netPayJobDetailsMap.get(empData.empUuid);
                return {
                    ...empData,
                    jobDetails: jobDetails || null
                };
            });

            const salaryCategoryQueries = employeesWithJobDetails
                .filter(e => e.jobDetails)
                .map(e => {
                    const emp = e as any;
                    const { empType, empDepartment, empLevel, empYearOfStudy } = emp.jobDetails;
                    const employeeLocation = emp.addressDetails?.state || null;

                    // Build where clause based on employee type
                    const whereClause: Record<string, unknown> = {
                        employeeType: empType,
                        employeeLocation: employeeLocation,
                        isDeleted: false
                    };

                    // Different employee types have different applicable fields
                    if (empType === 'fte_key' || empType === 'ofte_key' || empType === 'pte_key') {
                        // Full-time employees: have level but don't check department/year (they can be null or not null)
                        whereClause.employeeLevel = empLevel || null;
                        // Don't include department and yearOfStudy in where clause
                    } else if (empType === 'intern_key' || empType === 'extended_intern_key') {
                        // Interns: have all fields
                        whereClause.employeeLevel = empLevel || null;
                        whereClause.department = empDepartment || null;
                        whereClause.yearOfStudy = empYearOfStudy || null;
                    } else {
                        // Other types (consultants, contractors): only type and location
                        // Don't include level, department, or yearOfStudy in where clause
                    }

                    return { 
                        empUuid: emp.empUuid, 
                        whereClause,
                        empType,
                        empLevel,
                        empDepartment,
                        empYearOfStudy
                    };
            });

            // Fetch all matching salary categories + global fallback
            const [salaryCategories, globalSalaryCategory] = await Promise.all([
                dbOutput.salaryCategories.findAll({
                    where: {
                        [Op.or]: salaryCategoryQueries.map(q => q.whereClause)
                    },
                    attributes: ['salaryCategoryId', 'employeeType', 'employeeLocation', 'employeeLevel', 'department', 'yearOfStudy'],
                    raw: true
                }),
                dbOutput.salaryCategories.findOne({
                    where: getGlobalSalaryCategoryWhere(),
                    attributes: ['salaryCategoryId'],
                    raw: true
                })
            ]);
            const globalSalaryCategoryId = globalSalaryCategory?.salaryCategoryId || null;

            // Map employees to their salary categories
            const salaryCategoryMap = new Map<string, string>();
            salaryCategoryQueries.forEach(query => {
                const wc = query.whereClause;
                const match = salaryCategories.find(cat => {
                    // Base matching: always check empType and location
                    if (cat.employeeType !== wc.employeeType || cat.employeeLocation !== wc.employeeLocation) {
                        return false;
                    }

                    // For FTE/OFTE/PTE: Only check empType, location, and level. Don't check department and yearOfStudy.
                    if (query.empType === 'fte_key' || query.empType === 'ofte_key' || query.empType === 'pte_key') {
                        return cat.employeeLevel === (query.empLevel || null);
                    } 
                    // For interns: Check all fields including department and yearOfStudy
                    else if (query.empType === 'intern_key' || query.empType === 'extended_intern_key') {
                        return cat.employeeLevel === (query.empLevel || null) &&
                            cat.department === (query.empDepartment || null) &&
                            cat.yearOfStudy === (query.empYearOfStudy || null);
                    } 
                    // For other types: Only check empType and location (not level, department, or yearOfStudy)
                    else {
                        return true; // Already matched empType and location above
                    }
                });
                if (match) {
                    salaryCategoryMap.set(query.empUuid, match.salaryCategoryId);
                }
            });

            const allDefaultComponents = await dbOutput.salaryComponents.findAll({
                where: {
                    salaryCategoryId: {
                        [Op.in]: [
                            ...salaryCategories.map(cat => cat.salaryCategoryId),
                            ...(globalSalaryCategoryId ? [globalSalaryCategoryId] : [])
                        ]
                    },
                    isDeleted: false
                },
                attributes: ['componentId', 'salaryCategoryId', 'componentType', 'componentName', 'amount'],
                raw: true
            });

            // map employeeid to default component
            const defaultComponentMap = new Map<string, any[]>();

            salaryCategoryMap.forEach((value, key) => {
                const salaryCategoryId = value;
                const empUuid = key;

                const specificComponents = allDefaultComponents.filter(c => c.salaryCategoryId === salaryCategoryId);
                const globalComponents = globalSalaryCategoryId
                    ? allDefaultComponents.filter(c => c.salaryCategoryId === globalSalaryCategoryId)
                    : [];
                const defaultComponents = mergeSalaryComponentsWithSpecificPriority(globalComponents, specificComponents);

                const additionAmount = defaultComponents
                    .filter(c => c.componentType === componentTypes.DEFAULT_ADDITION)
                    .reduce((total, c) => total + Number(c.amount || 0), 0);

                const deductionAmount = defaultComponents
                    .filter(c => c.componentType === componentTypes.DEFAULT_DEDUCTION && !String(c.componentName || "").includes('Loss of Pay'))
                    .reduce((total, c) => total + Number(c.amount || 0), 0);

                netPayAmount += additionAmount - deductionAmount;
                defaultComponentMap.set(empUuid, defaultComponents);
            });

            const unpaidLeaveConfigDetails = await dbOutput.employeeLeaveConfigurator.findOne({
                where: {
                    [Op.and]: [
                        outputSequelize.where(
                            outputSequelize.fn('LOWER', outputSequelize.col('leaveType')),
                            { [Op.like]: '%unpaid%' }
                        ),
                        { isActive: true }
                    ]
                },
                attributes: ['leaveConfigId'],
                raw: true
            });

            if (unpaidLeaveConfigDetails?.leaveConfigId) {
                const allUnpaidLeaves = await dbOutput.employeeAttendanceDetails.findAll({
                    include: [
                        {
                            model: dbOutput.employeeLeaveRequestDetails,
                            as: 'leaveRequest',
                            where: {
                                leaveConfigId: unpaidLeaveConfigDetails.leaveConfigId 
                            },
                            attributes: [],
                            required: true
                        }
                    ],
                    where: {
                        empUuid: { [Op.in]: employeeIds },
                        attendanceStatus: {
                            [Op.or]: [AttendanceStatusType.ON_LEAVE, AttendanceStatusType.HALF_DAY]
                        },
                        attendanceDate: {
                            [Op.between]: [monthStartDate, monthEndDate]
                        },
                        isDeleted: false
                    },
                    raw: true
                });

                allUnpaidLeaves.forEach(leave => {
                    const employeeId = leave.empUuid;
                    const employeeDefaultComponents = defaultComponentMap.get(employeeId) || [];
                    const lopDeduction = employeeDefaultComponents.find(c => c.componentName.includes('Loss of Pay'));

                    const lopDeductionAmount = lopDeduction ? parseFloat(String(lopDeduction.amount || 0)) : 0;
                    const unpaidLeaveAmount = leave.attendanceStatus === AttendanceStatusType.HALF_DAY ? lopDeductionAmount / 2 : lopDeductionAmount;

                    netPayAmount -= unpaidLeaveAmount;
                });
            }
        }

        res.json({
            success: true,
            message: "NetPayAmount fetched successfully",
            netPayAmount
        });
    } catch (error) {
        console.error("Error getting netPayAmount:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while getting netPayAmount",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
}

/**
 * Helper function to check if salary category exists for an employee
 * Returns salary category if found, null otherwise
 */
const checkSalaryCategoryExists = async (
    empType: string,
    employeeLocation: string | null,
    empLevel: string | null,
    empDepartment: string | null,
    empYearOfStudy: string | null
): Promise<{ salaryCategoryId: string; updatedAt?: Date } | null> => {
    const whereClause: Record<string, unknown> = {
        employeeType: empType,
        employeeLocation: employeeLocation,
        isDeleted: false
    };

    // For FTE/PTE types: Only check empType, location, and level. Don't check department and yearOfStudy at all.
    if (empType === 'fte_key' || empType === 'ofte_key' || empType === 'pte_key') {
        whereClause.employeeLevel = empLevel || null;
        // Don't include department and yearOfStudy in where clause - they can be null or not null, doesn't matter
    } else if (empType === 'intern_key' || empType === 'extended_intern_key') {
        // For interns: Check all fields including department and yearOfStudy
        whereClause.employeeLevel = empLevel || null;
        whereClause.department = empDepartment || null;
        whereClause.yearOfStudy = empYearOfStudy || null;
    } else {
        // For other types: Only check empType and location (not level, department, or yearOfStudy)
        // Don't include these fields in where clause
    }

    const salaryCategory = await dbOutput.salaryCategories.findOne({
        where: whereClause,
        attributes: ['salaryCategoryId', 'updatedAt']
    });

    return salaryCategory
        ? {
            salaryCategoryId: salaryCategory.salaryCategoryId,
            updatedAt: salaryCategory.updatedAt,
        }
        : null;
};

export const deletePayrollRecords = async (req: Request, res: Response): Promise<void> => {
    const transaction: Transaction = await outputSequelize.transaction();

    try {
        const { user } = req as AuthenticatedRequest;
        const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
        const toolName = hrmsConstants.HR_REPOSITORY;

        const hasPermission = await checkHrmsPermission(
            employeeUuid,
            "Payroll_Edit",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );

        if (!hasPermission) {
            await transaction.rollback();
            res.status(403).json({
                success: false,
                message: "You don't have permission to delete payroll records"
            });
            return;
        }

        const { payslipIds } = req.body;

        if (!payslipIds || !Array.isArray(payslipIds) || payslipIds.length === 0) {
            await transaction.rollback();
            res.status(400).json({
                success: false,
                message: "payslipIds array is required and cannot be empty"
            });
            return;
        }

        const uniquePayslipIds = [...new Set(payslipIds.filter(Boolean))];

        if (uniquePayslipIds.length === 0) {
            await transaction.rollback();
            res.status(400).json({
                success: false,
                message: "payslipIds array is required and cannot be empty"
            });
            return;
        }

        const existingRecords = await dbOutput.employeePayslipRecords.findAll({
            where: {
                payslipId: { [Op.in]: uniquePayslipIds },
                isDeleted: false
            },
            attributes: ['payslipId'],
            raw: true,
            transaction
        });

        if (!existingRecords || existingRecords.length === 0) {
            await transaction.rollback();
            res.status(404).json({
                success: false,
                message: "No payroll records found to delete"
            });
            return;
        }

        const validPayslipIds = existingRecords.map((record: any) => record.payslipId);

        const [deletedRecordsCount] = await dbOutput.employeePayslipRecords.update(
            { isDeleted: true },
            {
                where: {
                    payslipId: { [Op.in]: validPayslipIds },
                    isDeleted: false
                },
                transaction
            }
        );

        const [deletedItemsCount] = await dbOutput.employeePayslipItems.update(
            { isDeleted: true },
            {
                where: {
                    payslipId: { [Op.in]: validPayslipIds },
                    isDeleted: false
                },
                transaction
            }
        );

        await transaction.commit();

        res.status(200).json({
            success: true,
            message: `Successfully deleted ${deletedRecordsCount} payroll record(s)`,
            data: {
                deletedCount: deletedRecordsCount,
                deletedItemCount: deletedItemsCount
            }
        });
    } catch (error: any) {
        await transaction.rollback();
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            devMessage: error.message,
        });
    }
};

const toValidDate = (value: unknown): Date | null => {
    if (!value) return null;
    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Core function to create payroll for employees (used by both API and cron job)
 * @param month - Month number (1-12), defaults to current month
 * @param year - Year number, defaults to current year
 * @param transaction - Optional transaction for database operations
 * @returns Object with created payrolls and errors
 */
const createPayrollForEmployees = async (
    month?: number,
    year?: number,
    transaction?: Transaction,
    targetEmployeeIds?: string[]
): Promise<{
    totalEmployees: number;
    payrollsCreated: number;
    skippedCount: number;
    errorCount: number;
    createdPayrolls: Array<{ payslipId: string; empUuid: string; status: string }>;
    skippedEmployees: Array<{ empUuid: string; reason: string }>;
    errors: Array<{ empUuid: string; error: string }>;
}> => {
    const payrollStartDate = new Date();
    const currentMonth = month || (payrollStartDate.getMonth() + 1);
    const currentYear = year || payrollStartDate.getFullYear();

    // Set payroll start date to first day of the specified month in UTC
    // This ensures consistent date storage regardless of server timezone
    const targetPayrollStartDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0));

    const result = {
        totalEmployees: 0,
        payrollsCreated: 0,
        skippedCount: 0,
        errorCount: 0,
        createdPayrolls: [] as Array<{ payslipId: string; empUuid: string; status: string }>,
        skippedEmployees: [] as Array<{ empUuid: string; reason: string }>,
        errors: [] as Array<{ empUuid: string; error: string }>
    };

    // Fetch all active employees (isActive = true) with their address details - exclude inactive employees
    const employeeBaseWhereClause: Record<string, unknown> = {
        isDeleted: false,
        isActive: true,
    };

    if (targetEmployeeIds && targetEmployeeIds.length > 0) {
        employeeBaseWhereClause.empUuid = { [Op.in]: targetEmployeeIds };
    }

    const employeesBasicDataForCreate = await dbOutput.employeeBasicDetails.findAll({
        include: [
            {
                model: dbOutput.employeeAddressDetails,
                as: 'addressDetails',
                required: false,
                attributes: ['state', 'updatedAt']
            }
        ],
        where: employeeBaseWhereClause,
        attributes: ['empUuid']
    });

    if (!employeesBasicDataForCreate.length) {
        return result;
    }

    const allEmployeeIds: string[] = employeesBasicDataForCreate.map(e => e.empUuid);

    // Fetch current job details using the helper function (handles conversion date logic)
    const createPayrollJobDetailsMap = await fetchEmployeeCurrentJobDetails(allEmployeeIds, transaction);

    // Combine employee basic data with job details, filter out those without job details
    const employees = employeesBasicDataForCreate
        .map(emp => {
            const empData = emp as any;
            const jobDetails = createPayrollJobDetailsMap.get(empData.empUuid);
            return {
                empUuid: empData.empUuid,
                addressDetails: empData.addressDetails,
                jobDetails: jobDetails || null
            };
        })
        .filter(emp => emp.jobDetails !== null);

    if (!employees.length) {
        return result;
    }

    result.totalEmployees = employees.length;
    const employeeIds: string[] = employees.map(e => e.empUuid);

    // Calculate date range for the month (first day to last day)
    // Create dates in UTC to avoid timezone conversion issues
    // For January 2026: start = 2026-01-01 00:00:00 UTC, end = 2026-01-31 23:59:59 UTC
    const monthStartDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0));
    const monthEndDate = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));

    console.log(`[${new Date().toISOString()}] Checking for existing payrolls for ${currentMonth}/${currentYear}`, {
        monthStartDate: monthStartDate.toISOString(),
        monthEndDate: monthEndDate.toISOString(),
        monthStartDateLocal: monthStartDate.toString(),
        monthEndDateLocal: monthEndDate.toString(),
        employeeCount: employeeIds.length
    });

    // Fetch all existing payslips for the current month for current employees
    // Use explicit date range with UTC dates to avoid timezone conversion issues
    // The dates are stored in UTC in the database, so we compare UTC to UTC
    const existingPayslips: employeePayslipAttributes[] = await dbOutput.employeePayslipRecords.findAll({
        where: {
            employeeId: { [Op.in]: employeeIds },
            payrollStartDate: {
                [Op.gte]: monthStartDate,
                [Op.lte]: monthEndDate
            },
            isDeleted: false
        },
        attributes: ['employeeId', 'status', 'payslipId', 'payrollStartDate', 'updatedAt'],
        raw: true
        // Don't use transaction here - we want to see all committed records
    });

    console.log(`[${new Date().toISOString()}] Found ${existingPayslips.length} existing payroll records for ${currentMonth}/${currentYear}`);
    console.log(`[${new Date().toISOString()}] Query date range: ${monthStartDate.toISOString()} to ${monthEndDate.toISOString()}`);
    if (existingPayslips.length > 0) {
        console.log(`[${new Date().toISOString()}] Sample existing records (first 5):`, existingPayslips.slice(0, 5).map(p => {
            const date = (p as any).payrollStartDate;
            return {
                employeeId: p.employeeId,
                status: p.status,
                payrollStartDateRaw: date,
                payrollStartDateISO: date ? new Date(date).toISOString() : null,
                payrollStartDateLocal: date ? new Date(date).toString() : null
            };
        }));
    }

    // Create a map of existing payslips by employeeId
    const existingPayslipMap = new Map<string, employeePayslipAttributes>();
    existingPayslips.forEach(p => {
        existingPayslipMap.set(p.employeeId, p);
    });

    // Process each employee
    const newPayslips: Array<{
        payslipId: string;
        employeeId: string;
        payrollStartDate: Date;
        payrollEndDate: null;
        status: string;
        netPay: null;
        isDeleted: boolean;
    }> = [];

    for (const employee of employees) {
        const empUuid = employee.empUuid;
        const emp = employee as any;
        const jobDetails = emp.jobDetails;
        const addressDetails = emp.addressDetails;

        // Check if payroll already exists for this month
        const existingPayslip = existingPayslipMap.get(empUuid);
        const existingStatus = existingPayslip?.status;
        
        if (existingStatus) {
            // Keep generated payroll untouched.
            if (existingStatus === payrollStatus.PAYROLL_GENERATED) {
                result.skippedCount++;
                result.skippedEmployees.push({
                    empUuid,
                    reason: `Payroll already ${existingStatus} for this month`
                });
                continue;
            }
            // If status is PENDING, skip (already exists)
            if (existingStatus === payrollStatus.PENDING) {
                result.skippedCount++;
                result.skippedEmployees.push({
                    empUuid,
                    reason: "Payroll already exists with PENDING status"
                });
                continue;
            }
        }

        // Check if job details exist
        if (!jobDetails) {
            result.errorCount++;
            result.errors.push({
                empUuid,
                error: "Employee job details not found"
            });
            continue;
        }

        const { empType, empDepartment, empLevel, empYearOfStudy } = jobDetails;
        const employeeLocation = addressDetails?.state || null;

        // Check if salary category exists for this employee
        try {
            const salaryCategory = await checkSalaryCategoryExists(
                empType,
                employeeLocation,
                empLevel,
                empDepartment,
                empYearOfStudy
            );

            // If a finalized payroll exists and payroll-impacting configuration changed,
            // reopen it to pending so current month can be recalculated.
            if (existingPayslip && existingStatus === payrollStatus.PAYROLL_FINALIZED) {
                if (!salaryCategory) {
                    result.skippedCount++;
                    result.skippedEmployees.push({
                        empUuid,
                        reason: "Finalized payroll kept unchanged because salary configuration is missing for current employee details"
                    });
                    continue;
                }

                const latestSalaryComponent = await dbOutput.salaryComponents.findOne({
                    where: {
                        salaryCategoryId: salaryCategory.salaryCategoryId,
                        isDeleted: false,
                    },
                    attributes: ['updatedAt'],
                    order: [['updatedAt', 'DESC']],
                    raw: true,
                    ...(transaction ? { transaction } : {}),
                });

                const payslipUpdatedAt = toValidDate(existingPayslip.updatedAt);
                const jobDetailsUpdatedAt = toValidDate(jobDetails?.updatedAt);
                const addressDetailsUpdatedAt = toValidDate(addressDetails?.updatedAt);
                const salaryCategoryUpdatedAt = toValidDate(salaryCategory.updatedAt);
                const salaryComponentsUpdatedAt = toValidDate(latestSalaryComponent?.updatedAt);

                const latestConfigChange = [
                    jobDetailsUpdatedAt,
                    addressDetailsUpdatedAt,
                    salaryCategoryUpdatedAt,
                    salaryComponentsUpdatedAt,
                ].reduce<Date | null>((latest, current) => {
                    if (!current) return latest;
                    if (!latest || current > latest) return current;
                    return latest;
                }, null);

                if (payslipUpdatedAt && latestConfigChange && latestConfigChange > payslipUpdatedAt) {
                    await dbOutput.employeePayslipRecords.update(
                        {
                            status: payrollStatus.PENDING,
                            payrollEndDate: null,
                            netPay: null,
                        },
                        {
                            where: { payslipId: existingPayslip.payslipId },
                            ...(transaction ? { transaction } : {}),
                        }
                    );

                    result.skippedCount++;
                    result.skippedEmployees.push({
                        empUuid,
                        reason: "Finalized payroll reopened to PENDING due to employee/category configuration changes"
                    });
                } else {
                    result.skippedCount++;
                    result.skippedEmployees.push({
                        empUuid,
                        reason: "Payroll already payroll_finalized for this month"
                    });
                }
                continue;
            }

            if (!salaryCategory) {
                result.skippedCount++;
                const reasonParts: string[] = [];
                if (empType) reasonParts.push(`Employee Type: ${empType}`);
                if (employeeLocation) reasonParts.push(`Location: ${employeeLocation}`);
                
                // Only include fields that are actually checked based on employee type
                // FTE/OFTE/PTE: Only check empType, location, and level (NOT department/yearOfStudy)
                // Interns: Check all fields including department and yearOfStudy
                if (empType === 'fte_key' || empType === 'ofte_key' || empType === 'pte_key') {
                    if (empLevel) reasonParts.push(`Level: ${empLevel}`);
                } else if (empType === 'intern_key' || empType === 'extended_intern_key') {
                    if (empLevel) reasonParts.push(`Level: ${empLevel}`);
                    if (empDepartment) reasonParts.push(`Department: ${empDepartment}`);
                    if (empYearOfStudy) reasonParts.push(`Year of Study: ${empYearOfStudy}`);
                }
                // For other types: only empType and location are checked
                
                const reason = reasonParts.length > 0 
                    ? `Salary configuration not available for ${reasonParts.join(', ')}`
                    : "Salary configuration not available (missing employee details)";
                
                result.skippedEmployees.push({
                    empUuid,
                    reason
                });
                continue;
            }

            // All checks passed - create payroll
            newPayslips.push({
                payslipId: await createUUIDV4(),
                employeeId: empUuid,
                payrollStartDate: targetPayrollStartDate,
                payrollEndDate: null,
                status: payrollStatus.PENDING,
                netPay: null,
                isDeleted: false
            });
        } catch (error) {
            result.errorCount++;
            result.errors.push({
                empUuid,
                error: error instanceof Error ? error.message : 'Unknown error while checking salary category'
            });
        }
    }

    // Bulk create new payrolls if any
    if (newPayslips.length > 0) {
        try {
            console.log(`[${new Date().toISOString()}] Attempting to create ${newPayslips.length} payroll records for ${currentMonth}/${currentYear}`);
            
            const createdRecords = await dbOutput.employeePayslipRecords.bulkCreate(newPayslips, {
                ...(transaction ? { transaction } : {}),
                returning: true,
                validate: true
            });

            result.payrollsCreated = createdRecords.length;
            result.createdPayrolls = createdRecords.map(p => ({
                payslipId: p.payslipId,
                empUuid: p.employeeId,
                status: p.status
            }));

            console.log(`[${new Date().toISOString()}] Successfully created ${createdRecords.length} payroll records for ${currentMonth}/${currentYear}`);
            
            // Verify records were actually saved (only if not in transaction, as transaction records aren't visible until commit)
            if (!transaction) {
                const verifyCount = await dbOutput.employeePayslipRecords.count({
                    where: {
                        employeeId: { [Op.in]: newPayslips.map(p => p.employeeId) },
                        payrollStartDate: {
                            [Op.gte]: monthStartDate,
                            [Op.lte]: monthEndDate
                        },
                        isDeleted: false
                    }
                });
                console.log(`[${new Date().toISOString()}] Verification: Found ${verifyCount} payroll records in database after creation for ${currentMonth}/${currentYear}`);
            }
        } catch (bulkCreateError) {
            console.error(`[${new Date().toISOString()}] Error bulk creating payroll records:`, bulkCreateError);
            result.errorCount += newPayslips.length;
            newPayslips.forEach(p => {
                result.errors.push({
                    empUuid: p.employeeId,
                    error: bulkCreateError instanceof Error ? bulkCreateError.message : 'Unknown error during bulk create'
                });
            });
        }
    } else {
        console.log(`[${new Date().toISOString()}] No new payrolls to create for ${currentMonth}/${currentYear}. Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`);
    }

    return result;
};

/**
 * API endpoint to manually create payroll for employees
 * Can be called via Postman or frontend if cron job misses
 * Optional query params: month (1-12), year (e.g., 2026)
 */
export const createPayroll = async (req: Request, res: Response): Promise<void> => {
    try {
        // Extract optional month and year from query params
        const month = req.query.month ? parseInt(req.query.month as string) : undefined;
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;

        // Validate month if provided
        if (month !== undefined && (isNaN(month) || month < 1 || month > 12)) {
            res.status(400).json({
                success: false,
                message: "Invalid month. Month must be between 1 and 12."
            });
            return;
        }

        // Validate year if provided
        if (year !== undefined && (isNaN(year) || year < 2000 || year > 2100)) {
            res.status(400).json({
                success: false,
                message: "Invalid year. Year must be between 2000 and 2100."
            });
            return;
        }

        const result = await outputSequelize.transaction(async (transaction: Transaction) => {
            const payrollResult = await createPayrollForEmployees(month, year, transaction);
            // Transaction will auto-commit if no error is thrown
            return payrollResult;
        });

        if (result.totalEmployees === 0) {
            res.status(200).json({
                success: true,
                message: "No active employees found to create payrolls.",
                data: result
            });
            return;
        }

        if (result.payrollsCreated === 0 && result.skippedCount === 0 && result.errorCount === 0) {
            res.status(200).json({
                success: true,
                message: "No new payrolls to create. All employees already have payroll records for this month.",
                data: result
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Payroll creation completed. Created: ${result.payrollsCreated}, Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`,
            data: result
        });
    } catch (error) {
        console.error("Error creating payroll:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while creating payroll",
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Cron job function to automatically create payroll for employees
 * Runs daily at midnight to check and create payroll for employees who don't have it
 * Skips employees if:
 * - Payroll is already generated or finalized for that month
 * - Salary configuration is not available
 */
export const createPayrollCronJob = async (): Promise<void> => {
    console.log(`[${new Date().toISOString()}] Starting automatic payroll creation cron job...`);
    
    try {
        const result = await createPayrollForEmployees();
        
        console.log(`[${new Date().toISOString()}] Payroll creation cron job completed:`, {
            totalEmployees: result.totalEmployees,
            payrollsCreated: result.payrollsCreated,
            skippedCount: result.skippedCount,
            errorCount: result.errorCount
        });

        if (result.errors.length > 0) {
            console.error(`[${new Date().toISOString()}] Errors during payroll creation:`, result.errors);
        }

        if (result.skippedEmployees.length > 0) {
            console.log(`[${new Date().toISOString()}] Skipped employees (${result.skippedEmployees.length} total):`, result.skippedEmployees);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in payroll creation cron job:`, error);
    }
};

export const reconcilePayrollForEmployees = async (
    employeeIds: string[],
    month?: number,
    year?: number
): Promise<void> => {
    if (!employeeIds?.length) {
        return;
    }

    const uniqueEmployeeIds = Array.from(new Set(employeeIds));
    console.log(
        `[${new Date().toISOString()}] Starting targeted payroll reconciliation for ${uniqueEmployeeIds.length} employee(s).`
    );

    try {
        const result = await createPayrollForEmployees(month, year, undefined, uniqueEmployeeIds);

        console.log(
            `[${new Date().toISOString()}] Targeted payroll reconciliation completed`,
            {
                employeeCount: uniqueEmployeeIds.length,
                payrollsCreated: result.payrollsCreated,
                skippedCount: result.skippedCount,
                errorCount: result.errorCount,
            }
        );

        if (result.errors.length > 0) {
            console.error(
                `[${new Date().toISOString()}] Targeted payroll reconciliation errors:`,
                result.errors
            );
        }
    } catch (error) {
        console.error(
            `[${new Date().toISOString()}] Error during targeted payroll reconciliation:`,
            error
        );
    }
};
