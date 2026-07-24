import { QueryInterface, DataTypes } from 'sequelize';

export const up = async ({ context: queryInterface }: { context: QueryInterface }) => {
  await queryInterface.addColumn('employeeComponentConfigurators', 'empCompanyId', {
    type: DataTypes.STRING,
    defaultValue: "DEFAULT_COMPANY",
    allowNull: false,
  });
};

export const down = async ({ context: queryInterface }: { context: QueryInterface }) => {
  await queryInterface.removeColumn('employeeComponentConfigurators', 'empCompanyId');
};
