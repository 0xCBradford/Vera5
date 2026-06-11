import { safeRuntimeSendMessage } from "./extensionContext";
import {
  archiveInvestigationSessionMessage,
  createInvestigationSessionMessage,
  deleteInvestigationSessionMessage,
  getActiveInvestigationSessionMessage,
  listInvestigationSessionsMessage,
  type MessageResponse,
  renameInvestigationSessionMessage,
  reopenInvestigationSessionMessage,
  updateInvestigationSessionTitleMessage,
} from "./messages";
import {
  isInvestigationSession,
  type InvestigationSession,
} from "./investigationSession";

function parseActiveInvestigationSessionResponse(
  response: MessageResponse | null
): InvestigationSession | null {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const session = (response.payload as { session?: unknown }).session;
  if (session === null || session === undefined) {
    return null;
  }
  if (!isInvestigationSession(session)) {
    return null;
  }
  return session;
}

function parseInvestigationSessionMutationResponse(
  response: MessageResponse | null
): InvestigationSession | null {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const session = (response.payload as { session?: unknown }).session;
  if (!isInvestigationSession(session)) {
    return null;
  }
  return session;
}

function parseInvestigationSessionListResponse(
  response: MessageResponse | null
): InvestigationSession[] {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return [];
  }

  const sessions = (response.payload as { sessions?: unknown }).sessions;
  if (!Array.isArray(sessions)) {
    return [];
  }

  return sessions.filter((session): session is InvestigationSession =>
    isInvestigationSession(session)
  );
}

export async function requestActiveInvestigationSession(): Promise<InvestigationSession | null> {
  const response = (await safeRuntimeSendMessage(
    getActiveInvestigationSessionMessage()
  )) as MessageResponse | null;
  return parseActiveInvestigationSessionResponse(response);
}

export async function requestRecentInvestigationSessions(): Promise<InvestigationSession[]> {
  const response = (await safeRuntimeSendMessage(
    listInvestigationSessionsMessage()
  )) as MessageResponse | null;
  return parseInvestigationSessionListResponse(response);
}

export async function requestCreateInvestigationSession(input: {
  title: string;
  pageUrl: string;
}): Promise<InvestigationSession | null> {
  const response = (await safeRuntimeSendMessage(
    createInvestigationSessionMessage(input)
  )) as MessageResponse | null;
  return parseInvestigationSessionMutationResponse(response);
}

export async function requestUpdateInvestigationSessionTitle(
  title: string
): Promise<InvestigationSession | null> {
  const response = (await safeRuntimeSendMessage(
    updateInvestigationSessionTitleMessage(title)
  )) as MessageResponse | null;
  return parseInvestigationSessionMutationResponse(response);
}

export async function requestReopenInvestigationSession(
  sessionId: string
): Promise<InvestigationSession | null> {
  const response = (await safeRuntimeSendMessage(
    reopenInvestigationSessionMessage(sessionId)
  )) as MessageResponse | null;
  return parseInvestigationSessionMutationResponse(response);
}

export async function requestRenameInvestigationSession(input: {
  sessionId: string;
  title: string;
}): Promise<InvestigationSession | null> {
  const response = (await safeRuntimeSendMessage(
    renameInvestigationSessionMessage(input)
  )) as MessageResponse | null;
  return parseInvestigationSessionMutationResponse(response);
}

export async function requestArchiveInvestigationSession(
  sessionId: string
): Promise<InvestigationSession | null> {
  const response = (await safeRuntimeSendMessage(
    archiveInvestigationSessionMessage(sessionId)
  )) as MessageResponse | null;
  return parseActiveInvestigationSessionResponse(response);
}

export async function requestDeleteInvestigationSession(
  sessionId: string
): Promise<InvestigationSession | null> {
  const response = (await safeRuntimeSendMessage(
    deleteInvestigationSessionMessage(sessionId)
  )) as MessageResponse | null;
  return parseActiveInvestigationSessionResponse(response);
}

export async function resolveActiveTabPageUrl(): Promise<string> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return "";
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return typeof tab?.url === "string" ? tab.url : "";
}
