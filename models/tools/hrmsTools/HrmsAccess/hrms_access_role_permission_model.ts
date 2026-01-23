import { DataTypes, Model, Sequelize } from "sequelize";
import { hrmsAccessRolePermissionAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";

class hrmsAccessRolePermission extends Model<hrmsAccessRolePermissionAttributes, Partial<hrmsAccessRolePermissionAttributes>> implements hrmsAccessRolePermissionAttributes {
  declare rolePermissionId: number;
  declare roleId: number;
  declare permissionId: number;
  declare lastActionBy?: string | null;
  declare isDeleted: boolean;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initHrmsAccessRolePermission = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  hrmsAccessRolePermission.init(
    {
      rolePermissionId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      roleId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "hrms_role",
          key: "roleId",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      permissionId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "hrms_permissions",
          key: "permissionId",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      lastActionBy: {
        type: dataTypes.STRING(36),
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      tableName: "hrms_role_permission",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        {
          unique: true,
          name: "unique_role_permission",
          fields: ["roleId", "permissionId"],
        },
        {
          name: "idx_hrms_role_permission_roleId",
          fields: ["roleId"],
        },
        {
          name: "idx_hrms_role_permission_permissionId",
          fields: ["permissionId"],
        },
        {
          name: "idx_hrms_role_permission_isDeleted",
          fields: ["isDeleted"],
        },
        {
          name: "idx_hrms_role_permission_roleId_isDeleted",
          fields: ["roleId", "isDeleted"],
        },
        {
          name: "idx_hrms_role_permission_permissionId_isDeleted",
          fields: ["permissionId", "isDeleted"],
        },
      ],
    }
  );

  return hrmsAccessRolePermission;
};

