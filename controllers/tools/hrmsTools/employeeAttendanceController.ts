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
    EmployeeAttendanceAttributes, 
    EmployeeAttendanceRequestPayload, 
    EmployeeHolidayDetailsAttributes, 
    EmployeeLeaveBalanceAttributes, 
    EmployeeLeaveRequestAttributes, 
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
    fetchEmployeeCurrentJobDetails
} from "../../../utilities/hrmsUtilities/dbCalls";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";
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
        const { email, toolsAccess } = user as { email: string, toolsAccess: unknown }

        const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];

        // Get employee UUID from params and leave/attendance details from body
        const employeeId = req.params.empUuid;
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

        // Start a DB transaction for atomicity
        await outputSequelize.transaction(async (transaction) => {
            // Get the UUID of the user making the request
            const { empUuid }: { empUuid: string } = await fetchEmployeeContactDetailsFromEmail(email);

            // Only admin/super admin can register attendance for other employees
            if (userType < 500 && empUuid !== employeeId) {
                sendError(
                    res,
                    "You do not have the access. Only admin and super admin can change attendance of other employees",
                );
                return;
            }

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
            if(userType < 500) {
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
            if(configDetails.leaveType.toLowerCase() === "sick") isSickLeave = true;

            // used to check if the leave are in a continous manner
            // total leaves in past N days (N - continuousLeaveLimit)
            const previousLeaveDetails = await getLeavesDetailsOfPastDays(employeeId, start, continuousLeavesLimit);

            // Filter to only count leaves of the SAME TYPE as the current config
            const sameTypeLeaves = previousLeaveDetails.filter(leave => leave.leaveConfigId === leaveConfigId);

            // Check if user is admin (for CDL bypass)
            const isAdmin = userType >= 500;

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
            
            // Create leave requests (paid and/or unpaid) as needed
            if(paidLeaveData.totalDays > 0) await createLeaveRequestHelper(paidLeaveData, excludePaidWeekend, jobDetails, isPending, transaction);
            if(unpaidLeaveData.totalDays > 0) await createLeaveRequestHelper(unpaidLeaveData, excludePaidWeekend, jobDetails, isPending, transaction);

            if(!isPending){
               const hrAdmin =  await findHRRepositoryToolAdminUsers();
               const emailRecipients = await Promise.all(
                   hrAdmin.map(async (admin) => await fetchEmployeeContactDetailsFromEmail(admin.email))
               );
               
               // Send email to each HR admin
               await Promise.all(
                   emailRecipients.map(async (recipient) => {
                       if (recipient?.empOfficialEmail) {
                           const startDateStr = start.toISOString().split('T')[0];
                           const endDateStr = end.toISOString().split('T')[0];
                           const finalEndDate = startDateStr === endDateStr ? null : endDateStr;
                           
                           return LeaveRequestMail(
                               recipient.empOfficialEmail,
                               recipient.empUuid,
                               `${basicDetails.empFirstName} ${basicDetails.empLastName}`,
                               startDateStr,
                               finalEndDate,   
                               configDetails.leaveType,            
                               true,                               
                               transaction                         
                           );
                       }
                       return Promise.resolve();
                   })
               );
            } else {
               const hrAdmin =  await findHRRepositoryToolAdminUsers();
               const emailRecipients = await Promise.all(
                   hrAdmin.map(async (admin) => await fetchEmployeeContactDetailsFromEmail(admin.email))
               );
               
               await Promise.all(
                   emailRecipients.map(async (recipient) => {
                       if (recipient?.empOfficialEmail) {
                           const startDateStr = start.toISOString().split('T')[0];
                           const endDateStr = end.toISOString().split('T')[0];
                           const finalEndDate = startDateStr === endDateStr ? null : endDateStr;
                           
                           return LeaveRequestMail(
                               recipient.empOfficialEmail,
                               recipient.empUuid,
                               `${basicDetails.empFirstName} ${basicDetails.empLastName}`,
                               startDateStr,
                               finalEndDate,   
                               configDetails.leaveType,            
                               false,                               
                               transaction                         
                           );
                       }
                       return Promise.resolve();
                   })
               );
            }
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
        const employeeId: string = req.params.empUuid;
        const { month, year } = req.query as {
            month: string,
            year: string
        }

        // Extract user info for permission checks
        const { user } = req as AuthenticatedRequest;
        const { toolsAccess, email } = user as {
            toolsAccess: unknown,
            email: string
        };

        const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];

        const [empContactDetails, empJobDetails] = await Promise.all([
            // Fetch employee details for the logged-in user
            fetchEmployeeContactDetailsFromEmail(email),
            // Fetch employee job details
            fetchEmployeeCurrentJobDetails(employeeId),
        ]);

        const { empUuid } = empContactDetails as {
            empUuid: string
        }
        
        const conversionDate = new Date(empJobDetails.empConversionDate);

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

        // Only admin/super admin can view other employees' attendance
        if(userType < 500 && employeeId !== empUuid) {
            sendError(res, "You do not have the access. Only admin and super admin can view attendance of other employees");
            return;
        }

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
        const employeeId: string = req.params.empUuid;

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
        const { toolsAccess} = user as { toolsAccess: unknown};
        const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];

        if(userType < 500){
            sendError(res, "You are not allowed to do this action");
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
        const { toolsAccess } = user as { toolsAccess: unknown };
        const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];

        // Approver employee ID
        const employeeId: string = req.params.empUuid;
        const {
            leaveRequestIds,
            action,
        }: {
            leaveRequestIds: string[];
            action: LeaveApprovalStatus;
        } = req.body;

        if (userType < 500) {
            sendError(res, "You are not allowed to do this action");
            return;
        }

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
            //generate email notification on leave approval
            await approvedRejectedMailHelper(employeeDetails, leaveRequests, transaction, true);

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
        const employeeId: string = req.params.empUuid;

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
    const { toolsAccess } = user as { toolsAccess: unknown};
    const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];

    if(userType < 500){
        sendError(res, "You are not allowed to do this action");
        return;
    }

    const LeaveRequestId:string = req.params.leaveRequestId;

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
    const LeaveRequestId: string = req.params.leaveRequestId;
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
    const { toolsAccess, email} = user as { toolsAccess: unknown, email: string};
    const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];

    if(userType < 500 ){
        sendError(res, "You are not allowed to do this action");
        return;
    }

    const attendanceId: string = req.params.attendanceId;

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

    // Only admin/super admin can delete attendance for other employees
    const { empUuid } = (await fetchEmployeeContactDetailsFromEmail(
        email,
    )) as { empUuid: string };

    if (userType < 500 && empUuid !== attendanceDetails.empUuid) {
        sendError(
            res,
            "You are not allowed to do this action",
        );
        return;
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
        const { toolsAccess, email } = user as { toolsAccess: unknown; email: string };
        const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];

        // Extract attendanceId from params and attendance update payload from body
        const { attendanceId } = req.params as { attendanceId: string };
        const attendanceDetails: EmployeeAttendanceRequestPayload = req.body;

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

        // Start a DB transaction for atomicity
        await outputSequelize.transaction(async (transaction) => {
            // Fetch the current attendance record and employee UUID
            const attendanceDetails: EmployeeAttendanceAttributes = await fetchEmployeeAttendanceDetailsById(attendanceId, transaction);
            const employeeId = attendanceDetails.empUuid;
            // Get the UUID of the user making the request
            const { empUuid }: { empUuid: string } = await fetchEmployeeContactDetailsFromEmail(email);

            // Only admin/super admin can update attendance for other employees
            if (userType < 500 && attendanceDetails.attendanceStatus !== AttendanceStatusType.WORKING) {
                sendError(
                    res,
                    "You do not have the access. Only admin and super admin can change attendance of other employees",
                );
                return;
            }

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
                const attendanceUpdateData: Partial<EmployeeAttendanceAttributes> = {
                    checkIn, checkOut, workHours, attendanceStatus, remarks 
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
            if(userType < 500) {
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
            const isAdmin = userType >= 500

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

            // --- Leave goes into pending for users who violate CDL ---
            // Admin bypass for CDL is already handled above in the CDL logic
            const isPending: boolean = isProofRequired;

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
        const  employeeId: string  = req.params.empUuid;

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
        const applicableLeaveConfigs = await fetchApplicableLeaveConfigs(jobDetails.empType, basicDetails.empGender);

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
        const { email, toolsAccess } = user as { email: string, toolsAccess: unknown };
        const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];
        
        const employeeId = req.params.empUuid;
        const { leaveConfigId, asOfDate } = req.query as { leaveConfigId?: string, asOfDate?: string };

        // Get user's own UUID for permission check
        const { empUuid } = await fetchEmployeeContactDetailsFromEmail(email) as { empUuid: string };

        // Only admin/super admin can view other employees' balance
        if (userType < 500 && employeeId !== empUuid) {
            sendError(res, "You can only view your own leave balance");
            return;
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
        const applicableLeaveConfigs = await fetchApplicableLeaveConfigs(jobDetails.empType, basicDetails.empGender);

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
