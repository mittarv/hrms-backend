import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { getUserAllToolsAccess } from "../utilities/helperFunctions";
import { dbOutput } from "../models";
import { Op } from "sequelize";
const TmsUsers = dbOutput.tmsUsers;

export interface AuthenticatedRequest extends Request {
  userId?: number;
  user?: any;
  premium?: boolean;
  customerId?: string;
  productId?: string | null;
}

export const isTmsUserAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers?.authorization;
    if (!token) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }
    const decoded = jwt.verify(token, process.env.SECRET_KEY as string) as { id: string, email: string, env: string };

    if (decoded.env !== process.env.NODE_ENV) {
      res.status(401).json({
        success: false,
        message: "Invalid token environment",
      });
      return;
    }

    const tmsUser = await TmsUsers.findOne({
      where: { userId: decoded.id, email: decoded.email, isDeleted: false },
      raw: true
    });

    if (!tmsUser) {
      res.status(401).json({
        success: false,
        message: "TMS user not found",
      });
      return;
    }

    const toolsAccess = await getUserAllToolsAccess(tmsUser);

    let tenantId = null;
    const subdomain = req.headers['x-tenant-subdomain'] || req.query.tenant;
    if (subdomain) {
      const Organization = dbOutput.organization;
      if (Organization) {
        let fullHost = req.headers.host || "";
        fullHost = fullHost.split(":")[0];
        
        const org = await Organization.findOne({ 
          where: { 
            [Op.or]: [
              { subdomain: subdomain },
              { slugDomain: subdomain },
              { domain: fullHost }
            ],
            status: 'ACTIVE' 
          }, 
          raw: true 
        });
        if (org) {
          tenantId = (org as any).id;
        }
      }
    }

    let resolvedEmployeeUuid = null;
    if (tenantId) {
      // Find all contact details for this email
      const contactRows = await dbOutput.employeeContactDetails.findAll({
        where: { empOfficialEmail: decoded.email, isDeleted: false },
        attributes: ['empUuid'],
        raw: true
      });
      if (contactRows && contactRows.length > 0) {
        const empUuids = contactRows.map((r: any) => r.empUuid);
        // Find the specific one for this tenant
        const basicRow = await dbOutput.employeeBasicDetails.findOne({
          where: { empUuid: { [Op.in]: empUuids }, empCompanyId: tenantId, isDeleted: false },
          attributes: ['empUuid'],
          raw: true
        });
        if (basicRow) {
          resolvedEmployeeUuid = (basicRow as any).empUuid;
        }
      }
    } else {
      // Fallback for global endpoints (legacy)
      const fallbackUuidRow = await dbOutput.employeeContactDetails.findOne({
        where: { empOfficialEmail: decoded.email, isDeleted: false },
        attributes: ['empUuid'],
        raw: true
      });
      if (fallbackUuidRow) {
        resolvedEmployeeUuid = (fallbackUuidRow as any).empUuid;
      }
    }

    const authReq = req as AuthenticatedRequest;
    authReq.user = { ...tmsUser, toolsAccess, employeeUuid: resolvedEmployeeUuid }
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Session expired, please sign in again"
      });
      return;
    }
    res.status(500).json({
      message: (error as Error).message,
    });
  }
};