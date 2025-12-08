import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeLoginHistoryAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeLoginHistory
  extends Model<EmployeeLoginHistoryAttributes, Partial<EmployeeLoginHistoryAttributes>>
  implements EmployeeLoginHistoryAttributes
{
  declare loginId: string;
  declare empUuid?: string;
  declare loginTimeStamp?: Date;
  declare isDeleted?: boolean;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeLoginHistory.init(
    {
      loginId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.STRING,
      },
      empUuid: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      loginTimeStamp: {
        type: dataTypes.DATE,
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
      modelName: "employeeLoginHistory",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return employeeLoginHistory;
};
