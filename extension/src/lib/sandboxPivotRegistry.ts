/**
 * Phase 12A — external malware-sandbox investigation destinations.
 * Presentation/configuration only: no API calls, no automatic submission.
 */

import { IOC_TYPE, type IocType } from "./iocRegex";

export const SANDBOX_ID = {
  ANYRUN: "anyrun",
  JOE_SANDBOX: "joe_sandbox",
  HYBRID_ANALYSIS: "hybrid_analysis",
  TRIAGE: "triage",
} as const;

export type SandboxId = (typeof SANDBOX_ID)[keyof typeof SANDBOX_ID];

export type SandboxActionKind = "open_search" | "copy_and_open" | "unsupported";

export type SandboxDestinationResolution = {
  sandboxId: SandboxId;
  displayName: string;
  kind: SandboxActionKind;
  href: string | null;
  clipboardText: string | null;
  feedback: string | null;
  disabledReason: string | null;
  ariaLabel: string;
  /** Contextual row description matching implemented behavior only. */
  actionDescription: string;
  /** Launch-console availability label. */
  availabilityLabel: "READY" | "UNAVAILABLE";
  /** 01–04 index for launch console ordering. */
  indexLabel: string;
};

type SandboxDefinition = {
  id: SandboxId;
  displayName: string;
  landingPage: string;
  supportedIocTypes: readonly IocType[];
  /** Official public search/report route when stable; otherwise null → copy-and-open. */
  buildSearchUrl: ((iocType: IocType, value: string) => string | null) | null;
  unsupportedReason: (iocType: IocType) => string;
};

const FILE_HASH_TYPES: readonly IocType[] = [
  IOC_TYPE.MD5,
  IOC_TYPE.SHA1,
  IOC_TYPE.SHA256,
];

const URL_AND_HASH_TYPES: readonly IocType[] = [IOC_TYPE.URL, ...FILE_HASH_TYPES];

function isFileHash(iocType: IocType): boolean {
  return (FILE_HASH_TYPES as readonly string[]).includes(iocType);
}

