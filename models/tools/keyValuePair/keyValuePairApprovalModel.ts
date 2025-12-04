import { DataTypes, Model, Sequelize } from "sequelize";
import { KeyValuePairApprovalAttributes } from "../../../interfaces/toolInterfaces/interfaces/toolInterfaces";
import { KeyValueActionEnum } from "../../../interfaces/toolInterfaces/enums/enums";

export class KeyValuePairApproval
  extends Model<KeyValuePairApprovalAttributes, Partial<KeyValuePairApprovalAttributes>>
  implements KeyValuePairApprovalAttributes {
  declare id: number;
  declare category: string;
  declare key?: string | null;
  declare value: string;
  declare description: string;
  declare actionStatus?: boolean | null;
  declare requestedBy?: string | null;
  declare requestedAt?: Date | null;
  declare requestedId?: number | null;
  declare actionToPerform: KeyValueActionEnum;
  declare approvedBy?: string | null;
  declare approvedAt?: Date | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  KeyValuePairApproval.init(
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: dataTypes.INTEGER,
      },
      category: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      key: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      value: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      actionStatus: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
      requestedBy: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      requestedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      requestedId: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
      actionToPerform: {
        type: dataTypes.ENUM(...Object.values(KeyValueActionEnum)),
        allowNull: false,
      },
      approvedBy: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      approvedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "KeyValuePairApproval",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return KeyValuePairApproval;
};
