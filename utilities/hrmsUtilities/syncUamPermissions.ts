import { dbOutput } from "../../models/index";

export const syncUamPermissions = async () => {
  console.log("Checking and auto-seeding HRMS UAM permissions if missing...");

  const HrmsAccessPermission = dbOutput.hrmsAccessPermission;
  if (!HrmsAccessPermission) {
    console.error("HrmsAccessPermission model not found in dbOutput.");
    return;
  }

  const permissions = [
    // Policy Management
    { name: 'Policy_create', displayName: 'Create Policy', description: 'Permission to create policy', category: 'Policy Management' },
    { name: 'Policy_update', displayName: 'Update Policy', description: 'Permission to update policy', category: 'Policy Management' },
    { name: 'Policy_delete', displayName: 'Delete Policy', description: 'Permission to delete policy', category: 'Policy Management' },
    { name: 'policyAdmin_view', displayName: 'View Policy (Admin)', description: 'Admin permission to view policy', category: 'Policy Management' },
    // Important Links
    { name: 'ImportantLink_create', displayName: 'Create Important Link', description: 'Permission to create important link', category: 'Important Links' },
    { name: 'ImportantLink_update', displayName: 'Update Important Link', description: 'Permission to update important link', category: 'Important Links' },
    { name: 'ImportantLink_delete', displayName: 'Delete Important Link', description: 'Permission to delete important link', category: 'Important Links' },
    { name: 'ImportantLinkAdmin_view', displayName: 'View Important Link (Admin)', description: 'Admin permission to view important link', category: 'Important Links' },
    // Employee Repository
    { name: 'ActiveEmployee_read', displayName: 'View Active Employee', description: 'Permission to view active employee', category: 'Employee Repository' },
    { name: 'ActiveEmployee_onBoarding', displayName: 'Onboard Employee', description: 'Permission to onboard employee', category: 'Employee Repository' },
    { name: 'ActiveEmployee_update', displayName: 'Update Employee Details', description: 'Permission to update employee details', category: 'Employee Repository' },
    { name: 'EmployeeDirectoryAdmin_View', displayName: 'View Employee Directory (Admin)', description: 'Admin permission to view employee directory', category: 'Employee Repository' },
    // Leave Configuration
    { name: 'LeaveConfigurator_Read', displayName: 'View Leave Configurator', description: 'Permission to view leave configurator', category: 'Leave Configuration' },
    { name: 'LeaveConfigurator_Create', displayName: 'Create New Leaves', description: 'Permission to create new leaves', category: 'Leave Configuration' },
    { name: 'LeaveConfigurator_update', displayName: 'Update Existing Leaves', description: 'Permission to update existing leaves', category: 'Leave Configuration' },
    // Leave & Attendance
    { name: 'LeaveAttendanceAdmin_read', displayName: 'View Leave & Attendance (Admin)', description: 'Admin permission to view leave and attendance', category: 'Leave & Attendance' },
    { name: 'LeaveAttendance_write', displayName: 'Edit Attendance for Other Employees', description: 'Permission to edit attendance for other employees', category: 'Leave & Attendance' },
    { name: 'HolidayAdmin_view', displayName: 'View Holiday (Admin)', description: 'Admin permission to view holiday', category: 'Leave & Attendance' },
    { name: 'Holiday_Create', displayName: 'Create New Holiday', description: 'Permission to create new holiday', category: 'Leave & Attendance' },
    { name: 'Holiday_Update', displayName: 'Update Holiday', description: 'Permission to update holiday', category: 'Leave & Attendance' },
    { name: 'Holiday_Delete', displayName: 'Delete Holiday', description: 'Permission to delete holiday', category: 'Leave & Attendance' },
    // Payroll
    { name: 'ConfigureSalary_read', displayName: 'View Salary Configurator', description: 'Permission to view salary configurator', category: 'Payroll' },
    { name: 'ConfigureSalary_create', displayName: 'Create Salary Component', description: 'Permission to create salary component', category: 'Payroll' },
    { name: 'ConfigureSalary_update', displayName: 'Update Salary Component', description: 'Permission to update salary component', category: 'Payroll' },
    { name: 'ConfigureSalary_delete', displayName: 'Delete Salary Component', description: 'Permission to delete salary component', category: 'Payroll' },
    { name: 'Payroll_read', displayName: 'View Payroll', description: 'Permission to view payroll', category: 'Payroll' },
    { name: 'Payroll_Edit', displayName: 'Edit Payroll', description: 'Permission to edit payroll', category: 'Payroll' },
    { name: 'Payroll_finalize', displayName: 'Finalize Payroll', description: 'Permission to finalize payroll', category: 'Payroll' },
    { name: 'Payroll_Generate', displayName: 'Generate Payroll', description: 'Permission to generate payroll', category: 'Payroll' },
    // Requests & Approvals
    { name: 'EmployeeDetailsRequest_read', displayName: 'View Employee Detail Requests', description: 'Permission to view employee detail requests', category: 'Requests & Approvals' },
    { name: 'EmployeeDetailsRequest_write', displayName: 'Approve & Reject Employee Detail Requests', description: 'Permission to approve and reject employee detail requests', category: 'Requests & Approvals' },
    { name: 'LeaveRequest_read', displayName: 'View Employee Leave Request', description: 'Permission to view employee leave request', category: 'Requests & Approvals' },
    { name: 'LeaveRequest_write', displayName: 'Approve & Reject Leave Requests', description: 'Permission to approve and reject leave requests', category: 'Requests & Approvals' },
    { name: 'ExtraWorkDayRequests_read', displayName: 'View Extra Work Day Requests', description: 'Permission to view extra work day requests', category: 'Requests & Approvals' },
    { name: 'ExtraWorkDayRequests_write', displayName: 'Approve & Reject Extra Work Day Request', description: 'Permission to approve and reject extra work day request', category: 'Requests & Approvals' },
    // HrmsAccess
    { name: 'HrmsRoleManagement_read', displayName: 'View Role Management', description: 'Permission to view role management', category: 'HrmsAccess' },
    { name: 'HrmsRoleManagement_create', displayName: 'Create New Role', description: 'Permission to create new role', category: 'HrmsAccess' },
    { name: 'HrmsRoleManagement_update', displayName: 'Update Existing Roles', description: 'Permission to update the existing roles', category: 'HrmsAccess' },
    { name: 'HrmsRoleManagement_delete', displayName: 'Delete Existing Roles', description: 'Permission to delete the existing roles', category: 'HrmsAccess' },
    { name: 'HrmsUserManagement_read', displayName: 'View User Management', description: 'Permission to view user management', category: 'HrmsAccess' },
    { name: 'HrmsUserManagement_write', displayName: 'Assign & Revoke Roles Access', description: 'Permission to assign and revoke roles access', category: 'HrmsAccess' },
  ];

  try {
    const existingCount = await HrmsAccessPermission.count({
      where: { isDeleted: false },
    });

    if (existingCount > 0) {
      console.log("HRMS UAM permissions table is not empty. Skipping auto-seed.");
      return;
    }

    for (const perm of permissions) {
      const existing = await HrmsAccessPermission.findOne({
        where: { name: perm.name, isDeleted: false },
      });

      if (!existing) {
        await HrmsAccessPermission.create({
          ...perm,
          isDeleted: false,
        });
        console.log(`Auto-seeded UAM permission: ${perm.name}`);
      }
    }
  } catch (error) {
    console.error("Error during HRMS UAM permissions sync:", error);
  }
};
