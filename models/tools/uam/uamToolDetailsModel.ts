import { DataTypes, Model, Sequelize } from "sequelize";
import { UamToolsAttributes } from "../../../interfaces/toolInterfaces/interfaces/uamInterface";

export class UamToolsDetails
  extends Model<UamToolsAttributes, Partial<UamToolsAttributes>>
  implements UamToolsAttributes {
  declare toolId?: number;
  declare name: string;
  declare description: string;
  declare remark?: string | null;
  declare link?: string | null;
  declare adminId?: number | null;
  declare startDate?: Date | null;
  declare endDate?: Date | null;
  declare updatedBy?: number | null;
  declare isDeleted?: boolean | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initUamToolsDetails = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  UamToolsDetails.init(
    {
      toolId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: dataTypes.INTEGER,
      },
      name: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      remark: {
        type: dataTypes.STRING,
      },
      link: {
        type: dataTypes.STRING,
      },
      adminId: {
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
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "uamToolsDetail",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return UamToolsDetails;
};
