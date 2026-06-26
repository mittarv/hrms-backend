import { Transaction, Op } from 'sequelize';
import { dbOutput } from '../../../models';
import { offboardingStatus } from '../../../interfaces/hrmsTool/enum/hrmsEnum';
import { createUUIDV4 } from '../../uuidV4Generator';
import {
    OffboardingWithEmployeeName,
    OffboardingInitiatedEmployeeDetails,
    HrClearanceResult,
    FinanceClearanceResult,
    OffboardedEmployeeWithLastWorkingDay,
} from '../../../interfaces/hrmsTool/interface/hrmsInterface';
import { fetchEmployeeCurrentJobDetails } from '../dbCalls';

const {
    employeeOffboarding,
    employeeBasicDetails,
    employeeJobDetails,
} = dbOutput;

/**
 * Get offboarding initiated employee details service – returns all active employees with offboarding in progress.
 * @param transaction - The transaction
 * @returns Array of offboarding initiated employee details (one per employee with active offboarding)
 */
export const getAllOffboardingInitiatedEmployeeDetailsService = async(
    transaction: Transaction
): Promise<OffboardingInitiatedEmployeeDetails[]> => {

    const offboardingList = await employeeOffboarding.findAll({
        where: {
            offboardingStatus: {
                [Op.in]: [offboardingStatus.INITIATED, offboardingStatus.ON_HOLD],
            },
            isDeleted: false,
        },
        order: [['createdAt', 'DESC']],
        transaction,
    });

    if (!offboardingList.length) {
        return [];
    }

    // One row per employee: keep latest offboarding per empUuid (list already ordered by createdAt DESC)
    const seen = new Set<string>();
    const offboardingListUnique = offboardingList.filter((o) => {
        if (seen.has(o.empUuid)) return false;
        seen.add(o.empUuid);
        return true;
    });

    const empUuids = offboardingListUnique.map((o) => o.empUuid);

    const [jobDetailsMap, basicDetailsList] = await Promise.all([
        fetchEmployeeCurrentJobDetails(empUuids, transaction) as Promise<Map<string, Record<string, unknown>>>,
        employeeBasicDetails.findAll({
            where: { empUuid: { [Op.in]: empUuids }, isDeleted: false },
            attributes: ['empUuid', 'empFirstName', 'empLastName'],
            transaction,
            raw: true,
        }),
    ]);

    const basicByUuid = new Map(
        (basicDetailsList as { empUuid: string; empFirstName: string; empLastName: string }[]).map((e) => [
            e.empUuid,
            { employeeName: `${e.empFirstName ?? ''} ${e.empLastName ?? ''}`.trim() },
        ])
    );

    return offboardingListUnique
        .map((offboarding) => {
            const empUuid = offboarding.empUuid;
            const jobDetails = jobDetailsMap?.get(empUuid) ?? null;
            const basic = basicByUuid.get(empUuid);
            if (!jobDetails) return null;
            return {
                ...offboarding.toJSON(),
                ...jobDetails,
                ...(basic ? { employeeName: basic.employeeName } : {}),
            } as OffboardingInitiatedEmployeeDetails;
        })
        .filter((item): item is OffboardingInitiatedEmployeeDetails => item !== null);
}
/**
 * Initiate offboarding service
 * @param empUuid - The employee UUID
 * @param createdBy - The employee who created the offboarding
 * @param updatedBy - The employee who updated the offboarding
 * @param transaction - The transaction
 * @returns The offboarding with employee name
 */
