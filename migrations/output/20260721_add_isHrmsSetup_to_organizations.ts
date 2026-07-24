import { QueryInterface, DataTypes } from 'sequelize';

export const up = async ({ context: queryInterface }: { context: QueryInterface }) => {
  await queryInterface.addColumn('organizations', 'isHrmsSetup', {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  }).catch(e => console.log('Column might already exist in organizations'));
};

export const down = async ({ context: queryInterface }: { context: QueryInterface }) => {
  await queryInterface.removeColumn('organizations', 'isHrmsSetup').catch(e => console.log('Column might not exist in organizations'));
};
