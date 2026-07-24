import { QueryInterface, DataTypes } from 'sequelize';

export const up = async ({ context: queryInterface }: { context: QueryInterface }) => {
  const tableInfo = await queryInterface.describeTable('employeeleaveconfigurators').catch(() => null);
  if (tableInfo && !tableInfo['isDeleted']) {
    await queryInterface.addColumn('employeeleaveconfigurators', 'isDeleted', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
  }
};

export const down = async ({ context: queryInterface }: { context: QueryInterface }) => {
  const tableInfo = await queryInterface.describeTable('employeeleaveconfigurators').catch(() => null);
  if (tableInfo && tableInfo['isDeleted']) {
    await queryInterface.removeColumn('employeeleaveconfigurators', 'isDeleted');
  }
};
