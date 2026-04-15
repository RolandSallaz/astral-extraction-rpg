import { KafkaPublisherService } from "./KafkaPublisher.js";

export type RealtimeServices = {
  kafkaPublisher: KafkaPublisherService;
};

export function createRealtimeServices(overrides: Partial<RealtimeServices> = {}): RealtimeServices {
  return {
    kafkaPublisher: overrides.kafkaPublisher ?? new KafkaPublisherService(),
  };
}

let realtimeServices: RealtimeServices | null = null;

export function getRealtimeServices(): RealtimeServices {
  if (!realtimeServices) {
    realtimeServices = createRealtimeServices();
  }
  return realtimeServices;
}

export function setRealtimeServices(next: RealtimeServices): RealtimeServices {
  const previous = getRealtimeServices();
  realtimeServices = next;
  return previous;
}

export async function shutdownRealtimeServices() {
  await getRealtimeServices().kafkaPublisher.shutdown();
}