export const initiateOffboardingService = async(
    empUuid: string,
    createdBy: string,
    updatedBy: string,
    transaction: Transaction
): Promise<OffboardingWithEmployeeName> => {
        
    const employee = await employeeBasicDetails.findOne({
        where: {
            empUuid,
            isDeleted: false,
        },
        attributes: ['empUuid', 'empFirstName', 'empLastName'],
        transaction,
    });
    
    if (!employee) {
        throw new Error(`Employee not found`);
    }
    
    const employeeName = `${employee.empFirstName} ${employee.empLastName}`.trim();
    
    const existingOffboarding = await employeeOffboarding.findOne({
        where: {
            empUuid,
            offboardingStatus: [
                offboardingStatus.INITIATED,
                offboardingStatus.APPROVED
            ],
            isDeleted: false,
        },
        attributes: ['offboardingId', 'offboardingStatus'],
        transaction,
    });
    
    if (existingOffboarding) {
        if (existingOffboarding.offboardingStatus === offboardingStatus.INITIATED) {
            throw new Error(`Offboarding already initiated for ${employeeName}`);
        }
        if (existingOffboarding.offboardingStatus === offboardingStatus.APPROVED) {
            throw new Error(`Offboarding already approved for ${employeeName}`);
        }
    }
    
    const offboardingId = await createUUIDV4();
    const offboarding = await employeeOffboarding.create({
        offboardingId,
        empUuid,
        offboardingStatus: offboardingStatus.INITIATED,
        createdBy,
        updatedBy,
    }, { transaction });

    return {
        ...offboarding.toJSON(),
        employeeName,
    };
}

/**
 * HR clearance service
 * @param empUuid - The employee UUID
 * @param updatedBy - The employee who updated the clearance
 * @param transaction - The transaction
 * @returns The HR clearance result
 */
export const hrClearanceService = async(
    empUuid: string,
    updatedBy: string,
    transaction: Transaction
): Promise<HrClearanceResult> => {
    
    const employee = await employeeBasicDetails.findOne({
        where: {
            empUuid,
            isDeleted: false,
        },
        attributes: ['empUuid', 'empFirstName', 'empLastName'],
        transaction,
    });

    if (!employee) {
        throw new Error(`Employee not found`);
    }

    const employeeName = `${employee.empFirstName} ${employee.empLastName}`.trim();

    const offboarding = await employeeOffboarding.findOne({
        where: {
            empUuid,
            offboardingStatus: offboardingStatus.INITIATED,
            isDeleted: false,
        },
        transaction,
    });

    if (!offboarding) {
        throw new Error(`Offboarding not initiated for ${employeeName}`);
    }

    const currentStatus = offboarding.hrClearanceStatus || false;
    const newStatus = !currentStatus;

    const updateData = newStatus
        ? {
            hrClearanceStatus: true,
            hrClearanceDate: new Date(),
            hrClearanceBy: updatedBy,
            updatedBy,
          }
        : {
            hrClearanceStatus: false,
            hrClearanceDate: null,
            hrClearanceBy: null,
            updatedBy,
          };

    const [affectedRows] = await employeeOffboarding.update(
        updateData,
        {
            where: {
                empUuid,
                offboardingStatus: offboardingStatus.INITIATED,
                isDeleted: false,
            },
            transaction,
        }
    );

    if (affectedRows === 0) {
        throw new Error(`Failed to update HR clearance status for ${employeeName}`);
    }

    const updatedOffboarding = await employeeOffboarding.findOne({
        where: {
            empUuid,
            isDeleted: false,
        },
        transaction,
    });

    return {
        ...updatedOffboarding!.toJSON(),
        employeeName,
        previousStatus: currentStatus,
        newStatus: newStatus,
    };
}

/**
 * Finance clearance service
 * @param empUuid - The employee UUID
 * @param updatedBy - The employee who updated the clearance
 * @param transaction - The transaction
 * @returns The finance clearance result
 */
