import {
  executeCommandPaletteCommand,
  filterCommandPaletteCommands,
  type CommandPaletteCommand,
} from "../lib/commandRegistry";
import { ensureVera5UiStyles } from "../lib/vera5UiStyles";
import { registerCoreCommandPaletteCommands } from "./commandPaletteCommands";
import { CONTENT_MESSAGE } from "./constants";

export const COMMAND_PALETTE_HOST_ID = "vera5-command-palette-host";
export const COMMAND_PALETTE_BACKDROP_CLASS = "vera5-command-palette-backdrop";
export const COMMAND_PALETTE_PANEL_CLASS = "vera5-command-palette-panel";
export const COMMAND_PALETTE_INPUT_CLASS = "vera5-command-palette-input";
export const COMMAND_PALETTE_LIST_CLASS = "vera5-command-palette-list";
export const COMMAND_PALETTE_ITEM_CLASS = "vera5-command-palette-item";
export const COMMAND_PALETTE_ITEM_SELECTED_CLASS =
  "vera5-command-palette-item--selected";
export const COMMAND_PALETTE_EMPTY_CLASS = "vera5-command-palette-empty";
export const COMMAND_PALETTE_HINT_CLASS = "vera5-command-palette-hint";

const COMMAND_PALETTE_ARIA_LABEL = "Vera5 command palette";
const COMMAND_PALETTE_INPUT_ARIA_LABEL = "Filter commands";
const COMMAND_PALETTE_EMPTY_MESSAGE = "No matching commands.";
const COMMAND_PALETTE_HINT_TEXT =
  "Type to filter · Enter to run · Esc to close · ↑↓ to navigate";

type CommandPaletteState = {
  open: boolean;
  query: string;
  selectedIndex: number;
};

let paletteState: CommandPaletteState = {
  open: false,
  query: "",
  selectedIndex: 0,
};

let previousFocusedElement: HTMLElement | null = null;

function getVisibleCommands(query: string): CommandPaletteCommand[] {
  return filterCommandPaletteCommands(query);
}

function clampSelectedIndex(index: number, commandCount: number): number {
  if (commandCount <= 0) {
    return 0;
  }
  if (index < 0) {
    return commandCount - 1;
  }
  if (index >= commandCount) {
    return 0;
  }
  return index;
}

function getPaletteHost(doc: Document): HTMLElement | null {
  return doc.getElementById(COMMAND_PALETTE_HOST_ID);
}

function getPaletteInput(doc: Document): HTMLInputElement | null {
  const host = getPaletteHost(doc);
  return host?.querySelector<HTMLInputElement>(`.${COMMAND_PALETTE_INPUT_CLASS}`) ?? null;
}

function renderCommandList(doc: Document): void {
  const host = getPaletteHost(doc);
  if (!host) {
    return;
  }

  const list = host.querySelector(`.${COMMAND_PALETTE_LIST_CLASS}`);
  const empty = host.querySelector(`.${COMMAND_PALETTE_EMPTY_CLASS}`);
  if (!list || !empty) {
    return;
  }

  const commands = getVisibleCommands(paletteState.query);
  paletteState.selectedIndex = clampSelectedIndex(
    paletteState.selectedIndex,
    commands.length
  );

  list.replaceChildren();
  if (commands.length === 0) {
    empty.textContent = COMMAND_PALETTE_EMPTY_MESSAGE;
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  commands.forEach((command, index) => {
    const item = doc.createElement("button");
    item.type = "button";
    item.className = COMMAND_PALETTE_ITEM_CLASS;
    item.dataset.commandId = command.id;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", index === paletteState.selectedIndex ? "true" : "false");
    if (index === paletteState.selectedIndex) {
      item.classList.add(COMMAND_PALETTE_ITEM_SELECTED_CLASS);
    }

    const label = doc.createElement("span");
    label.className = "vera5-command-palette-item-label";
    label.textContent = command.label;
    item.appendChild(label);

    if (command.description) {
      const description = doc.createElement("span");
      description.className = "vera5-command-palette-item-description";
      description.textContent = command.description;
      item.appendChild(description);
    }

    item.addEventListener("click", () => {
      paletteState.selectedIndex = index;
      void runSelectedCommand(doc);
    });

    list.appendChild(item);
  });
}

function ensurePaletteHost(doc: Document): HTMLElement {
  ensureVera5UiStyles(doc);

  let host = getPaletteHost(doc);
  if (host) {
    return host;
  }

  host = doc.createElement("div");
  host.id = COMMAND_PALETTE_HOST_ID;
  host.hidden = true;

  const backdrop = doc.createElement("div");
  backdrop.className = COMMAND_PALETTE_BACKDROP_CLASS;
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeCommandPalette(doc);
    }
  });

  const panel = doc.createElement("div");
  panel.className = COMMAND_PALETTE_PANEL_CLASS;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", COMMAND_PALETTE_ARIA_LABEL);

  const input = doc.createElement("input");
  input.type = "search";
  input.className = COMMAND_PALETTE_INPUT_CLASS;
  input.setAttribute("aria-label", COMMAND_PALETTE_INPUT_ARIA_LABEL);
  input.autocomplete = "off";
  input.spellcheck = false;
  input.addEventListener("input", () => {
    paletteState.query = input.value;
    paletteState.selectedIndex = 0;
    renderCommandList(doc);
  });
  input.addEventListener("keydown", (event) => {
    handlePaletteKeydown(event, doc);
  });

  const list = doc.createElement("div");
  list.className = COMMAND_PALETTE_LIST_CLASS;
  list.setAttribute("role", "listbox");

  const empty = doc.createElement("p");
  empty.className = COMMAND_PALETTE_EMPTY_CLASS;
  empty.hidden = true;

  const hint = doc.createElement("p");
  hint.className = COMMAND_PALETTE_HINT_CLASS;
  hint.textContent = COMMAND_PALETTE_HINT_TEXT;

  panel.append(input, list, empty, hint);
  backdrop.appendChild(panel);
  host.appendChild(backdrop);
  doc.body.appendChild(host);

  return host;
}

