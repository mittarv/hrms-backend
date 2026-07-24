import { Request, Response } from "express";
import { Op } from "sequelize";
import { dbOutput } from "../../../../models";

export const completeHrmsSetup = async (req: Request, res: Response) => {
  try {
    const { empCompanyId, user } = req as any;
    const { employeeType, department, level, location, adminDetails, logo } = req.body;

    if (!empCompanyId) {
      return res.status(400).json({ error: "Missing organization ID (empCompanyId)." });
    }

    // Start a transaction
    await dbOutput.sequelize.transaction(async (t: any) => {
      // 1. Save custom configurations
      const configData = [
        { componentType: "emp_type_dropdown", componentValue: JSON.stringify(employeeType) },
        { componentType: "department_type_dropdown", componentValue: JSON.stringify(department) },
        { componentType: "level_dropdown", componentValue: JSON.stringify(level) },
        { componentType: "location_dropdown", componentValue: JSON.stringify(location) }
      ];

      for (const config of configData) {
        const existing = await dbOutput.employeeComponentConfigurator.findOne({
          where: { empCompanyId, componentType: config.componentType },
          transaction: t
        });

        if (existing) {
          await existing.update(
            { componentValue: config.componentValue, isDeleted: false },
            { transaction: t }
          );
        } else {
          await dbOutput.employeeComponentConfigurator.create(
            { ...config, empCompanyId, isDeleted: false },
            { transaction: t }
          );
        }
      }

      // 2. Create Admin Employee if provided
      if (adminDetails) {
        const { empFirstName, empLastName, empOfficialEmail } = adminDetails;
        if (empOfficialEmail) {
          const empUuid = require("crypto").randomUUID();
          await dbOutput.employeeBasicDetails.create(
            {
              empUuid,
              empFirstName,
              empLastName,
              empCompanyId,
              empType: "FTE",
              empStatus: "ACTIVE",
              onboardingStatus: "ONBOARDED"
            },
            { transaction: t }
          );

          await dbOutput.employeeContactDetails.create(
            {
              empUuid,
              empOfficialEmail,
              isDeleted: false
            },
            { transaction: t }
          );
        }
      }

      // 4. Auto-seed Unpaid Leave in employeeLeaveConfigurator if missing
      if (dbOutput.employeeLeaveConfigurator) {
        const existingUnpaid = await dbOutput.employeeLeaveConfigurator.findOne({
          where: { empCompanyId, leaveType: "Unpaid Leave", isDeleted: false },
          transaction: t
        });
        if (!existingUnpaid) {
          const crypto = require('crypto');
          await dbOutput.employeeLeaveConfigurator.create({
            leaveConfigId: crypto.randomUUID(),
            empCompanyId,
            leaveType: "Unpaid Leave",
            employeeType: "{}",
            accuralFrequency: "monthly_key",
            totalAllotedLeaves: 0,
            accuralRate: 0,
            minimumNoticePeriod: 0,
            maximumNoticePeriod: 0,
            continuousLeavesLimit: 0,
            excludePaidWeekend: false,
            appliedGender: "All",
            isHalfDayAllowed: true,
            isProofRequired: false,
            isReasonRequired: false,
            effectiveDate: new Date(),
            isActive: true,
            isDefault: false,
            allotAllLeaves: false,
          }, { transaction: t });
        }
      }

      // 5. Auto-seed Loss of Pay in salaryComponents if missing
      if (dbOutput.salaryComponents && dbOutput.salaryCategories) {
        let globalCategory = await dbOutput.salaryCategories.findOne({
          where: { empCompanyId: { [Op.in]: [empCompanyId, "DEFAULT_COMPANY", null] }, isDeleted: false },
          transaction: t
        });
        if (!globalCategory) {
          const crypto = require('crypto');
          globalCategory = await dbOutput.salaryCategories.create({
            salaryCategoryId: crypto.randomUUID(),
            empCompanyId,
            employeeType: "fte_key",
            employeeLocation: "hybrid_key",
            isDeleted: false
          }, { transaction: t });
        }
        const existingLop = await dbOutput.salaryComponents.findOne({
          where: {
            empCompanyId: { [Op.in]: [empCompanyId, "DEFAULT_COMPANY", null] },
            componentName: { [Op.like]: "%loss of pay%" },
            isDeleted: false
          },
          transaction: t
        });
        if (!existingLop && globalCategory) {
          const crypto = require('crypto');
          await dbOutput.salaryComponents.create({
            componentId: crypto.randomUUID(),
            empCompanyId,
            salaryCategoryId: globalCategory.salaryCategoryId,
            componentName: "Loss of Pay(per day)",
            componentType: "defaultDeduction",
            amount: 0,
            isVariable: false,
            includeinLop: false,
            isDeleted: false,
            isDefault: true,
            createdBy: "system",
            updatedBy: "system"
          }, { transaction: t });
        }
      }
    });

    res.status(200).json({ success: true, message: "HRMS setup completed successfully." });
  } catch (error) {
    console.error("Error completing HRMS setup:", error);
    res.status(500).json({ error: "Internal server error during HRMS setup." });
  }
};

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
// Currently we are not creating default Fileds for the Organization Setting but if need we can use this controller
export const autoCompleteHrmsSetup = async (req: Request, res: Response) => {
  try {
    const { empCompanyId, user } = req as any;

    if (!empCompanyId) {
      return res.status(400).json({ error: "Missing organization ID (empCompanyId)." });
    }

    // Default configuration payloads
    const employeeType = { "full_time_key": "Full-Time", "part_time_key": "Part-Time", "contractor_key": "Contractor" };
    const department = { "engineering_key": "Engineering", "sales_key": "Sales", "hr_key": "HR", "administration_key": "Administration" };
    const level = { "junior_key": "Junior", "mid_key": "Mid", "senior_key": "Senior" };
    const location = { "hq_key": "Headquarters" };

    // Start a transaction
    await dbOutput.sequelize.transaction(async (t: any) => {
      // 1. Save default custom configurations
      const configData = [
        { componentType: "emp_type_dropdown", componentValue: JSON.stringify(employeeType) },
        { componentType: "department_type_dropdown", componentValue: JSON.stringify(department) },
        { componentType: "level_dropdown", componentValue: JSON.stringify(level) },
        { componentType: "location_dropdown", componentValue: JSON.stringify(location) }
      ];

      for (const config of configData) {
        const existing = await dbOutput.employeeComponentConfigurator.findOne({
          where: { empCompanyId, componentType: config.componentType },
          transaction: t
        });
        if (existing) {
          await existing.update({ componentValue: config.componentValue }, { transaction: t });
        } else {
          await dbOutput.employeeComponentConfigurator.create({
            empCompanyId,
            componentType: config.componentType,
            componentValue: config.componentValue
          }, { transaction: t });
        }
      }

      // 2. Do not create an employee record here. The organization admin must
      // complete the employee onboarding form so their required profile fields
      // are saved and displayed consistently across HRMS.

    });

    res.status(200).json({ success: true, message: "HRMS setup completed. Complete employee onboarding to create your profile." });
  } catch (error: any) {
    console.error("Error during HRMS silent setup:", error);
    res.status(500).json({ success: false, error: "Internal server error during HRMS silent setup." });
  }
};
