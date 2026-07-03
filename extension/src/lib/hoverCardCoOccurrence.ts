import {
  buildIocCoOccurrenceMemberKey,
  listCoOccurringMembersForKey,
  type IocCoOccurrenceMember,
  type PageIocCoOccurrenceIndex,
} from "./iocCoOccurrence";
import { getPageIocCoOccurrenceIndexForSession } from "./iocCoOccurrenceStorage";
import { getActiveInvestigationSession } from "./investigationSessionStorage";
import type { IocType } from "./iocRegex";
import { IOC_TYPE_TRAY_LABEL } from "./tabScanSummary";

export type HoverCardCoOccurrenceEntry = {
  iocType: IocType;
  value: string;
  anchorId: string;
};

export type HoverCardCoOccurrencePanelView = {
  entries: HoverCardCoOccurrenceEntry[];
  contextLabel: string | null;
};

export function resolveCoOccurrenceContextLabelForMember(
  pageIndex: PageIocCoOccurrenceIndex,
  memberKey: string
): string | null {
  for (const group of pageIndex.groups) {
    if (group.memberKeys.includes(memberKey)) {
      return group.contextLabel;
    }
  }
  return null;
}

export function mapCoOccurrenceMembersToHoverCardEntries(
  members: readonly IocCoOccurrenceMember[]
): HoverCardCoOccurrenceEntry[] {
  return members.map((member) => ({
    iocType: member.iocType,
    value: member.value,
    anchorId: member.anchorId,
  }));
}

export function formatHoverCardCoOccurrenceEntryLine(input: {
  iocType: IocType;
  value: string;
}): string {
  return `${IOC_TYPE_TRAY_LABEL[input.iocType]} · ${input.value}`;
}

export function buildHoverCardCoOccurrencePanelView(input: {
  iocType: IocType;
  value: string;
  pageIndex: PageIocCoOccurrenceIndex | null;
}): HoverCardCoOccurrencePanelView {
  if (!input.pageIndex) {
    return { entries: [], contextLabel: null };
  }

  const memberKey = buildIocCoOccurrenceMemberKey(input.iocType, input.value);
  const members = listCoOccurringMembersForKey(input.pageIndex, memberKey);

  return {
    contextLabel: resolveCoOccurrenceContextLabelForMember(input.pageIndex, memberKey),
    entries: mapCoOccurrenceMembersToHoverCardEntries(members),
  };
}

export async function loadHoverCardCoOccurrencePanelView(input: {
  iocType: IocType;
  value: string;
  pageUrl: string;
}): Promise<HoverCardCoOccurrencePanelView> {
  const session = await getActiveInvestigationSession();
  if (!session) {
    return { entries: [], contextLabel: null };
  }

  const pageIndex = await getPageIocCoOccurrenceIndexForSession({
    sessionId: session.id,
    pageUrl: input.pageUrl,
  });

  return buildHoverCardCoOccurrencePanelView({
    iocType: input.iocType,
    value: input.value,
    pageIndex,
  });
}

export function shouldShowTrayCoOccurrenceExpander(
  view: HoverCardCoOccurrencePanelView
): boolean {
  return view.entries.length > 0;
}
