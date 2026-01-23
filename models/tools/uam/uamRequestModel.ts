import { DataTypes, Model, Sequelize } from "sequelize";
import { UamRequestAttributes } from "../../../interfaces/toolInterfaces/interfaces/uamInterface";
import { approvalStatusEnum } from "../../../interfaces/toolInterfaces/enums/enums";

export class UamRequestModel
  extends Model<UamRequestAttributes, Partial<UamRequestAttributes>>
  implements UamRequestAttributes {
  declare id?: number;
  declare toolId?: number | null;
  declare requestedBy?: number | null;
  declare requestedOn?: Date | null;
  declare requestedAccess?: number | null;
  declare currentAccess?: number | null;
  declare remark?: string | null;
  declare status?: approvalStatusEnum | null;
  declare resolvedOn?: Date | null;
  declare resolvedBy?: number | null;
  declare isDeleted?: boolean | null;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initUamRequest = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  UamRequestModel.init(
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
      requestedBy: {
        type: dataTypes.INTEGER,
      },
      requestedOn: {
        type: dataTypes.DATE,
        defaultValue: dataTypes.NOW,
      },
      requestedAccess: {
        type: dataTypes.INTEGER,
      },
      currentAccess: {
        type: dataTypes.INTEGER,
      },
      remark: {
        type: dataTypes.STRING,
      },
      status: {
        type: dataTypes.ENUM(...Object.values(approvalStatusEnum)),
      },
      resolvedOn: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      resolvedBy: {
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
      modelName: "uamRequestDetail",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return UamRequestModel;
};
