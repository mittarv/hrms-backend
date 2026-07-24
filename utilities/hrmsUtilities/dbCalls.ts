/**
 * HRMS Database Utility Functions
 * This module provides functions for interacting with the HRMS database.
 */

import { Op, Transaction, WhereOptions } from "sequelize";
import { sequelize } from "../../models";
import { dbOutput } from "../../models";
import {
    EmployeeAttendanceAttributes,
    EmployeeLeaveRequestAttributes,
    hrmsEmailLogsCreationAttributes,
    hrmsNotificationAttributes,
    CreateNotificationParams,
    EmployeeLeaveBalanceAttributes
} from "../../interfaces/hrmsTool/interface/hrmsInterface";
import {
    AttendanceStatusType,
    LeaveApprovalStatus,
    hrmsConstants,
    hrmsNotificationTypes
} from "../../interfaces/hrmsTool/enum/hrmsEnum";
import { createUUIDV4 } from "../uuidV4Generator";
import { checkHrmsPermission } from "./dbCalls/hrmsAccessServices";
import { isValidTime, formatTimeInTimezone } from "./helperFunctions";

// Database models
const employeeLeaveConfigurator = dbOutput.employeeLeaveConfigurator;
const employeeJobDetails = dbOutput.employeeJobDetails;
const employeeBasicDetails = dbOutput.employeeBasicDetails;
const employeeHolidayDetails = dbOutput.employeeHolidayDetails;
const employeeLeaveRequest = dbOutput.employeeLeaveRequestDetails;
const employeeLeaveBalance = dbOutput.employeeLeaveBalanceDetails;
const employeeAttendance = dbOutput.employeeAttendanceDetails;
const employeeContact = dbOutput.employeeContactDetails;
const hrmsEmailLogs = dbOutput.hrmsEmailLogs;
const employeeJobDetailHistory = dbOutput.employeeJobDetailHistory;
const employeeExtraWorkLog = dbOutput.employeeExtraWorkDay;

// UAM models
const uamToolDetails = dbOutput.uamToolDetails;
const uamUserGroups = dbOutput.uamUserGroups;
const uamToolUsers = dbOutput.uamToolUsers;
const tmsUsers = dbOutput.tmsUsers;
const hrmsNotificationLogs = dbOutput.hrmsNotificationLogs;

// Leave Configuration Functions
/**
 * Fetches leave configuration details by leaveConfigId
 * @param {string} leaveConfigId - The ID of the leave configuration
 * @returns {Promise<Object>} The leave configuration details
 */
export const fetchLeaveConfigDetails = async (leaveConfigId: string) => {
    if (!leaveConfigId) return;

    try {
        const empLeaveConfigDetails = await employeeLeaveConfigurator.findOne({
            where: { leaveConfigId, isActive: true }
        });
        return empLeaveConfigDetails?.dataValues;
    } catch (error) {
        console.error("Error fetching leave config details:", error);
        throw error;
    }
};

/**
 * Fetches all leave configurations
 * @returns {Promise<Array>} All leave configurations
 */
export const fetchAllLeaveConfigDetails = async () => {
    try {
        const allLeaveConfigs = await employeeLeaveConfigurator.findAll({ where: { isActive: true }, raw: true });
        return allLeaveConfigs;
    } catch (error) {
        console.error("Error fetching all leave configs:", error);
        throw error;
    }
};

/**
 * Fetches employee basic details by employee UUID
 * @param {string} empUuid - The employee UUID
 * @returns {Promise<Object>} The employee basic details
 */
export const fetchEmployeeBasicDetails = async (empUuid: string) => {
    try {
        const basicDetails = await employeeBasicDetails.findOne({
            where: { empUuid, isDeleted: false }
        });
        return basicDetails?.dataValues;
    } catch (error) {
        console.error("Error fetching employee basic details:", error);
        throw error;
    }
};

// Leave Management Functions
/**
 * Fetches mandatory leaves within a date range
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @returns {Promise<Array>} The mandatory leaves
 */
export const fetchMandatoryLeavesInRange = async (startDate: Date, endDate: Date) => {
    try {
        const mandatoryLeaves = await employeeHolidayDetails.findAll({
            where: {
                eventDate: {
                    [Op.between]: [startDate, endDate]
                },
                isDeleted: false
            }
        });
        return mandatoryLeaves;
    } catch (error) {
        console.error("Error fetching mandatory leaves:", error);
        throw error;
    }
};

/**
 * Fetches overlapping leave requests and attendances
 * @param {string} empUuid - The employee UUID
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @returns {Promise<Array>} The overlapping leave requests
 */
export const fetchOverLappingLeaves = async (empUuid: string, startDate: Date, endDate: Date): Promise<{
    overlappingLeaveAttendances: EmployeeAttendanceAttributes[];
    overlappingLeaveRequests: EmployeeLeaveRequestAttributes[];
}> => {
    try {
        const [overlappingLeaveAttendances, overlappingLeaveRequests] = await Promise.all([
            employeeAttendance.findAll({
                where: {
                    empUuid,
                    attendanceDate: {
                        [Op.between]: [startDate, endDate]
                    },
                    attendanceStatus: {
                        [Op.not]: [AttendanceStatusType.WORKING]
                    },
                    isDeleted: false
                }
            }),
            employeeLeaveRequest.findAll({
                where: {
                    empUuid,
                    approvalStatus: {
                        [Op.in]: [LeaveApprovalStatus.PENDING]
                    },
                    [Op.and]: [
                        {
                            startDate: {
                                [Op.lte]: endDate
                            }
                        },
                        {
                            endDate: {
                                [Op.gte]: startDate
                            }
                        }
                    ],
                    isDeleted: false
                }
            })
        ]);

        // if(overlappingLeaveAttendances?.length > 0) return overlappingLeaveAttendances;

        return { overlappingLeaveAttendances, overlappingLeaveRequests };
    } catch (error) {
        console.error("Error fetching overlapping leaves:", error);
        throw error;
    }
};

/**
 * Fetches leave balance details by employee UUID
 * @param {string} empUuid - The employee UUID
 * @returns {Promise<Array>} The leave balance details
 */
export const fetchLeaveBalanceDetails = async (
    jobDetails,
    fiscalYearStart: Date,
    leaveConfigIds?: [string]
): Promise<EmployeeLeaveBalanceAttributes[]> => {
    try {
        const whereClaus: WhereOptions<EmployeeLeaveBalanceAttributes> = {
            empUuid: jobDetails?.empUuid,
            fiscalYearStart,
            empType: jobDetails?.empType,
            isDeleted: false
        };

        if (leaveConfigIds && leaveConfigIds.length > 0) {
            whereClaus.leaveConfigId = { [Op.in]: leaveConfigIds };
        }

        const leaveBalanceDetails: EmployeeLeaveBalanceAttributes[] = await employeeLeaveBalance.findAll({
            where: whereClaus,
            raw: true
        });

        return leaveBalanceDetails;
    } catch (error) {
        console.error("Error fetching leave balance details:", error);
        throw error;
    }
};

