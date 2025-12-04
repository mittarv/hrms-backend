import { QueryInterface, DataTypes } from "sequelize";

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  try {
    // Add the allotAllLeaves column to the employeeLeaveConfigurator table
    await queryInterface.addColumn('employeeLeaveConfigurators', 'allotAllLeaves', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, // Default to true to maintain existing behavior
      comment: 'If true, allot all leaves at once. If false, use accrual rate logic.'
    });

    console.log('Successfully added allotAllLeaves column to employeeLeaveConfigurators table');
  } catch (error) {
    console.error('Error adding allotAllLeaves column:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  try {
    // Remove the allotAllLeaves column from the employeeLeaveConfigurator table
    await queryInterface.removeColumn('employeeLeaveConfigurators', 'allotAllLeaves');

    console.log('Successfully removed allotAllLeaves column from employeeLeaveConfigurators table');
  } catch (error) {
    console.error('Error removing allotAllLeaves column:', error);
    throw error;
  }
};
