import type { MessageResponse } from "./messages";
import {
  applySiteModeOverrideToPageContextClassification,
  isPageContextClassification,
  normalizePageContextSiteModeOverrideHost,
  parsePageContextOrigin,
  resolvePageContextAnalystPresetApplication,
  tabPageContextStorageKey,
  type PageContextClassification,
  type PageContextTrustGateState,
  type TabPageContextRecord,
} from "./pageContext";
import {
  isHostnameAllowedByDomainPolicy,
  normalizeDomainPolicy,
} from "./domainPolicy";
import {
  safeStorageSessionGet,
  safeStorageSessionRemove,
  safeStorageSessionSet,
} from "./extensionContext";
import {
  applyAnalystModePreset,
  getDomainAllowlist,
  getDomainDenylist,
  getDomainPolicyMode,
  getPageContextSiteModeOverrides,
  getQuietMode,
} from "./storage";

async function resolvePageContextTrustGateState(
  pageOrigin: string | null
): Promise<PageContextTrustGateState> {
  const [quietModeActive, mode, allowlist, denylist] = await Promise.all([
    getQuietMode(),
    getDomainPolicyMode(),
    getDomainAllowlist(),
    getDomainDenylist(),
  ]);
  const policy = normalizeDomainPolicy({
    mode,
    allowlist,
    denylist,
  });
  const host =
    pageOrigin !== null
      ? normalizePageContextSiteModeOverrideHost(pageOrigin)
      : "";
  const pageAllowedByDomainPolicy =
    host.length === 0 || isHostnameAllowedByDomainPolicy(host, policy);

  return {
    quietModeActive,
    pageAllowedByDomainPolicy,
  };
}

export async function saveTabPageContext(
  tabId: number,
  classification: PageContextClassification
): Promise<void> {
  const record: TabPageContextRecord = {
    ...classification,
    tabId,
  };
  await safeStorageSessionSet({
    [tabPageContextStorageKey(tabId)]: record,
  });
}

export async function getTabPageContext(
  tabId: number
): Promise<TabPageContextRecord | null> {
  const key = tabPageContextStorageKey(tabId);
  const result = await safeStorageSessionGet(key);
  const value = result[key];
  if (!isPageContextClassification(value)) {
    return null;
  }
  const siteModeOverrides = await getPageContextSiteModeOverrides();
  const effective = applySiteModeOverrideToPageContextClassification(
    value,
    siteModeOverrides
  );
  return { ...effective, tabId };
}

export async function clearTabPageContext(tabId: number): Promise<void> {
  await safeStorageSessionRemove(tabPageContextStorageKey(tabId));
}

export async function maybeApplyAnalystPresetForPageContextChange(
  previous: TabPageContextRecord | null,
  classification: PageContextClassification
): Promise<void> {
  const siteModeOverrides = await getPageContextSiteModeOverrides();
  const pageOrigin = parsePageContextOrigin(classification.pageUrl);
  const trustGates = await resolvePageContextTrustGateState(pageOrigin);
  const presetId = resolvePageContextAnalystPresetApplication({
    previousPageContextType: previous?.pageContextType,
    nextPageContextType: classification.pageContextType,
    pageOrigin,
    siteModeOverrides,
    trustGates,
  });
  if (presetId === null) {
    return;
  }
  await applyAnalystModePreset(presetId);
}

export async function handleTabPageContextMessage(
  classification: PageContextClassification,
  sender: chrome.runtime.MessageSender | undefined
): Promise<MessageResponse> {
  const tabId = sender?.tab?.id;
  if (tabId === undefined) {
    return { ok: false, error: "missing tab id" };
  }
  if (!isPageContextClassification(classification)) {
    return { ok: false, error: "invalid tab page context" };
  }

  const siteModeOverrides = await getPageContextSiteModeOverrides();
  const effectiveClassification = applySiteModeOverrideToPageContextClassification(
    classification,
    siteModeOverrides
  );

  const previous = await getTabPageContext(tabId);
  await saveTabPageContext(tabId, effectiveClassification);
  await maybeApplyAnalystPresetForPageContextChange(
    previous,
    effectiveClassification
  );
  return { ok: true, payload: { tabId } };
}

export async function handleGetTabPageContextMessage(
  tabId: number | undefined,
  sender: chrome.runtime.MessageSender | undefined
): Promise<MessageResponse> {
  const resolvedTabId = tabId ?? sender?.tab?.id;
  if (resolvedTabId === undefined) {
    return { ok: false, error: "missing tab id" };
  }

  const context = await getTabPageContext(resolvedTabId);
  return { ok: true, payload: { context } };
}
