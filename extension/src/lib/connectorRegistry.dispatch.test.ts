import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  clearConnectorRegistry,
  lookupConnectorDefinition,
  registerBuiltInLiveConnectors,
} from "./connectorRegistry";
import { LIVE_ENRICHMENT_SOURCE_ORDER } from "./enrichmentSourceRegistry";

const REGISTRY_SOURCE_PATH = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "./connectorRegistry.ts"
);

const HANDLER_SOURCE_PATH = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../background/enrichmentHandler.ts"
);

describe("connector registry dispatch", () => {
  it("does not import deprecated enrichWith handlers", () => {
    const source = readFileSync(REGISTRY_SOURCE_PATH, "utf8");
    expect(source).not.toMatch(
      /enrichWith(AbuseIpdb|Otx|Urlscan|Greynoise|Shodan|Censys)/
    );
    expect(source).not.toMatch(/createLegacyConnectorDefinition/);
    expect(source).not.toMatch(/LIVE_CONNECTOR_ENRICH_HANDLERS/);
  });

  it("registers every live connector through definition builders", () => {
    clearConnectorRegistry();
    registerBuiltInLiveConnectors();

    for (const sourceId of LIVE_ENRICHMENT_SOURCE_ORDER) {
      expect(lookupConnectorDefinition(sourceId)).toBeDefined();
    }
  });

  it("routes live enrichment through enrichRegisteredLiveConnector in the handler", () => {
    const source = readFileSync(HANDLER_SOURCE_PATH, "utf8");
    expect(source).toContain("enrichRegisteredLiveConnector");
    expect(source).not.toMatch(/enrichWith(AbuseIpdb|Otx|Urlscan|Greynoise|Shodan|Censys)/);
  });
});
