import { DataTypes, Model, Sequelize } from "sequelize";
import { extraWorkDayAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";
import { LeaveApprovalStatus } from "../../../interfaces/hrmsTool/enum/hrmsEnum";

export class employeeExtraWorkDay
  extends Model<extraWorkDayAttributes, Partial<extraWorkDayAttributes>>
  implements extraWorkDayAttributes
{
  declare extraWorkDayId: string;
  declare empUuid: string;
  declare leaveConfigId: string;
  declare workDate: Date;
  declare checkIn: string;
  declare checkOut: string;
  declare remarks: string;
  declare proof: string;
  declare totalDuration: number;
  declare totalCompOffCredit: number;
  declare requestBy: string;
  declare approvalStatus: LeaveApprovalStatus;
  declare approvedBy?: string;
  declare approvalDate?: Date;
  declare compOffExpiryDate?: Date;
  declare totalCompOffUsed?: string;
  declare readonly isDeleted?: boolean;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmployeeExtraWorkDay = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeExtraWorkDay.init(
    {
      extraWorkDayId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.STRING,
      },
      empUuid: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      leaveConfigId: {
        type: dataTypes.CHAR(36),
        allowNull: false,
        references: {
            model: "employeeleaveconfigurators",
            key: "leaveConfigId",
        },
        onUpdate: 'CASCADE', 
        onDelete: 'RESTRICT'
      },
      workDate: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      checkIn: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      checkOut: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      remarks: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      proof: {
        type: dataTypes.BLOB('long'),
        allowNull: false,
      },
      totalDuration: {
        type: dataTypes.FLOAT,
        allowNull: false,
      },
      totalCompOffCredit: {
        type: dataTypes.FLOAT,
        allowNull: false,
      },
      requestBy: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      approvalStatus: {
        type: dataTypes.ENUM(
          LeaveApprovalStatus.PENDING,
          LeaveApprovalStatus.APPROVED,
          LeaveApprovalStatus.REJECTED
        ),
        allowNull: false,
      },
      approvedBy: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      approvalDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      compOffExpiryDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      totalCompOffUsed: {
        type: dataTypes.FLOAT,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      tableName: "employee_extra_work_day",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      charset: 'utf8mb3',
      collate: 'utf8mb3_general_ci',
    }
  );
  return employeeExtraWorkDay;
};
