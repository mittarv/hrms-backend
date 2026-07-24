import { Op, Transaction } from "sequelize";
import { AttendanceStatusType, payrollStatus } from "../../interfaces/hrmsTool/enum/hrmsEnum";
import { EmployeeAttendanceAttributes, EmployeeLeaveAttendanceAttributes, EmployeeLeaveBalanceAttributes, EmployeeLeaveRequestAttributes, employeePayslipAttributes, employeePayslipItemAttributes, LeaveConfigWithAccrual , EmployeeLeaveConfiguratorAttributes, EmployeeBasicDetailsAttributes } from "../../interfaces/hrmsTool/interface/hrmsInterface";
import { createUUIDV4 } from "../uuidV4Generator";
import { createEmployeeAttendanceRecord, createLeaveRequest, fetchAllLeaveConfigDetails, fetchEmployeeCurrentJobDetails, fetchEmployeeLeavesData, updateEmployeeAttendanceDetails, updateEmployeeLeaveBalance, } from "./dbCalls";
import { apporveRejectLeaveRequestMail } from "../../middlewares/sendEmail";
import { dbOutput, outputSequelize, sequelize } from "../../models";
// function to count week days between two dates
// ensure start and end are in date format
export const countWeekdays = (start: Date, end: Date) => {
    let count = 0;
    const tempDate: Date = new Date(start);

    while (tempDate <= end) {
      const day = tempDate.getDay(); 
      if (day !== 0 && day !== 6) {
        count++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    return count;
}

// function to validate a time string
// "hh:mm"
export const isValidTime = (time: string) => {
    return /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time);
}

// function to validate a date string
// "2025-02-12"
export const isValidDate = (date: string): boolean => {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
}

// function to calculate hours between two time strings
export const getHourDifference = (start: string, end: string) => {
    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);
  
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
  
    const diffMinutes = endMinutes - startMinutes;
    return (diffMinutes / 60)
}

// function to check if the day is weekend
export const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Helper to clone and add days to a date
export const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const createLeaveRequestHelper = async (leaveData: EmployeeLeaveRequestAttributes, excludePaidWeekend: boolean, jobDetails, isPending: boolean, transaction?: Transaction) => {
    // Create leave request record
    await createLeaveRequest(leaveData, transaction);

    // Return if leave is pending
    if(isPending) return;

    // Create attendance record for each leave day
    const attendanceList: EmployeeAttendanceAttributes[] = [];
    for (
        let d = new Date(leaveData.startDate);
        d <= leaveData.endDate;
        d.setDate(d.getDate() + 1)
    ) {
        if(excludePaidWeekend && isWeekend(d)) continue;

        attendanceList.push({
            attendanceId: await createUUIDV4(),
            empUuid: leaveData.empUuid,
            attendanceDate: new Date(d),
            attendanceStatus: leaveData.isHalfDay
                ? AttendanceStatusType.HALF_DAY
                : AttendanceStatusType.ON_LEAVE,
            remarks: leaveData.remarks,
            leaveRequestId: leaveData.leaveRequestId,
        });
    }

    const fiscalYear = getFiscalYearForLeave(jobDetails?.empConversionDate, leaveData.startDate);
    const { fiscalYearStart, fiscalYearEnd } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, leaveData.startDate);

    await Promise.all([
      createEmployeeAttendanceRecord(
        attendanceList,
        transaction
      ),
      updateEmployeeLeaveBalance({
        jobDetails,
        leaveConfigId: leaveData.leaveConfigId!,
        fiscalYear: fiscalYear,
        fiscalYearStart: fiscalYearStart,
        fiscalYearEnd: fiscalYearEnd,
        totalLeaveUsed: leaveData.totalDays,
        transaction: transaction
      })
    ]);
}

export const  adjustStartAndEndDate = (startDate: string, endDate: string, excludeWeekends: boolean, rawHolidays = []) => {
  const start: Date = new Date(startDate);
  const end: Date = new Date(endDate);

  const normalizeDate = (date: Date) => {
      if (!(date instanceof Date)) date = new Date(date);
      return date.toISOString().split('T')[0]; // Converts to 'YYYY-MM-DD'
  };

  // Convert raw holiday list to normalized set for faster lookup
  const holidaysSet = new Set(rawHolidays.map(normalizeDate));

  const isHoliday = (date: Date) => holidaysSet.has(normalizeDate(date));

  // Adjust start date forward
  while (
      (excludeWeekends && isWeekend(start)) ||
      isHoliday(start)
  ) {
      start.setDate(start.getDate() + 1);
  }

  // Adjust end date backward
  while (
      (excludeWeekends && isWeekend(end)) ||
      isHoliday(end)
  ) {
      end.setDate(end.getDate() - 1);
  }

  return {
      start: new Date(start),
      end: new Date(end),
  };
}


