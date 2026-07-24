import { QueryInterface, DataTypes } from 'sequelize';

export const up = async ({ context: queryInterface }: { context: QueryInterface }) => {
  await queryInterface.addColumn('organizations', 'isDeleted', {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: true,
  });

  await queryInterface.addColumn('user_organization_mappings', 'isDeleted', {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: true,
  });
};

export const down = async ({ context: queryInterface }: { context: QueryInterface }) => {
  await queryInterface.removeColumn('organizations', 'isDeleted');
  await queryInterface.removeColumn('user_organization_mappings', 'isDeleted');
};
