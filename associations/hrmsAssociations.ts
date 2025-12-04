// associations/setupAssociations.ts
import { dbOutput } from "../models/index";

export const setupHrmsAssociations = (): void => {
    // ============================================================ employeeLeaveBalanceDetails ORM relations  ==================================================================
    // Many-to-One
    dbOutput.employeeLeaveBalanceDetails.belongsTo(dbOutput.employeeBasicDetails, {
        foreignKey: 'empUuid',
        targetKey: 'empUuid',
        as: 'employee',
        onUpdate: 'CASCADE',
    });
    // Many-to-One 
    dbOutput.employeeLeaveBalanceDetails.belongsTo(dbOutput.employeeLeaveConfigurator, {
        foreignKey: 'leaveConfigId',
        targetKey: 'leaveConfigId',
        as: 'leaveConfig',
        onUpdate: 'CASCADE',
    });
    // One-to-Many
    dbOutput.employeeBasicDetails.hasMany(dbOutput.employeeLeaveBalanceDetails, {
        foreignKey: 'empUuid',
        sourceKey: 'empUuid',
        as: 'leaveBalances'
    });
    // One-to-Many
    dbOutput.employeeLeaveConfigurator.hasMany(dbOutput.employeeLeaveBalanceDetails, {
        foreignKey: 'leaveConfigId',
        sourceKey: 'leaveConfigId',
        as: 'leaveBalances'
    });


    // ================================================================= employeeAttendanceDetails ORM relations =========================================================================
    // Many-to-One
    dbOutput.employeeAttendanceDetails.belongsTo(dbOutput.employeeBasicDetails, {
        foreignKey: 'empUuid',
        targetKey: 'empUuid',
        as: 'employee',
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    });
    // Many-to-One
    dbOutput.employeeAttendanceDetails.belongsTo(dbOutput.employeeLeaveRequestDetails, {
        foreignKey: 'leaveRequestId',
        targetKey: 'leaveRequestId',
        as: 'leaveRequest',
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    });
    // One-to-Many
    dbOutput.employeeBasicDetails.hasMany(dbOutput.employeeAttendanceDetails, {
        foreignKey: 'empUuid',
        sourceKey: 'empUuid',
        as: 'attendanceRecords'
    });
    
    // One-to-One: employeeBasicDetails -> employeeJobDetails (latest/current job record)
    if (dbOutput.employeeJobDetails) {
        dbOutput.employeeBasicDetails.hasOne(dbOutput.employeeJobDetails, {
            foreignKey: 'empUuid',
            sourceKey: 'empUuid',
            as: 'jobDetails',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });

        dbOutput.employeeJobDetails.belongsTo(dbOutput.employeeBasicDetails, {
            foreignKey: 'empUuid',
            targetKey: 'empUuid',
            as: 'employee',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });
    }

    // One-to-One: employeeBasicDetails -> employeeAddressDetails (address/location)
    if (dbOutput.employeeAddressDetails) {
        dbOutput.employeeBasicDetails.hasOne(dbOutput.employeeAddressDetails, {
            foreignKey: 'empUuid',
            sourceKey: 'empUuid',
            as: 'addressDetails',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });

        dbOutput.employeeAddressDetails.belongsTo(dbOutput.employeeBasicDetails, {
            foreignKey: 'empUuid',
            targetKey: 'empUuid',
            as: 'employee',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });
    }

    // One-to-Many
    dbOutput.employeeLeaveRequestDetails.hasMany(dbOutput.employeeAttendanceDetails, {
        foreignKey: 'leaveRequestId',
        sourceKey: 'leaveRequestId',
        as: 'attendanceRecords'
    });



    // ========================================================================= employeeLeaveRequestDetails ORM relations ==================================================================
    // Many-to-One
    dbOutput.employeeLeaveRequestDetails.belongsTo(dbOutput.employeeBasicDetails, {
        foreignKey: 'empUuid',
        targetKey: 'empUuid',
        as: 'employee',
        onUpdate: 'CASCADE',
    });
    // Many-to-One
    dbOutput.employeeLeaveRequestDetails.belongsTo(dbOutput.employeeLeaveConfigurator, {
        foreignKey: 'leaveConfigId',
        targetKey: 'leaveConfigId',
        as: 'leaveConfig',
        onUpdate: 'CASCADE',
    });
    // Many-to-One
    dbOutput.employeeLeaveRequestDetails.belongsTo(dbOutput.employeeBasicDetails, {
        foreignKey: 'approvedBy',
        targetKey: 'empUuid',
        as: 'approver',
        onUpdate: 'CASCADE',
    });
    // One-to-Many
    dbOutput.employeeBasicDetails.hasMany(dbOutput.employeeLeaveRequestDetails, {
        foreignKey: 'empUuid',
        sourceKey: 'empUuid',
        as: 'leaveRequests'
    });
    // One-to-Many
    dbOutput.employeeBasicDetails.hasMany(dbOutput.employeeLeaveRequestDetails, {
        foreignKey: 'approvedBy',
        sourceKey: 'empUuid',
        as: 'approvedLeaveRequests'
    });
    // One-to-Many
    dbOutput.employeeLeaveConfigurator.hasMany(dbOutput.employeeLeaveRequestDetails, {
        foreignKey: 'leaveConfigId',
        sourceKey: 'leaveConfigId',
        as: 'leaveRequests'
    });


    // ===================================================================================employeeHolidayDetails ORM model ===================================================================
    // Many-to-One
    dbOutput.employeeHolidayDetails.belongsTo(dbOutput.employeeBasicDetails, {
        foreignKey: 'createdBy',
        targetKey: 'empUuid',
        as: 'creator',
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
    });
    // One-to-Many
    dbOutput.employeeBasicDetails.hasMany(dbOutput.employeeHolidayDetails, {
        foreignKey: 'createdBy',
        sourceKey: 'empUuid',
        as: 'createdHolidays'
    });

    if (dbOutput.salaryCategories && dbOutput.salaryComponents) {
        // One-to-Many: salaryCategories -> salaryComponents
        dbOutput.salaryCategories.hasMany(dbOutput.salaryComponents, {
            foreignKey: 'salaryCategoryId',
            sourceKey: 'salaryCategoryId',
            as: 'salaryComponents',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });

        // Many-to-One: salaryComponents -> salaryCategories
        dbOutput.salaryComponents.belongsTo(dbOutput.salaryCategories, {
            foreignKey: 'salaryCategoryId',
            targetKey: 'salaryCategoryId',
            as: 'salaryCategory',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });
    }

    if (dbOutput.employeePayslipRecords && dbOutput.employeePayslipItems) {
        // One-to-Many: employeePayslipRecords -> employeePayslipItems
        dbOutput.employeePayslipRecords.hasMany(dbOutput.employeePayslipItems, {
            foreignKey: 'payslipId',
            sourceKey: 'payslipId',
            as: 'payslipItems',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });
        
        // Many-to-One: employeePayslipItems -> employeePayslipRecords
        dbOutput.employeePayslipItems.belongsTo(dbOutput.employeePayslipRecords, {
            foreignKey: 'payslipId',
            targetKey: 'payslipId',
            as: 'payroll',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });
    }

    if (dbOutput.salaryComponents && dbOutput.employeeComponentAdjustments) {
        // One-to-Many: salaryComponents -> employeeComponentAdjustments
        dbOutput.salaryComponents.hasMany(dbOutput.employeeComponentAdjustments, {
            foreignKey: 'componentId',
            sourceKey: 'componentId',
            as: 'componentAdjustments',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });

        // Many-to-One: employeeComponentAdjustments -> salaryComponents
        dbOutput.employeeComponentAdjustments.belongsTo(dbOutput.salaryComponents, {
            foreignKey: 'componentId',
            targetKey: 'componentId',
            as: 'salaryComponent',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });
    }
};
