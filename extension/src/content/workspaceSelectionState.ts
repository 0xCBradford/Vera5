import type { HoverCardOverlayPayload } from "./hoverCardOverlay";

type WorkspaceSelectionState = {
  open: boolean;
  selectedAnchorId: string | null;
  payloadValue: string | null;
};

let selectionState: WorkspaceSelectionState = {
  open: false,
  selectedAnchorId: null,
  payloadValue: null,
};

let workspacePayloadUpdateHandler:
  | ((payload: HoverCardOverlayPayload, doc: Document) => void)
  | null = null;

export function registerWorkspacePayloadUpdateHandler(
  handler: (payload: HoverCardOverlayPayload, doc: Document) => void
): void {
  workspacePayloadUpdateHandler = handler;
}

export function setWorkspaceSelectionState(input: {
  open: boolean;
  selectedAnchorId?: string | null;
  payloadValue?: string | null;
}): void {
  selectionState = {
    open: input.open,
    selectedAnchorId:
      input.selectedAnchorId === undefined
        ? selectionState.selectedAnchorId
        : input.selectedAnchorId,
    payloadValue:
      input.payloadValue === undefined
        ? selectionState.payloadValue
        : input.payloadValue,
  };
}

export function clearWorkspaceSelectionState(): void {
  selectionState = {
    open: selectionState.open,
    selectedAnchorId: null,
    payloadValue: null,
  };
}

export function isWorkspaceTargetForPayload(
  payload: HoverCardOverlayPayload,
  doc: Document = document
): boolean {
  if (!selectionState.open) {
    return false;
  }
  if (selectionState.payloadValue !== payload.value) {
    return false;
  }
  return doc.getElementById("vera5-workspace-host") !== null;
}

export function tryUpdateWorkspaceDetailPayload(
  payload: HoverCardOverlayPayload,
  doc: Document = document
): boolean {
  if (!isWorkspaceTargetForPayload(payload, doc) || !workspacePayloadUpdateHandler) {
    return false;
  }
  workspacePayloadUpdateHandler(payload, doc);
  return true;
}

export function resetWorkspaceSelectionStateForTests(): void {
  selectionState = {
    open: false,
    selectedAnchorId: null,
    payloadValue: null,
  };
  workspacePayloadUpdateHandler = null;
}
