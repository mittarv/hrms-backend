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

    if (dbOutput.employeeLeaveConfigurator && dbOutput.employeeExtraWorkDay) {
        // One-to-Many: employeeLeaveConfigurator -> employeeExtraWorkDay
        dbOutput.employeeLeaveConfigurator.hasMany(dbOutput.employeeExtraWorkDay, {
            foreignKey: 'leaveConfigId',
            sourceKey: 'leaveConfigId',
            as: 'extraWorkDays',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });

        // Many-to-One: employeeExtraWorkDay -> employeeLeaveConfigurator
        dbOutput.employeeExtraWorkDay.belongsTo(dbOutput.employeeLeaveConfigurator, {
            foreignKey: 'leaveConfigId',
            targetKey: 'leaveConfigId',
            as: 'leaveConfig',
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });
    }

    // =========================================== HRMS Access Management Associations ===========================================
    if (dbOutput.hrmsAccessRole && dbOutput.hrmsAccessPermission && dbOutput.hrmsAccessRolePermission) {
        // Many-to-Many: Role ↔ Permission through RolePermission
        dbOutput.hrmsAccessRole.belongsToMany(dbOutput.hrmsAccessPermission, {
            through: dbOutput.hrmsAccessRolePermission,
            foreignKey: 'roleId',
            otherKey: 'permissionId',
            as: 'permissions',
            constraints: true,
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        dbOutput.hrmsAccessPermission.belongsToMany(dbOutput.hrmsAccessRole, {
            through: dbOutput.hrmsAccessRolePermission,
            foreignKey: 'permissionId',
            otherKey: 'roleId',
            as: 'roles',
            constraints: true,
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        // One-to-Many: Role -> RolePermission
        dbOutput.hrmsAccessRole.hasMany(dbOutput.hrmsAccessRolePermission, {
            foreignKey: 'roleId',
            sourceKey: 'roleId',
            as: 'rolePermissions',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        // One-to-Many: Permission -> RolePermission
        dbOutput.hrmsAccessPermission.hasMany(dbOutput.hrmsAccessRolePermission, {
            foreignKey: 'permissionId',
            sourceKey: 'permissionId',
            as: 'rolePermissions',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        // Many-to-One: RolePermission -> Role
        dbOutput.hrmsAccessRolePermission.belongsTo(dbOutput.hrmsAccessRole, {
            foreignKey: 'roleId',
            targetKey: 'roleId',
            as: 'role',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        // Many-to-One: RolePermission -> Permission
        dbOutput.hrmsAccessRolePermission.belongsTo(dbOutput.hrmsAccessPermission, {
            foreignKey: 'permissionId',
            targetKey: 'permissionId',
            as: 'permission',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
    }

    // HRMS Employee Role Associations
    if (dbOutput.hrmsEmployeeRole && dbOutput.employeeBasicDetails && dbOutput.hrmsAccessRole) {
        // Many-to-One: EmployeeRole -> Employee
        dbOutput.hrmsEmployeeRole.belongsTo(dbOutput.employeeBasicDetails, {
            foreignKey: 'empUuid',
            targetKey: 'empUuid',
            as: 'employee',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        // Many-to-One: EmployeeRole -> Role
        dbOutput.hrmsEmployeeRole.belongsTo(dbOutput.hrmsAccessRole, {
            foreignKey: 'roleId',
            targetKey: 'roleId',
            as: 'role',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        // One-to-Many: Employee -> EmployeeRoles
        dbOutput.employeeBasicDetails.hasMany(dbOutput.hrmsEmployeeRole, {
            foreignKey: 'empUuid',
            sourceKey: 'empUuid',
            as: 'employeeRoles',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        // One-to-Many: Role -> EmployeeRoles
        dbOutput.hrmsAccessRole.hasMany(dbOutput.hrmsEmployeeRole, {
            foreignKey: 'roleId',
            sourceKey: 'roleId',
            as: 'employeeRoles',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
    }

    // ================================================================= HR Repository Associations =================================================================
    // PolicyList Associations
    if (dbOutput.policyList && dbOutput.tmsUsers) {
        // Many-to-One: PolicyList -> TmsUser (creator)
        dbOutput.policyList.belongsTo(dbOutput.tmsUsers, {
            foreignKey: 'createdBy',
            targetKey: 'userId',
            as: 'creator',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });

        // Many-to-One: PolicyList -> TmsUser (modifier)
        dbOutput.policyList.belongsTo(dbOutput.tmsUsers, {
            foreignKey: 'lastModifiedBy',
            targetKey: 'userId',
            as: 'modifier',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });

        // One-to-Many: TmsUser -> PolicyList (created)
        dbOutput.tmsUsers.hasMany(dbOutput.policyList, {
            foreignKey: 'createdBy',
            sourceKey: 'userId',
            as: 'createdPolicies'
        });

        // One-to-Many: TmsUser -> PolicyList (modified)
        dbOutput.tmsUsers.hasMany(dbOutput.policyList, {
            foreignKey: 'lastModifiedBy',
            sourceKey: 'userId',
            as: 'modifiedPolicies'
        });
    }

    // ImportantLinkList Associations
    if (dbOutput.importantLinkList && dbOutput.tmsUsers) {
        // Many-to-One: ImportantLinkList -> TmsUser (creator)
        dbOutput.importantLinkList.belongsTo(dbOutput.tmsUsers, {
            foreignKey: 'createdBy',
            targetKey: 'userId',
            as: 'creator',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });

        // Many-to-One: ImportantLinkList -> TmsUser (modifier)
        dbOutput.importantLinkList.belongsTo(dbOutput.tmsUsers, {
            foreignKey: 'lastModifiedBy',
            targetKey: 'userId',
            as: 'modifier',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });

        // One-to-Many: TmsUser -> ImportantLinkList (created)
        dbOutput.tmsUsers.hasMany(dbOutput.importantLinkList, {
            foreignKey: 'createdBy',
            sourceKey: 'userId',
            as: 'createdImportantLinks'
        });

        // One-to-Many: TmsUser -> ImportantLinkList (modified)
        dbOutput.tmsUsers.hasMany(dbOutput.importantLinkList, {
            foreignKey: 'lastModifiedBy',
            sourceKey: 'userId',
            as: 'modifiedImportantLinks'
        });
    }

    // =========================================== Rewards & Recognition Associations ===========================================
    // cycleId FK to reward_cycles is enforced. empUuid references have constraints: false (no DB FK) to avoid type/collation issues with employeebasicdetails.
    if (dbOutput.rewardCycle && dbOutput.nomination && dbOutput.employeeBasicDetails) {
        dbOutput.rewardCycle.hasMany(dbOutput.nomination, { foreignKey: 'cycleId', as: 'nominations' });
        dbOutput.nomination.belongsTo(dbOutput.rewardCycle, { foreignKey: 'cycleId', as: 'cycle' });
        dbOutput.nomination.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'nomineeEmpUuid', targetKey: 'empUuid', as: 'nominee', constraints: false });
        dbOutput.nomination.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'nominatedByEmpUuid', targetKey: 'empUuid', as: 'nominatedBy', constraints: false });
        dbOutput.nomination.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'removedByEmpUuid', targetKey: 'empUuid', as: 'removedBy', constraints: false });
    }
    if (dbOutput.rewardCycle && dbOutput.groupedCitation && dbOutput.employeeBasicDetails) {
        dbOutput.rewardCycle.hasMany(dbOutput.groupedCitation, { foreignKey: 'cycleId', as: 'groupedCitations' });
        dbOutput.groupedCitation.belongsTo(dbOutput.rewardCycle, { foreignKey: 'cycleId', as: 'cycle' });
        dbOutput.groupedCitation.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'nomineeEmpUuid', targetKey: 'empUuid', as: 'nominee', constraints: false });
        dbOutput.groupedCitation.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'createdByEmpUuid', targetKey: 'empUuid', as: 'createdBy', constraints: false });
    }
    if (dbOutput.rewardCycle && dbOutput.vote && dbOutput.employeeBasicDetails) {
        dbOutput.rewardCycle.hasMany(dbOutput.vote, { foreignKey: 'cycleId', as: 'votes' });
        dbOutput.vote.belongsTo(dbOutput.rewardCycle, { foreignKey: 'cycleId', as: 'cycle' });
        dbOutput.vote.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'nomineeEmpUuid', targetKey: 'empUuid', as: 'nominee', constraints: false });
        dbOutput.vote.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'votedByEmpUuid', targetKey: 'empUuid', as: 'votedBy', constraints: false });
    }
    if (dbOutput.rewardCycle && dbOutput.winner && dbOutput.employeeBasicDetails) {
        dbOutput.rewardCycle.hasMany(dbOutput.winner, { foreignKey: 'cycleId', as: 'winners' });
        dbOutput.winner.belongsTo(dbOutput.rewardCycle, { foreignKey: 'cycleId', as: 'cycle' });
        dbOutput.winner.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'employeeEmpUuid', targetKey: 'empUuid', as: 'employee', constraints: false });
        dbOutput.winner.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'announcedByEmpUuid', targetKey: 'empUuid', as: 'announcedBy', constraints: false });
    }
    if (dbOutput.rewardCycle && dbOutput.phaseAuditLog && dbOutput.employeeBasicDetails) {
        dbOutput.rewardCycle.hasMany(dbOutput.phaseAuditLog, { foreignKey: 'cycleId', as: 'phaseAuditLogs' });
        dbOutput.phaseAuditLog.belongsTo(dbOutput.rewardCycle, { foreignKey: 'cycleId', as: 'cycle' });
        dbOutput.phaseAuditLog.belongsTo(dbOutput.employeeBasicDetails, { foreignKey: 'triggeredByEmpUuid', targetKey: 'empUuid', as: 'triggeredBy', constraints: false });
    }
};

