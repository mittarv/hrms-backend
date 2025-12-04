import { Model, DataTypes, Sequelize } from "sequelize";
import { UserLanguageSuggestionAttributes } from "../../../interfaces/platformInterfaces/interfaces/regionalSettingsInterface";


export class UserLanguageSuggestion
  extends Model<
    UserLanguageSuggestionAttributes, Partial<UserLanguageSuggestionAttributes>
  >
  implements UserLanguageSuggestionAttributes {
  declare id: number;
  declare userId: number;
  declare languageName: string;


  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  UserLanguageSuggestion.init(
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: dataTypes.INTEGER,
      },
      userId: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      languageName: {
        type: dataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "userLanguageSuggestion",
      timestamps: true,
      updatedAt: "updatedAt",
      createdAt: "createdAt",
    }
  );

  return UserLanguageSuggestion;
};
