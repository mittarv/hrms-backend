import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeBankAccountDetailsAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeBankAccountDetails
  extends Model<EmployeeBankAccountDetailsAttributes, Partial<EmployeeBankAccountDetailsAttributes>>
  implements EmployeeBankAccountDetailsAttributes {
  declare accountId: string;
  declare empUuid: string;
  declare empIFSCCode?: string | null;
  declare empAccountNumber?: string | null;
  declare empBenefeciaryName?: string | null;
  declare empAccType?: string | null;
  declare effecTiveDate?: Date | null;
  declare isDeleted: boolean;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeBankAccountDetails.init(
    {
      accountId: {
        allowNull: false,
        primaryKey: true,
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
      effecTiveDate: {
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
      modelName: "employeeBankAccountDetails",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return employeeBankAccountDetails;
};
