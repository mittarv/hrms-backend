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

const router = express.Router();

// Permission routes
router.route('/permissions').get(isTmsUserAuthenticated, getAllPermissions);

// Role routes
router.route('/getAllRoles').get(isTmsUserAuthenticated, getAllRoles);
router.route('/createRole').post(isTmsUserAuthenticated, createRole);
router.route('/:roleId/getRoleById').get(isTmsUserAuthenticated, getRoleById);
router.route('/:roleId/updateRole').patch(isTmsUserAuthenticated, updateRole);
router.route('/:roleId/deleteRole').delete(isTmsUserAuthenticated, deleteRole);

// Employee Role Management routes
router.route('/getAllEmployeesWithRoles').get(isTmsUserAuthenticated, getAllEmployeesWithRoles);
router.route('/:empUuid/getEmployeeRoles').get(isTmsUserAuthenticated, getEmployeeRoles);
router.route('/assignEmployeeRole').post(isTmsUserAuthenticated, assignEmployeeRole);
router.route('/:empUuid/revokeEmployeeAccess').delete(isTmsUserAuthenticated, revokeEmployeeAccess);

// My HRMS Access routes
router.route('/myHrmsAccess').get(isTmsUserAuthenticated, getMyHrmsAccess);

export default router;

