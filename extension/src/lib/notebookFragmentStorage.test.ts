import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTEBOOK_FRAGMENT_TYPE,
  buildNotebookFragmentIocKey,
  buildNotebookFragmentPageScopeKey,
  buildNotebookFragmentPageScopeKeyFromPageUrl,
  createNotebookFragment,
  normalizeNotebookFragmentIocKey,
  normalizeNotebookFragmentPageScopeKey,
  normalizeNotebookFragmentSessionId,
} from "./notebookFragment";
import { INVESTIGATION_SESSION_ID_PREFIX } from "./investigationSession";
import { IOC_TYPE } from "./iocRegex";
import {
  NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
  STORAGE_KEY_NOTEBOOK_FRAGMENTS,
  attachStoredNotebookFragmentToIoc,
  attachStoredNotebookFragmentToPage,
  attachStoredNotebookFragmentToSession,
  clearStoredNotebookFragments,
  deleteStoredNotebookFragment,
  detachStoredNotebookFragmentFromIoc,
  detachStoredNotebookFragmentFromPage,
  detachStoredNotebookFragmentFromSession,
  getNotebookFragmentsStore,
  getStoredNotebookFragment,
  hydrateNotebookFragmentsStore,
  listStoredNotebookFragmentIocKeys,
  listStoredNotebookFragmentPageScopeKeys,
  listStoredNotebookFragmentSessionIds,
  listStoredNotebookFragments,
  listStoredNotebookFragmentsForIoc,
  listStoredNotebookFragmentsForPage,
  listStoredNotebookFragmentsForSession,
  normalizeNotebookFragmentsStore,
  replaceStoredNotebookFragments,
  updateStoredNotebookFragment,
  upsertStoredNotebookFragment,
} from "./notebookFragmentStorage";

function stubChromeStorage(store: Record<string, unknown>): void {
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
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete store[key];
          }
          return Promise.resolve();
        },
      },
    },
  });
}

