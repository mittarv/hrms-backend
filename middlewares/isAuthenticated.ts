import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utilities/auth";
import { db } from "../models";
import { getUserAllToolsAccess } from "../utilities/helperFunctions";
// import { findByUserIds } from "../utilities/userIdentifierLookup";
const User = db.users;
const TmsUsers = db.tmsUsers;

export interface AuthenticatedRequest extends Request {
  userId?: number;
  user?: any;
  premium?: boolean;
  customerId?: string;
  productId?: string | null;
}

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const token = req.headers?.authorization;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No token provided",
      });
    }

    const decoded = await verifyAccessToken(token);

    if (decoded === null) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const user = await User.findOne({
      where: {
        id: decoded.id
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found or deactivated",
      });
    }
    const authReq = req as AuthenticatedRequest;
    authReq.user = user;
    authReq.userId = user.id;

    next();

  } catch (error) {
    res.status(401).json({
      success: false,
      message: (error as Error).message,
    });
  }
};

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


exports.isAuthenticated = isAuthenticated;
exports.isTmsUserAuthenticated = isTmsUserAuthenticated;