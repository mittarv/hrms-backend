import { Transaction, Op } from "sequelize";
import { dbOutput } from "../../../models";
import { createUUIDV4 } from "../../uuidV4Generator";
import {
    ComponentData,
    CreateRequest,
    CreateResult,
    DeleteData,
    salaryComponentsAttributes,
    UpdateData,
} from "../../../interfaces/hrmsTool/interface/hrmsInterface";
import { 
    componentTypes,
 } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
//Database Models
const {
    salaryCategories,
    salaryComponents
} = dbOutput;

/**
 * Get all salary configuration details.
 * @param employeeType - The type of employee.
 * @param employeeLocation - The location of the employee.
 * @param employeeLevel - The level of the employee.
 * @param department - The department (for Intern/Extended Intern).
 * @param yearOfStudy - The year of study (for Intern/Extended Intern).
 * @returns The salary configuration data.
 */
export const getAllSalaryConfigService = async (empCompanyId: string, employeeType?: string, employeeLocation?: string, employeeLevel?: string, department?: string, yearOfStudy?: string) => {
    try {
        let category = await salaryCategories.findOne({
            where: {
                empCompanyId,
                isDeleted: false,
            }
        });
        if (!category) {
            category = await salaryCategories.create({
                salaryCategoryId: createUUIDV4(),
                empCompanyId,
                employeeType: componentTypes.ALL,
                employeeLocation: componentTypes.ALL,
                employeeLevel: componentTypes.ALL,
                department: null,
                yearOfStudy: null,
                isDeleted: false,
            });
        }
        const lopComponent = await salaryComponents.findOne({
            where: {
                empCompanyId,
                componentName: { [Op.like]: "%loss of pay%" },
                isDeleted: false
            }
        });
        if (!lopComponent && category) {
            await salaryComponents.create({
                componentId: createUUIDV4(),
                empCompanyId,
                salaryCategoryId: category.salaryCategoryId,
                componentName: "Loss of Pay(per day)",
                componentType: "defaultDeduction",
                amount: 0,
                isVariable: false,
                includeinLop: false,
                isDeleted: false,
                isDefault: true,
                createdBy: "system",
                updatedBy: "system"
            });
        }
    } catch (e) {
        console.error("Auto-seed Loss of Pay error:", e);
    }

   const [allDefaults, specific] = await Promise.all([
    salaryCategories.findAll({
        where: {
            empCompanyId,
            employeeType: componentTypes.ALL,
            employeeLocation: componentTypes.ALL,
            employeeLevel: componentTypes.ALL,
            department: null,
            yearOfStudy: null,
            isDeleted: false,
        },
        order: [['createdAt', 'ASC']],
        include: [{ model: salaryComponents, as: 'salaryComponents', where: { isDeleted: false, empCompanyId: { [Op.in]: [empCompanyId, "DEFAULT_COMPANY", null] } }, required: false }]
    }),
    salaryCategories.findAll({
        where: {
            empCompanyId,
            employeeType: employeeType || null,
            employeeLocation: employeeLocation || null,
            employeeLevel: employeeLevel || null,
            department: department || null,
            yearOfStudy: yearOfStudy || null,
            isDeleted: false,
        },
        order: [['createdAt', 'ASC']],
        include: [{ model: salaryComponents, as: 'salaryComponents', where: { isDeleted: false, empCompanyId: { [Op.in]: [empCompanyId, "DEFAULT_COMPANY", null] } }, required: false }]
    })
]);

return [...allDefaults, ...specific];

}

/**
 * Create a new salary configuration.
 * @param createData - The data to create the salary configuration.
 * @param userId - The ID of the user creating the configuration.
 * @param transaction - The database transaction to use.
 * @returns The result of the creation process.
 */
