import { Request, Response } from 'express';
import { Transaction } from 'sequelize';
import { outputSequelize } from '../../../models/index';
import { AuthenticatedRequest } from '../../../middlewares/isAuthenticated';
import { AuthenticatedUser } from '../../../interfaces/hrmsTool/interface/hrmsInterface';
import {
  getAllPermissionsService,
  getAllRolesService,
  getRoleByIdService,
  checkRoleNameExistsService,
  validatePermissionIdsService,
  createRoleService,
  findRoleByIdService,
  updateRoleDetailsService,
  updateRolePermissionsService,
  getUpdatedRoleService,
  deleteRoleService,
  getAllEmployeesWithRolesService,
  getEmployeeRolesService,
  checkEmployeeExistsService,
  checkRoleExistsService,
  assignEmployeeRoleService,
  revokeEmployeeAccessService,
  getMyHrmsPermissionsService,
} from '../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices';
import { checkHrmsPermission } from '../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices';
import { hrmsConstants } from '../../../interfaces/hrmsTool/enum/hrmsEnum';

/**
 * Get all permissions grouped by category
 */
export const getAllPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupedPermissions = await getAllPermissionsService();

    res.status(200).json({
      success: true,
      message: 'Permissions fetched successfully',
      permissions: groupedPermissions,
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: error.message,
    });
  }
};

/**
 * Get all roles with their permissions
 */
export const getAllRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    // Check permission: admin access (>= 900) OR HrmsRoleManagement_read permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "HrmsRoleManagement_read",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to view role management"
      });
      return;
    }

    const formattedRoles = await getAllRolesService();

    res.status(200).json({
      success: 'true',
      message: 'Roles fetched successfully',
      roles: formattedRoles,
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: error.message,
    });
  }
};

/**
 * Get a single role by ID with permissions
 */
export const getRoleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    // Check permission: admin access (>= 900) OR HrmsRoleManagement_read permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "HrmsRoleManagement_read",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to view role management"
      });
      return;
    }

    const roleId = req.params.roleId as string;

    if (!roleId) {
      res.status(400).json({
        success: false,
        message: 'Role ID is required',
      });
      return;
    }

    const formattedRole = await getRoleByIdService(parseInt(roleId));

    if (!formattedRole) {
      res.status(404).json({
        success: false,
        message: 'Role not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Role fetched successfully',
      role: formattedRole,
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: error.message,
    });
  }
};

/**
 * Create a new role with permissions
 */
export const createRole = async (req: Request, res: Response): Promise<void> => {
  const transaction: Transaction = await outputSequelize.transaction();

  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;
    const updatedBy = employeeUuid || null;

    // Check permission: admin access (>= 900) OR HrmsRoleManagement_create permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "HrmsRoleManagement_create",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      await transaction.rollback();
      res.status(403).json({
        success: false,
        message: "You don't have permission to create roles"
      });
      return;
    }

    const { roleName, description, permissionIds } = req.body;

    // Validation
    if (!roleName || !permissionIds || !Array.isArray(permissionIds) || permissionIds.length === 0) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        message: 'Role name and at least one permission are required',
      });
      return;
    }

    // Check if role name already exists
    const roleNameExists = await checkRoleNameExistsService(roleName, transaction);

    if (roleNameExists) {
      await transaction.rollback();
      res.status(409).json({
        success: false,
        message: 'Role name already exists',
      });
      return;
    }

    // Validate that all permission IDs exist
    const permissionsValid = await validatePermissionIdsService(permissionIds, transaction);

    if (!permissionsValid) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        message: 'One or more permission IDs are invalid',
      });
      return;
    }

    // Create role with permissions
    const createdRole = await createRoleService(
      roleName,
      description || null,
      permissionIds,
      updatedBy,
      transaction
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: createdRole,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating role:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: error.message,
    });
  }
};

