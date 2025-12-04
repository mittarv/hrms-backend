import { Model, DataTypes, Sequelize } from "sequelize";
import { CategoryKeyValueAttributes } from "../../../interfaces/platformInterfaces/interfaces/keyValueInterface";

export class CategoryKeyValue
    extends Model<CategoryKeyValueAttributes, Partial<CategoryKeyValueAttributes>>
    implements CategoryKeyValueAttributes {
    declare id: number;
    declare category: string;
    declare key: string;
    declare value: string;
    declare isDeleted: boolean;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    CategoryKeyValue.init(
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
                allowNull: false,
            },
            value: {
                type: dataTypes.STRING,
                allowNull: false,
            },
            isDeleted: {
                type: dataTypes.BOOLEAN,
                defaultValue: false,
            },
        },
        {
            sequelize,
            modelName: "CategoryKeyValue",
            timestamps: true,
            updatedAt: "updatedAt",
            createdAt: "createdAt",
        }
    );

    return CategoryKeyValue;
};
