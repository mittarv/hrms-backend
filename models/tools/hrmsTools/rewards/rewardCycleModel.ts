import { DataTypes, Model, Sequelize } from "sequelize";
import {
  RewardCycleAttributes,
} from "../../../../interfaces/hrmsTool/interface/rewardsInterface";
import {
  RewardCyclePhase,
  RewardCycleStatus,
} from "../../../../interfaces/hrmsTool/enum/rewardsEnum";

export class RewardCycle
  extends Model<RewardCycleAttributes>
  implements RewardCycleAttributes {
  declare id: string;
  declare month: number;
  declare year: number;
  declare currentPhase: RewardCyclePhase;
  declare status: RewardCycleStatus;
  declare nominationStartDate: Date | null;
  declare nominationEndDate: Date | null;
  declare votingStartDate: Date | null;
  declare votingEndDate: Date | null;
  declare winnersAnnouncedDate: Date | null;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initRewardCycle = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  RewardCycle.init(
    {
      id: {
        type: dataTypes.UUID,
        primaryKey: true,
        defaultValue: dataTypes.UUIDV4,
      },
      month: {
        type: dataTypes.TINYINT,
        allowNull: false,
      },
      year: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      currentPhase: {
        type: dataTypes.ENUM,
        values: Object.values(RewardCyclePhase),
        allowNull: false,
        defaultValue: RewardCyclePhase.PENDING,
      },
      status: {
        type: dataTypes.ENUM,
        values: Object.values(RewardCycleStatus),
        allowNull: false,
        defaultValue: RewardCycleStatus.ACTIVE,
      },
      nominationStartDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      nominationEndDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      votingStartDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      votingEndDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      winnersAnnouncedDate: {
        type: dataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "rewardCycle",
      tableName: "reward_cycles",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        { unique: true, fields: ["month", "year"] },
        { fields: ["status", "currentPhase"] },
      ],
    }
  );
  return RewardCycle;
};
