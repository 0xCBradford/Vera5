import {
  safeStorageSessionGet,
  safeStorageSessionRemove,
  safeStorageSessionSet,
} from "./extensionContext";

export const POPUP_PANEL_FOCUS_STORAGE_KEY = "popupPanelFocus";

export const POPUP_PANEL = {
  INVESTIGATION_HISTORY: "investigation-history",
  SOURCE_OPERATIONS: "source-operations",
} as const;

export type PopupPanelFocus =
  (typeof POPUP_PANEL)[keyof typeof POPUP_PANEL];

const POPUP_PANEL_FOCUS_SET = new Set<string>(Object.values(POPUP_PANEL));

export function isPopupPanelFocus(value: unknown): value is PopupPanelFocus {
  return typeof value === "string" && POPUP_PANEL_FOCUS_SET.has(value);
}

export async function setPopupPanelFocus(panel: PopupPanelFocus): Promise<boolean> {
  return safeStorageSessionSet({
    [POPUP_PANEL_FOCUS_STORAGE_KEY]: panel,
  });
}

export async function readPopupPanelFocus(): Promise<PopupPanelFocus | null> {
  const result = await safeStorageSessionGet(POPUP_PANEL_FOCUS_STORAGE_KEY);
  const panel = result[POPUP_PANEL_FOCUS_STORAGE_KEY];
  return isPopupPanelFocus(panel) ? panel : null;
}

export async function clearPopupPanelFocus(): Promise<boolean> {
  return safeStorageSessionRemove(POPUP_PANEL_FOCUS_STORAGE_KEY);
}
