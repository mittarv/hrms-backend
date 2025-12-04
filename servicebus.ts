import { ServiceBusClient, ServiceBusSender } from "@azure/service-bus";
import dotenv from 'dotenv';

dotenv.config();

/**
 * Azure Service Bus Configuration
 * Loads connection string and queue name from environment variables
 */
const connectionString: string = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING || '';
const queueName: string = process.env.AZURE_SERVICE_BUS_QUEUE_NAME || '';

/**
 * Service Bus Client instances
 * serviceBusClient: Main client for Azure Service Bus connection
 * sender: Queue sender instance for message publishing
 */
let serviceBusClient: ServiceBusClient;
let sender: ServiceBusSender;

/**
 * Initializes the Azure Service Bus connection
 * Creates client and sender instances if environment variables are present
 * @throws {Error} If connection initialization fails
 */
const initializeServiceBus = async (): Promise<void> => {
    if (!connectionString || !queueName) {
        console.log('Service Bus initialization skipped - missing environment variables');
        return;
    }

    try {
        serviceBusClient = new ServiceBusClient(connectionString);
        sender = serviceBusClient.createSender(queueName);
        console.log('Service Bus initialized successfully');
    } catch (error) {
        console.error('Error initializing Service Bus:', error);
    }
};

/**
 * Interface for chunked message structure
 */
interface ChunkedMessage {
    chunk: string;
    sequence: number;
    total: number;
    originalMessage: boolean;
}

/**
 * Sends a message to the Azure Service Bus queue
 * Handles message size limits by splitting large messages into chunks
 * @param {unknown} message - Message object to be sent
 * @throws {Error} If sending fails
 */
const sendMessage = async (message: unknown): Promise<void> => {
    if (!sender) {
        console.log('Message sending skipped - Service Bus not initialized');
        return;
    }

    try {
        // Check if message size exceeds limit
        const messageSize = Buffer.from(JSON.stringify(message)).length;
        if (messageSize > 256 * 1024) { // 256KB limit for Service Bus messages
            console.warn('Message size exceeds limit, splitting into chunks');
            
            // Split message into chunks
            const messageStr = JSON.stringify(message);
            const chunkSize = 250 * 1024; // Leave some buffer
            const chunks: string[] = [];
            
            for (let i = 0; i < messageStr.length; i += chunkSize) {
                chunks.push(messageStr.slice(i, i + chunkSize));
            }
            
            // Send chunks in parallel using Promise.all
            await Promise.all(chunks.map((chunk, index) => 
                sender.sendMessages({
                    body: {
                        chunk,
                        sequence: index + 1,
                        total: chunks.length,
                        originalMessage: true
                    } as ChunkedMessage
                })
            ));
        } else {
            await sender.sendMessages({ body: message });
        }
    } catch (error) {
        console.error('Error sending message:', error);
        //throwing because we want to fail and will be caught in the parent function
        throw error;
    }
};

/**
 * Closes the Service Bus connection
 * Properly closes both sender and client instances
 * @throws {Error} If closing connection fails
 */
const closeConnection = async (): Promise<void> => {
    try {
        await sender?.close();
        await serviceBusClient?.close();
        console.log('Service Bus connection closed');
    } catch (error) {
        console.error('Error closing Service Bus connection:', error);
    }
};

export {
    initializeServiceBus,
    sendMessage,
    closeConnection
}; 