// Attendance Functions
/**
 * Fetches employee attendance details for a month
 * @param {string} empUuid - The employee UUID
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @returns {Promise<Array>} The employee attendance details
 */
export const fetchEmployeeAttendanceDetails = async (empUuid: string, startDate: Date, endDate: Date) => {
    try {
        const records: EmployeeAttendanceAttributes[] = await employeeAttendance.findAll({
            where: {
                empUuid,
                attendanceDate: {
                    [Op.between]: [startDate, endDate]
                },
                isDeleted: false
            },
            order: [['attendanceDate', 'ASC']],
            raw: true
        });

        // Group records by date and combine them
        const groupedRecords: EmployeeAttendanceAttributes = records.reduce((acc, record) => {
            const dateKey = record.attendanceDate.toISOString().split('T')[0];

            if (!acc[dateKey]) {
                acc[dateKey] = {
                    ...record,
                    workHours: (record.checkIn && record.checkOut) ? (record.workHours || 0) : 0,
                    checkIn: record.checkIn,
                    checkOut: record.checkOut
                };
            } else {
                // Combine work hours only if both checkIn and checkOut exist
                if (record.checkIn && record.checkOut) {
                    acc[dateKey].workHours = (+acc[dateKey].workHours!) + (+record.workHours! || 0);
                }

                // Keep the earliest checkIn
                if (record.checkIn && (!acc[dateKey].checkIn || record.checkIn < acc[dateKey].checkIn)) {
                    acc[dateKey].checkIn = record.checkIn;
                }

                // Keep the latest checkOut
                if (record.checkOut && (!acc[dateKey].checkOut || record.checkOut > acc[dateKey].checkOut)) {
                    acc[dateKey].checkOut = record.checkOut;
                }
            }

            return acc;
        }, {} as EmployeeAttendanceAttributes);

        // Convert back to array and sort by date
        const consolidatedRecords: EmployeeAttendanceAttributes[] = Object.values(groupedRecords).sort((a: EmployeeAttendanceAttributes, b: EmployeeAttendanceAttributes) =>
            new Date(a.attendanceDate).getTime() - new Date(b.attendanceDate).getTime()
        );

        return consolidatedRecords;
    } catch (error) {
        console.error("Error fetching employee attendance details:", error);
        throw error;
    }
};

// Contact Functions
/**
 * Fetches employee contact details by email
 * @param {string} email - The employee email
 * @param {Transaction} transaction - The database transaction
 * @returns {Promise<Object>} The employee contact details
 */
export const fetchEmployeeContactDetailsFromEmail = async (email: string, transaction?: Transaction) => {
    try {
        const empContactDetails = await employeeContact.findOne({
            where: {
                empOfficialEmail: email,
                isDeleted: false
            },
            transaction
        });
        return empContactDetails;
    } catch (error) {
        console.error("Error fetching employee contact details:", error);
        throw error;
    }
};

// Leave Request Functions
/**
 * Soft deletes an employee leave request
 * @param {string} empUuid - The employee UUID
 * @param {string} leaveRequestId - The leave request ID
 */
export const softDeleteEmployeeLeaveRequest = async (leaveRequestId: string) => {
    try {
        await employeeLeaveRequest.update(
            { isDeleted: true },
            { where: { leaveRequestId } }
        );
    } catch (error) {
        console.error("Error soft deleting employee leave request:", error);
        throw error;
    }
};

/**
 * Fetches employee leave history
 * @param {string} empUuid - The employee UUID
 * @returns {Promise<Array>} The employee leave history
 */
export const fetchEmployeeLeaveHistory = async (empUuid: string) => {
    try {
        const empLeaveHistory = await employeeLeaveRequest.findAll({
            where: { empUuid, isDeleted: false },
            order: [['updatedAt', 'DESC']]
        });
        return empLeaveHistory;
    } catch (error) {
        console.error("Error fetching employee leave history:", error);
        throw error;
    }
};

/**
 * Fetches all pending leave requests
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @returns {Promise<Array>} All pending leave requests
 */
export const fetchAllPendingLeaveRequests = async (startDate?: Date, endDate?: Date, empCompanyId?: string) => {
    interface ApplicationDateCondition {
        [Op.between]?: [Date, Date];
        [Op.gte]?: Date;
        [Op.lte]?: Date;
    }

    interface LeaveStatusCondition {
        [Op.in]: LeaveApprovalStatus[];
    }

    interface ApprovalUpdate {
        approvalStatus: LeaveStatusCondition,
        applicationDate?: ApplicationDateCondition,
        empUuid?: any,
        isDeleted: boolean
    }

    const whereCondition: ApprovalUpdate = {
        approvalStatus: {
            [Op.in]: [LeaveApprovalStatus.PENDING, LeaveApprovalStatus.PROOF_REQUIRED],
        },
        isDeleted: false
    };

    if (startDate && endDate) {
        whereCondition.applicationDate = {
            [Op.between]: [startDate, endDate],
        };
    } else if (startDate) {
        whereCondition.applicationDate = {
            [Op.gte]: startDate,
        };
    } else if (endDate) {
        whereCondition.applicationDate = {
            [Op.lte]: endDate,
        };
    }

    if (empCompanyId) {
        const orgEmployees = await employeeBasicDetails.findAll({
            where: { empCompanyId, isDeleted: false },
            attributes: ['empUuid'],
            raw: true
        });
        const validEmpUuids = orgEmployees.map((e: any) => e.empUuid);
        whereCondition.empUuid = { [Op.in]: validEmpUuids };
    } else {
        whereCondition.empUuid = null;
    }

    try {
        const allPendingRequests = await employeeLeaveRequest.findAll({
            where: whereCondition,
            order: [['applicationDate', 'ASC']],
        });
        return allPendingRequests;
    } catch (error) {
        console.error("Error fetching all pending leave requests:", error);
        throw error;
    }
};

/**
 * Updates pending leave requests to approved or rejected
 * @param {string} empUuid - The employee UUID
 * @param {string[]} leaveRequestIds - The leave request IDs
 * @param {LeaveApprovalStatus} approvalStatus - The approval status
 * @param {Transaction} transaction - The database transaction
 */
export const updatePendingLeaveRequest = async (empUuid: string, leaveRequestIds: string[], approvalStatus: LeaveApprovalStatus, transaction: Transaction) => {
    try {
        await employeeLeaveRequest.update(
            {
                approvalStatus: approvalStatus,
                approvedBy: empUuid,
                approvalDate: new Date()
            },
            { where: { leaveRequestId: leaveRequestIds, isDeleted: false } },
            transaction
        );
    } catch (error) {
        console.error("Error updating pending leave request:", error);
        throw error;
    }
};

/**
 * Creates an employee leave request record
 * @param {EmployeeLeaveRequestAttributes} leaveRequestDetails - The leave request details
 * @param {Transaction} transaction - The database transaction
 */
export const createLeaveRequest = async (leaveRequestDetails: EmployeeLeaveRequestAttributes, transaction?: Transaction) => {
    try {
        await employeeLeaveRequest.create(leaveRequestDetails, { transaction });
    } catch (error) {
        console.error("Error creating leave request:", error);
        throw error;
    }
};

