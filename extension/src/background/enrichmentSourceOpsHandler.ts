import { buildEnrichmentSourceOpsSnapshot } from "../lib/enrichmentSourceOps";
import {
  getGlobalEnrichmentCooldownRemainingSeconds,
  isGlobalEnrichmentCooldownActive,
} from "../lib/enrichmentCooldown";
import type { MessageResponse } from "../lib/messages";

export async function handleGetEnrichmentSourceOpsMessage(): Promise<MessageResponse> {
  const snapshot = await buildEnrichmentSourceOpsSnapshot({
    globalCooldownRemainingSeconds: getGlobalEnrichmentCooldownRemainingSeconds(),
    globalCooldownActive: isGlobalEnrichmentCooldownActive(),
  });
  return { ok: true, payload: snapshot };
}
