import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeOffBoardingAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";
import { offboardingStatus } from "../../../../interfaces/hrmsTool/enum/hrmsEnum";

export class employeeOffboarding 
extends Model<EmployeeOffBoardingAttributes, Partial<EmployeeOffBoardingAttributes>> 
implements EmployeeOffBoardingAttributes {
    declare offboardingId: string;
    declare empUuid: string;
    declare offboardingStatus: offboardingStatus;
    declare lastWorkingDay?: Date;
    declare hrClearanceStatus: boolean;
    declare hrClearanceDate?: Date;
    declare hrClearanceBy?: string;
    declare financeClearanceStatus: boolean;
    declare financeClearanceDate?: Date;
    declare financeClearanceBy?: string;
    declare finalApprovalStatus: boolean;
    declare finalApprovalDate?: Date;
    declare finalApprovalBy?: string;
    declare readonly isDeleted?: boolean;
    declare readonly createdAt?: Date;
    declare readonly updatedAt?: Date;
    declare createdBy?: string;
    declare updatedBy?: string;
}

export const initEmployeeOffboarding = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    employeeOffboarding.init(
        {
            offboardingId: {
                type: dataTypes.UUID,
                primaryKey: true,
                allowNull: false,
            },
            empUuid: {
                type: dataTypes.UUID,
                allowNull: false,
            },
            offboardingStatus: {
                type: dataTypes.ENUM,
                values: Object.values(offboardingStatus),
                allowNull: false,
                validate: {
                    isIn: {
                        args: [Object.values(offboardingStatus)],
                        msg: 'Offboarding status must be initiated or approved or on_hold or rejected'
                    }
                }
            },
            lastWorkingDay: {
                type: dataTypes.DATEONLY,
                allowNull: true,
            },
            hrClearanceStatus: {
                type: dataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            hrClearanceDate: {
                type: dataTypes.DATE,
                allowNull: true,
            },
            hrClearanceBy: {
                type: dataTypes.STRING,
                allowNull: true,
            },
            financeClearanceStatus: {
                type: dataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            financeClearanceDate: {
                type: dataTypes.DATE,
                allowNull: true,
            },
            financeClearanceBy: {
                type: dataTypes.STRING,
                allowNull: true,
            },
            finalApprovalStatus: {
                type: dataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            finalApprovalDate: {
                type: dataTypes.DATE,
                allowNull: true,
            },
            finalApprovalBy: {
                type: dataTypes.STRING,
                allowNull: true,
            },
            isDeleted: {
                type: dataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            createdBy: {
                type: dataTypes.STRING,
                allowNull: true,
            },
            updatedBy: {
                type: dataTypes.STRING,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'employeeOffboarding',
            tableName: 'employee_offboarding',
            timestamps: true,
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
            indexes: [
                // COMPOSITE INDEX 1: Most common query pattern - active offboarding records by employee
                // Supports: WHERE empUuid = ? AND isDeleted = false AND offboardingStatus = ?
                {
                    name: 'idx_emp_status_active',
                    fields: ['empUuid', 'isDeleted', 'offboardingStatus'],
                    where: { isDeleted: false }, 
                },

                // COMPOSITE INDEX 2: Clearance workflow tracking
                // Supports: WHERE offboardingStatus = ? AND hrClearanceStatus = ? AND financeClearanceStatus = ?
                {
                    name: 'idx_workflow_clearances',
                    fields: ['offboardingStatus', 'hrClearanceStatus', 'financeClearanceStatus', 'finalApprovalStatus'],
                },

                // COMPOSITE INDEX 3: Date-based reporting and analytics
                // Supports: WHERE createdAt BETWEEN ? AND ? AND isDeleted = false
                {
                    name: 'idx_created_active',
                    fields: ['createdAt', 'isDeleted', 'offboardingStatus'],
                },

                // COMPOSITE INDEX 4: HR clearance pending items
                // Supports: WHERE hrClearanceStatus = false AND isDeleted = false ORDER BY createdAt
                {
                    name: 'idx_hr_pending',
                    fields: ['hrClearanceStatus', 'isDeleted', 'createdAt'],
                    where: { hrClearanceStatus: false, isDeleted: false },
                },

                // COMPOSITE INDEX 5: Finance clearance pending items
                // Supports: WHERE financeClearanceStatus = false AND isDeleted = false ORDER BY createdAt
                {
                    name: 'idx_finance_pending',
                    fields: ['financeClearanceStatus', 'isDeleted', 'createdAt'],
                    where: { financeClearanceStatus: false, isDeleted: false },
                },

                // COMPOSITE INDEX 6: Final approval tracking by approver
                // Supports: WHERE finalApprovalBy = ? AND finalApprovalDate BETWEEN ? AND ?
                {
                    name: 'idx_final_approval_tracking',
                    fields: ['finalApprovalBy', 'finalApprovalDate', 'finalApprovalStatus'],
                },

                // SINGLE COLUMN INDEX: For unique employee lookup in foreign key joins
                // Keep this if empUuid is used frequently in JOIN operations
                {
                    name: 'idx_empUuid',
                    fields: ['empUuid'],
                },

                // COVERING INDEX: Fast dashboard queries for statistics
                // Supports aggregate queries: COUNT, GROUP BY offboardingStatus
                {
                    name: 'idx_status_covering',
                    fields: ['offboardingStatus', 'isDeleted', 'createdAt', 'hrClearanceStatus', 'financeClearanceStatus'],
                    where: { isDeleted: false },
                },
            ]
        }
    );
    return employeeOffboarding;
};