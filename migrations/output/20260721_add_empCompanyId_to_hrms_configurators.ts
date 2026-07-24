import { QueryInterface, DataTypes } from 'sequelize';

export const up = async ({ context: queryInterface }: { context: QueryInterface }) => {
  const tables = ['employeeleaveconfigurators', 'salarycategories', 'salary_components'];
  for (const table of tables) {
    await queryInterface.addColumn(table, 'empCompanyId', {
      type: DataTypes.STRING,
      defaultValue: "DEFAULT_COMPANY",
      allowNull: false,
    }).catch(e => console.log(`Column might already exist in ${table}`));
  }
};

export const down = async ({ context: queryInterface }: { context: QueryInterface }) => {
  const tables = ['employeeleaveconfigurators', 'salarycategories', 'salary_components'];
  for (const table of tables) {
    await queryInterface.removeColumn(table, 'empCompanyId').catch(e => console.log(`Column might not exist in ${table}`));
  }
};
