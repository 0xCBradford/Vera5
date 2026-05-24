import type { EnrichmentSourceResult } from "./enrichment";
import { ENRICHMENT_SOURCE } from "./hoverCardEnrichment";
import type { EnrichmentSourceId } from "./hoverCardEnrichment";
import type { IocType } from "./iocRegex";
import {
  enrichIocMessage,
  type EnrichIocMessage,
  type MessageResponse,
} from "./messages";

export type EnrichmentRequestInput = {
  value: string;
  iocType: IocType;
  sourceId?: EnrichmentSourceId;
};

function isEnrichIocSuccessPayload(
  payload: unknown
): payload is { source: EnrichmentSourceResult } {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const record = payload as Record<string, unknown>;
  const source = record.source;
  if (typeof source !== "object" || source === null) {
    return false;
  }
  const sourceRecord = source as Record<string, unknown>;
  return (
    typeof sourceRecord.sourceId === "string" &&
    typeof sourceRecord.sourceLabel === "string" &&
    typeof sourceRecord.status === "string"
  );
}

export function buildEnrichIocMessage(
  input: EnrichmentRequestInput
): EnrichIocMessage {
  return enrichIocMessage({
    value: input.value,
    iocType: input.iocType,
    sourceId: input.sourceId ?? ENRICHMENT_SOURCE.ABUSEIPDB,
  });
}

export async function requestEnrichmentFromBackground(
  input: EnrichmentRequestInput
): Promise<EnrichmentSourceResult | null> {
  const message = buildEnrichIocMessage(input);
  const response = (await chrome.runtime.sendMessage(message)) as MessageResponse;

  if (!response?.ok) {
    return null;
  }

  if (!isEnrichIocSuccessPayload(response.payload)) {
    return null;
  }

  return response.payload.source;
}
