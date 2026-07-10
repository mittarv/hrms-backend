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

exports.updateComponentType = async (req, res) => {
    try {
        const { componentType, componentValue } = req.body;

        if (!componentType || !componentValue) {
            return res.status(400).json({ success: false, message: "componentType and componentValue are required" });
        }

        const component = await EmployeeComponentConfigurator.findOne({
            where: { componentType, isDeleted: false }
        });

        if (!component) {
            return res.status(404).json({ success: false, message: "Component type not found" });
        }

        // componentValue should be passed as an object from frontend, so we stringify it here
        const stringifiedValue = typeof componentValue === 'string' ? componentValue : JSON.stringify(componentValue);

        await component.update({
            componentValue: stringifiedValue
        });

        res.status(200).json({
            success: true,
            message: "Component type updated successfully",
            updatedComponent: {
                componentType: component.componentType,
                componentValue: JSON.parse(stringifiedValue)
            }
        });
    } catch (error) {
        console.error("Error updating component type:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};