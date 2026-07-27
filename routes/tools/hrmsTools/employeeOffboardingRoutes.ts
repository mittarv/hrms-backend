import express from 'express';
import {
    initiateOffboarding,
    getAllOffboardingInitiatedEmployeeDetails,
    hrClearance,
    financeClearance,
    setLastWorkingDay,
    approveOffboarding,
    getAllOffboardedEmployees,
} from '../../../controllers/tools/hrmsTools/employeeOffboardingController';
import { isTmsUserAuthenticated } from '../../../middlewares/isAuthenticated';
import {tenantMiddleware} from '../../../middlewares/tenantMiddleware';

const router = express.Router();

router.route('/:empUuid/initiateOffboarding').post(isTmsUserAuthenticated,tenantMiddleware, initiateOffboarding);
router.route('/getOffboardingInitiatedEmployeeDetails').get(isTmsUserAuthenticated,tenantMiddleware, getAllOffboardingInitiatedEmployeeDetails);
router.route('/:empUuid/hrClearance').post(isTmsUserAuthenticated,tenantMiddleware, hrClearance);
router.route('/:empUuid/financeClearance').post(isTmsUserAuthenticated,tenantMiddleware, financeClearance);
router.route('/:empUuid/setLastWorkingDay').post(isTmsUserAuthenticated,tenantMiddleware, setLastWorkingDay);
router.route('/:empUuid/approveOffboarding').post(isTmsUserAuthenticated,tenantMiddleware, approveOffboarding);
router.route('/getAllOffboardedEmployees').get(isTmsUserAuthenticated,tenantMiddleware, getAllOffboardedEmployees);

export default router;