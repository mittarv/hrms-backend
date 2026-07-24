import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("organizations", "adminEmail", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    
    await queryInterface.addColumn("organizations", "allowedDomain", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("organizations", "adminEmail");
    await queryInterface.removeColumn("organizations", "allowedDomain");
  },
};
