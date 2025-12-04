import { Model, DataTypes, Sequelize } from "sequelize";
import { UserSelectedLanguageAttributes } from "../../../interfaces/platformInterfaces/interfaces/regionalSettingsInterface";


export class UserSelectedLanguage
    extends Model<
        UserSelectedLanguageAttributes, Partial<UserSelectedLanguageAttributes>
    >
    implements UserSelectedLanguageAttributes {
    declare id: number;
    declare userId: number;
    declare languageId: number;


    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    UserSelectedLanguage.init(
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
            // This is a foregin key from the language table in TMS table ( all the list of languages available on our platform)
            // That table contains all the information about the language like language name, language code etc.
            languageId: {
                type: dataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            sequelize,
            modelName: "userSelectedLanguage",
            timestamps: true,
            updatedAt: "updatedAt",
            createdAt: "createdAt",
        }
    );

    return UserSelectedLanguage;
};
