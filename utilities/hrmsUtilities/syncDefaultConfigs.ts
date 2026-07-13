import { dbOutput } from "../../models/index";

const EmployeeComponentConfigurator = dbOutput.employeeComponentConfigurator;

export const syncDefaultConfigs = async () => {
  console.log("Checking and auto-seeding default HRMS configurations if missing...");
  
  const defaults = [
    {
      componentType: "gender_type_dropdown",
      componentValue: JSON.stringify({
        male_key: "Male",
        female_key: "Female",
        other_key: "Other",
      }),
    },
    {
      componentType: "blood_group_dropdown",
      componentValue: JSON.stringify({
        0: "A+",
        1: "A-",
        2: "B+",
        3: "B-",
        4: "AB+",
        5: "AB-",
        6: "O+",
        7: "O-",
      }),
    },
    {
      componentType: "government_id_type",
      componentValue: JSON.stringify({
        aadhar: "Aadhaar",
        passport: "Passport",
        voter_id: "Voter ID",
        pan: "PAN",
        driving_license: "Driving License",
        others: "Others",
      }),
    },
    //. =======================This is strictly for the TMS-WEB AND BACKEND FOR AVOID ANY MISS CONFIG IN PRODUCTION=========================
    // {
    //   componentType: "employee_type_mapping",
    //   componentValue: JSON.stringify({
    //     "FTE": { hasLevel: true, hasYearOfStudy: false, hideLevelInProfile: false },
    //     "OFTE": { hasLevel: true, hasYearOfStudy: false, hideLevelInProfile: true },
    //     "PTE": { hasLevel: true, hasYearOfStudy: false, hideLevelInProfile: false },
    //     "Intern": { hasLevel: true, hasYearOfStudy: true, hideLevelInProfile: false },
    //     "Extended Intern": { hasLevel: true, hasYearOfStudy: true, hideLevelInProfile: false },
    //   }),
    // },
    {
      componentType: "department_type_mapping",
      componentValue: JSON.stringify({
        "Leadership": { disablesLevel: true },
      }),
    }
  ];

  try {
    const existingCount = await EmployeeComponentConfigurator.count({
      where: { isDeleted: false },
    });

    if (existingCount > 0) {
      console.log("HRMS configurations table is not empty. Skipping auto-seed.");
      return;
    }

    for (const config of defaults) {
      const existingConfig = await EmployeeComponentConfigurator.findOne({
        where: { componentType: config.componentType, isDeleted: false },
      });

      if (!existingConfig) {
        await EmployeeComponentConfigurator.create({
          ...config,
          isDeleted: false,
        });
        console.log(`Auto-seeded ${config.componentType}`);
      }
    }
  } catch (error) {
    console.error("Error during HRMS default config sync:", error);
  }
};
