import { dbOutput, outputSequelize } from "../../../models/index";
import { createUUIDV4 } from "../../../utilities/uuidV4Generator";
import { Request, Response } from "express";
import { 
    countWeekdays, 
    isValidTime, 
    isValidDate, 
    getHourDifference, 
    addDays, 
    createLeaveRequestHelper, 
    updateAttendanceAndBalance, 
    adjustStartAndEndDate, 
    isWeekend, 
    getDateDiffInDays, 
    getLeavesDetailsOfPastDays, 
    getFiscalYearForLeave, 
    approvedRejectedMailHelper, 
    getFiscalYearStartAndEndDate,
    calculateAccruedLeaves, 
    handleDecimalLeaves,
    convertTo12HourFormat,
    updateEmployeePayslipStatusForUnpaidLeave,
    fetchApplicableLeaveConfigs,
} from "../../../utilities/hrmsUtilities/helperFunctions";
import { 
    AttendanceStatusType, 
    hrmsConstants, 
    LeaveApprovalStatus 
} from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import { 
    AuthenticatedUser,
    EmployeeAttendanceAttributes, 
    EmployeeAttendanceRequestPayload, 
    EmployeeHolidayDetailsAttributes, 
    EmployeeLeaveBalanceAttributes, 
    EmployeeLeaveRequestAttributes, 
    extraWorkDayAttributes, 
    LeaveConfigWithAccrual 
} from "../../../interfaces/hrmsTool/interface/hrmsInterface";
import { 
    fetchLeaveConfigDetails,
    fetchEmployeeBasicDetails, 
    fetchMandatoryLeavesInRange, 
    fetchOverLappingLeaves,
    fetchEmployeeAttendanceDetails,
    fetchEmployeeContactDetailsFromEmail,
    softDeleteEmployeeLeaveRequest,
    fetchEmployeeLeaveHistory,
    fetchAllPendingLeaveRequests,
    updatePendingLeaveRequest,
    createEmployeeAttendanceRecord,
    fetchLeaveRequestDetailsFromLeaveId,
    fetchLeaveBalanceDetails,
    fetchAllLeaveConfigDetails,
    softDeleteEmployeeAttendance,
    fetchEmployeeAttendanceDetailsById,
    updateEmployeeLeaveBalance,
    updateEmployeeAttendanceDetails,
    fetchEmployeesOnLeave,
    CheckInService,
    checkOutService,
    getCheckInOutStatusService,
    CheckOutstandingCheckoutService,
    UpdateCheckoutService,
    findHRRepositoryToolAdminUsers,
    findEmployeeDetailsByUuid,
    fetchUsedLeavesTillDate,
    fetchEmployeeCurrentJobDetails,
    createWorkRequestService,
    fetchExtraWorkLogRequestsService,
    updateExtraWorkLogRequestStatusService,
} from "../../../utilities/hrmsUtilities/dbCalls";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";
import { checkHrmsPermission } from "../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices";
const employeeLeaveRequest = dbOutput.employeeLeaveRequestDetails;
import { LeaveRequestMail } from "../../../middlewares/sendEmail";
import { Op } from "sequelize";




// Helper function to send a standardized error response
const sendError = (res: Response, message: string): Response => 
    res.status(400).json({ success: false, message });


/**
 * API to register attendance or leave for an employee.
 * Handles both working day attendance and leave/half-day requests.
 * Performs all necessary validations, leave balance checks, and creates attendance/leave records.
 */
export const registerAttendance = async (req: Request, res: Response) => {
    try {
        // Extract user info from request (for permission checks)
        const { user } = req as AuthenticatedRequest;
        const { email, toolsAccess, employeeUuid } = user as AuthenticatedUser;
        const toolName = hrmsConstants.HR_REPOSITORY;

        if (!email) {
            sendError(res, "User email is required");
            return;
        }

        // Get employee UUID from params and leave/attendance details from body
        const employeeId = req.params.empUuid as string;
        
        // Allow users to register their own attendance without permission
        // But require permission to register attendance for other employees
        const isRegisteringOwnAttendance = employeeUuid === employeeId;
        
        if (!isRegisteringOwnAttendance) {
            const hasPermission = await checkHrmsPermission(
                employeeUuid,
                "LeaveAttendance_write",
                toolName,
                toolsAccess as Record<string, number> | undefined
            );
            
            if (!hasPermission) {
                sendError(
                    res,
                    "You don't have permission to register attendance for other employees"
                );
                return;
            }
        }
        
        // Get user access level for use throughout the function
        const userAccessLevel = (toolsAccess as Record<string, number> | undefined)?.[hrmsConstants.HR_REPOSITORY] || 0;
        
        // Check if user is admin: has LeaveAttendance_write permission OR access level >= 900
        const isAdmin = userAccessLevel >= 900 || await checkHrmsPermission(
            employeeUuid,
            "LeaveAttendance_write",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );
        
        const leaveDetails = req.body as EmployeeAttendanceRequestPayload;
        const {
            attendanceStatus,
            attendanceDate,
            checkIn,
            checkOut,
            leaveConfigId,
            unpaidLeaveConfigId,
            startDate,
            endDate,
            remarks,
            attachmentPath
        } = leaveDetails;

        // Fetch employee details before transaction for email (needed outside transaction)
        const basicDetailsForEmail = await fetchEmployeeBasicDetails(employeeId);
        const configDetailsForEmail = await fetchLeaveConfigDetails(leaveConfigId!);
        
        if (!configDetailsForEmail) {
            sendError(res, "Leave configuration not found");
            return;
        }
        
        let isPendingForEmail: boolean = false;
        const startForEmail: Date | null = null as Date | null;
        const endForEmail: Date | null = null as Date | null;

        // Start a DB transaction for atomicity
        await outputSequelize.transaction(async (transaction) => {
            // Get the UUID of the user making the request
            const { empUuid }: { empUuid: string } = await fetchEmployeeContactDetailsFromEmail(email);
            
            // Permission check is already done above (before transaction)
            // Users can register their own attendance without permission

            // Validate required fields based on attendance type
            const required = ["attendanceStatus"];
            const requiredByType =
                attendanceStatus === AttendanceStatusType.WORKING
                    ? ["checkIn", "checkOut", "attendanceDate"]
                    : ["leaveConfigId", "startDate", "endDate"];

            const missingFields = [...required, ...requiredByType].filter(
                (field) => !leaveDetails?.[field],
            );
            if (missingFields.length > 0) {
                sendError(
                    res,
                    `Missing required data: ${missingFields.join(", ")}`,
                );
                return;
            }

            // === Handle WORKING attendance ===
            if (attendanceStatus === AttendanceStatusType.WORKING) {
                // Validate check-in/check-out times and attendance date
                if (!isValidTime(checkIn!) || !isValidTime(checkOut!)) {
                    sendError(res, "Invalid check-in or check-out time");
                    return;
                }
                if (checkIn! > checkOut!) {
                    sendError(res, "Check-in cannot be after check-out");
                    return;
                }
                if (!isValidDate(attendanceDate!)) {
                    sendError(res, "Invalid attendance date");
                    return;
                }

                // Calculate work hours
                const workHours = getHourDifference(checkIn!, checkOut!);

                // Create attendance record for working day
                await createEmployeeAttendanceRecord(
                    [
                        {
                            attendanceId: await createUUIDV4(),
                            empUuid: employeeId,
                            attendanceDate: new Date(attendanceDate!),
                            checkIn,
                            checkOut,
                            workHours,
                            attendanceStatus,
                            remarks,
                        },
                    ],
                    transaction,
                );

                res.status(200).json({
                    success: true,
                    message: "Attendance registered successfully",
                });
                return;
            }

            // === Handle ON_LEAVE / HALF_DAY attendance ===

            // Validate leave dates
            if (!isValidDate(startDate!) || !isValidDate(endDate!)) {
                sendError(res, "Invalid startDate or endDate format");
                return;
            }

            if (new Date(startDate!) > new Date(endDate!)) {
                sendError(res, "Start date cannot be after end date");
                return;
            }

            // Fetch mandatory holidays in the range and leave config details in parallel
            const [mandatoryLeaves, configDetails] = await Promise.all([
                fetchMandatoryLeavesInRange(new Date(startDate!), new Date(endDate!)),
                fetchLeaveConfigDetails(leaveConfigId!)
            ]) ;

            // Prepare list of holiday dates for exclusion logic
            const holidayDatesList = mandatoryLeaves.map((holiday: EmployeeHolidayDetailsAttributes) => holiday.eventDate);
            const {
                excludePaidWeekend,
                employeeType,
                appliedGender,
                isActive,
                isHalfDayAllowed,
                isReasonRequired,
                minimumNoticePeriod,
                maximumNoticePeriod,
                continuousLeavesLimit,
            } = configDetails;

            // Adjust start and end dates to skip holidays/weekends if needed
            const { start, end } = adjustStartAndEndDate(startDate!, endDate!, excludePaidWeekend, holidayDatesList);

            // Validate adjusted date range
            if (start.getTime() > new Date(startDate!).getTime() && end.getTime() < new Date(endDate!).getTime()) {
                sendError(res, "avoid applying for weekends and mandatory holidays");
                return;
            }

            // Fetch overlapping leaves, job details, and basic details in parallel
            const [
                overlappingLeaves,
                jobDetails,
                basicDetails,
            ] = await Promise.all([
                fetchOverLappingLeaves(employeeId, start, end),
                fetchEmployeeCurrentJobDetails(employeeId, transaction),
                fetchEmployeeBasicDetails(employeeId),
            ]);

            const {overlappingLeaveAttendances, overlappingLeaveRequests}  = overlappingLeaves;

            // Notice period validation (not for admin/super admin, except sick leave)
            // Admin: has LeaveAttendance_write OR access level >= 900
            if(!isAdmin) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const startDiffDays = getDateDiffInDays(today, start);
                if(start.getTime() >= today.getTime() && startDiffDays < minimumNoticePeriod) {
                    sendError(res, "Minimum notice period not satisfied");
                    return;
                } else if(start.getTime() < today.getTime() && startDiffDays > maximumNoticePeriod) {
                    sendError(res, "Maximum notice period not satisfied");
                    return;
                }
            }

            // Determine if this is a half-day leave
            const isHalfDay = attendanceStatus === AttendanceStatusType.HALF_DAY;

            // Calculate total leave days (excluding weekends/holidays if needed)
            let totalDays: number = isHalfDay
                ? 0.5
                : Math.floor(
                      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
                  ) + 1;
            if (!isHalfDay && excludePaidWeekend) {
                totalDays = countWeekdays(start, end);
                totalDays -= mandatoryLeaves.length;
            }

            // --- Config and business validations ---
            if (!isActive) {
                sendError(res, "This leave is not active");
                return;
            }
            if (isHalfDay && !isHalfDayAllowed) {
                sendError(res, "Half day not allowed for this leave");
                return;
            }
            if (!employeeType.includes(jobDetails.empType)) {
                sendError(res, "Leave not applicable to your position");
                return;
            }
            if (!appliedGender.includes(basicDetails.empGender)) {
                sendError(res, "Leave not applicable to your gender");
                return;
            }

            // Check for overlapping leaves
            if (overlappingLeaveAttendances.length > 0 || overlappingLeaveRequests.length > 0) {
                // Fetch leaveRequestIds from overlappingLeaveAttendances
                const leaveRequestIds = overlappingLeaveAttendances
                    .map(a => a.leaveRequestId)
                    .filter(Boolean);

                // leaveRequestDetails - already approved leaves
                // applicableLeaveTypes - leave types applicable to the employee
                const [leaveRequestDetails, applicableLeaveTypes] = await Promise.all([
                    fetchLeaveRequestDetailsFromLeaveId(leaveRequestIds as string[]),
                    dbOutput.employeeLeaveConfigurator.findAll({
                        where: {
                            employeeType: { [Op.like]: `%${jobDetails.empType}%` },
                            isActive: true
                        },
                        raw: true
                    })
                ]);

                // Create a set of leaveConfigIds from both existing leaves and overlapping requests
                const leaveConfigIds = new Set([
                    ...leaveRequestDetails.map(r => r?.leaveConfigId).filter(Boolean),
                    ...overlappingLeaveRequests.map(r => r?.leaveConfigId).filter(Boolean)
                ]);

                // If any overlapping leaves exist, check if they are of the same leave type
                const hasOverlap = applicableLeaveTypes.some(type => leaveConfigIds.has(type.leaveConfigId));

                // If there is an overlap, return an error
                if (hasOverlap) {
                    sendError(res, "Leave overlaps with existing ones");
                    return;
                }
            }
            
            if (isReasonRequired && !remarks) {
                sendError(res, "Remarks are required for this leave");
                return;
            }

            // Calculate fiscal year start
            const { fiscalYearStart } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, start);

            // Fetch leave balance and all leave configs in parallel
            const [balance, configs] = await Promise.all([
                fetchLeaveBalanceDetails(jobDetails, fiscalYearStart),
                fetchAllLeaveConfigDetails(),
            ]);

            // Find the config for the requested leave type
            const config = configs.find(
                (c) => c.leaveConfigId === leaveConfigId,
            );
            
            if (!config) {
                sendError(res, "Leave configuration not found");
                return;
            }

            // Check if this leave type uses accrual logic
            const allotAllLeaves = config?.allotAllLeaves;
            
            let totalAlloted: number;
            let available: number;
            let totalUsedInFiscalYear: number;
            let paidDays = totalDays;
            let unpaidDays = 0;

            if (allotAllLeaves) {
                // Original logic: Use total allotted leaves
                totalAlloted = config.totalAllotedLeaves;
                totalUsedInFiscalYear = balance.find(
                    (b) =>
                        b.empUuid === employeeId &&
                        b.leaveConfigId === leaveConfigId,
                )?.totalLeaveUsed ?? 0;
                available = totalAlloted - totalUsedInFiscalYear;
                
                // Traditional logic: If requested days exceed available, split into paid/unpaid
                if(totalDays > available) {
                    paidDays = available;
                    unpaidDays = totalDays - available;
                }
            } else {
                // New accrual-based leave system with FIXED CYCLE LOGIC
                try {
                    // ** Use total fiscal year usage instead of only up to leave start date**
                    const { fiscalYearStart } = getFiscalYearStartAndEndDate(jobDetails.empConversionDate, start);
                    
                    // Get total used leaves in entire fiscal year (including already approved future leaves)
                    const balanceDetails = await fetchLeaveBalanceDetails(jobDetails, fiscalYearStart, [leaveConfigId!]);
                    totalUsedInFiscalYear = balanceDetails[0]?.totalLeaveUsed || 0;

                    // **CYCLE-BASED ACCRUAL LOGIC**
                    // **CARRY-FORWARD CYCLE-BASED ACCRUAL LOGIC**
                    // Use cycle-based logic with proper carry-forward restrictions
                    
                    const today = new Date();
                    const conversionDate = new Date(jobDetails.empConversionDate);
                    const accrualFrequency = configDetails.accuralFrequency || 4;
                    const accrualRate = configDetails.accuralRate || 5;
                    
                    // console.log(`🔧 REGISTER - CARRY-FORWARD LOGIC: Today: ${today.toISOString()}, Leave: ${start.toISOString()}`);
                    
                    // Calculate which cycle the leave application date falls into
                    const monthsFromConversionToLeave = Math.floor(
                        (start.getFullYear() - conversionDate.getFullYear()) * 12 +
                        (start.getMonth() - conversionDate.getMonth())
                    );
                    const leaveCycleNumber = Math.floor(monthsFromConversionToLeave / accrualFrequency) + 1;
                    
                    // Calculate current cycle (based on TODAY)
                    const monthsFromConversionToToday = Math.floor(
                        (today.getFullYear() - conversionDate.getFullYear()) * 12 +
                        (today.getMonth() - conversionDate.getMonth())
                    ) % 12;
                    const currentCycleNumber = Math.floor(monthsFromConversionToToday / accrualFrequency) + 1;
                    
                    // console.log(`📊 REGISTER - Leave Cycle: ${leaveCycleNumber}, Current Cycle: ${currentCycleNumber}`);
                    
                    // **CARRY-FORWARD LOGIC**: Calculate available quota based on leave application cycle
                    let availableQuotaForThisCycle: number;
                    
                    if (leaveCycleNumber <= currentCycleNumber) {
                        // Past or current cycle: Only quota up to that cycle + carry-forward
                        availableQuotaForThisCycle = leaveCycleNumber * accrualRate;
                        // console.log(`✅ REGISTER - Past/Current cycle ${leaveCycleNumber}: Quota = ${availableQuotaForThisCycle} (${leaveCycleNumber} × ${accrualRate})`);
                    } else {
                        // Future cycle: Only current cycle quota (no future quota allowed)
                        availableQuotaForThisCycle = currentCycleNumber * accrualRate;
                        // console.log(`⚠️  REGISTER - Future cycle ${leaveCycleNumber}: Restricted to current quota = ${availableQuotaForThisCycle} (${currentCycleNumber} × ${accrualRate})`);
                    }

                    const availableForThisLeave = Math.max(0, availableQuotaForThisCycle - totalUsedInFiscalYear);
                    
                    // console.log(`🔧 REGISTER - Total used in fiscal year (past + future): ${totalUsedInFiscalYear}`);
                    // console.log(`🔧 REGISTER - Available for leave: ${availableForThisLeave}, Requested: ${totalDays}`);
                    
                    // **DECIMAL LEAVE HANDLING** - Apply decimal rules before calculating paid/unpaid
                    const availableDecimalHandling = handleDecimalLeaves(availableForThisLeave);
                    const usableAvailable = availableDecimalHandling.currentUsableLeaves;
                    
                    // console.log(`🔢 REGISTER - Decimal handling: ${availableForThisLeave} → ${usableAvailable} usable (carry forward: ${availableDecimalHandling.carryForwardDecimal})`);
                    
                    // Calculate paid vs unpaid based on decimal-handled available leaves
                    if (totalDays <= usableAvailable) {
                        paidDays = totalDays;
                        unpaidDays = 0;
                        // console.log(`✅ REGISTER - All ${totalDays} days paid (${usableAvailable} usable available)`);
                    } else {
                        paidDays = usableAvailable;
                        unpaidDays = totalDays - usableAvailable;
                        // console.log(`⚠️ REGISTER - Quota exhausted: ${paidDays} paid, ${unpaidDays} unpaid`);
                    }
                    
                    totalAlloted = availableQuotaForThisCycle;
                    available = usableAvailable; // Use decimal-handled available
                    
                    // console.log(`📊 REGISTER - Final result: Paid: ${paidDays}, Unpaid: ${unpaidDays}, Available: ${available}`);

                } catch (accrualError) {
                    console.error('Error in accrual calculation:', accrualError);
                    sendError(res, "Error calculating leave accrual. Please try again.");
                    return;
                }
            }

            // details for sick leave
            let isSickLeave: boolean = false;
            let isProofRequired: boolean = false;

            // Check if leave type is sick leave
            if(configDetailsForEmail.leaveType.toLowerCase() === "sick") isSickLeave = true;

            // used to check if the leave are in a continous manner
            // total leaves in past N days (N - continuousLeaveLimit)
            const previousLeaveDetails = await getLeavesDetailsOfPastDays(employeeId, start, continuousLeavesLimit);

            // Filter to only count leaves of the SAME TYPE as the current config
            const sameTypeLeaves = previousLeaveDetails.filter(leave => leave.leaveConfigId === leaveConfigId);

            // Check if user is admin (for CDL bypass)
            // Admin: has LeaveAttendance_write OR access level >= 900 (already checked above)

            // If requested days exceed continuous leave limit, handle accordingly
            if(totalDays > continuousLeavesLimit || sameTypeLeaves.length >= continuousLeavesLimit) {
                if(isSickLeave) {
                    // CDL violation detected for sick leave
                    if(isAdmin) {
                        // Admin: No CDL restrictions at all
                        isProofRequired = false;
                    } else {
                        // Regular user: CDL violation goes to pending
                        isProofRequired = true;
                    }
                    // Note: Accrual rate enforcement is already handled above in the accrual calculation
                    // paidDays and unpaidDays are already set based on accrual limits for both admin and user
                    // This ensures if balance is insufficient, excess goes to unpaid regardless of user type
                } else {
                    // For other leave types: Apply CDL restrictions for non-admin users only
                    // Admin users bypass CDL completely - their paidDays/unpaidDays are already set by accrual logic
                    if (!isAdmin) {
                        // Regular user: Apply CDL restrictions
                        const maxContinuousPaid = Math.min(paidDays, continuousLeavesLimit);
                        const excessDays = paidDays - maxContinuousPaid;
                        
                        paidDays = maxContinuousPaid;
                        unpaidDays += excessDays;
                    }
                }
            }

            // Prepare paid leave request data
            let paidLeaveData: EmployeeLeaveRequestAttributes = {
                leaveRequestId: await createUUIDV4(),
                empUuid: employeeId,
                leaveConfigId: leaveConfigId!,
                startDate: start,
                endDate: end,
                totalDays: paidDays,
                isHalfDay,
                remarks,
                attachmentPath,
                approvalStatus: LeaveApprovalStatus.APPROVED,
                approvedBy: empUuid,
                approvalDate: new Date()
            };

            // Prepare unpaid leave request data (if needed)
            let unpaidLeaveData: EmployeeLeaveRequestAttributes = {
                leaveRequestId: await createUUIDV4(),
                empUuid: employeeId,
                leaveConfigId: unpaidLeaveConfigId!,
                startDate: start,
                endDate: end,
                totalDays: unpaidDays,
                isHalfDay,
                remarks,
                attachmentPath,
                approvalStatus: LeaveApprovalStatus.APPROVED,
                approvedBy: empUuid,
                approvalDate: new Date()
            };

            // Apply sick leave proof requirements if needed
            if(isProofRequired) {
                const sickLeaveData = {
                    approvalStatus: LeaveApprovalStatus.PENDING,
                    approvalDate: undefined,
                    approvedBy: undefined
                };

                paidLeaveData = {
                    ...paidLeaveData,
                    ...sickLeaveData
                };

                unpaidLeaveData = {
                    ...unpaidLeaveData,
                    ...sickLeaveData
                };
            }

            // If there is an unpaid portion, split the date ranges accordingly
            if(unpaidLeaveData.totalDays > 0) {
                const paidStartDate = new Date(startDate!);
                const paidEndDate = addDays(start, paidLeaveData.totalDays - 1);

                const unpaidStartDate = addDays(start, paidLeaveData.totalDays);
                const unpaidEndDate = new Date(endDate!);

                paidLeaveData = {
                    ...paidLeaveData,
                    totalDays: paidLeaveData.totalDays,
                    startDate: paidStartDate,
                    endDate: paidEndDate,
                }

                unpaidLeaveData = {
                    ...unpaidLeaveData,
                    totalDays: unpaidLeaveData.totalDays,
                    startDate: unpaidStartDate,
                    endDate: unpaidEndDate,
                }
            }

            // --- leave goes into pending for users who violate CDL ---
            // isPending means the leave is not auto-approved but if isPending is false, it means the leave is auto-approved
            // Admin bypass for CDL is already handled above in the CDL logic
            const isPending: boolean = isProofRequired;
            
            // Capture isPending for email (outside transaction)
            isPendingForEmail = isPending;
            
            // Create leave requests (paid and/or unpaid) as needed
            if(paidLeaveData.totalDays > 0) await createLeaveRequestHelper(paidLeaveData, excludePaidWeekend, jobDetails, isPending, transaction);
            if(unpaidLeaveData.totalDays > 0) await createLeaveRequestHelper(unpaidLeaveData, excludePaidWeekend, jobDetails, isPending, transaction);

            // If unpaid days exist, check and mark employee payslip as pending
            await updateEmployeePayslipStatusForUnpaidLeave(employeeId, paidLeaveData, unpaidLeaveData, transaction); //todo: adjust for unpaid leave total days

            res.status(200).json({
                success: true,
                message: isPending
                    ? "Leave request registered successfully, view the status in Leave Status"
                    : "Leave applied and approved successfully",
            });
            return;
        });

        // Send email notification to HR admins asynchronously (after transaction commits)
        if (startForEmail && endForEmail && configDetailsForEmail) {
            // Capture values in const to help TypeScript understand the types
            const finalStartForEmail: Date = startForEmail;
            const finalEndForEmail: Date = endForEmail;
            const finalIsPendingForEmail: boolean = isPendingForEmail;
            
            setImmediate(async () => {
                try {
                    const hrAdmin = await findHRRepositoryToolAdminUsers();
               const emailRecipients = await Promise.all(
                   hrAdmin.map(async (admin) => await fetchEmployeeContactDetailsFromEmail(admin.email))
               );
               
                    // Send email to each HR admin (not blocking, no transaction)
                    emailRecipients.forEach(async (recipient) => {
                       if (recipient?.empOfficialEmail) {
                            const startDateStr = finalStartForEmail.toISOString().split('T')[0];
                            const endDateStr = finalEndForEmail.toISOString().split('T')[0];
                           const finalEndDate = startDateStr === endDateStr ? null : endDateStr;
                           
                            LeaveRequestMail(
                               recipient.empOfficialEmail,
                               recipient.empUuid,
                                `${basicDetailsForEmail.empFirstName} ${basicDetailsForEmail.empLastName}`,
                               startDateStr,
                               finalEndDate,   
                                configDetailsForEmail.leaveType,
                                !finalIsPendingForEmail, // true if approved, false if pending
                                undefined // no transaction
                            ).catch(err => console.error("Error sending leave registration email:", err));
                        }
                    });
                } catch (err) {
                    console.error("Error sending leave registration notification emails:", err);
                }
            });
        }

        return;
    } catch (err) {
        console.error("Error in registerAttendance", err);
        sendError(res, "An unexpected error occurred");
        return;
    }
};

