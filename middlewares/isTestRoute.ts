import { db } from "../models";

// Middleware to check if test routes are enabled via feature flag
export const isTestRouteEnabled = async (req, res, next) => {
    try {
      const environment = process.env.NODE_ENV;
      
      // Find the isTestRoute feature flag
      const featureFlag = await db.featureFlagsMain.findOne({
        where: {
          feature: 'isTestRoute',
          environment,
          isDeleted: false
        }
      });
  
      if (!featureFlag) {
        return res.status(404).json({
          success: false,
          message: "Test routes feature flag not found"
        });
      }
  
      // Check if the feature flag is approved
      const approval = await db.featureFlagsApproval.findOne({
        where: {
          featureFlagId: featureFlag.id,
          actionStatus: 10, // 10 = approved
          isDeleted: false
        }
      });
  
      if (!approval) {
        return res.status(404).json({
          success: false,
          message: "Test routes feature flag is not approved"
        });
      }
  
      // Only allow access when feature flag value is "v1"
      if (featureFlag.value !== 'v1') {
        return res.status(404).json({
          success: false,
          message: "Test routes are not enabled"
        });
      }
  
      next();
    } catch (error) {
      console.error("Error checking isTestRoute feature flag:", error);
      return res.status(500).json({
        success: false,
        message: "Error checking test routes availability"
      });
    }
  };