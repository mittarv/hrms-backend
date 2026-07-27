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
    getAccrualLeaveBalance,
    extraWorkLogRequest,
    getExtraWorkLogRequests,
    updateExtraWorkLogRequestStatus,
    getCompOffleaveBalance,
    registerCompOffLeave,
    updateCompOffLeave,
    getCompOffLeaveEligibility,
    getEmployeeExtraWorkHistory,
    getAllHistoryLeaveRequests,
    getExtraWorkLogRequestsHistory
} from "../../../controllers/tools/hrmsTools/employeeAttendanceController";
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import { populateEmployeeTypeInLeaveBalance, populateFiscalYearForAllEmployees } from '../../../controllers/tools/hrmsTools/productionAPIs';
import {tenantMiddleware} from '../../../middlewares/tenantMiddleware';

const router = express.Router();

router.route('/:empUuid/registerAttendance').post(isTmsUserAuthenticated,tenantMiddleware, registerAttendance);
router.route('/:empUuid/getEmployeeAttendance').get(isTmsUserAuthenticated,tenantMiddleware, getEmployeeAttendance);
router.route('/:empUuid/getEmployeeLeaveHistory').get(isTmsUserAuthenticated,tenantMiddleware, getEmployeeLeaveHistory);
router.route('/getAllPendingLeaveRequests').get(isTmsUserAuthenticated,tenantMiddleware, getAllPendingLeaveRequests);
router.route('/:leaveRequestId/requireProofForLeave').patch(isTmsUserAuthenticated,tenantMiddleware, requireProofForLeave);
router.route('/:leaveRequestId/uploadProofDocuments').post(isTmsUserAuthenticated,tenantMiddleware, uploadProofDocuments);
router.route('/:empUuid/reviewLeaveRequest').patch(isTmsUserAuthenticated,tenantMiddleware, reviewLeaveRequest);
router.route('/:empUuid/getEmployeeLeaveBalance').get(isTmsUserAuthenticated,tenantMiddleware, getEmployeeLeaveBalance);
router.route('/:empUuid/getLeaveBalanceWithAccrual').get(isTmsUserAuthenticated,tenantMiddleware, getAccrualLeaveBalance);
router.route('/:attendanceId/deleteEmployeeAttendance').delete(isTmsUserAuthenticated,tenantMiddleware, deleteEmployeeAttendance);
router.route('/:attendanceId/updateEmployeeAttendance').patch(isTmsUserAuthenticated,tenantMiddleware, updateEmployeeAttendance);
router.route('/getEmployeeOnLeave').get(isTmsUserAuthenticated,tenantMiddleware, getEmployeeOnLeave);
router.route('/:empUuid/getCheckInOutStatus').get(isTmsUserAuthenticated,tenantMiddleware,getCheckInOutStatus);
router.route('/:empUuid/employeeCheckIn').post(isTmsUserAuthenticated,tenantMiddleware, employeeCheckIn);
router.route('/:empUuid/employeeCheckOut').post(isTmsUserAuthenticated,tenantMiddleware,employeeCheckOut);
router.route('/:empUuid/checkOutstandingCheckout').get(isTmsUserAuthenticated,tenantMiddleware, checkOutstandingCheckout);
router.route('/:attendanceId/updateEmployeeOutstandingCheckout').patch(isTmsUserAuthenticated,tenantMiddleware, updateEmployeeOutstandingCheckout);
router.route('/:empUuid/getLeaveEligibility').get(isTmsUserAuthenticated,tenantMiddleware, getLeavesEligibility);
router.route('/populateFiscalYearForAllEmployees').post(isTmsUserAuthenticated,tenantMiddleware, populateFiscalYearForAllEmployees);
router.route('/populateEmployeeTypeInLeaveBalance').post(isTmsUserAuthenticated,tenantMiddleware, populateEmployeeTypeInLeaveBalance);
router.route('/extraWorkLogRequest').post(isTmsUserAuthenticated,tenantMiddleware, extraWorkLogRequest);
router.route('/getExtraWorkLogRequests').get(isTmsUserAuthenticated,tenantMiddleware, getExtraWorkLogRequests);
router.route('/updateExtraWorkLogRequestStatus').post(isTmsUserAuthenticated,tenantMiddleware, updateExtraWorkLogRequestStatus);
router.route('/getCompOffleaveBalance').get(isTmsUserAuthenticated,tenantMiddleware, getCompOffleaveBalance);
router.route('/:empUuid/registerCompOffLeave').post(isTmsUserAuthenticated,tenantMiddleware, registerCompOffLeave);
router.route('/:attendanceId/updateCompOffLeave').patch(isTmsUserAuthenticated,tenantMiddleware, updateCompOffLeave);
router.route('/:empUuid/getCompOffLeaveEligibility').get(isTmsUserAuthenticated,tenantMiddleware, getCompOffLeaveEligibility);
router.route('/:empUuid/getEmployeeExtraWorkHistory').get(isTmsUserAuthenticated, tenantMiddleware,getEmployeeExtraWorkHistory);

router.route("/getAllHistoryLeaveRequests").get(isTmsUserAuthenticated, tenantMiddleware,getAllHistoryLeaveRequests);
router.route("/getExtraWorkLogRequestsHistory").get(isTmsUserAuthenticated,tenantMiddleware, getExtraWorkLogRequestsHistory);

export default router;