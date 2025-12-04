import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeDataRequestAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class employeeDataRequest
  extends Model<EmployeeDataRequestAttributes, Partial<EmployeeDataRequestAttributes>>
  implements EmployeeDataRequestAttributes {
  declare requestId: string;
  declare requestedFor: string;
  declare requestedBy: string;
  declare actionedBy?: string;
  declare oldData?: Record<string, any>;
  declare newData: Record<string, any>;
  declare attributesChanged: string;
  declare sectionChanged: string;
  declare isApproved?: boolean;
  declare isRejected?: boolean;
  declare actionedAt?: Date;
  declare isDeleted?: boolean;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  employeeDataRequest.init(
    {
      requestId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      requestedFor: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      requestedBy: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      actionedBy: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      oldData: {
        type: dataTypes.JSON,
        allowNull: true,
      },
      newData: {
        type: dataTypes.JSON,
        allowNull: false,
      },
      attributesChanged: {
        type: dataTypes.TEXT,
        allowNull: false,
      },
      sectionChanged: {
        type: dataTypes.TEXT,
        allowNull: false,
      },
      isApproved: {
        type: dataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      isRejected: {
        type: dataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      actionedAt: {
        type: dataTypes.DATE,
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
      modelName: "employeeDataRequest",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return employeeDataRequest;
};
