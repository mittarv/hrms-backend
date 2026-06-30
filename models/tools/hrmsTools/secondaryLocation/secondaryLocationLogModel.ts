import { DataTypes, Model, Sequelize } from "sequelize";
import { SecondaryLocationLogAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";
import { SecondaryLocationLogStatus } from "../../../../interfaces/hrmsTool/enum/hrmsEnum";

export class secondaryLocationLog
  extends Model<SecondaryLocationLogAttributes, Partial<SecondaryLocationLogAttributes>>
  implements SecondaryLocationLogAttributes {
  declare logId: string;
  declare employeeUuid: string;
  declare secondaryLocation: string;
  declare startDate: Date;
  declare endDate: Date;
  declare durationDays: number;
  declare status: SecondaryLocationLogStatus;
  declare loggedBy: string;
  declare reviewedBy?: string | null;
  declare reviewedAt?: Date | null;
  declare isDeleted?: boolean;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initSecondaryLocationLog = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  secondaryLocationLog.init(
    {
      logId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      employeeUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      secondaryLocation: {
        type: dataTypes.STRING,
        allowNull: false,
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
      status: {
        type: dataTypes.ENUM(...Object.values(SecondaryLocationLogStatus)),
        allowNull: false,
      },
      loggedBy: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      reviewedBy: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      reviewedAt: {
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
      modelName: "secondaryLocationLog",
      tableName: "secondary_location_log",
      freezeTableName: true,
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return secondaryLocationLog;
};
