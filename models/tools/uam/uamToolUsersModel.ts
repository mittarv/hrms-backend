import { DataTypes, Model, Sequelize } from "sequelize";
import { UamToolsUserAttributes } from "../../../interfaces/toolInterfaces/interfaces/uamInterface";

export class UamToolsUser
    extends Model<UamToolsUserAttributes, Partial<UamToolsUserAttributes>>
    implements UamToolsUserAttributes {
    declare id?: number;
    declare toolId?: number | null;
    declare userId?: string | null;
    declare userGroupId?: number | null;
    declare startDate?: Date | null;
    declare endDate?: Date | null;
    declare updatedBy?: number | null;

    declare readonly createdAt?: Date;
    declare readonly updatedAt?: Date;
}

export const initUamToolsUser = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    UamToolsUser.init(
        {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: dataTypes.INTEGER,
            },
            toolId: {
                type: dataTypes.INTEGER,
            },
            userId: {
                type: dataTypes.STRING,
            },
            userGroupId: {
                type: dataTypes.INTEGER,
            },
            startDate: {
                type: dataTypes.DATE,
                defaultValue: dataTypes.NOW,
            },
            endDate: {
                type: dataTypes.DATE,
                defaultValue: dataTypes.NOW,
            },
            updatedBy: {
                type: dataTypes.INTEGER,
            },
        },
        {
            sequelize,
            modelName: "uamToolsUser",
            timestamps: true,
            createdAt: "createdAt",
            updatedAt: "updatedAt",
        }
    );

    return UamToolsUser;
};
