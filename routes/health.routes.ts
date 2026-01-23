import { Application, NextFunction, Request, Response } from "express";
import techRoutes from "./tech";
import sendLog from "./loggingRoute/loggingRoute";

export function logExecutionTime(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "LOCAL") {
    const startHrTime = process.hrtime();
    res.on("finish", () => {
      const elapsedHrTime = process.hrtime(startHrTime);
      const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
      console.info(
        `${req.method} ${req.originalUrl} took ${elapsedTimeInMs.toFixed(3)} ms`
      );
    });
  }

  // Always call next(), even if NODE_ENV is not "LOCAL"
  next();
};

export function registerHealth(app: Application) {
    //health check and system routes
    app.use("/api/", techRoutes);
    app.use("/api/details", techRoutes);
    
    //logging routes
    app.use("/api/logging", sendLog);
}

