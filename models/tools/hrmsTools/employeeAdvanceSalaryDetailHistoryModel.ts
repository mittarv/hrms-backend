import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeAdvanceSalaryDetailHistoryAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeAdvanceSalaryDetailHistory
  extends Model<EmployeeAdvanceSalaryDetailHistoryAttributes, Partial<EmployeeAdvanceSalaryDetailHistoryAttributes>>
  implements EmployeeAdvanceSalaryDetailHistoryAttributes {
  declare advanceSalaryHistoryId: string;
  declare advanceSalaryId: string;
  declare empUuid: string;
  declare empCurrentAdvanceSalaryAmount?: number | null;
  declare empCurrentAdvanceSalaryEmi?: number | null;
  declare empPaymentCountryCode: string;
  declare effectiveDate?: Date | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmployeeAdvanceSalaryDetailHistory = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeAdvanceSalaryDetailHistory.init(
    {
      advanceSalaryHistoryId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      advanceSalaryId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      empUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      empCurrentAdvanceSalaryAmount: {
        type: dataTypes.DOUBLE,
        allowNull: true,
      },
      empCurrentAdvanceSalaryEmi: {
        type: dataTypes.DOUBLE,
        allowNull: true,
      },
      empPaymentCountryCode: {
        type: dataTypes.STRING,
        allowNull: false,
        defaultValue: "",
      },
      effectiveDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "employeeAdvanceSalaryDetailHistory",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return employeeAdvanceSalaryDetailHistory;
};
