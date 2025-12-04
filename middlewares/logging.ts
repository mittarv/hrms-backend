import { Request, Response, NextFunction } from 'express';
import { Logger, createLogger, format, transports } from 'winston';
import * as serviceBus from '../servicebus';
import { hostname } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Configuration Constants
 * BATCH_SIZE: Number of logs to collect before forcing a flush
 * FLUSH_INTERVAL: Time in ms between automatic buffer flushes
 * SLOW_THRESHOLD: Request duration threshold to mark as slow (in ms)
 * MACHINE_ID: Unique identifier for the current server instance
 */
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1') || 1;
const FLUSH_INTERVAL = parseInt(process.env.FLUSH_INTERVAL || '30000') || 30000; // 30 seconds
const SLOW_THRESHOLD = parseInt(process.env.SLOW_THRESHOLD || '10000') || 10000; // 10 seconds in milliseconds
const MACHINE_ID = hostname();
const HAS_SERVICEBUS_CREDENTIALS = Boolean(
    process.env.AZURE_SERVICE_BUS_CONNECTION_STRING &&
    process.env.AZURE_SERVICE_BUS_QUEUE_NAME
);
const LOG_FILE = 'logs/application.log';

/**
 * Buffer Management
 * logBuffer: Array to store non-critical logs before sending to queue
 * flushTimeout: Reference to the setTimeout for periodic buffer flushing
 * isProcessing: Flag to prevent concurrent buffer processing
 */
let logBuffer: LogData[] = [];
let flushTimeout: NodeJS.Timeout;
let isProcessing = false;

/**
 * Winston logger configuration
 * Configures console transport with timestamp and JSON formatting
 * Console output is colorized for better readability
 */
const logger: Logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            )
        })
    ]
});

// Create logs directory if it doesn't exist
const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
}

/**
 * Sends accumulated logs to Azure Service Bus queue
 * @param {Array} logs - Array of log objects to be sent
 * Processes logs in batches of 10 for optimal throughput
 * Falls back to file logging if queue send fails
 */
async function sendLogsToQueue(logs: LogData[]) {
    // If service bus credentials are missing, write to file
    if (!HAS_SERVICEBUS_CREDENTIALS) {
        const fileLogger = createLogger({
            format: format.combine(
                format.timestamp(),
                format.json()
            ),
            transports: [
                new transports.File({ filename: LOG_FILE })
            ]
        });

        setImmediate(() => {
            logs.forEach(log => fileLogger.info(log));
        });

        return;
    }

    try {
        const batchSize = BATCH_SIZE;
        for (let i = 0; i < logs.length; i += batchSize) {
            const batch = logs.slice(i, i + batchSize);
            await Promise.all(batch.map(log => serviceBus.sendMessage(log)));
        }
    } catch (error) {
        logger.error('Error sending logs to queue:', error);
        const fileLogger = createLogger({
            transports: [
                new transports.File({ filename: 'logs/failed-queue.log' })
            ]
        });

        setImmediate(() => {
            logs.forEach(log => fileLogger.info(log));
        });
    }
}

/**
 * Flushes the log buffer to the queue
 * - Checks if buffer is already being processed
 * - Copies and clears buffer atomically
 * - Processes logs in background using setImmediate
 * - Reschedules next flush
 */
async function flushBuffer() {
    if (isProcessing || logBuffer.length === 0) {
        // Reschedule next flush even if we skip this one
        flushTimeout = setTimeout(flushBuffer, FLUSH_INTERVAL);
        return;
    }

    try {
        isProcessing = true;
        const logsToSend = [...logBuffer];
        logBuffer = [];

        await sendLogsToQueue(logsToSend);
    } catch (error) {
        logger.error('Error in flush buffer:', error);
    } finally {
        isProcessing = false;
        flushTimeout = setTimeout(flushBuffer, FLUSH_INTERVAL);
    }
}

// Update the LogData interface with more specific types
interface LogData {
    timestamp: string;
    method: string;
    url: string;
    ip: string;
    userAgent: string;
    queryParms: Record<string, unknown>; // Replace 'any' with a more specific type
    machineId: string;
    environment: string;
    logType: string;
    statusCode?: number;
    duration?: string;
    userId?: string | null;
    cacheStatus?: string;
    responseSize?: number;
    level: string;
    responseBody?: string;
    responseBodyError?: string;
    slowRequest?: boolean;
    warning?: string;
    errorStack?: string;
}

