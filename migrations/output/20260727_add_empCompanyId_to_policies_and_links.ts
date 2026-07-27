import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface) => {
  await queryInterface.addColumn('importantlinklists', 'empCompanyId', {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'DEFAULT_COMPANY',
  }).catch((e: any) => {
    if (!e.message?.includes('Duplicate column')) throw e;
  });

  await queryInterface.addColumn('policylists', 'empCompanyId', {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'DEFAULT_COMPANY',
  }).catch((e: any) => {
    if (!e.message?.includes('Duplicate column')) throw e;
  });
};

export const down = async (queryInterface: QueryInterface) => {
  await queryInterface.removeColumn('importantlinklists', 'empCompanyId').catch(() => {});
  await queryInterface.removeColumn('policylists', 'empCompanyId').catch(() => {});
};
