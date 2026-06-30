import { DataTypes, Model, Sequelize } from "sequelize";
import { ConfigureSecondaryLocationAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";

export class configureSecondaryLocation
  extends Model<ConfigureSecondaryLocationAttributes, Partial<ConfigureSecondaryLocationAttributes>>
  implements ConfigureSecondaryLocationAttributes {
  declare configId: string;
  declare location: string;
  declare durationWeeks: number;
  declare maximumSplitsPerYear: number;
  declare minimumIntimationPeriodDays: number;
  declare createdBy: string;
  declare isDeleted?: boolean;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initConfigureSecondaryLocation = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  configureSecondaryLocation.init(
    {
      configId: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      location: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      durationWeeks: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      maximumSplitsPerYear: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      minimumIntimationPeriodDays: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      createdBy: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "configureSecondaryLocation",
      tableName: "configure_secondary_location",
      freezeTableName: true,
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return configureSecondaryLocation;
};
