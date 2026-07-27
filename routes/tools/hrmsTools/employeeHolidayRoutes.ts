import express from 'express';

import { CreateHoliday, GetAllHolidays, DeleteHoliday, UpdateHoliday } from "../../../controllers/tools/hrmsTools/employeeHolidayController";
const router = express.Router();
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import {tenantMiddleware} from '../../../middlewares/tenantMiddleware';

router.route('/createHoliday').post( isTmsUserAuthenticated,tenantMiddleware, CreateHoliday );
router.route('/getAllHolidays').get( isTmsUserAuthenticated,tenantMiddleware, GetAllHolidays );
router.route('/deleteHoliday').delete( isTmsUserAuthenticated,tenantMiddleware, DeleteHoliday );
router.route('/updateHoliday').put( isTmsUserAuthenticated,tenantMiddleware, UpdateHoliday );

export default router;