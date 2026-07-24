import { DataTypes, Model, Sequelize } from "sequelize";

export interface UserOrganizationMappingAttributes {
  id?: string;
  userId: number; // reference to tms_users.userId
  organizationId: string; // reference to organizations.id
  role?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserOrganizationMapping extends Model<UserOrganizationMappingAttributes, Partial<UserOrganizationMappingAttributes>> implements UserOrganizationMappingAttributes {
  declare id: string;
  declare userId: number;
  declare organizationId: string;
  declare role: string;
  declare isDeleted: boolean;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const initUserOrganizationMapping = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  UserOrganizationMapping.init(
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      organizationId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      role: {
        type: dataTypes.STRING,
        defaultValue: "MEMBER",
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "userOrganizationMapping",
      tableName: "user_organization_mappings",
      timestamps: true,
    }
  );

  return UserOrganizationMapping;
};
