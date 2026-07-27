import { Request, Response, NextFunction } from "express";
import { dbOutput } from "../models"; // adjust path if necessary based on how db is exported
import { Op } from "sequelize";
import { extractSubdomainFromHost } from "../utilities/domainUtils";

/**
 * Tenant Middleware for Subdomain Segregation
 * 
 * This middleware extracts the subdomain from the request (either via Host header or a custom header),
 * looks up the corresponding Organization in the database, and injects the `empCompanyId` into the request object.
 * 
 * E.g., if a request comes from `https://mittarv.extindia.com`, the subdomain is `mittarv`.
 */
export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      req.body.empCompanyId = "DEFAULT_COMPANY";
      (req as any).empCompanyId = "DEFAULT_COMPANY";
      return next();
    }

    // Verify the organization is still active
    const Organization = dbOutput.organization;
    if (Organization) {
      const org = await Organization.findByPk(tenantId, { attributes: ['id', 'status'], raw: true });
      if (!org || (org as any).status !== 'ACTIVE') {
        return res.status(403).json({ 
          success: false, 
          message: "Organization is inactive or not found",
          code: "TENANT_INACTIVE"
        });
      }
    }

    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      req.body.empCompanyId = tenantId;
    }
    
    (req as any).empCompanyId = tenantId;

    next();
  } catch (error) {
    console.error("Error in tenant middleware:", error);
    res.status(500).json({ error: "Internal Server Error in Tenant Resolution" });
  }
};
