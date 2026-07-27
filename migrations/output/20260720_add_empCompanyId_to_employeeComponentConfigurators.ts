import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface) => {
  await queryInterface.addColumn('employeecomponentconfigurators', 'empCompanyId', {
    type: DataTypes.STRING,
    defaultValue: "DEFAULT_COMPANY",
    allowNull: false,
  });
};

export const down = async (queryInterface: QueryInterface) => {
  await queryInterface.removeColumn('employeecomponentconfigurators', 'empCompanyId');
};