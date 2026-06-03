import { describe, expect, it } from "vitest";
import {
  contentRegisterMessage,
  enrichIocMessage,
  getTabScanSummaryMessage,
  isEnrichIocMessage,
  isGetTabScanSummaryMessage,
  isNavigateToIocAnchorMessage,
  isScanPageMessage,
  isTabScanSnapshotMessage,
  isVera5Message,
  MESSAGE,
  navigateToIocAnchorMessage,
  pingMessage,
  scanPageMessage,
  tabScanSnapshotMessage,
} from "./messages";
import { buildTabScanSnapshotPayload } from "./tabScanSnapshot";

describe("Vera5 message envelopes", () => {
  it("builds PING", () => {
    expect(pingMessage()).toEqual({ type: MESSAGE.PING });
  });

  it("builds CONTENT_REGISTER", () => {
    expect(contentRegisterMessage()).toEqual({
      type: MESSAGE.CONTENT_REGISTER,
    });
  });

  it("builds SCAN_PAGE", () => {
    expect(scanPageMessage()).toEqual({ type: MESSAGE.SCAN_PAGE });
  });

  it("builds NAVIGATE_TO_IOC_ANCHOR", () => {
    expect(navigateToIocAnchorMessage("vera5-hl-1")).toEqual({
      type: MESSAGE.NAVIGATE_TO_IOC_ANCHOR,
      anchorId: "vera5-hl-1",
    });
    expect(isNavigateToIocAnchorMessage(navigateToIocAnchorMessage("vera5-hl-1"))).toBe(
      true
    );
    expect(isNavigateToIocAnchorMessage({ type: MESSAGE.NAVIGATE_TO_IOC_ANCHOR, anchorId: "" })).toBe(
      false
    );
  });

  it("accepts known service worker envelopes", () => {
    expect(isVera5Message(pingMessage())).toBe(true);
    expect(isVera5Message(contentRegisterMessage())).toBe(true);
    expect(
      isVera5Message(
        tabScanSnapshotMessage(
          buildTabScanSnapshotPayload({
            pageUrl: "https://example.com",
            entries: [],
          })
        )
      )
    ).toBe(true);
    expect(isVera5Message(scanPageMessage())).toBe(false);
    expect(
      isVera5Message(enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" }))
    ).toBe(true);
    expect(isVera5Message(getTabScanSummaryMessage(12))).toBe(true);
    expect(isVera5Message(getTabScanSummaryMessage())).toBe(true);
  });

  it("builds GET_TAB_SCAN_SUMMARY", () => {
    expect(getTabScanSummaryMessage()).toEqual({
      type: MESSAGE.GET_TAB_SCAN_SUMMARY,
    });
    expect(getTabScanSummaryMessage(12)).toEqual({
      type: MESSAGE.GET_TAB_SCAN_SUMMARY,
      tabId: 12,
    });
    expect(isGetTabScanSummaryMessage(getTabScanSummaryMessage(12))).toBe(true);
    expect(isGetTabScanSummaryMessage({ type: MESSAGE.GET_TAB_SCAN_SUMMARY, tabId: "x" })).toBe(
      false
    );
  });

  it("builds TAB_SCAN_SNAPSHOT", () => {
    const snapshot = buildTabScanSnapshotPayload({
      pageUrl: "https://example.com",
      entries: [
        {
          type: "ipv4",
          value: "8.8.8.8",
          anchorId: "vera5-hl-1",
        },
      ],
    });
    expect(tabScanSnapshotMessage(snapshot)).toEqual({
      type: MESSAGE.TAB_SCAN_SNAPSHOT,
      snapshot,
    });
    expect(isTabScanSnapshotMessage(tabScanSnapshotMessage(snapshot))).toBe(true);
  });

  it("validates ENRICH_IOC payloads", () => {
    expect(
      isEnrichIocMessage(enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" }))
    ).toBe(true);
    expect(isEnrichIocMessage({ type: MESSAGE.ENRICH_IOC, value: "", iocType: "ipv4" })).toBe(
      false
    );
    expect(
      isEnrichIocMessage({ type: MESSAGE.ENRICH_IOC, value: "8.8.8.8", iocType: "email" })
    ).toBe(false);
    expect(
      isEnrichIocMessage({
        ...enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" }),
        pageText: "full page dump",
      })
    ).toBe(false);
    expect(
      isEnrichIocMessage({
        type: MESSAGE.ENRICH_IOC,
        value: "8.8.8.8 extra context",
        iocType: "ipv4",
      })
    ).toBe(false);
    expect(
      isEnrichIocMessage(
        enrichIocMessage({
          value: "8.8.8.8",
          iocType: "ipv4",
          bypassCache: true,
        })
      )
    ).toBe(true);
    expect(
      isEnrichIocMessage({
        ...enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" }),
        bypassCache: false,
      })
    ).toBe(false);
  });

  it("accepts SCAN_PAGE tab envelope", () => {
    expect(isScanPageMessage(scanPageMessage())).toBe(true);
    expect(isScanPageMessage({ type: "NOT_REAL" })).toBe(false);
  });

  it("rejects invalid envelopes", () => {
    expect(isVera5Message(null)).toBe(false);
    expect(isVera5Message({})).toBe(false);
    expect(isVera5Message({ type: "NOT_REAL" })).toBe(false);
  });
});
