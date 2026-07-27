import express from 'express';
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import { 
    getAllSalaryConfigDetails,
    createSalaryConfig,
    deleteSalaryConfig,
    updateSalaryConfig,
} from '../../../controllers/tools/hrmsTools/salaryConfiguratorController';
import {tenantMiddleware} from '../../../middlewares/tenantMiddleware';

const router = express.Router();

router.route("/getSalaryConfigDetails").get(isTmsUserAuthenticated,tenantMiddleware, getAllSalaryConfigDetails);

router.route("/createSalaryConfig").post(isTmsUserAuthenticated,tenantMiddleware,createSalaryConfig);

router.route("/updateSalaryConfig").patch(isTmsUserAuthenticated,tenantMiddleware, updateSalaryConfig);

router.route("/deleteSalaryConfig").delete(isTmsUserAuthenticated,tenantMiddleware, deleteSalaryConfig);

export default router;