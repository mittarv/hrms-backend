import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeBankAccountDetailHistoryAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeBankAccountDetailHistory
  extends Model<EmployeeBankAccountDetailHistoryAttributes, Partial<EmployeeBankAccountDetailHistoryAttributes>>
  implements EmployeeBankAccountDetailHistoryAttributes {
  declare bankAccountHistoryId: string;
  declare accountId: string;
  declare empUuid: string;
  declare empIFSCCode?: string | null;
  declare empAccountNumber?: string | null;
  declare empBenefeciaryName?: string | null;
  declare empAccType?: string | null;
  declare isDeleted: boolean;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeBankAccountDetailHistory.init(
    {
      bankAccountHistoryId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      accountId: {
        allowNull: false,
        type: dataTypes.UUID,
      },
      empUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      empIFSCCode: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empAccountNumber: {
        type: dataTypes.STRING(30),
        allowNull: true,
      },
      empBenefeciaryName: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empAccType: {
        type: dataTypes.STRING,
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
      modelName: "employeeBankAccountDetailHistory",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return employeeBankAccountDetailHistory;
};
