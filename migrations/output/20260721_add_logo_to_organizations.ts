import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface) => {
  await queryInterface.addColumn('organizations', 'metadata', {
    type: DataTypes.JSON,
    allowNull: true,
  });
};

export const down = async (queryInterface: QueryInterface) => {
  await queryInterface.removeColumn('organizations', 'metadata').catch(e => console.log('Column might not exist in organizations'));
};