/**
 * Bulk creates employee attendance records
 * @param {EmployeeAttendanceAttributes[]} employeeAttendanceDetailsList - The employee attendance details list
 * @param {Transaction} transaction - The database transaction
 */
export const createEmployeeAttendanceRecord = async (employeeAttendanceDetailsList: EmployeeAttendanceAttributes[], transaction?: Transaction) => {
    try {
        await employeeAttendance.bulkCreate(employeeAttendanceDetailsList, {
            transaction,
            validate: true,
        });
    } catch (error) {
        console.error("Error creating employee attendance record:", error);
        throw error;
    }
};

/**
 * Updates employee leave balance
 * @param {string} jobDetails - The employee job details
 * @param {string} leaveConfigId - The leave configuration ID
 * @param {number} totalLeaveUsed - The total leave used
 * @param {Transaction} transaction - The database transaction
 */
export const updateEmployeeLeaveBalance = async (
    {
        jobDetails,
        leaveConfigId,
        fiscalYear,
        fiscalYearStart,
        fiscalYearEnd,
        totalLeaveUsed,
        transaction,
    }: {
        jobDetails;
        leaveConfigId: string;
        fiscalYear: number;
        fiscalYearStart: Date;
        fiscalYearEnd: Date;
        totalLeaveUsed: number;
        transaction?: Transaction;
    }
) => {
    try {
        const [record, created] = await employeeLeaveBalance.findOrCreate({
            where: { leaveConfigId, empUuid: jobDetails?.empUuid, fiscalYear, fiscalYearStart, fiscalYearEnd, empType: jobDetails?.empType, isDeleted: false },
            defaults: {
                balanceId: await createUUIDV4(),
                empUuid: jobDetails?.empUuid,
                leaveConfigId,
                fiscalYear,
                fiscalYearStart,
                fiscalYearEnd,
                empType: jobDetails?.empType,
                totalLeaveUsed
            },
            transaction
        });

        if (!created) {
            await record.increment({ totalLeaveUsed }, { transaction });
        }
    } catch (error) {
        console.error("Error updating employee leave balance:", error);
        throw error;
    }
};

/**
 * Fetches leave request details by leave request IDs
 * @param {string[]} leaveRequestIds - The leave request IDs
 * @param {Transaction} transaction - The database transaction
 * @returns {Promise<Array>} The leave request details
 */
export const fetchLeaveRequestDetailsFromLeaveId = async (leaveRequestIds: string[], transaction?: Transaction): Promise<EmployeeLeaveRequestAttributes[]> => {
    try {
        const empLeaveDetails: EmployeeLeaveRequestAttributes[] = await employeeLeaveRequest.findAll({
            where: { leaveRequestId: leaveRequestIds, isDeleted: false },
            transaction
        });
        return empLeaveDetails;
    } catch (error) {
        console.error("Error fetching leave request details:", error);
        throw error;
    }
};

/**
 * Soft deletes an employee attendance record
 * @param {string} attendanceId - The attendance ID
 */
export const softDeleteEmployeeAttendance = async (attendanceId: string) => {
    try {
        await employeeAttendance.update({ isDeleted: true }, { where: { attendanceId } });
    } catch (error) {
        console.error("Error soft deleting employee attendance:", error);
        throw error;
    }
};

/**
 * Fetches employee attendance details by attendance ID
 * @param {string} attendanceId - The attendance ID
 * @returns {Promise<Object>} The employee attendance details
 */
export const fetchEmployeeAttendanceDetailsById = async (attendanceId: string, transaction?: Transaction) => {
    try {
        const attendanceDetails = await employeeAttendance.findOne({ where: { attendanceId, isDeleted: false }, transaction });
        return attendanceDetails;
    } catch (error) {
        console.error("Error fetching employee attendance details:", error);
        throw error;
    }
};

export const updateEmployeeAttendanceDetails = async (updateData: Partial<EmployeeAttendanceAttributes>, attendanceId: string, transaction?: Transaction) => {
    try {
        await employeeAttendance.update(
            updateData,
            {
                where: { attendanceId, isDeleted: false },
                transaction
            }
        );
    } catch (error) {
        console.error("Error updating employee attendance details:", error);
        throw error;
    }
}

export const fetchEmployeesOnLeave = async (startDate: Date, endDate: Date, empCompanyId?: string) => {
    try {
        const whereClause: any = {
            attendanceDate: {
                [Op.between]: [startDate, endDate]
            },
            attendanceStatus: {
                [Op.in]: [AttendanceStatusType.ON_LEAVE, AttendanceStatusType.HALF_DAY]
            },
            isDeleted: false
        };

        if (empCompanyId) {
            const orgEmployees = await employeeBasicDetails.findAll({
                where: { empCompanyId, isDeleted: false },
                attributes: ['empUuid'],
                raw: true
            });
            const validEmpUuids = orgEmployees.map((e: any) => e.empUuid);
            whereClause.empUuid = { [Op.in]: validEmpUuids };
        } else {
            whereClause.empUuid = null;
        }

        const employeesOnLeave = await employeeAttendance.findAll({
            where: whereClause,
        });
        return employeesOnLeave;
    } catch (error) {
        console.error("Error fetching employees on leave:", error);
        throw error;
    }
};


/**
 * Creates an onboarding email log record
 * @param {Partial<hrmsEmailLogsCreationAttributes>} emailLogsDetails - The email log details
 * @returns {Promise<hrmsEmailLogsCreationAttributes>} The newly created email log record
 */
export const EmailLog = async (
    emailLogsDetails: Partial<hrmsEmailLogsCreationAttributes>,
    transaction?: Transaction
): Promise<hrmsEmailLogsCreationAttributes> => {
    const {
        recipient_employee_id,
        recipient_email,
        sender_email,
        subject,
    } = emailLogsDetails;

    if (!recipient_email || !sender_email || !subject) {
        throw new Error('Missing required fields: recipient_email, sender_email, and subject are required');
    }

    const email_log_id = await createUUIDV4();
    const sent_at = new Date();

    try {
        const emailLog = await hrmsEmailLogs.create({
            email_log_id,
            recipient_employee_id,
            recipient_email,
            sender_email,
            subject,
            sent_at
        }, { transaction });

        return emailLog;
    } catch (error) {
        console.error("Error creating email log:", error);
        throw error;
    }
};

