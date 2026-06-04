import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelTrayEnrichQueue,
  getTrayEnrichQueueSnapshot,
  isTrayEnrichQueueRunning,
  resetTrayEnrichQueueForTests,
  runSequentialTrayEnrichQueue,
} from "./trayEnrichQueue";

describe("runSequentialTrayEnrichQueue", () => {
  afterEach(() => {
    resetTrayEnrichQueueForTests();
  });

  it("enriches anchors sequentially in order", async () => {
    const order: string[] = [];
    const enrichAnchor = vi.fn(async (anchorId: string) => {
      order.push(anchorId);
    });

    const result = await runSequentialTrayEnrichQueue(
      ["a-1", "a-2", "a-3"],
      enrichAnchor
    );

    expect(order).toEqual(["a-1", "a-2", "a-3"]);
    expect(enrichAnchor).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ completedCount: 3, cancelled: false });
    expect(isTrayEnrichQueueRunning()).toBe(false);
  });

  it("stops after the current item when cancel is requested", async () => {
    const enrichAnchor = vi.fn(async (anchorId: string) => {
      if (anchorId === "a-2") {
        cancelTrayEnrichQueue();
      }
    });

    const result = await runSequentialTrayEnrichQueue(
      ["a-1", "a-2", "a-3"],
      enrichAnchor
    );

    expect(enrichAnchor).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ completedCount: 2, cancelled: true });
  });

  it("reports progress snapshots while running", async () => {
    const snapshots: Array<string | null> = [];
    const enrichAnchor = vi.fn(async () => undefined);

    await runSequentialTrayEnrichQueue(["a-1", "a-2"], enrichAnchor, (snapshot) => {
      snapshots.push(snapshot.currentAnchorId);
    });

    expect(snapshots).toEqual([null, "a-1", "a-2"]);
    expect(getTrayEnrichQueueSnapshot()).toBeNull();
  });

  it("returns immediately when anchor list is empty", async () => {
    const enrichAnchor = vi.fn(async () => undefined);
    const result = await runSequentialTrayEnrichQueue([], enrichAnchor);

    expect(result).toEqual({ completedCount: 0, cancelled: false });
    expect(enrichAnchor).not.toHaveBeenCalled();
  });
});
