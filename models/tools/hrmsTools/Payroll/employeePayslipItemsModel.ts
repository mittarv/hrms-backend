import { DataTypes, Model, Sequelize } from "sequelize";
import { employeePayslipItemAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeePayslipItems extends 
Model<employeePayslipItemAttributes, Partial<employeePayslipItemAttributes>> 
implements employeePayslipItemAttributes 
{
  declare payrollItemId: string;
  declare payslipId: string;
  declare componentName: string;
  declare componentType: string;
  declare amount: number;
  declare isDeleted?: boolean;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    employeePayslipItems.init(
      {
        payrollItemId: {
          type: dataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        payslipId: {
          type: dataTypes.STRING,
          allowNull: false,
          references: {
            model: 'employee_payslip_records',
            key: 'payslipId'
          },
          onUpdate: 'CASCADE', 
          onDelete: 'RESTRICT'
        },
        componentName: {
          type: dataTypes.STRING,
          allowNull: false,
        },
        componentType: {
          type: dataTypes.STRING,
          allowNull: false,
        },
        amount: {
          type: dataTypes.DECIMAL(15, 2),
          allowNull: false,
        },
        isDeleted: {
          type: dataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        },
      },
      {
        sequelize,
        modelName: "employee_payroll_items",
        tableName: "employee_payroll_items",
        timestamps: true,
        createdAt: "createdAt",
        updatedAt: "updatedAt",
        indexes: [
          // Individual column indexes for fast single-field lookups
          {
            fields: ["payslipId"],
          },
          {
            fields: ["componentName"],
          },
        ],
      }
    );
  
    return employeePayslipItems;
  }