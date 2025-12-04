import { DataTypes, Model, Sequelize } from 'sequelize';
import { AttendanceStatusType } from '../../../interfaces/hrmsTool/enum/hrmsEnum';
import { EmployeeAttendanceAttributes, EmployeeAttendanceCreationAttributes } from '../../../interfaces/hrmsTool/interface/hrmsInterface';

// Define the model class extending Sequelize Model
export class employeeAttendanceDetails extends Model<
    EmployeeAttendanceAttributes,
    EmployeeAttendanceCreationAttributes
> implements EmployeeAttendanceAttributes {
    public attendanceId: string; 
    public empUuid: string;
    public attendanceDate: Date;
    public checkIn?: string;
    public checkOut?: string;
    public workHours?: number;
    public attendanceStatus: AttendanceStatusType;
    public remarks?: string;
    public leaveRequestId?: string;
    public isDeleted: boolean;
    public readonly createdAt?: Date;
    public readonly updatedAt?: Date;
}

// Factory function to initialize the model - using module.exports instead of export default
module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeAttendanceDetails.init(
    {
      attendanceId: {
        type: dataTypes.UUID,
        primaryKey: true,
        allowNull: false,
      },
      empUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      attendanceDate: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      checkIn: {
        type: dataTypes.TIME,
        allowNull: true
      },
      checkOut: {
        type: dataTypes.TIME,
        allowNull: true,
      },
      workHours: {
        type: dataTypes.DECIMAL(4, 2),
        allowNull: true,
      },
      attendanceStatus: {
        type: dataTypes.ENUM,
        values: Object.values(AttendanceStatusType),
        allowNull: false,
        validate: {
          isIn: {
            args: [Object.values(AttendanceStatusType)],
            msg: 'Status type must be working or half_day or on_leave'
          }
        }
      },
      remarks: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      leaveRequestId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'employeeAttendanceDetails',
      tableName: 'employeeAttendanceDetails',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return employeeAttendanceDetails;
};