export const createSalaryConfigService = async (createData: CreateRequest[], userId: string, transaction: Transaction): Promise<CreateResult> => {
    const categoriesCreated: unknown[] = [];
    const componentsCreated: unknown[] = [];
    const errors: CreateResult['errors'] = [];
    
    const BATCH_SIZE = 10; // Process 10 items at a time
    const BATCH_DELAY = 100; // 100ms delay between batches
    
    // Helper function to create delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Process data in batches
    for (let i = 0; i < createData.length; i += BATCH_SIZE) {
        const batch = createData.slice(i, i + BATCH_SIZE);
        
        // Process current batch
        for (const data of batch) {
            const { categoryDetails, componentDetails } = data;
            
            let category = null;
            
            // Handle category creation or find existing
            if (categoryDetails) {
                // Find existing category
                category = await salaryCategories.findOne({
                    where: {
                        employeeType: categoryDetails.employeeType,
                        employeeLocation: categoryDetails.employeeLocation,
                        employeeLevel: categoryDetails.employeeLevel || null,
                        department: categoryDetails.department || null,
                        yearOfStudy: categoryDetails.yearOfStudy || null,
                        isDeleted: false
                    },
                    transaction
                });
                
                // Create new category if not found
                if (!category) {
                    category = await salaryCategories.create({
                        salaryCategoryId: await createUUIDV4(),
                        employeeType: categoryDetails.employeeType,
                        employeeLocation: categoryDetails.employeeLocation,
                        employeeLevel: categoryDetails.employeeLevel,
                        department: categoryDetails.department,
                        yearOfStudy: categoryDetails.yearOfStudy,
                        isDeleted: false,
                        createdBy: userId,
                        updatedBy: userId
                    }, { transaction });
                    categoriesCreated.push(category);
                }
            } else {
                // Handle global category
                category = await salaryCategories.findOne({
                    where: {
                        employeeType: componentTypes.ALL,
                        employeeLocation: componentTypes.ALL,
                        employeeLevel: componentTypes.ALL,
                        department: null,
                        yearOfStudy: null,
                        isDeleted: false
                    },
                    transaction
                });
                
                if (!category) {
                    category = await salaryCategories.create({
                        salaryCategoryId: await createUUIDV4(),
                        employeeType: componentTypes.ALL,
                        employeeLocation: componentTypes.ALL,
                        employeeLevel: componentTypes.ALL,
                        department: null,
                        yearOfStudy: null,
                        isDeleted: false,
                        createdBy: userId,
                        updatedBy: userId
                    }, { transaction });
                    categoriesCreated.push(category);
                }
            }
            
            // Create components
            if (!category) {
                throw new Error('Category not found or created');
            }
         
            const componentsToCreate = await Promise.all(
                componentDetails.map(async (component: ComponentData) => ({
                    componentId: await createUUIDV4(),
                    salaryCategoryId: (category as { salaryCategoryId: string }).salaryCategoryId,
                    componentName: component.componentName,
                    componentType: component.componentType,
                    amount: component.amount || 0,
                    percentageOfBasicSalary: component.percentageOfBasicSalary,
                    thresholdAmount: component.thresholdAmount,
                    frequency: component.frequency,
                    isVariable: component.isVariable || false,
                    includeinLop: component.includeinLop || false,
                    effectiveFrom: component.effectiveFrom,
                    effectiveTill: component.effectiveTill,
                    createdBy: userId,
                    updatedBy: userId
                }))
            );
            
            const createdComponents = await salaryComponents.bulkCreate(componentsToCreate, { 
                transaction,
                returning: true 
            });
            componentsCreated.push(...createdComponents);
        }
        
        // Add delay between batches to prevent overwhelming the database
        if (i + BATCH_SIZE < createData.length) {
            await delay(BATCH_DELAY);
        }
    }
    
    return {
        categoriesCreated,
        componentsCreated,
        errors
    };
};

/**
 * Delete salary configuration data.
 * @param deletedData - The data to delete.
 * @param userId - The ID of the user performing the deletion.
 * @param transaction - The database transaction.
 * @returns A promise that resolves when the deletion is complete.
 */
