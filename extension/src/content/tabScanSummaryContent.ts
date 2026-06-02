import { requestTabScanSummary } from "../lib/tabScanSummaryClient";
import type { TabScanSummary } from "../lib/tabScanSummary";

export async function getTabScanSummaryForCurrentTab(): Promise<TabScanSummary | null> {
  return requestTabScanSummary();
}