describe("notebookFragmentStorage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(async () => {
    await clearStoredNotebookFragments();
    vi.unstubAllGlobals();
  });

  it("persists fragments only in chrome.storage.local under notebookFragments with schemaVersion", async () => {
    const fragment = createNotebookFragment({
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "Seen C2 beacon in proxy logs.",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    });

    await upsertStoredNotebookFragment(fragment);

    expect(store[STORAGE_KEY_NOTEBOOK_FRAGMENTS]).toMatchObject({
      schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
      fragments: [
        expect.objectContaining({
          id: fragment.id,
          type: "observation",
          body: "Seen C2 beacon in proxy logs.",
        }),
      ],
      iocAttachments: {},
      sessionAttachments: {},
      pageAttachments: {},
    });
    expect(
      typeof (store[STORAGE_KEY_NOTEBOOK_FRAGMENTS] as { updatedAt: number })
        .updatedAt
    ).toBe("number");
    expect(await listStoredNotebookFragments()).toEqual([
      expect.objectContaining({ id: fragment.id }),
    ]);
  });

  it("upserts by id without duplicating", async () => {
    const fragment = createNotebookFragment({
      id: "nf-upsert",
      type: NOTEBOOK_FRAGMENT_TYPE.TAG,
      body: "phishing",
      createdAt: 10,
      updatedAt: 10,
    });
    await upsertStoredNotebookFragment(fragment);
    await upsertStoredNotebookFragment({
      ...fragment,
      body: "spearphishing",
      updatedAt: 20,
    });

    const listed = await listStoredNotebookFragments();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.body).toBe("spearphishing");
    expect(listed[0]?.updatedAt).toBe(20);
  });

  it("updates, deletes, and clears stored fragments", async () => {
    const fragment = createNotebookFragment({
      id: "nf-manage",
      type: NOTEBOOK_FRAGMENT_TYPE.CONCLUSION,
      body: "Host is compromised.",
      authorLabel: "Local",
      createdAt: 5,
      updatedAt: 5,
    });
    await upsertStoredNotebookFragment(fragment);

    await updateStoredNotebookFragment({
      ...fragment,
      body: "Host remains compromised.",
      updatedAt: 15,
    });
    expect(await getStoredNotebookFragment("nf-manage")).toEqual(
      expect.objectContaining({
        id: "nf-manage",
        body: "Host remains compromised.",
        updatedAt: 15,
      })
    );

    expect(await deleteStoredNotebookFragment("nf-manage")).toBe(true);
    expect(await listStoredNotebookFragments()).toEqual([]);
    expect(await deleteStoredNotebookFragment("nf-manage")).toBe(false);

    await upsertStoredNotebookFragment(fragment);
    await clearStoredNotebookFragments();
    expect(await getNotebookFragmentsStore()).toMatchObject({
      schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
      fragments: [],
      iocAttachments: {},
      sessionAttachments: {},
      pageAttachments: {},
    });
    expect(store[STORAGE_KEY_NOTEBOOK_FRAGMENTS]).toBeUndefined();
  });

  it("rejects invalid versions and invalid fragment payloads on normalize", () => {
    expect(
      normalizeNotebookFragmentsStore({
        schemaVersion: 99,
        updatedAt: 1,
        fragments: [],
      })
    ).toMatchObject({
      schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
      fragments: [],
      iocAttachments: {},
      sessionAttachments: {},
      pageAttachments: {},
    });

    expect(
      normalizeNotebookFragmentsStore({
        schemaVersion: 4,
        updatedAt: 1,
        fragments: [
          {
            id: "nf-ok",
            type: "hypothesis",
            body: "Working theory.",
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "nf-bad",
            type: "hypothesis",
            body: "data:image/png;base64,AAAA",
            createdAt: 1,
            updatedAt: 1,
          },
          { not: "a fragment" },
        ],
        iocAttachments: {
          "ipv4:8.8.8.8": ["nf-ok", "nf-missing"],
          "not-a-key": ["nf-ok"],
        },
        sessionAttachments: {
          [`${INVESTIGATION_SESSION_ID_PREFIX}abc`]: ["nf-ok", "nf-missing"],
          "bad-session": ["nf-ok"],
        },
        pageAttachments: {
          "https://example.com/alerts": ["nf-ok", "nf-missing"],
          "ftp://bad.example": ["nf-ok"],
        },
      })
    ).toMatchObject({
      fragments: [
        expect.objectContaining({
          id: "nf-ok",
          type: "hypothesis",
          body: "Working theory.",
        }),
      ],
      iocAttachments: {
        "ipv4:8.8.8.8": ["nf-ok"],
      },
      sessionAttachments: {
        [`${INVESTIGATION_SESSION_ID_PREFIX}abc`]: ["nf-ok"],
      },
      pageAttachments: {
        "https://example.com/alerts": ["nf-ok"],
      },
    });
  });

  it("migrates v1–v3 stores to v4 with pageAttachments", () => {
    expect(
      normalizeNotebookFragmentsStore({
        schemaVersion: 1,
        updatedAt: 1,
        fragments: [
          {
            id: "nf-legacy",
            type: "observation",
            body: "Legacy note.",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      })
    ).toMatchObject({
      schemaVersion: 4,
      fragments: [expect.objectContaining({ id: "nf-legacy" })],
      iocAttachments: {},
      sessionAttachments: {},
      pageAttachments: {},
    });

    expect(
      normalizeNotebookFragmentsStore({
        schemaVersion: 2,
        updatedAt: 1,
        fragments: [
          {
            id: "nf-v2",
            type: "tag",
            body: "tag",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        iocAttachments: {
          "ipv4:1.1.1.1": ["nf-v2"],
        },
      })
    ).toMatchObject({
      schemaVersion: 4,
      iocAttachments: { "ipv4:1.1.1.1": ["nf-v2"] },
      sessionAttachments: {},
      pageAttachments: {},
    });

    expect(
      normalizeNotebookFragmentsStore({
        schemaVersion: 3,
        updatedAt: 1,
        fragments: [
          {
            id: "nf-v3",
            type: "observation",
            body: "v3",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        iocAttachments: {},
        sessionAttachments: {
          [`${INVESTIGATION_SESSION_ID_PREFIX}s1`]: ["nf-v3"],
        },
      })
    ).toMatchObject({
      schemaVersion: 4,
      sessionAttachments: {
        [`${INVESTIGATION_SESSION_ID_PREFIX}s1`]: ["nf-v3"],
      },
      pageAttachments: {},
    });
  });

  it("hydrates and replaces the versioned store without secrets fields", async () => {
    const a = createNotebookFragment({
      id: "nf-a",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "A",
      createdAt: 1,
      updatedAt: 1,
    });
    const b = createNotebookFragment({
      id: "nf-b",
      type: NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS,
      body: "B",
      createdAt: 2,
      updatedAt: 2,
    });

    await hydrateNotebookFragmentsStore({
      schemaVersion: 4,
      updatedAt: 100,
      fragments: [b, a],
      iocAttachments: {
        "ipv4:1.1.1.1": ["nf-a"],
      },
      sessionAttachments: {
        [`${INVESTIGATION_SESSION_ID_PREFIX}sess-1`]: ["nf-b"],
      },
      pageAttachments: {
        "https://example.com/alerts": ["nf-a"],
      },
      apiKey: "should-not-persist",
    });

    const hydrated = store[STORAGE_KEY_NOTEBOOK_FRAGMENTS] as {
      schemaVersion: number;
      fragments: unknown[];
      iocAttachments: Record<string, string[]>;
      sessionAttachments: Record<string, string[]>;
      pageAttachments: Record<string, string[]>;
      apiKey?: string;
    };
    expect(hydrated.schemaVersion).toBe(4);
    expect(hydrated.apiKey).toBeUndefined();
    expect(hydrated.iocAttachments).toEqual({ "ipv4:1.1.1.1": ["nf-a"] });
    expect(hydrated.sessionAttachments).toEqual({
      [`${INVESTIGATION_SESSION_ID_PREFIX}sess-1`]: ["nf-b"],
    });
    expect(hydrated.pageAttachments).toEqual({
      "https://example.com/alerts": ["nf-a"],
    });
    expect(await listStoredNotebookFragments()).toEqual([
      expect.objectContaining({ id: "nf-a" }),
      expect.objectContaining({ id: "nf-b" }),
    ]);

    await replaceStoredNotebookFragments([a]);
    expect(await listStoredNotebookFragments()).toEqual([
      expect.objectContaining({ id: "nf-a", body: "A" }),
    ]);
    expect(await getNotebookFragmentsStore()).toMatchObject({
      iocAttachments: {},
      sessionAttachments: {},
      pageAttachments: {},
    });
  });

  it("attaches fragments to IOC keys built from normalized value + type", async () => {
    expect(buildNotebookFragmentIocKey(IOC_TYPE.IPV4, " 8.8.8.8 ")).toBe(
      "ipv4:8.8.8.8"
    );
    expect(normalizeNotebookFragmentIocKey("domain: Example.COM ")).toBe(
      "domain:Example.COM"
    );
    expect(normalizeNotebookFragmentIocKey("nope")).toBeNull();

    const fragment = createNotebookFragment({
      id: "nf-ioc",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "Beacon to this IP.",
      createdAt: 1,
      updatedAt: 1,
    });
    await upsertStoredNotebookFragment(fragment);

    const iocKey = await attachStoredNotebookFragmentToIoc({
      fragmentId: fragment.id,
      iocType: IOC_TYPE.IPV4,
      value: " 8.8.8.8 ",
    });
    expect(iocKey).toBe("ipv4:8.8.8.8");

    await attachStoredNotebookFragmentToIoc({
      fragmentId: fragment.id,
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
    });

    expect(
      await listStoredNotebookFragmentsForIoc(IOC_TYPE.IPV4, "8.8.8.8")
    ).toEqual([expect.objectContaining({ id: "nf-ioc" })]);
    expect(await listStoredNotebookFragmentIocKeys("nf-ioc")).toEqual([
      "ipv4:8.8.8.8",
    ]);
    expect(
      await listStoredNotebookFragmentsForIoc(IOC_TYPE.DOMAIN, "example.com")
    ).toEqual([]);

    expect(
      (store[STORAGE_KEY_NOTEBOOK_FRAGMENTS] as { iocAttachments: unknown })
        .iocAttachments
    ).toEqual({
      "ipv4:8.8.8.8": ["nf-ioc"],
    });

    expect(
      await detachStoredNotebookFragmentFromIoc({
        fragmentId: fragment.id,
        iocType: IOC_TYPE.IPV4,
        value: "8.8.8.8",
      })
    ).toBe(true);
    expect(
      await listStoredNotebookFragmentsForIoc(IOC_TYPE.IPV4, "8.8.8.8")
    ).toEqual([]);

    await attachStoredNotebookFragmentToIoc({
      fragmentId: fragment.id,
      iocType: IOC_TYPE.DOMAIN,
      value: "evil.example",
    });
    expect(await deleteStoredNotebookFragment(fragment.id)).toBe(true);
    expect(await listStoredNotebookFragmentIocKeys("nf-ioc")).toEqual([]);
    expect(await getNotebookFragmentsStore()).toMatchObject({
      fragments: [],
      iocAttachments: {},
      sessionAttachments: {},
      pageAttachments: {},
    });
  });

  it("attaches fragments to investigation session ids", async () => {
    const sessionId = `${INVESTIGATION_SESSION_ID_PREFIX}case-42`;
    expect(normalizeNotebookFragmentSessionId(`  ${sessionId}  `)).toBe(
      sessionId
    );
    expect(normalizeNotebookFragmentSessionId("not-a-session")).toBeNull();
    expect(
      normalizeNotebookFragmentSessionId(INVESTIGATION_SESSION_ID_PREFIX)
    ).toBeNull();

    const fragment = createNotebookFragment({
      id: "nf-session",
      type: NOTEBOOK_FRAGMENT_TYPE.CONCLUSION,
      body: "Session-level finding.",
      createdAt: 1,
      updatedAt: 1,
    });
    await upsertStoredNotebookFragment(fragment);

    const attached = await attachStoredNotebookFragmentToSession({
      fragmentId: fragment.id,
      sessionId: `  ${sessionId}  `,
    });
    expect(attached).toBe(sessionId);

    await attachStoredNotebookFragmentToSession({
      fragmentId: fragment.id,
      sessionId,
    });

    expect(await listStoredNotebookFragmentsForSession(sessionId)).toEqual([
      expect.objectContaining({ id: "nf-session" }),
    ]);
    expect(await listStoredNotebookFragmentSessionIds("nf-session")).toEqual([
      sessionId,
    ]);
    expect(
      await listStoredNotebookFragmentsForSession(
        `${INVESTIGATION_SESSION_ID_PREFIX}other`
      )
    ).toEqual([]);

    expect(
      (
        store[STORAGE_KEY_NOTEBOOK_FRAGMENTS] as {
          sessionAttachments: unknown;
        }
      ).sessionAttachments
    ).toEqual({
      [sessionId]: ["nf-session"],
    });

    expect(
      await detachStoredNotebookFragmentFromSession({
        fragmentId: fragment.id,
        sessionId,
      })
    ).toBe(true);
    expect(await listStoredNotebookFragmentsForSession(sessionId)).toEqual([]);

    await attachStoredNotebookFragmentToSession({
      fragmentId: fragment.id,
      sessionId,
    });
    expect(await deleteStoredNotebookFragment(fragment.id)).toBe(true);
    expect(await listStoredNotebookFragmentSessionIds("nf-session")).toEqual(
      []
    );

    await expect(
      attachStoredNotebookFragmentToSession({
        fragmentId: "nf-missing",
        sessionId,
      })
    ).rejects.toThrow(/not stored/i);

    await expect(
      attachStoredNotebookFragmentToSession({
        fragmentId: "nf-session",
        sessionId: "bad-id",
      })
    ).rejects.toThrow(/invalid/i);
  });

  it("attaches fragments to page scope origin + optional path prefix", async () => {
    expect(
      buildNotebookFragmentPageScopeKeyFromPageUrl(
        "https://alerts.example.com/soc/case/1?x=1"
      )
    ).toBe("https://alerts.example.com");
    expect(
      buildNotebookFragmentPageScopeKeyFromPageUrl(
        "https://alerts.example.com/soc/case/1",
        { includePathPrefix: true }
      )
    ).toBe("https://alerts.example.com/soc/case/1");
    expect(
      buildNotebookFragmentPageScopeKey("https://example.com", "/alerts/")
    ).toBe("https://example.com/alerts");
    expect(
      normalizeNotebookFragmentPageScopeKey("https://example.com/alerts/")
    ).toBe("https://example.com/alerts");
    expect(normalizeNotebookFragmentPageScopeKey("ftp://example.com")).toBeNull();

    const fragment = createNotebookFragment({
      id: "nf-page",
      type: NOTEBOOK_FRAGMENT_TYPE.TAG,
      body: "Page-scoped note.",
      createdAt: 1,
      updatedAt: 1,
    });
    await upsertStoredNotebookFragment(fragment);

    const originKey = await attachStoredNotebookFragmentToPage({
      fragmentId: fragment.id,
      pageUrl: "https://portal.example.com/inbox?q=1",
    });
    expect(originKey).toBe("https://portal.example.com");

    const pathKey = await attachStoredNotebookFragmentToPage({
      fragmentId: fragment.id,
      pageUrl: "https://portal.example.com/cases/42",
      includePathPrefix: true,
    });
    expect(pathKey).toBe("https://portal.example.com/cases/42");

    expect(
      await listStoredNotebookFragmentsForPage({
        pageUrl: "https://portal.example.com/other",
      })
    ).toEqual([expect.objectContaining({ id: "nf-page" })]);
    expect(
      await listStoredNotebookFragmentsForPage({
        pageUrl: "https://portal.example.com/cases/42",
        includePathPrefix: true,
      })
    ).toEqual([expect.objectContaining({ id: "nf-page" })]);
    expect(await listStoredNotebookFragmentPageScopeKeys("nf-page")).toEqual([
      "https://portal.example.com",
      "https://portal.example.com/cases/42",
    ]);

    expect(
      await detachStoredNotebookFragmentFromPage({
        fragmentId: fragment.id,
        pageScopeKey: "https://portal.example.com",
      })
    ).toBe(true);
    expect(
      await listStoredNotebookFragmentsForPage({
        origin: "https://portal.example.com",
      })
    ).toEqual([]);

    expect(await deleteStoredNotebookFragment(fragment.id)).toBe(true);
    expect(await listStoredNotebookFragmentPageScopeKeys("nf-page")).toEqual(
      []
    );

    await expect(
      attachStoredNotebookFragmentToPage({
        fragmentId: "nf-missing",
        pageUrl: "https://portal.example.com",
      })
    ).rejects.toThrow(/not stored/i);
  });

  it("rejects attaching a fragment that is not stored", async () => {
    await expect(
      attachStoredNotebookFragmentToIoc({
        fragmentId: "nf-missing",
        iocType: IOC_TYPE.IPV4,
        value: "8.8.8.8",
      })
    ).rejects.toThrow(/not stored/i);
  });

  it("does not write when chrome.storage.local is unavailable", async () => {
    vi.unstubAllGlobals();
    const fragment = createNotebookFragment({
      type: NOTEBOOK_FRAGMENT_TYPE.TAG,
      body: "offline",
      createdAt: 1,
      updatedAt: 1,
    });
    await expect(upsertStoredNotebookFragment(fragment)).resolves.toEqual(
      fragment
    );
    expect(store[STORAGE_KEY_NOTEBOOK_FRAGMENTS]).toBeUndefined();
  });
});
