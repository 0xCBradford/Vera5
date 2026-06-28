import {
  CENSYS_SECRET_API_KEY_SLOT,
  ENRICHMENT_SOURCE,
} from "./enrichmentSourceRegistry";
import { getApiKey } from "./storage";

export const CENSYS_SOURCE_ID = ENRICHMENT_SOURCE.CENSYS;

export type CensysCredentialPair = {
  apiId: string;
  apiSecret: string;
};

export type CensysCredentialsDeps = {
  getApiId?: () => Promise<string>;
  getApiSecret?: () => Promise<string>;
};

export function formatMissingCensysCredentialsMessage(): string {
  return "Add your Censys API ID and secret in Vera5 Settings to load enrichment.";
}

export async function resolveCensysCredentials(
  deps: CensysCredentialsDeps = {}
): Promise<CensysCredentialPair | null> {
  const resolveApiId = deps.getApiId ?? (() => getApiKey(CENSYS_SOURCE_ID));
  const resolveApiSecret =
    deps.getApiSecret ?? (() => getApiKey(CENSYS_SECRET_API_KEY_SLOT));

  const apiId = (await resolveApiId()).trim();
  const apiSecret = (await resolveApiSecret()).trim();

  if (!apiId || !apiSecret) {
    return null;
  }

  return { apiId, apiSecret };
}

export async function hasCensysCredentials(
  deps: CensysCredentialsDeps = {}
): Promise<boolean> {
  return (await resolveCensysCredentials(deps)) !== null;
}
