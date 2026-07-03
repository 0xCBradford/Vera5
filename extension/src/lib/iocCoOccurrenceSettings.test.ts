import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE,
  DEFAULT_IOC_CO_OCCURRENCE_MAX_MEMBERS_FOR_COMPUTATION,
  DEFAULT_IOC_CO_OCCURRENCE_MAX_PAIRS_PER_PAGE,
  DEFAULT_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE,
  DEFAULT_IOC_CO_OCCURRENCE_SKIP_RECOMPUTE_PAGE_IOC_COUNT_THRESHOLD,
} from "./iocCoOccurrence";
import {
  getIocCoOccurrenceLimits,
  IOC_CO_OCCURRENCE_LIMITS_SCHEMA_VERSION,
  setIocCoOccurrenceLimits,
  STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS,
} from "./iocCoOccurrenceSettings";

function stubChromeStorage(localStore: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : Object.keys(keys);
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key in localStore) {
              result[key] = localStore[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(localStore, items);
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete localStore[key];
          }
          return Promise.resolve();
        },
      },
    },
  });
}

describe("iocCoOccurrenceSettings", () => {
  let localStore: Record<string, unknown>;

  beforeEach(() => {
    localStore = {};
    stubChromeStorage(localStore);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns defaults when no limits are stored", async () => {
    await expect(getIocCoOccurrenceLimits()).resolves.toEqual({
      minGroupSize: DEFAULT_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE,
      maxGroupsPerPage: DEFAULT_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE,
      maxMembersForComputation: DEFAULT_IOC_CO_OCCURRENCE_MAX_MEMBERS_FOR_COMPUTATION,
      maxPairsPerPage: DEFAULT_IOC_CO_OCCURRENCE_MAX_PAIRS_PER_PAGE,
      skipRecomputePageIocCountThreshold:
        DEFAULT_IOC_CO_OCCURRENCE_SKIP_RECOMPUTE_PAGE_IOC_COUNT_THRESHOLD,
    });
  });

  it("persists configured limits in chrome.storage.local", async () => {
    await setIocCoOccurrenceLimits({
      minGroupSize: 4,
      maxGroupsPerPage: 2,
    });

    expect(localStore[STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS]).toEqual({
      schemaVersion: IOC_CO_OCCURRENCE_LIMITS_SCHEMA_VERSION,
      minGroupSize: 4,
      maxGroupsPerPage: 2,
      maxMembersForComputation: DEFAULT_IOC_CO_OCCURRENCE_MAX_MEMBERS_FOR_COMPUTATION,
      maxPairsPerPage: DEFAULT_IOC_CO_OCCURRENCE_MAX_PAIRS_PER_PAGE,
      skipRecomputePageIocCountThreshold:
        DEFAULT_IOC_CO_OCCURRENCE_SKIP_RECOMPUTE_PAGE_IOC_COUNT_THRESHOLD,
    });
    await expect(getIocCoOccurrenceLimits()).resolves.toEqual({
      minGroupSize: 4,
      maxGroupsPerPage: 2,
      maxMembersForComputation: DEFAULT_IOC_CO_OCCURRENCE_MAX_MEMBERS_FOR_COMPUTATION,
      maxPairsPerPage: DEFAULT_IOC_CO_OCCURRENCE_MAX_PAIRS_PER_PAGE,
      skipRecomputePageIocCountThreshold:
        DEFAULT_IOC_CO_OCCURRENCE_SKIP_RECOMPUTE_PAGE_IOC_COUNT_THRESHOLD,
    });
  });

  it("clamps invalid stored values to supported bounds", async () => {
    localStore[STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS] = {
      schemaVersion: IOC_CO_OCCURRENCE_LIMITS_SCHEMA_VERSION,
      minGroupSize: 1,
      maxGroupsPerPage: 999,
    };

    await expect(getIocCoOccurrenceLimits()).resolves.toEqual({
      minGroupSize: DEFAULT_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE,
      maxGroupsPerPage: 64,
      maxMembersForComputation: DEFAULT_IOC_CO_OCCURRENCE_MAX_MEMBERS_FOR_COMPUTATION,
      maxPairsPerPage: DEFAULT_IOC_CO_OCCURRENCE_MAX_PAIRS_PER_PAGE,
      skipRecomputePageIocCountThreshold:
        DEFAULT_IOC_CO_OCCURRENCE_SKIP_RECOMPUTE_PAGE_IOC_COUNT_THRESHOLD,
    });
  });

  it("removes storage when limits are reset to defaults", async () => {
    await setIocCoOccurrenceLimits({ minGroupSize: 5, maxGroupsPerPage: 3 });
    await setIocCoOccurrenceLimits({
      minGroupSize: DEFAULT_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE,
      maxGroupsPerPage: DEFAULT_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE,
    });

    expect(localStore[STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS]).toBeUndefined();
  });
});
