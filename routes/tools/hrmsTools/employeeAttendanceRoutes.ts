import express from 'express';
import {
    getEmployeeAttendance,
    registerAttendance,
    getEmployeeLeaveHistory,
    getAllPendingLeaveRequests,
    requireProofForLeave,
    reviewLeaveRequest,
    getEmployeeLeaveBalance,
    uploadProofDocuments,
    deleteEmployeeAttendance,
    updateEmployeeAttendance,
    getEmployeeOnLeave,
    getCheckInOutStatus,
    employeeCheckIn,
    employeeCheckOut,
    checkOutstandingCheckout,
    updateEmployeeOutstandingCheckout,
    getLeavesEligibility,
    getAccrualLeaveBalance
} from "../../../controllers/tools/hrmsTools/employeeAttendanceController";
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import { populateEmployeeTypeInLeaveBalance, populateFiscalYearForAllEmployees } from '../../../controllers/tools/hrmsTools/productionAPIs';

const router = express.Router();

router.route('/:empUuid/registerAttendance').post(isTmsUserAuthenticated, registerAttendance);
router.route('/:empUuid/getEmployeeAttendance').get(isTmsUserAuthenticated, getEmployeeAttendance);
router.route('/:empUuid/getEmployeeLeaveHistory').get(isTmsUserAuthenticated, getEmployeeLeaveHistory);
router.route('/getAllPendingLeaveRequests').get(isTmsUserAuthenticated, getAllPendingLeaveRequests);
router.route('/:leaveRequestId/requireProofForLeave').patch(isTmsUserAuthenticated, requireProofForLeave);
router.route('/:leaveRequestId/uploadProofDocuments').post(isTmsUserAuthenticated, uploadProofDocuments);
router.route('/:empUuid/reviewLeaveRequest').patch(isTmsUserAuthenticated, reviewLeaveRequest);
router.route('/:empUuid/getEmployeeLeaveBalance').get(isTmsUserAuthenticated, getEmployeeLeaveBalance);
router.route('/:empUuid/getLeaveBalanceWithAccrual').get(isTmsUserAuthenticated, getAccrualLeaveBalance);
router.route('/:attendanceId/deleteEmployeeAttendance').delete(isTmsUserAuthenticated, deleteEmployeeAttendance);
router.route('/:attendanceId/updateEmployeeAttendance').patch(isTmsUserAuthenticated, updateEmployeeAttendance);
router.route('/getEmployeeOnLeave').get(isTmsUserAuthenticated, getEmployeeOnLeave);
router.route('/:empUuid/getCheckInOutStatus').get(isTmsUserAuthenticated,getCheckInOutStatus);
router.route('/:empUuid/employeeCheckIn').post(isTmsUserAuthenticated, employeeCheckIn);
router.route('/:empUuid/employeeCheckOut').post(isTmsUserAuthenticated,employeeCheckOut);
router.route('/:empUuid/checkOutstandingCheckout').get(isTmsUserAuthenticated, checkOutstandingCheckout);
router.route('/:attendanceId/updateEmployeeOutstandingCheckout').patch(isTmsUserAuthenticated, updateEmployeeOutstandingCheckout);
router.route('/:empUuid/getLeaveEligibility').get(isTmsUserAuthenticated, getLeavesEligibility);
router.route('/populateFiscalYearForAllEmployees').post(isTmsUserAuthenticated, populateFiscalYearForAllEmployees);
router.route('/populateEmployeeTypeInLeaveBalance').post(isTmsUserAuthenticated, populateEmployeeTypeInLeaveBalance);

export default router;