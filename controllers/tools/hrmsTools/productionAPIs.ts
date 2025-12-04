import { dbOutput } from "../../../models/index";
import { Request, Response } from "express";
import {
    EmployeeLeaveBalanceAttributes
} from "../../../interfaces/hrmsTool/interface/hrmsInterface";

// One time API for populating fiscal year for all employees
export const populateFiscalYearForAllEmployees = async (req: Request, res: Response) => {
    try {
        const [allEmployeesLeaveBalanceDetails, employeesBasicDetails] = await Promise.all([
            dbOutput.employeeLeaveBalanceDetails.findAll({
                attributes: ['balanceId', 'empUuid', 'fiscalYear'],
                where: {
                    isDeleted: false
                },
                raw: true
            }),
            dbOutput.employeeBasicDetails.findAll({
                attributes: ['empUuid', 'empHireDate'],
                where: {
                    isDeleted: false
                },
                raw: true
            })
        ]);

        // map employee uuid to employee basic details
        const employeeMap: Map<string, typeof employeesBasicDetails[0]> = new Map(
            employeesBasicDetails.map((emp: typeof employeesBasicDetails[0]) => [emp.empUuid, emp])
        );

        await Promise.all(
            allEmployeesLeaveBalanceDetails.map(async (balance: EmployeeLeaveBalanceAttributes) => {
                const empUuid: string = balance?.empUuid;
                const fiscalYear: number = Number(balance?.fiscalYear);

                const employeeBasicDetails: typeof employeesBasicDetails[0] = employeeMap.get(empUuid);
                const empJoiningDate: Date = employeeBasicDetails?.empHireDate;

                if (fiscalYear && empJoiningDate) {
                    const fiscalYearStart: Date = new Date(empJoiningDate);
                    const fiscalYearEnd: Date = new Date(empJoiningDate);

                    fiscalYearStart.setFullYear(fiscalYear);
                    
                    fiscalYearStart.setUTCHours(0, 0, 0, 0); // Normalize to start of day

                    fiscalYearEnd.setFullYear(fiscalYearStart.getFullYear() + 1);
                    fiscalYearEnd.setDate(fiscalYearEnd.getDate() - 1); // Last day of fiscal year

                    return dbOutput.employeeLeaveBalanceDetails.update(
                        { fiscalYearStart, fiscalYearEnd },
                        { where: { empUuid, balanceId: balance.balanceId } }
                    );
                }
            })
        );

        res.status(200).json({
            success: true,
            message: "Fiscal year populated successfully for all employees",
        });
    } catch (error) {
        console.error("Database error:", error);
        return;
    }
}

// One time API for populating employee type for all employee leave balance details
export const populateEmployeeTypeInLeaveBalance = async (req: Request, res: Response) => {
    try {
        const [allEmployeesLeaveBalanceDetails, employeesJobDetails] = await Promise.all([
            dbOutput.employeeLeaveBalanceDetails.findAll({
                attributes: ['balanceId', 'empUuid'],
                where: {
                    isDeleted: false
                },
                raw: true
            }),
            dbOutput.employeeJobDetails.findAll({
                attributes: ['empUuid', 'empType'],
                where: {
                    isDeleted: false
                },
                raw: true
            })
        ]);

        // map employee uuid to employee basic details
        const employeeMap: Map<string, typeof employeesJobDetails[0]> = new Map(
            employeesJobDetails.map((emp: typeof employeesJobDetails[0]) => [emp.empUuid, emp])
        );

        await Promise.all(
            allEmployeesLeaveBalanceDetails.map(async (balance: EmployeeLeaveBalanceAttributes) => {
                const empUuid: string = balance?.empUuid;

                const employeeJobDetails: typeof employeesJobDetails[0] = employeeMap.get(empUuid);

                if (empUuid && employeeJobDetails) {
                    return dbOutput.employeeLeaveBalanceDetails.update(
                        { empType: employeeJobDetails.empType },
                        { where: { empUuid, balanceId: balance.balanceId } }
                    );
                }
            })
        );        
        res.status(200).json({
            success: true,
            message: "Employee type populated successfully for all employees",
        });
    } catch (error) {
        console.error("Database error:", error);
        return;
    }
}