export const deleteSalaryConfigService = async (
    deletedData: DeleteData[], 
    userId: string, 
    transaction: Transaction
): Promise<void> => {
    // Extract all component IDs for batch fetching
    const componentIds = deletedData
        .filter(item => item.action === 'delete')
        .map(item => item.componentId);
    
    if (componentIds.length === 0) {
        return;
    }

    // Single DB call to fetch all components including isDefault field
    const components = await salaryComponents.findAll({
        where: { 
            componentId: { [Op.in]: componentIds },
            isDeleted: false 
        },
        attributes: ['componentId', 'componentName', 'isDefault'],
        transaction
    });

    // Create a map for quick lookup
    const componentMap = new Map<string, Pick<salaryComponentsAttributes, 'componentId' | 'componentName' | 'isDefault'>>(
        components.map(comp => [comp.componentId, comp])
    );

    // Validate all components and collect errors
    const notFoundComponents: string[] = [];
    const defaultComponents: string[] = [];
    const validComponents: Array<{
        component: Pick<salaryComponentsAttributes, 'componentId' | 'componentName' | 'isDefault'>;
        deleteItem: DeleteData;
    }> = [];

    for (const deleteItem of deletedData) {
        if (deleteItem.action === 'delete') {
            const component = componentMap.get(deleteItem.componentId);
            
            if (!component) {
                notFoundComponents.push(deleteItem.componentId);
                continue;
            }
            
            // Check if database marked this component as default (ignore frontend isDefault)
            if (component.isDefault) {
                defaultComponents.push(component.componentName || deleteItem.componentId);
                continue;
            }
            
            validComponents.push({
                component,
                deleteItem
            });
        }
    } 

    // Build error message if any validation fails
    let errorMessage = '';
    
    if (notFoundComponents.length > 0) {
        errorMessage += `Components not found: ${notFoundComponents.join(', ')}. `;
    }
    
    if (defaultComponents.length > 0) {
        const componentNames = defaultComponents.join(', ');
        errorMessage += `Cannot delete default components: ${componentNames}. `;
    }

    // If any validation fails, throw error (all or nothing)
    if (errorMessage) {
        const customError = new Error(errorMessage.trim());
        customError.name = 'ValidationError';
        throw customError;
    }

    // If all validations pass, perform batch update
    if (validComponents.length > 0) {
        const componentIdsToUpdate = validComponents.map(item => item.component.componentId);
        
        // Single bulk update query
        await salaryComponents.update(
            { 
                isDeleted: true,
                updatedBy: userId 
            },
            { 
                where: { 
                    componentId: { [Op.in]: componentIdsToUpdate } 
                },
                transaction 
            }
        );
    }
};

/**
 * Update salary configuration components with batch operations.
 * @param updateData - The data to update.
 * @param userId - The ID of the user performing the update.
 * @param transaction - The database transaction.
 * @returns A promise that resolves with the update results.
 */