export const createHRMSNotification = async (
    params: CreateNotificationParams,
    transaction?: Transaction
) => {
    const {
        notification_type,
        message,
        sender_employee_id,
        recipient_employee_id,
        notification_effective_date = new Date()
    } = params;

    try {
        const getExpiryDate = (type: hrmsNotificationTypes): Date => {
            const expiryDate = new Date();
            if (type === hrmsNotificationTypes.MY_UPDATES) {
                expiryDate.setDate(expiryDate.getDate() + 30);
            } else {
                expiryDate.setDate(expiryDate.getDate() + 7);
            }
            return expiryDate;
        };

        const notification_expiry_date = getExpiryDate(notification_type);

        if (notification_type === hrmsNotificationTypes.MY_UPDATES) {
            if (!recipient_employee_id) {
                throw new Error('recipient_employee_id is required for MY_UPDATES notification type');
            }

            const notificationId = await createUUIDV4();

            const notificationRecord = {
                notificationId,
                message,
                notificationType: notification_type,
                recipient_employee_id,
                sender_employee_id,
                read_at: null,
                notification_effective_date,
                notification_expiry_date,
                priority: 100,
                is_deleted: false
            };

            const result = await hrmsNotificationLogs.create(notificationRecord, { transaction });

            return {
                success: true,
                message: 'Individual notification created successfully',
                recordsCreated: 1,
                data: result
            };
        }

        if (notification_type === hrmsNotificationTypes.ORGANIZATION_UPDATES) {
            const allEmployees = await employeeBasicDetails.findAll({
                attributes: ['empUuid'],
                where: { isDeleted: false },
                raw: true
            });

            if (allEmployees.length === 0) {
                return {
                    success: false,
                    message: 'No employees found to send organization updates',
                    recordsCreated: 0
                };
            }

            const notificationRecords = await Promise.all(
                allEmployees.map(async (employee: { empUuid: string }) => ({
                    notificationId: await createUUIDV4(),
                    message,
                    notificationType: notification_type,
                    recipient_employee_id: employee.empUuid,
                    sender_employee_id,
                    read_at: null,
                    notification_effective_date,
                    notification_expiry_date,
                    priority: 100,
                    is_deleted: false
                }))
            );

            const BATCH_SIZE = 10;
            let totalRecordsCreated = 0;
            const allCreatedRecords: hrmsNotificationAttributes[] = [];

            for (let i = 0; i < notificationRecords.length; i += BATCH_SIZE) {
                const batch = notificationRecords.slice(i, i + BATCH_SIZE);

                const createdBatch = await hrmsNotificationLogs.bulkCreate(batch, {
                    validate: true,
                    ignoreDuplicates: false,
                    returning: true,
                    transaction
                });

                totalRecordsCreated += createdBatch.length;
                allCreatedRecords.push(...createdBatch);

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return {
                success: true,
                message: `Organization notifications created successfully.`,
                recordsCreated: totalRecordsCreated,
                employeesNotified: allEmployees.length
            };
        }

        throw new Error('Invalid notification type provided');
    } catch (error: unknown) {
        console.error('Error creating notification:', error);
        throw error;
    }
};


export const CheckInService = async (empUuid: string, attendanceDate: string, timezone: string, transaction?: Transaction) => {
    const attendanceId = await createUUIDV4();

    // Get current time in user's timezone using proper formatting
    const now = new Date();
    const checkIn = formatTimeInTimezone(now, timezone); // Returns HH:MM:SS format (00-23)

    // Create date object for the user's date in UTC (to avoid timezone conversion issues)
    const [year, month, day] = attendanceDate.split('-').map(Number);

    // Create the date as UTC midnight for the user's date
    const attendanceDateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // For querying, we need to find records for the same day 
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    try {
        const activeRecord = await employeeAttendance.findOne({
            where: {
                empUuid,
                attendanceDate: {
                    [Op.between]: [startOfDay, endOfDay]
                },
                checkOut: null,
                isDeleted: false
            },
            transaction
        });

        if (activeRecord) {
            return { success: false, message: "Already checked in for today" };
        } else {
            const newRecord = await employeeAttendance.create({
                attendanceId,
                empUuid,
                attendanceDate: attendanceDateObj, // Store the date in UTC
                checkIn,
                attendanceStatus: AttendanceStatusType.WORKING,
                isDeleted: false
            }, { transaction });
            return newRecord;
        }
    } catch (error) {
        console.error("Error checking in employee:", error);
        throw error;
    }
};



export const getCheckInOutStatusService = async (empUuid: string, attendanceDate: string, transaction?: Transaction) => {
    try {
        const [year, month, day] = attendanceDate.split('-').map(Number);
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        const latestRecord = await employeeAttendance.findOne({
            where: {
                empUuid,
                attendanceDate: {
                    [Op.between]: [startOfDay, endOfDay]
                },
                isDeleted: false,
                attendanceStatus: AttendanceStatusType.WORKING,
            },
            order: [['createdAt', 'DESC']],
            transaction,
        });

        if (!latestRecord) {
            return {
                checkInStatus: true,
                checkOutStatus: false,
                isCheckedIn: false,
            };
        }

        if (!latestRecord.checkOut) {
            return {
                checkInStatus: false,
                checkOutStatus: true,
                isCheckedIn: true,
                checkInTime: latestRecord.checkInTime || latestRecord.checkIn,
            };
        }

        return {
            checkInStatus: true,
            checkOutStatus: false,
            isCheckedIn: false,
            lastCheckOutTime: latestRecord.checkOut,
        };
    } catch (error) {
        console.error("Error fetching check-in/out status:", error);
        throw error;
    }
};

export const checkOutService = async (empUuid: string, attendanceDate: string, timezone: string, transaction?: Transaction) => {
    try {
        // Create timezone-aware date objects (consistent with check-in)
        const [year, month, day] = attendanceDate.split('-').map(Number);
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        // Find latest record for today with null checkOut
        const latestRecord = await employeeAttendance.findOne({
            where: {
                empUuid,
                attendanceDate: {
                    [Op.between]: [startOfDay, endOfDay],
                },
                checkOut: null,
                isDeleted: false,
                attendanceStatus: AttendanceStatusType.WORKING,
            },
            order: [["createdAt", "DESC"]],
            transaction,
        });

        if (!latestRecord) {
            throw new Error("No pending check-in record found for today.");
        }

        // Get current time in user's timezone using proper formatting
        const now = new Date();
        const checkOut = formatTimeInTimezone(now, timezone); // Returns HH:MM:SS format (00-23)

        const checkIn = latestRecord.checkIn || latestRecord.checkInTime;
        if (!checkIn) {
            throw new Error("Missing check-in time. Cannot compute work hours.");
        }

        // Calculate work hours more accurately
        const checkInTime = new Date(`1970-01-01T${checkIn}Z`).getTime();
        const checkOutTime = new Date(`1970-01-01T${checkOut}Z`).getTime();

        let workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);

        // Handle case where checkout is next day (past midnight)
        if (workHours < 0) {
            workHours += 24; // Add 24 hours if checkout is next day
        }

        // Round to 2 decimal places
        workHours = Math.round(workHours * 100) / 100;

        // Update the existing record
        await employeeAttendance.update(
            {
                checkOut,
                workHours,
                attendanceStatus: AttendanceStatusType.WORKING,
            },
            {
                where: { attendanceId: latestRecord.attendanceId },
                transaction,
            }
        );

        // Return updated record
        const updatedRecord = await employeeAttendance.findOne({
            where: { attendanceId: latestRecord.attendanceId },
            transaction,
        });

        return updatedRecord;

    } catch (error) {
        console.error("Error during check-out:", error);
        throw error;
    }
};
export const CheckOutstandingCheckoutService = async (empUuid: string, timezone?: string, transaction?: Transaction) => {
    try {
        // Get current date in user's timezone or default to server timezone
        const now = new Date();
        let todayDateString: string;

        if (timezone) {
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            todayDateString = formatter.format(now);
        } else {
            todayDateString = now.toISOString().split('T')[0]; // Get YYYY-MM-DD format
        }

        const todayMidnight = new Date(`${todayDateString}T00:00:00.000Z`);

        // Find the most recent attendance where checkout is null AND date is before today
        const outstandingRecord = await employeeAttendance.findOne({
            where: {
                empUuid,
                checkOut: null,
                isDeleted: false,
                attendanceStatus: AttendanceStatusType.WORKING,
                attendanceDate: {
                    [Op.lt]: todayMidnight
                }
            },
            order: [['attendanceDate', 'DESC']],
            transaction
        });

        if (outstandingRecord) {
            const dateOnly = outstandingRecord.attendanceDate.toISOString().split('T')[0];
            return {
                isShowCheckoutPopup: true,
                outstandingDate: dateOnly,
                checkInTime: outstandingRecord.checkIn || outstandingRecord.checkInTime,
                attendanceId: outstandingRecord.attendanceId,
                message: `You have an outstanding checkout for ${dateOnly}`
            };
        } else {
            return {
                isShowCheckoutPopup: false,
                outstandingDate: null,
                checkInTime: null,
                message: "No outstanding checkout found"
            };
        }
    } catch (error) {
        console.error("Error checking outstanding checkout:", error);
        throw error;
    }
};



