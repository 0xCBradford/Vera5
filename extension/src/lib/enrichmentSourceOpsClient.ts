import { safeRuntimeSendMessage } from "./extensionContext";
import {
  isEnrichmentSourceOpsSnapshot,
  type EnrichmentSourceOpsSnapshot,
} from "./enrichmentSourceOps";
import {
  getEnrichmentSourceOpsMessage,
  type MessageResponse,
} from "./messages";

export async function requestEnrichmentSourceOps(): Promise<EnrichmentSourceOpsSnapshot | null> {
  const response = (await safeRuntimeSendMessage(
    getEnrichmentSourceOpsMessage()
  )) as MessageResponse | null;

  if (!response?.ok || response.payload === undefined) {
    return null;
  }

  if (!isEnrichmentSourceOpsSnapshot(response.payload)) {
    return null;
  }

  return response.payload;
}
