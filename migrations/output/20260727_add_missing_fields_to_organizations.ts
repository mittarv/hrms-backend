import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface) => {
  const table = 'organizations';
  const columns: { [key: string]: any } = {
    slugDomain: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    adminEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    allowedDomain: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  };

  for (const [columnName, columnConfig] of Object.entries(columns)) {
    await queryInterface
      .addColumn(table, columnName, columnConfig)
      .catch((e) => console.log(`Column ${columnName} might already exist in ${table}:`, e.message));
  }
};

export const down = async (queryInterface: QueryInterface) => {
  const table = 'organizations';
  const columns = ['slugDomain', 'adminEmail', 'allowedDomain', 'metadata', 'isDeleted'];

  for (const columnName of columns) {
    await queryInterface
      .removeColumn(table, columnName)
      .catch((e) => console.log(`Column ${columnName} might not exist in ${table}:`, e.message));
  }
};
