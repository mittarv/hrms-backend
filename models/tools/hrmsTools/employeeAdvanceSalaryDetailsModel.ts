import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeAdvanceSalaryDetailsAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeAdvanceSalaryDetails
  extends Model<EmployeeAdvanceSalaryDetailsAttributes, Partial<EmployeeAdvanceSalaryDetailsAttributes>>
  implements EmployeeAdvanceSalaryDetailsAttributes {
  declare advanceSalaryId: string;
  declare empUuid: string;
  declare empCurrentAdvanceSalaryAmount?: number | null;
  declare empCurrentAdvanceSalaryEmi?: number | null;
  declare empPaymentCountryCode: string;
  declare effectiveDate?: Date | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeAdvanceSalaryDetails.init(
    {
      advanceSalaryId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.STRING,
      },
      empUuid: {
        type: dataTypes.STRING,
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
      modelName: "employeeAdvanceSalaryDetails",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return employeeAdvanceSalaryDetails;
};
