import { DataTypes, Model, Sequelize } from "sequelize";
import { VoteAttributes } from "../../../../interfaces/hrmsTool/interface/rewardsInterface";

export class Vote extends Model<VoteAttributes> implements VoteAttributes {
  declare id: string;
  declare cycleId: string;
  declare nomineeEmpUuid: string;
  declare votedByEmpUuid: string;
  /** employee_choice | leadership_choice - from voter's department (leadership_key => leadership_choice) */
  declare voteCategory: string;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initVote = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  Vote.init(
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
      votedByEmpUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      voteCategory: {
        type: dataTypes.STRING(32),
        allowNull: false,
        defaultValue: "employee_choice",
      },
    },
    {
      sequelize,
      modelName: "vote",
      tableName: "votes",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        { unique: true, fields: ["cycleId", "nomineeEmpUuid", "votedByEmpUuid"] },
        { fields: ["cycleId", "nomineeEmpUuid"] },
        { fields: ["votedByEmpUuid"] },
      ],
    }
  );
  return Vote;
};
