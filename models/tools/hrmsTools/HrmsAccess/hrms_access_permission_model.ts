import { DataTypes, Model, Sequelize } from "sequelize";
import { hrmsAccessPermissionAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";

class hrmsAccessPermission extends Model<hrmsAccessPermissionAttributes, Partial<hrmsAccessPermissionAttributes>> implements hrmsAccessPermissionAttributes {
  declare permissionId: number;
  declare name: string;
  declare displayName: string;
  declare description: string | null;
  declare category: string | null;
  declare isDeleted: boolean;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initHrmsAccessPermission = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  hrmsAccessPermission.init(
    {
      permissionId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: dataTypes.STRING(100),
        allowNull: false,
      },
      displayName: {
        type: dataTypes.STRING(150),
        allowNull: false,
      },
      description: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      category: {
        type: dataTypes.STRING(50),
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
      tableName: "hrms_permissions",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        {
          name: "idx_hrms_permissions_name",
          fields: ["name"],
        },
        {
          name: "idx_hrms_permissions_category",
          fields: ["category"],
        },
        {
          name: "idx_hrms_permissions_isDeleted",
          fields: ["isDeleted"],
        },
        {
          name: "idx_hrms_permissions_category_isDeleted",
          fields: ["category", "isDeleted"],
        },
      ],
    }
  );

  return hrmsAccessPermission;
};

