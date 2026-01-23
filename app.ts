import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import path from "path";

import { registerHrms } from "./routes/hrms.routes";
import { logExecutionTime, registerHealth } from "./routes/health.routes";

export function createApp() {
    const app = express();

    app.use(express.json({ limit: "1000mb" }));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(cors({origin : '*'}));
    app.use(helmet());
    app.disable("x-powered-by");
    app.use("/images", express.static(path.join(__dirname, "/public/images")));

    registerHrms(app);
    registerHealth(app);

    app.use(logExecutionTime);

    return app;
}
