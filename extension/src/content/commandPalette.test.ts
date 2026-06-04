/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCommandPaletteCommands,
  registerCommandPaletteCommand,
} from "../lib/commandRegistry";
import {
  closeCommandPalette,
  COMMAND_PALETTE_HOST_ID,
  COMMAND_PALETTE_ITEM_CLASS,
  COMMAND_PALETTE_ITEM_SELECTED_CLASS,
  isCommandPaletteOpen,
  openCommandPalette,
  resetCommandPaletteStateForTests,
  toggleCommandPalette,
} from "./commandPalette";

describe("commandPalette UI", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    resetCommandPaletteStateForTests();
    clearCommandPaletteCommands();
  });

  afterEach(() => {
    closeCommandPalette(document);
    document.body.replaceChildren();
    resetCommandPaletteStateForTests();
    clearCommandPaletteCommands();
  });

  it("opens with an empty-state message when no commands are registered", () => {
    openCommandPalette(document);

    expect(isCommandPaletteOpen(document)).toBe(true);
    expect(document.getElementById(COMMAND_PALETTE_HOST_ID)).not.toBeNull();
    expect(document.body.textContent).toContain("No matching commands.");
  });

  it("lists registered commands and filters by query", () => {
    registerCommandPaletteCommand({
      id: "scan-page",
      label: "Scan page",
      description: "Detect indicators in visible text",
      run: () => undefined,
    });
    registerCommandPaletteCommand({
      id: "open-options",
      label: "Open settings",
      run: () => undefined,
    });

    openCommandPalette(document);
    expect(document.querySelectorAll(`.${COMMAND_PALETTE_ITEM_CLASS}`)).toHaveLength(2);

    const input = document.querySelector<HTMLInputElement>(
      ".vera5-command-palette-input"
    );
    expect(input).not.toBeNull();
    input!.value = "scan";
    input!.dispatchEvent(new Event("input", { bubbles: true }));

    expect(document.querySelectorAll(`.${COMMAND_PALETTE_ITEM_CLASS}`)).toHaveLength(1);
    expect(document.body.textContent).toContain("Scan page");
  });

  it("runs the selected command on Enter and closes the palette", async () => {
    const run = vi.fn();
    registerCommandPaletteCommand({
      id: "scan-page",
      label: "Scan page",
      run,
    });

    openCommandPalette(document);
    const input = document.querySelector<HTMLInputElement>(
      ".vera5-command-palette-input"
    );
    expect(input).not.toBeNull();

    input!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await Promise.resolve();

    expect(run).toHaveBeenCalledTimes(1);
    expect(isCommandPaletteOpen(document)).toBe(false);
  });

  it("moves selection with arrow keys", () => {
    registerCommandPaletteCommand({
      id: "alpha",
      label: "Alpha command",
      run: () => undefined,
    });
    registerCommandPaletteCommand({
      id: "beta",
      label: "Beta command",
      run: () => undefined,
    });

    openCommandPalette(document);
    const input = document.querySelector<HTMLInputElement>(
      ".vera5-command-palette-input"
    );
    expect(input).not.toBeNull();

    input!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );

    const selected = document.querySelector(
      `.${COMMAND_PALETTE_ITEM_CLASS}.${COMMAND_PALETTE_ITEM_SELECTED_CLASS}`
    );
    expect(selected?.textContent).toContain("Beta command");
  });

  it("toggles open and closed", () => {
    toggleCommandPalette(document);
    expect(isCommandPaletteOpen(document)).toBe(true);

    toggleCommandPalette(document);
    expect(isCommandPaletteOpen(document)).toBe(false);
  });

  it("closes on Escape", () => {
    openCommandPalette(document);
    const input = document.querySelector<HTMLInputElement>(
      ".vera5-command-palette-input"
    );
    expect(input).not.toBeNull();

    input!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );

    expect(isCommandPaletteOpen(document)).toBe(false);
  });
});