/**
 * API to get attendance records for a specific employee and month.
 * Only admin/super admin can view other employees' attendance.
 */
export const getEmployeeAttendance = async (req: Request, res: Response) => {
    try {
        const employeeId: string = req.params.empUuid as string;
        const { month, year } = req.query as {
            month: string,
            year: string
        }

        // Extract user info for permission checks
        const { user } = req as AuthenticatedRequest;
        const { toolsAccess, email, employeeUuid } = user as AuthenticatedUser;
        const toolName = hrmsConstants.HR_REPOSITORY;

        if (!email) {
            sendError(res, "User email is required");
            return;
        }

        const [empContactDetails, empJobDetails] = await Promise.all([
            // Fetch employee details for the logged-in user
            fetchEmployeeContactDetailsFromEmail(email),
            // Fetch employee job details
            fetchEmployeeCurrentJobDetails(employeeId),
        ]);

        const { empUuid: loggedInEmpUuid } = empContactDetails as {
            empUuid: string
        }
        
        const conversionDate = new Date(empJobDetails.empConversionDate);

        // Allow users to view their own attendance without permission
        // But require permission to view other employees' attendance
        const isViewingOwnAttendance = employeeUuid === employeeId || loggedInEmpUuid === employeeId;
        
        if (!isViewingOwnAttendance) {
            // Check for either read or write permission (users who can edit should be able to view)
            const hasReadPermission = await checkHrmsPermission(
                employeeUuid || loggedInEmpUuid,
                "LeaveAttendanceAdmin_read",
                toolName,
                toolsAccess as Record<string, number> | undefined
            );
            const hasWritePermission = await checkHrmsPermission(
                employeeUuid || loggedInEmpUuid,
                "LeaveAttendance_write",
                toolName,
                toolsAccess as Record<string, number> | undefined
            );
            
            if (!hasReadPermission && !hasWritePermission) {
                sendError(res, "You don't have permission to view other employees' attendance");
                return;
            }
        }

        // Fetch all leave types applicable to the current employment type
        const applicableLeaveTypes = await dbOutput.employeeLeaveConfigurator.findAll({
            where: {
                employeeType: { [Op.like]: `%${empJobDetails.empType}%` },
                isActive: true
            },
            raw: true
        });

        // Extract leaveConfigId from applicableLeaveTypes
        const applicableLeaveTypeIds = applicableLeaveTypes.map((leaveType) => leaveType.leaveConfigId);

        // Convert month and year to numbers and validate
        const numericMonth: number = Number(month);
        const numericYear: number = Number(year);
    
        if (!month || !year) {
            sendError(res, "Both 'month' and 'year' query parameters are required");
            return;
        }

        if(numericMonth > 12 && numericMonth < 1) {
            sendError(res, "please enter a vaild month");
            return;
        }

        // Calculate date range for the month
        const startDate: Date = new Date(numericYear, numericMonth - 1, 1);
        const endDate: Date = new Date(numericYear, numericMonth, 1);

        // Fetch attendance records for the employee in the given month
        const empAttendances = await fetchEmployeeAttendanceDetails(employeeId, startDate, endDate);

        // For each attendance record, fetch the leaveConfigId if it's a leave
        const empAttendanceDetails = await Promise.all(empAttendances.map(async (data) => {
            const leaveReqId = data.leaveRequestId;

            let leaveConfigId: string | null = null;

            if (leaveReqId) {
                const record = await fetchLeaveRequestDetailsFromLeaveId([leaveReqId]);
                leaveConfigId = record?.[0]?.leaveConfigId ?? null;

                // donot consider leave if attendance date is after conversion date and leave type is not applicable to current employment type
                if(data?.attendanceDate > conversionDate && !applicableLeaveTypeIds.includes(leaveConfigId)) {
                    return null;
                }
            }

            return {
                ...data,
                leaveConfigId,
            };
        }));

        res.status(200).json({
            success: true,
            empAttendanceDetails,
            message: "Employee attendance fetched successfully"
        });

        return;
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
};

/**
 * API to soft-delete an employee leave request.
 * Expects leaveRequestId in query parameters.
 */
export const deleteEmployeeLeaveRequest = async (req: Request, res: Response) => {
    try {
        const { leaveRequestId } = req.query as {
            leaveRequestId: string
        };
        
        await softDeleteEmployeeLeaveRequest(leaveRequestId);

        res.status(200).json({
            success: true,
            message: "Leave request deleted successfully"
        })
    } catch(error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
}

/**
 * API to get leave request history for a specific employee.
 * Returns all leave requests for the given employee UUID.
 */
export const getEmployeeLeaveHistory = async (req: Request, res: Response) => {
    try {
        const employeeId: string = req.params.empUuid as string;

        const employeeLeaveHistory: EmployeeLeaveRequestAttributes = await fetchEmployeeLeaveHistory(employeeId);

        res.status(200).json({
            success: true,
            message: "Employee leave details fetch successfully",
            employeeLeaveHistory
        })
    } catch(error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
}

/**
 * API to get all pending leave requests in a date range.
 * Only admin/super admin can access this endpoint.
 * Returns pending requests with Azure read tokens for attachments.
 */
export const getAllPendingLeaveRequests = async (req: Request, res: Response) => {
    try {
        const { user } = req as AuthenticatedRequest;
        const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
        const toolName = hrmsConstants.HR_REPOSITORY;

        // Check permission: admin access (>= 900) OR LeaveRequest_read permission
        const hasPermission = await checkHrmsPermission(
            employeeUuid,
            "LeaveRequest_read",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );

        if (!hasPermission) {
            res.status(403).json({
                success: false,
                message: "You don't have permission to view leave requests"
            });
            return;
        }

        const {start, end} = req.query as {
            start: string,
            end: string
        };
        
        // Parse and validate date range
        const startDate: Date | undefined = isValidDate(start) ? new Date(start): undefined;
        const endDate: Date | undefined = isValidDate(end) ? new Date(end) : undefined;
        
        // Fetch all pending leave requests in the date range
        const allPendingRequests = await fetchAllPendingLeaveRequests(startDate, endDate);
        
        
        res.status(200).json({
            success: true,
            message: "All pending requests fetched successfully",
            allPendingRequests
        });
        return;
        
    } catch(error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
}

/**
 * API to take action (approve/reject/proof required) on multiple leave requests at once.
 * Only admin/super admin can access this endpoint.
 * Updates leave request status and, if approved, creates attendance records and updates leave balances.
 */
export const reviewLeaveRequest = async (req: Request, res: Response) => {
    try {
        const { user } = req as AuthenticatedRequest;
        const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
        const toolName = hrmsConstants.HR_REPOSITORY;

        // Approver employee ID
        const employeeId: string = req.params.empUuid as string;
        const {
            leaveRequestIds,
            action,
        }: {
            leaveRequestIds: string[];
            action: LeaveApprovalStatus;
        } = req.body;

        // Check permission: admin access (>= 900) OR LeaveRequest_write permission
        const hasPermission = await checkHrmsPermission(
            employeeUuid,
            "LeaveRequest_write",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );

        if (!hasPermission) {
            res.status(403).json({
                success: false,
                message: "You don't have permission to approve or reject leave requests"
            });
            return;
        }

        // Capture variables for email (outside transaction)
        let leaveRequestsForEmail: EmployeeLeaveRequestAttributes[] = [];
        let employeeDetailsForEmail: Array<Record<string, unknown>> = [];
        const actionForEmail: LeaveApprovalStatus = action;

        await outputSequelize.transaction(async (transaction) => {
            const empUuidList: string[] = [];
            // Fetch leave request details for the given IDs
            // and fetch all leave config details
            const [leaveRequests, allLeaveConfigs] = await Promise.all([
                fetchLeaveRequestDetailsFromLeaveId(leaveRequestIds, transaction),
                fetchAllLeaveConfigDetails()
            ]);

            for (const request of leaveRequests) {
                const { empUuid } = request;
                empUuidList.push(empUuid);
            }

            const employeeDetails = await findEmployeeDetailsByUuid(empUuidList);
            
            // Capture for email (outside transaction)
            leaveRequestsForEmail = leaveRequests;
            employeeDetailsForEmail = employeeDetails;

            // Update the status of the leave requests
            await updatePendingLeaveRequest(employeeId, leaveRequestIds, action, transaction);

            // If rejected or proof required, return immediately
            if (action.toLocaleLowerCase() === LeaveApprovalStatus.REJECTED) {
                await approvedRejectedMailHelper(employeeDetails, leaveRequests, transaction, false);
                res.status(200).json({ success: true, message: "Leave rejected successfully" });
                return;
            }
            if(action.toLocaleLowerCase() === LeaveApprovalStatus.PROOF_REQUIRED) {
                res.status(200).json({ success: true, message: "Proof request successfull" });
                return;
            }

            // If approved, create attendance records for each leave day
            const attendanceRecords: EmployeeAttendanceAttributes[] = [];

            for (const request of leaveRequests) {
                const { startDate, endDate, isHalfDay, remarks, empUuid, leaveRequestId } = request;
                const start = new Date(startDate);
                const end = new Date(endDate);

                // Particular leave config details for a leave
                const particularLeaveConfig = allLeaveConfigs.find((config) => request.leaveConfigId === config.leaveConfigId);

                // Create an attendance record for each day in the leave range
                for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
                    if(particularLeaveConfig.excludePaidWeekend && isWeekend(date)) continue;

                    attendanceRecords.push({
                        attendanceId: await createUUIDV4(), // You could batch-generate if performance is a concern
                        empUuid,
                        attendanceDate: new Date(date),
                        attendanceStatus: isHalfDay ? AttendanceStatusType.HALF_DAY : AttendanceStatusType.ON_LEAVE,
                        remarks,
                        leaveRequestId,
                    });
                }
                empUuidList.push(empUuid);
            }

            // Save all attendance records in bulk
            await createEmployeeAttendanceRecord(attendanceRecords, transaction);

            // map empUuid to job details
            const empJobDetailsCache = new Map();

            await Promise.all(
                leaveRequests.map(async (request) => {
                    let jobDetails = empJobDetailsCache.get(request.empUuid);

                    if (!jobDetails) {
                        jobDetails = await fetchEmployeeCurrentJobDetails(request.empUuid, transaction);
                        empJobDetailsCache.set(request.empUuid, jobDetails);
                    }

                    // Calculate fiscal year for the leave start date
                    const fiscalYear = getFiscalYearForLeave(jobDetails?.empConversionDate, request.startDate);

                    // fiscal year start and end based on leave start date
                    const { fiscalYearStart, fiscalYearEnd } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, request.startDate);

                    return updateEmployeeLeaveBalance({
                        jobDetails: jobDetails,
                        leaveConfigId: request.leaveConfigId,
                        totalLeaveUsed: request.totalDays,
                        fiscalYear,
                        fiscalYearStart,
                        fiscalYearEnd,
                        transaction,
                    });
                })
            );

            res.status(200).json({ success: true, message: "Leave approved successfully" });
            return;
        });

        // Send email notifications asynchronously (after transaction commits)
        setImmediate(async () => {
            try {
                const actionLower = actionForEmail.toLocaleLowerCase();
                
                if (actionLower === LeaveApprovalStatus.REJECTED) {
                    // Send rejection emails
                    approvedRejectedMailHelper(employeeDetailsForEmail, leaveRequestsForEmail, undefined, false)
                        .catch(err => console.error("Error sending leave rejection emails:", err));
                } else if (actionLower === LeaveApprovalStatus.APPROVED) {
                    // Send approval emails
                    approvedRejectedMailHelper(employeeDetailsForEmail, leaveRequestsForEmail, undefined, true)
                        .catch(err => console.error("Error sending leave approval emails:", err));
                }
            } catch (err) {
                console.error("Error sending leave review notification emails:", err);
            }
        });

        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
};
  
/**
 * API to get leave balance for a specific employee.
 * Returns leave balance details for the given employee UUID.
 */
export const getEmployeeLeaveBalance = async (req: Request, res: Response) => {
    try {
        const employeeId: string = req.params.empUuid as string;

        const jobDetails = await fetchEmployeeCurrentJobDetails(employeeId);

        const fiscalYear = getFiscalYearForLeave(jobDetails?.empConversionDate, new Date());

        // Get the start date of the current fiscal year
        const { fiscalYearStart } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, new Date());

        const balanceDetails: EmployeeLeaveBalanceAttributes[] = await fetchLeaveBalanceDetails(jobDetails, fiscalYearStart);

        res.status(200).json({
            success: true,
            message: "employee balance details fetched successfullt",
            empBalanceDetails: {balanceDetails, fiscalYear}
        });
    } catch(error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
    }
}

/**
 * API to mark a leave request as "proof required".
 * Only admin/super admin can access this endpoint.
 */
export const requireProofForLeave  = async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as { toolsAccess: unknown; employeeUuid?: string };
    const toolName = hrmsConstants.HR_REPOSITORY;

    const hasPermission = await checkHrmsPermission(
        employeeUuid,
        "LeaveRequest_write",
        toolName,
        toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
        sendError(res, "You are not allowed to do this action");
        return;
    }

    const LeaveRequestId:string = req.params.leaveRequestId as string;

    try {

        if(!LeaveRequestId) {
            sendError(res, "Leave request id is required");
            return;
        }

        // Find the leave request by ID
        const leaveRequestDetails = await employeeLeaveRequest.findOne({where : {LeaveRequestId}});

        if(!leaveRequestDetails){
            res.status(404).json({
                success: false,
                message: "Leave request not found"
            })
            return;
        }

        // Update the leave request to require proof
        await employeeLeaveRequest.update(
            {approvalStatus: LeaveApprovalStatus.PROOF_REQUIRED},
            {where: {LeaveRequestId}}
        )

        res.status(200).json({
            success: true,
            message: "Proof is required for this leave request",
        })

    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
        
    }
}

/**
 * API to upload proof documents for a leave request.
 * Expects files (array of file paths) and optional remarks in the request body.
 * Updates the leave request with the provided attachments and remarks, and sets status to pending.
 */
export const uploadProofDocuments = async (req: Request, res: Response) => {
    const LeaveRequestId: string = req.params.leaveRequestId as string;
    const { files, remarks } = req.body; 

    try {
        if (!LeaveRequestId) {
            res.status(400).json({
                success: false,
                message: "Leave request id is required"
            });
            return;
        }

        if (!files || !Array.isArray(files) || files.length === 0) {
            res.status(400).json({
                success: false,
                message: "No files provided"
            });
            return;
        }

        // Update the leave request with attachmentPath and remarks, set status to pending
        const [updatedRows] = await employeeLeaveRequest.update(
            {
                attachmentPath: JSON.stringify(files), 
                remarks: remarks || "",
                approvalStatus: LeaveApprovalStatus.PENDING
            },
            {
                where: { LeaveRequestId }
            }
        );

        if (updatedRows === 0) {
            res.status(404).json({
                success: false,
                message: "Leave request not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Proof documents uploaded and remarks updated successfully"
        });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
}

/**
 * API to soft-delete an employee attendance record.
 * Only admin/super admin can delete attendance for other employees.
 * Only working day attendance can be deleted.
 */
export const deleteEmployeeAttendance = async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    const attendanceId: string = req.params.attendanceId as string;

    if(!attendanceId){
        sendError(res, "Attendance id is required");
        return;
    }

    // Fetch attendance details by ID
    const attendanceDetails: EmployeeAttendanceAttributes = await fetchEmployeeAttendanceDetailsById(attendanceId);

    if(!attendanceDetails){
        sendError(res, "Attendance not found");
        return;
    }

    if(attendanceDetails.isDeleted){
        sendError(res, "Attendance already deleted");
        return;
    }

    // Allow users to delete their own attendance without permission
    // But require permission to delete other employees' attendance
    const isDeletingOwnAttendance = employeeUuid === attendanceDetails.empUuid;
    
    if (!isDeletingOwnAttendance) {
        const hasPermission = await checkHrmsPermission(
            employeeUuid,
            "LeaveAttendance_write",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );
        
        if (!hasPermission) {
            sendError(
                res,
                "You don't have permission to delete other employees' attendance"
            );
            return;
        }
    }

    try {
        // Only working day attendance can be deleted
        if(attendanceDetails.attendanceStatus === AttendanceStatusType.WORKING) {
            await softDeleteEmployeeAttendance(attendanceId);
        }
        
        res.status(200).json({
            success: true,
            message: "Attendance deleted successfully"
        });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
        });
    }
}

