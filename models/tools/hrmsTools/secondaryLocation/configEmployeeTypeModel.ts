import { DataTypes, Model, Sequelize } from "sequelize";
import { ConfigEmployeeTypeAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";

export class configEmployeeType
  extends Model<ConfigEmployeeTypeAttributes, Partial<ConfigEmployeeTypeAttributes>>
  implements ConfigEmployeeTypeAttributes {
  declare id: string;
  declare configId: string;
  declare employeeType: string;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initConfigEmployeeType = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  configEmployeeType.init(
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: dataTypes.UUID,
      },
      configId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      employeeType: {
        type: dataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "configEmployeeType",
      tableName: "config_employee_type",
      freezeTableName: true,
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return configEmployeeType;
};
