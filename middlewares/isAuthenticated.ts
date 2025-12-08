import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { getUserAllToolsAccess } from "../utilities/helperFunctions";
import { dbOutput } from "../models";
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
      res.status(400).json({
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

    const toolsAccess = await getUserAllToolsAccess(tmsUser);

    if (!tmsUser) {
      res.status(401).json({
        success: false,
        message: "TMS user not found",
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    authReq.user = { ...tmsUser, toolsAccess }
    next();
  } catch (error) {
    res.status(500).json({
      message: (error as Error).message,
    });
  }
};

exports.isTmsUserAuthenticated = isTmsUserAuthenticated;