function encodeQuery(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Registry order matches the Sandbox Launch Console:
 * 01 ANY.RUN · 02 Joe Sandbox · 03 Hybrid Analysis · 04 Triage
 */
export const SANDBOX_DEFINITIONS: readonly SandboxDefinition[] = [
  {
    id: SANDBOX_ID.ANYRUN,
    displayName: "ANY.RUN",
    landingPage: "https://app.any.run/",
    supportedIocTypes: URL_AND_HASH_TYPES,
    // No stable public hash/URL deep link without a task id — copy + open landing.
    buildSearchUrl: null,
    unsupportedReason: (iocType) =>
      iocType === IOC_TYPE.IPV4 || iocType === IOC_TYPE.DOMAIN
        ? "Not available for IP indicators"
        : iocType === IOC_TYPE.ASN
          ? "No direct sandbox action for ASN"
          : "URL or file hash required",
  },
  {
    id: SANDBOX_ID.JOE_SANDBOX,
    displayName: "Joe Sandbox",
    landingPage: "https://www.joesandbox.com/",
    supportedIocTypes: URL_AND_HASH_TYPES,
    buildSearchUrl: (iocType, value) => {
      if (isFileHash(iocType)) {
        return `https://www.joesandbox.com/search?q=${encodeQuery(value)}`;
      }
      // URL submission is form-based; avoid undocumented query submission.
      return null;
    },
    unsupportedReason: (iocType) =>
      iocType === IOC_TYPE.IPV4 || iocType === IOC_TYPE.DOMAIN
        ? "Not available for IP indicators"
        : iocType === IOC_TYPE.ASN
          ? "No direct sandbox action for ASN"
          : "URL or file hash required",
  },
  {
    id: SANDBOX_ID.HYBRID_ANALYSIS,
    displayName: "Hybrid Analysis",
    landingPage: "https://www.hybrid-analysis.com/",
    supportedIocTypes: URL_AND_HASH_TYPES,
    buildSearchUrl: (iocType, value) => {
      if (isFileHash(iocType)) {
        return `https://www.hybrid-analysis.com/search?query=${encodeQuery(value)}`;
      }
      // URL search deep link is not a documented stable submission route.
      return null;
    },
    unsupportedReason: (iocType) =>
      iocType === IOC_TYPE.IPV4 || iocType === IOC_TYPE.DOMAIN
        ? "Not available for IP indicators"
        : iocType === IOC_TYPE.ASN
          ? "No direct sandbox action for ASN"
          : "URL or file hash required",
  },
  {
    id: SANDBOX_ID.TRIAGE,
    displayName: "Triage",
    landingPage: "https://tria.ge/",
    supportedIocTypes: URL_AND_HASH_TYPES,
    buildSearchUrl: (iocType, value) => {
      if (isFileHash(iocType)) {
        return `https://tria.ge/s?q=${encodeQuery(value)}`;
      }
      return null;
    },
    unsupportedReason: (iocType) =>
      iocType === IOC_TYPE.IPV4 || iocType === IOC_TYPE.DOMAIN
        ? "Not available for IP indicators"
        : iocType === IOC_TYPE.ASN
          ? "No direct sandbox action for ASN"
          : "URL or file hash required",
  },
];

export const SANDBOX_PUBLIC_SUBMISSION_WARNING =
  "Third-party sandbox submissions may expose submitted data publicly.";

export const SANDBOX_PUBLIC_SUBMISSION_NOTICE_LABEL = "Public-submission notice";

export const SANDBOX_NO_SELECTION_GUIDANCE =
  "Select a URL or file hash to open an external sandbox.";

function copyFeedbackFor(iocType: IocType): string {
  if (iocType === IOC_TYPE.URL) {
    return "URL copied. Paste it into the sandbox submission form.";
  }
  if (isFileHash(iocType)) {
    return "Hash copied. Paste it into the sandbox search.";
  }
  return "Indicator copied. Paste it into the sandbox form.";
}

function actionDescriptionFor(
  sandbox: SandboxDefinition,
  kind: SandboxActionKind,
  iocType: IocType | null
): string {
  if (kind === "unsupported" || !iocType) {
    return sandbox.unsupportedReason(iocType ?? IOC_TYPE.IPV4);
  }
  if (iocType === IOC_TYPE.URL) {
    return kind === "copy_and_open"
      ? "Prepare URL submission"
      : "Open URL analysis workspace";
  }
  if (isFileHash(iocType)) {
    return kind === "open_search"
      ? "Search existing file reports"
      : "Copy hash and open submission page";
  }
  return "Open external sandbox";
}

function indexLabelFor(sandboxId: SandboxId): string {
  const index = SANDBOX_DEFINITIONS.findIndex((entry) => entry.id === sandboxId);
  return String(index + 1).padStart(2, "0");
}

export function resolveSandboxDestination(
  sandbox: SandboxDefinition,
  iocType: IocType | null,
  value: string | null
): SandboxDestinationResolution {
  const displayName = sandbox.displayName;
  const indexLabel = indexLabelFor(sandbox.id);

  if (!iocType || !value?.trim()) {
    return {
      sandboxId: sandbox.id,
      displayName,
      kind: "unsupported",
      href: null,
      clipboardText: null,
      feedback: null,
      disabledReason: SANDBOX_NO_SELECTION_GUIDANCE,
      ariaLabel: `${displayName} — select a URL or file hash`,
      actionDescription: SANDBOX_NO_SELECTION_GUIDANCE,
      availabilityLabel: "UNAVAILABLE",
      indexLabel,
    };
  }

  const trimmed = value.trim();
  if (!sandbox.supportedIocTypes.includes(iocType)) {
    const reason = sandbox.unsupportedReason(iocType);
    return {
      sandboxId: sandbox.id,
      displayName,
      kind: "unsupported",
      href: null,
      clipboardText: null,
      feedback: null,
      disabledReason: reason,
      ariaLabel: `${displayName} — ${reason}`,
      actionDescription: reason,
      availabilityLabel: "UNAVAILABLE",
      indexLabel,
    };
  }

  const searchUrl = sandbox.buildSearchUrl?.(iocType, trimmed) ?? null;
  if (searchUrl) {
    return {
      sandboxId: sandbox.id,
      displayName,
      kind: "open_search",
      href: searchUrl,
      clipboardText: null,
      feedback: null,
      disabledReason: null,
      ariaLabel:
        iocType === IOC_TYPE.URL
          ? `Open selected URL search in ${displayName}`
          : `Open selected hash in ${displayName}`,
      actionDescription: actionDescriptionFor(sandbox, "open_search", iocType),
      availabilityLabel: "READY",
      indexLabel,
    };
  }

  return {
    sandboxId: sandbox.id,
    displayName,
    kind: "copy_and_open",
    href: sandbox.landingPage,
    clipboardText: trimmed,
    feedback: copyFeedbackFor(iocType),
    disabledReason: null,
    ariaLabel:
      iocType === IOC_TYPE.URL
        ? `Open selected URL in ${displayName}`
        : `Open selected hash in ${displayName}`,
    actionDescription: actionDescriptionFor(sandbox, "copy_and_open", iocType),
    availabilityLabel: "READY",
    indexLabel,
  };
}

export function listSandboxDestinationResolutions(
  iocType: IocType | null,
  value: string | null
): SandboxDestinationResolution[] {
  return SANDBOX_DEFINITIONS.map((sandbox) =>
    resolveSandboxDestination(sandbox, iocType, value)
  );
}
