import { Transaction, Op } from 'sequelize';
import { dbOutput } from '../../../models';
import {
  Permission,
  GroupedPermissions,
  FormattedRole,
  RoleInstance,
  RolePermission,
  RolePermissionAssociation,
  EmployeeRoleData,
  EmployeeWithRoles,
}
from '../../../interfaces/hrmsTool/interface/hrmsInterface';
// Database Models
const {
  hrmsAccessRole,
  hrmsAccessPermission,
  hrmsAccessRolePermission,
  hrmsEmployeeRole,
  employeeBasicDetails,
} = dbOutput;


/**
 * Get all permissions grouped by category
 * @returns All permissions grouped by category
 */
export const getAllPermissionsService = async () => {
  const permissions = await hrmsAccessPermission.findAll({
    where: {
      isDeleted: false,
    },
    attributes: ['permissionId', 'name', 'displayName', 'description', 'category'],
    order: [
      ['category', 'ASC'],
      ['displayName', 'ASC'],
    ],
  });

  // Group permissions by category
  const groupedPermissions = permissions.reduce((acc: GroupedPermissions, permission: Permission) => {
    const category = permission.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({
      permissionId: permission.permissionId,
      name: permission.name,
      displayName: permission.displayName,
      description: permission.description,
    });
    return acc;
  }, {} as GroupedPermissions);

  return groupedPermissions;
};

/**
 * Get all roles with their permissions
 * @returns All roles with their associated permissions
 */
