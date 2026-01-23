import { DataTypes, Model, Sequelize } from 'sequelize';
import { LeaveApprovalStatus } from '../../../interfaces/hrmsTool/enum/hrmsEnum';
import { EmployeeLeaveRequestAttributes, EmployeeLeaveRequestCreationAttributes } from '../../../interfaces/hrmsTool/interface/hrmsInterface';

// Define the model class extending Sequelize Model
export class employeeLeaveRequestDetails extends Model<
  EmployeeLeaveRequestAttributes,
  EmployeeLeaveRequestCreationAttributes
> implements EmployeeLeaveRequestAttributes {
    public leaveRequestId!: string;
    public empUuid!: string;
    public leaveConfigId!: string;
    public startDate!: Date;
    public endDate!: Date;
    public totalDays!: number;
    public isHalfDay!: boolean;
    public remarks?: string;
    public applicationDate?: Date;
    public approvalStatus: LeaveApprovalStatus;
    public approvedBy?: string;
    public approvalDate?: Date;
    public attachmentPath?: string;
    public checkIn?: string;
    public checkOut?: string;
    public isDeleted: boolean;
    public readonly createdAt?: Date;
    public readonly updatedAt?: Date;
}

// Factory function to initialize the model
export const initEmployeeLeaveRequestDetails = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeLeaveRequestDetails.init(
    {
      leaveRequestId: {
        type: dataTypes.UUID,
        primaryKey: true,
        allowNull: false,
      },
      empUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      leaveConfigId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      startDate: {
        type: dataTypes.DATE,
        allowNull: false
      },
      endDate: {
        type: dataTypes.DATE,
        allowNull: false
      },
      totalDays: {
        type: dataTypes.DECIMAL(3, 1),
        allowNull: false,
      },
      isHalfDay: {
        type: dataTypes.BOOLEAN,
        allowNull: false
      },
      remarks: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      applicationDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      approvalStatus: {
        type: dataTypes.ENUM,
        values: Object.values(LeaveApprovalStatus),
        allowNull: false,
        defaultValue: LeaveApprovalStatus.PENDING,
        validate: {
          isIn: {
            args: [Object.values(LeaveApprovalStatus)],
            msg: 'Status type must be pending or approved or rejected or cancelled'
          }
        }
      },
      approvedBy: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      approvalDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      attachmentPath: {
        type: dataTypes.BLOB('long'),
        allowNull: true,
      },
      checkIn: {
        type: dataTypes.TIME,
        allowNull: true
      },
      checkOut: {
        type: dataTypes.TIME,
        allowNull: true
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'employeeLeaveRequestDetails',
      tableName: 'employeeLeaveRequestDetails',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return employeeLeaveRequestDetails;
};