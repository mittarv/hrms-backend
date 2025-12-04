import { Model, DataTypes, Sequelize } from "sequelize";
import { KeyValuePairsAttributes } from "../../../interfaces/platformInterfaces/interfaces/keyValueInterface";

export class KeyValuePairs
    extends Model<KeyValuePairsAttributes, Partial<KeyValuePairsAttributes>>
    implements KeyValuePairsAttributes {
    declare id: number;
    declare category: string;
    declare value: string;
    declare isDeleted: boolean;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    KeyValuePairs.init(
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
            value: {
                type: dataTypes.TEXT,
                allowNull: false,
            },
            isDeleted: {
                type: dataTypes.BOOLEAN,
                defaultValue: false,
            },
        },
        {
            sequelize,
            modelName: "KeyValuePairs",
            timestamps: true,
            updatedAt: "updatedAt",
            createdAt: "createdAt",
        }
    );

    return KeyValuePairs;
};
