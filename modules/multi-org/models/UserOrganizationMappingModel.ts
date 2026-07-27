import { DataTypes, Model, Sequelize } from "sequelize";

export interface UserOrganizationMappingAttributes {
  id?: string;
  userId: number;
  organizationId: string;
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
        type: dataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: dataTypes.STRING,
        defaultValue: 'USER',
        allowNull: false,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "user_organization_mappings",
      timestamps: true,
    }
  );

  return UserOrganizationMapping;
};
