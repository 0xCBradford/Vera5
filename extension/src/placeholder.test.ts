import { describe, expect, it } from "vitest";
import { EXTENSION_SCAFFOLD } from "./placeholder";

describe("extension scaffold", () => {
  it("exports scaffold identifier", () => {
    expect(EXTENSION_SCAFFOLD).toBe("vera5-extension");
  });
});