// Add type for response body
type ResponseBody = string | Buffer | object | null;

/**
 * Creates and returns the logging middleware
 * Initializes flush timer and sets up request/response logging
 * @returns {Function} Express middleware function
 */
const createLoggingMiddleware = () => {
    if (!HAS_SERVICEBUS_CREDENTIALS) {
        logger.warn('Service Bus credentials not found. Logging middleware disabled.');
        return (_req: Request, _res: Response, next: NextFunction): void => next();
    }

    flushTimeout = setTimeout(flushBuffer, FLUSH_INTERVAL);

    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const start = Date.now();
            const logData: LogData = {
                timestamp: new Date().toISOString(),
                method: req.method,
                url: req.originalUrl || req.url,
                ip: req.ip || req.connection.remoteAddress || '',
                userAgent: req.get('user-agent') || '',
                queryParms: req.query as Record<string, unknown>,
                machineId: MACHINE_ID,
                environment: process.env.NODE_ENV || 'NODE_ENV not set',
                logType: 'api',
                level: 'info'
            };

            const originalEnd = res.end.bind(res);
            const originalSend = res.send.bind(res);

            // Updated typedEnd function with correct overload signatures
            const typedEnd = function (
                this: Response,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                chunk?: any,
                encoding?: string | (() => void),
                callback?: () => void
            ): Response {
                // Handle different overload cases
                if (typeof encoding === 'function') {
                    callback = encoding;
                    encoding = undefined;
                }

                const result = originalEnd(chunk, encoding as BufferEncoding, callback);
                if (chunk) {
                    finalHandler(chunk as string);
                }
                return result;
            };

            const typedSend = function (this: Response, body: ResponseBody): Response {
                const result = originalSend(body);
                finalHandler(body);
                return result;
            };

            // Type assertion to match Express.Response.end signature
            res.end = typedEnd as typeof res.end;
            res.send = typedSend;

            const finalHandler = (body: ResponseBody): void => {
                const duration = Date.now() - start;

                logData.duration = duration.toString();
                logData.statusCode = res.statusCode;
                logData.slowRequest = duration > SLOW_THRESHOLD;

                if (res.statusCode >= 500) {
                    logData.level = 'error';
                    void sendLogsToQueue([logData]); // Send error log immediately
                    return;
                } else if (duration > SLOW_THRESHOLD) {
                    logData.level = 'warn';
                    void sendLogsToQueue([logData]); // Send slow request log immediately
                    return;
                } else {
                    logData.level = res.statusCode >= 400 ? 'warn' : 'info';
                }

                if (body) {
                    try {
                        if (Buffer.isBuffer(body)) {
                            logData.responseSize = body.length;
                        } else if (typeof body === 'string') {
                            logData.responseSize = Buffer.from(body).length;
                        } else {
                            logData.responseSize = Buffer.from(JSON.stringify(body)).length;
                        }
                    } catch {
                        logData.responseBodyError = 'Error processing response body';
                    }
                }

                logBuffer.push(logData);

                if (logBuffer.length >= BATCH_SIZE) {
                    void flushBuffer();
                }
            };

            res.on('close', () => {
                res.end = originalEnd;
                res.send = originalSend;
            });

            next();
        } catch (error) {
            logger.error('Error in logging middleware:', error);
            next();
        }
    };
};

/**
 * Cleanup handler for graceful shutdown
 * - Clears flush timeout
 * - Processes remaining logs
 * - Closes Service Bus connection
 */
const cleanup = async () => {
    if (!HAS_SERVICEBUS_CREDENTIALS) return;

    try {
        clearTimeout(flushTimeout);

        // Set a timeout for cleanup operations
        const cleanupTimeout = setTimeout(() => {
            logger.warn('Cleanup timeout reached, forcing exit');
            process.exit(1);
        }, 5000);

        await flushBuffer();
        await serviceBus.closeConnection();

        clearTimeout(cleanupTimeout);
    } catch (error) {
        logger.error('Error during cleanup:', error);
    }
};

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Export as ES modules
export {
    createLoggingMiddleware,
    cleanup
};
