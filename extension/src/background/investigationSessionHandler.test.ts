import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveInvestigationSessionMessage,
  createInvestigationSessionMessage,
  deleteInvestigationSessionMessage,
  listInvestigationSessionsMessage,
  renameInvestigationSessionMessage,
  reopenInvestigationSessionMessage,
  updateInvestigationSessionTitleMessage,
} from "../lib/messages";
import {
  handleArchiveInvestigationSessionMessage,
  handleCreateInvestigationSessionMessage,
  handleDeleteInvestigationSessionMessage,
  handleGetActiveInvestigationSessionMessage,
  handleListInvestigationSessionsMessage,
  handleRenameInvestigationSessionMessage,
  handleReopenInvestigationSessionMessage,
  handleUpdateInvestigationSessionTitleMessage,
} from "./investigationSessionHandler";

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

describe("investigationSessionHandler", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null active session when none exists", async () => {
    const response = await handleGetActiveInvestigationSessionMessage();
    expect(response).toEqual({ ok: true, payload: { session: null } });
  });

  it("creates a new active session from popup requests", async () => {
    const response = await handleCreateInvestigationSessionMessage(
      createInvestigationSessionMessage({
        title: "Phishing Investigation",
        pageUrl: "https://example.com/inbox",
      })
    );

    expect(response.ok).toBe(true);
    const session = (response as { payload?: { session?: { title?: string } } }).payload
      ?.session;
    expect(session?.title).toBe("Phishing Investigation");

    const active = await handleGetActiveInvestigationSessionMessage();
    expect(active).toEqual({ ok: true, payload: { session } });
  });

  it("renames the active session title", async () => {
    await handleCreateInvestigationSessionMessage(
      createInvestigationSessionMessage({
        title: "Original",
        pageUrl: "https://example.com",
      })
    );

    const response = await handleUpdateInvestigationSessionTitleMessage(
      updateInvestigationSessionTitleMessage("Renamed case")
    );
    expect(response.ok).toBe(true);
    expect(
      (response as { payload?: { session?: { title?: string } } }).payload?.session?.title
    ).toBe("Renamed case");
  });

  it("lists recent sessions and supports reopen, rename, archive, and delete", async () => {
    const firstCreate = await handleCreateInvestigationSessionMessage(
      createInvestigationSessionMessage({
        title: "First",
        pageUrl: "https://example.com/one",
      })
    );
    const secondCreate = await handleCreateInvestigationSessionMessage(
      createInvestigationSessionMessage({
        title: "Second",
        pageUrl: "https://example.com/two",
      })
    );
    const firstId = (firstCreate as { payload?: { session?: { id?: string } } }).payload
      ?.session?.id;
    const secondId = (secondCreate as { payload?: { session?: { id?: string } } }).payload
      ?.session?.id;
    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();

    const listResponse = await handleListInvestigationSessionsMessage();
    expect(listResponse.ok).toBe(true);
    expect(
      (listResponse as { payload?: { sessions?: Array<{ title: string }> } }).payload
        ?.sessions?.length
    ).toBe(2);

    const reopenResponse = await handleReopenInvestigationSessionMessage(
      reopenInvestigationSessionMessage(firstId!)
    );
    expect(reopenResponse.ok).toBe(true);

    const renameResponse = await handleRenameInvestigationSessionMessage(
      renameInvestigationSessionMessage({
        sessionId: firstId!,
        title: "Renamed first",
      })
    );
    expect(renameResponse.ok).toBe(true);

    const archiveResponse = await handleArchiveInvestigationSessionMessage(
      archiveInvestigationSessionMessage(secondId!)
    );
    expect(archiveResponse.ok).toBe(true);

    const afterArchiveList = await handleListInvestigationSessionsMessage();
    expect(
      (afterArchiveList as { payload?: { sessions?: Array<{ title: string }> } }).payload
        ?.sessions
    ).toEqual([expect.objectContaining({ title: "Renamed first" })]);

    const deleteResponse = await handleDeleteInvestigationSessionMessage(
      deleteInvestigationSessionMessage(firstId!)
    );
    expect(deleteResponse.ok).toBe(true);
  });
});
