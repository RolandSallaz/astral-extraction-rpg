import { Kafka, logLevel, type Producer } from "kafkajs";

const DEFAULT_BROKERS = "kafka:9092";
const brokers = (process.env.KAFKA_BROKERS ?? DEFAULT_BROKERS)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const clientId = process.env.KAFKA_CLIENT_ID ?? "mmorpg-realtime";

let producer: Producer | null = null;
let producerPromise: Promise<Producer> | null = null;

async function getProducer() {
  if (producer) {
    return producer;
  }

  if (!producerPromise) {
    const kafka = new Kafka({
      clientId,
      brokers: brokers.length > 0 ? brokers : [DEFAULT_BROKERS],
      logLevel: logLevel.NOTHING,
    });
    producer = kafka.producer();
    producerPromise = producer.connect().then(() => producer as Producer);
    producerPromise.catch((error) => {
      console.error("[kafka] Failed to connect producer", error);
      producer = null;
      producerPromise = null;
    });
  }

  return producerPromise;
}

export async function publishKafkaEvent(topic: string, payload: unknown) {
  try {
    const kafkaProducer = await getProducer();
    if (!kafkaProducer) {
      return;
    }
    await kafkaProducer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
  } catch (error) {
    console.error(`[kafka] Failed to publish ${topic}`, error);
  }
}

export async function shutdownKafkaProducer() {
  if (!producer) {
    return;
  }

  try {
    await producer.disconnect();
  } catch (error) {
    console.error("[kafka] Failed to disconnect producer", error);
  } finally {
    producer = null;
    producerPromise = null;
  }
}
