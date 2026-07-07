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
    deletePayrollRecords
} from '../../../controllers/tools/hrmsTools/PayrollController';

const router = express.Router();

router.route("/createPayroll").post(isTmsUserAuthenticated, createPayroll);
router.route("/getAllEmployeePayrollDetails").get(isTmsUserAuthenticated, getAllEmployeePayrollDetails);
router.route("/updatePayrollItems").post(isTmsUserAuthenticated, updatePayrollItems);
router.route("/generatePayroll").post(isTmsUserAuthenticated, generatePayroll);
router.route("/finalizePayslips").post(isTmsUserAuthenticated, finalizePayslips);
router.route("/markPayslipsAsPending").post(isTmsUserAuthenticated, markPayslipsAsPending);
router.route("/fetchEmployeePayslipsForYear").get(isTmsUserAuthenticated, fetchEmployeePayslipsForYear);
router.route("/exportPayrollAsCSV").get(isTmsUserAuthenticated, exportPayrollAsCSV);
router.route("/downloadPayslip").get(isTmsUserAuthenticated, downloadPayslip);
router.route("/getNetPayAmount").get(isTmsUserAuthenticated, getNetPayAmount);
router.route("/deletePayrollRecords").patch(isTmsUserAuthenticated, deletePayrollRecords);

export default router;