/**
 * Updates an employee's attendance record.
 * Handles both transitions:
 *   - ON_LEAVE / HALF_DAY -> WORKING (cancelling leave, marking as present)
 *   - WORKING / ON_LEAVE / HALF_DAY -> ON_LEAVE / HALF_DAY (applying for leave)
 * Performs all necessary validations, leave balance updates, and leave request management.
 */
export const updateEmployeeAttendance = async (req: Request, res: Response) => {
    try {
        // Extract user info from request (for permission checks)
        const { user } = req as AuthenticatedRequest;
        const { toolsAccess, email, employeeUuid } = user as AuthenticatedUser;
        const toolName = hrmsConstants.HR_REPOSITORY;

        if (!email) {
            sendError(res, "User email is required");
            return;
        }

        // Extract attendanceId from params and attendance update payload from body
        const { attendanceId } = req.params as { attendanceId: string };
        const attendanceDetails: EmployeeAttendanceRequestPayload = req.body;
        
        // Fetch attendance to get employee UUID before permission check
        const existingAttendance = await fetchEmployeeAttendanceDetailsById(attendanceId);
        if (!existingAttendance) {
            sendError(res, "Attendance not found");
            return;
        }
        
        // Allow users to update their own attendance without permission
        // But require permission to update other employees' attendance
        const isUpdatingOwnAttendance = employeeUuid === existingAttendance.empUuid;
        
        if (!isUpdatingOwnAttendance) {
            const hasPermission = await checkHrmsPermission(
                employeeUuid,
                "LeaveAttendance_write",
                toolName,
                toolsAccess as Record<string, number> | undefined
            );
            
            if (!hasPermission) {
                sendError(
                    res,
                    "You don't have permission to update other employees' attendance"
                );
                return;
            }
        }

        // Get user access level for use throughout the function
        const userAccessLevel = (toolsAccess as Record<string, number> | undefined)?.[hrmsConstants.HR_REPOSITORY] || 0;

        // Check if user is admin: has LeaveAttendance_write permission OR access level >= 900
        const isAdmin = userAccessLevel >= 900 || await checkHrmsPermission(
            employeeUuid,
            "LeaveAttendance_write",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );

        // Destructure relevant fields from the request body
        const {
            checkIn,
            checkOut,
            attendanceStatus,
            remarks,
            leaveConfigId,
            startDate,
            endDate,
            attendanceDate,
            attachmentPath,
            unpaidLeaveConfigId
        } = attendanceDetails;

        // Capture variables for email (outside transaction)
        let employeeIdForEmail: string | null = null;
        let startDateForEmail: string | null = null;
        let endDateForEmail: string | null = null;
        let leaveConfigIdForEmail: string | null = null;
        let isPendingForEmail: boolean = false;

        // Start a DB transaction for atomicity
        await outputSequelize.transaction(async (transaction) => {
            // Fetch the current attendance record and employee UUID
            const attendanceDetails: EmployeeAttendanceAttributes = await fetchEmployeeAttendanceDetailsById(attendanceId, transaction);
            const employeeId = attendanceDetails.empUuid;
            
            // Capture for email (outside transaction)
            employeeIdForEmail = employeeId;
            // Get the UUID of the user making the request
            const { empUuid }: { empUuid: string } = await fetchEmployeeContactDetailsFromEmail(email);
            
            // Permission check is already done above (before transaction)
            // Users can update their own attendance without permission

            // Fetch employee job and basic details for eligibility checks
            const [
                jobDetails,
                basicDetails
            ] = await Promise.all([
                fetchEmployeeCurrentJobDetails(employeeId, transaction),
                fetchEmployeeBasicDetails(employeeId),
            ]);

            // === CASE 1: ON_LEAVE / HALF_DAY / WROKING ---> WORKING ===
            if(attendanceStatus === AttendanceStatusType.WORKING) {
                // Must have a leave request to revert
                if(attendanceDetails.leaveRequestId === undefined) {
                    sendError(res, "Leave request not found");
                    return;
                }

                // Validate check-in/check-out times
                if (!isValidTime(checkIn!) || !isValidTime(checkOut!)) {
                    sendError(res, "Invalid check-in or check-out time");
                    return;
                }
                if (checkIn! > checkOut!) {
                    sendError(res, "Check-in cannot be after check-out");
                    return;
                }

                // Calculate work hours for the day
                const workHours: number = getHourDifference(checkIn!, checkOut!);

                // Prepare attendance update data
                // Set leaveRequestId to null when changing from leave/half_day to working
                const attendanceUpdateData: Partial<EmployeeAttendanceAttributes> = {
                    checkIn, checkOut, workHours, attendanceStatus, remarks, leaveRequestId: null as unknown as string | undefined
                };

                // Update attendance
                await updateEmployeeAttendanceDetails(attendanceUpdateData, attendanceId, transaction);

                // leave --> working
                // in this case the leave balance should be updated
                if(attendanceDetails.attendanceStatus !== AttendanceStatusType.WORKING) {
                    // Fetch the leave request details to get the leave config
                    const leaveRequestDetails: EmployeeLeaveRequestAttributes[] = await fetchLeaveRequestDetailsFromLeaveId([attendanceDetails.leaveRequestId]);
                    const existingLeaveConfigId: string  = leaveRequestDetails[0].leaveConfigId;

                    // Determine if the original leave was half day or full day
                    const isHalfDay = attendanceDetails.attendanceStatus === AttendanceStatusType.HALF_DAY;
                    const daysDeduced: number = isHalfDay ? 0.5 : 1;

                    // Check if it's a comp off leave and restore comp off balance
                    const existingLeaveConfig = await fetchLeaveConfigDetails(existingLeaveConfigId);
                    const isCompOffLeave = existingLeaveConfig?.leaveType?.toLowerCase().includes('comp') || 
                                         existingLeaveConfig?.leaveType?.toLowerCase().includes('comp off');

                    if (isCompOffLeave) {
                        // Restore comp off balance (newest first - reverse order)
                        const usedCompOffLeaves = await dbOutput.employeeExtraWorkDay.findAll({
                            where: {
                                empUuid: employeeId,
                                approvalStatus: LeaveApprovalStatus.APPROVED,
                                isDeleted: false,
                                totalCompOffUsed: {
                                    [Op.gt]: 0
                                }
                            },
                            order: [['workDate', 'DESC'], ['createdAt', 'DESC']], // Newest first
                            raw: true,
                            transaction
                        });

                        let remainingDaysToRestore = daysDeduced;
                        for (const compOffLeave of usedCompOffLeaves) {
                            if (remainingDaysToRestore <= 0) break;

                            const used = compOffLeave.totalCompOffUsed || 0;
                            if (used > 0) {
                                const toRestore = Math.min(remainingDaysToRestore, used);
                                const newTotalCompOffUsed = used - toRestore;
                                
                                await dbOutput.employeeExtraWorkDay.update(
                                    { totalCompOffUsed: newTotalCompOffUsed },
                                    {
                                        where: {
                                            extraWorkDayId: compOffLeave.extraWorkDayId
                                        },
                                        transaction
                                    }
                                );
                                
                                remainingDaysToRestore -= toRestore;
                            }
                        }
                    }

                    // fiscal year based on attendance date
                    const fiscalYear = getFiscalYearForLeave(jobDetails?.empConversionDate, new Date(attendanceDate!));

                    // fiscal year start and end based on attendance date
                    const { fiscalYearStart, fiscalYearEnd } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, new Date(attendanceDate!));

                    // restore leave balance
                    await updateEmployeeLeaveBalance({
                        jobDetails: jobDetails,
                        leaveConfigId: existingLeaveConfigId,
                        totalLeaveUsed: -daysDeduced,
                        fiscalYear,
                        fiscalYearStart,
                        fiscalYearEnd,
                        transaction
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Attendance updated successfully",
                });
                return;
            }

            // === CASE 2: WORKING / ON_LEAVE / HALF_DAY ---> ON_LEAVE / HALF_DAY ===

            // Validate start and end dates
            if (!isValidDate(startDate!) || !isValidDate(endDate!)) {
                sendError(res, "Invalid startDate or endDate format");
                return;
            }
            if (new Date(startDate!) > new Date(endDate!)) {
                sendError(res, "Start date cannot be after end date");
                return;
            }

            // Fetch holidays and leave config for the requested range
            const [mandatoryLeaves, configDetails] = await Promise.all([
                fetchMandatoryLeavesInRange(new Date(startDate!), new Date(endDate!)),
                fetchLeaveConfigDetails(leaveConfigId!)
            ]);

            // Prepare list of holiday dates for exclusion
            const holidayDatesList = mandatoryLeaves.map((holiday: EmployeeHolidayDetailsAttributes) => holiday.eventDate);

            // Destructure config details for validation
            const {
                excludePaidWeekend,
                employeeType,
                appliedGender,
                isActive,
                isHalfDayAllowed,
                isReasonRequired,
                minimumNoticePeriod,
                maximumNoticePeriod,
                continuousLeavesLimit,
            } = configDetails;

            // Adjust start and end dates to skip holidays/weekends if needed
            const { start, end } = adjustStartAndEndDate(startDate!, endDate!, excludePaidWeekend, holidayDatesList);

           // Validate adjusted date range
            if (start.getTime() > new Date(startDate!).getTime() && end.getTime() < new Date(endDate!).getTime()) {
                sendError(res, "avoid applying for weekends and mandatory holidays");
                return;
            }

            // --- Notice period validation (skip for admin/super admin, except for sick leave) ---
            // Admin: has LeaveAttendance_write OR access level >= 900
            if(!isAdmin) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const startDiffDays = getDateDiffInDays(today, start);
                if(start.getTime() >= today.getTime() && startDiffDays < minimumNoticePeriod) {
                    sendError(res, "Minimum notice period not satisfied");
                    return;
                } else if(start.getTime() < today.getTime() && startDiffDays > maximumNoticePeriod) {
                    sendError(res, "Maximum notice period not satisfied");
                    return;
                }
            }

            // --- Calculate total leave days (account for half day, weekends, holidays) ---
            const isHalfDay = attendanceStatus === AttendanceStatusType.HALF_DAY;
            let totalDays: number = isHalfDay
                ? 0.5
                : Math.floor(
                        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
                    ) + 1;
            if (!isHalfDay && excludePaidWeekend) {
                totalDays = countWeekdays(start, end);
                totalDays -= mandatoryLeaves.length;
            }

            // --- Config validations: is leave active, allowed for type/gender, etc ---
            if (!isActive) {
                sendError(res, "This leave is not active");
                return;
            }
            if (isHalfDay && !isHalfDayAllowed) {
                sendError(res, "Half day not allowed for this leave");
                return;
            }
            if (!employeeType.includes(jobDetails.empType)) {
                sendError(res, "Leave not applicable to your position");
                return;
            }
            if (!appliedGender.includes(basicDetails.empGender)) {
                sendError(res, "Leave not applicable to your gender");
                return;
            }
            if (isReasonRequired && !remarks) {
                sendError(res, "Remarks are required for this leave");
                return;
            }

            // --- Calculate fiscal year start and end dates ---
            const { fiscalYearStart } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, start);

            // --- Fetch leave balance and all leave configs for further calculations ---
            const [balance, configs] = await Promise.all([
                fetchLeaveBalanceDetails(jobDetails, fiscalYearStart),
                fetchAllLeaveConfigDetails(),
            ]);

            // Find the config for the requested leave type
            const config = configs.find(
                (c) => c.leaveConfigId === leaveConfigId,
            );
            
            if (!config) {
                sendError(res, "Leave configuration not found");
                return;
            }

            // Check if this leave type uses accrual logic
            const allotAllLeaves = config?.allotAllLeaves;
            
            let totalAlloted: number;
            let available: number;
            let totalUsedInFiscalYear: number;

            if (allotAllLeaves) {
                // Original logic: Use total allotted leaves
                totalAlloted = config.totalAllotedLeaves;
                totalUsedInFiscalYear = balance.find(
                    (b) => b.leaveConfigId === leaveConfigId,
                )?.totalLeaveUsed ?? 0;
                available = totalAlloted - totalUsedInFiscalYear;
            } else {
                // ** CARRY-FORWARD CYCLE-BASED ACCRUAL LOGIC**
                const today = new Date();
                const conversionDate = new Date(jobDetails.empConversionDate);
                const accrualFrequency = configDetails.accuralFrequency || 4;
                const accrualRate = configDetails.accuralRate || 5;

                // Get fiscal year start and end dates
                const { fiscalYearStart } = getFiscalYearStartAndEndDate(jobDetails.empConversionDate, start);
                
                // console.log(`🔧 UPDATE - CARRY-FORWARD LOGIC: Today: ${today.toISOString()}, Leave: ${start.toISOString()}`);
                
                // Calculate which cycle the leave application date falls into
                const monthsFromConversionToLeave = Math.floor(
                    (start.getFullYear() - conversionDate.getFullYear()) * 12 +
                    (start.getMonth() - conversionDate.getMonth())
                );
                const leaveCycleNumber = Math.floor(monthsFromConversionToLeave / accrualFrequency) + 1;
                
                // Calculate current cycle (based on TODAY)
                const monthsFromConversionToToday = Math.floor(
                    (today.getFullYear() - conversionDate.getFullYear()) * 12 +
                    (today.getMonth() - conversionDate.getMonth())
                ) % 12;
                const currentCycleNumber = Math.floor(monthsFromConversionToToday / accrualFrequency) + 1;
                
                // console.log(`📊 UPDATE - Leave Cycle: ${leaveCycleNumber}, Current Cycle: ${currentCycleNumber}`);
                
                // **CARRY-FORWARD LOGIC**: Calculate available quota based on leave application cycle
                let availableQuota: number;
                
                if (leaveCycleNumber <= currentCycleNumber) {
                    // Past or current cycle: Only quota up to that cycle + carry-forward
                    availableQuota = leaveCycleNumber * accrualRate;
                    // console.log(`✅ UPDATE - Past/Current cycle: Available quota = ${availableQuota} (${leaveCycleNumber} cycles × ${accrualRate})`);
                } else {
                    // Future cycle: Only current cycle quota (no future quota allowed)
                    availableQuota = currentCycleNumber * accrualRate;
                    // console.log(`⚠️  UPDATE - Future cycle: Restricted to current quota = ${availableQuota} (${currentCycleNumber} cycles × ${accrualRate})`);
                }
                
                // Get total used leaves in entire fiscal year (including already approved future leaves)
                const balanceDetails = await fetchLeaveBalanceDetails(jobDetails, fiscalYearStart, [leaveConfigId!]);
                totalUsedInFiscalYear = balanceDetails[0]?.totalLeaveUsed || 0;
                
                // console.log(`📊 UPDATE - Available: ${availableQuota}, Used in fiscal year: ${used}`);
                
                totalAlloted = availableQuota;
                available = Math.max(0, availableQuota - totalUsedInFiscalYear);
            }

            // --- Prepare leave request data for paid and unpaid portions ---
            let isSickLeave: boolean = false;
            let isProofRequired: boolean = false;

            // Mark as sick leave if applicable
            if(configDetails.leaveType.toLowerCase() === "sick") isSickLeave = true;

            // Calculate paid/unpaid distribution based on accrual logic or traditional logic
            let paidDays = totalDays;
            let unpaidDays = 0;

            if (!allotAllLeaves) {
                // **CORRECTED CARRY-FORWARD CYCLE-BASED PAID/UNPAID CALCULATION**
                const today = new Date();
                const conversionDate = new Date(jobDetails.empConversionDate);
                const accrualFrequency = configDetails.accuralFrequency || 4;
                const accrualRate = configDetails.accuralRate || 5;
                
                // Calculate which cycle the leave application date falls into
                const monthsFromConversionToLeave = Math.floor(
                    (start.getFullYear() - conversionDate.getFullYear()) * 12 +
                    (start.getMonth() - conversionDate.getMonth())
                );
                const leaveCycleNumber = Math.floor(monthsFromConversionToLeave / accrualFrequency) + 1;
                
                // Calculate current cycle (based on TODAY)
                const monthsFromConversionToToday = Math.floor(
                    (today.getFullYear() - conversionDate.getFullYear()) * 12 +
                    (today.getMonth() - conversionDate.getMonth())
                ) % 12;
                const currentCycleNumber = Math.floor(monthsFromConversionToToday / accrualFrequency) + 1;
                
                // **CARRY-FORWARD LOGIC**: Calculate available quota based on leave application cycle
                let availableQuotaForThisCycle: number;
                
                if (leaveCycleNumber <= currentCycleNumber) {
                    // Past or current cycle: Only quota up to that cycle + carry-forward
                    availableQuotaForThisCycle = leaveCycleNumber * accrualRate;
                    // console.log(`✅ UPDATE - Past/Current cycle ${leaveCycleNumber}: Quota = ${availableQuotaForThisCycle} (${leaveCycleNumber} × ${accrualRate})`);
                } else {
                    // Future cycle: Only current cycle quota (no future quota allowed)
                    availableQuotaForThisCycle = currentCycleNumber * accrualRate;
                    // console.log(`⚠️  UPDATE - Future cycle ${leaveCycleNumber}: Restricted to current quota = ${availableQuotaForThisCycle} (${currentCycleNumber} × ${accrualRate})`);
                }
                
                const availableForThisLeave = Math.max(0, availableQuotaForThisCycle - totalUsedInFiscalYear);
                
                // console.log(`🔧 UPDATE - Total used in fiscal year (past + future): ${totalUsedInFiscalYear}`);
                // console.log(`🔧 UPDATE - Available for leave: ${availableForThisLeave}, Requested: ${totalDays}`);
                
                // **DECIMAL LEAVE HANDLING** - Apply decimal rules before calculating paid/unpaid
                const availableDecimalHandling = handleDecimalLeaves(availableForThisLeave);
                const usableAvailable = availableDecimalHandling.currentUsableLeaves;
                
                // console.log(`🔢 UPDATE - Decimal handling: ${availableForThisLeave} → ${usableAvailable} usable (carry forward: ${availableDecimalHandling.carryForwardDecimal})`);
                
                // Calculate paid vs unpaid based on decimal-handled available leaves
                paidDays = Math.min(totalDays, usableAvailable);
                unpaidDays = Math.max(0, totalDays - paidDays);
                
                // console.log(`💰 UPDATE - Paid: ${paidDays}, Unpaid: ${unpaidDays}`);
                
                // console.log(`� UPDATE - Paid: ${paidDays}, Unpaid: ${unpaidDays}`);
                
            } else {
                // Traditional logic: If requested days exceed available, split into paid/unpaid
                if(totalDays > available) {
                    paidDays = available;
                    unpaidDays = totalDays - available;
                }
            }

            // used to check if the leave are in a continuous manner
            // total leaves in past N days (N - continuousLeaveLimit)
            const previousLeaveDetails = await getLeavesDetailsOfPastDays(employeeId, start, continuousLeavesLimit);

            // Filter to only count leaves of the SAME TYPE as the current config
            const sameTypeLeaves = previousLeaveDetails.filter(leave => leave.leaveConfigId === leaveConfigId);

            // check if the user is an admin
            // Admin: has LeaveAttendance_write OR access level >= 900 (already checked above)

            // --- Handle continuous leave limit and proof requirement for sick leave ---
            if(totalDays > continuousLeavesLimit || sameTypeLeaves.length >= continuousLeavesLimit) {
                if(isSickLeave) {
                    // CDL violation detected for sick leave
                    if(isAdmin) {
                        // Admin applying for others: No CDL restrictions at all
                        isProofRequired = false;
                    } else {
                        // Regular user: CDL violation goes to pending
                        isProofRequired = true;
                    }
                } else {
                    // For other leave types: Apply CDL restrictions based on user type and target
                    if(isAdmin) {
                        // Admin applying for others: No CDL restrictions, allow full amount within accrual limits
                        // paidDays and unpaidDays already calculated based on accrual only
                    } else {
                        // Admin applying for themselves OR regular user: Apply CDL restrictions
                        const maxContinuousPaid = Math.min(paidDays, continuousLeavesLimit);
                        const excessDays = paidDays - maxContinuousPaid;
                        
                        paidDays = maxContinuousPaid;
                        unpaidDays += excessDays;
                    }
                }
            }

            // Paid leave data
            let paidLeaveData: EmployeeLeaveRequestAttributes = {
                leaveRequestId: await createUUIDV4(),
                empUuid: employeeId,
                leaveConfigId: leaveConfigId!,
                startDate: start,
                endDate: end,
                totalDays: paidDays,
                isHalfDay,
                checkIn,
                checkOut,
                remarks,
                approvalStatus: LeaveApprovalStatus.APPROVED,
                approvedBy: empUuid,
                approvalDate: new Date()
            };

            // Unpaid leave data
            let unpaidLeaveData: EmployeeLeaveRequestAttributes = {
                leaveRequestId: await createUUIDV4(),
                empUuid: employeeId,
                leaveConfigId: unpaidLeaveConfigId!,
                startDate: start,
                endDate: end,
                totalDays: unpaidDays,
                isHalfDay,
                checkIn,
                checkOut,
                remarks,
                approvalStatus: LeaveApprovalStatus.APPROVED,
                approvedBy: empUuid,
                approvalDate: new Date()
            };

            // Apply sick leave proof requirements if needed
            if(isProofRequired) {
                const sickLeaveData = {
                    attachmentPath,
                    approvalStatus: LeaveApprovalStatus.PENDING,
                    approvalDate: undefined,
                    approvedBy: undefined
                };

                paidLeaveData = {
                    ...paidLeaveData,
                    ...sickLeaveData
                };

                unpaidLeaveData = {
                    ...unpaidLeaveData,
                    ...sickLeaveData
                };
            }

            // --- Adjust start/end dates for paid and unpaid leave portions ---
            if(unpaidDays > 0) {
                // Paid leave: from start to (start + paidDays - 1)
                const paidStartDate = new Date(startDate!);
                const paidEndDate = addDays(start, paidDays - 1);

                // Unpaid leave: from (start + paidDays) to end
                const unpaidStartDate = addDays(start, paidDays);
                const unpaidEndDate = new Date(endDate!);

                paidLeaveData = {
                    ...paidLeaveData,
                    startDate: paidStartDate,
                    endDate: paidEndDate,
                }

                unpaidLeaveData = {
                    ...unpaidLeaveData,
                    startDate: unpaidStartDate,
                    endDate: unpaidEndDate,
                }
            }

            // --- If updating an existing leave, get its config id for balance adjustment ---
            let leaveRequestDetails: EmployeeLeaveRequestAttributes[] = [];

            if(attendanceDetails.leaveRequestId) {
                leaveRequestDetails = await fetchLeaveRequestDetailsFromLeaveId([attendanceDetails.leaveRequestId]);
            }

            // Check if existing leave is comp off and restore comp off balance if changing to different leave type
            if (leaveRequestDetails.length > 0 && leaveConfigId && leaveConfigId !== leaveRequestDetails[0].leaveConfigId) {
                const existingLeaveConfigId = leaveRequestDetails[0].leaveConfigId;
                const existingLeaveConfig = await fetchLeaveConfigDetails(existingLeaveConfigId);
                const isCompOffLeave = existingLeaveConfig?.leaveType?.toLowerCase().includes('comp') || 
                                     existingLeaveConfig?.leaveType?.toLowerCase().includes('comp off');

                if (isCompOffLeave) {
                    const daysToRestore = leaveRequestDetails[0].totalDays;
                    
                    // Restore comp off balance (newest first - reverse order)
                    const usedCompOffLeaves = await dbOutput.employeeExtraWorkDay.findAll({
                        where: {
                            empUuid: employeeId,
                            approvalStatus: LeaveApprovalStatus.APPROVED,
                            isDeleted: false,
                            totalCompOffUsed: {
                                [Op.gt]: 0
                            }
                        },
                        order: [['workDate', 'DESC'], ['createdAt', 'DESC']], // Newest first
                        raw: true,
                        transaction
                    });

                    let remainingDaysToRestore = daysToRestore;
                    for (const compOffLeave of usedCompOffLeaves) {
                        if (remainingDaysToRestore <= 0) break;

                        const used = compOffLeave.totalCompOffUsed || 0;
                        if (used > 0) {
                            const toRestore = Math.min(remainingDaysToRestore, used);
                            const newTotalCompOffUsed = used - toRestore;
                            
                            await dbOutput.employeeExtraWorkDay.update(
                                { totalCompOffUsed: newTotalCompOffUsed },
                                {
                                    where: {
                                        extraWorkDayId: compOffLeave.extraWorkDayId
                                    },
                                    transaction
                                }
                            );
                            
                            remainingDaysToRestore -= toRestore;
                        }
                    }
                }
            }

            // --- Leave goes into pending for users who violate CDL ---
            // Admin bypass for CDL is already handled above in the CDL logic
            const isPending: boolean = isProofRequired;
            
            // Capture for email (outside transaction)
            startDateForEmail = startDate!;
            endDateForEmail = endDate!;
            leaveConfigIdForEmail = leaveConfigId!;
            isPendingForEmail = isPending;

            // --- Update attendance and leave balances for paid and unpaid portions ---
            if(paidLeaveData.totalDays > 0) await updateAttendanceAndBalance(paidLeaveData, leaveRequestDetails[0], isPending, attendanceDetails, jobDetails, transaction);
            if(unpaidLeaveData.totalDays > 0) await updateAttendanceAndBalance(unpaidLeaveData, leaveRequestDetails[0], isPending, attendanceDetails, jobDetails, transaction);

            // --- Respond with appropriate message based on proof requirement ---
            res.status(200).json({
                success: true,
                message: isPending
                    ? "Leave request registered successfully, view the status in Leave Status"
                    : "Attendance updated successfully",
            });
            return;
        });

        // Send email notification to HR admins asynchronously (after transaction commits)
        if (employeeIdForEmail && startDateForEmail && endDateForEmail && leaveConfigIdForEmail) {
            // Capture values in const to help TypeScript understand the types
            const finalEmployeeIdForEmail: string = employeeIdForEmail;
            const finalStartDateForEmail: string = startDateForEmail;
            const finalEndDateForEmail: string = endDateForEmail;
            const finalLeaveConfigIdForEmail: string = leaveConfigIdForEmail;
            const finalIsPendingForEmail: boolean = isPendingForEmail;
            
            setImmediate(async () => {
                try {
                    // Fetch employee details for email (outside transaction)
                    const employeeBasicDetails = await fetchEmployeeBasicDetails(finalEmployeeIdForEmail);
                    const leaveConfig = await fetchLeaveConfigDetails(finalLeaveConfigIdForEmail);
                    
                    const hrAdmin = await findHRRepositoryToolAdminUsers();
                    const emailRecipients = await Promise.all(
                        hrAdmin.map(async (admin) => await fetchEmployeeContactDetailsFromEmail(admin.email))
                    );

                    // Send email to each HR admin (not blocking, no transaction)
                    emailRecipients.forEach(async (recipient) => {
                        if (recipient?.empOfficialEmail) {
                            const startDateStr = new Date(finalStartDateForEmail).toISOString().split('T')[0];
                            const endDateStr = new Date(finalEndDateForEmail).toISOString().split('T')[0];
                            const finalEndDate = startDateStr === endDateStr ? null : endDateStr;

                            LeaveRequestMail(
                                recipient.empOfficialEmail,
                                recipient.empUuid,
                                `${employeeBasicDetails.empFirstName} ${employeeBasicDetails.empLastName}`,
                                startDateStr,
                                finalEndDate,
                                leaveConfig?.leaveType || "Leave",
                                !finalIsPendingForEmail, // true if approved, false if pending
                                undefined // no transaction
                            ).catch(err => console.error("Error sending attendance update email:", err));
                        }
                    });
                } catch (err) {
                    console.error("Error sending attendance update notification emails:", err);
                }
            });
        }

        return;
    } catch (error) {
        // Handle unexpected errors
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
        });
        return;
    }
}

