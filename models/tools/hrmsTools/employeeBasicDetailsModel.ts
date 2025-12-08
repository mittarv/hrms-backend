import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeBasicDetailsAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class EmployeeBasicDetails
  extends Model<EmployeeBasicDetailsAttributes, Partial<EmployeeBasicDetailsAttributes>>
  implements EmployeeBasicDetailsAttributes {
  declare empUuid: string;
  declare empCompanyId?: string | null;
  declare empFirstName: string;
  declare empLastName?: string | null;
  declare empDob?: Date | null;
  declare empGender?: string | null;
  declare empBloodGroup?: number | null;
  declare empFatherName?: string | null;
  declare empMotherName?: string | null;
  declare empMaritalStatus?: number | null;
  declare empGovId?: string | null;
  declare empNationality?: string | null;
  declare empHireDate?: Date | null;
  declare isManager?: boolean | null;
  declare isLead?: boolean | null;
  declare empLastLogin?: Date | null;
  declare empPanCard?: string | null;
  declare isDeleted: boolean;
  declare isActive?: number | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  EmployeeBasicDetails.init(
    {
      empUuid: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.STRING,
      },
      empCompanyId: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empFirstName: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      empLastName: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empDob: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      empGender: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empBloodGroup: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
      empFatherName: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empMotherName: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empMaritalStatus: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
      empGovId: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empNationality: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empHireDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      isManager: {
        type: dataTypes.BOOLEAN,
        allowNull: true,
      },
      isLead: {
        type: dataTypes.BOOLEAN,
        allowNull: true,
      },
      empLastLogin: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      empPanCard: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isActive: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "employeeBasicDetails",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return EmployeeBasicDetails;
};
