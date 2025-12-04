import { DataTypes, Model, Sequelize } from "sequelize";
import { UamUserGroupsAttributes } from "../../../interfaces/toolInterfaces/interfaces/uamInterface";

export class uamUserGroups
    extends Model<UamUserGroupsAttributes, Partial<UamUserGroupsAttributes>>
    implements UamUserGroupsAttributes {
    declare id?: number;
    declare role: string;
    declare value?: number | null;
    declare view?: boolean | null;
    declare modify?: boolean | null;
    declare approver?: boolean | null;
    declare addmembers?: boolean | null;
    declare updatedBy?: number | null;
    declare isDeleted?: boolean | null;

    declare readonly createdAt?: Date;
    declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
    uamUserGroups.init(
        {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: dataTypes.INTEGER,
            },
            role: {
                type: dataTypes.STRING,
                allowNull: false,
            },
            value: {
                type: dataTypes.INTEGER,
                defaultValue: 1000,
            },
            view: {
                type: dataTypes.BOOLEAN,
                defaultValue: false,
            },
            modify: {
                type: dataTypes.BOOLEAN,
                defaultValue: false,
            },
            approver: {
                type: dataTypes.BOOLEAN,
                defaultValue: false,
            },
            addmembers: {
                type: dataTypes.BOOLEAN,
                defaultValue: false,
            },
            updatedBy: {
                type: dataTypes.INTEGER,
            },
            isDeleted: {
                type: dataTypes.BOOLEAN,
                defaultValue: false,
            },
        },
        {
            sequelize,
            modelName: "uamUserGroups",
            timestamps: true,
            createdAt: "createdAt",
            updatedAt: "updatedAt",
        }
    );

    return uamUserGroups;
};
