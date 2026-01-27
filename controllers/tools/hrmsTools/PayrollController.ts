import { Request, Response } from "express";
import { dbOutput, outputSequelize, sequelize } from "../../../models";
import { Transaction, Op } from "sequelize";
import { createUUIDV4 } from "../../../utilities/uuidV4Generator";
import { 
    payrollStatus, 
    componentTypes,
    AttendanceStatusType, 
    hrmsConstants,
    accessLevelConstant, 
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
import { formatItems, generatePayrollCSV } from "../../../utilities/hrmsUtilities/helperFunctions";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";


export const getAllEmployeePayrollDetails = async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthenticatedRequest;
    
    // Check user permissions
    const { toolsAccess } = user as AuthenticatedUser;
     
    // Validate user access level
    const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];
    
    // Check user access level
    if (userType < accessLevelConstant.TOOL_ADMIN) {
        res.status(403).json({
            status: "error",
            message: "Forbidden: You don't have access to this resource"
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
        // Filter for payslip records by month/year
        const monthYearFilter = {
            [Op.and]: [
                sequelize.where(sequelize.fn('MONTH', sequelize.col('payrollStartDate')), month),
                sequelize.where(sequelize.fn('YEAR', sequelize.col('payrollStartDate')), year)
            ],
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
                    leaveType: { [Op.like]: '%unpaid%' },
                    isActive: true
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

        // Early return if no payslip records found
        if (!allEmpIdsWithPayslips || allEmpIdsWithPayslips.length === 0) {
            res.status(200).json({
                success: true,
                message: "No payroll records found",
                data: [],
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
        const allSalaryCategoriesForFiltering = await dbOutput.salaryCategories.findAll({
            where: {
                [Op.or]: salaryCategoryQueriesForFiltering.map(q => q.whereClause)
            },
            attributes: ['salaryCategoryId', 'employeeType', 'employeeLocation', 'employeeLevel', 'department', 'yearOfStudy'],
            raw: true
        });

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
        const salaryCategories = await dbOutput.salaryCategories.findAll({
            where: {
                [Op.or]: salaryCategoryQueries.map(q => q.whereClause)
            },
            attributes: ['salaryCategoryId', 'employeeType', 'employeeLocation', 'employeeLevel', 'department', 'yearOfStudy'],
            raw: true
        });

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
        const categoriesWithSalary = Array.from(new Set(salaryCategoryMap.values()));
        
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
                startDate: { [Op.lte]: new Date(year, month - 1, 31) },
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

        // Filter adjustments based on frequency - only include if applicable for current month
        const filteredAdjustments = allAdjustments.filter(adj => {
            const startDate = new Date(adj.startDate);
            const startYear = startDate.getFullYear();
            const startMonth = startDate.getMonth() + 1;
            
            // Calculate the requested month's date range
            const monthStartDate = new Date(year, month - 1, 1);
            
            // One-time adjustments: only include in the month they started (check month only, not year)
            // If effectiveTill is set, show for whole month if effectiveTill >= month start
            // e.g., if added in Jan 2025 with effectiveTill Jan 20, 2026, show in Jan 2026
            if (adj.adjustedFrequency === 'one_time_key') {
                // Check if startDate's month matches requested month (regardless of year)
                const monthMatches = (startDate.getMonth() + 1) === month;
                
                if (!monthMatches) {
                    return false; // Month doesn't match, don't show
                }
                
                // If effectiveTill (endDate) is set, check if it's >= month start
                // This allows showing one-time components in the same month across different years
                if (adj.endDate) {
                    const endDate = new Date(adj.endDate);
                    // Show for whole month if effectiveTill is >= month start
                    return endDate >= monthStartDate;
                }
                
                // If no effectiveTill, show only if year also matches (original behavior for backward compatibility)
                return startDate.getFullYear() === year;
            }

            // For other frequencies, check effectiveTill (endDate) - if set, must be >= month start
            if (adj.endDate) {
                const endDate = new Date(adj.endDate);
                if (endDate < monthStartDate) {
                    return false; // effectiveTill is before the requested month
                }
            }

            // Calculate frequency interval (e.g., quarterly = every 3 months)
            const frequencyConfig = componentFrequencies[adj.adjustedFrequency];
            if (!frequencyConfig || !frequencyConfig[1]) {
                return true; // Include if no frequency config (default to monthly)
            }

            const frequencyNum = 12 / parseInt(frequencyConfig[1]);
            
            if (isNaN(frequencyNum) || frequencyNum <= 0) {
                return true; // Include if invalid frequency
            }
            
            // Calculate months elapsed since adjustment started
            const monthsElapsed = (year - startYear) * 12 + (month - startMonth);
            
            // Include if current month aligns with frequency interval
            // E.g., quarterly (frequencyNum=3): months 0, 3, 6, 9, etc.
            return monthsElapsed >= 0 && monthsElapsed % frequencyNum === 0;
        });

        // Group filtered adjustments by employee ID
        const adjustmentsMap = new Map<string, typeof filteredAdjustments>();
        filteredAdjustments.forEach(adj => {
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
                    unpaidLeave: 0, // Already calculated in generated payslip
                    status: payslipStatus,
                    netPay: payslipRecord.netPay ? parseFloat(String(payslipRecord.netPay)) : 0
                });
                continue;
            }

            // ============================================
            // 11b. HANDLE NON-GENERATED PAYSLIPS
            // ============================================
            // Calculate payroll on-the-fly from configurations and adjustments
            const salaryCategoryId = salaryCategoryMap.get(empUuid);
            if (!salaryCategoryId) continue;

            // Get salary components for this employee's category
            const components = salaryComponentsMap.get(salaryCategoryId) || [];
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
                // Prioritize adjustedFrequency over frequency from salaryComponent
                const effectiveFrequency = adj.adjustedFrequency || sc?.frequency || null;
                
                return {
                    adjustmentId: adj.adjustmentId,
                    componentId: adj.componentId,
                    componentName: sc?.componentName || 'Unknown',
                    adjustedAmount: parseFloat(String(adj.adjustedAmount)) || 0,
                    amount: parseFloat(String(adj.adjustedAmount)) || 0,
                    startDate: adj.startDate ? new Date(adj.startDate).toISOString().split('T')[0] : null,
                    endDate: adj.endDate ? new Date(adj.endDate).toISOString().split('T')[0] : null,
                    effectiveTill: adj.endDate ? new Date(adj.endDate).toISOString().split('T')[0] : null,
                    adjustedFrequency: adj.adjustedFrequency || null, // Actual adjusted frequency from adjustment
                    frequency: sc?.frequency || null, // Original frequency from component
                    effectiveFrequency: effectiveFrequency, // Combined frequency (prioritized)
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
                effectiveFrom: comp.effectiveFrom ? new Date(comp.effectiveFrom).toISOString().split('T')[0] : null,
                effectiveTill: comp.effectiveTill ? new Date(comp.effectiveTill).toISOString().split('T')[0] : null
            });

            payrollData.push({
                payslipId: payslipRecord.payslipId || null,
                empUuid,
                empName,
                monthlyCTC,
                defaultAdditions: defaultAdditions.map(formatComponent),
                additions: additions.map(formatAdjustment),
                defaultDeductions: defaultDeductions.map(formatComponent),
                deductions: deductions.map(formatAdjustment),
                unpaidLeave: unpaidLeaveMap.get(empUuid) || 0,
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
    const { toolsAccess } = user as AuthenticatedUser;
     
    // Validate user access level
    const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];
    
    // Check user access level
    if (userType < accessLevelConstant.TOOL_ADMIN) {
        res.status(403).json({
            status: "error",
            message: "Forbidden: You don't have access to this resource"
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

        // Verify employee exists
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

        // Process adjustments - update if exists, create if new, delete if marked
        const createdAdjustments: CreatedAdjustment[] = [];
        const updatedAdjustments: CreatedAdjustment[] = [];
        const deletedAdjustments: string[] = [];
        const errors: AdjustmentError[] = [];

        for (const adjustment of adjustments) {
            try {
                const { adjustmentId, componentId, adjustedAmount, adjustedFrequency, startDate, endDate, isDeleted } = adjustment;

                // Handle deletion requests
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
                    continue;
                }

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
                        // Update existing adjustment
                        await existingAdjustment.update({
                            componentId: componentId,
                            adjustedAmount: parseFloat(String(adjustedAmount)),
                            adjustedFrequency: adjustedFrequency || existingAdjustment.adjustedFrequency,
                            startDate: startDate ? new Date(startDate) : existingAdjustment.startDate,
                            endDate: endDate ? new Date(endDate) : null
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

                // Create new adjustment (if no adjustmentId provided or not found)
                const newAdjustmentId = await createUUIDV4();

                const newAdjustment = await dbOutput.employeeComponentAdjustments.create({
                    adjustmentId: newAdjustmentId,
                    employeeId: employeeId,
                    componentId: componentId,
                    adjustedAmount: parseFloat(String(adjustedAmount)),
                    adjustedFrequency: adjustedFrequency || null,
                    startDate: startDate ? new Date(startDate) : new Date(),
                    endDate: endDate ? new Date(endDate) : null,
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
    const { toolsAccess } = user as AuthenticatedUser;
     
    // Validate user access level
    const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];
    
    // Check user access level
    if (userType < accessLevelConstant.TOOL_ADMIN) {
        res.status(403).json({
            status: "error",
            message: "Forbidden: You don't have access to this resource"
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
            const [finalizedPayrollRecords, unpaidLeaveConfig] = await Promise.all([
                dbOutput.employeePayslipRecords.findAll({
                    where: {
                        [Op.and]: [
                            sequelize.where(sequelize.fn('MONTH', sequelize.col('payrollStartDate')), month),
                            sequelize.where(sequelize.fn('YEAR', sequelize.col('payrollStartDate')), year)
                        ],
                        isDeleted: false
                    }
                }),
                dbOutput.employeeLeaveConfigurator.findOne({
                    where: {
                        leaveType: { [Op.like]: '%unpaid%' },
                        isActive: true
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

            // Create a map for quick lookup of payroll records by employeeId
            const payrollRecordMap = new Map();
            finalizedPayrollRecords.forEach(record => {
                payrollRecordMap.set(record.employeeId, record);
            });

            // Get unique employeeIds
            const employeeIds = Array.from(payrollRecordMap.keys());

            // Bulk fetch all employees with their basic details and address
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

                    // Fetch all component configurations for this salary category
                    const allComponents: salaryComponentsAttributes[] = await dbOutput.salaryComponents.findAll({
                        where: {
                            salaryCategoryId: salaryCategory.salaryCategoryId,
                            componentType: { [Op.or]: [componentTypes.DEFAULT_ADDITION, componentTypes.DEFAULT_DEDUCTION] },
                            isDeleted: false
                        }
                    });

                    // Get default additions
                    const defaultAdditionComponents = allComponents.filter(comp => comp.componentType === componentTypes.DEFAULT_ADDITION);

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
                    const defaultDeductionComponents = allComponents.filter(comp => comp.componentType === componentTypes.DEFAULT_DEDUCTION);

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
                            const lopPerDay = parseFloat(String(configComp.amount));
                            console.log(`LOP component found! LOP per day: ₹${lopPerDay}, Unpaid leave days: ${unpaidLeaveDays}`);
                            
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

                    // Get custom additions (adjustments)
                    const customComponents = await dbOutput.employeeComponentAdjustments.findAll({
                        where: {
                            employeeId: empUuid,
                            isDeleted: false,
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

                    const customAdditions = customComponents.filter(comp => comp.salaryComponent.componentType === componentTypes.ADDITION);

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
                    const customDeductions = customComponents.filter(comp => comp.salaryComponent.componentType === componentTypes.DEDUCTION);

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
    const { toolsAccess } = user as AuthenticatedUser;
     
    // Validate user access level
    const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];
    
    // Check user access level
    if (userType < accessLevelConstant.TOOL_ADMIN) {
        res.status(403).json({
            status: "error",
            message: "Forbidden: You don't have access to this resource"
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
    const { toolsAccess } = user as AuthenticatedUser;
     
    // Validate user access level
    const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];
    
    // Check user access level
    if (userType < accessLevelConstant.TOOL_ADMIN) {
        res.status(403).json({
            status: "error",
            message: "Forbidden: You don't have access to this resource"
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
        const employeeId = req.query.employeeId;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        if (isNaN(year)) {
            res.status(400).json({
                success: false,
                message: "Invalid year provided",
            });
            return;
        }

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
                [Op.and]: [
                    sequelize.where(sequelize.fn('YEAR', sequelize.col('payrollStartDate')), year)
                ],
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
    const { toolsAccess } = user as AuthenticatedUser;
     
    // Validate user access level
    const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];
    
    // Check user access level
    if (userType < accessLevelConstant.TOOL_ADMIN) {
        res.status(403).json({
            status: "error",
            message: "Forbidden: You don't have access to this resource"
        });
        return;
    }

    try {
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        if (isNaN(month) || isNaN(year)) {
            res.status(400).json({
                success: false,
                message: "Invalid month or year provided",
            });
            return;
        }

        // Fetch all payslip records for the given month and year
        const payslips: employeePayslipAttributes[] = await dbOutput.employeePayslipRecords.findAll({
            where: {
                [Op.and]: [
                    sequelize.where(sequelize.fn('MONTH', sequelize.col('payrollStartDate')), month),
                    sequelize.where(sequelize.fn('YEAR', sequelize.col('payrollStartDate')), year)
                ],
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
            res.send({ success: false, message: "Payroll is not generated yet" });
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
        console.log(payslipId)
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
                attributes: ['empBenefeciaryName', 'empAccountNumber'],
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
        
        const earnings = payslipItems.filter(
            item => item.componentType === componentTypes.ADDITION || item.componentType === componentTypes.DEFAULT_ADDITION
        );

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
            uanNumber: '-', // Add if available in your database
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

        const allPayslipRecords = await dbOutput.employeePayslipRecords.findAll({
            where: {
                [Op.and]: [
                    sequelize.where(sequelize.fn('MONTH', sequelize.col('payrollStartDate')), month),
                    sequelize.where(sequelize.fn('YEAR', sequelize.col('payrollStartDate')), year)
                ],
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

            const allAdjustedAdditions = allAdjustedComponents.filter(component => component.salaryComponent.componentType === componentTypes.ADDITION);
            const allAdjustedDeductions = allAdjustedComponents.filter(component => component.salaryComponent.componentType === componentTypes.DEDUCTION);

            netPayAmount += allAdjustedAdditions.reduce((total, component) => total + parseFloat(String(component.adjustedAmount || 0)), 0) - allAdjustedDeductions.reduce((total, component) => total + parseFloat(String(component.adjustedAmount || 0)), 0);

            const employeeUuidsForNetPay = allPayslipRecords.map(payslip => payslip.employeeId);
            
            // Fetch employee basic details and address
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

            // Fetch all matching salary categories in one query
            const salaryCategories = await dbOutput.salaryCategories.findAll({
                where: {
                    [Op.or]: salaryCategoryQueries.map(q => q.whereClause)
                },
                attributes: ['salaryCategoryId', 'employeeType', 'employeeLocation', 'employeeLevel', 'department', 'yearOfStudy'],
                raw: true
            });

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
                    salaryCategoryId: { [Op.in]: salaryCategories.map(cat => cat.salaryCategoryId) },
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

                const defaultComponents = allDefaultComponents.filter(
                    c => c.salaryCategoryId === salaryCategoryId
                );

                const additionAmount = defaultComponents
                    .filter(c => c.componentType === componentTypes.DEFAULT_ADDITION)
                    .reduce((total, c) => total + Number(c.amount || 0), 0);

                const deductionAmount = defaultComponents
                    .filter(c => c.componentType === componentTypes.DEFAULT_DEDUCTION && !c.componentName.includes('Loss of Pay'))
                    .reduce((total, c) => total + Number(c.amount || 0), 0);

                netPayAmount += additionAmount - deductionAmount;
                defaultComponentMap.set(empUuid, defaultComponents);
            });

            const unpaidLeaveConfigDetails = await dbOutput.employeeLeaveConfigurator.findOne({
                where: {
                    leaveType: {
                        [Op.like]: '%unpaid%'
                    },
                    isActive: true
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
): Promise<{ salaryCategoryId: string } | null> => {
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
        attributes: ['salaryCategoryId']
    });

    return salaryCategory ? { salaryCategoryId: salaryCategory.salaryCategoryId } : null;
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
    transaction?: Transaction
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

    // Fetch all active employees with their address details
    const employeesBasicDataForCreate = await dbOutput.employeeBasicDetails.findAll({
        include: [
            {
                model: dbOutput.employeeAddressDetails,
                as: 'addressDetails',
                required: false,
                attributes: ['state']
            }
        ],
        where: { isDeleted: false },
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

    // First, check if ANY payroll is already generated for this month (across all employees)
    // This determines if we should skip creating payroll for new employees
    const anyGeneratedPayroll = await dbOutput.employeePayslipRecords.findOne({
        where: {
            [Op.and]: [
                sequelize.where(sequelize.fn('MONTH', sequelize.col('payrollStartDate')), currentMonth),
                sequelize.where(sequelize.fn('YEAR', sequelize.col('payrollStartDate')), currentYear)
            ],
            status: { [Op.in]: [payrollStatus.PAYROLL_GENERATED] },
            isDeleted: false
        },
        attributes: ['payslipId', 'status'],
        raw: true
    });

    if (anyGeneratedPayroll) {
        console.log(`[${new Date().toISOString()}] Payroll already generated for ${currentMonth}/${currentYear}. Skipping creation for all employees.`);
        
        // Mark all employees as skipped since payroll is already generated
        for (const employee of employees) {
            result.skippedCount++;
            result.skippedEmployees.push({
                empUuid: employee.empUuid,
                reason: 'Payroll already generated for this month - new employee payroll creation skipped'
            });
        }
        
        return result;
    }

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
        attributes: ['employeeId', 'status', 'payslipId', 'payrollStartDate'],
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
    const existingPayslipMap = new Map<string, string>();
    existingPayslips.forEach(p => {
        existingPayslipMap.set(p.employeeId, p.status);
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
        const existingStatus = existingPayslipMap.get(empUuid);
        
        if (existingStatus) {
            // Skip if payroll is already generated or finalized
            if (existingStatus === payrollStatus.PAYROLL_GENERATED || existingStatus === payrollStatus.PAYROLL_FINALIZED) {
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