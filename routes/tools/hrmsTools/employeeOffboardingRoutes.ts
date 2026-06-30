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

const router = express.Router();

router.route('/:empUuid/initiateOffboarding').post(isTmsUserAuthenticated, initiateOffboarding);
router.route('/getOffboardingInitiatedEmployeeDetails').get(isTmsUserAuthenticated, getAllOffboardingInitiatedEmployeeDetails);
router.route('/:empUuid/hrClearance').post(isTmsUserAuthenticated, hrClearance);
router.route('/:empUuid/financeClearance').post(isTmsUserAuthenticated, financeClearance);
router.route('/:empUuid/setLastWorkingDay').post(isTmsUserAuthenticated, setLastWorkingDay);
router.route('/:empUuid/approveOffboarding').post(isTmsUserAuthenticated, approveOffboarding);
router.route('/getAllOffboardedEmployees').get(isTmsUserAuthenticated, getAllOffboardedEmployees);

export default router;