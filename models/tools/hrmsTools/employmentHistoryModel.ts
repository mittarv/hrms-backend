import { DataTypes, Model, Sequelize } from "sequelize";
import { EmploymentHistoryAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employmentHistory
  extends Model<EmploymentHistoryAttributes, Partial<EmploymentHistoryAttributes>>
  implements EmploymentHistoryAttributes {
  declare empHistoryId: string;
  declare empUuid?: string;
  declare empStartDate?: Date;
  declare empEndDate?: Date;
  declare updatedBy?: string;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmploymentHistory = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employmentHistory.init(
    {
      empHistoryId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      empUuid: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      empStartDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      empEndDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      updatedBy: {
        type: dataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "employmentHistory",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return employmentHistory;
};
