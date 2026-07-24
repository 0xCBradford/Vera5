import {
  getIocLabelsRecord,
  getStoredIocLabel,
  normalizeIocLabelKey,
  setStoredIocLabel,
} from "./iocLabelStorage";
import { type IocLabelId, normalizeIocLabelId } from "./iocLabel";
import { recordActiveInvestigationSessionWatchlistTagEvent } from "./investigationSessionStorage";
import {
  isExtensionContextInvalidated,
  rethrowUnlessStaleExtensionError,
} from "./extensionContext";
import {
  createNoiseRuleFromWatchlistLabel,
  type NoiseRule,
} from "./noiseRule";
import { persistLearnedNoiseRule } from "./noiseRuleStorage";

const sessionIocLabels = new Map<string, IocLabelId>();

let storageHydrated = false;

function canPersistIocLabels(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.local !== undefined &&
    !isExtensionContextInvalidated()
  );
}

function markIocLabelStorageHydrated(): void {
  storageHydrated = true;
}

function normalizeIocKey(value: string): string {
  return normalizeIocLabelKey(value);
}

function setCachedIocLabel(value: string, label: IocLabelId | null): void {
  const key = normalizeIocKey(value);
  if (!label) {
    sessionIocLabels.delete(key);
    return;
  }
  sessionIocLabels.set(key, label);
}

export function getSessionIocLabel(value: string): IocLabelId | null {
  return sessionIocLabels.get(normalizeIocKey(value)) ?? null;
}

export type SetSessionIocLabelOptions = {
  /** Explicit per-action opt-in to learn a local noise rule from this label. */
  learnNoiseRule?: boolean;
};

/**
 * Applies a watchlist label and, when `learnNoiseRule` is true for
 * suppress/internal/benign, creates and remembers a local exact-match noise rule.
 */
export function setSessionIocLabel(
  value: string,
  label: IocLabelId | null,
  options?: SetSessionIocLabelOptions
): NoiseRule | null {
  const normalizedLabel = label ? normalizeIocLabelId(label) : null;
  setCachedIocLabel(value, normalizedLabel);
  if (normalizedLabel) {
    void recordActiveInvestigationSessionWatchlistTagEvent({
      iocValue: value,
      label: normalizedLabel,
    }).catch(rethrowUnlessStaleExtensionError);
  }
  if (canPersistIocLabels()) {
    void setStoredIocLabel(value, normalizedLabel).catch(rethrowUnlessStaleExtensionError);
  }

  const learned = createNoiseRuleFromWatchlistLabel({
    iocValue: value,
    label: normalizedLabel,
    learnNoiseRule: options?.learnNoiseRule === true,
  });
  if (!learned) {
    return null;
  }
  return persistLearnedNoiseRule(learned);
}

export function applyStoredIocLabel(value: string, label: IocLabelId | null): void {
  setCachedIocLabel(value, label);
}

export function clearSessionIocLabels(): void {
  sessionIocLabels.clear();
  storageHydrated = false;
}

export function isIocLabelStorageHydrated(): boolean {
  return storageHydrated;
}

export async function hydrateIocLabelsFromStorage(): Promise<void> {
  if (!canPersistIocLabels()) {
    markIocLabelStorageHydrated();
    return;
  }
  try {
    const record = await getIocLabelsRecord();
    for (const [key, label] of Object.entries(record)) {
      if (!sessionIocLabels.has(key)) {
        sessionIocLabels.set(key, label);
      }
    }
    markIocLabelStorageHydrated();
  } catch (error) {
    rethrowUnlessStaleExtensionError(error);
    markIocLabelStorageHydrated();
  }
}

export function primeIocLabelForIoc(
  value: string,
  onUpdate: (label: IocLabelId | null) => void
): void {
  const cached = getSessionIocLabel(value);
  if (cached) {
    onUpdate(cached);
    return;
  }

  if (storageHydrated) {
    return;
  }

  if (!canPersistIocLabels()) {
    markIocLabelStorageHydrated();
    return;
  }

  void getStoredIocLabel(value)
    .then((stored) => {
      if (!stored) {
        return;
      }
      if (getSessionIocLabel(value)) {
        return;
      }
      applyStoredIocLabel(value, stored);
      onUpdate(stored);
    })
    .catch(rethrowUnlessStaleExtensionError);
}

export function resolveHoverCardIocLabel(
  value: string,
  payloadLabel?: IocLabelId | null
): IocLabelId | null {
  const sessionLabel = getSessionIocLabel(value);
  if (sessionLabel) {
    return sessionLabel;
  }
  return payloadLabel ?? null;
}
