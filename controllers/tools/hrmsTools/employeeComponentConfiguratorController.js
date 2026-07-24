const { raw } = require("express");
const { dbOutput } = require("../../../models/index");

const EmployeeComponentConfigurator = dbOutput.employeeComponentConfigurator;

exports.getAllComponentType = async (req, res) => {
    try {
      const empCompanyId = req.empCompanyId || req.body.empCompanyId || "DEFAULT_COMPANY";
      // Fetch component types
      let allComponentType = await EmployeeComponentConfigurator.findAll({
        where: { isDeleted: false, empCompanyId },
        attributes: ['componentType', 'componentValue'],
        raw: true
      });

      if (allComponentType.length === 0 && empCompanyId !== "DEFAULT_COMPANY") {
        const defaultComponents = await EmployeeComponentConfigurator.findAll({
          where: { isDeleted: false, empCompanyId: "DEFAULT_COMPANY" },
          attributes: ['componentType', 'componentValue'],
          raw: true
        });

        if (defaultComponents.length > 0) {
          const newComponents = defaultComponents.map(c => ({
            componentType: c.componentType,
            componentValue: c.componentValue,
            empCompanyId,
            isDeleted: false
          }));
          await EmployeeComponentConfigurator.bulkCreate(newComponents);
          allComponentType = defaultComponents;
        }
      }
  
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
        const { componentType, componentValue, empCompanyId: bodyEmpCompanyId } = req.body;
        const empCompanyId = req.empCompanyId || bodyEmpCompanyId || "DEFAULT_COMPANY";

        if (!componentType || !componentValue) {
            return res.status(400).json({ success: false, message: "componentType and componentValue are required" });
        }

        let component = await EmployeeComponentConfigurator.findOne({
            where: { componentType, empCompanyId, isDeleted: false }
        });

        // componentValue should be passed as an object from frontend, so we stringify it here
        const stringifiedValue = typeof componentValue === 'string' ? componentValue : JSON.stringify(componentValue);

        if (!component) {
            // Self-heal: Create the component if it's missing
            component = await EmployeeComponentConfigurator.create({
                componentType,
                empCompanyId,
                componentValue: stringifiedValue,
                isDeleted: false
            });
        } else {
            await component.update({
                componentValue: stringifiedValue
            });
        }

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