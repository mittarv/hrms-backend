import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeContactDetailsAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeContactDetails
  extends Model<EmployeContactDetailsAttributes, Partial<EmployeContactDetailsAttributes>>
  implements EmployeContactDetailsAttributes {
  declare contactId: string;
  declare empUuid?: string;
  declare empPersonalPhone?: string;
  declare empPersonalEmail?: string;
  declare empOfficialPhone?: string;
  declare empOfficialEmail: string;
  declare empEmergencyContactName?: string;
  declare empEmergencyContactNumber?: string;
  declare empEmergencyContactRelation?: string;
  declare isDeleted?: boolean;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeContactDetails.init(
    {
      contactId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      empUuid: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      empPersonalPhone: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empPersonalEmail: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empOfficialPhone: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empOfficialEmail: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      empEmergencyContactName: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empEmergencyContactNumber: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      empEmergencyContactRelation: {
        type: dataTypes.STRING,
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
      modelName: "employeContactDetails",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return employeContactDetails;
};