function handlePaletteKeydown(event: KeyboardEvent, doc: Document): void {
  if (!paletteState.open) {
    return;
  }

  const commands = getVisibleCommands(paletteState.query);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    paletteState.selectedIndex = clampSelectedIndex(
      paletteState.selectedIndex + 1,
      commands.length
    );
    renderCommandList(doc);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    paletteState.selectedIndex = clampSelectedIndex(
      paletteState.selectedIndex - 1,
      commands.length
    );
    renderCommandList(doc);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    void runSelectedCommand(doc);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeCommandPalette(doc);
  }
}

async function runSelectedCommand(doc: Document): Promise<void> {
  const commands = getVisibleCommands(paletteState.query);
  const command = commands[paletteState.selectedIndex];
  if (!command) {
    return;
  }

  closeCommandPalette(doc);
  await executeCommandPaletteCommand(command.id);
}

export function isCommandPaletteOpen(doc: Document = document): boolean {
  const host = getPaletteHost(doc);
  return paletteState.open && host !== null && !host.hidden;
}

export function openCommandPalette(doc: Document = document): void {
  const host = ensurePaletteHost(doc);
  previousFocusedElement =
    doc.activeElement instanceof HTMLElement ? doc.activeElement : null;

  paletteState = {
    open: true,
    query: "",
    selectedIndex: 0,
  };

  host.hidden = false;
  const input = getPaletteInput(doc);
  if (input) {
    input.value = "";
  }
  renderCommandList(doc);
  input?.focus();
}

export function closeCommandPalette(doc: Document = document): void {
  paletteState.open = false;
  paletteState.query = "";
  paletteState.selectedIndex = 0;

  const host = getPaletteHost(doc);
  if (host) {
    host.hidden = true;
  }

  if (previousFocusedElement && doc.contains(previousFocusedElement)) {
    previousFocusedElement.focus();
  }
  previousFocusedElement = null;
}

export function toggleCommandPalette(doc: Document = document): void {
  if (isCommandPaletteOpen(doc)) {
    closeCommandPalette(doc);
    return;
  }
  openCommandPalette(doc);
}

export function resetCommandPaletteStateForTests(): void {
  paletteState = {
    open: false,
    query: "",
    selectedIndex: 0,
  };
  previousFocusedElement = null;
}

export function isToggleCommandPaletteMessage(
  raw: unknown
): raw is { type: typeof CONTENT_MESSAGE.TOGGLE_COMMAND_PALETTE } {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === CONTENT_MESSAGE.TOGGLE_COMMAND_PALETTE
  );
}

export function setupCommandPaletteListener(): void {
  registerCoreCommandPaletteCommands();

  chrome.runtime.onMessage.addListener((message) => {
    if (isToggleCommandPaletteMessage(message)) {
      toggleCommandPalette(document);
    }
    return false;
  });
}
