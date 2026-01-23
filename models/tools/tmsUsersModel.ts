import { DataTypes, Model, Sequelize } from "sequelize";
import { TmsUsersAttributes } from "../../interfaces/toolInterfaces/interfaces/uamInterface";

export class TmsUsers
  extends Model<TmsUsersAttributes, Partial<TmsUsersAttributes>>
  implements TmsUsersAttributes {
  declare userId?: number;
  declare name: string;
  declare email?: string | null;
  declare profilePic?: string | null;
  declare userType?: number | null;
  declare startDate?: Date | null;
  declare endDate?: Date | null;
  declare updatedBy?: number | null;
  declare isDeleted?: boolean | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initTmsUsers = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  TmsUsers.init(
    {
      userId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: dataTypes.INTEGER,
      },
      name: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: dataTypes.STRING,
      },
      profilePic: {
        type: dataTypes.STRING,
      },
      userType: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
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
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "tmsUsers",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return TmsUsers;
};
