import { DataTypes, Model, Sequelize } from "sequelize";
import { employeePayslipAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";
import { payrollStatus } from "../../../../interfaces/hrmsTool/enum/hrmsEnum";

export class employeePayslip extends 
Model<employeePayslipAttributes, Partial<employeePayslipAttributes>> 
implements employeePayslipAttributes 
{
  declare payslipId: string;
  declare employeeId: string;
  declare payrollStartDate: Date;
  declare payrollEndDate: Date;
  declare status: payrollStatus;
  declare netPay: number;
  declare isDeleted?: boolean;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmployeePayslip = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    employeePayslip.init(
      {
        payslipId: {
          type: dataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        employeeId: {
          type: dataTypes.STRING,
          allowNull: false,
        },
        payrollStartDate: {
          type: dataTypes.DATE,
          allowNull: false,
        },
        payrollEndDate: {
          type: dataTypes.DATE,
          allowNull: true,
        },
        status: {
          type: dataTypes.ENUM(...Object.values(payrollStatus)),
          allowNull: false,
        },
        netPay: {
          type: dataTypes.DECIMAL(15, 2),
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
        modelName: "employee_payslip_records",
        tableName: "employee_payslip_records",
        timestamps: true,
        createdAt: "createdAt",
        updatedAt: "updatedAt",
        indexes: [     
          {
            fields: ['employeeId'],
          },
          {
            fields: ['payrollStartDate'],
          },
          {
            fields: ['payrollEndDate'],
          },
        ],
      }
    );
    return employeePayslip;
  };