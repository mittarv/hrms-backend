import express from 'express';
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import { 
    getAllSalaryConfigDetails,
    createSalaryConfig,
    deleteSalaryConfig,
    updateSalaryConfig,
} from '../../../controllers/tools/hrmsTools/salaryConfiguratorController';

const router = express.Router();

router.route("/getSalaryConfigDetails").get(isTmsUserAuthenticated, getAllSalaryConfigDetails);

router.route("/createSalaryConfig").post(isTmsUserAuthenticated,createSalaryConfig);

router.route("/updateSalaryConfig").patch(isTmsUserAuthenticated, updateSalaryConfig);

router.route("/deleteSalaryConfig").delete(isTmsUserAuthenticated, deleteSalaryConfig);

export default router;