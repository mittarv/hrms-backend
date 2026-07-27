import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface) => {
  await queryInterface.addColumn('user_organization_mappings', 'isDeleted', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  }).catch((e: any) => {
    if (!e.message?.includes('Duplicate column')) throw e;
  });
};

export const down = async (queryInterface: QueryInterface) => {
  await queryInterface.removeColumn('user_organization_mappings', 'isDeleted').catch(() => {});
};
