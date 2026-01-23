import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeSalaryDetailsAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeSalaryDetails
  extends Model<EmployeeSalaryDetailsAttributes, Partial<EmployeeSalaryDetailsAttributes>>
  implements EmployeeSalaryDetailsAttributes {
  declare salaryId: string;
  declare empUuid: string;
  declare empAnnualSalary?: number;
  declare empMonthlySalary?: number;
  declare empNumberOfBonuses?: number;
  declare empPaymentCountryCode?: string;
  declare isDeleted?: boolean;
  declare effectiveDate?: Date;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmployeeSalaryDetails = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeSalaryDetails.init(
    {
      salaryId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
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
      empPaymentCountryCode: {
        type: dataTypes.STRING,
        allowNull: false,
        defaultValue: "",
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      effectiveDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "employeeSalaryDetails",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return employeeSalaryDetails;
};
