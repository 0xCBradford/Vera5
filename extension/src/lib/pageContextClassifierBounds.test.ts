/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS,
  PAGE_CONTEXT_TYPE,
  classifyPageContextFromDocument,
  probePageContextDomSignalsFromDocument,
} from "./pageContext";

function mountFixture(html: string): void {
  document.documentElement.innerHTML = html;
}

describe("pageContext classifier DOM probe bounds", () => {
  afterEach(() => {
    document.documentElement.innerHTML = "";
  });

  it("documents password and hidden input exclusions in classifier bounds", () => {
    expect(PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.excludedInputTypes).toEqual([
      "password",
      "hidden",
    ]);
    expect(PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.excludedDomSubtrees).toEqual([
      "iframe",
      "script",
      "style",
      "noscript",
    ]);
  });

  it("ignores password and hidden input attributes when probing DOM signals", () => {
    mountFixture(`<!DOCTYPE html><html><head><title>Internal runbook</title></head>
      <body>
        <h1>Credential reset procedure</h1>
        <input type="password" value="splunk index= sourcetype= auth" data-testid="splunk-brand" />
        <input type="hidden" value="misp event galaxy opencti" data-testid="misp-event" />
        <p class="meta">Generic documentation page for local validation only.</p>
      </body></html>`);

    const domSignals = probePageContextDomSignalsFromDocument(document);
    expect(domSignals.dataTestIdSample).toBe("");
    expect(domSignals.primaryHeadingSample.toLowerCase()).toContain("credential reset");
    expect(domSignals.metaDescriptionSample.toLowerCase()).not.toContain("splunk");
    expect(domSignals.metaDescriptionSample.toLowerCase()).not.toContain("misp");

    const classification = classifyPageContextFromDocument(
      document,
      "http://localhost:8080/sample-generic-page.html",
      1_700_000_000_000
    );
    expect(classification?.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(classification?.matchedSignals).toEqual([]);
  });

  it("ignores classification signals inside excluded script and noscript subtrees", () => {
    mountFixture(`<!DOCTYPE html><html><head><title>Internal runbook</title></head>
      <body>
        <h1>Credential reset procedure</h1>
        <script type="text/plain">
          <h1>Splunk search export</h1>
          <p class="meta">index= auth sourcetype=</p>
        </script>
        <noscript>
          <h1>Splunk search export</h1>
          <p class="meta">index= auth sourcetype=</p>
          <table><tbody><tr><td>1</td></tr><tr><td>2</td></tr><tr><td>3</td></tr><tr><td>4</td></tr></tbody></table>
        </noscript>
        <p class="meta">Generic documentation page for local validation only.</p>
      </body></html>`);

    const domSignals = probePageContextDomSignalsFromDocument(document);
    expect(domSignals.primaryHeadingSample.toLowerCase()).toContain("credential reset");
    expect(domSignals.tableRowCountEstimate).toBe(0);
    expect(domSignals.metaDescriptionSample.toLowerCase()).not.toContain("index=");

    const classification = classifyPageContextFromDocument(
      document,
      "http://localhost:8080/sample-generic-page.html",
      1_700_000_000_000
    );
    expect(classification?.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(classification?.matchedSignals).toEqual([]);
  });

  it("does not classify from off-screen iframe content beyond documented bounds", () => {
    mountFixture(`<!DOCTYPE html><html><head><title>Internal runbook</title></head>
      <body>
        <h1>Credential reset procedure</h1>
        <p class="meta">Generic documentation page for local validation only.</p>
        <iframe
          id="hidden-frame"
          style="position:absolute;left:-9999px;width:1px;height:1px"
          srcdoc="&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;head&gt;&lt;title&gt;Splunk search export&lt;/title&gt;&lt;/head&gt;&lt;body&gt;&lt;h1&gt;Splunk export&lt;/h1&gt;&lt;p class='meta'&gt;index= auth sourcetype=&lt;/p&gt;&lt;table&gt;&lt;tbody&gt;&lt;tr&gt;&lt;td&gt;1&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;2&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;3&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;4&lt;/td&gt;&lt;/tr&gt;&lt;/tbody&gt;&lt;/table&gt;&lt;/body&gt;&lt;/html&gt;"
        ></iframe>
      </body></html>`);

    const domSignals = probePageContextDomSignalsFromDocument(document);
    expect(domSignals.primaryHeadingSample.toLowerCase()).toContain("credential reset");
    expect(domSignals.documentTitle.toLowerCase()).not.toContain("splunk");
    expect(domSignals.tableRowCountEstimate).toBe(0);

    const classification = classifyPageContextFromDocument(
      document,
      "http://localhost:8080/sample-generic-page.html",
      1_700_000_000_000
    );
    expect(classification?.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(classification?.matchedSignals).toEqual([]);
  });

  it("caps table and preformatted probes at documented limits", () => {
    const extraTables = Array.from({ length: 6 }, (_, index) => {
      const rows = Array.from({ length: 40 }, () => "<tr><td>row</td></tr>").join("");
      return `<table data-table="${index}"><tbody>${rows}</tbody></table>`;
    }).join("");
    const extraPres = Array.from(
      { length: PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.maxPreformattedBlockProbeLimit + 2 },
      () => "<pre>sha256 sample hash block</pre>"
    ).join("");

    mountFixture(`<!DOCTYPE html><html><head><title>Internal runbook</title></head>
      <body>
        <h1>Credential reset procedure</h1>
        ${extraTables}
        ${extraPres}
      </body></html>`);

    const domSignals = probePageContextDomSignalsFromDocument(document);
    expect(domSignals.tableRowCountEstimate).toBe(
      PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.maxDomTableProbeLimit *
        PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.maxDomTableRowProbeLimit
    );
    expect(domSignals.preformattedBlockCount).toBe(
      PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.maxPreformattedBlockProbeLimit
    );

    const classification = classifyPageContextFromDocument(
      document,
      "http://localhost:8080/sample-generic-page.html",
      1_700_000_000_000
    );
    expect(classification?.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(classification?.matchedSignals).toEqual([]);
  });
});