/**
 * Update role (name, description, and permissions)
 */
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  const transaction: Transaction = await outputSequelize.transaction();

  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;
    const updatedBy = employeeUuid || null;

    // Check permission: admin access (>= 900) OR HrmsRoleManagement_update permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "HrmsRoleManagement_update",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      await transaction.rollback();
      res.status(403).json({
        success: false,
        message: "You don't have permission to update roles"
      });
      return;
    }

    const roleId = req.params.roleId as string;
    const { roleName, description, permissionIds } = req.body;

    if (!roleId) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        message: 'Role ID is required',
      });
      return;
    }

    const roleIdNum = parseInt(roleId);

    // Find existing role
    const existingRole = await findRoleByIdService(roleIdNum, transaction);

    if (!existingRole) {
      await transaction.rollback();
      res.status(404).json({
        success: false,
        message: 'Role not found',
      });
      return;
    }

    // Check if new role name conflicts with another role
    if (
      roleName &&
      roleName.trim() !== (existingRole as { roleName: string }).roleName
    ) {
      const roleNameExists = await checkRoleNameExistsService(
        roleName,
        transaction,
        roleIdNum
      );

      if (roleNameExists) {
        await transaction.rollback();
        res.status(409).json({
          success: false,
          message: 'Role name already exists',
        });
        return;
      }
    }

    // Update role details
    await updateRoleDetailsService(existingRole, roleName, description, updatedBy, transaction);

    // Update permissions if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      // Validate permissions
      const permissionsValid = await validatePermissionIdsService(permissionIds, transaction);

      if (!permissionsValid) {
        await transaction.rollback();
        res.status(400).json({
          success: false,
          message: 'One or more permission IDs are invalid',
        });
        return;
      }

      // Update role permissions
      await updateRolePermissionsService(roleIdNum, permissionIds, updatedBy, transaction);
    }

    await transaction.commit();

    // Fetch updated role with permissions
    const updatedRole = await getUpdatedRoleService(roleIdNum);

    res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: updatedRole,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: error.message,
    });
  }
};

/**
 * Delete a role (soft delete)
 */
export const deleteRole = async (req: Request, res: Response): Promise<void> => {
  const transaction: Transaction = await outputSequelize.transaction();

  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    // Check permission: admin access (>= 900) OR HrmsRoleManagement_delete permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "HrmsRoleManagement_delete",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      await transaction.rollback();
      res.status(403).json({
        success: false,
        message: "You don't have permission to delete roles"
      });
      return;
    }

    const roleId = req.params.roleId as string;

    if (!roleId) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        message: 'Role ID is required',
      });
      return;
    }

    const roleIdNum = parseInt(roleId);

    // Find existing role
    const existingRole = await findRoleByIdService(roleIdNum, transaction);

    if (!existingRole) {
      await transaction.rollback();
      res.status(404).json({
        success: false,
        message: 'Role not found',
      });
      return;
    }

    // Delete role and its permissions
    await deleteRoleService(existingRole, roleIdNum, transaction);

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting role:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: error.message,
    });
  }
};

// ============================================================================
// Employee Role Management Controllers
// ============================================================================

/**
 * Get all employees with their assigned roles
 */
export const getAllEmployeesWithRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    // Check permission: admin access (>= 900) OR HrmsUserManagement_read permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "HrmsUserManagement_read",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to view user management"
      });
      return;
    }

    const employees = await getAllEmployeesWithRolesService();

    res.status(200).json({
      success: true,
      message: 'Employees with roles fetched successfully',
      data: employees,
    });
  } catch (error) {
    console.error('Error fetching employees with roles:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: (error as Error).message,
    });
  }
};

/**
 * Get employee roles by employee UUID
 */
export const getEmployeeRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    // Check permission: admin access (>= 900) OR HrmsUserManagement_read permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "HrmsUserManagement_read",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You don't have permission to view user management"
      });
      return;
    }

    const empUuid = req.params.empUuid as string;

    if (!empUuid) {
      res.status(400).json({
        success: false,
        message: 'Employee UUID is required',
      });
      return;
    }

    const employee = await getEmployeeRolesService(empUuid);

    if (!employee) {
      res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Employee roles fetched successfully',
      employeeRoles: employee,
    });
  } catch (error) {
    console.error('Error fetching employee roles:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: (error as Error).message,
    });
  }
};

/**
 * Assign or update employee role
 * For now: implements single-role logic (deactivates existing before assigning new)
 */
