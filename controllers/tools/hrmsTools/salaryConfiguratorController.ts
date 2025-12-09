import { 
    accessLevelConstant, 
    hrmsConstants,
    salaryConfigActions,
} from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";
import { outputSequelize } from "../../../models";
import { Transaction } from "sequelize";
import { 
    getAllSalaryConfigService,
    createSalaryConfigService,
    deleteSalaryConfigService,
    updateSalaryConfigService,
 } from "../../../utilities/hrmsUtilities/dbCalls/salaryConfiguratorQueries"
 import { 
    AuthenticatedUser,
    CreateRequest, 
    DeleteData,
    UpdateData,
    getRequestQuery,
} from "../../../interfaces/hrmsTool/interface/hrmsInterface";

/**
 * Get all salary configuration details.
 * @param req - The request object containing user information and query parameters.
 * @param res - The response object to send the result.
 */
export const getAllSalaryConfigDetails = async(req, res) => {
    // Extract user and query parameters
    const { user } = req as AuthenticatedRequest;

    // Check user permissions
    const { toolsAccess } = user as AuthenticatedUser;

    // Extract query parameters
    const { employeeType, employeeLocation, employeeLevel, department, yearOfStudy } = req.query as getRequestQuery; 

    // Validate user access level
    const userType: number = toolsAccess?.[hrmsConstants.HR_REPOSITORY];
    
    // Fetch salary configuration details
    try {
        const salaryConfigData = await getAllSalaryConfigService(employeeType, employeeLocation, employeeLevel, department, yearOfStudy);
        res.status(200).json({
            status: "success",
            salaryConfigData
        })      
    } catch (error) {
            // Handle validation errors with specific messages
            if (error.name === 'ValidationError') {
                console.error('Salary config get validation error:', error);
                res.status(400).json({
                    status: "error",
                    message: error.message,
                    devMessage: error.stack
                });
            } else {
                console.error('Salary config get error:', error);
                res.status(500).json({
                    status: "error",
                    message: "Internal Server Error",
                    devMessage: error.stack
            });
        }
    }
}

/**
 * Create a new salary configuration.
 * @param req - The request object containing user information and the data to create.
 * @param res - The response object to send the result.
 */
export const createSalaryConfig = async(req, res) => {
    // Extract user and request body
    const { user } = req as AuthenticatedRequest;
    
    // Extract user details and request body
    const { toolsAccess, email, userId } = user as AuthenticatedUser;

    const { createData } = req.body as { createData: CreateRequest[] };

    // Check permissions
    if (toolsAccess?.[hrmsConstants.HR_REPOSITORY] < accessLevelConstant.TOOL_ADMIN) {
        res.status(403).json({
            status: "error",
            message: "Forbidden: You don't have access to this resource"
        });
        return;
    }

    // Get user info for audit fields
    const id = email || String(userId);

    if (!id) {
        res.status(400).json({
            status: "error",
            message: "User information is missing"
        });
        return;
    }

    // Basic validation
    if (!createData || !Array.isArray(createData) || createData.length === 0) {
        res.status(400).json({
            status: "error",
            message: "Invalid input data"
        });
    }

    // Ensure all actions are 'create'
    for (const item of createData) {
        if (item.action !== salaryConfigActions.CREATE) {
            res.status(400).json({
                status: "error",
                message: `Invalid action type: ${item.action}`
            });
            return;
        }
        
        // Validate Intern/Extended Intern specific fields
        if (item.categoryDetails) {
            const isInternType = item.categoryDetails.employeeType === 'intern_key' || 
                               item.categoryDetails.employeeType === 'extended_inter_key';
            
            if (isInternType) {
                if (!item.categoryDetails.employeeLevel || 
                    !item.categoryDetails.department || 
                    !item.categoryDetails.yearOfStudy) {
                    res.status(400).json({
                        status: "error",
                        message: "For Intern/Extended Intern, employeeLevel, department, and yearOfStudy are required"
                    });
                    return;
                }
            }
        }
    }

    // Perform creation within a transaction with timeout and isolation level
    await outputSequelize.transaction(
        {
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
        },
        async (transaction) => {
            try {
                const results = await createSalaryConfigService(createData, id, transaction);
                
                res.status(201).json({
                    status: "success",
                    message: "Salary configuration created successfully",
                    data: {
                        categoriesCreated: results.categoriesCreated,
                        componentsCreated: results.componentsCreated
                    }
                });
            } catch (error) {
                // Handle validation errors with specific messages
                if (error.name === 'ValidationError') {
                    console.error('Salary config Create validation error:', error);
                    res.status(400).json({
                        status: "error",
                        message: error.message,
                        devMessage: error.stack
                    });
                } else {
                    console.error('Salary config Create error:', error);
                    res.status(500).json({
                        status: "error",
                        message: "Internal Server Error",
                        devMessage: error.stack
                    });
                }
            }
        }
    );
};

