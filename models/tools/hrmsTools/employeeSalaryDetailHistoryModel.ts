import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeSalaryDetailHistoryAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeSalaryDetailHistory
  extends Model<EmployeeSalaryDetailHistoryAttributes, Partial<EmployeeSalaryDetailHistoryAttributes>>
  implements EmployeeSalaryDetailHistoryAttributes
{
  declare salaryHistoryId: string;
  declare salaryId: string;
  declare empUuid: string;
  declare empAnnualSalary?: number;
  declare empMonthlySalary?: number;
  declare empNumberOfBonuses?: number;
  declare isDeleted?: boolean;
  declare empPaymentCountryCode?: string;
  declare effectiveDate?: Date;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmployeeSalaryDetailHistory = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeSalaryDetailHistory.init(
    {
      salaryHistoryId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      salaryId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      empUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      empAnnualSalary: {
        type: dataTypes.DOUBLE,
        allowNull: true,
      },
      empMonthlySalary: {
        type: dataTypes.DOUBLE,
        allowNull: true,
      },
      empNumberOfBonuses: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
      modelName: "employeeSalaryDetailHistory",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return employeeSalaryDetailHistory;
};
