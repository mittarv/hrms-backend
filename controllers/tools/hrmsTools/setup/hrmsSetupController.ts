import { Request, Response } from "express";
import { Op } from "sequelize";
import { dbOutput } from "../../../../models";

export const getOrganizationDetails = async (req: Request, res: Response) => {
  try {
    const { empCompanyId } = req as any;
    const targetCompanyId = empCompanyId || "DEFAULT_COMPANY";

    // Execute queries in parallel using Promise.all for speed
    const [orgResult, leaveCount, orgConfigs] = await Promise.all([
      (async () => {
        if (!targetCompanyId || targetCompanyId === "DEFAULT_COMPANY") return null;
        try {
          return await dbOutput.organization.findByPk(targetCompanyId, {
            attributes: ['id', 'name', 'metadata', 'createdAt']
          });
        } catch (e) {
          return null;
        }
      })(),
      dbOutput.employeeLeaveConfigurator
        ? dbOutput.employeeLeaveConfigurator.count({
            where: {
              empCompanyId: { [Op.in]: [targetCompanyId, "DEFAULT_COMPANY", null] },
              isActive: true
            }
          })
        : Promise.resolve(0),
      dbOutput.employeeComponentConfigurator
        ? dbOutput.employeeComponentConfigurator.findAll({
            where: {
              empCompanyId: { [Op.in]: [targetCompanyId, "DEFAULT_COMPANY", null] },
              isDeleted: false,
              componentType: [
                "emp_type_dropdown",
                "department_type_dropdown",
                "level_dropdown",
                "location_dropdown"
              ]
            }
          })
        : Promise.resolve([])
    ]);

    const org = orgResult || {
      id: targetCompanyId,
      name: "Default Organization",
      metadata: {},
      createdAt: new Date(),
      toJSON() { return this; }
    };

    // 1. Leave Configuration Check (Ribbon shows when leaveCount <= 1)
    const leaveConfigure = leaveCount > 1;
    const leaveConfigureMessage = leaveConfigure
      ? "Leave configuration is set up."
      : "Leave types are not configured. Please add leave configurations in Leave Settings.";

    // 2. Organization Settings Check
    const requiredTypes = [
      { key: "emp_type_dropdown", label: "Employee Type" },
      { key: "department_type_dropdown", label: "Department" },
      { key: "level_dropdown", label: "Level" },
      { key: "location_dropdown", label: "Location" }
    ];

    const missingOrgComponents: string[] = [];

    requiredTypes.forEach(({ key, label }) => {
      const configItem = 
        orgConfigs.find((c: any) => c.componentType === key && (c.empCompanyId === empCompanyId || c.empCompanyId === String(empCompanyId))) ||
        orgConfigs.find((c: any) => c.componentType === key && (c.empCompanyId === "DEFAULT_COMPANY" || !c.empCompanyId));

      let isConfigured = false;

      if (configItem && configItem.componentValue) {
        try {
          const val = typeof configItem.componentValue === 'string'
            ? JSON.parse(configItem.componentValue)
            : configItem.componentValue;
          if (val && (typeof val === 'object' || Array.isArray(val)) && Object.keys(val).length > 0) {
            isConfigured = true;
          }
        } catch (e) {
          isConfigured = false;
        }
      }

      if (!isConfigured) {
        missingOrgComponents.push(label);
      }
    });

    const orgConfigure = missingOrgComponents.length === 0;
    const orgConfigureMessage = orgConfigure
      ? "Organization settings are fully configured."
      : `Organization settings missing: ${missingOrgComponents.join(", ")}. Please complete setup in Organization Settings.`;

    const responseData = {
      ...org.toJSON(),
      leaveConfigure,
      leaveConfigureMessage,
      orgConfigure,
      orgConfigureMessage,
      missingOrgComponents
    };

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    console.error("Error fetching org:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
};

export const updateOrganizationDetails = async (req: Request, res: Response) => {
  try {
    const { empCompanyId } = req as any;
    const { logo, address } = req.body;
    if (!empCompanyId) return res.status(400).json({ error: "Missing organization ID." });

    const org = await dbOutput.organization.findByPk(empCompanyId);
    if (!org) return res.status(404).json({ error: "Organization not found." });

    const existingMetadata = org.metadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      ...(logo !== undefined && { logo }),
      ...(address !== undefined && { address }),
    };

    await org.update({ metadata: updatedMetadata });
    res.status(200).json({ success: true, message: "Organization updated successfully." });
  } catch (error) {
    console.error("Error updating org:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
};
