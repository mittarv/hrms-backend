import { DataTypes, Model, Sequelize } from "sequelize";
import { hrmsAccessRoleAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";

class hrmsAccessRole extends Model<hrmsAccessRoleAttributes, Partial<hrmsAccessRoleAttributes>> implements hrmsAccessRoleAttributes {
  declare roleId: number;
  declare roleName: string;
  declare description: string | null;
  declare isDeleted: boolean;
  declare updatedBy?: string | null;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initHrmsAccessRole = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  hrmsAccessRole.init(
    {
      roleId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      roleName: {
        type: dataTypes.STRING(100),
        allowNull: false,
      },
      description: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      updatedBy: {
        type: dataTypes.STRING(36),
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "hrms_role",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        {
          name: "idx_hrms_role_roleName",
          fields: ["roleName"],
        },
        {
          name: "idx_hrms_role_isDeleted",
          fields: ["isDeleted"],
        },
        {
          name: "idx_hrms_role_updatedBy",
          fields: ["updatedBy"],
        },
      ],
    }
  );

  return hrmsAccessRole;
};
