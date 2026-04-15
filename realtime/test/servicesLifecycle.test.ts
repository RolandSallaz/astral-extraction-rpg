import assert from "assert";
import { KafkaPublisherService } from "../src/services/KafkaPublisher.js";
import { ContentSnapshotPoller } from "../src/rooms/services/ContentSnapshotPoller.js";
import {
  createRealtimeServices,
  setRealtimeServices,
  shutdownRealtimeServices,
} from "../src/services/runtimeServices.js";

describe("realtime service lifecycle", () => {
  it("clears the content snapshot poller interval on stop", () => {
    const originalFetch = globalThis.fetch;
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const intervalHandle = { id: "poller" } as unknown as ReturnType<typeof setInterval>;
    let clearedHandle: ReturnType<typeof setInterval> | null = null;

    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({ version: "content-v1" }),
      }) as any) as typeof fetch;
    globalThis.setInterval = (((_handler: unknown) => intervalHandle) as any) as typeof setInterval;
    globalThis.clearInterval = (((handle: ReturnType<typeof setInterval>) => {
      clearedHandle = handle;
    }) as any) as typeof clearInterval;

    try {
      const poller = new ContentSnapshotPoller();
      poller.start();
      poller.stop();

      assert.strictEqual(clearedHandle, intervalHandle);
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    }
  });

  it("shuts down the registered kafka publisher through the realtime service container", async () => {
    const publisher = new KafkaPublisherService();
    let disconnectCalls = 0;
    (publisher as any).producer = {
      disconnect: async () => {
        disconnectCalls += 1;
      },
    };

    const previousServices = setRealtimeServices(createRealtimeServices({ kafkaPublisher: publisher }));

    try {
      await shutdownRealtimeServices();
      assert.strictEqual(disconnectCalls, 1);
    } finally {
      setRealtimeServices(previousServices);
    }
  });

  it("waits for in-flight publishes before disconnecting the kafka producer", async () => {
    const publisher = new KafkaPublisherService();
    let releaseSend: (() => void) | null = null;
    let disconnectCalls = 0;
    let sendResolved = false;
    const producer = {
      send: async () =>
        await new Promise<void>((resolve) => {
          releaseSend = () => {
            sendResolved = true;
            resolve();
          };
        }),
      disconnect: async () => {
        assert.strictEqual(sendResolved, true);
        disconnectCalls += 1;
      },
    };
    (publisher as any).producer = producer;
    (publisher as any).getProducer = async () => producer;

    const publishPromise = publisher.publish("raid.run.updated", { raidRunId: "raid-1" });
    const shutdownPromise = publisher.shutdown();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.strictEqual(disconnectCalls, 0);
    assert.ok(releaseSend);
    releaseSend?.();

    await publishPromise;
    await shutdownPromise;
    assert.strictEqual(disconnectCalls, 1);
  });
});
