import { DataTypes, Model, Sequelize } from 'sequelize';
import { HolidayEventType } from '../../../interfaces/hrmsTool/enum/hrmsEnum';
import { EmployeeHolidayDetailsAttributes, EmployeeHolidayDetailsCreationAttributes } from '../../../interfaces/hrmsTool/interface/hrmsInterface';

// Define the model class extending Sequelize Model
export class employeeHolidayDetails extends Model<
  EmployeeHolidayDetailsAttributes,
  EmployeeHolidayDetailsCreationAttributes
> implements EmployeeHolidayDetailsAttributes {
  public holidayId!: string;
  public eventName!: string;
  public eventDate!: Date | null;
  public eventType!: HolidayEventType;
  public isDeleted!: boolean;
  public remarks!: string | null;
  public createdBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Factory function to initialize the model - using module.exports instead of export default
module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeHolidayDetails.init(
    {
      holidayId: {
        type: dataTypes.UUID,
        primaryKey: true,
        allowNull: false,
      },
      eventName: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      eventDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      eventType: {
        type: dataTypes.ENUM,
        values: Object.values(HolidayEventType),
        allowNull: false,
        validate: {
          isIn: {
            args: [Object.values(HolidayEventType)],
            msg: 'Event type must be either mandatory or optional_restricted'
          }
        }
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      remarks: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      createdBy: {
        type: dataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'employeeHolidayDetails',
      tableName: 'employeeHolidayDetails',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return employeeHolidayDetails;
};