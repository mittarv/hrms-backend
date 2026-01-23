import { Application, NextFunction, Request, Response } from "express";
import techRoutes from "./tech";
import sendLog from "./loggingRoute/loggingRoute";

export function logExecutionTime(req: Request, res: Response, next: NextFunction) {
  const startHrTime = process.hrtime();
  const startTime = new Date().toISOString();
  
  // Log request start
  console.log(`[${startTime}] ${req.method} ${req.originalUrl}`);
  
  res.on("finish", () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : res.statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
    const resetColor = '\x1b[0m';
    
    console.log(
      `${statusColor}[${res.statusCode}]${resetColor} ${req.method} ${req.originalUrl} - ${elapsedTimeInMs.toFixed(3)} ms`
    );
  });

  next();
};

export function registerHealth(app: Application) {
    //health check and system routes
    app.use("/api/", techRoutes);
    app.use("/api/details", techRoutes);
    
    //logging routes
    app.use("/api/logging", sendLog);
}