export const getEmployeeOnLeave = async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as {
        startDate: string;
        endDate: string;
    };

    try {
        // Validate date format
        if(!startDate || !endDate) {
            res.status(400).json({
                success: false,
                message: "Start date and end date are required"
            });
            return;
        }

        if(isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
            res.status(400).json({
                success: false,
                message: "Invalid date format"
            });
            return;
        }

        // Fetch all employees on leave in the specified date range
        const employeesOnLeave = await fetchEmployeesOnLeave(new Date(startDate), new Date(endDate));

        if(!employeesOnLeave || employeesOnLeave.length === 0) {
            res.status(200).json({
                success: false,
                message: "No employees on leave found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Employees on leave fetched successfully",
            employeesOnLeave
        });

    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;      
    }
}

export const getCheckInOutStatus = async (req: Request, res: Response) => {
    const { empUuid } = req.params as { empUuid: string };
    const { timezone } = req.query as { timezone: string };
    
    try {
        // Validate timezone format if provided
        if (timezone) {
            try {
                new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
            } catch {
                res.status(400).json({
                    success: false,
                    message: `Invalid timezone format: ${timezone}`
                });
                return;
            }
        }
        
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', { 
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const attendanceDate = formatter.format(now);

        const status = await getCheckInOutStatusService(empUuid, attendanceDate);

        res.status(200).json({
            success: true,
            checkInChcekOutStatus: status
        });
    } catch (error) {
        console.error("Error fetching check-in/out status:", error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Something went wrong",
        });
    }
};

