import { DataTypes, Model, Sequelize } from "sequelize";
import { hrmsEmployeeRoleAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";

class hrmsEmployeeRole extends Model<hrmsEmployeeRoleAttributes, Partial<hrmsEmployeeRoleAttributes>> implements hrmsEmployeeRoleAttributes {
  declare employeeRoleId: number;
  declare empUuid: string;
  declare roleId: number;
  declare assignedBy?: string | null;
  declare isDeleted: boolean;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

export const initHrmsEmployeeRole = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  hrmsEmployeeRole.init(
    {
      employeeRoleId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      empUuid: {
        type: dataTypes.CHAR(36),
        allowNull: false,
        references: {
          model: "employeebasicdetails",
          key: "empUuid",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
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
      assignedBy: {
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
      tableName: "hrms_employee_role",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      charset: 'utf8mb3',
      collate: 'utf8mb3_general_ci',
      indexes: [
        {
          unique: true,
          name: "unique_employee_role",
          fields: ["empUuid", "roleId"],
        },
        {
          name: "idx_hrms_employee_role_empUuid",
          fields: ["empUuid"],
        },
        {
          name: "idx_hrms_employee_role_roleId",
          fields: ["roleId"],
        },
        {
          name: "idx_hrms_employee_role_isDeleted",
          fields: ["isDeleted"],
        },
        {
          name: "idx_hrms_employee_role_empUuid_isDeleted",
          fields: ["empUuid", "isDeleted"],
        },
      ],
    }
  );

  return hrmsEmployeeRole;
};

