import type { HoverCardOverlayPayload } from "./hoverCardOverlay";
import { getManualOnlyModeForContent } from "./manualOnlyStorage";

export type AutoEnrichmentFetcher = (
  payload: HoverCardOverlayPayload
) => void | Promise<void>;

let autoEnrichmentFetcher: AutoEnrichmentFetcher | null = null;

export function setAutoEnrichmentFetcher(
  fetcher: AutoEnrichmentFetcher | null
): void {
  autoEnrichmentFetcher = fetcher;
}

export function setAutoEnrichmentFetcherForTests(
  fetcher: AutoEnrichmentFetcher | null
): void {
  setAutoEnrichmentFetcher(fetcher);
}

export async function shouldAutoFetchEnrichmentForContent(): Promise<boolean> {
  const manualOnly = await getManualOnlyModeForContent();
  return !manualOnly;
}

export async function attemptAutoEnrichmentFetch(
  payload: HoverCardOverlayPayload
): Promise<boolean> {
  if (!(await shouldAutoFetchEnrichmentForContent())) {
    return false;
  }

  if (!autoEnrichmentFetcher) {
    return true;
  }

  await autoEnrichmentFetcher(payload);
  return true;
}
