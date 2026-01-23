import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeAddressDetailsAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeAddressDetails
  extends Model<EmployeeAddressDetailsAttributes, Partial<EmployeeAddressDetailsAttributes>>
  implements EmployeeAddressDetailsAttributes {
  declare addressId: string;
  declare empUuid?: string | null;
  declare addressType?: string | null;
  declare addressLine1?: string | null;
  declare addressLine2?: string | null;
  declare addressLine3?: string | null;
  declare city?: string | null;
  declare pin?: number | null;
  declare state: string;
  declare country?: string | null;
  declare effectiveDate?: Date | null;
  declare terminationDate?: Date | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmployeeAddressDetails = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeAddressDetails.init(
    {
      addressId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      empUuid: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      addressType: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      addressLine1: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      addressLine2: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      addressLine3: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      pin: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
      state: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      country: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      effectiveDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      terminationDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "employeeAddressDetails",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return employeeAddressDetails;
};
