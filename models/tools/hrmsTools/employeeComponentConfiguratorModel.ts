import { DataTypes, Model, Sequelize } from "sequelize";
import { EmployeeComponentConfiguratorAttributes } from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class EmployeeComponentConfigurator
  extends Model<EmployeeComponentConfiguratorAttributes, Partial<EmployeeComponentConfiguratorAttributes>>
  implements EmployeeComponentConfiguratorAttributes {
  declare id: number;
  declare empCompanyId: string;
  declare componentType: string;
  declare componentValue: string;
  declare isDeleted?: boolean;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initEmployeeComponentConfigurator = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  EmployeeComponentConfigurator.init(
    {
      id: {
        type: dataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      empCompanyId: {
        type: dataTypes.STRING,
        allowNull: false,
        defaultValue: "DEFAULT_COMPANY",
      },
      componentType: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      componentValue: {
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
      modelName: "employeeComponentConfigurator",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return EmployeeComponentConfigurator;
};
