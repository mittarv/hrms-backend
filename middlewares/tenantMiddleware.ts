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
    // 1. Try to get tenant from custom header (useful for local dev/testing)
    let subdomain = req.headers["x-tenant-subdomain"] as string;

    // 2. Fallback: Parse it from the Host header
    let fullHost = req.headers.host || "";
    fullHost = fullHost.split(":")[0];

    if (!subdomain) {
      subdomain = extractSubdomainFromHost(req.headers.host) || "";
    }

    if (!subdomain) {
      // If we cannot determine a subdomain and we are in multi-org mode, we might throw an error.
      // But for self-hosted or default cases, we can fallback to a DEFAULT_COMPANY.
      req.body.empCompanyId = "DEFAULT_COMPANY";
      return next();
    }
    

    // 3. Lookup Organization by subdomain
    const Organization = dbOutput.organization;

    // In self-hosted builds, the Organization model won't exist.
    if (!Organization) {
      req.body.empCompanyId = "DEFAULT_COMPANY";
      return next();
    }

    const org = await Organization.findOne({ 
      where: { 
        [Op.or]: [
          { subdomain: subdomain },
          { slugDomain: subdomain },
          { domain: fullHost }
        ],
        status: "ACTIVE",
        isDeleted: false
      } 
    });

    if (!org) {
      return res.status(403).json({ error: "Tenant not found or inactive.", code: "TENANT_INACTIVE" });
    }

    // 4. Inject into the request so all downstream controllers/models use it
    // Often we put it in req.body or req.query, or explicitly req.tenantId.
    // For consistency with existing code, we will inject it where controllers expect it.
    
    // Most controllers pull empCompanyId from req.body (e.g. create APIs)
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      req.body.empCompanyId = org.id;
    }
    
    // Also attach to req for general usage
    (req as any).empCompanyId = org.id;
    (req as any).tenantId = org.id;

    next();
  } catch (error) {
    console.error("Error in tenant middleware:", error);
    res.status(500).json({ error: "Internal Server Error in Tenant Resolution" });
  }
};