export const employeeCheckIn = async (req: Request, res: Response) => {
    const { empUuid } = req.params as { empUuid: string };
    const { timezone } = req.body;
    
    // Get current date in user's timezone using Intl.DateTimeFormat (more reliable)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const attendanceDate = formatter.format(now); 
    
    let transaction;
    
    try {
        transaction = await outputSequelize.transaction();
        const employeeCheckInDetails = await CheckInService(empUuid, attendanceDate, timezone, transaction);
        
        if (employeeCheckInDetails && 'success' in employeeCheckInDetails && !employeeCheckInDetails.success) {
            await transaction.rollback();
            res.status(400).json({
                success: false,
                message: employeeCheckInDetails.message
            });
            return;
        }
        
        if (!employeeCheckInDetails) {
            await transaction.rollback();
            res.status(404).json({
                success: false,
                message: "check-in failed"
            });
            return;
        }
        
        await transaction.commit();
        
        const checkIn12hr = convertTo12HourFormat(employeeCheckInDetails.checkIn);

        if (!checkIn12hr) {
            res.status(400).json({
                success: false,
                message: "Check-in time is not available"
            });
            return;
        }
        
        res.status(200).json({
            success: true,
            message: `You have checked in at ${checkIn12hr}`,
        });
        
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
    }
};

