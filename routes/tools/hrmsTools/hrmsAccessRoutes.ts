import express from 'express';
import { isTmsUserAuthenticated } from '../../../middlewares/isAuthenticated';
import {
  getAllPermissions,
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getAllEmployeesWithRoles,
  getEmployeeRoles,
  assignEmployeeRole,
  revokeEmployeeAccess,
  getMyHrmsAccess,
} from '../../../controllers/tools/hrmsTools/hrmsAccessController';
import {tenantMiddleware} from '../../../middlewares/tenantMiddleware';

const router = express.Router();

// Permission routes
router.route('/permissions').get(isTmsUserAuthenticated,tenantMiddleware, getAllPermissions);

// Role routes
router.route('/getAllRoles').get(isTmsUserAuthenticated,tenantMiddleware, getAllRoles);
router.route('/createRole').post(isTmsUserAuthenticated,tenantMiddleware, createRole);
router.route('/:roleId/getRoleById').get(isTmsUserAuthenticated,tenantMiddleware, getRoleById);
router.route('/:roleId/updateRole').patch(isTmsUserAuthenticated,tenantMiddleware, updateRole);
router.route('/:roleId/deleteRole').delete(isTmsUserAuthenticated,tenantMiddleware, deleteRole);

// Employee Role Management routes
router.route('/getAllEmployeesWithRoles').get(isTmsUserAuthenticated,tenantMiddleware, getAllEmployeesWithRoles);
router.route('/:empUuid/getEmployeeRoles').get(isTmsUserAuthenticated,tenantMiddleware, getEmployeeRoles);
router.route('/assignEmployeeRole').post(isTmsUserAuthenticated,tenantMiddleware, assignEmployeeRole);
router.route('/:empUuid/revokeEmployeeAccess').delete(isTmsUserAuthenticated,tenantMiddleware, revokeEmployeeAccess);

// My HRMS Access routes
router.route('/myHrmsAccess').get(isTmsUserAuthenticated,tenantMiddleware, getMyHrmsAccess);

export default router;

