import { DataTypes, Model, Sequelize } from "sequelize";
import { employeeComponentAdjustmentsAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";
import { LeaveAccrualFrequency } from "../../../../interfaces/hrmsTool/enum/hrmsEnum";

export class employeeComponentAdjustments extends 
Model<employeeComponentAdjustmentsAttributes, Partial<employeeComponentAdjustmentsAttributes>> 
implements employeeComponentAdjustmentsAttributes 
{
  declare adjustmentId: string;
  declare employeeId: string;
  declare componentId: string;
  declare adjustedAmount: number;
  declare startDate: Date;
  declare endDate?: Date;
  declare isDeleted?: boolean;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    employeeComponentAdjustments.init(
      {
        adjustmentId: {
          type: dataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        employeeId: {
          type: dataTypes.STRING,
          allowNull: false,
        },
        componentId: {
          type: dataTypes.STRING,
          allowNull: false,
          references: {
            model: 'salary_components',
            key: 'componentId'
          },
          onUpdate: 'CASCADE', 
          onDelete: 'RESTRICT'
        },
        adjustedAmount: {
          type: dataTypes.DECIMAL(15, 2),
          allowNull: false,
        },
        adjustedFrequency: {
          type: dataTypes.ENUM,
          values: Object.values(LeaveAccrualFrequency),
          allowNull: true,
          validate: {
            isIn: {
              args: [Object.values(LeaveAccrualFrequency)],
              msg: "Invalid frequency"
            }
          }
        },
        startDate: {
          type: dataTypes.DATE,
          allowNull: false,
        },
        endDate: {
          type: dataTypes.DATE,
          allowNull: true,
        },
        isDeleted: {
          type: dataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        },
      },
      {
        sequelize,
        modelName: "employee_component_adjustments",
        tableName: "employee_component_adjustments",
        timestamps: true,
        createdAt: "createdAt",
        updatedAt: "updatedAt",
        indexes: [
          {
            fields: ["employeeId"],
          },
          {
            fields: ["componentId"],
          },
        ],
      }
    );
    return employeeComponentAdjustments;
}