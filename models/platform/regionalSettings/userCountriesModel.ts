import { Model, DataTypes, Sequelize } from "sequelize";
import { UserCountriesAttributes } from "../../../interfaces/platformInterfaces/interfaces/regionalSettingsInterface";


export class userCountries
  extends Model<UserCountriesAttributes, Partial<UserCountriesAttributes>>
  implements UserCountriesAttributes {
  declare id: number;
  declare userId: number;
  declare countryId: number;
  declare countryTypeId: number;
  declare isDeleted: boolean;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  userCountries.init(
    {
      id: {
        type: dataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      countryId: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      countryTypeId: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "userCountries",
      timestamps: true
    }
  );
  return userCountries;
};