export const financeClearanceService = async(
    empUuid: string,
    updatedBy: string,
    transaction: Transaction
): Promise<FinanceClearanceResult> => {
    
    const employee = await employeeBasicDetails.findOne({
        where: {
            empUuid,
            isDeleted: false,
        },
        attributes: ['empUuid', 'empFirstName', 'empLastName'],
        transaction,
    });

    if (!employee) {
        throw new Error(`Employee not found`);
    }

    const employeeName = `${employee.empFirstName} ${employee.empLastName}`.trim();

    const offboarding = await employeeOffboarding.findOne({
        where: {
            empUuid,
            offboardingStatus: offboardingStatus.INITIATED,
            isDeleted: false,
        },
        transaction,
    });

    if (!offboarding) {
        throw new Error(`Offboarding not initiated for ${employeeName}`);
    }

    const currentStatus = offboarding.financeClearanceStatus || false;
    const newStatus = !currentStatus;

    const updateData = newStatus
        ? {
            financeClearanceStatus: true,
            financeClearanceDate: new Date(),
            financeClearanceBy: updatedBy,
            updatedBy,
          }
        : {
            financeClearanceStatus: false,
            financeClearanceDate: null,
            financeClearanceBy: null,
            updatedBy,
          };

    const [affectedRows] = await employeeOffboarding.update(
        updateData,
        {
            where: {
                empUuid,
                offboardingStatus: offboardingStatus.INITIATED,
                isDeleted: false,
            },
            transaction,
        }
    );

    if (affectedRows === 0) {
        throw new Error(`Failed to update Finance clearance status for ${employeeName}`);
    }

    const updatedOffboarding = await employeeOffboarding.findOne({
        where: {
            empUuid,
            isDeleted: false,
        },
        transaction,
    });

    return {
        ...updatedOffboarding!.toJSON(),
        employeeName,
        previousStatus: currentStatus,
        newStatus: newStatus,
    };
}

/**
 * Set last working day for an offboarding record
 * @param empUuid - The employee UUID
 * @param lastWorkingDay - The last working day date
 * @param updatedBy - The employee who updated the record
 * @param transaction - The transaction
 * @returns The updated offboarding with employee name
 */
export const setLastWorkingDayService = async (
    empUuid: string,
    lastWorkingDay: Date,
    updatedBy: string,
    transaction: Transaction
): Promise<OffboardingWithEmployeeName> => {
    
    const employee = await employeeBasicDetails.findOne({
        where: {
            empUuid,
            isDeleted: false,
        },
        attributes: ['empUuid', 'empFirstName', 'empLastName'],
        transaction,
    });

    if (!employee) {
        throw new Error('Employee not found');
    }

    const employeeName = `${employee.empFirstName} ${employee.empLastName}`.trim();

    const offboarding = await employeeOffboarding.findOne({
        where: {
            empUuid,
            offboardingStatus: offboardingStatus.INITIATED,
            isDeleted: false,
        },
        transaction,
    });

    if (!offboarding) {
        throw new Error(`Offboarding not initiated for ${employeeName}`);
    }

    if (offboarding.offboardingStatus === offboardingStatus.APPROVED) {
        throw new Error(`Cannot modify last working day - offboarding already approved for ${employeeName}`);
    }

    const [affectedRows] = await employeeOffboarding.update(
        {
            lastWorkingDay,
            updatedBy,
            updatedAt: new Date(),
        },
        {
            where: {
                empUuid,
                offboardingStatus: offboardingStatus.INITIATED,
                isDeleted: false,
            },
            transaction,
        }
    );

    if (affectedRows === 0) {
        throw new Error(`Failed to set last working day for ${employeeName}`);
    }

    const updatedOffboarding = await employeeOffboarding.findOne({
        where: {
            empUuid,
            isDeleted: false,
        },
        transaction,
    });

    if (!updatedOffboarding) {
        throw new Error(`Failed to retrieve updated offboarding record for ${employeeName}`);
    }

    return {
        ...updatedOffboarding.toJSON(),
        employeeName,
    };
};

/**
 * Approve offboarding - sets final approval only when HR clearance, Finance clearance and last working day are set.
 * @param empUuid - The employee UUID
 * @param updatedBy - The employee who is approving
 * @param transaction - The transaction
 * @returns The updated offboarding with employee name
 */
