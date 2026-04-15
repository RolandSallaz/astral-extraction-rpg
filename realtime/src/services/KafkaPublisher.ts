import { Kafka, logLevel, type Producer } from "kafkajs";

const DEFAULT_BROKERS = "kafka:9092";
const DEFAULT_CLIENT_ID = "mmorpg-realtime";

type KafkaPublisherServiceOptions = {
  brokers?: string[];
  clientId?: string;
  retryDelayMs?: number;
  disconnectedRetryDelayMs?: number;
};

export class KafkaPublisherService {
  private producer: Producer | null = null;
  private producerPromise: Promise<Producer> | null = null;
  private readonly inFlightPublishes = new Set<Promise<void>>();
  private retryAfter = 0;
  private isShuttingDown = false;
  private readonly brokers: string[];
  private readonly clientId: string;
  private readonly retryDelayMs: number;
  private readonly disconnectedRetryDelayMs: number;

  constructor(options: KafkaPublisherServiceOptions = {}) {
    this.brokers = options.brokers?.length
      ? options.brokers
      : (process.env.KAFKA_BROKERS ?? DEFAULT_BROKERS)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
    this.clientId = options.clientId ?? process.env.KAFKA_CLIENT_ID ?? DEFAULT_CLIENT_ID;
    this.retryDelayMs = options.retryDelayMs ?? 30_000;
    this.disconnectedRetryDelayMs = options.disconnectedRetryDelayMs ?? 5_000;
  }

  async publish(topic: string, payload: unknown) {
    let publishTask: Promise<void>;
    publishTask = this.publishInternal(topic, payload).finally(() => {
      this.inFlightPublishes.delete(publishTask);
    });
    this.inFlightPublishes.add(publishTask);
    await publishTask;
  }

  async flush() {
    if (this.inFlightPublishes.size === 0) {
      return;
    }

    await Promise.allSettled(Array.from(this.inFlightPublishes));
  }

  async shutdown() {
    this.isShuttingDown = true;
    await this.flush();

    if (!this.producer && this.producerPromise) {
      try {
        await this.producerPromise;
      } catch {
        // Connection failures are already logged in getProducer().
      }
    }

    const producer = this.producer;
    this.resetProducer();

    if (!producer) {
      return;
    }

    try {
      await producer.disconnect();
    } catch (error) {
      console.error("[kafka] Failed to disconnect producer", error);
    }
  }

  private async publishInternal(topic: string, payload: unknown) {
    if (this.isShuttingDown) {
      return;
    }

    try {
      const producer = await this.getProducer();
      if (!producer) {
        return;
      }

      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }],
      });
    } catch (error) {
      if (error instanceof Error && /disconnected/i.test(error.message)) {
        this.retryAfter = Date.now() + this.disconnectedRetryDelayMs;
        this.resetProducer();
        return;
      }

      console.error(`[kafka] Failed to publish ${topic}`, error);
    }
  }

  private async getProducer() {
    if (this.isShuttingDown || Date.now() < this.retryAfter) {
      return null;
    }

    if (this.producer) {
      return this.producer;
    }

    if (!this.producerPromise) {
      const kafka = new Kafka({
        clientId: this.clientId,
        brokers: this.brokers.length > 0 ? this.brokers : [DEFAULT_BROKERS],
        logLevel: logLevel.NOTHING,
      });
      const producer = kafka.producer();
      this.producer = producer;
      this.producerPromise = producer.connect().then(() => {
        this.retryAfter = 0;
        return producer;
      });
      this.producerPromise.catch((error) => {
        this.retryAfter = Date.now() + this.retryDelayMs;
        console.error("[kafka] Failed to connect producer", error);
        this.resetProducer();
      });
    }

    return this.producerPromise;
  }

  private resetProducer() {
    this.producer = null;
    this.producerPromise = null;
  }
}
