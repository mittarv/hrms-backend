import express from 'express';

import { CreateHoliday, GetAllHolidays, DeleteHoliday, UpdateHoliday } from "../../../controllers/tools/hrmsTools/employeeHolidayController";
const router = express.Router();
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";

router.route('/createHoliday').post( isTmsUserAuthenticated, CreateHoliday );
router.route('/getAllHolidays').get( isTmsUserAuthenticated, GetAllHolidays );
router.route('/deleteHoliday').delete( isTmsUserAuthenticated, DeleteHoliday );
router.route('/updateHoliday').put( isTmsUserAuthenticated, UpdateHoliday );

export default router;