/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED,
  CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES,
  CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES,
} from "./attributeHrefExtractionStorage";
import { scanTextNodesForIocs, scanTextNodesForIocsWithProfile } from "./detector";
import { handleScanPageRequest } from "./scanPage";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const WEEK_10_SOC_FIXTURES = [
  "sample-alert.html",
  "sample-blog.html",
  "sample-splunk-export.html",
  "sample-security-onion-alert.html",
] as const;

const SOC_FIXTURES = [
  ...WEEK_10_SOC_FIXTURES,
  "sample-extended-ioc-alert.html",
] as const;

const WEEK_10_SOC_ATTRIBUTE_SCAN_EXPECTATIONS: Record<
  (typeof WEEK_10_SOC_FIXTURES)[number],
  { attributeNodesScanned: number; attributeCapReached: boolean }
> = {
  "sample-alert.html": { attributeNodesScanned: 2, attributeCapReached: false },
  "sample-blog.html": { attributeNodesScanned: 1, attributeCapReached: false },
  "sample-splunk-export.html": {
    attributeNodesScanned: 0,
    attributeCapReached: false,
  },
  "sample-security-onion-alert.html": {
    attributeNodesScanned: 1,
    attributeCapReached: false,
  },
};

function loadFixture(name: string): string {
  return readFileSync(join(repoRoot, "examples", name), "utf8");
}

function mountFixture(html: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.replaceChildren(wrapper);
  return wrapper;
}

