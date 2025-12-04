import { DataTypes, Model, Sequelize } from "sequelize";
import { ImportantLinkListAttributes } from "../../../interfaces/toolInterfaces/interfaces/toolInterfaces";

export class ImportantLinkList
  extends Model<ImportantLinkListAttributes, Partial<ImportantLinkListAttributes>>
  implements ImportantLinkListAttributes {
  declare id: number;
  declare toolName: string;
  declare toolLink: string;
  declare lastModifiedBy?: number | null;
  declare createdBy?: number | null;
  declare isDeleted?: boolean | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  ImportantLinkList.init(
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: dataTypes.INTEGER,
      },
      toolName: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      toolLink: {
        type: dataTypes.STRING,
        allowNull: false,
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
      modelName: "importantLinkList",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return ImportantLinkList;
};