export const getAllRolesService = async () => {
  // First, get all non-deleted permissions to check if role has all permissions
  const allPermissions = await hrmsAccessPermission.findAll({
    where: {
      isDeleted: false,
    },
    attributes: ['permissionId'],
  });

  const allPermissionIds = new Set(allPermissions.map((p: Permission) => p.permissionId));

  const roles = await hrmsAccessRole.findAll({
    where: {
      isDeleted: false,
    },
    attributes: ['roleId', 'roleName', 'description', 'updatedBy', 'createdAt', 'updatedAt'],
    include: [
      {
        model: hrmsAccessPermission,
        as: 'permissions',
        through: {
          attributes: [],
          where: {
            isDeleted: false,
          },
        },
        attributes: ['permissionId', 'name', 'displayName', 'category'],
        required: false,
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  // Format response
  const formattedRoles: FormattedRole[] = roles.map((role: RoleInstance) => {
    const rolePermissions = role.permissions || [];
    const rolePermissionIds = new Set(rolePermissions.map((perm: Permission) => perm.permissionId));
    
    // Check if role has all non-deleted permissions
    const allPermissionIdsArray = Array.from(allPermissionIds) as number[];
    const hasAllPermissions = allPermissionIds.size > 0 && 
      allPermissionIds.size === rolePermissionIds.size &&
      allPermissionIdsArray.every((id: number) => rolePermissionIds.has(id));

    return {
      roleId: role.roleId,
      roleName: role.roleName,
      description: role.description,
      updatedBy: role.updatedBy,
      permissions: rolePermissions.map((perm: Permission): RolePermission => ({
        permissionId: perm.permissionId,
        name: perm.name,
        displayName: perm.displayName,
        category: perm.category || null,
      })),
      allPermission: hasAllPermissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  });

  return formattedRoles;
};

/**
 * Get a single role by ID with permissions
 * @param roleId - The ID of the role to fetch
 * @returns The role with its permissions, or null if not found
 */
export const getRoleByIdService = async (roleId: number) => {
  // First, get all non-deleted permissions to check if role has all permissions
  const allPermissions = await hrmsAccessPermission.findAll({
    where: {
      isDeleted: false,
    },
    attributes: ['permissionId'],
  });

  const allPermissionIds = new Set(allPermissions.map((p: Permission) => p.permissionId));

  const role = await hrmsAccessRole.findOne({
    where: {
      roleId: roleId,
      isDeleted: false,
    },
    attributes: ['roleId', 'roleName', 'description', 'updatedBy', 'createdAt', 'updatedAt'],
    include: [
      {
        model: hrmsAccessPermission,
        as: 'permissions',
        through: {
          attributes: [],
          where: {
            isDeleted: false,
          },
        },
        attributes: ['permissionId', 'name', 'displayName', 'category'],
        required: false,
      },
    ],
  });

  if (!role) {
    return null;
  }

  const roleData = role as unknown as RoleInstance;
  const rolePermissions = roleData.permissions || [];
  const rolePermissionIds = new Set(rolePermissions.map((perm: Permission) => perm.permissionId));
  
  // Check if role has all non-deleted permissions
  const allPermissionIdsArray = Array.from(allPermissionIds) as number[];
  const hasAllPermissions = allPermissionIds.size > 0 && 
    allPermissionIds.size === rolePermissionIds.size &&
    allPermissionIdsArray.every((id: number) => rolePermissionIds.has(id));

  const formattedRole: FormattedRole = {
    roleId: roleData.roleId,
    roleName: roleData.roleName,
    description: roleData.description,
    updatedBy: roleData.updatedBy,
    permissions: rolePermissions.map((perm: Permission): RolePermission => ({
      permissionId: perm.permissionId,
      name: perm.name,
      displayName: perm.displayName,
      category: perm.category || null,
    })),
    allPermission: hasAllPermissions,
    createdAt: roleData.createdAt,
    updatedAt: roleData.updatedAt,
  };

  return formattedRole;
};

/**
 * Check if a role name already exists
 * @param roleName - The role name to check
 * @param excludeRoleId - Optional role ID to exclude from the check (for updates)
 * @param transaction - Database transaction
 * @returns True if role name exists, false otherwise
 */
export const checkRoleNameExistsService = async (
  roleName: string,
  transaction: Transaction,
  excludeRoleId?: number
): Promise<boolean> => {
  const whereClause: {
    roleName: string;
    isDeleted: boolean;
    roleId?: { [Op.ne]: number };
  } = {
    roleName: roleName.trim(),
    isDeleted: false,
  };

  if (excludeRoleId) {
    whereClause.roleId = { [Op.ne]: excludeRoleId };
  }

  const existingRole = await hrmsAccessRole.findOne({
    where: whereClause,
    transaction,
  });

  return !!existingRole;
};

/**
 * Validate that all permission IDs exist
 * @param permissionIds - Array of permission IDs to validate
 * @param transaction - Database transaction
 * @returns True if all permissions exist, false otherwise
 */
export const validatePermissionIdsService = async (
  permissionIds: number[],
  transaction: Transaction
): Promise<boolean> => {
  const permissions = await hrmsAccessPermission.findAll({
    where: {
      permissionId: permissionIds,
      isDeleted: false,
    },
    attributes: ['permissionId'],
    transaction,
  });

  return permissions.length === permissionIds.length;
};

/**
 * Create a new role with permissions
 * @param roleName - The name of the role
 * @param description - The description of the role
 * @param permissionIds - Array of permission IDs to assign to the role
 * @param updatedBy - The employee UUID who is creating the role
 * @param transaction - Database transaction
 * @returns The created role with permissions
 */
export const createRoleService = async (
  roleName: string,
  description: string | null,
  permissionIds: number[],
  updatedBy: string | null,
  transaction: Transaction
) => {
  // Create role
  const newRole = await hrmsAccessRole.create(
    {
      roleName: roleName.trim(),
      description: description || null,
      updatedBy: updatedBy,
      isDeleted: false,
    },
    { transaction }
  );

  // Create role-permission associations
  const rolePermissions = permissionIds.map((permissionId: number) => ({
    roleId: newRole.roleId,
    permissionId: permissionId,
    lastActionBy: updatedBy,
    isDeleted: false,
  }));

  await hrmsAccessRolePermission.bulkCreate(rolePermissions, { transaction });

  // Fetch created role with permissions
  const createdRole = await hrmsAccessRole.findOne({
    where: {
      roleId: newRole.roleId,
    },
    attributes: ['roleId', 'roleName', 'description', 'updatedBy', 'createdAt', 'updatedAt'],
    include: [
      {
        model: hrmsAccessPermission,
        as: 'permissions',
        through: {
          attributes: [],
          where: {
            isDeleted: false,
          },
        },
        attributes: ['permissionId', 'name', 'displayName', 'category'],
        required: false,
      },
    ],
    transaction,
  });

  const createdRoleData = createdRole as unknown as RoleInstance;
  const formattedRole: FormattedRole = {
    roleId: createdRoleData.roleId,
    roleName: createdRoleData.roleName,
    description: createdRoleData.description,
    updatedBy: createdRoleData.updatedBy,
    permissions: (createdRoleData.permissions || []).map((perm: Permission): RolePermission => ({
      permissionId: perm.permissionId,
      name: perm.name,
      displayName: perm.displayName,
      category: perm.category || null,
    })),
    createdAt: createdRoleData.createdAt,
    updatedAt: createdRoleData.updatedAt,
  };

  return formattedRole;
};

/**
 * Find a role by ID
 * @param roleId - The ID of the role to find
 * @param transaction - Database transaction
 * @returns The role if found, null otherwise
 */
export const findRoleByIdService = async (
  roleId: number,
  transaction: Transaction
) => {
  const role = await hrmsAccessRole.findOne({
    where: {
      roleId: roleId,
      isDeleted: false,
    },
    transaction,
  });

  return role;
};

/**
 * Update role details (name and description)
 * @param role - The role instance to update
 * @param roleName - New role name (optional)
 * @param description - New description (optional)
 * @param updatedBy - The employee UUID who is updating the role
 * @param transaction - Database transaction
 */
export const updateRoleDetailsService = async (
  role: RoleInstance,
  roleName: string | undefined,
  description: string | undefined,
  updatedBy: string | null,
  transaction: Transaction
) => {
  if (roleName !== undefined) {
    role.roleName = roleName.trim();
  }
  if (description !== undefined) {
    role.description = description || null;
  }
  role.updatedBy = updatedBy;
  await role.save({ transaction });
};

/**
 * Update role permissions
 * @param roleId - The ID of the role
 * @param permissionIds - Array of permission IDs to assign
 * @param updatedBy - The employee UUID who is updating the permissions
 * @param transaction - Database transaction
 */
export const updateRolePermissionsService = async (
  roleId: number,
  permissionIds: number[],
  updatedBy: string | null,
  transaction: Transaction
) => {
  // Get all existing role-permission associations (including soft-deleted ones)
  const existingAssociations = await hrmsAccessRolePermission.findAll({
    where: {
      roleId: roleId,
    },
    transaction,
  });

  // Create a map of existing associations by permissionId
  const existingMap = new Map<number, RolePermissionAssociation & { save: (options?: { transaction?: Transaction }) => Promise<void> }>();
  existingAssociations.forEach((assoc: RolePermissionAssociation & { save: (options?: { transaction?: Transaction }) => Promise<void> }) => {
    existingMap.set(assoc.permissionId, assoc);
  });

  // Track which permissions need to be created
  const permissionsToCreate: number[] = [];
  const permissionsToRestore: (RolePermissionAssociation & { save: (options?: { transaction?: Transaction }) => Promise<void> })[] = [];
  const permissionsToDelete: (RolePermissionAssociation & { save: (options?: { transaction?: Transaction }) => Promise<void> })[] = [];

  // Process each permission in the new list
  for (const permissionId of permissionIds) {
    const existing = existingMap.get(permissionId);
    if (existing) {
      // Permission already exists - restore it if deleted, or update lastActionBy if not deleted
      if (existing.isDeleted) {
        permissionsToRestore.push(existing);
      } else {
        // Update lastActionBy for existing active permission
        existing.lastActionBy = updatedBy;
        await existing.save({ transaction });
      }
    } else {
      // Permission doesn't exist - create it
      permissionsToCreate.push(permissionId);
    }
  }

  // Find permissions that should be deleted (exist but not in new list)
  for (const [permissionId, assoc] of existingMap.entries()) {
    if (!permissionIds.includes(permissionId) && !assoc.isDeleted) {
      permissionsToDelete.push(assoc);
    }
  }

  // Restore soft-deleted permissions
  for (const assoc of permissionsToRestore) {
    assoc.isDeleted = false;
    assoc.lastActionBy = updatedBy;
    await assoc.save({ transaction });
  }

  // Soft delete permissions not in the new list
  for (const assoc of permissionsToDelete) {
    assoc.isDeleted = true;
    await assoc.save({ transaction });
  }

  // Create new permissions that don't exist
  if (permissionsToCreate.length > 0) {
    const newRolePermissions = permissionsToCreate.map((permissionId: number) => ({
      roleId: roleId,
      permissionId: permissionId,
      lastActionBy: updatedBy,
      isDeleted: false,
    }));

    await hrmsAccessRolePermission.bulkCreate(newRolePermissions, { transaction });
  }
};

/**
 * Get updated role with permissions after update
 * @param roleId - The ID of the role
 * @returns The role with its permissions
 */
export const getUpdatedRoleService = async (roleId: number) => {
  // First, get all non-deleted permissions to check if role has all permissions
  const allPermissions = await hrmsAccessPermission.findAll({
    where: {
      isDeleted: false,
    },
    attributes: ['permissionId'],
  });

  const allPermissionIds = new Set(allPermissions.map((p: Permission) => p.permissionId));

  const updatedRole = await hrmsAccessRole.findOne({
    where: {
      roleId: roleId,
    },
    attributes: ['roleId', 'roleName', 'description', 'updatedBy', 'createdAt', 'updatedAt'],
    include: [
      {
        model: hrmsAccessPermission,
        as: 'permissions',
        through: {
          attributes: [],
          where: {
            isDeleted: false,
          },
        },
        attributes: ['permissionId', 'name', 'displayName', 'category'],
        required: false,
      },
    ],
  });

  if (!updatedRole) {
    return null;
  }

  const updatedRoleData = updatedRole as unknown as RoleInstance;
  const rolePermissions = updatedRoleData.permissions || [];
  const rolePermissionIds = new Set(rolePermissions.map((perm: Permission) => perm.permissionId));
  
  // Check if role has all non-deleted permissions
  const allPermissionIdsArray = Array.from(allPermissionIds) as number[];
  const hasAllPermissions = allPermissionIds.size > 0 && 
    allPermissionIds.size === rolePermissionIds.size &&
    allPermissionIdsArray.every((id: number) => rolePermissionIds.has(id));

  const formattedRole: FormattedRole = {
    roleId: updatedRoleData.roleId,
    roleName: updatedRoleData.roleName,
    description: updatedRoleData.description,
    updatedBy: updatedRoleData.updatedBy,
    permissions: rolePermissions.map((perm: Permission): RolePermission => ({
      permissionId: perm.permissionId,
      name: perm.name,
      displayName: perm.displayName,
      category: perm.category || null,
    })),
    allPermission: hasAllPermissions,
    createdAt: updatedRoleData.createdAt,
    updatedAt: updatedRoleData.updatedAt,
  };

  return formattedRole;
};

/**
 * Soft delete a role and its permissions
 * @param role - The role instance to delete
 * @param roleId - The ID of the role
 * @param transaction - Database transaction
 */
export const deleteRoleService = async (
  role: RoleInstance,
  roleId: number,
  transaction: Transaction
) => {
  // Soft delete role
  role.isDeleted = true;
  await role.save({ transaction });

  // Soft delete all role-permission associations
  await hrmsAccessRolePermission.update(
    {
      isDeleted: true,
    },
    {
      where: {
        roleId: roleId,
        isDeleted: false,
      },
      transaction,
    }
  );

  // Soft delete all employee-role assignments for this role
  await hrmsEmployeeRole.update(
    {
      isDeleted: true,
    },
    {
      where: {
        roleId: roleId,
        isDeleted: false,
      },
      transaction,
    }
  );
};

// ============================================================================
// Employee Role Management Services
// ============================================================================

/**
 * Get all employees with their assigned roles
 * @returns All employees with their roles
 */
export const getAllEmployeesWithRolesService = async () => {
  const employees = await employeeBasicDetails.findAll({
    where: {
      isDeleted: false,
    },
    attributes: ['empUuid', 'empFirstName', 'empLastName', 'empCompanyId'],
    include: [
      {
        model: hrmsEmployeeRole,
        as: 'employeeRoles',
        where: {
          isDeleted: false,
        },
        required: false,
        attributes: ['employeeRoleId', 'roleId', 'assignedBy', 'createdAt'],
        include: [
          {
            model: hrmsAccessRole,
            as: 'role',
            attributes: ['roleId', 'roleName', 'description'],
            required: false,
          },
        ],
      },
    ],
    order: [['empFirstName', 'ASC']],
  });

  // Transform data to support multiple roles in future
  return employees.map((employee): EmployeeWithRoles => {
    const employeeData = employee.toJSON() as {
      empUuid: string;
      empFirstName: string;
      empLastName: string;
      empCompanyId: string;
      employeeRoles?: Array<{
        employeeRoleId: number;
        roleId: number;
        assignedBy: string | null;
        createdAt: Date;
        role: {
          roleId: number;
          roleName: string;
          description: string | null;
        };
      }>;
    };
    return {
      empUuid: employeeData.empUuid,
      empFirstName: employeeData.empFirstName,
      empLastName: employeeData.empLastName,
      empCompanyId: employeeData.empCompanyId,
      roles: employeeData.employeeRoles?.map((er): EmployeeRoleData => ({
        employeeRoleId: er.employeeRoleId,
        roleId: er.role.roleId,
        roleName: er.role.roleName,
        description: er.role.description,
        assignedBy: er.assignedBy,
        assignedAt: er.createdAt,
      })) || [],
      // For backward compatibility: single role (first active role)
      role: employeeData.employeeRoles?.[0]?.role || null,
    };
  });
};

/**
 * Get all permissions for an employee based on their assigned roles
 * @param empUuid - The employee UUID
 * @returns Array of all unique permissions the employee has
 */
export const getMyHrmsPermissionsService = async (empUuid: string) => {
  // Get employee with their roles
  const employee = await employeeBasicDetails.findOne({
    where: {
      empUuid: empUuid,
      isDeleted: false,
    },
    attributes: ['empUuid'],
    include: [
      {
        model: hrmsEmployeeRole,
        as: 'employeeRoles',
        where: {
          isDeleted: false,
        },
        required: false,
        attributes: ['roleId'],
        include: [
          {
            model: hrmsAccessRole,
            as: 'role',
            attributes: ['roleId', 'roleName'],
            required: false,
            include: [
              {
                model: hrmsAccessPermission,
                as: 'permissions',
                through: {
                  attributes: [],
                  where: {
                    isDeleted: false,
                  },
                },
                attributes: ['permissionId', 'name', 'displayName', 'description', 'category'],
                required: false,
              },
            ],
          },
        ],
      },
    ],
  });

  if (!employee) {
    return [];
  }

  const employeeData = employee.toJSON() as {
    employeeRoles?: Array<{
      role: {
        roleId: number;
        roleName: string;
        permissions?: Permission[];
      } | null;
    }>;
  };

  // Collect all unique permissions from all roles
  const permissionsMap = new Map<number, Permission>();

  if (employeeData.employeeRoles) {
    for (const employeeRole of employeeData.employeeRoles) {
      if (employeeRole.role?.permissions) {
        for (const permission of employeeRole.role.permissions) {
          if (!permissionsMap.has(permission.permissionId)) {
            permissionsMap.set(permission.permissionId, permission);
          }
        }
      }
    }
  }

  // Get unique role names
  const roleNamesSet = new Set<string>();
  if (employeeData.employeeRoles) {
    for (const employeeRole of employeeData.employeeRoles) {
      if (employeeRole.role?.roleName) {
        roleNamesSet.add(employeeRole.role.roleName);
      }
    }
  }
  const roleNames = Array.from(roleNamesSet);

  return {
    permissions: Array.from(permissionsMap.values()),
    roleName: roleNames,
  };
};

/**
 * Check if user has HRMS permission(s) or admin access.
 * When permissionNames is an array, returns true if user has ANY of the permissions.
 * @param employeeUuid - The employee UUID
 * @param permissionNames - Single permission name or array (e.g. 'Offboarding_HR_Clearance' or ['Offboarding_HR_Clearance', 'Offboarding_Finance_Clearance'])
 * @param toolName - The tool name (e.g., 'HR Repository')
 * @param toolsAccess - The tools access map from user object
 * @returns true if user has at least one of the permissions or admin access (>= 900), false otherwise
 */
export const checkHrmsPermission = async (
  employeeUuid: string | null | undefined,
  permissionNames: string | string[],
  toolName: string,
  toolsAccess: Record<string, number> | undefined
): Promise<boolean> => {
  // Check if user has admin access (>= 900) for the tool
  if (toolsAccess && toolsAccess[toolName] >= 900) {
    return true;
  }

  // If no employeeUuid, can't check HRMS permissions
  if (!employeeUuid) {
    return false;
  }

  const namesToCheck = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
  if (namesToCheck.length === 0) {
    return false;
  }

  // Get user's HRMS permissions
  const hrmsAccess = await getMyHrmsPermissionsService(employeeUuid);

  // Check if hrmsAccess is an array (empty result) or an object with permissions
  const permissions = Array.isArray(hrmsAccess) ? [] : (hrmsAccess?.permissions || []);

  // Check if user has any of the requested permissions
  return permissions.some((perm) =>
    namesToCheck.some(
      (name) => perm.name === name || perm.displayName === name
    )
  );
};

/**
 * Get employee by UUID with their assigned roles
 * @param empUuid - The employee UUID
 * @returns Employee with their roles
 */
export const getEmployeeRolesService = async (empUuid: string) => {
  const employee = await employeeBasicDetails.findOne({
    where: {
      empUuid: empUuid,
      isDeleted: false,
    },
    attributes: ['empUuid', 'empFirstName', 'empLastName', 'empCompanyId'],
    include: [
      {
        model: hrmsEmployeeRole,
        as: 'employeeRoles',
        where: {
          isDeleted: false,
        },
        required: false,
        attributes: ['employeeRoleId', 'roleId', 'assignedBy', 'createdAt'],
        include: [
          {
            model: hrmsAccessRole,
            as: 'role',
            attributes: ['roleId', 'roleName', 'description'],
            required: false,
          },
        ],
      },
    ],
  });

  if (!employee) {
    return null;
  }

  const employeeData = employee.toJSON() as {
    empUuid: string;
    empFirstName: string;
    empLastName: string;
    empCompanyId: string;
    employeeRoles?: Array<{
      employeeRoleId: number;
      roleId: number;
      assignedBy: string | null;
      createdAt: Date;
      role: {
        roleId: number;
        roleName: string;
        description: string | null;
      };
    }>;
  };
  return {
    empUuid: employeeData.empUuid,
    empFirstName: employeeData.empFirstName,
    empLastName: employeeData.empLastName,
    empCompanyId: employeeData.empCompanyId,
    roles: employeeData.employeeRoles?.map((er): EmployeeRoleData => ({
      employeeRoleId: er.employeeRoleId,
      roleId: er.role.roleId,
      roleName: er.role.roleName,
      description: er.role.description,
      assignedBy: er.assignedBy,
      assignedAt: er.createdAt,
    })) || [],
    // For backward compatibility: single role (first active role)
    role: employeeData.employeeRoles?.[0]?.role || null,
  };
};

/**
 * Check if employee exists
 * @param empUuid - The employee UUID
 * @param transaction - Database transaction
 * @returns True if employee exists
 */
export const checkEmployeeExistsService = async (
  empUuid: string,
  transaction?: Transaction
): Promise<boolean> => {
  const employee = await employeeBasicDetails.findOne({
    where: {
      empUuid: empUuid,
      isDeleted: false,
    },
    attributes: ['empUuid'],
    transaction,
  });

  return !!employee;
};

/**
 * Check if role exists and is not deleted
 * @param roleId - The role ID
 * @param transaction - Database transaction
 * @returns True if role exists
 */
export const checkRoleExistsService = async (
  roleId: number,
  transaction?: Transaction
): Promise<boolean> => {
  const role = await hrmsAccessRole.findOne({
    where: {
      roleId: roleId,
      isDeleted: false,
    },
    attributes: ['roleId'],
    transaction,
  });

  return !!role;
};

/**
 * Get active role for employee (for single-role logic)
 * @param empUuid - The employee UUID
 * @param transaction - Database transaction
 * @returns Active employee role or null
 */
export const getActiveEmployeeRoleService = async (
  empUuid: string,
  transaction?: Transaction
) => {
  return await hrmsEmployeeRole.findOne({
    where: {
      empUuid: empUuid,
      isDeleted: false,
    },
    transaction,
  });
};

/**
 * Assign or update employee role
 * For now: implements single-role logic (deactivates existing before assigning new)
 * @param empUuid - The employee UUID
 * @param roleId - The role ID to assign
 * @param assignedBy - The employee UUID who is assigning the role
 * @param transaction - Database transaction
 */
export const assignEmployeeRoleService = async (
  empUuid: string,
  roleId: number,
  assignedBy: string | null,
  transaction: Transaction
) => {
  // Step 1: Soft delete all existing active roles for this employee (single-role logic)
  await hrmsEmployeeRole.update(
    {
      isDeleted: true,
    },
    {
      where: {
        empUuid: empUuid,
        isDeleted: false,
      },
      transaction,
    }
  );

  // Step 2: Check if this role was previously assigned (even if soft-deleted)
  const existingAssignment = await hrmsEmployeeRole.findOne({
    where: {
      empUuid: empUuid,
      roleId: roleId,
    },
    transaction,
  });

  if (existingAssignment) {
    // Restore the existing assignment
    existingAssignment.isDeleted = false;
    existingAssignment.assignedBy = assignedBy;
    await existingAssignment.save({ transaction });
    return existingAssignment;
  } else {
    // Create new assignment
    const newEmployeeRole = await hrmsEmployeeRole.create(
      {
        empUuid: empUuid,
        roleId: roleId,
        assignedBy: assignedBy,
        isDeleted: false,
      },
      { transaction }
    );
    return newEmployeeRole;
  }
};

/**
 * Revoke employee access by soft-deleting all roles
 * @param empUuid - The employee UUID
 * @param transaction - Database transaction
 */
export const revokeEmployeeAccessService = async (
  empUuid: string,
  transaction: Transaction
) => {
  await hrmsEmployeeRole.update(
    {
      isDeleted: true,
    },
    {
      where: {
        empUuid: empUuid,
        isDeleted: false,
      },
      transaction,
    }
  );
};

