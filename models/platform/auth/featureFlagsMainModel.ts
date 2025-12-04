import { Model, DataTypes, Sequelize } from "sequelize";
import { FeatureFlagsMainAttributes } from "../../../interfaces/platformInterfaces/interfaces/authInterface";

export class FeatureFlagsMain
    extends Model<FeatureFlagsMainAttributes, Partial<FeatureFlagsMainAttributes>>
    implements FeatureFlagsMainAttributes {
    declare id: number;
    declare feature: string;
    declare value: string;
    declare description: string;
    declare createdBy: number;
    declare lastUpdatedBy: number;
    declare isDeleted: boolean;
    declare environment: string;
    declare androidVersion?: string | null;
    declare iosVersion?: string | null;
    declare websiteVersion?: string | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    FeatureFlagsMain.init(
        {
            id: {
                type: dataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false,
            },
            feature: {
                type: dataTypes.STRING,
                allowNull: false,
            },
            value: {
                type: dataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: dataTypes.STRING,
                allowNull: false,
            },
            createdBy: {
                type: dataTypes.INTEGER,
                allowNull: false,
            },
            lastUpdatedBy: {
                type: dataTypes.INTEGER,
                allowNull: false,
            },
            isDeleted: {
                type: dataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            environment: {
                type: dataTypes.STRING,
                allowNull: false,
            },
            androidVersion: {
                type: dataTypes.STRING,
                allowNull: true,
            },
            iosVersion: {
                type: dataTypes.STRING,
                allowNull: true,
            },
            websiteVersion: {
                type: dataTypes.STRING,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: "featureFlagsMain",
            timestamps: true,
            createdAt: "createdAt",
            updatedAt: "updatedAt",
        }
    );

    return FeatureFlagsMain;
};
