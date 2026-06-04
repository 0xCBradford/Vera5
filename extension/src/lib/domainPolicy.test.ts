import { describe, expect, it } from "vitest";
import {
  DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT,
  DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
  DOMAIN_POLICY_PRESET_SENSITIVE_SITES_DENYLIST,
  applyDomainPolicyPresetToLists,
  createDefaultDomainPolicy,
  getDomainPolicyPresetById,
  hostnameMatchesPolicyEntry,
  isAutoScanAllowedForHostname,
  mergeDomainPolicyLists,
  normalizeDomainPolicy,
  normalizeDomainPolicyList,
} from "./domainPolicy";

describe("domain policy matching", () => {
  it("matches exact hostnames case-insensitively", () => {
    expect(hostnameMatchesPolicyEntry("Mail.Example.com", "mail.example.com")).toBe(
      true
    );
    expect(hostnameMatchesPolicyEntry("other.example.com", "mail.example.com")).toBe(
      false
    );
  });

  it("matches wildcard suffix patterns", () => {
    expect(hostnameMatchesPolicyEntry("mail.google.com", "*.google.com")).toBe(
      true
    );
    expect(hostnameMatchesPolicyEntry("google.com", "*.google.com")).toBe(true);
    expect(hostnameMatchesPolicyEntry("evilgoogle.com", "*.google.com")).toBe(
      false
    );
  });

  it("matches wildcard prefix patterns", () => {
    expect(hostnameMatchesPolicyEntry("mail.google.com", "mail.*")).toBe(true);
    expect(hostnameMatchesPolicyEntry("mail", "mail.*")).toBe(true);
    expect(hostnameMatchesPolicyEntry("webmail.example.com", "mail.*")).toBe(
      false
    );
  });

  it("normalizes allowlist and denylist entries", () => {
    expect(
      normalizeDomainPolicyList([" Mail.Example.com ", "mail.example.com", 1, ""])
    ).toEqual(["mail.example.com"]);
  });
});

describe("auto-scan domain policy", () => {
  it("allows SOC hosts in allow-by-default mode with the default webmail denylist", () => {
    expect(
      isAutoScanAllowedForHostname(
        "soc.example.com",
        createDefaultDomainPolicy()
      )
    ).toBe(true);
  });

  it("blocks default denylisted webmail hosts in allow-by-default mode", () => {
    expect(
      isAutoScanAllowedForHostname(
        "mail.google.com",
        createDefaultDomainPolicy()
      )
    ).toBe(false);
    expect(
      isAutoScanAllowedForHostname(
        "mail.contoso.com",
        createDefaultDomainPolicy()
      )
    ).toBe(false);
  });

  it("allows non-webmail hosts when denylist is explicitly empty", () => {
    const policy = normalizeDomainPolicy({
      mode: DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT,
      denylist: [],
    });
    expect(isAutoScanAllowedForHostname("mail.example.com", policy)).toBe(true);
  });

  it("blocks denylisted hosts in allow-by-default mode", () => {
    const policy = normalizeDomainPolicy({
      mode: DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT,
      denylist: ["mail.example.com"],
    });
    expect(isAutoScanAllowedForHostname("mail.example.com", policy)).toBe(false);
    expect(isAutoScanAllowedForHostname("soc.example.com", policy)).toBe(true);
  });

  it("blocks hosts outside the allowlist in deny-by-default mode", () => {
    const policy = normalizeDomainPolicy({
      mode: DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
      allowlist: ["soc.example.com"],
    });
    expect(isAutoScanAllowedForHostname("soc.example.com", policy)).toBe(true);
    expect(isAutoScanAllowedForHostname("mail.example.com", policy)).toBe(false);
  });

  it("prefers denylist over allowlist matches", () => {
    const policy = normalizeDomainPolicy({
      mode: DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
      allowlist: ["*.example.com"],
      denylist: ["mail.example.com"],
    });
    expect(isAutoScanAllowedForHostname("mail.example.com", policy)).toBe(false);
    expect(isAutoScanAllowedForHostname("soc.example.com", policy)).toBe(true);
  });
});

describe("domain policy presets", () => {
  it("exposes the sensitive sites denylist preset for allow-by-default policy", () => {
    const preset = getDomainPolicyPresetById(
      DOMAIN_POLICY_PRESET_SENSITIVE_SITES_DENYLIST.id
    );
    expect(preset).toBeDefined();
    expect(preset?.recommendedMode).toBe(DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT);
    expect(preset?.denylistEntries).toContain("mail.*");
    expect(preset?.denylistEntries).toContain("mail.google.com");
    expect(preset?.denylistEntries).toContain("*.bank");
  });

  it("merges preset entries without dropping existing list items", () => {
    const applied = applyDomainPolicyPresetToLists({
      mode: DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
      allowlist: ["soc.example.com"],
      denylist: ["legacy.example.com"],
      preset: DOMAIN_POLICY_PRESET_SENSITIVE_SITES_DENYLIST,
    });

    expect(applied.mode).toBe(DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT);
    expect(applied.allowlist).toEqual(["soc.example.com"]);
    expect(applied.denylist).toContain("legacy.example.com");
    expect(applied.denylist).toContain("mail.*");
    expect(
      mergeDomainPolicyLists(["mail.*", "mail.*"], ["webmail.*"])
    ).toEqual(["mail.*", "webmail.*"]);
  });
});
