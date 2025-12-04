"use strict";
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Add column to employeejobdetails

    console.log(`Adding empConversionDate column to employeejobdetails tables`);

    await queryInterface.addColumn("employeejobdetails", "empConversionDate", {
      type: DataTypes.DATE,
      allowNull: true,
    });

    console.log(`Column empConversionDate added to employeejobdetails`);

    // 2. Add column to employeejobdetailhistories

    console.log(
      `Adding empConversionDate column to employeejobdetailhistories`
    );

    await queryInterface.addColumn(
      "employeejobdetailhistories",
      "empConversionDate",
      {
        type: DataTypes.DATE,
        allowNull: true,
      }
    );

    console.log(`Column empConversionDate added to employeejobdetailhistories`);

    // 3. Update employeejobdetails.empConversionDate with empHireDate

    console.log(
      `Updating employeejobdetails.empConversionDate with empHireDate`
    );

    await queryInterface.sequelize.query(`
            UPDATE employeejobdetails ejd
            INNER JOIN employeebasicdetails ebd ON ejd.empUuid = ebd.empUuid
            SET ejd.empConversionDate = ebd.empHireDate
        `);

    console.log(
      `employeejobdetails.empConversionDate updated with empHireDate`
    );

    // 4. Update employeejobdetailhistories.empConversionDate with empHireDate for all records of each empUuid

    console.log(
      `Updating employeejobdetailhistories.empConversionDate with empHireDate`
    );

    await queryInterface.sequelize.query(`
            UPDATE employeejobdetailhistories ejdh
            INNER JOIN employeebasicdetails ebd ON ejdh.empUuid = ebd.empUuid
            SET ejdh.empConversionDate = ebd.empHireDate
        `);

    console.log(
      `employeejobdetailhistories.empConversionDate updated with empHireDate`
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn(
      "employeejobdetails",
      "empConversionDate"
    );
    await queryInterface.removeColumn(
      "employeejobdetailhistories",
      "empConversionDate"
    );
  },
};