export const UpdateCheckoutService = async (attendanceId: string, attendanceDate: string, checkOutTime: string, transaction?: Transaction) => {
    try {

        // // Find the record to update
        const recordToUpdate = await employeeAttendance.findOne({
            where: {
                attendanceId,
                isDeleted: false
            },
            transaction
        });

        // // Ensure checkout time is in HH:MM:SS format
        const formattedCheckOut = checkOutTime.length === 5 ? `${checkOutTime}:00` : checkOutTime;
        // Validate checkout time format (HH:MM:SS or HH:MM)
        if (!isValidTime(formattedCheckOut)) {
            return {
                success: false,
                message: "Invalid time format. Please use HH:MM or HH:MM:SS format"
            };
        }

        // Validate that checkout time is after check-in time
        const checkInTime = recordToUpdate.checkIn;
        if (formattedCheckOut <= checkInTime) {
            return {
                success: false,
                message: "Checkout time must be after check-in time"
            };
        }

        // Calculate total work hours
        const checkInDateTime = new Date(`2000-01-01 ${checkInTime}`);
        const checkOutDateTime = new Date(`2000-01-01 ${formattedCheckOut}`);
        const workHours = (checkOutDateTime.getTime() - checkInDateTime.getTime()) / (1000 * 60 * 60);

        // Update the record
        const [updatedRowsCount] = await employeeAttendance.update(
            {
                checkOut: formattedCheckOut,
                workHours: workHours.toFixed(2)
            },
            {
                where: {
                    attendanceId,
                },
                transaction
            }
        );

        if (updatedRowsCount === 0) {
            return {
                success: false,
                message: "Failed to update checkout time"
            };
        }

        return {
            success: true,
            message: "Checkout time updated successfully",
            data: {
                checkOut: formattedCheckOut,
                totalWorkHours: workHours.toFixed(2)
            }
        };

    } catch (error) {
        console.error("Error updating checkout time:", error);
        throw error;
    }
};

export const fetchEmployeeLeavesData = async (empUuid: string, startDate: Date, endDate: Date) => {
    try {
        const employeesOnLeave = await employeeAttendance.findAll({
            where: {
                empUuid,
                attendanceDate: {
                    [Op.between]: [startDate, endDate]
                },
                attendanceStatus: {
                    [Op.in]: [AttendanceStatusType.ON_LEAVE]
                },
                isDeleted: false
            },
            raw: true
        });

        // If no attendance records found, return empty array
        if (employeesOnLeave.length === 0) {
            return [];
        }

        // Get unique leave request IDs from attendance records
        const leaveRequestIds = [...new Set(
            employeesOnLeave
                .map(record => record.leaveRequestId)
                .filter(id => id !== null && id !== undefined)
        )];

        // If no leave request IDs found, return attendance records as is
        if (leaveRequestIds.length === 0) {
            return employeesOnLeave;
        }

        // Fetch leave requests to get leaveConfigId
        const leaveRequests = await employeeLeaveRequest.findAll({
            where: {
                leaveRequestId: {
                    [Op.in]: leaveRequestIds
                },
                isDeleted: false
            },
            attributes: ['leaveRequestId', 'leaveConfigId'],
            raw: true
        });

        // Create a map for quick lookup: leaveRequestId -> leaveConfigId
        const leaveRequestToConfigMap = leaveRequests.reduce((map, request) => {
            map[request.leaveRequestId] = request.leaveConfigId;
            return map;
        }, {} as Record<string, string>);

        // Enrich attendance records with leaveConfigId
        const enrichedAttendanceRecords = employeesOnLeave.map(record => ({
            ...record,
            leaveConfigId: leaveRequestToConfigMap[record.leaveRequestId] || null
        }));

        return enrichedAttendanceRecords;
    } catch (error) {
        console.error("Error fetching employees on leave:", error);
        throw error;
    }
};

/**
 * Fetch leave requests with their configuration details
 * @param leaveRequestIds - Array of leave request IDs
 * @returns Promise<Array> - Array of leave requests with config details
 */
export const fetchLeaveRequestsWithConfig = async (leaveRequestIds: string[]) => {
    try {
        // First, fetch the leave requests
        const leaveRequests = await employeeLeaveRequest.findAll({
            where: {
                leaveRequestId: {
                    [Op.in]: leaveRequestIds
                },
                isDeleted: false
            }
        });

        // Get unique leave config IDs
        const leaveConfigIds = [...new Set(leaveRequests.map(req => req.leaveConfigId))];

        // Fetch leave configurations separately
        const leaveConfigs = await employeeLeaveConfigurator.findAll({
            where: {
                leaveConfigId: {
                    [Op.in]: leaveConfigIds
                }
            },
            attributes: ['leaveType', 'leaveConfigId']
        });

        // Create a map for quick lookup
        const configMap = new Map();
        leaveConfigs.forEach(config => {
            configMap.set(config.leaveConfigId, config);
        });

        // Attach the config to each leave request
        const result = leaveRequests.map(request => ({
            ...request.toJSON(),
            leaveConfig: configMap.get(request.leaveConfigId) || null
        }));

        return result;
    } catch (error) {
        console.error("Error fetching leave requests with config:", error);
        throw error;
    }
};

/**
 * Find HR Repository Tool Admin users
 * This function finds users who have Tool Admin access to the HR Repository tool
 * @returns {Promise<Array>} Array of users with Tool Admin access to HR Repository
 */