/**
 * Delete a salary configuration.
 * @param req - The request object containing user information and the data to delete.
 * @param res - The response object to send the result.
 * @returns 
 */
export const deleteSalaryConfig = async(req, res) => {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, email, userId } = user as AuthenticatedUser;
    const { deletedData } = req.body as { deletedData: DeleteData[] };
    
    if (toolsAccess?.[hrmsConstants.HR_REPOSITORY] < accessLevelConstant.TOOL_ADMIN) {
        res.status(403).json({
            status: "error",
            message: "Forbidden: You don't have access to this resource"
        });
        return;
    }
    
    const id = email || String(userId);

    if (!id) {
        res.status(400).json({
            status: "error",
            message: "User information is missing"
        });
        return;
    }

    if (!deletedData || !Array.isArray(deletedData) || deletedData.length === 0) {
        res.status(400).json({
            status: "error",
            message: "Invalid input data"
        });
        return;
    }
    
    for (const item of deletedData) {
        if (item.action !== salaryConfigActions.DELETE) {
            res.status(400).json({
                status: "error",
                message: `Invalid action type: ${item.action}`
            });
            return;
        }
    }

    try {
        // Perform deletion within a transaction
        await outputSequelize.transaction(
            {
                isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
            },
            async (transaction) => {
                const results = await deleteSalaryConfigService(deletedData, id, transaction);
                
                res.status(200).json({
                    status: "success",
                    message: "Salary configuration deleted successfully",
                    data: results
                });
            }
        );
    } catch (error) {
        // Handle validation errors with specific messages
        if (error.name === 'ValidationError') {
            console.error('Salary config deletion validation error:', error);
            res.status(400).json({
                status: "error",
                message: error.message,
                devMessage: error.stack
            });
        } else {
            console.error('Salary config deletion error:', error);
            res.status(500).json({
                status: "error",
                message: "Internal Server Error",
                devMessage: error.stack
            });
        }
    }
};

/**
 * Update salary configuration components.
 * @param req - The request object containing user information and the data to update.
 * @param res - The response object to send the result.
 */
export const updateSalaryConfig = async(req, res) => {
    const { user } = req as AuthenticatedRequest;
    const { toolsAccess, email, userId } = user as AuthenticatedUser;
    const { editData } = req.body as { editData: UpdateData[] };
    
    // Check permissions
    if (toolsAccess?.[hrmsConstants.HR_REPOSITORY] < accessLevelConstant.TOOL_ADMIN) {
        res.status(403).json({
            status: "error",
            message: "Forbidden: You don't have access to this resource"
        });
        return;
    }
    
    const id = email || String(userId);

    if (!id) {
        res.status(400).json({
            status: "error",
            message: "User information is missing"
        });
        return;
    }

    // Basic validation
    if (!editData || !Array.isArray(editData) || editData.length === 0) {
        res.status(400).json({
            status: "error",
            message: "Invalid input data"
        });
        return;
    }
    
    // Ensure all actions are 'update'
    for (const item of editData) {
        if (item.action !== salaryConfigActions.UPDATE) {
            res.status(400).json({
                status: "error",
                message: `Invalid action type: ${item.action}`
            });
            return;
        }
        // Validate required fields
        if (!item.componentId || !item.componentDetails) {
            res.status(400).json({
                status: "error",
                message: "Missing required fields: componentId or componentDetails data"
            });
            return;
        }
    }

    try {
        // Perform update within a transaction
        await outputSequelize.transaction(
            {
                isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
            },
            async (transaction) => {
                const results = await updateSalaryConfigService(editData, id, transaction);
                
                res.status(200).json({
                    status: "success",
                    message: "Salary configuration updated successfully",
                    data: results
                });
            }
        );
    } catch (error) {
        // Handle validation errors with specific messages
        if (error.name === 'ValidationError') {
            console.error('Salary config update validation error:', error);
            res.status(400).json({
                status: "error",
                message: error.message,
                devMessage: error.stack
            });
        } else {
            console.error('Salary config update error:', error);
            res.status(500).json({
                status: "error",
                message: "Internal Server Error",
                devMessage: error.stack
            });
        }
    }
};

