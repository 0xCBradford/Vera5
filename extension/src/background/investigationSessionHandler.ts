import {
  isArchiveInvestigationSessionMessage,
  isCreateInvestigationSessionMessage,
  isDeleteInvestigationSessionMessage,
  isRenameInvestigationSessionMessage,
  isReopenInvestigationSessionMessage,
  isUpdateInvestigationSessionTitleMessage,
  type ArchiveInvestigationSessionMessage,
  type CreateInvestigationSessionMessage,
  type DeleteInvestigationSessionMessage,
  type MessageResponse,
  type RenameInvestigationSessionMessage,
  type ReopenInvestigationSessionMessage,
  type UpdateInvestigationSessionTitleMessage,
} from "../lib/messages";
import { isInvestigationSession } from "../lib/investigationSession";
import {
  archiveInvestigationSession,
  deleteStoredInvestigationSession,
  getActiveInvestigationSession,
  listRecentInvestigationSessions,
  renameInvestigationSession,
  reopenInvestigationSession,
  startNewInvestigationSession,
} from "../lib/investigationSessionStorage";

export async function handleGetActiveInvestigationSessionMessage(): Promise<MessageResponse> {
  const session = await getActiveInvestigationSession();
  return { ok: true, payload: { session } };
}

export async function handleListInvestigationSessionsMessage(): Promise<MessageResponse> {
  const sessions = await listRecentInvestigationSessions();
  return { ok: true, payload: { sessions } };
}

export async function handleCreateInvestigationSessionMessage(
  message: CreateInvestigationSessionMessage
): Promise<MessageResponse> {
  if (!isCreateInvestigationSessionMessage(message)) {
    return { ok: false, error: "invalid investigation session create request" };
  }

  const session = await startNewInvestigationSession({
    title: message.title,
    pageUrl: message.pageUrl,
  });
  if (!session) {
    return { ok: false, error: "could not create investigation session" };
  }

  return { ok: true, payload: { session } };
}

export async function handleUpdateInvestigationSessionTitleMessage(
  message: UpdateInvestigationSessionTitleMessage
): Promise<MessageResponse> {
  if (!isUpdateInvestigationSessionTitleMessage(message)) {
    return { ok: false, error: "invalid investigation session title update" };
  }

  const activeSession = await getActiveInvestigationSession();
  if (!activeSession) {
    return { ok: false, error: "no active investigation session" };
  }

  const session = await renameInvestigationSession({
    sessionId: activeSession.id,
    title: message.title,
  });
  if (!session) {
    return { ok: false, error: "could not rename investigation session" };
  }

  if (!isInvestigationSession(session)) {
    return { ok: false, error: "invalid investigation session" };
  }

  return { ok: true, payload: { session } };
}

export async function handleReopenInvestigationSessionMessage(
  message: ReopenInvestigationSessionMessage
): Promise<MessageResponse> {
  if (!isReopenInvestigationSessionMessage(message)) {
    return { ok: false, error: "invalid investigation session reopen request" };
  }

  const session = await reopenInvestigationSession(message.sessionId);
  if (!session) {
    return { ok: false, error: "could not reopen investigation session" };
  }

  return { ok: true, payload: { session } };
}

export async function handleRenameInvestigationSessionMessage(
  message: RenameInvestigationSessionMessage
): Promise<MessageResponse> {
  if (!isRenameInvestigationSessionMessage(message)) {
    return { ok: false, error: "invalid investigation session rename request" };
  }

  const session = await renameInvestigationSession({
    sessionId: message.sessionId,
    title: message.title,
  });
  if (!session) {
    return { ok: false, error: "could not rename investigation session" };
  }

  return { ok: true, payload: { session } };
}

export async function handleArchiveInvestigationSessionMessage(
  message: ArchiveInvestigationSessionMessage
): Promise<MessageResponse> {
  if (!isArchiveInvestigationSessionMessage(message)) {
    return { ok: false, error: "invalid investigation session archive request" };
  }

  const archived = await archiveInvestigationSession(message.sessionId);
  if (!archived) {
    return { ok: false, error: "could not archive investigation session" };
  }

  const session = await getActiveInvestigationSession();
  return { ok: true, payload: { session } };
}

export async function handleDeleteInvestigationSessionMessage(
  message: DeleteInvestigationSessionMessage
): Promise<MessageResponse> {
  if (!isDeleteInvestigationSessionMessage(message)) {
    return { ok: false, error: "invalid investigation session delete request" };
  }

  const deleted = await deleteStoredInvestigationSession(message.sessionId);
  if (!deleted) {
    return { ok: false, error: "could not delete investigation session" };
  }

  const session = await getActiveInvestigationSession();
  return { ok: true, payload: { session } };
}