export const findHRRepositoryToolAdminUsers = async () => {
    try {
        // Step 1: Find the toolId for HR Repository
        const hrRepositoryTool = await uamToolDetails.findOne({
            where: {
                name: 'HR Repository',
                isDeleted: false
            }
        });

        if (!hrRepositoryTool) {
            throw new Error('HR Repository tool not found');
        }

        // Step 2: Find the Tool Admin user group id
        const toolAdminGroup = await uamUserGroups.findOne({
            where: {
                role: 'Tool Admin',
                isDeleted: false
            }
        });

        if (!toolAdminGroup) {
            throw new Error('Tool Admin user group not found');
        }

        // Step 3: Find userIds from uamToolUsers where toolId = HR Repository and userGroupId = Tool Admin
        const toolUsers = await uamToolUsers.findAll({
            where: {
                toolId: hrRepositoryTool.toolId,
                userGroupId: toolAdminGroup.id
            }
        });

        if (!toolUsers || toolUsers.length === 0) {
            return [];
        }

        // Step 4: Get the userIds
        const userIds = toolUsers.map(user => user.userId);

        // Step 5: Find users from tmsUsers using the userIds
        const users = await tmsUsers.findAll({
            where: {
                userId: {
                    [Op.in]: userIds
                },
                isDeleted: false
            },
            raw: true // This returns plain objects instead of Sequelize model instances
        });

        return users;
    } catch (error) {
        console.error("Error finding HR Repository Tool Admin users:", error);
        throw error;
    }
};



export const fetchAllNotificationsService = async (empUuid: string, transaction?: Transaction) => {
    try {
        const notifications = await hrmsNotificationLogs.findAll({
            where: {
                recipient_employee_id: empUuid,
                notificationType: {
                    [Op.in]: [hrmsNotificationTypes.MY_UPDATES, hrmsNotificationTypes.ORGANIZATION_UPDATES]
                },
                is_deleted: false
            },
            order: [['notification_effective_date', 'DESC']],
            transaction
        });

        const groupedNotifications = {
            myUpdates: notifications.filter(n => n.notificationType === hrmsNotificationTypes.MY_UPDATES),
            organizationUpdates: notifications.filter(n => n.notificationType === hrmsNotificationTypes.ORGANIZATION_UPDATES),
            // all: notifications
        };

        return groupedNotifications;
    } catch (error) {
        console.error("Error fetching all notifications:", error);
        throw error;
    }
}

export const findEmployeeDetailsByUuid = async (empUuidList: string[], transaction?: Transaction) => {
    try {
        if (!empUuidList || empUuidList.length === 0) {
            throw new Error("Employee UUID list is required");
        }

        const employeeEmail = await employeeContact.findAll({
            where: {
                empUuid: {
                    [Op.in]: empUuidList
                },
                isDeleted: false
            },
            raw: true,
            transaction
        });
        return employeeEmail;
    } catch (error) {
        console.error("Error finding employee details by UUID:", error);
        throw error;

    }
}

/**
 * Fetches used leaves till a specific date in the fiscal year
 * @param {string} empUuid - The employee UUID
 * @param {string} leaveConfigId - The leave configuration ID
 * @param {Date} tillDate - The date till which to calculate used leaves
 * @param {Date} fiscalYearStart - The fiscal year start date
 * @returns {Promise<number>} Total used leaves till the specified date
 */
export const fetchUsedLeavesTillDate = async (
    empUuid: string,
    leaveConfigId: string,
    tillDate: Date,
    fiscalYearStart: Date,
    transaction?: Transaction
): Promise<number> => {
    try {
        // **Check attendance table for non-deleted leaves**
        // First, get all non-deleted attendance records for the employee within the date range
        const attendanceRecords = await employeeAttendance.findAll({
            where: {
                empUuid,
                attendanceDate: {
                    [Op.between]: [fiscalYearStart, tillDate]
                },
                attendanceStatus: {
                    [Op.in]: [AttendanceStatusType.ON_LEAVE, AttendanceStatusType.HALF_DAY]
                },
                leaveRequestId: {
                    [Op.not]: null // Only records with leave request IDs
                },
                isDeleted: false // Only non-deleted attendance records
            },
            transaction
        });

        if (attendanceRecords.length === 0) {
            return 0;
        }

        // Get unique leave request IDs from attendance records
        const leaveRequestIds = [...new Set(attendanceRecords.map(record => record.leaveRequestId).filter(Boolean))];

        // Now get the leave requests with the specific leaveConfigId and approved status
        const leaveRequests = await employeeLeaveRequest.findAll({
            where: {
                leaveRequestId: {
                    [Op.in]: leaveRequestIds
                },
                empUuid,
                leaveConfigId,
                approvalStatus: LeaveApprovalStatus.APPROVED,
                isDeleted: false
            },
            transaction
        });

        // Calculate total days from attendance records that match approved leave requests
        const approvedLeaveRequestIds = new Set(leaveRequests.map(req => req.leaveRequestId));

        // **FIXED: Count days properly - HALF_DAY = 0.5, ON_LEAVE = 1.0**
        const totalUsedDays = attendanceRecords
            .filter(record => approvedLeaveRequestIds.has(record.leaveRequestId))
            .reduce((total, record) => {
                // Half-day leaves count as 0.5, full-day leaves count as 1.0
                const dayValue = record.attendanceStatus === AttendanceStatusType.HALF_DAY ? 0.5 : 1.0;
                return total + dayValue;
            }, 0);

        return totalUsedDays;
    } catch (error) {
        console.error("Error fetching used leaves till date:", error);
        throw error;
    }
};

// Fetches employee current job details by employee UUID(s)
// The details are fetched based on the employee conversion date
// If conversion date is in future, fetch the job details whose conversion date is the nearest past date
// Accepts single empUuid or array of empUuids
export const fetchEmployeeCurrentJobDetails = async (
    empUuid: string | string[],
    transaction?: Transaction
): Promise<any | Map<string, any> | null> => {
    try {
        const isArray = Array.isArray(empUuid);
        const empUuids = isArray ? empUuid : [empUuid];

        if (empUuids.length === 0) {
            return isArray ? new Map<string, any>() : null;
        }

        // Fetch all job details for the employee(s)
        const allJobDetails = await employeeJobDetails.findAll({
            where: {
                empUuid: { [Op.in]: empUuids },
                isDeleted: false
            },
            raw: true,
            transaction
        });

        // If single employee and no job details found, return null
        if (!isArray && allJobDetails.length === 0) {
            return null;
        }

        const jobDetailsMap = new Map<string, any>();
        const currentDate = new Date();
        const employeesWithFutureConversion: string[] = [];

        for (const job of allJobDetails) {
            if (new Date(job.empConversionDate) <= currentDate) {
                // Conversion date is today or in past - use current job details
                jobDetailsMap.set(job.empUuid, job);
            } else {
                // Conversion date is in future - need to check history
                employeesWithFutureConversion.push(job.empUuid);
            }
        }

        // For employees with future conversion date, fetch from history
        if (employeesWithFutureConversion.length > 0) {
            const historyDetails = await employeeJobDetailHistory.findAll({
                where: {
                    empUuid: { [Op.in]: employeesWithFutureConversion },
                    empConversionDate: {
                        [Op.lte]: currentDate
                    },
                    isDeleted: false
                },
                order: [['createdAt', 'DESC']],
                raw: true,
                transaction
            });

            // Group history by empUuid and get the most recent one for each
            const historyMap = new Map<string, any>();
            for (const history of historyDetails) {
                if (!historyMap.has(history.empUuid)) {
                    historyMap.set(history.empUuid, history);
                }
            }

            // For employees with future conversion, use history if available, otherwise use current job details
            for (const uuid of employeesWithFutureConversion) {
                const historyJob = historyMap.get(uuid);
                if (historyJob) {
                    jobDetailsMap.set(uuid, historyJob);
                } else {
                    // No history found, use the current job details (even if conversion is in future)
                    const currentJob = allJobDetails.find(j => j.empUuid === uuid);
                    if (currentJob) {
                        jobDetailsMap.set(uuid, currentJob);
                    }
                }
            }
        }

        // Return appropriate format based on input type
        if (isArray) {
            return jobDetailsMap;
        } else {
            return jobDetailsMap.get(empUuid as string) || null;
        }
    } catch (error) {
        console.error("Error fetching employee current job details:", error);
        throw error;
    }
};


