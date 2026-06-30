import { DataTypes, Model, Sequelize } from "sequelize";
import { SecondaryLocationRequestAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";
import { SecondaryLocationRequestStatus, SecondaryLocationRequestType } from "../../../../interfaces/hrmsTool/enum/hrmsEnum";

export class secondaryLocationRequest
  extends Model<SecondaryLocationRequestAttributes, Partial<SecondaryLocationRequestAttributes>>
  implements SecondaryLocationRequestAttributes {
  declare requestId: string;
  declare employeeUuid: string;
  declare originalLogId?: string | null;
  declare startDate: Date;
  declare endDate: Date;
  declare durationDays: number;
  declare requestType: SecondaryLocationRequestType;
  declare reason: string;
  declare status: SecondaryLocationRequestStatus;
  declare rejectionReason?: string | null;
  declare reviewedBy?: string | null;
  declare reviewedAt?: Date | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initSecondaryLocationRequest = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  secondaryLocationRequest.init(
    {
      requestId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      employeeUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      originalLogId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      startDate: {
        type: dataTypes.DATEONLY,
        allowNull: false,
      },
      endDate: {
        type: dataTypes.DATEONLY,
        allowNull: false,
      },
      durationDays: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      requestType: {
        type: dataTypes.ENUM(...Object.values(SecondaryLocationRequestType)),
        allowNull: false,
      },
      reason: {
        type: dataTypes.STRING(500),
        allowNull: false,
      },
      status: {
        type: dataTypes.ENUM(...Object.values(SecondaryLocationRequestStatus)),
        allowNull: false,
        defaultValue: SecondaryLocationRequestStatus.PENDING,
      },
      rejectionReason: {
        type: dataTypes.STRING(500),
        allowNull: true,
      },
      reviewedBy: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      reviewedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "secondaryLocationRequest",
      tableName: "secondary_location_requests",
      freezeTableName: true,
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return secondaryLocationRequest;
};