export const employeeCheckOut = async (req: Request, res: Response) => {
    const { timezone } = req.body;
    const { empUuid } = req.params as { empUuid: string };
    
    // Get current date in user's timezone using Intl.DateTimeFormat (consistent with check-in)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD format
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const attendanceDate = formatter.format(now); // Returns YYYY-MM-DD format

    let transaction;

    try {
        transaction = await outputSequelize.transaction();

        const employeeCheckOutDetails = await checkOutService(empUuid, attendanceDate, timezone, transaction);

        if (!employeeCheckOutDetails || employeeCheckOutDetails.length === 0) {
            await transaction.rollback();
            res.status(404).json({
                success: false,
                message: "check-out failed"
            });
            return;
        }

        await transaction.commit();

        const checkOut12hr = convertTo12HourFormat(employeeCheckOutDetails.checkOut);
        
        if (!checkOut12hr) {
            res.status(400).json({
                success: false,
                message: "Check-out time is not available"
            });
            return;
        }
        
        res.status(200).json({
            success: true,
            message: `You have checked out at ${checkOut12hr}`,
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
}


export const checkOutstandingCheckout = async (req: Request, res: Response) => {
    const { empUuid } = req.params as { empUuid: string };
    const { timezone } = req.query as { timezone: string };
    let transaction;
    
    try {
        // Validate timezone format if provided
        if (timezone) {
            try {
                new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
            } catch {
                res.status(400).json({
                    success: false,
                    message: `Invalid timezone format: ${timezone}`
                });
                return;
            }
        }
        
        transaction = await outputSequelize.transaction();
        
        const result = await CheckOutstandingCheckoutService(empUuid, timezone, transaction);
        
        await transaction.commit();
        
        res.status(200).json({
            success: true,
            outStandingCheckOut: result
        });
        
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
    }
};


export const updateEmployeeOutstandingCheckout = async (req: Request, res: Response) => {
    const { attendanceId } = req.params as { attendanceId: string };
    const { attendanceDate, checkOutTime } = req.body as { attendanceDate: string; checkOutTime: string };
    const transaction = await outputSequelize.transaction();
    
    try {
        if (!attendanceDate || !checkOutTime) {
            res.status(400).json({
                success: false,
                message: "attendanceDate and checkOutTime are required"
            });
            return;
        }
        
        const result = await UpdateCheckoutService(attendanceId, attendanceDate, checkOutTime, transaction);
        
        if (!result.success) {
            await transaction.rollback();
            res.status(400).json(result);
            return;
        }
        
        await transaction.commit();
        
        res.status(200).json(result);
        
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
    }
};

export const getLeavesEligibility = async (req: Request, res: Response) => {
    try {
        const { requestDate } = req.query as { requestDate?: string };
        const  employeeId: string  = req.params.empUuid as string;

        // Validation of request date
        if (!requestDate || !isValidDate(requestDate)) {
            res.status(400).json({ success: false, message: "Invalid or missing requestDate."});
            return;
        }

        if (!employeeId) {
            res.status(400).json({ success: false, message: "Missing employeeId." });
            return;
        }

        const leaveEligibilityData: Record<string, boolean> = {};
        // Fetch employee job details and basic details
        const [jobDetails, basicDetails] = await Promise.all([
            fetchEmployeeCurrentJobDetails(employeeId),
            fetchEmployeeBasicDetails(employeeId)
        ]);

        // Filter leave configs applicable to employee's type
        const applicableLeaveConfigs = await fetchApplicableLeaveConfigs(jobDetails.empType, basicDetails.empGender,jobDetails.empConversionDate);

        // Run async calls in parallel with Promise.all
        await Promise.all(
            applicableLeaveConfigs.map(async (config) => {
                // Get all leaves in the past N days
                const previousLeaveDetails = await getLeavesDetailsOfPastDays(employeeId, new Date(requestDate), config.continuousLeavesLimit);

                // The returned data now includes leaveConfigId from the enrichment
                // Filter to only count leaves of the SAME TYPE as the current config
                const sameTypeLeaves = previousLeaveDetails.filter(leave => leave.leaveConfigId === config.leaveConfigId);

                // Only disable if same type leaves exceed the limit
                leaveEligibilityData[config.leaveConfigId] = sameTypeLeaves.length < config.continuousLeavesLimit;
            })
        );

        res.status(200).json({
            success: true,
            leaveEligibilityData
        });
        return;

    } catch (error) {
        console.error("Error in getCanApplyLeaves:", error);
        res.status(500).json({
            success: false,
            message: "Something went wrong while fetching leave eligibility.",
            error: error.message || error
        });
        return;
    }
}

/**
 * API to get accrual-based leave balance for an employee
 * Returns detailed accrual information including accrued leaves, used leaves, and available balance
 * Supports multi-fiscal year calculations based on asOfDate parameter
 */
export const getAccrualLeaveBalance = async (req: Request, res: Response) => {
    try {
        const { user } = req as AuthenticatedRequest;
        const { email, toolsAccess, employeeUuid } = user as AuthenticatedUser;
        const toolName = hrmsConstants.HR_REPOSITORY;
        
        if (!email) {
            sendError(res, "User email is required");
            return;
        }
        
        const employeeId = req.params.empUuid as string;
        const { leaveConfigId, asOfDate } = req.query as { leaveConfigId?: string, asOfDate?: string };

        // Get user's own UUID for permission check
        const { empUuid: loggedInEmpUuid } = await fetchEmployeeContactDetailsFromEmail(email) as { empUuid: string };

        // Allow users to view their own leave balance without permission
        // But require permission to view other employees' balance
        const isViewingOwnBalance = employeeUuid === employeeId || loggedInEmpUuid === employeeId;
        
        if (!isViewingOwnBalance) {
            // Check for either read or write permission (users who can edit should be able to view)
            const hasReadPermission = await checkHrmsPermission(
                employeeUuid || loggedInEmpUuid,
                "LeaveAttendanceAdmin_read",
                toolName,
                toolsAccess as Record<string, number> | undefined
            );
            const hasWritePermission = await checkHrmsPermission(
                employeeUuid || loggedInEmpUuid,
                "LeaveAttendance_write",
                toolName,
                toolsAccess as Record<string, number> | undefined
            );
            
            if (!hasReadPermission && !hasWritePermission) {
                sendError(res, "You don't have permission to view other employees' leave balance");
                return;
            }
        }

        // Fetch employee job details and leave configurations
        const [jobDetails, basicDetails] = await Promise.all([
            fetchEmployeeCurrentJobDetails(employeeId),
            fetchEmployeeBasicDetails(employeeId)
        ]);

        if (!jobDetails) {
            sendError(res, "Employee not found");
            return;
        }

        const currentDate = new Date();
        const conversionDate = new Date(jobDetails.empConversionDate);

        // Filter leave configs applicable to employee's type
        const applicableLeaveConfigs = await fetchApplicableLeaveConfigs(jobDetails.empType, basicDetails.empGender, jobDetails.empConversionDate);

        // If specific leave config requested, filter further
        const leaveConfigs = leaveConfigId 
            ? applicableLeaveConfigs.filter(config => config.leaveConfigId === leaveConfigId)
            : applicableLeaveConfigs;

        // Extract leaveConfigIds for querying balances
        const leaveConfigIds = leaveConfigs.map(config => config.leaveConfigId);

        if (leaveConfigs.length === 0) {
            sendError(res, "No applicable leave configurations found");
            return;
        }

        
        
        // Parse the asOfDate parameter or use current date
        const targetDate = asOfDate ? new Date(asOfDate) : currentDate;
        
        // Validate asOfDate if provided
        if (asOfDate && isNaN(targetDate.getTime())) {
            sendError(res, "Invalid date format. Please use YYYY-MM-DD format.");
            return;
        }

        // Normalize dates to remove time component for accurate comparison
        const normalizeDate = (date: Date) => {
            const normalized = new Date(date);
            normalized.setHours(0, 0, 0, 0);
            return normalized;
        };

        const normalizedCurrentDate = normalizeDate(currentDate);
        const normalizedTargetDate = normalizeDate(targetDate);
        
        // Calculate fiscal year based on target date (for multi-fiscal year support)
        const targetFiscalYear = getFiscalYearForLeave(conversionDate, targetDate);
        
        // Get fiscal year boundaries for the target date based on empConversionDate
        const targetFiscalYearStartAndEnd = getFiscalYearStartAndEndDate(conversionDate, targetDate);
        const targetFiscalYearStart: Date = targetFiscalYearStartAndEnd.fiscalYearStart;
        const targetFiscalYearEnd: Date = targetFiscalYearStartAndEnd.fiscalYearEnd;

        // Fetch all leave balances for the employee for the target fiscal year
        const allLeaveBalanceDetails: EmployeeLeaveBalanceAttributes[] = await fetchLeaveBalanceDetails(jobDetails, targetFiscalYearStart, leaveConfigIds);

        // Map leaveConfigId to balance details for quick lookup
        const leaveBalanceMap: Record<string, EmployeeLeaveBalanceAttributes> = {};
        allLeaveBalanceDetails.forEach(balance => {
            if (balance.leaveConfigId) {
                leaveBalanceMap[balance.leaveConfigId] = balance;
            }
        });
        
        // Calculate accrual information for each leave type
        const accrualResults = await Promise.all(
            leaveConfigs.map(async (config) => {
                const allotAllLeaves = config?.allotAllLeaves;
                
                // FIXED: Get used leaves within entire CURRENT fiscal year (including future leaves)
                // Always show leaves for current fiscal year regardless of target date
                const balanceDetails = leaveBalanceMap[config.leaveConfigId];
                const usedLeavesInCurrentFiscalYear = balanceDetails?.totalLeaveUsed || 0;

                // Total allotted leaves from config
                const totalAllotted = Number(config.totalAllotedLeaves) || 0;

                if (allotAllLeaves) {
                    // Traditional logic - use target date calculation for consistency
                    const available = Math.max(0, totalAllotted - usedLeavesInCurrentFiscalYear);
                    
                    return {
                        leaveConfigId: config.leaveConfigId,
                        leaveType: config.leaveType,
                        availableLeaves: available,
                        fiscalYear: targetFiscalYear,
                        fiscalYearStart: targetFiscalYearStart.toISOString().split('T')[0],
                        fiscalYearEnd: targetFiscalYearEnd.toISOString().split('T')[0],
                        targetDate: targetDate.toISOString().split('T')[0],
                        totalAllotedLeaves: totalAllotted,
                        accruedLeaves: totalAllotted, // Same as total for traditional leaves
                        totalUsedLeaves: usedLeavesInCurrentFiscalYear,
                    };
                } else {
                    // **CORRECTED CARRY-FORWARD ACCRUAL-BASED BALANCE DISPLAY**
                    const leaveConfigWithAccrual: LeaveConfigWithAccrual = {
                        ...config,
                        allotAllLeaves
                    };

                    const accrualRate = Number(config.accuralRate) || 0;
                    const accrualFrequency = config.accuralFrequency || 4; // Default 4 months per cycle
                    
                    // Calculate cycle information based on CURRENT DATE (TODAY)
                    const today = new Date();
                    
                    // Calculate current cycle (based on TODAY)
                    const monthsFromConversionToToday = Math.floor(
                        (today.getFullYear() - conversionDate.getFullYear()) * 12 +
                        (today.getMonth() - conversionDate.getMonth())
                    ) % 12;
                    const currentCycleNumber = Math.floor(monthsFromConversionToToday / accrualFrequency) + 1;
                    
                    // Calculate current cycle boundaries
                    const currentCycleStartMonth = (currentCycleNumber - 1) * accrualFrequency;
                    const currentCycleStart = new Date(conversionDate);
                    currentCycleStart.setMonth(conversionDate.getMonth() + currentCycleStartMonth);
                    
                    const currentCycleEnd = new Date(currentCycleStart);
                    currentCycleEnd.setMonth(currentCycleEnd.getMonth() + accrualFrequency);
                    currentCycleEnd.setDate(currentCycleEnd.getDate() - 1);
                    
                    // **CARRY-FORWARD LOGIC**: Total quota including all completed cycles + current cycle
                    const totalQuotaIncludingCarryForward = currentCycleNumber * accrualRate;
                    
                    // **TOTAL AVAILABLE WITH CARRY-FORWARD** (for overall fiscal year view)
                    const totalAvailableWithCarryForward = Math.max(0, totalQuotaIncludingCarryForward - usedLeavesInCurrentFiscalYear);
                    
                    // **CYCLE-SPECIFIC AVAILABILITY CALCULATION FOR SPECIFIC CYCLE QUERIES**
                    // If querying for a specific date/cycle, calculate availability for that specific cycle
                    let cycleSpecificAvailable = totalAvailableWithCarryForward;
                    let cycleSpecificUsed = usedLeavesInCurrentFiscalYear;
                    let cycleSpecificQuota = totalQuotaIncludingCarryForward;
                    
                    // If asOfDate is provided, calculate cycle-specific values for that date
                    if (asOfDate && asOfDate !== today.toISOString().split('T')[0]) {
                        const queryDate = new Date(asOfDate);
                        
                        // Calculate which cycle the query date falls into
                        const monthsFromConversionToQuery = Math.floor(
                            (queryDate.getFullYear() - conversionDate.getFullYear()) * 12 +
                            (queryDate.getMonth() - conversionDate.getMonth())
                        );
                        const queryCycleNumber = Math.floor(monthsFromConversionToQuery / accrualFrequency) + 1;
                        
                        // Calculate query cycle boundaries
                        const queryCycleStartMonth = (queryCycleNumber - 1) * accrualFrequency;
                        const queryCycleStart = new Date(conversionDate);
                        queryCycleStart.setMonth(conversionDate.getMonth() + queryCycleStartMonth);
                        
                        const queryCycleEnd = new Date(queryCycleStart);
                        queryCycleEnd.setMonth(queryCycleEnd.getMonth() + accrualFrequency);
                        queryCycleEnd.setDate(queryCycleEnd.getDate() - 1);
                        
                        // **CYCLE-SPECIFIC CALCULATION**: Only quota up to that cycle + carry-forward
                        if (queryCycleNumber <= currentCycleNumber) {
                            // Past or current cycle: Only quota up to that cycle
                            cycleSpecificQuota = queryCycleNumber * accrualRate;
                            
                            // **Get usage only within that specific cycle period
                            cycleSpecificUsed = Number(await fetchUsedLeavesTillDate(
                                employeeId, 
                                config.leaveConfigId, 
                                queryCycleEnd,
                                queryCycleStart
                            )) || 0;
                            
                            cycleSpecificAvailable = Math.max(0, cycleSpecificQuota - cycleSpecificUsed);
                            
                        } else {
                            // Future cycle: Only current cycle quota
                            cycleSpecificQuota = currentCycleNumber * accrualRate;
                            cycleSpecificUsed = usedLeavesInCurrentFiscalYear;
                            cycleSpecificAvailable = Math.max(0, cycleSpecificQuota - cycleSpecificUsed);
                            
                            // console.log(`⚠️ GET API - Future cycle ${queryCycleNumber}: Restricted to current quota ${cycleSpecificQuota}`);
                        }
                    }

                    const totalAvailableDecimalHandling = handleDecimalLeaves(totalAvailableWithCarryForward);
                    const cycleSpecificDecimalHandling = handleDecimalLeaves(cycleSpecificAvailable);
                    
                    
                    // Calculate total accrued till target date for reference
                    const totalAccruedTillTargetDate = calculateAccruedLeaves(
                        conversionDate,
                        leaveConfigWithAccrual,
                        targetDate
                    );

                    return {
                        leaveConfigId: config.leaveConfigId,
                        leaveType: config.leaveType,
                        fiscalYearStart: targetFiscalYearStart.toISOString().split('T')[0],
                        fiscalYearEnd: targetFiscalYearEnd.toISOString().split('T')[0],
                        totalAllotedLeaves: totalAllotted,
                        accruedLeaves: totalAccruedTillTargetDate,
                        // **Use cycle-specific available for queries with asOfDate
                        availableLeaves: asOfDate && asOfDate !== today.toISOString().split('T')[0] 
                            ? cycleSpecificDecimalHandling.currentUsableLeaves 
                            : totalAvailableDecimalHandling.currentUsableLeaves,
                        fiscalYear: targetFiscalYear,
                        targetDate: targetDate.toISOString().split('T')[0],
                        totalUsedLeaves: usedLeavesInCurrentFiscalYear, // Actual leaves used in current fiscal year
                    };
                }
            })
        );

        // Determine if this is historical data (only if explicitly requesting past date)
        const isHistoricalData = asOfDate && normalizedTargetDate.getTime() < normalizedCurrentDate.getTime();

        res.status(200).json({
            success: true,
            message: "Leave balance retrieved successfully",
            accrualLeaveBalance: {
                employeeId,
                fiscalYear: targetFiscalYear,
                fiscalYearStart: targetFiscalYearStart,
                fiscalYearEnd: targetFiscalYearEnd,
                targetDate,
                currentDate,
                isHistoricalData,
                leaveBalance: accrualResults
            }
        });

    } catch (error) {
        console.error("Error fetching accrual leave balance:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
    }
};


export const extraWorkLogRequest = async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const requestedData = req.body;

    try {
        await outputSequelize.transaction(async (transaction) => {
        const createWorkLogData: Partial<extraWorkDayAttributes>= await createWorkRequestService(requestedData, user, transaction);
        res.status(200).json({
            success: true,
            message: "Extra work log request created successfully",
            data: createWorkLogData
        });
    });       
    } catch (error) {
         res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
}

export const getExtraWorkLogRequests = async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        
        // Check user permissions
        const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
        const toolName = hrmsConstants.HR_REPOSITORY;
        
        // Check permission: admin access (>= 900) OR ExtraWorkDayRequests_read permission
        const hasPermission = await checkHrmsPermission(
            employeeUuid,
            "ExtraWorkDayRequests_read",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );

        if (!hasPermission) {
            res.status(403).json({
                success: false,
                message: "You don't have permission to view extra work day requests"
            });
            return;
        }

        const {startDate, endDate} = req.query as {startDate?: string, endDate?: string};
        try {
            const extraWorkLogRequests = await fetchExtraWorkLogRequestsService(startDate, endDate);
            res.status(200).json({
                success: true,
                message: "Extra work log requests fetched successfully",
                workLogRequests: extraWorkLogRequests
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Internal Server Error. Please try again later.",
                error: error instanceof Error ? error.message : error,
            });
            return;       
        }
}

export const updateExtraWorkLogRequestStatus = async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        
        // Check user permissions
        const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
        const toolName = hrmsConstants.HR_REPOSITORY;
        
        // Check permission: admin access (>= 900) OR ExtraWorkDayRequests_write permission
        const hasPermission = await checkHrmsPermission(
            employeeUuid,
            "ExtraWorkDayRequests_write",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );

        if (!hasPermission) {
            res.status(403).json({
                success: false,
                message: "You don't have permission to approve or reject extra work day requests"
            });
            return;
        }
        const { requestIds, action } = req.body;

        try {
            const updatedExtraWorkLogRequest = await updateExtraWorkLogRequestStatusService(requestIds, action, user);
            res.status(200).json({
                success: true,
                message: `Extra work log request status ${action} successfully`,
                updatedData: updatedExtraWorkLogRequest
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Internal Server Error. Please try again later.",
                error: error instanceof Error ? error.message : error,
            });
            return;       
        }
}

/**
 * API to get comp off balance for an employee.
 * Calculates allotted leaves from employee_extra_work_day table based on:
 * - If credit exists and not expired: count full credit as allotted
 * - If used and expired: count only used amount as allotted
 * - If not used and expired: don't count (0)
 * Also returns total leave taken from employeeLeaveBalanceDetails.
 */
export const getCompOffleaveBalance = async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    const {empUuid} = req.query as {empUuid: string};

    if (!empUuid) {
        res.status(400).json({
            status: "error",
            message: "Employee UUID is required"
        });
        return;
    }

    // Allow users to view their own comp off balance without permission
    // But require permission to view other employees' balance
    const isViewingOwnBalance = employeeUuid === empUuid;
    
    if (!isViewingOwnBalance) {
        // Check for either read or write permission (users who can edit should be able to view)
        const hasReadPermission = await checkHrmsPermission(
            employeeUuid,
            "LeaveAttendanceAdmin_read",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );
        const hasWritePermission = await checkHrmsPermission(
            employeeUuid,
            "LeaveAttendance_write",
            toolName,
            toolsAccess as Record<string, number> | undefined
        );
        
        if (!hasReadPermission && !hasWritePermission) {
            res.status(403).json({
                status: "error",
                message: "You don't have permission to view other employees' comp off balance"
            });
            return;
        }
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch all comp off leaves (approved, not deleted)
        const allCompOffLeaves = await dbOutput.employeeExtraWorkDay.findAll({
            where: {
                empUuid,
                approvalStatus: LeaveApprovalStatus.APPROVED,
                isDeleted: false
            },
            order: [['workDate', 'ASC'], ['createdAt', 'ASC']],
            raw: true
        });

        // Calculate allotted leaves based on the logic
        let totalAllotted = 0;
        const compOffDetails = allCompOffLeaves.map((leave: extraWorkDayAttributes) => {
            const credit = leave.totalCompOffCredit || 0;
            const used = leave.totalCompOffUsed || 0;
            const expiryDate = leave.compOffExpiryDate ? new Date(leave.compOffExpiryDate) : null;
            const isExpired = expiryDate ? expiryDate < today : false;

            let allotted = 0;
            const usedNum = typeof used === 'string' ? parseFloat(used) || 0 : (used || 0);
            if (!isExpired) {
                // Not expired: count full credit as allotted
                allotted = credit;
            } else {
                // Expired: count only used amount if used, otherwise 0
                if (usedNum > 0) {
                    allotted = usedNum;
                } else {
                    allotted = 0;
                }
            }

            totalAllotted += allotted;

            return {
                ...leave,
                allotted,
                isExpired
            };
        });

        // Fetch job details for fiscal year calculation
        const jobDetails = await fetchEmployeeCurrentJobDetails(empUuid);
        const { fiscalYearStart } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, today);

        // Fetch total leave taken from employeeLeaveBalanceDetails for comp off leave type
        // First, find comp off leave config ID
        const compOffLeaveConfig = await dbOutput.employeeLeaveConfigurator.findOne({
            where: {
                [Op.and]: [
                    outputSequelize.where(
                        outputSequelize.fn('LOWER', outputSequelize.col('leaveType')),
                        { [Op.like]: '%comp%' }
                    ),
                    { isActive: true }
                ]
            },
            raw: true
        });

        let totalLeaveTaken = 0;
        if (compOffLeaveConfig) {
            const leaveBalance = await fetchLeaveBalanceDetails(jobDetails, fiscalYearStart, [compOffLeaveConfig.leaveConfigId]);
            if (leaveBalance && leaveBalance.length > 0) {
                totalLeaveTaken = leaveBalance[0].totalLeaveUsed || 0;
            }
        }

        res.status(200).json({
            success: true,
            message: "Comp off leave balance fetched successfully",
            compOffleaveBalance: {
                totalAllotted,
                totalLeaveTaken,
                compOffDetails
            }
        });
    } catch (error) {
        console.error("Error in getCompOffleaveBalance:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
}

/**
 * API to register comp off leave for an employee.
 * Similar to registerAttendance but with direct approval flow and no accrual rate logic.
 * Updates employeeleaverequestdetails, employeeleavebalancedetails, employeeattendancedetails,
 * and marks isCompOffUsed in employee_extra_work_day for oldest non-expired comp off leaves.
 */
export const registerCompOffLeave = async (req: Request, res: Response) => {
    try {
        // Extract user info from request (for permission checks)
    const { user } = req as AuthenticatedRequest;
        const { email, toolsAccess } = user as { email: string, toolsAccess: unknown };

        // Get employee UUID from params and leave details from body
        const employeeId = req.params.empUuid as string;
        const leaveDetails = req.body as EmployeeAttendanceRequestPayload;
        const {
            attendanceStatus,
            startDate,
            endDate,
            leaveConfigId,
            remarks,
            attachmentPath
        } = leaveDetails;

        // Fetch employee details and config before transaction for email (needed outside transaction)
        const basicDetailsForEmail = await fetchEmployeeBasicDetails(employeeId);
        const configDetailsForEmail = await fetchLeaveConfigDetails(leaveConfigId!);
        
        if (!configDetailsForEmail) {
            sendError(res, "Leave configuration not found");
            return;
        }

        // Start a DB transaction for atomicity
        await outputSequelize.transaction(async (transaction) => {
            // Get the UUID of the user making the request
            const { empUuid }: { empUuid: string } = await fetchEmployeeContactDetailsFromEmail(email);

            // Only users with LeaveAttendance_write can register comp off leave for other employees
            const canRegisterForOthers = await checkHrmsPermission(
                empUuid,
                "LeaveAttendance_write",
                hrmsConstants.HR_REPOSITORY,
                toolsAccess as Record<string, number> | undefined
            );
            if (!canRegisterForOthers && empUuid !== employeeId) {
                sendError(
                    res,
                    "You do not have the access. Only admin and super admin can register comp off leave for other employees",
                );
                return;
            }

            // Validate required fields
            const required = ["attendanceStatus", "leaveConfigId", "startDate", "endDate"];
            const missingFields = required.filter(
                (field) => !leaveDetails?.[field],
            );
            if (missingFields.length > 0) {
                sendError(
                    res,
                    `Missing required data: ${missingFields.join(", ")}`,
                );
                return;
            }

            // Validate leave dates
            if (!isValidDate(startDate!) || !isValidDate(endDate!)) {
                sendError(res, "Invalid startDate or endDate format");
                return;
            }

            if (new Date(startDate!) > new Date(endDate!)) {
                sendError(res, "Start date cannot be after end date");
                return;
            }

            // Fetch mandatory holidays in the range
            const mandatoryLeaves = await fetchMandatoryLeavesInRange(new Date(startDate!), new Date(endDate!));

            // Prepare list of holiday dates for exclusion logic
            const holidayDatesList = mandatoryLeaves.map((holiday: EmployeeHolidayDetailsAttributes) => holiday.eventDate);
            const {
                excludePaidWeekend,
                employeeType: employeeTypeRaw,
                appliedGender: appliedGenderRaw,
                isActive,
                isHalfDayAllowed,
                continuousLeavesLimit,
            } = configDetailsForEmail;

            // Parse JSON strings for employeeType and appliedGender
            const employeeType = typeof employeeTypeRaw === 'string' 
                ? JSON.parse(employeeTypeRaw || '[]') 
                : employeeTypeRaw || [];
            const appliedGender = typeof appliedGenderRaw === 'string'
                ? JSON.parse(appliedGenderRaw || '[]')
                : appliedGenderRaw || [];

            // Adjust start and end dates to skip holidays/weekends if needed
            const { start, end } = adjustStartAndEndDate(startDate!, endDate!, excludePaidWeekend, holidayDatesList);

            // Fetch overlapping leaves, job details, and basic details in parallel
            const [
                overlappingLeaves,
                jobDetails,
                basicDetails,
            ] = await Promise.all([
                fetchOverLappingLeaves(employeeId, start, end),
                fetchEmployeeCurrentJobDetails(employeeId, transaction),
                fetchEmployeeBasicDetails(employeeId),
            ]);

            const {overlappingLeaveAttendances, overlappingLeaveRequests} = overlappingLeaves;

            // Determine if this is a half-day leave
            const isHalfDay = attendanceStatus === AttendanceStatusType.HALF_DAY;

            // Calculate total leave days (excluding weekends/holidays if needed)
            let totalDays: number = isHalfDay
                ? 0.5
                : Math.floor(
                      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
                  ) + 1;
            if (!isHalfDay && excludePaidWeekend) {
                totalDays = countWeekdays(start, end);
                totalDays -= mandatoryLeaves.length;
            }

            // Config and business validations
            if (!isActive) {
                sendError(res, "This leave is not active");
                return;
            }
            if (isHalfDay && !isHalfDayAllowed) {
                sendError(res, "Half day not allowed for this leave");
                return;
            }
            if (!employeeType.includes(jobDetails.empType)) {
                sendError(res, "Leave not applicable to your position");
                return;
            }
            if (!appliedGender.includes(basicDetails.empGender)) {
                sendError(res, "Leave not applicable to your gender");
                return;
            }

            // Check for overlapping leaves
            if (overlappingLeaveAttendances.length > 0 || overlappingLeaveRequests.length > 0) {
                // Fetch leaveRequestIds from overlappingLeaveAttendances
                const leaveRequestIds = overlappingLeaveAttendances
                    .map(a => a.leaveRequestId)
                    .filter(Boolean);

                // leaveRequestDetails - already approved leaves
                // applicableLeaveTypes - leave types applicable to the employee
                const [leaveRequestDetails, applicableLeaveTypes] = await Promise.all([
                    fetchLeaveRequestDetailsFromLeaveId(leaveRequestIds as string[]),
                    dbOutput.employeeLeaveConfigurator.findAll({
                        where: {
                            employeeType: { [Op.like]: `%${jobDetails.empType}%` },
                            isActive: true
                        },
                        raw: true
                    })
                ]);

                // Create a set of leaveConfigIds from both existing leaves and overlapping requests
                const leaveConfigIds = new Set([
                    ...leaveRequestDetails.map(r => r?.leaveConfigId).filter(Boolean),
                    ...overlappingLeaveRequests.map(r => r?.leaveConfigId).filter(Boolean)
                ]);

                // If any overlapping leaves exist, check if they are of the same leave type
                const hasOverlap = applicableLeaveTypes.some(type => leaveConfigIds.has(type.leaveConfigId));

                // If there is an overlap, return an error
                if (hasOverlap) {
                    sendError(res, "Leave overlaps with existing ones");
                    return;
                }
            }

            // Fetch available comp off leaves (oldest non-expired first)
            // Include leaves that are partially used (totalCompOffUsed < totalCompOffCredit)
            const availableCompOffLeaves = await dbOutput.employeeExtraWorkDay.findAll({
                where: {
                    empUuid: employeeId,
                    approvalStatus: LeaveApprovalStatus.APPROVED,
                    isDeleted: false,
                    compOffExpiryDate: {
                        [Op.gte]: new Date()
                    },
                    [Op.or]: [
                        { totalCompOffUsed: null },
                        { totalCompOffUsed: 0 },
                        {
                            [Op.and]: [
                                { totalCompOffUsed: { [Op.ne]: null } },
                                outputSequelize.where(
                                    outputSequelize.col('totalCompOffUsed'),
                                    Op.lt,
                                    outputSequelize.col('totalCompOffCredit')
                                )
                            ]
                        }
                    ]
                },
                order: [['workDate', 'ASC'], ['createdAt', 'ASC']], // Oldest workDate first, then oldest createdAt
                raw: true
            });

            // Calculate total available comp off credit (considering partial usage)
            const totalAvailableCredit = availableCompOffLeaves.reduce(
                (sum, leave) => {
                    const credit = leave.totalCompOffCredit || 0;
                    const used = leave.totalCompOffUsed || 0;
                    return sum + (credit - used);
                },
                0
            );

            // Calculate paid and unpaid days
            const paidDays = Math.min(totalDays, totalAvailableCredit);
            const unpaidDays = Math.max(0, totalDays - paidDays);

            // Check continuous leave limit (CDL)
            const previousLeaveDetails = await getLeavesDetailsOfPastDays(employeeId, start, continuousLeavesLimit);
            const sameTypeLeaves = previousLeaveDetails.filter(leave => leave.leaveConfigId === leaveConfigId);
            const isAdmin = await checkHrmsPermission(
                empUuid,
                "LeaveAttendance_write",
                hrmsConstants.HR_REPOSITORY,
                toolsAccess as Record<string, number> | undefined
            );

            // Apply CDL restrictions for non-admin users
            let finalPaidDays = paidDays;
            let finalUnpaidDays = unpaidDays;
            
            if (!isAdmin && (totalDays > continuousLeavesLimit || sameTypeLeaves.length >= continuousLeavesLimit)) {
                const maxContinuousPaid = Math.min(paidDays, continuousLeavesLimit);
                const excessDays = paidDays - maxContinuousPaid;
                
                // Adjust paid/unpaid based on CDL
                finalPaidDays = maxContinuousPaid;
                finalUnpaidDays = unpaidDays + excessDays;
            }

            // Mark comp off leaves as used, starting from oldest, with partial usage tracking
            let remainingDays = finalPaidDays; // Only use comp off for paid days
            const compOffLeavesToUpdate: Array<{ extraWorkDayId: string; newTotalCompOffUsed: number }> = [];

            for (const compOffLeave of availableCompOffLeaves) {
                if (remainingDays <= 0) break;

                const credit = compOffLeave.totalCompOffCredit || 0;
                const used = compOffLeave.totalCompOffUsed || 0;
                const available = credit - used;

                if (available > 0) {
                    const toUse = Math.min(remainingDays, available);
                    const newTotalCompOffUsed = used + toUse;
                    
                    compOffLeavesToUpdate.push({
                        extraWorkDayId: compOffLeave.extraWorkDayId,
                        newTotalCompOffUsed: newTotalCompOffUsed
                    });
                    
                    remainingDays -= toUse;
                }
            }

            // Update comp off leaves with new totalCompOffUsed values
            for (const updateItem of compOffLeavesToUpdate) {
                await dbOutput.employeeExtraWorkDay.update(
                    { totalCompOffUsed: updateItem.newTotalCompOffUsed },
                    {
                        where: {
                            extraWorkDayId: updateItem.extraWorkDayId
                        },
                        transaction
                    }
                );
            }

            // Find unpaid leave config if unpaid days exist
            let unpaidLeaveConfigId: string | undefined;
            if (finalUnpaidDays > 0) {
                const unpaidLeaveConfig = await dbOutput.employeeLeaveConfigurator.findOne({
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
                
                if (!unpaidLeaveConfig) {
                    sendError(res, "Unpaid leave configuration not found");
                    return;
                }
                unpaidLeaveConfigId = unpaidLeaveConfig.leaveConfigId;
            }

            // Prepare paid leave request data (comp off)
            let paidLeaveData: EmployeeLeaveRequestAttributes | null = null;
            if (finalPaidDays > 0) {
                // For half-day, endDate should be same as startDate
                const paidEndDate = isHalfDay ? start : (finalUnpaidDays > 0 ? addDays(start, finalPaidDays - 1) : end);
                paidLeaveData = {
                    leaveRequestId: await createUUIDV4(),
                    empUuid: employeeId,
                    leaveConfigId: leaveConfigId!,
                    startDate: start,
                    endDate: paidEndDate,
                    totalDays: finalPaidDays,
                    isHalfDay: isHalfDay && finalPaidDays === 0.5,
                    remarks,
                    attachmentPath,
                    approvalStatus: LeaveApprovalStatus.APPROVED,
                    approvedBy: empUuid,
                    approvalDate: new Date()
                };
            }

            // Prepare unpaid leave request data
            let unpaidLeaveData: EmployeeLeaveRequestAttributes | null = null;
            if (finalUnpaidDays > 0 && unpaidLeaveConfigId) {
                // For half-day unpaid, endDate should be same as startDate
                const unpaidStartDate = isHalfDay ? start : (finalUnpaidDays > 0 ? addDays(start, finalPaidDays) : start);
                const unpaidEndDate = isHalfDay ? start : end;
                unpaidLeaveData = {
                    leaveRequestId: await createUUIDV4(),
                    empUuid: employeeId,
                    leaveConfigId: unpaidLeaveConfigId,
                    startDate: unpaidStartDate,
                    endDate: unpaidEndDate,
                    totalDays: finalUnpaidDays,
                    isHalfDay: isHalfDay && finalUnpaidDays === 0.5,
                    remarks,
                    attachmentPath,
                    approvalStatus: LeaveApprovalStatus.APPROVED,
                    approvedBy: empUuid,
                    approvalDate: new Date()
                };
            }

            // Create leave requests (paid and/or unpaid) as needed
            if (paidLeaveData && paidLeaveData.totalDays > 0) {
                await createLeaveRequestHelper(
                    paidLeaveData,
                    excludePaidWeekend,
                    jobDetails,
                    false, // isPending = false (direct approval)
                    transaction
                );
            }
            
            if (unpaidLeaveData && unpaidLeaveData.totalDays > 0) {
                await createLeaveRequestHelper(
                    unpaidLeaveData,
                    excludePaidWeekend,
                    jobDetails,
                    false, // isPending = false (direct approval)
                    transaction
                );
            }

            // Update employee payslip status for unpaid leave if needed
            if (finalUnpaidDays > 0 && paidLeaveData && unpaidLeaveData) {
                await updateEmployeePayslipStatusForUnpaidLeave(employeeId, paidLeaveData, unpaidLeaveData, transaction);
            }

            res.status(200).json({
                success: true,
                message: "Comp off leave applied and approved successfully",
            });
            return;
        });

        // Send email notification to HR admins asynchronously (after transaction commits)
        setImmediate(async () => {
            try {
                const hrAdmin = await findHRRepositoryToolAdminUsers();
                const emailRecipients = await Promise.all(
                    hrAdmin.map(async (admin) => await fetchEmployeeContactDetailsFromEmail(admin.email))
                );

                // Send email to each HR admin (not blocking, no transaction)
                emailRecipients.forEach(async (recipient) => {
                    if (recipient?.empOfficialEmail) {
                        const startDateStr = new Date(startDate!).toISOString().split('T')[0];
                        const endDateStr = new Date(endDate!).toISOString().split('T')[0];
                        const finalEndDate = startDateStr === endDateStr ? null : endDateStr;

                        LeaveRequestMail(
                            recipient.empOfficialEmail,
                            recipient.empUuid,
                            `${basicDetailsForEmail.empFirstName} ${basicDetailsForEmail.empLastName}`,
                            startDateStr,
                            finalEndDate,
                            configDetailsForEmail.leaveType,
                            true, // approved
                            undefined // no transaction
                        ).catch(err => console.error("Error sending comp off leave email:", err));
                    }
                });
            } catch (err) {
                console.error("Error sending comp off leave notification emails:", err);
            }
        });

        return;
    } catch (err) {
        console.error("Error in registerCompOffLeave", err);
        sendError(res, "An unexpected error occurred");
        return;
    }
};

/**
 * API to get comp off leave eligibility for a date range.
 * Calculates paid (from available comp off) and unpaid days.
 * Checks CDL, notice period, and other validations.
 */
export const getCompOffLeaveEligibility = async (req: Request, res: Response) => {
    try {
        const { user } = req as AuthenticatedRequest;
        const { toolsAccess, email } = user as { toolsAccess: unknown; email: string };

        const { empUuid, startDate, endDate, isHalfDay: isHalfDayParam } = req.query as {
            empUuid: string;
            startDate: string;
            endDate?: string;
            isHalfDay?: string;
        };

        if (!empUuid || !startDate) {
        res.status(400).json({
                success: false,
                message: "Employee UUID and start date are required"
        });
        return;
    }

        // Validate start date
        if (!isValidDate(startDate)) {
            res.status(400).json({
                success: false,
                message: "Invalid start date format"
            });
            return;
        }

        // If endDate is not provided, default to startDate
        const finalEndDate = endDate || startDate;

        // Validate end date if provided
        if (endDate && !isValidDate(endDate)) {
            res.status(400).json({
                success: false,
                message: "Invalid end date format"
            });
            return;
        }

        if (new Date(startDate) > new Date(finalEndDate)) {
            res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
            return;
        }

        // Get the UUID of the user making the request
        const { empUuid: requestorEmpUuid } = await fetchEmployeeContactDetailsFromEmail(email);

        // Only users with LeaveAttendanceAdmin_read can check eligibility for other employees
        const canViewOthersEligibility = await checkHrmsPermission(
            requestorEmpUuid,
            "LeaveAttendanceAdmin_read",
            hrmsConstants.HR_REPOSITORY,
            toolsAccess as Record<string, number> | undefined
        );
        if (!canViewOthersEligibility && requestorEmpUuid !== empUuid) {
            res.status(403).json({
                success: false,
                message: "You do not have access to check eligibility for other employees"
            });
            return;
        }

        const start = new Date(startDate);
        const end = new Date(finalEndDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // Determine if this is a half-day leave
        const isHalfDay = isHalfDayParam === 'true' || isHalfDayParam === '1';

        // Fetch employee details and comp off leave config in parallel
        const [jobDetails, basicDetails, compOffLeaveConfig] = await Promise.all([
            fetchEmployeeCurrentJobDetails(empUuid),
            fetchEmployeeBasicDetails(empUuid),
            dbOutput.employeeLeaveConfigurator.findOne({
                where: {
                    [Op.and]: [
                        outputSequelize.where(
                            outputSequelize.fn('LOWER', outputSequelize.col('leaveType')),
                            { [Op.like]: '%comp%' }
                        ),
                        { isActive: true }
                    ]
                },
                raw: true
            })
        ]);

        if (!compOffLeaveConfig) {
            res.status(400).json({
                success: false,
                message: "Comp off leave configuration not found"
            });
            return;
        }

        // Fetch mandatory holidays in the range
        const mandatoryLeaves = await fetchMandatoryLeavesInRange(new Date(startDate), new Date(finalEndDate));
        const holidayDatesList = mandatoryLeaves.map((holiday: EmployeeHolidayDetailsAttributes) => holiday.eventDate);
        
        // Get excludePaidWeekend from config
        const excludePaidWeekend = compOffLeaveConfig.excludePaidWeekend || false;

        // Adjust start and end dates to skip holidays/weekends if needed
        const { start: adjustedStart, end: adjustedEnd } = adjustStartAndEndDate(startDate, finalEndDate, excludePaidWeekend, holidayDatesList);

        // Calculate total days requested (excluding weekends/holidays if needed)
        let totalDays: number;
        if (isHalfDay) {
            totalDays = 0.5;
        } else {
            totalDays = Math.floor((adjustedEnd.getTime() - adjustedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            if (excludePaidWeekend) {
                totalDays = countWeekdays(adjustedStart, adjustedEnd);
                totalDays -= mandatoryLeaves.length;
            }
        }

        // Parse employeeType and appliedGender
        const employeeType = typeof compOffLeaveConfig.employeeType === 'string'
            ? JSON.parse(compOffLeaveConfig.employeeType || '[]')
            : compOffLeaveConfig.employeeType || [];
        const appliedGender = typeof compOffLeaveConfig.appliedGender === 'string'
            ? JSON.parse(compOffLeaveConfig.appliedGender || '[]')
            : compOffLeaveConfig.appliedGender || [];

        // Check if comp off is applicable to employee
        if (!employeeType.includes(jobDetails.empType)) {
            res.status(400).json({
                success: false,
                message: "Comp off leave not applicable to your position"
            });
            return;
        }
        if (!appliedGender.includes(basicDetails.empGender)) {
            res.status(400).json({
                success: false,
                message: "Comp off leave not applicable to your gender"
            });
            return;
        }

        // Fetch available comp off balance (not expired, not fully used)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const availableCompOffLeaves = await dbOutput.employeeExtraWorkDay.findAll({
            where: {
                empUuid,
                approvalStatus: LeaveApprovalStatus.APPROVED,
                isDeleted: false,
                compOffExpiryDate: {
                    [Op.gte]: today
                },
                [Op.or]: [
                    { totalCompOffUsed: null },
                    { totalCompOffUsed: 0 },
                    {
                        [Op.and]: [
                            { totalCompOffUsed: { [Op.ne]: null } },
                            outputSequelize.where(
                                outputSequelize.col('totalCompOffUsed'),
                                Op.lt,
                                outputSequelize.col('totalCompOffCredit')
                            )
                        ]
                    }
                ]
            },
            order: [['workDate', 'ASC'], ['createdAt', 'ASC']],
            raw: true
        });

        // Calculate available comp off credit
        const availableCompOffCredit = availableCompOffLeaves.reduce(
            (sum, leave) => {
                const credit = leave.totalCompOffCredit || 0;
                const used = leave.totalCompOffUsed || 0;
                return sum + (credit - used);
            },
            0
        );

        // Calculate paid and unpaid days based on available comp off credit
        const paidDays = Math.min(totalDays, availableCompOffCredit);
        const unpaidDays = Math.max(0, totalDays - paidDays);

        // Check notice period (use original start date from user input, not adjusted)
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const originalStart = new Date(startDate);
        originalStart.setHours(0, 0, 0, 0);
        const startDiffDays = getDateDiffInDays(todayDate, originalStart);
        const minimumNoticePeriod = compOffLeaveConfig.minimumNoticePeriod || 0;
        const maximumNoticePeriod = compOffLeaveConfig.maximumNoticePeriod || 365;

        let noticePeriodValid = true;
        let noticePeriodMessage = '';
        const hasLeaveWritePermission = await checkHrmsPermission(
            requestorEmpUuid,
            "LeaveAttendance_write",
            hrmsConstants.HR_REPOSITORY,
            toolsAccess as Record<string, number> | undefined
        );
        if (!hasLeaveWritePermission) {
            if (originalStart.getTime() >= todayDate.getTime() && startDiffDays < minimumNoticePeriod) {
                noticePeriodValid = false;
                noticePeriodMessage = `Minimum notice period of ${minimumNoticePeriod} days not satisfied`;
            } else if (originalStart.getTime() < todayDate.getTime() && startDiffDays > maximumNoticePeriod) {
                noticePeriodValid = false;
                noticePeriodMessage = `Maximum notice period of ${maximumNoticePeriod} days not satisfied`;
            }
        }

        // Check continuous leave limit (CDL) - use adjusted start date
        const continuousLeavesLimit = compOffLeaveConfig.continuousLeavesLimit || 0;
        const previousLeaveDetails = await getLeavesDetailsOfPastDays(empUuid, adjustedStart, continuousLeavesLimit);
        const sameTypeLeaves = previousLeaveDetails.filter(leave => leave.leaveConfigId === compOffLeaveConfig.leaveConfigId);
        const isAdmin = hasLeaveWritePermission;
        
        // Apply CDL restrictions for non-admin users
        // If totalDays exceeds CDL or previous leaves + current request would exceed CDL, adjust paid/unpaid
        let cdlValid = true;
        let cdlMessage = '';
        let finalPaidDays = paidDays;
        let finalUnpaidDays = unpaidDays;
        
        if (!isAdmin && continuousLeavesLimit > 0) {
            // Check if current request exceeds CDL
            if (totalDays > continuousLeavesLimit || sameTypeLeaves.length >= continuousLeavesLimit) {
                const maxContinuousPaid = Math.min(paidDays, continuousLeavesLimit);
                const excessDays = paidDays - maxContinuousPaid;
                
                // Adjust paid/unpaid based on CDL
                finalPaidDays = maxContinuousPaid;
                finalUnpaidDays = unpaidDays + excessDays;
                
                if (totalDays > continuousLeavesLimit) {
                    cdlValid = false;
                    cdlMessage = `Continuous leave limit of ${continuousLeavesLimit} days exceeded. Only ${maxContinuousPaid} days will be paid, rest will be unpaid.`;
                } else if (sameTypeLeaves.length >= continuousLeavesLimit) {
                    cdlValid = false;
                    cdlMessage = `Continuous leave limit of ${continuousLeavesLimit} days already used. All ${totalDays} days will be unpaid.`;
                    // If previous leaves already hit the limit, all current days should be unpaid
                    finalPaidDays = 0;
                    finalUnpaidDays = totalDays;
                }
            } else if (sameTypeLeaves.length + totalDays > continuousLeavesLimit) {
                // Current request + previous leaves would exceed CDL
                const remainingCDL = continuousLeavesLimit - sameTypeLeaves.length;
                const maxContinuousPaid = Math.min(paidDays, remainingCDL);
                const excessDays = paidDays - maxContinuousPaid;
                
                finalPaidDays = maxContinuousPaid;
                finalUnpaidDays = unpaidDays + excessDays;
                
                cdlValid = false;
                cdlMessage = `Continuous leave limit of ${continuousLeavesLimit} days will be exceeded. Only ${maxContinuousPaid} days will be paid, rest will be unpaid.`;
            }
        }

        // Check overlapping leaves (use adjusted dates)
        const overlappingLeaves = await fetchOverLappingLeaves(empUuid, adjustedStart, adjustedEnd);
        const hasOverlap = overlappingLeaves.overlappingLeaveAttendances.length > 0 || 
                          overlappingLeaves.overlappingLeaveRequests.length > 0;

        res.status(200).json({
            success: true,
            message: "Comp off leave eligibility calculated successfully",
            data: {
                totalDays,
                paidDays: finalPaidDays,
                unpaidDays: finalUnpaidDays,
                availableCompOffCredit,
                isEligible: noticePeriodValid && cdlValid && !hasOverlap,
                validations: {
                    noticePeriod: {
                        valid: noticePeriodValid,
                        message: noticePeriodMessage
                    },
                    continuousLeaveLimit: {
                        valid: cdlValid,
                        message: cdlMessage,
                        limit: continuousLeavesLimit,
                        used: sameTypeLeaves.length
                    },
                    overlappingLeaves: {
                        valid: !hasOverlap,
                        message: hasOverlap ? "Leave overlaps with existing leaves" : ""
                    }
                }
            }
        });
        return;

    } catch (error) {
        console.error("Error in getCompOffLeaveEligibility:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again later.",
            error: error instanceof Error ? error.message : error,
        });
        return;
    }
};

/**
 * API to update comp off leave when changed to another leave type or working status.
 * Restores comp off balance by updating totalCompOffUsed (newest first - reverse order).
 * Handles half day vs full day properly.
 */
export const updateCompOffLeave = async (req: Request, res: Response) => {
    try {
        // Extract user info from request (for permission checks)
        const { user } = req as AuthenticatedRequest;
        const { email, toolsAccess } = user as { email: string, toolsAccess: unknown };

        // Get attendanceId from params and update details from body
        const { attendanceId } = req.params as { attendanceId: string };
        const attendanceDetails: EmployeeAttendanceRequestPayload = req.body;
        const {
            attendanceStatus,
            leaveConfigId
        } = attendanceDetails;

        // Capture variables for email (outside transaction)
        let employeeIdForEmail: string | null = null;
        let existingLeaveConfigIdForEmail: string | null = null;
        let attendanceDateForEmail: Date | null = null;
        let attendanceStatusForEmail: string | null = null;

        // Start a DB transaction for atomicity
        await outputSequelize.transaction(async (transaction) => {
            // Get the UUID of the user making the request
            const { empUuid }: { empUuid: string } = await fetchEmployeeContactDetailsFromEmail(email);

            // Fetch the current attendance record
            const currentAttendance: EmployeeAttendanceAttributes = await fetchEmployeeAttendanceDetailsById(attendanceId, transaction);
            const employeeId = currentAttendance.empUuid;
            
            // Capture for email (outside transaction)
            employeeIdForEmail = employeeId;
            attendanceDateForEmail = currentAttendance.attendanceDate;
            attendanceStatusForEmail = attendanceStatus;

            // Only users with LeaveAttendance_write can update comp off leave for other employees
            const canUpdateOthersCompOff = await checkHrmsPermission(
                empUuid,
                "LeaveAttendance_write",
                hrmsConstants.HR_REPOSITORY,
                toolsAccess as Record<string, number> | undefined
            );
            if (!canUpdateOthersCompOff && empUuid !== employeeId) {
                sendError(
                    res,
                    "You do not have the access. Only admin and super admin can update comp off leave for other employees",
                );
                return;
            }

            // Must have a leave request to update
            if (!currentAttendance.leaveRequestId) {
                sendError(res, "Leave request not found");
                return;
            }

            // Fetch the existing leave request details
            const existingLeaveRequestDetails: EmployeeLeaveRequestAttributes[] = await fetchLeaveRequestDetailsFromLeaveId([currentAttendance.leaveRequestId]);
            if (!existingLeaveRequestDetails || existingLeaveRequestDetails.length === 0) {
                sendError(res, "Leave request details not found");
                return;
            }

            const existingLeaveRequest = existingLeaveRequestDetails[0];
            const existingLeaveConfigId = existingLeaveRequest.leaveConfigId;
            
            // Capture for email (outside transaction)
            existingLeaveConfigIdForEmail = existingLeaveConfigId;

            // Fetch leave config to check if it's a comp off leave
            const existingLeaveConfig = await fetchLeaveConfigDetails(existingLeaveConfigId);
            if (!existingLeaveConfig) {
                sendError(res, "Existing leave configuration not found");
                return;
            }

            // Check if the existing leave is a comp off leave (case-insensitive)
            const isCompOffLeave = existingLeaveConfig.leaveType?.toLowerCase().includes('comp') || 
                                   existingLeaveConfig.leaveType?.toLowerCase().includes('comp off');

            // Only proceed if it's a comp off leave being changed
            if (!isCompOffLeave) {
                sendError(res, "This is not a comp off leave");
                return;
            }

            // Get days to restore from the existing leave request
            const daysToRestore = existingLeaveRequest.totalDays;

            // Fetch job details for fiscal year calculation
            const jobDetails = await fetchEmployeeCurrentJobDetails(employeeId, transaction);

            // Fetch used comp off leaves (newest first - reverse order for restoration)
            const usedCompOffLeaves = await dbOutput.employeeExtraWorkDay.findAll({
                where: {
                    empUuid: employeeId,
                    approvalStatus: LeaveApprovalStatus.APPROVED,
                    isDeleted: false,
                    totalCompOffUsed: {
                        [Op.gt]: 0
                    }
                },
                order: [['workDate', 'DESC'], ['createdAt', 'DESC']], // Newest first (reverse of registration)
                raw: true
            });

            // Calculate total used comp off credit
            const totalUsedCredit = usedCompOffLeaves.reduce(
                (sum, leave) => sum + (leave.totalCompOffUsed || 0),
                0
            );

            // Check if we have enough used credit to restore
            if (totalUsedCredit < daysToRestore) {
                sendError(
                    res,
                    `Insufficient used comp off credit to restore. Used: ${totalUsedCredit}, Required: ${daysToRestore}`
                );
                return;
            }

            // Restore comp off leaves, starting from newest (reverse order)
            let remainingDaysToRestore = daysToRestore;
            const compOffLeavesToUpdate: Array<{ extraWorkDayId: string; newTotalCompOffUsed: number }> = [];

            for (const compOffLeave of usedCompOffLeaves) {
                if (remainingDaysToRestore <= 0) break;

                const used = compOffLeave.totalCompOffUsed || 0;
                if (used > 0) {
                    const toRestore = Math.min(remainingDaysToRestore, used);
                    const newTotalCompOffUsed = used - toRestore;
                    
                    compOffLeavesToUpdate.push({
                        extraWorkDayId: compOffLeave.extraWorkDayId,
                        newTotalCompOffUsed: newTotalCompOffUsed
                    });
                    
                    remainingDaysToRestore -= toRestore;
                }
            }

            // Update comp off leaves with restored values
            for (const updateItem of compOffLeavesToUpdate) {
                await dbOutput.employeeExtraWorkDay.update(
                    { totalCompOffUsed: updateItem.newTotalCompOffUsed },
                    {
                        where: {
                            extraWorkDayId: updateItem.extraWorkDayId
                        },
                        transaction
                    }
                );
            }

            // If changing to working status, restore leave balance for comp off and update attendance
            if (attendanceStatus === AttendanceStatusType.WORKING) {
                const fiscalYear = getFiscalYearForLeave(jobDetails?.empConversionDate, currentAttendance.attendanceDate);
                const { fiscalYearStart, fiscalYearEnd } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, currentAttendance.attendanceDate);

                // Restore leave balance (negative value to restore)
                await updateEmployeeLeaveBalance({
                    jobDetails: jobDetails,
                    leaveConfigId: existingLeaveConfigId,
                    totalLeaveUsed: -daysToRestore,
                    fiscalYear,
                    fiscalYearStart,
                    fiscalYearEnd,
                    transaction
                });

                // Update attendance record: set leaveRequestId to null when changing to working
                const { checkIn, checkOut, remarks } = attendanceDetails;
                if (checkIn && checkOut) {
                    const workHours: number = getHourDifference(checkIn, checkOut);
                    const attendanceUpdateData: Partial<EmployeeAttendanceAttributes> = {
                        checkIn,
                        checkOut,
                        workHours,
                        attendanceStatus: AttendanceStatusType.WORKING,
                        remarks: remarks || undefined,
                        leaveRequestId: null as unknown as string | undefined
                    };
                    await updateEmployeeAttendanceDetails(attendanceUpdateData, attendanceId, transaction);
                }
            } else if (leaveConfigId && leaveConfigId !== existingLeaveConfigId) {
                // Changing to a different leave type
                // Restore comp off leave balance first
                const fiscalYear = getFiscalYearForLeave(jobDetails?.empConversionDate, currentAttendance.attendanceDate);
                const { fiscalYearStart, fiscalYearEnd } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, currentAttendance.attendanceDate);

                // Restore comp off leave balance
                await updateEmployeeLeaveBalance({
                    jobDetails: jobDetails,
                    leaveConfigId: existingLeaveConfigId,
                    totalLeaveUsed: -daysToRestore,
                    fiscalYear,
                    fiscalYearStart,
                    fiscalYearEnd,
                    transaction
                });

                // The new leave type will be handled by the existing updateEmployeeAttendance function
                // which will be called after this function completes
            }

            res.status(200).json({
                success: true,
                message: "Comp off leave updated successfully",
            });
            return;
        });

        // Send email notification to HR admins asynchronously (after transaction commits)
        if (employeeIdForEmail && existingLeaveConfigIdForEmail && attendanceDateForEmail && attendanceStatusForEmail) {
            setImmediate(async () => {
                try {
                    // Fetch employee details for email
                    const employeeBasicDetails = await fetchEmployeeBasicDetails(employeeIdForEmail!);
                    const existingLeaveConfig = await fetchLeaveConfigDetails(existingLeaveConfigIdForEmail!);
                    
                    const hrAdmin = await findHRRepositoryToolAdminUsers();
                    const emailRecipients = await Promise.all(
                        hrAdmin.map(async (admin) => await fetchEmployeeContactDetailsFromEmail(admin.email))
                    );

                    // Send email to each HR admin (not blocking, no transaction)
                    emailRecipients.forEach(async (recipient) => {
                        if (recipient?.empOfficialEmail) {
                            const attendanceDateStr = attendanceDateForEmail!.toISOString().split('T')[0];
                            
                            LeaveRequestMail(
                                recipient.empOfficialEmail,
                                recipient.empUuid,
                                `${employeeBasicDetails.empFirstName} ${employeeBasicDetails.empLastName}`,
                                attendanceDateStr,
                                null, // single day
                                existingLeaveConfig?.leaveType || "Comp Off",
                                attendanceStatusForEmail === AttendanceStatusType.WORKING ? false : true, // false if changed to working, true if changed to another leave
                                undefined // no transaction
                            ).catch(err => console.error("Error sending comp off update email:", err));
                        }
                    });
                } catch (err) {
                    console.error("Error sending comp off update notification emails:", err);
                }
            });
        }

        return;
    } catch (err) {
        console.error("Error in updateCompOffLeave", err);
        sendError(res, "An unexpected error occurred");
        return;
    }
};