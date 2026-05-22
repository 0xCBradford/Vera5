import { describe, expect, it } from "vitest";
import { EXTENSION_PACKAGE_NAME } from "./scaffold";

describe("extension package", () => {
  it("exports package identifier", () => {
    expect(EXTENSION_PACKAGE_NAME).toBe("vera5-extension");
  });
});
