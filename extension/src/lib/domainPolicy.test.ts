import { describe, expect, it } from "vitest";
import {
  DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT,
  DOMAIN_POLICY_MODE_DENY_BY_DEFAULT,
  createDefaultDomainPolicy,
  hostnameMatchesPolicyEntry,
  isAutoScanAllowedForHostname,
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
  it("allows all hosts in allow-by-default mode with empty lists", () => {
    expect(
      isAutoScanAllowedForHostname(
        "mail.example.com",
        createDefaultDomainPolicy()
      )
    ).toBe(true);
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
