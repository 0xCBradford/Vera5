import { describe, expect, it } from "vitest";
import { buildExtensionSitePermissionsUrl } from "./extensionSitePermissions";

describe("buildExtensionSitePermissionsUrl", () => {
  it("builds the Chrome site permissions URL for the current extension id", () => {
    expect(
      buildExtensionSitePermissionsUrl("blciafepknkbglcplpaflbomcchbaehn")
    ).toBe(
      "chrome://settings/content/siteDetails?site=chrome-extension%3A%2F%2Fblciafepknkbglcplpaflbomcchbaehn"
    );
  });
});
