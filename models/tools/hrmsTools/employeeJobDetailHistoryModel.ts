import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeJobDetailHistoryAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeJobDetailHistory
  extends Model<EmployeeJobDetailHistoryAttributes, Partial<EmployeeJobDetailHistoryAttributes>>
  implements EmployeeJobDetailHistoryAttributes {
  declare jobHistoryId: string;
  declare jobId: string;
  declare empType?: string;
  declare empUuid?: string;
  declare empDepartment?: string;
  declare empTitle?: string;
  declare empLevel?: string;
  declare empManager?: string;
  declare effectiveDate?: Date;
  declare lastDate?: Date;
  declare isDeleted?: boolean;
  declare empConversionDate?: Date;
  declare empYearOfStudy?: string;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeJobDetailHistory.init(
    {
      jobHistoryId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.STRING,
      },
      jobId: {
        allowNull: false,
        type: dataTypes.STRING,
      },
      empType: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empUuid: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empDepartment: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empTitle: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empLevel: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empManager: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      effectiveDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      lastDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      empConversionDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      empYearOfStudy: {
        type: dataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "employeeJobDetailHistory",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return employeeJobDetailHistory;
};
