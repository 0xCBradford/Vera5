import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  SANDBOX_DEFINITIONS,
  SANDBOX_ID,
  SANDBOX_NO_SELECTION_GUIDANCE,
  SANDBOX_PUBLIC_SUBMISSION_WARNING,
  listSandboxDestinationResolutions,
  resolveSandboxDestination,
} from "./sandboxPivotRegistry";

describe("sandboxPivotRegistry", () => {
  it("exposes exactly four sandbox destinations in grid order", () => {
    expect(SANDBOX_DEFINITIONS.map((entry) => entry.displayName)).toEqual([
      "ANY.RUN",
      "Joe Sandbox",
      "Hybrid Analysis",
      "Triage",
    ]);
    expect(SANDBOX_DEFINITIONS).toHaveLength(4);
  });

  it("disables all destinations when no IOC is selected", () => {
    const resolutions = listSandboxDestinationResolutions(null, null);
    expect(resolutions.every((entry) => entry.kind === "unsupported")).toBe(true);
    expect(resolutions.every((entry) => entry.disabledReason === SANDBOX_NO_SELECTION_GUIDANCE)).toBe(
      true
    );
  });

  it("uses copy-and-open for URL IOCs without undocumented query submission", () => {
    const url = "http://malicious.example/path";
    const resolutions = listSandboxDestinationResolutions(IOC_TYPE.URL, url);
    expect(resolutions.every((entry) => entry.kind === "copy_and_open")).toBe(true);
    expect(resolutions.every((entry) => entry.clipboardText === url)).toBe(true);
    expect(resolutions[0]?.feedback).toContain("URL copied");
    expect(resolutions.every((entry) => entry.href?.startsWith("http"))).toBe(true);
    expect(resolutions.every((entry) => !entry.href?.includes(encodeURIComponent(url)))).toBe(
      true
    );
  });

  it("opens official hash search routes when supported", () => {
    const hash = "a".repeat(64);
    const joe = resolveSandboxDestination(
      SANDBOX_DEFINITIONS.find((entry) => entry.id === SANDBOX_ID.JOE_SANDBOX)!,
      IOC_TYPE.SHA256,
      hash
    );
    const hybrid = resolveSandboxDestination(
      SANDBOX_DEFINITIONS.find((entry) => entry.id === SANDBOX_ID.HYBRID_ANALYSIS)!,
      IOC_TYPE.SHA256,
      hash
    );
    const triage = resolveSandboxDestination(
      SANDBOX_DEFINITIONS.find((entry) => entry.id === SANDBOX_ID.TRIAGE)!,
      IOC_TYPE.SHA256,
      hash
    );
    const anyrun = resolveSandboxDestination(
      SANDBOX_DEFINITIONS.find((entry) => entry.id === SANDBOX_ID.ANYRUN)!,
      IOC_TYPE.SHA256,
      hash
    );

    expect(joe.kind).toBe("open_search");
    expect(joe.href).toContain(hash);
    expect(hybrid.kind).toBe("open_search");
    expect(hybrid.href).toContain(hash);
    expect(triage.kind).toBe("open_search");
    expect(triage.href).toContain(hash);
    expect(anyrun.kind).toBe("copy_and_open");
    expect(anyrun.feedback).toContain("Hash copied");
  });

  it("marks IP and ASN destinations unsupported without fabricating redirects", () => {
    const ip = listSandboxDestinationResolutions(IOC_TYPE.IPV4, "8.8.8.8");
    const asn = listSandboxDestinationResolutions(IOC_TYPE.ASN, "AS15169");
    expect(ip.every((entry) => entry.kind === "unsupported" && entry.href === null)).toBe(true);
    expect(asn.every((entry) => entry.kind === "unsupported")).toBe(true);
    expect(ip[0]?.disabledReason).toMatch(/IP|URL or file/i);
  });

  it("publishes a public-submission warning constant", () => {
    expect(SANDBOX_PUBLIC_SUBMISSION_WARNING).toMatch(/public/i);
  });

  it("attaches contextual action descriptions for URL and hash behaviors", () => {
    const url = listSandboxDestinationResolutions(IOC_TYPE.URL, "http://evil.example/");
    expect(url.every((entry) => entry.actionDescription.includes("URL"))).toBe(true);
    expect(url.every((entry) => entry.availabilityLabel === "READY")).toBe(true);
    expect(url.map((entry) => entry.indexLabel)).toEqual(["01", "02", "03", "04"]);

    const hash = listSandboxDestinationResolutions(IOC_TYPE.SHA256, "a".repeat(64));
    expect(hash.find((entry) => entry.sandboxId === SANDBOX_ID.JOE_SANDBOX)?.actionDescription).toBe(
      "Search existing file reports"
    );
    expect(hash.find((entry) => entry.sandboxId === SANDBOX_ID.ANYRUN)?.actionDescription).toBe(
      "Copy hash and open submission page"
    );
  });

  it("does not mutate the sandbox definition array", () => {
    const snapshot = [...SANDBOX_DEFINITIONS];
    listSandboxDestinationResolutions(IOC_TYPE.URL, "http://example.test/");
    expect(SANDBOX_DEFINITIONS).toEqual(snapshot);
  });
});
