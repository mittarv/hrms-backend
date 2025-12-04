import { DataTypes, Model, Sequelize } from "sequelize";
import { PolicyListAttributes } from "../../../interfaces/toolInterfaces/interfaces/toolInterfaces";

export class PolicyList
  extends Model<PolicyListAttributes, Partial<PolicyListAttributes>>
  implements PolicyListAttributes {
  declare id: number;
  declare policyName: string;
  declare policyLink: string;
  declare version: string;
  declare remarks?: string | null;
  declare approvedBy?: string | null;
  declare lastModifiedBy?: number | null;
  declare createdBy?: number | null;
  declare isDeleted?: boolean | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  PolicyList.init(
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: dataTypes.INTEGER,
      },
      policyName: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      policyLink: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      version: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      remarks: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      approvedBy: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      lastModifiedBy: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
      createdBy: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "policyList",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return PolicyList;
};