export const updateSalaryConfigService = async (
    updateData: UpdateData[], 
    userId: string, 
    transaction: Transaction
): Promise<{
    totalUpdated: number;
}> => {
    // Extract all component IDs for batch fetching
    const componentIds = updateData
        .filter(item => item.action === 'update')
        .map(item => item.componentId);
    
    if (componentIds.length === 0) {
        return {
            totalUpdated: 0
        };
    }

    // Single DB call to fetch all components that need to be updated
    const existingComponents = await salaryComponents.findAll({
        where: { 
            componentId: { [Op.in]: componentIds },
            isDeleted: false 
        },
        attributes: ['componentId', 'componentName', 'salaryCategoryId', 'amount', 'percentageOfBasicSalary', 'thresholdAmount', 'frequency', 'isVariable', 'includeinLop', 'effectiveFrom', 'effectiveTill'],
        transaction
    });

    // Create a map for quick lookup
    const componentMap = new Map<string, Record<string, unknown>>(
        existingComponents.map(comp => [comp.componentId, comp.toJSON()])
    );

    // Validate all components and prepare update operations
    const notFoundComponents: string[] = [];
    const validUpdates: Array<{
        componentId: string;
        updateData: Partial<salaryComponentsAttributes>;
    }> = [];

    for (const updateItem of updateData) {
        if (updateItem.action === 'update') {
            const existingComponent = componentMap.get(updateItem.componentId);
            
            if (!existingComponent) {
                notFoundComponents.push(updateItem.componentId);
                continue;
            }

            // Prepare update data - only include changed fields
            const updateFields: Partial<salaryComponentsAttributes> = {};

            // Check each field and only include if it's different from current value
            if (updateItem.componentDetails.componentName !== undefined && updateItem.componentDetails.componentName !== (existingComponent.componentName as string)) {
                updateFields.componentName = updateItem.componentDetails.componentName;
            }
            if (updateItem.componentDetails.amount !== undefined && updateItem.componentDetails.amount !== (existingComponent.amount as number)) {
                updateFields.amount = updateItem.componentDetails.amount;
            }
            
            if (updateItem.componentDetails.percentageOfBasicSalary !== undefined && updateItem.componentDetails.percentageOfBasicSalary !== (existingComponent.percentageOfBasicSalary as number)) {
                updateFields.percentageOfBasicSalary = updateItem.componentDetails.percentageOfBasicSalary;
            }
            
            if (updateItem.componentDetails.thresholdAmount !== undefined && updateItem.componentDetails.thresholdAmount !== (existingComponent.thresholdAmount as number)) {
                updateFields.thresholdAmount = updateItem.componentDetails.thresholdAmount;
            }
            
            if (updateItem.componentDetails.frequency !== undefined && updateItem.componentDetails.frequency !== (existingComponent.frequency as string)) {
                updateFields.frequency = updateItem.componentDetails.frequency;
            }
            
            if (updateItem.componentDetails.isVariable !== undefined && updateItem.componentDetails.isVariable !== (existingComponent.isVariable as boolean)) {
                updateFields.isVariable = updateItem.componentDetails.isVariable;
            }
            
            if (updateItem.componentDetails.includeinLop !== undefined && updateItem.componentDetails.includeinLop !== (existingComponent.includeinLop as boolean)) {
                updateFields.includeinLop = updateItem.componentDetails.includeinLop;
            }
            
            if (updateItem.componentDetails.effectiveFrom !== undefined && updateItem.componentDetails.effectiveFrom !== (existingComponent.effectiveFrom as Date)) {
                updateFields.effectiveFrom = updateItem.componentDetails.effectiveFrom;
            }
            
            if (updateItem.componentDetails.effectiveTill !== undefined && updateItem.componentDetails.effectiveTill !== (existingComponent.effectiveTill as Date)) {
                updateFields.effectiveTill = updateItem.componentDetails.effectiveTill;
            }

            // Only proceed with update if there are actual changes
            if (Object.keys(updateFields).length > 0) {
                updateFields.updatedBy = userId;
                
                validUpdates.push({
                    componentId: updateItem.componentId,
                    updateData: updateFields
                });
            }
        }
    }

    // Build error message if any validation fails
    if (notFoundComponents.length > 0) {
        const errorMessage = `Components not found: ${notFoundComponents.join(', ')}`;
        const customError = new Error(errorMessage);
        customError.name = 'ValidationError';
        throw customError;
    }

    // Perform batch updates
    const updatePromises = validUpdates.map(async (updateInfo) => {
        await salaryComponents.update(
            updateInfo.updateData,
            {
                where: { componentId: updateInfo.componentId },
                transaction
            }
        );
    });

    // Execute all updates in parallel
    await Promise.all(updatePromises);

    return {
        totalUpdated: validUpdates.length
    };
};
