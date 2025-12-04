const { EventHubProducerClient } = require("@azure/event-hubs");

// Log data to event hub with topic
exports.logData = async (eventData) => {
  if (!process.env.EVENT_HUB_CONNECTION_STRING || !process.env.EVENT_HUB_NAME) {
    console.log("Event hub credentials are missing");
    return;
  }
  const producer = new EventHubProducerClient(
    process.env.EVENT_HUB_CONNECTION_STRING,
    process.env.EVENT_HUB_NAME
  );
  //handelling the error if the producer is not created
  if (!producer) {
    throw new Error("Failed to create producer");
  }
  if (!eventData) {
    throw new Error("Event data is missing");
  }
  try {
    const batch = await producer.createBatch();
    batch.tryAdd({ body: JSON.stringify(eventData) });
    producer.sendBatch(batch);
  } catch (error) {
    console.log("Error occurred while sending data to event hub", error);
  } finally {
    //closing the producer and producer client
    await producer.close();
  }
};
