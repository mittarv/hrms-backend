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
    // 1. Get host and headers
    let fullHost = (req.headers["x-tenant-domain"] as string) || (req.headers.host || "").split(":")[0].toLowerCase().trim();
    let tenantHeader = (req.headers["x-tenant-subdomain"] as string) || (req.headers["x-tenant-id"] as string);

    let extractedSubdomain = extractSubdomainFromHost(req.headers.host) || "";

    const Organization = dbOutput.organization;

    // In self-hosted or default builds
    if (!Organization) {
      req.body.empCompanyId = "DEFAULT_COMPANY";
      return next();
    }

    // 2. Lookup Organization prioritizing direct domain match
    const org = await Organization.findOne({ 
      where: { 
        [Op.or]: [
          { domain: fullHost },
          { allowedDomain: fullHost },
          ...(extractedSubdomain ? [{ subdomain: extractedSubdomain }, { slugDomain: extractedSubdomain }] : []),
          ...(tenantHeader ? [{ subdomain: tenantHeader }, { slugDomain: tenantHeader }] : [])
        ],
        status: "ACTIVE",
        isDeleted: false
      } 
    });

    if (!org) {
      // Default fallback if no custom tenant matches
      req.body.empCompanyId = "DEFAULT_COMPANY";
      (req as any).empCompanyId = "DEFAULT_COMPANY";
      return next();
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
