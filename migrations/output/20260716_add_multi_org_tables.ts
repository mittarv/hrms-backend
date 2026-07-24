'use strict';

import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Creating Multi-Org tables and columns');

    // 1. Create organizations table
    await queryInterface.createTable('organizations', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subdomain: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      domain: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'),
        defaultValue: 'ACTIVE',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(),
      }
    });

    // 2. Create user_organization_mappings table
    await queryInterface.createTable('user_organization_mappings', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USER',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(),
      }
    });

    // 3. Add empCompanyId to config tables
    const defaultCompanyConfig = {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'DEFAULT_COMPANY',
    };

    const tablesToAlter = [
      'salarycategories',
      'salarycomponents',
      'employeeleaveconfigurators'
    ];

    for (const table of tablesToAlter) {
      const tableInfo = await queryInterface.describeTable(table).catch(() => null);
      if (tableInfo && !tableInfo['empCompanyId']) {
        await queryInterface.addColumn(table, 'empCompanyId', defaultCompanyConfig);
      }
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const tablesToAlter = [
      'salarycategories',
      'salarycomponents',
      'employeeleaveconfigurators'
    ];

    for (const table of tablesToAlter) {
      const tableInfo = await queryInterface.describeTable(table).catch(() => null);
      if (tableInfo && tableInfo['empCompanyId']) {
        await queryInterface.removeColumn(table, 'empCompanyId');
      }
    }

    await queryInterface.dropTable('user_organization_mappings');
    await queryInterface.dropTable('organizations');
  }
};
