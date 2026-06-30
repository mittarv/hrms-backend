import { DataTypes, Model, Sequelize } from "sequelize";
import { NominationAttributes } from "../../../../interfaces/hrmsTool/interface/rewardsInterface";

export class Nomination
  extends Model<NominationAttributes>
  implements NominationAttributes {
  declare id: string;
  declare cycleId: string;
  declare nomineeEmpUuid: string;
  declare nominatedByEmpUuid: string;
  declare citation: string;
  declare isRemoved: boolean;
  declare removedByEmpUuid: string | null;
  declare removedAt: Date | null;
  declare removalReason: string | null;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initNomination = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  Nomination.init(
    {
      id: {
        type: dataTypes.UUID,
        primaryKey: true,
        defaultValue: dataTypes.UUIDV4,
      },
      cycleId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      nomineeEmpUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      nominatedByEmpUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      citation: {
        type: dataTypes.TEXT,
        allowNull: false,
      },
      isRemoved: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      removedByEmpUuid: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      removedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      removalReason: {
        type: dataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "nomination",
      tableName: "nominations",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        { unique: true, fields: ["cycleId", "nomineeEmpUuid", "nominatedByEmpUuid"] },
        { fields: ["cycleId", "nomineeEmpUuid"] },
        { fields: ["nominatedByEmpUuid"] },
        { fields: ["isRemoved"] },
      ],
    }
  );
  return Nomination;
};