export const createWorkRequestService = async (requestedData, user, transaction) => {
    try {
        const extraWorkDayId = await createUUIDV4();
        const totalCompOffCredit = requestedData.totalDuration > 7 ? 1 : 0.5;
        const createWorkLogData = await employeeExtraWorkLog.create({
            extraWorkDayId,
            empUuid: requestedData.empUuid,
            leaveConfigId: requestedData.leaveConfigId,
            workDate: requestedData.workDate,
            checkIn: requestedData.checkIn,
            checkOut: requestedData.checkOut,
            remarks: requestedData.remarks,
            proof: requestedData.proof,
            totalDuration: requestedData.totalDuration,
            totalCompOffCredit,
            requestBy: user.employeeUuid,
            approvalStatus: LeaveApprovalStatus.PENDING,
            isDeleted: false
        },
            { transaction });
        return createWorkLogData;
    } catch (error) {
        console.error("Error creating work request:", error);
        throw error;
    }
}

export const fetchExtraWorkLogRequestsService = async (startDate?: string, endDate?: string, empCompanyId?: string) => {
    try {
        const whereClause: any = {
            approvalStatus: LeaveApprovalStatus.PENDING,
            isDeleted: false
        };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);

            whereClause.createdAt = {
                [Op.between]: [start, end]
            };
        } else if (startDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            whereClause.createdAt = {
                [Op.gte]: start
            };
        } else if (endDate) {
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            whereClause.createdAt = {
                [Op.lte]: end
            };
        }

        if (empCompanyId) {
            const orgEmployees = await employeeBasicDetails.findAll({
                where: { empCompanyId, isDeleted: false },
                attributes: ['empUuid'],
                raw: true
            });
            const validEmpUuids = orgEmployees.map((e: any) => e.empUuid);
            whereClause.empUuid = { [Op.in]: validEmpUuids };
        } else {
            whereClause.empUuid = null;
        }

        const workLogRequests = await employeeExtraWorkLog.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            raw: true
        });

        return workLogRequests;
    } catch (error) {
        console.error("Error fetching extra work log requests:", error);
        throw error;
    }
}