function dedupedIocKeys(
  matches: ReadonlyArray<{ type: string; value: string }>
): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const match of matches) {
    const key = `${match.type}:${match.value}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    keys.push(key);
  }
  return keys.sort();
}

function stubChromeForScanPageTests(store: Record<string, unknown>): void {
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
            if (key in store) {
              result[key] = store[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
      },
    },
    runtime: {
      id: "test-extension-id",
      sendMessage: vi.fn(async () => ({ ok: true })),
    },
  });
}

describe("visible-text regression when attribute extraction is off", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeForScanPageTests(store);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://example.com/alert",
        hostname: "example.com",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(SOC_FIXTURES)(
    "%s page scan matches visible-text deduped IOC keys",
    async (fixtureName) => {
      mountFixture(loadFixture(fixtureName));
      const textMatches = scanTextNodesForIocs(document.body);
      const textProfile = scanTextNodesForIocsWithProfile(document.body).profile;
      const expectedKeys = dedupedIocKeys(textMatches);

      const response = await handleScanPageRequest(document.body);
      expect(response.ok).toBe(true);
      const payload = (response as { payload: {
        count: number;
        profile: Record<string, unknown>;
        snapshot: { entries: Array<{ type: string; value: string }> };
      } }).payload;

      expect(dedupedIocKeys(payload.snapshot.entries)).toEqual(expectedKeys);
      expect(payload.count).toBe(expectedKeys.length);
      expect(payload.profile.attributeNodesScanned).toBeUndefined();
      expect(payload.profile.attributeNodeCap).toBeUndefined();
      expect(payload.profile.attributeCapReached).toBeUndefined();
      expect(payload.profile.textNodesScanned).toBe(textProfile.textNodesScanned);
      expect(payload.profile.textNodeCap).toBe(textProfile.textNodeCap);
      expect(payload.profile.capReached).toBe(textProfile.capReached);
      expect(payload.profile.iocCapReached).toBe(textProfile.iocCapReached);
    }
  );

  it("ignores attribute-only href IOCs when extraction is disabled", async () => {
    mountPage(`
      <p>Visible 8.8.8.8</p>
      <a href="https://attribute-only.example.com/path">benign label</a>
      <img src="https://attribute-only.example.com/logo.png" alt="logo" />
    `);

    const textMatches = scanTextNodesForIocs(document.body);
    expect(dedupedIocKeys(textMatches)).toEqual(["ipv4:8.8.8.8"]);

    const response = await handleScanPageRequest(document.body);
    const payload = (response as { payload: {
      count: number;
      snapshot: { entries: Array<{ type: string; value: string; ruleId?: string }> };
    } }).payload;

    expect(payload.count).toBe(1);
    expect(dedupedIocKeys(payload.snapshot.entries)).toEqual(["ipv4:8.8.8.8"]);
    expect(
      payload.snapshot.entries.some(
        (entry) => entry.ruleId === "ioc.attribute.allowlisted"
      )
    ).toBe(false);
  });

  it("sample-malicious-attribute-iocs.html stays empty on page scan", async () => {
    mountFixture(loadFixture("sample-malicious-attribute-iocs.html"));
    const textMatches = scanTextNodesForIocs(document.body);
    expect(textMatches).toEqual([]);

    const response = await handleScanPageRequest(document.body);
    const payload = (response as { payload: { count: number } }).payload;
    expect(payload.count).toBe(0);
  });

  it("does not honor per-site on preference when global attribute scan is off", async () => {
    store[CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED] = false;
    store[CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES] =
      true;
    store[CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES] = {
      "example.com": "on",
    };

    mountPage(
      `<p>no visible ioc</p><a href="https://attribute-only.example.com/path">label</a>`
    );

    const response = await handleScanPageRequest(document.body);
    const payload = (response as { payload: { count: number; profile: Record<string, unknown> } })
      .payload;
    expect(payload.count).toBe(0);
    expect(payload.profile.attributeNodesScanned).toBeUndefined();
  });
});

describe("Week 10 SOC fixtures with attribute extraction disabled", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeForScanPageTests(store);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://example.com/alert",
        hostname: "example.com",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(WEEK_10_SOC_FIXTURES)(
    "%s page scan matches fixtureTuning visible-text baseline",
    async (fixtureName) => {
      mountFixture(loadFixture(fixtureName));
      const textMatches = scanTextNodesForIocs(document.body);
      const expectedKeys = dedupedIocKeys(textMatches);

      const response = await handleScanPageRequest(document.body);
      expect(response.ok).toBe(true);
      const payload = (response as {
        payload: {
          count: number;
          profile: Record<string, unknown>;
          snapshot: { entries: Array<{ type: string; value: string }> };
        };
      }).payload;

      expect(dedupedIocKeys(payload.snapshot.entries)).toEqual(expectedKeys);
      expect(payload.count).toBe(expectedKeys.length);
      expect(payload.profile.attributeNodesScanned).toBeUndefined();
    }
  );
});

describe("Week 10 SOC fixtures with attribute extraction enabled", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {
      [CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED]: true,
    };
    stubChromeForScanPageTests(store);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://example.com/alert",
        hostname: "example.com",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(WEEK_10_SOC_FIXTURES)(
    "%s keeps deduped IOC set identical to visible-text-only scan",
    async (fixtureName) => {
      mountFixture(loadFixture(fixtureName));
      const textMatches = scanTextNodesForIocs(document.body);
      const expectedKeys = dedupedIocKeys(textMatches);
      const expectation = WEEK_10_SOC_ATTRIBUTE_SCAN_EXPECTATIONS[fixtureName];

      const response = await handleScanPageRequest(document.body);
      expect(response.ok).toBe(true);
      const payload = (response as {
        payload: {
          count: number;
          profile: {
            attributeNodesScanned?: number;
            attributeNodeCap?: number;
            attributeCapReached?: boolean;
          };
          snapshot: {
            entries: Array<{ type: string; value: string; ruleId?: string }>;
          };
        };
      }).payload;

      expect(dedupedIocKeys(payload.snapshot.entries)).toEqual(expectedKeys);
      expect(payload.count).toBe(expectedKeys.length);
      expect(payload.profile.attributeNodesScanned).toBe(
        expectation.attributeNodesScanned
      );
      expect(payload.profile.attributeCapReached).toBe(
        expectation.attributeCapReached
      );
      expect(payload.profile.attributeNodeCap).toEqual(expect.any(Number));
      expect(
        payload.snapshot.entries.some(
          (entry) => entry.ruleId === "ioc.attribute.allowlisted"
        )
      ).toBe(false);
    }
  );
});

function mountPage(html: string): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}