export const assignEmployeeRole = async (req: Request, res: Response): Promise<void> => {
  const transaction: Transaction = await outputSequelize.transaction();
  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;
    const assignedBy = employeeUuid || null;

    // Check permission: admin access (>= 900) OR HrmsUserManagement_write permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "HrmsUserManagement_write",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      await transaction.rollback();
      res.status(403).json({
        success: false,
        message: "You don't have permission to assign or revoke roles"
      });
      return;
    }

    const { empUuid, roleId } = req.body;

    // Validation
    if (!empUuid) {
      res.status(400).json({
        success: false,
        message: 'Employee UUID is required',
      });
      await transaction.rollback();
      return;
    }

    if (!roleId) {
      res.status(400).json({
        success: false,
        message: 'Role ID is required',
      });
      await transaction.rollback();
      return;
    }

    // Check if employee exists
    const employeeExists = await checkEmployeeExistsService(empUuid, transaction);
    if (!employeeExists) {
      res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
      await transaction.rollback();
      return;
    }

    // Check if role exists
    const roleExists = await checkRoleExistsService(roleId, transaction);
    if (!roleExists) {
      res.status(404).json({
        success: false,
        message: 'Role not found',
      });
      await transaction.rollback();
      return;
    }

    // Assign role (service handles single-role logic)
    await assignEmployeeRoleService(empUuid, roleId, assignedBy, transaction);

    await transaction.commit();

    // Fetch updated employee with roles
    const updatedEmployee = await getEmployeeRolesService(empUuid);

    res.status(200).json({
      success: true,
      message: 'Employee role assigned successfully',
      data: updatedEmployee,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error assigning employee role:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: (error as Error).message,
    });
  }
};

/**
 * Revoke employee access by soft-deleting all roles
 */
export const revokeEmployeeAccess = async (req: Request, res: Response): Promise<void> => {
  const transaction: Transaction = await outputSequelize.transaction();
  try {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, employeeUuid } = user as AuthenticatedUser;
    const toolName = hrmsConstants.HR_REPOSITORY;

    // Check permission: admin access (>= 900) OR HrmsUserManagement_write permission
    const hasPermission = await checkHrmsPermission(
      employeeUuid,
      "HrmsUserManagement_write",
      toolName,
      toolsAccess as Record<string, number> | undefined
    );

    if (!hasPermission) {
      await transaction.rollback();
      res.status(403).json({
        success: false,
        message: "You don't have permission to assign or revoke roles"
      });
      return;
    }

    const empUuid = req.params.empUuid as string;

    if (!empUuid) {
      res.status(400).json({
        success: false,
        message: 'Employee UUID is required',
      });
      await transaction.rollback();
      return;
    }

    // Check if employee exists
    const employeeExists = await checkEmployeeExistsService(empUuid, transaction);
    if (!employeeExists) {
      res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
      await transaction.rollback();
      return;
    }

    // Revoke access
    await revokeEmployeeAccessService(empUuid, transaction);

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Employee access revoked successfully',
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error revoking employee access:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: (error as Error).message,
    });
  }
};

export const getMyHrmsAccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { employeeUuid } = user as AuthenticatedUser;
    if (!employeeUuid) {
      res.status(400).json({
        success: false,
        message: 'Employee UUID is required',
      });
      return;
    }
    const permissions = await getMyHrmsPermissionsService(employeeUuid);
    res.status(200).json({
      success: true,
      message: 'My hrms permissions fetched successfully',
      myHrmsAccess: permissions,
    });
  } catch (error) {
    console.error('Error fetching my hrms permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: (error as Error).message,
    });
  }
};

export const getMyHrmsPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { employeeUuid } = user as AuthenticatedUser;
    if (!employeeUuid) {
      res.status(400).json({
        success: false,
        message: 'Employee UUID is required',
      });
      return;
    }
    const permissions = await getMyHrmsPermissionsService(employeeUuid);
    res.status(200).json({
      success: true,
      message: 'My hrms permissions fetched successfully',
      myHrmsPermissions: permissions,
    });
  } catch (error) {
    console.error('Error fetching my hrms permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      devMessage: (error as Error).message,
    });
  }
};
