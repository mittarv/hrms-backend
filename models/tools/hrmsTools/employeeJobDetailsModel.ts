import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeJobDetailsAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeJobDetails
  extends Model<EmployeeJobDetailsAttributes, Partial<EmployeeJobDetailsAttributes>>
  implements EmployeeJobDetailsAttributes {
  declare jobId: string;
  declare empType?: string;
  declare empUuid?: string;
  declare empDepartment?: string;
  declare empTitle?: string;
  declare empLevel?: string;
  declare empManager?: string;
  declare isDeleted?: boolean;
  declare effectiveDate?: Date;
  declare lastDate?: Date;
  declare empConversionDate?: Date;
  declare empYearOfStudy?: string;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmployeeJobDetails = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeJobDetails.init(
    {
      jobId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      empType: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empUuid: {
        type: dataTypes.UUID,
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
        type: dataTypes.UUID,
        allowNull: true,
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
      lastDate: {
        type: dataTypes.DATE,
        allowNull: true,
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
      modelName: "employeeJobDetails",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return employeeJobDetails;
};