export const updateExtraWorkLogRequestStatusService = async (
    extraWorkDayIds: string[],
    action: LeaveApprovalStatus,
    user,
    transaction?: Transaction
) => {
    try {
        if (!extraWorkDayIds || extraWorkDayIds.length === 0) {
            throw new Error("No extra work day IDs provided");
        }

        if (![LeaveApprovalStatus.APPROVED, LeaveApprovalStatus.REJECTED].includes(action)) {
            throw new Error("Invalid action. Must be approved or rejected");
        }

        const BATCH_SIZE = 50;
        const totalIds = extraWorkDayIds.length;
        let totalUpdated = 0;

        // Process in batches
        for (let i = 0; i < totalIds; i += BATCH_SIZE) {
            const batch = extraWorkDayIds.slice(i, i + BATCH_SIZE);

            // Build update data
            const updateData: any = {
                approvalStatus: action,
                approvedBy: user.employeeUuid,
                approvalDate: new Date()
            };

            if (action === LeaveApprovalStatus.APPROVED) {
                // Fetch the logs to get their workDate for calculations
                const logs = await employeeExtraWorkLog.findAll({
                    where: {
                        extraWorkDayId: { [Op.in]: batch },
                        isDeleted: false
                    },
                    attributes: ['extraWorkDayId', 'workDate'],
                    transaction
                });

                // Update each record individually to calculate expiry date in JS
                let batchUpdatedCount = 0;
                for (const log of logs) {
                    const expiryDate = new Date(log.workDate);
                    expiryDate.setDate(expiryDate.getDate() + 90);

                    const [count] = await employeeExtraWorkLog.update(
                        {
                            ...updateData,
                            compOffExpiryDate: expiryDate
                        },
                        {
                            where: { extraWorkDayId: log.extraWorkDayId },
                            transaction
                        }
                    );
                    batchUpdatedCount += count;
                }
                totalUpdated += batchUpdatedCount;
            } else {
                // Execute batch update for rejections as no date calculation is needed
                const [updatedCount] = await employeeExtraWorkLog.update(
                    updateData,
                    {
                        where: {
                            extraWorkDayId: {
                                [Op.in]: batch
                            },
                            isDeleted: false
                        },
                        transaction
                    }
                );
                totalUpdated += updatedCount;
            }

            console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(totalIds / BATCH_SIZE)} - Batch total processed: ${batch.length}`);
        }

        return {
            success: true,
            totalRequested: totalIds,
            totalUpdated: totalUpdated,
            action: action,
            message: `Successfully ${action} ${totalUpdated} out of ${totalIds} extra work log request(s)`
        };
    } catch (error) {
        console.error("Error updating extra work log request status:", error);
        throw error;
    }
}

export const getCompOffleaveBalanceService = async (empUuid: string) => {
    try {
        const compOffleaveBalance = await employeeExtraWorkLog.findAll({
            where: {
                empUuid,
                approvalStatus: LeaveApprovalStatus.APPROVED,
                isDeleted: false,
                compOffExpiryDate: {
                    [Op.gte]: new Date()
                }
            },
            order: [['createdAt', 'DESC']],
            raw: true
        });
        return compOffleaveBalance;
    } catch (error) {
        console.error("Error getting comp off leave balance:", error);
        throw error;
    }
}
/**
 * Get active employees' official emails
 * @returns Array of objects { empUuid, empOfficialEmail }
 */
export const getActiveEmployeesOfficialEmails = async () => {
    try {
        const activeEmployees = await employeeBasicDetails.findAll({
            where: {
                isActive: true,
                isDeleted: false
            },
            attributes: ['empUuid'],
        });

        const activeEmpUuids = activeEmployees.map((e: { empUuid: string }) => e.empUuid);
        if (activeEmpUuids.length === 0) return [];

        const contacts = await employeeContact.findAll({
            where: {
                empUuid: { [Op.in]: activeEmpUuids },
                isDeleted: false
            },
            attributes: ['empUuid', 'empOfficialEmail'],
        });

        return contacts;
    } catch (error) {
        console.error("Error getting active employees official emails:", error);
        return [];
    }
};

const EMPLOYEE_DETAILS_MAIL_PERMISSIONS = [
    'EmployeeDetailsRequest_write',
    'EmployeeDetailsRequest_read',
    'ActiveEmployee_update',
    'ActiveEmployee_read',
];

/**
 * Get employees who should receive employee personal details update notification emails.
 * Anyone with any of: EmployeeDetailsRequest_write, EmployeeDetailsRequest_read, ActiveEmployee_update, ActiveEmployee_read.
 * @returns Array of { empUuid, empOfficialEmail }
 */
export const getEmployeeDetailsMailRecipients = async () => {
    try {
        const activeContacts = await getActiveEmployeesOfficialEmails();
        if (!activeContacts || activeContacts.length === 0) return [];

        const recipients: Array<{ empUuid: string; empOfficialEmail: string }> = [];
        for (const c of activeContacts) {
            try {
                const hasPerm = await checkHrmsPermission(
                    c.empUuid,
                    EMPLOYEE_DETAILS_MAIL_PERMISSIONS,
                    hrmsConstants.HR_REPOSITORY,
                    undefined
                );
                if (hasPerm && c.empOfficialEmail) {
                    recipients.push({ empUuid: c.empUuid, empOfficialEmail: c.empOfficialEmail });
                }
            } catch (permErr) {
                console.error('Error checking Employee Details permission for emp', c.empUuid, permErr);
            }
        }
        return recipients;
    } catch (error) {
        console.error('Error fetching employee details mail recipients:', error);
        throw error;
    }
};

export const checkIsEmployeeManager = async (empUuid: string): Promise<boolean> => {
    try {
        const employee = await employeeBasicDetails.findOne({
            where: {
                empUuid,
                isDeleted: false
            },
            attributes: ['isManager'],
        });
        return employee?.isManager;
    } catch (error) {
        console.error("Error checking if employee is manager:", error);
        return false;
    }
};
export const fetchEmployeeExtraWorkHistory = async (empUuid: string) => {
    try {
        const empExtraWorkHistory = await employeeExtraWorkLog.findAll({
            where: { empUuid, isDeleted: false },
            attributes: { exclude: ['proof'] },
            order: [['updatedAt', 'DESC']]
        });
        return empExtraWorkHistory;
    } catch (error) {
        console.error("Error fetching employee extra work history:", error);
        throw error;
    }
};

export const fetchAllHistoryLeaveRequests = async (
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    pageSize: number = 10,
    empCompanyId?: string
) => {
    // 1. Interfaces for Type Safety
    interface ApplicationDateCondition {
        [Op.between]?: [Date, Date];
        [Op.gte]?: Date;
        [Op.lte]?: Date;
    }

    interface LeaveStatusCondition {
        [Op.in]: LeaveApprovalStatus[];
    }

    interface ApprovalUpdate {
        approvalStatus: LeaveStatusCondition;
        applicationDate?: ApplicationDateCondition;
        empUuid?: any;
        isDeleted: boolean;
    }

    // 2. Define the Query Filters
    const whereCondition: ApprovalUpdate = {
        approvalStatus: {
            [Op.in]: [LeaveApprovalStatus.REJECTED, LeaveApprovalStatus.APPROVED],
        },
        isDeleted: false
    };

    // 3. Handle Date Range Logic
    if (startDate && endDate) {
        whereCondition.applicationDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
        whereCondition.applicationDate = { [Op.gte]: startDate };
    } else if (endDate) {
        whereCondition.applicationDate = { [Op.lte]: endDate };
    }

    // 4. Calculate Offset (How many records to skip)
    const offset = (page - 1) * pageSize;

    // Filter by Organization
    if (empCompanyId) {
        const orgEmployees = await employeeBasicDetails.findAll({
            where: { empCompanyId, isDeleted: false },
            attributes: ['empUuid'],
            raw: true
        });
        const validEmpUuids = orgEmployees.map((e: any) => e.empUuid);
        whereCondition.empUuid = { [Op.in]: validEmpUuids };
    } else {
        whereCondition.empUuid = null;
    }

    try {
        // 5. Query the Database
        const { count, rows } = await employeeLeaveRequest.findAndCountAll({
            where: whereCondition as any,
            // We can now safely include attachmentPath because we only fetch 10 at a time
            attributes: { exclude: [] }, 
            order: [['applicationDate', 'DESC']], // History usually shows newest first
            limit: pageSize,
            offset: offset,
        });

        // 6. Return Structured Data for Frontend
        return {
            totalRecords: count,
            totalPages: Math.ceil(count / pageSize),
            currentPage: Number(page),
            pageSize: Number(pageSize),
            data: rows
        };
    } catch (error) {
        console.error("Error in fetchAllHistoryLeaveRequests service:", error);
        throw error;
    }
};

export const fetchExtraWorkLogRequestsServiceHistory = async (
    page: number = 1,
    pageSize: number = 10,
    startDate?: string, 
    endDate?: string,
    empCompanyId?: string
) => {
    try {
        const limitNum = pageSize;
        const offset = (page - 1) * limitNum;

        const whereClause: any = {
            approvalStatus: {
                [Op.in]: [LeaveApprovalStatus.APPROVED, LeaveApprovalStatus.REJECTED]
            },
            isDeleted: false
        };

        // Date range logic
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            whereClause.workDate = { [Op.between]: [start, end] };
        } else if (startDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            whereClause.workDate = { [Op.gte]: start };
        } else if (endDate) {
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            whereClause.workDate = { [Op.lte]: end };
        }

        if (empCompanyId) {
            const orgEmployees = await employeeBasicDetails.findAll({
                where: { empCompanyId, isDeleted: false },
                attributes: ['empUuid'],
                raw: true
            });
            const validEmpUuids = orgEmployees.map((e: any) => e.empUuid);
            whereClause.empUuid = { [Op.in]: validEmpUuids };
        } else {
            whereClause.empUuid = null;
        }

        // Execute paginated query
        const { count, rows } = await employeeExtraWorkLog.findAndCountAll({
            where: whereClause,
            order: [['updatedAt', 'DESC']],
            limit: limitNum,
            offset: offset,
            raw: true // CRITICAL: This keeps the data as a Buffer object
        });

        // Return rows directly. 
        // Express/JSON.stringify will handle the conversion to { type: "Buffer", data: [...] }
        return {
            rows: rows, 
            pagination: {
                totalRecords: count,
                totalPages: Math.ceil(count / limitNum) || 1,
                currentPage: page,
                pageSize: limitNum
            }
        };
    } catch (error) {
        console.error("Error in fetchExtraWorkLogRequestsServiceHistory Service:", error);
        throw error;
    }
};
