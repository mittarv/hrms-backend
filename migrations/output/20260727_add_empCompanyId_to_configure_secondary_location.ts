import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface) => {
  await queryInterface.addColumn('configure_secondary_location', 'empCompanyId', {
    type: DataTypes.STRING,
    defaultValue: "DEFAULT_COMPANY",
    allowNull: false,
  }).catch((e: any) => {
    if (!e.message?.includes('Duplicate column')) throw e;
  });
};

export const down = async (queryInterface: QueryInterface) => {
  await queryInterface.removeColumn('configure_secondary_location', 'empCompanyId').catch(() => {});
};