export const updateAttendanceAndBalance = async (
  leaveData: EmployeeLeaveRequestAttributes,
  previousLeaveReqDetails: EmployeeLeaveRequestAttributes,
  isPending: boolean, attendanceDetails: EmployeeAttendanceAttributes,
  jobDetails,
  transaction?: Transaction
) => {
  await createLeaveRequest(leaveData, transaction);

  if(isPending) return;

  const attendanceUpdateData: Partial<EmployeeAttendanceAttributes> = {
    checkIn: leaveData.checkIn,
    checkOut: leaveData.checkOut,
    attendanceStatus: leaveData.isHalfDay ? AttendanceStatusType.HALF_DAY : AttendanceStatusType.ON_LEAVE,
    remarks: leaveData.remarks,
    leaveRequestId: leaveData.leaveRequestId
  }

  // --- check if leave already exists on that day ---
  const leaveExists = attendanceDetails.attendanceStatus != AttendanceStatusType.WORKING;

  // --- calculate number of days to recover based on premous leave data ---
  const daysDecrease  = (leaveExists && previousLeaveReqDetails.isHalfDay) ? -0.5 : -1;

  // --- calculate fiscal year for the leave start date ---
  const fiscalYear = getFiscalYearForLeave(jobDetails?.empConversionDate, leaveData?.startDate);

  // --- fiscal year start and end based on leave start date ---
  const { fiscalYearStart, fiscalYearEnd } = getFiscalYearStartAndEndDate(jobDetails?.empConversionDate, leaveData?.startDate);

  await Promise.all([
    updateEmployeeAttendanceDetails(attendanceUpdateData, attendanceDetails.attendanceId, transaction),
    updateEmployeeLeaveBalance({
      jobDetails,
      leaveConfigId: leaveData.leaveConfigId,
      totalLeaveUsed: leaveData.totalDays,
      fiscalYear,
      fiscalYearStart,
      fiscalYearEnd,
      transaction
    }),
    leaveExists
      ? updateEmployeeLeaveBalance({
          jobDetails,
          leaveConfigId: previousLeaveReqDetails.leaveConfigId,
          totalLeaveUsed: daysDecrease,
          fiscalYear,
          fiscalYearStart,
          fiscalYearEnd,
          transaction
        })
      : Promise.resolve()
  ]);
}


/**
 * Fetches the leave attendance details for an employee for the past given number of days up to a specified end date.
 * 
 * @param employeeId - The UUID of the employee whose leave details are to be fetched.
 * @param endDate - The end date of the range (inclusive).
 * @param days - The number of days to look back from the end date.
 * @returns Promise resolving to an array of EmployeeLeaveAttendanceAttributes within the specified date range.
 */
export const getLeavesDetailsOfPastDays = async (
  employeeId: string,
  endDate: Date,
  days: number,
) => {
  // Calculate the start date by subtracting 'days' from the end date
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  // Fetch leave attendance details for the employee within the date range
  const empAttendanceDetails: EmployeeLeaveAttendanceAttributes[] =
    await fetchEmployeeLeavesData(employeeId, startDate, endDate);

  // Return the fetched attendance details
  return empAttendanceDetails;
}

export const getDateDiffInDays = (date1: Date, date2: Date): number  => {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());

  const msInDay = 1000 * 60 * 60 * 24;
  const diff: number = d1.getTime() - d2.getTime();
  return Math.abs(diff / msInDay);
}

export const getFiscalYearForLeave = (empConversionDate: Date | string | undefined | null, leaveDate: Date): number => {
  let parsedConversionDate = empConversionDate ? new Date(empConversionDate) : null;
  if (!parsedConversionDate || isNaN(parsedConversionDate.getTime())) {
    parsedConversionDate = new Date(leaveDate.getFullYear(), 0, 1);
  }

  const hireDay = parsedConversionDate.getDate();
  const hireMonth = parsedConversionDate.getMonth() + 1;

  const leaveDay = leaveDate.getDate();
  const leaveMonth = leaveDate.getMonth() + 1;
  const leaveYear = leaveDate.getFullYear();

  // If leave is before the join anniversary this year, subtract 1 from year
  if (leaveMonth < hireMonth || (leaveMonth === hireMonth && leaveDay < hireDay)) {
      return leaveYear - 1;
  }
  
  return leaveYear;
}
export const generateUpdateMessage = function(changes) {
  const sectionMap = {
    'basic-info': 'Basic Information',
    'compensation': 'Compensation & Payment',
    'other-info': 'Other Information'
  };

  // Extract changed sections
  const changedSections = changes.map(change => Object.keys(change)[0]);

  const readableSections = changedSections.map(section => sectionMap[section]);

  let message = 'Your ';
  if (readableSections.length === 1) {
    message += `${readableSections[0]} details has been updated by Admin`;
  } else if (readableSections.length === 2) {
    message += `${readableSections[0]} and ${readableSections[1]} details has been updated by Admin`;
  } else if (readableSections.length === 3) {
    message += `${readableSections[0]}, ${readableSections[1]} and ${readableSections[2]} details has been updated by Admin`;
  } else {
    message = 'No details have been updated';
  }

  return message;
}

