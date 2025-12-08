import { DataTypes, Model, Sequelize } from 'sequelize';
import { EmployeeLeaveBalanceAttributes, EmployeeLeaveBalanceCreationAttributes } from '../../../interfaces/hrmsTool/interface/hrmsInterface';
// Define the model class extending Sequelize Model
export class employeeLeaveBalanceDetails extends Model<
  EmployeeLeaveBalanceAttributes,
  EmployeeLeaveBalanceCreationAttributes
> implements EmployeeLeaveBalanceAttributes {
  public balanceId!: string;
  public empUuid!: string;
  public leaveConfigId!: string;
  public totalLeaveUsed!: number;
  public fiscalYear!: number;
  public empType!: string;
  public fiscalYearStart!: Date;
  public fiscalYearEnd!: Date;
  public isDeleted?: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

// Factory function to initialize the model - using module.exports instead of export default
module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeLeaveBalanceDetails.init(
    {
      balanceId: {
        type: dataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      empUuid: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      leaveConfigId: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      totalLeaveUsed: {
        type: dataTypes.DECIMAL(5, 1),
        defaultValue: 0,
        allowNull: false,
      },
      fiscalYear: {
        type: dataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      empType: {
        type: dataTypes.STRING,
        defaultValue: 'fte_key',
        allowNull: false
      },
      fiscalYearStart: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      fiscalYearEnd: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'employeeLeaveBalanceDetails',
      tableName: 'employeeLeaveBalanceDetails',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return employeeLeaveBalanceDetails;
};