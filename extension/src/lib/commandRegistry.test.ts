import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCommandPaletteCommands,
  executeCommandPaletteCommand,
  filterCommandPaletteCommands,
  listCommandPaletteCommands,
  registerCommandPaletteCommand,
  unregisterCommandPaletteCommand,
} from "./commandRegistry";

describe("commandRegistry", () => {
  afterEach(() => {
    clearCommandPaletteCommands();
  });

  it("registers, lists, and unregisters commands in label order", () => {
    registerCommandPaletteCommand({
      id: "scan-page",
      label: "Scan page",
      run: () => undefined,
    });
    registerCommandPaletteCommand({
      id: "open-options",
      label: "Open settings",
      run: () => undefined,
    });

    expect(listCommandPaletteCommands().map((command) => command.id)).toEqual([
      "open-options",
      "scan-page",
    ]);

    expect(unregisterCommandPaletteCommand("scan-page")).toBe(true);
    expect(listCommandPaletteCommands().map((command) => command.id)).toEqual([
      "open-options",
    ]);
  });

  it("filters commands by label, description, and keywords", () => {
    registerCommandPaletteCommand({
      id: "scan-page",
      label: "Scan page",
      description: "Detect indicators in visible text",
      keywords: ["ioc", "detect"],
      run: () => undefined,
    });
    registerCommandPaletteCommand({
      id: "open-options",
      label: "Open settings",
      run: () => undefined,
    });

    expect(filterCommandPaletteCommands("detect").map((command) => command.id)).toEqual([
      "scan-page",
    ]);
    expect(filterCommandPaletteCommands("settings").map((command) => command.id)).toEqual([
      "open-options",
    ]);
    expect(filterCommandPaletteCommands("")).toHaveLength(2);
  });

  it("omits disabled commands from filtered results", () => {
    registerCommandPaletteCommand({
      id: "scan-page",
      label: "Scan page",
      isEnabled: () => false,
      run: () => undefined,
    });

    expect(filterCommandPaletteCommands("")).toEqual([]);
  });

  it("executes a registered command", async () => {
    const run = vi.fn();
    registerCommandPaletteCommand({
      id: "scan-page",
      label: "Scan page",
      run,
    });

    await expect(executeCommandPaletteCommand("scan-page")).resolves.toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("returns false when executing an unknown or disabled command", async () => {
    const run = vi.fn();
    registerCommandPaletteCommand({
      id: "scan-page",
      label: "Scan page",
      isEnabled: () => false,
      run,
    });

    await expect(executeCommandPaletteCommand("missing")).resolves.toBe(false);
    await expect(executeCommandPaletteCommand("scan-page")).resolves.toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});
