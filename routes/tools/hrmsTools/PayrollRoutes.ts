import express from 'express';
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import { 
    createPayroll,
    getAllEmployeePayrollDetails,
    updatePayrollItems,
    generatePayroll,
    finalizePayslips,
    markPayslipsAsPending,
    fetchEmployeePayslipsForYear,
    exportPayrollAsCSV,
    downloadPayslip,
    getNetPayAmount,
    deletePayrollRecords,
    updatePayslipStatus
} from '../../../controllers/tools/hrmsTools/PayrollController';
import {tenantMiddleware} from '../../../middlewares/tenantMiddleware';

const router = express.Router();

router.route("/createPayroll").post(isTmsUserAuthenticated,tenantMiddleware, createPayroll);
router.route("/getAllEmployeePayrollDetails").get(isTmsUserAuthenticated,tenantMiddleware, getAllEmployeePayrollDetails);
router.route("/updatePayrollItems").post(isTmsUserAuthenticated,tenantMiddleware, updatePayrollItems);
router.route("/generatePayroll").post(isTmsUserAuthenticated,tenantMiddleware, generatePayroll);
router.route("/finalizePayslips").post(isTmsUserAuthenticated,tenantMiddleware, finalizePayslips);
router.route("/markPayslipsAsPending").post(isTmsUserAuthenticated,tenantMiddleware, markPayslipsAsPending);
router.route("/fetchEmployeePayslipsForYear").get(isTmsUserAuthenticated,tenantMiddleware, fetchEmployeePayslipsForYear);
router.route("/exportPayrollAsCSV").get(isTmsUserAuthenticated,tenantMiddleware, exportPayrollAsCSV);
router.route("/downloadPayslip").get(isTmsUserAuthenticated,tenantMiddleware, downloadPayslip);
router.route("/getNetPayAmount").get(isTmsUserAuthenticated,tenantMiddleware, getNetPayAmount);
router.route("/deletePayrollRecords").patch(isTmsUserAuthenticated,tenantMiddleware, deletePayrollRecords);
router.route("/updatePayslipStatus").post(isTmsUserAuthenticated,tenantMiddleware, updatePayslipStatus);

export default router;