export const approvedRejectedMailHelper = async (employeeDetails, leaveRequests, transaction, status: boolean) => {
  await Promise.all(employeeDetails.map(async (employee) => {
    const leaveDetails = leaveRequests.find((requests) => requests.empUuid === employee?.empUuid);
    if (!leaveDetails) return;
    // Format dates to DD-MM-YYYY
    const formatDate = (date: Date): string => {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}-${month}-${year}`;
                };
                
                const startDate: string = formatDate(new Date(leaveDetails?.startDate ?? ''));
                const endDate: string | null = leaveDetails?.startDate === leaveDetails?.endDate ? null : formatDate(new Date(leaveDetails?.endDate ?? ''));

                await apporveRejectLeaveRequestMail(employee?.empOfficialEmail, employee?.empUuid, startDate, endDate, status, transaction);
            }));
}



/**
 * Calculate completed months between two dates for accrual purposes
 * Counts monthly periods where leave accruals should be available
 */
export const calculateMonthsBetween = (conversionDate: Date, targetDate: Date): number => {
  const start = new Date(conversionDate);
  const target = new Date(targetDate);
  
  if (target < start) {
    return 0;
  }
  
  // Calculate the difference in years and months
  const yearDiff = target.getFullYear() - start.getFullYear();
  const monthDiff = target.getMonth() - start.getMonth();
  
  // Total complete months elapsed
  let totalMonths = yearDiff * 12 + monthDiff;
  
  // If we're in the same month as start, check if we've passed the anniversary date
  if (totalMonths === 0) {
    // Same month and year - check if we've reached the anniversary day
    return target.getDate() >= start.getDate() ? 1 : 0;
  }
  
  // For later months, only count as complete if we've passed the anniversary day
  if (target.getDate() >= start.getDate()) {
    // We've completed the current month period
    totalMonths++;
  }
  // If target.getDate() < start.getDate(), we haven't completed the current month period
  
  return totalMonths;
};

/**
 * Calculate accrued leaves for a given employee and leave configuration
 * Uses fiscal year start date and monthly accrual based on conversion date anniversary
 */
export const calculateAccruedLeaves = (
  empConversionDate: Date,
  leaveConfig: LeaveConfigWithAccrual,
  targetDate: Date = new Date()
): number => {
  // If allotAllLeaves is true, return the total allotted leaves
  if (leaveConfig.allotAllLeaves) {
    return leaveConfig.totalAllotedLeaves;
  }

  // Get the fiscal year start date for the target date
  const {fiscalYearStart } = getFiscalYearStartAndEndDate(empConversionDate, targetDate);
  
  // Calculate months from the fiscal year start to target date
  const monthsElapsed = calculateMonthsBetween(fiscalYearStart, targetDate);
  
  // Get accrual configuration
  const frequencyInMonths = parseInt(leaveConfig.accuralFrequency);
  const accrualRate = leaveConfig.accuralRate;
  const totalLeaves = leaveConfig.totalAllotedLeaves;
  
  // Calculate total accrual periods in a fiscal year
  const totalPeriodsInYear = Math.ceil(12 / frequencyInMonths);
  
  // For frequency-based accrual: calculate which period we're currently in
  // and how many periods have started (including current period)
  let accessiblePeriods: number;
  
  if (frequencyInMonths === 1) {
    // Monthly accrual: each month gives leaves
    // monthsElapsed already gives us the correct count of completed periods
    accessiblePeriods = Math.min(monthsElapsed, 12);
  } else {
    // Hybrid period completion logic for frequency-based accrual
    // Example: frequency=4, rate=5
    // Completed periods get full accrual, current partial period gets immediate accrual
    
    // Calculate completed periods (periods that have fully elapsed)
    const completedPeriods = Math.floor(monthsElapsed / frequencyInMonths);
    
    // Check if we're in a partial period (period has started but not completed)
    const remainingMonths = monthsElapsed % frequencyInMonths;
    const hasPartialPeriod = remainingMonths > 0;
    
    // Hybrid approach: completed periods + current partial period (if any)
    accessiblePeriods = completedPeriods + (hasPartialPeriod ? 1 : 0);
    
    // Ensure we don't exceed total periods in a year
    accessiblePeriods = Math.min(accessiblePeriods, totalPeriodsInYear);
  }
  
  // Calculate total accrued leaves
  const accruedLeaves = accessiblePeriods * accrualRate;
  
  // Handle decimal cases for usable leaves
  const integerPart = Math.floor(accruedLeaves);
  const decimalPart = accruedLeaves - integerPart;
  
  let usableLeaves: number;
  if (decimalPart < 0.5) {
    // Case 1: < 0.5 - Only integer part is usable
    usableLeaves = integerPart;
  } else {
    // Case 2: >= 0.5 - Integer part + 0.5 (half day) is usable
    usableLeaves = integerPart + 0.5;
  }
  
  // Ensure we don't exceed total allocated leaves for the year
  return Math.min(usableLeaves, totalLeaves);
};

/**
 * Get fiscal year start date based on employee conversion date
 */
export const getFiscalYearStartAndEndDate = (empConversionDate: Date | string | undefined | null, targetDate: Date): {fiscalYearStart: Date, fiscalYearEnd: Date} => {
  let parsedConversionDate = empConversionDate ? new Date(empConversionDate) : null;
  if (!parsedConversionDate || isNaN(parsedConversionDate.getTime())) {
    parsedConversionDate = new Date(Date.UTC(targetDate.getFullYear(), 0, 1));
  }
  
  const conversionDay = parsedConversionDate.getDate();
  const conversionMonth = parsedConversionDate.getMonth();
  const targetYear = targetDate.getFullYear();

  let fiscalYearStart = new Date(Date.UTC(targetYear, conversionMonth, conversionDay));  
  
  // If the target date is before the fiscal year anniversary this year, 
  // the fiscal year started last year
  if (targetDate < fiscalYearStart) {
    fiscalYearStart = new Date(Date.UTC(targetYear - 1, conversionMonth, conversionDay));
  }

  fiscalYearStart.setUTCHours(0, 0, 0, 0); // Normalize to start of day

  // Calculate fiscal year end
  const fiscalYearEnd= new Date(fiscalYearStart);
  fiscalYearEnd.setFullYear(fiscalYearStart.getFullYear() + 1);
  fiscalYearEnd.setDate(fiscalYearEnd.getDate() - 1); // Last day of fiscal year
  
  return {fiscalYearStart, fiscalYearEnd};
};

/**
 * Cycle-based accrual system:
 * - Calculates current cycle based on TODAY's date, not leave application date
 * - Only current cycle quotas are available for consumption
 * - Future cycles cannot be accessed until they actually start
 * - Prevents double consumption across cycle boundaries
 */

/**
 * Handles decimal leave values according to specific rules:
 * Exact 0.5: Shows as 0.5 usable (no carry forward)
 * Case 1 (< 0.5): Only integer value can be applied, remaining carried forward
 * Case 2 (> 0.5): Integer + 0.5 can be applied, remaining carried forward
 * @param decimalValue - The decimal leave value to process
 * @returns Object with current usable leaves and carry-forward amount
 */
export const handleDecimalLeaves = (decimalValue: number) => {
    const integerPart = Math.floor(decimalValue);
    const decimalPart = decimalValue - integerPart;
    
    let currentUsableLeaves: number;
    let carryForwardDecimal: number;
    
    if (decimalPart === 0.5) {
        // Exact 0.5: Shows as 0.5 usable (no carry forward)
        currentUsableLeaves = integerPart + 0.5;
        carryForwardDecimal = 0;
    } else if (decimalPart < 0.5) {
        // Case 1: < 0.5 - Only integer value can be used
        currentUsableLeaves = integerPart;
        carryForwardDecimal = decimalPart;
    } else {
        // Case 2: > 0.5 - Integer + 0.5 can be used  
        currentUsableLeaves = integerPart + 0.5;
        carryForwardDecimal = decimalPart - 0.5;
    }
    
    // console.log(`📊 DECIMAL HANDLING: ${decimalValue} → Usable: ${currentUsableLeaves}, Carry Forward: ${carryForwardDecimal}`);
    
    return {
        currentUsableLeaves: Number(currentUsableLeaves.toFixed(1)),
        carryForwardDecimal: Number(carryForwardDecimal.toFixed(1)),
        originalValue: decimalValue,
        isDecimal: decimalPart > 0
    };
};


// Helper function to convert 24-hour format to 12-hour format safely
export const convertTo12HourFormat = (time24: string): string => {
    if (!time24) return '';
    
    const [hoursStr, minutes] = time24.split(':');
    let hour24 = Number(hoursStr);
    
    // Handle invalid hour values (like 24) by normalizing to 0-23 range
    if (hour24 >= 24) {
        hour24 = hour24 % 24;
    }
    
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    
    return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

// Helper function to format time correctly, ensuring proper 00-23 hour format
export const formatTimeInTimezone = (date: Date, timezone: string): string => {
    const timeInTimezone = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
    
    const hours = timeInTimezone.getHours().toString().padStart(2, '0');
    const minutes = timeInTimezone.getMinutes().toString().padStart(2, '0');
    const seconds = timeInTimezone.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
};

// Update an employee's leave balance when their employment type changes.
// This operation involves:
//  1. Deducting any leaves taken (after conversion date) from the *previous* employment types.
//  2. Adding applicable leaves to the *new* employment type's balance.
// Only leave types that are applicable to the new employment type are deducted from previous
// employment types and added to new employment type's balance.

/**
 * @param employeeId - UUID of the employee whose leave balance is to be updated
 * @param newEmployeeType - New employment type to which the employee is to be converted
 * @param conversionDate - Date on which the employee is to be converted
 * @param transaction - Sequelize transaction object for atomic operations
 * @return Promise resolving to the number of leave entries converted
 */
export const updateEmployeeLeaveBalanceOnTypeChange = async (employeeId: string, newEmployeeType: string, conversionDate: Date, transaction: Transaction) => {
    try {
      // employeeId, newEmployeeType and conversionDate are required
      if (!employeeId || !conversionDate) {
        throw new Error('Missing required parameters');
      }

      // employmentTypeHistory - All employment type changes for the employee in the past
      // currentEmploymentType - Current employment type of the employee
      // leavesTakenAfterConversionDate - All leaves taken by the employee after the conversion date
      // leaveConfigsList - All leave configurations applicable to the new employment type
      // basicDetails - Employee basic details that includes the employees original hired date
      const [
          employmentTypeHistory = [],
          currentEmploymentType,
          leavesTakenAfterConversionDate = []
      ] = await Promise.all([
          // Fetch current employment type record
          dbOutput.employeeJobDetailHistory.findAll({
              attributes: [
                  "empType",
                  "empConversionDate",
                  "updatedAt"
              ],
              where: {
                  updatedAt: {
                      [Op.eq]: outputSequelize.literal(`(
                          SELECT MAX(e2.updatedAt)
                          FROM employeeJobDetailHistories e2
                          WHERE e2.empType = empType
                      )`)
                  }
              },
              order: [['updatedAt', 'ASC']],
              raw: true
          }),

          // Fetch current employment type record
          fetchEmployeeCurrentJobDetails(employeeId, transaction),

          // Fetch all leave attendance entries after conversion date
          dbOutput.employeeAttendanceDetails.findAll({
              attributes: ['attendanceDate', 'leaveRequestId', 'attendanceStatus'],
              where: {
                empUuid: employeeId,
                attendanceDate: { [Op.gte]: new Date(conversionDate) },
                attendanceStatus: {[Op.in]: [AttendanceStatusType.ON_LEAVE, AttendanceStatusType.HALF_DAY]},
                isDeleted: false
              },
              order: [['attendanceDate', 'ASC']],
              raw: true,
              transaction
          })
      ]);

      // If new employee type is not provided, use the current employment type
      if(!newEmployeeType) newEmployeeType = currentEmploymentType?.empType

      // Fetch all leave types applicable to the new employment type
      const leaveConfigsList = await dbOutput.employeeLeaveConfigurator.findAll({
          where: {
              isActive: true,
              employeeType: {
                  [Op.like]: `%"${newEmployeeType}"%`
              }
          },
          transaction
      });

      // Leave config IDs applicable to the new employment type
      const applicableLeaveConfigIds = leaveConfigsList.map(
          (leave) => leave.leaveConfigId
      );

      // Filter out the current employment type
      const filteredEmploymentTypeHistory = employmentTypeHistory.filter(
          item => item?.empType !== currentEmploymentType?.empType
      );

      // Add the current employment type
      filteredEmploymentTypeHistory.push(currentEmploymentType);

      // leave request IDs of leaves taken after conversion date
      const leaveRequestIds: string[] = leavesTakenAfterConversionDate.map(
          (leave: EmployeeAttendanceAttributes) => leave.leaveRequestId
      );

      // leave request details of leaves taken after conversion date
      const leaveRequestList: EmployeeLeaveRequestAttributes[] =
          await dbOutput.employeeLeaveRequestDetails.findAll({
              attributes: ['leaveRequestId', 'leaveConfigId'],
              where: {
                  leaveRequestId: { [Op.in]: leaveRequestIds },
                  isDeleted: false
              },
              raw: true,
              transaction
          });

      // Map leaveRequestId to leaveConfigId
      const leaveConfigMap: Record<string, string> = {};
      leaveRequestList.forEach(lr => {
          if(!applicableLeaveConfigIds.includes(lr.leaveConfigId)) return;
          leaveConfigMap[lr.leaveRequestId] = lr.leaveConfigId;
      });

      // Add leaveConfigId and fiscalYear to leaves taken after conversion date list
      const attendanceWithLeaveType = leavesTakenAfterConversionDate.map(a => ({
          ...a,
          leaveConfigId: leaveConfigMap[a.leaveRequestId]
      }));

      // Get leave count of each leave type per employement type
      const leaveCountPerEmpTypeList = filteredEmploymentTypeHistory.flatMap((emp, index) => {
          const startDate = new Date(emp.empConversionDate);
          const endDate = index < filteredEmploymentTypeHistory.length - 1
              ? new Date(filteredEmploymentTypeHistory[index + 1].empConversionDate)
              : null;

          const relevantAttendance = attendanceWithLeaveType.filter(a => {
              const date = new Date(a?.attendanceDate);
              return endDate ? date >= startDate && date < endDate : date >= startDate;
          });

          // Group by fiscalYear + leaveConfigId
          const grouped: Record<
              number,
              {
                  leaves: Record<string, number>;
                  fiscalYearStart: Date;
                  fiscalYearEnd: Date;
              }
          > = {};

          relevantAttendance.forEach(a => {
              const fiscalYear: number = getFiscalYearForLeave(emp?.empConversionDate, a?.attendanceDate);

              // Get fiscal year start and end date
              const { fiscalYearStart, fiscalYearEnd } = getFiscalYearStartAndEndDate(emp?.empConversionDate, a?.attendanceDate);

              if (!a.leaveConfigId || !fiscalYear || !fiscalYearStart || !fiscalYearEnd) return;

              if (!grouped[fiscalYear]) {
                  grouped[fiscalYear] = {
                      leaves: {},
                      fiscalYearStart,
                      fiscalYearEnd
                  };
              }

              const leaveCount = a.attendanceStatus === AttendanceStatusType.HALF_DAY ? 0.5 : 1;
              
              // Increment leave count for the leaveConfigId
              grouped[fiscalYear].leaves[a.leaveConfigId] =
                  (grouped[fiscalYear].leaves[a.leaveConfigId] || 0) + leaveCount;
          });

          // Convert grouped into separate records per fiscalYear
          return Object.entries(grouped).map(([fiscalYear, data]) => ({
              empType: emp.empType,
              fiscalYear: Number(fiscalYear),
              fiscalYearStart: data.fiscalYearStart,
              fiscalYearEnd: data.fiscalYearEnd,
              leaves: data.leaves
          }));
      });

      const dataRecord = (
          await Promise.all(
              leaveCountPerEmpTypeList.map(async (item) =>
                  Promise.all(
                      Object.entries(item.leaves).map(async ([leaveConfigId, count]) => {
                      const balanceId = await createUUIDV4();
                          return {
                              balanceId,
                              leaveConfigId,
                              empUuid: employeeId,
                              leaveCount: count,
                              fiscalYear: item.fiscalYear,
                              fiscalYearStart: item.fiscalYearStart,
                              fiscalYearEnd: item.fiscalYearEnd,
                              empType: item.empType,
                          };
                      })
                  )
              )
          )
      ).flat();

      

      // Deduct leaves from the previous employment types (batch)
      const existingBalances: EmployeeLeaveBalanceAttributes[] = await dbOutput.employeeLeaveBalanceDetails.findAll({
          where: {
              empUuid: employeeId,
              fiscalYear: { [Op.in]: dataRecord.map(r => r.fiscalYear) },
              fiscalYearStart: { [Op.in]: dataRecord.map(r => r.fiscalYearStart) },
              fiscalYearEnd: { [Op.in]: dataRecord.map(r => r.fiscalYearEnd) },
              leaveConfigId: { [Op.in]: dataRecord.map(r => r.leaveConfigId) },
              empType: { [Op.in]: dataRecord.map(r => r.empType).concat(newEmployeeType) },
              isDeleted: false
          },
          raw: true,
          transaction
      });

      // Convert to map for fast lookup
      const balanceMap = new Map<string, EmployeeLeaveBalanceAttributes>();
      existingBalances.forEach(row => {
          const key = `${row.empUuid}_${row.empType}_${row.leaveConfigId}_${row.fiscalYear}_${row.fiscalYearStart.toISOString()}_${row.fiscalYearEnd.toISOString()}`;
          balanceMap.set(key, row);
      });

      // Prepare bulk update + insert arrays
      const updates: Partial<EmployeeLeaveBalanceAttributes>[] = [];
      const inserts: EmployeeLeaveBalanceAttributes[] = [];

      // Process all records in memory
      for (const data of dataRecord) {
          // Deduct phase
          const oldKey = `${data.empUuid}_${data.empType}_${data.leaveConfigId}_${data.fiscalYear}_${data.fiscalYearStart.toISOString()}_${data.fiscalYearEnd.toISOString()}`;
          const oldBalance: EmployeeLeaveBalanceAttributes | undefined = balanceMap.get(oldKey);

          if (oldBalance) {
              const currentUsed = Number(oldBalance.totalLeaveUsed) || 0;
              oldBalance.totalLeaveUsed = Math.max(0, currentUsed - data.leaveCount!);
              updates.push({
                  balanceId: oldBalance.balanceId,
                  totalLeaveUsed: oldBalance.totalLeaveUsed
              });
          }

          // Create new balance record for the new employment type
          // Fiscal year start and end need to be recalculated based on conversion date
          const newFiscalYearStart = new Date(conversionDate);
          newFiscalYearStart.setUTCHours(0, 0, 0, 0); // Normalize to start of day
          const newFiscalYearEnd = new Date(newFiscalYearStart);

          newFiscalYearStart.setFullYear(data.fiscalYear);
          
          newFiscalYearEnd.setFullYear(data.fiscalYear + 1);
          newFiscalYearEnd.setDate(newFiscalYearEnd.getDate() - 1); // End date is one day before next fiscal year start

          // Insert/Update for new type
          const newKey = `${data.empUuid}_${newEmployeeType}_${data.leaveConfigId}_${data.fiscalYear}_${newFiscalYearStart.toISOString()}_${newFiscalYearEnd.toISOString()}`;
          const newBalance: EmployeeLeaveBalanceAttributes | undefined = balanceMap.get(newKey);

          if (newBalance) {
              newBalance.totalLeaveUsed = Number(newBalance.totalLeaveUsed) + data.leaveCount!;
              updates.push({
                  balanceId: newBalance.balanceId,
                  totalLeaveUsed: newBalance.totalLeaveUsed
              });
          } else {
              inserts.push({
                  balanceId: data.balanceId,
                  leaveConfigId: data.leaveConfigId,
                  empUuid: data.empUuid,
                  empType: newEmployeeType,
                  fiscalYear: data.fiscalYear,
                  totalLeaveUsed: data.leaveCount!,
                  fiscalYearStart: newFiscalYearStart,
                  fiscalYearEnd: newFiscalYearEnd,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  isDeleted: false,
                  isWasCompOff: false
              });
          }
      }

      // Apply all updates in one bulk call
      if (updates.length > 0) {
          await Promise.all(
              updates.map(up =>
                  dbOutput.employeeLeaveBalanceDetails.update(
                      { totalLeaveUsed: up.totalLeaveUsed, updatedAt: new Date() },
                      { where: { balanceId: up.balanceId }, transaction }
                  )
              )
          );
      }

      // Apply all inserts in one bulk call
      if (inserts.length > 0) {
          await dbOutput.employeeLeaveBalanceDetails.bulkCreate(inserts, { transaction });
      }
    } catch (error) {
        console.error("Error in updating the employee leave balance:", error);
        return error;
    }
};

export const updateEmployeePayslipStatusForUnpaidLeave = async (empUuid: string, paidLeaveData: EmployeeLeaveRequestAttributes, unpaidLeaveData: EmployeeLeaveRequestAttributes, transaction?: Transaction) => {
  if(!empUuid || !unpaidLeaveData || !paidLeaveData) return;

  let leaveStartDate = new Date();
  let unpaidLeaveCount = 0;

  if(paidLeaveData.leaveConfigId === unpaidLeaveData.leaveConfigId) {
    leaveStartDate = new Date(paidLeaveData.startDate);
    unpaidLeaveCount = paidLeaveData.totalDays;
  } else {
    leaveStartDate = new Date(unpaidLeaveData.startDate);
    unpaidLeaveCount = unpaidLeaveData.totalDays;
  }

  if(unpaidLeaveCount === 0) return;

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const currentMonthLastDate = new Date(currentYear, currentMonth + 1, 0);

  // get current months payslip record
  const { startDate: payrollStatusStart, endDate: payrollStatusEnd } = getMonthYearDateRange(currentMonth + 1, currentYear);
  const payslipRecord = await dbOutput.employeePayslipRecords.findOne({
    where: {
      employeeId: empUuid,
      payrollStartDate: { [Op.between]: [payrollStatusStart, payrollStatusEnd] },
      isDeleted: false
    },
    transaction
  });

  // if the unpaid leave start date is after the current month last date
  // or current payroll status is not finalized then no need to process
  if(leaveStartDate > currentMonthLastDate || !payslipRecord || payslipRecord?.status !== payrollStatus.PAYROLL_FINALIZED) return;
  // Mark employee payslip as pending
  await payslipRecord?.update({  
    status: payrollStatus.PENDING,
  }, { transaction });
}

 // Helper to format payslip items by component type
export const formatItems = (type: string, payslipItems: employeePayslipItemAttributes[]) => payslipItems
    .filter(item => item.componentType === type)
    .map(item => ({
        payrollItemId: item.payrollItemId,
        componentName: item.componentName,
        amount: parseFloat(String(item.amount)) || 0
    }));

// Helper function to generate CSV data from payslips
export const generatePayrollCSV = (payslips): string => {
    const header = ['Name', 'Monthy CTC', 'Additions', 'Taxes & Deductions', 'Deductions', 'Net Pay'];

    const rows = payslips.map(payslip => [
        payslip.name,
        payslip.monthlyCTC,
        payslip.additions,
        payslip.taxesAndDeductions,
        payslip.deductions,
        payslip.netPay
    ]);

    return `${header.join(',')}\n${rows.map(row => row.join(',')).join('\n')}\n`;
};



export const isEmployeeEligible = (
    conversionDate: Date, 
    config: EmployeeLeaveConfiguratorAttributes, 
    empType: string
): boolean => {
    
    if (!config.leaveApplicableTo || config.leaveApplicableTo === 'null') {
        return true;
    }

    try {
        
        const rules = typeof config.leaveApplicableTo === 'string' 
            ? JSON.parse(config.leaveApplicableTo) 
            : config.leaveApplicableTo;

        
        if (!rules || typeof rules !== 'object') {
            return true; 
        }

        const rule = rules[empType];

        

        const today = new Date();
        const { value, unit } = rule;
        const eligibilityDate = new Date(conversionDate);

        
        if (unit === 'Days') {
            eligibilityDate.setDate(eligibilityDate.getDate() + value);
        } else if (unit === 'Weeks') {
            eligibilityDate.setDate(eligibilityDate.getDate() + (value * 7));
        } else if (unit === 'Months') {
            eligibilityDate.setMonth(eligibilityDate.getMonth() + value);
        }

        
        
        return today >= eligibilityDate;

    } catch (error) {
        
        console.error("Eligibility parsing error:", error);
        return true;
    }
};



export const fetchApplicableLeaveConfigs = async (employeeType: string, empGender: string, conversionDate: Date) => {
  // Fetch all leave configurations
  const allLeaveConfigs = await fetchAllLeaveConfigDetails();

  // Filter leave configs applicable to employee's type
  
  const applicableLeaveConfigs = allLeaveConfigs.filter(config => {
      const employeeTypes = JSON.parse(config.employeeType || '[]');
      const appliedGenders = JSON.parse(config.appliedGender || '[]');

      // Check if config is applicable to employee
      const isBasicMatch = employeeTypes.includes(employeeType) && appliedGenders.includes(empGender) && config.isActive;

      if (!isBasicMatch) return false;

      
        return isEmployeeEligible(conversionDate, config, employeeType);
  });

  return applicableLeaveConfigs;
};





export const getEmployeeUuid = async (tmsUser) => {
  console.log("iddd", tmsUser)
    try {

    //Fetching the employeeUuid based on email
    // const employeeUuid = await dbOutput.employeeContactDetails.findOne({
    //   attributes : ['empUuid'],
    //   where: { empOfficialEmail: tmsUser.email},
    // });

    //Adding the employeeUuid to the response
    // const response = {employeeUuid: employeeUuid?.empUuid || null }
    
    return null;

  } catch (error) {
    return `Error fetching employee UUID: ${error.message}`;
  }
}

/**
 * Filter employees whose birthdays fall within the remaining days of the current month.
 * This function performs the date filtering in JavaScript, making it compatible with both MySQL and PostgreSQL.
 * 
 * @param employees - Array of employee records with empDob field
 * @param todayMonth - Current month (1-12)
 * @param todayDay - Current day of the month (1-31)
 * @returns Filtered and sorted array of employees with upcoming birthdays this month
 */
export const filterUpcomingBirthdays = (
  employees: Partial<EmployeeBasicDetailsAttributes>[],
  todayMonth: number,
  todayDay: number
): Partial<EmployeeBasicDetailsAttributes>[] => {
  return employees
    .filter(emp => {
      if (!emp.empDob) return false;
      
      const dob = new Date(emp.empDob);
      const dobMonth = dob.getMonth() + 1; // getMonth() returns 0-11
      const dobDay = dob.getDate();
      
      // Check if birthday is in the current month and on or after today
      return dobMonth === todayMonth && dobDay >= todayDay;
    })
    .sort((a, b) => {
      // Sort by day of month (ascending)
      const dayA = new Date(a.empDob!).getDate();
      const dayB = new Date(b.empDob!).getDate();
      return dayA - dayB;
    });
};

/**
 * Filter employees whose work anniversaries fall on today's date and have completed at least one year.
 * This function performs the date filtering in JavaScript, making it compatible with both MySQL and PostgreSQL.
 * 
 * @param employees - Array of employee records with empHireDate field
 * @param todayMonth - Current month (1-12)
 * @param todayDay - Current day of the month (1-31)
 * @param todayYear - Current year
 * @returns Filtered array of employees with work anniversaries today, each with yearsCompleted property
 */
export const filterWorkAnniversaries = (
  employees: Partial<EmployeeBasicDetailsAttributes>[],
  todayMonth: number,
  todayDay: number,
  todayYear: number
): Partial<EmployeeBasicDetailsAttributes>[] => {
  return employees
    .filter(emp => {
      if (!emp.empHireDate) return false;
      
      const hireDate = new Date(emp.empHireDate);
      const hireMonth = hireDate.getMonth() + 1; // getMonth() returns 0-11
      const hireDay = hireDate.getDate();
      const hireYear = hireDate.getFullYear();
      
      // Check if hire anniversary is today and at least one year has passed
      const isAnniversaryToday = hireMonth === todayMonth && hireDay === todayDay;
      const yearsCompleted = todayYear - hireYear;
      
      return isAnniversaryToday && yearsCompleted >= 1;
    })
    .map(emp => {
      const hireYear = new Date(emp.empHireDate!).getFullYear();
      const yearsCompleted = todayYear - hireYear;
      return { ...emp, yearsCompleted };
    });
};

/**
 * Generate date range for a given month and year for database-agnostic filtering.
 * This replaces MySQL-specific MONTH()/YEAR() functions with date range comparisons
 * that work on both MySQL and PostgreSQL.
 * 
 * @param month - Month (1-12)
 * @param year - Full year (e.g., 2026)
 * @returns Object with startDate and endDate for the given month/year
 * 
 * @example
 * // For filtering payrollStartDate in January 2026:
 * const { startDate, endDate } = getMonthYearDateRange(1, 2026);
 * // Use in Sequelize: { payrollStartDate: { [Op.between]: [startDate, endDate] } }
 */
export const getMonthYearDateRange = (month: number, year: number): { startDate: Date; endDate: Date } => {
  // Start of the month (first day at 00:00:00.000)
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  
  // End of the month (last day at 23:59:59.999)
  // Using month (instead of month - 1) with day 0 gives last day of previous month
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  
  return { startDate, endDate };
};

/**
 * Generate date range for a given year for database-agnostic filtering.
 * This replaces MySQL-specific YEAR() function with date range comparisons
 * that work on both MySQL and PostgreSQL.
 * 
 * @param year - Full year (e.g., 2026)
 * @returns Object with startDate and endDate for the given year
 * 
 * @example
 * // For filtering payrollStartDate in 2026:
 * const { startDate, endDate } = getYearDateRange(2026);
 * // Use in Sequelize: { payrollStartDate: { [Op.between]: [startDate, endDate] } }
 */
export const getYearDateRange = (year: number): { startDate: Date; endDate: Date } => {
  // Start of the year (January 1st at 00:00:00.000)
  const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  
  // End of the year (December 31st at 23:59:59.999)
  const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  
  return { startDate, endDate };
};


/**
 * Utility function to add months to a date correctly, handling end-of-month cases
 * (e.g. Jan 31 + 1 month → Feb 28/29, not Mar 3).
 */
const addMonthsToDate = (date: Date, months: number): Date => {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
};

export interface WorkAnniversaryEmployee {
  empUuid?: string;
  empFirstName?: string;
  empLastName?: string;
  anniversaryDate: Date;
}

/**
 * Filter employees whose 12th or 14th month work anniversary (from conversion date) falls in the current month.
 * Used for dashboard: 12th month = conversion + 12 months, 14th month = conversion + 14 months.
 *
 * @param employees - Array of records with empUuid, empFirstName, empLastName, empConversionDate
 * @param todayMonth - Current month (1-12)
 * @param todayYear - Current year
 * @returns Object with workAnniversary12Month and workAnniversary14Month arrays
 */
export const filterWorkAnniversariesByConversionDate = (
  employees: Array<{ empUuid?: string; empFirstName?: string; empLastName?: string; empConversionDate?: Date | null }>,
  todayMonth: number,
  todayYear: number
): { workAnniversary12Month: WorkAnniversaryEmployee[]; workAnniversary14Month: WorkAnniversaryEmployee[] } => {
  const workAnniversary12Month: WorkAnniversaryEmployee[] = [];
  const workAnniversary14Month: WorkAnniversaryEmployee[] = [];

  for (const emp of employees) {
    if (!emp.empConversionDate) continue;
    const conversion = new Date(emp.empConversionDate);

    const anniversary12 = addMonthsToDate(conversion, 12);
    const month12 = anniversary12.getUTCMonth() + 1;
    const year12 = anniversary12.getUTCFullYear();
    if (month12 === todayMonth && year12 === todayYear) {
      workAnniversary12Month.push({
        empUuid: emp.empUuid,
        empFirstName: emp.empFirstName,
        empLastName: emp.empLastName,
        anniversaryDate: anniversary12,
      });
    }

    const anniversary14 = addMonthsToDate(conversion, 14);
    const month14 = anniversary14.getUTCMonth() + 1;
    const year14 = anniversary14.getUTCFullYear();
    if (month14 === todayMonth && year14 === todayYear) {
      workAnniversary14Month.push({
        empUuid: emp.empUuid,
        empFirstName: emp.empFirstName,
        empLastName: emp.empLastName,
        anniversaryDate: anniversary14,
      });
    }
  }

  return { workAnniversary12Month, workAnniversary14Month };
};