export const approveOffboardingService = async (
    empUuid: string,
    updatedBy: string,
    transaction: Transaction
): Promise<OffboardingWithEmployeeName> => {
    const employee = await employeeBasicDetails.findOne({
        where: {
            empUuid,
            isDeleted: false,
        },
        attributes: ['empUuid', 'empFirstName', 'empLastName'],
        transaction,
    });

    if (!employee) {
        throw new Error('Employee not found');
    }

    const employeeName = `${employee.empFirstName} ${employee.empLastName}`.trim();

    const offboarding = await employeeOffboarding.findOne({
        where: {
            empUuid,
            offboardingStatus: offboardingStatus.INITIATED,
            isDeleted: false,
        },
        transaction,
    });

    if (!offboarding) {
        throw new Error(`Offboarding not initiated for ${employeeName}`);
    }

    if (!offboarding.hrClearanceStatus) {
        throw new Error(`HR clearance must be completed before approval for ${employeeName}`);
    }

    if (!offboarding.financeClearanceStatus) {
        throw new Error(`Finance clearance must be completed before approval for ${employeeName}`);
    }

    if (!offboarding.lastWorkingDay) {
        throw new Error(`Last working day must be set before approval for ${employeeName}`);
    }

    const [affectedRows] = await employeeOffboarding.update(
        {
            finalApprovalStatus: true,
            finalApprovalDate: new Date(),
            finalApprovalBy: updatedBy,
            updatedBy,
            offboardingStatus: offboardingStatus.APPROVED,
        },
        {
            where: {
                empUuid,
                offboardingStatus: offboardingStatus.INITIATED,
                isDeleted: false,
            },
            transaction,
        }
    );

    if (affectedRows === 0) {
        throw new Error(`Failed to approve offboarding for ${employeeName}`);
    }

    await employeeBasicDetails.update(
        { isActive: false },
        {
            where: { empUuid, isDeleted: false },
            transaction,
        }
    );

    const updatedOffboarding = await employeeOffboarding.findOne({
        where: {
            empUuid,
            isDeleted: false,
        },
        transaction,
    });

    if (!updatedOffboarding) {
        throw new Error(`Failed to retrieve updated offboarding record for ${employeeName}`);
    }

    return {
        ...updatedOffboarding.toJSON(),
        employeeName,
    };
};


/**
 * Get all offboarded (inactive) employees with their lastWorkingDay from employee_offboarding (approved record).
 */
export const getAllOffboardedEmployeesService = async (transaction: Transaction): Promise<OffboardedEmployeeWithLastWorkingDay[]> => {
    const offboardedEmployees = await employeeBasicDetails.findAll({
        where: {
            isActive: false,
            isDeleted: false,
        },
        attributes: ['empUuid', 'empFirstName', 'empLastName'],
        transaction,
        include: [
            {
                model: employeeJobDetails,
                as: 'jobDetails',
                attributes: ['jobId', 'empType', 'empDepartment'],
                required: false,
            },
        ],
    });

    if (offboardedEmployees.length === 0) {
        return [];
    }

    const empUuids = offboardedEmployees.map((e) => e.empUuid);

    const approvedOffboardings = await employeeOffboarding.findAll({
        where: {
            empUuid: empUuids,
            offboardingStatus: offboardingStatus.APPROVED,
            isDeleted: false,
        },
        attributes: ['empUuid', 'lastWorkingDay'],
        transaction,
        raw: true,
    });

    const lastWorkingDayByEmpUuid = new Map<string, string | Date | null>();
    for (const row of approvedOffboardings) {
        lastWorkingDayByEmpUuid.set(row.empUuid, row.lastWorkingDay ?? null);
    }

    return offboardedEmployees.map((emp) => {
        const empJson = emp.toJSON() as { empUuid: string; empFirstName: string; empLastName: string; jobDetails?: { jobId: string; empType?: string; empDepartment?: string } | null };
        const employeeName = `${emp.empFirstName} ${emp.empLastName}`.trim();
        return {
            empUuid: empJson.empUuid,
            empFirstName: empJson.empFirstName,
            empLastName: empJson.empLastName,
            employeeName,
            jobDetails: empJson.jobDetails ?? null,
            lastWorkingDay: lastWorkingDayByEmpUuid.get(empJson.empUuid) ?? null,
        };
    });
};