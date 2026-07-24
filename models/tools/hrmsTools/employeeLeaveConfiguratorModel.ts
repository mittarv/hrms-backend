import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeLeaveConfiguratorAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeLeaveConfigurator
  extends Model<EmployeeLeaveConfiguratorAttributes, Partial<EmployeeLeaveConfiguratorAttributes>>
  implements EmployeeLeaveConfiguratorAttributes {
  declare leaveConfigId: string;
  declare leaveType: string;
  declare employeeType: string;
  declare accuralFrequency: string;
  declare totalAllotedLeaves: number;
  declare accuralRate: number;
  declare minimumNoticePeriod: number;
  declare maximumNoticePeriod: number;
  declare continuousLeavesLimit: number;
  declare excludePaidWeekend: boolean;
  declare appliedGender: string;
  declare isHalfDayAllowed: boolean;
  declare isProofRequired: boolean;
  declare isReasonRequired: boolean;
  declare effectiveDate: Date;
  declare terminationDate?: Date;
  declare isActive: boolean;
  declare isDefault: boolean;
  declare leaveApplicableTo?: string;
  declare allotAllLeaves: boolean;
  declare leaveExpiresAfter: number | null;
  declare empCompanyId: string;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmployeeLeaveConfigurator = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeLeaveConfigurator.init(
    {
      leaveConfigId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      empCompanyId: {
        type: dataTypes.STRING,
        allowNull: false,
        defaultValue: "DEFAULT_COMPANY",
      },
      leaveType: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      employeeType: {
        type: dataTypes.TEXT,
        allowNull: false,
      },
      accuralFrequency: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      totalAllotedLeaves: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      accuralRate: {
        type: dataTypes.FLOAT,
        allowNull: false,
      },
      minimumNoticePeriod: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      maximumNoticePeriod: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      continuousLeavesLimit: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      excludePaidWeekend: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      appliedGender: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      isHalfDayAllowed: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isProofRequired: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isReasonRequired: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      effectiveDate: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      terminationDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      isActive: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      isDefault: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      leaveApplicableTo: {
        type: dataTypes.TEXT("long"),
        allowNull: true,
      },
      allotAllLeaves: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      leaveExpiresAfter: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "employeeLeaveConfigurator",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return employeeLeaveConfigurator;
};
