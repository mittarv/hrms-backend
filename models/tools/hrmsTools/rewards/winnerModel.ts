import { DataTypes, Model, Sequelize } from "sequelize";
import { WinnerAttributes } from "../../../../interfaces/hrmsTool/interface/rewardsInterface";
import { AwardType } from "../../../../interfaces/hrmsTool/enum/rewardsEnum";

export class Winner extends Model<WinnerAttributes> implements WinnerAttributes {
  declare id: string;
  declare cycleId: string;
  declare employeeEmpUuid: string;
  declare awardType: AwardType;
  declare voteCount: number;
  declare finalCitation: string;
  declare announcedAt: Date;
  declare announcedByEmpUuid: string;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initWinner = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  Winner.init(
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
      employeeEmpUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      awardType: {
        type: dataTypes.ENUM,
        values: Object.values(AwardType),
        allowNull: false,
      },
      voteCount: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      finalCitation: {
        type: dataTypes.TEXT,
        allowNull: false,
      },
      announcedAt: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      announcedByEmpUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "winner",
      tableName: "winners",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        { unique: true, fields: ["cycleId", "awardType", "employeeEmpUuid"] },
        { fields: ["employeeEmpUuid"] },
        { fields: ["cycleId"] },
      ],
    }
  );
  return Winner;
};
