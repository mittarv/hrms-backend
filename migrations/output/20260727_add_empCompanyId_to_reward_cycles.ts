import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface) => {
  await queryInterface.addColumn('reward_cycles', 'empCompanyId', {
    type: DataTypes.STRING,
    defaultValue: "DEFAULT_COMPANY",
    allowNull: false,
  }).catch((e: any) => {
    if (!e.message?.includes('Duplicate column')) throw e;
  });

  await queryInterface.removeIndex('reward_cycles', 'reward_cycles_month_year').catch(() => {});
  await queryInterface.removeIndex('reward_cycles', ['month', 'year']).catch(() => {});

  await queryInterface.addIndex('reward_cycles', ['month', 'year', 'empCompanyId'], {
    unique: true,
    name: 'reward_cycles_month_year_company'
  }).catch(() => {});
};

export const down = async (queryInterface: QueryInterface) => {
  await queryInterface.removeIndex('reward_cycles', 'reward_cycles_month_year_company').catch(() => {});
  await queryInterface.removeColumn('reward_cycles', 'empCompanyId').catch(() => {});
  await queryInterface.addIndex('reward_cycles', ['month', 'year'], {
    unique: true,
    name: 'reward_cycles_month_year'
  }).catch(() => {});
};
