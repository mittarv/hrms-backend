import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import path from "path";

import { registerHrms } from "./routes/hrms.routes";
import { logExecutionTime, registerHealth } from "./routes/health.routes";
import { createLoggingMiddleware } from "./middlewares/logging";

export function createApp() {
    const app = express();

    app.use(express.json({ limit: "1000mb" }));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(cors({origin : '*'}));
    app.use(helmet());
    app.disable("x-powered-by");
    app.use("/images", express.static(path.join(__dirname, "/public/images")));

    // API logging middleware (logs to console/file/Service Bus)
    app.use(createLoggingMiddleware());

    // Execution time logging - must be before routes to catch all requests
    app.use(logExecutionTime);

    registerHrms(app);
    registerHealth(app);

    return app;
}
