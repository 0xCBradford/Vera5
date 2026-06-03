export function isAutoEnrichmentFetchAllowed(manualOnlyMode: boolean): boolean {
  return !manualOnlyMode;
}

export function needsPreQueryNoticeFirstRunPrompt(
  preferenceConfigured: boolean
): boolean {
  return !preferenceConfigured;
}

export function shouldShowPreQueryNotices(showPreQueryNotices: boolean): boolean {
  return showPreQueryNotices;
}

export function shouldApplyDomainPolicyEnrichGate(
  enrichGateEnabled: boolean
): boolean {
  return enrichGateEnabled;
}

export type PreQueryDisclosureDecision = {
  proceed: boolean;
  rememberDismiss: boolean;
};

let pendingPreQueryDisclosureResolver:
  | ((decision: PreQueryDisclosureDecision) => void)
  | null = null;

export function beginPreQueryDisclosureWait(): Promise<PreQueryDisclosureDecision> {
  return new Promise((resolve) => {
    pendingPreQueryDisclosureResolver = resolve;
  });
}

export function resolvePreQueryDisclosure(
  decision: PreQueryDisclosureDecision
): void {
  if (!pendingPreQueryDisclosureResolver) {
    return;
  }
  pendingPreQueryDisclosureResolver(decision);
  pendingPreQueryDisclosureResolver = null;
}

export function cancelPreQueryDisclosure(): void {
  resolvePreQueryDisclosure({ proceed: false, rememberDismiss: false });
}

export function hasPendingPreQueryDisclosure(): boolean {
  return pendingPreQueryDisclosureResolver !== null;
}

export function buildPreQueryDisclosureMessage(input: {
  sourceLabels: readonly string[];
  value: string;
  typeLabel: string;
}): string {
  const vendorText = formatPreQueryVendorList(input.sourceLabels);
  return `Vera5 will query ${vendorText} with this ${input.typeLabel}: ${input.value}`;
}

export function formatPreQueryVendorList(sourceLabels: readonly string[]): string {
  if (sourceLabels.length === 0) {
    return "your enabled vendors";
  }
  if (sourceLabels.length === 1) {
    return sourceLabels[0];
  }
  if (sourceLabels.length === 2) {
    return `${sourceLabels[0]} and ${sourceLabels[1]}`;
  }
  const head = sourceLabels.slice(0, -1).join(", ");
  const tail = sourceLabels[sourceLabels.length - 1];
  return `${head}, and ${tail}`;
}
