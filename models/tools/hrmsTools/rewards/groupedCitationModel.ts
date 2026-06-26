import { DataTypes, Model, Sequelize } from "sequelize";
import { GroupedCitationAttributes } from "../../../../interfaces/hrmsTool/interface/rewardsInterface";

export class GroupedCitation
  extends Model<GroupedCitationAttributes>
  implements GroupedCitationAttributes {
  declare id: string;
  declare cycleId: string;
  declare nomineeEmpUuid: string;
  declare groupedCitation: string;
  declare createdByEmpUuid: string;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initGroupedCitation = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  GroupedCitation.init(
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
      groupedCitation: {
        type: dataTypes.TEXT,
        allowNull: false,
      },
      createdByEmpUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "groupedCitation",
      tableName: "grouped_citations",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        { unique: true, fields: ["cycleId", "nomineeEmpUuid"] },
        { fields: ["cycleId"] },
      ],
    }
  );
  return GroupedCitation;
};
