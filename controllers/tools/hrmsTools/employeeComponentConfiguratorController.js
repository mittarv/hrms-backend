const { raw } = require("express");
const { dbOutput } = require("../../../models/index");

const EmployeeComponentConfigurator = dbOutput.employeeComponentConfigurator;

exports.getAllComponentType = async (req, res) => {
    try {
      // Fetch component types
      const allComponentType = await EmployeeComponentConfigurator.findAll({
        where: { isDeleted: false },
        attributes: ['componentType', 'componentValue'],
        raw: true
      });
  
      // Transform the result into a single object
      const allComponent = allComponentType.reduce((acc, item) => {
        acc[item.componentType] = JSON.parse(item.componentValue); // Parse JSON for readability
        return acc;
      }, {});
  
      // Send response
      res.status(200).json({
        success: true,
        message: "All employee component types fetched successfully",
        allComponent
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
  