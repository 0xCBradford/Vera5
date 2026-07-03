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

export const MAX_CO_OCCURRENCE_DISPLAY_VALUE_LENGTH = 64;

export type HoverCardCoOccurrenceEntry = {
  iocType: IocType;
  value: string;
  anchorId: string;
};

export type HoverCardCoOccurrencePanelView = {
  entries: HoverCardCoOccurrenceEntry[];
  contextLabel: string | null;
};

export type CoOccurrenceEntryDisplay = {
  anchorId: string;
  iocType: IocType;
  typeLabel: string;
  displayValue: string;
  fullValue: string;
  contextLabel: string | null;
};

export function truncateCoOccurrenceDisplayValue(
  value: string,
  maxLength: number = MAX_CO_OCCURRENCE_DISPLAY_VALUE_LENGTH
): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  if (maxLength <= 1) {
    return "…";
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

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

export function buildCoOccurrenceEntryDisplay(input: {
  anchorId: string;
  iocType: IocType;
  value: string;
  contextLabel?: string | null;
  maxValueLength?: number;
}): CoOccurrenceEntryDisplay {
  const fullValue = input.value.trim();
  const contextLabel = input.contextLabel?.trim() || null;
  return {
    anchorId: input.anchorId,
    iocType: input.iocType,
    typeLabel: IOC_TYPE_TRAY_LABEL[input.iocType],
    displayValue: truncateCoOccurrenceDisplayValue(fullValue, input.maxValueLength),
    fullValue,
    contextLabel,
  };
}

export function formatCoOccurrenceEntryDisplayLine(
  display: CoOccurrenceEntryDisplay
): string {
  return `${display.typeLabel} · ${display.displayValue}`;
}

export function formatCoOccurrenceEntryAccessibleLabel(
  display: CoOccurrenceEntryDisplay
): string {
  const parts = [display.typeLabel, display.fullValue];
  if (display.contextLabel) {
    parts.push(display.contextLabel);
  }
  return parts.join(", ");
}

export function formatCoOccurrenceEntryNavigateAriaLabel(
  display: CoOccurrenceEntryDisplay
): string {
  return `View ${display.fullValue} on page`;
}

export function buildCoOccurrenceEntryDisplaysForView(
  view: HoverCardCoOccurrencePanelView
): CoOccurrenceEntryDisplay[] {
  return view.entries.map((entry) =>
    buildCoOccurrenceEntryDisplay({
      anchorId: entry.anchorId,
      iocType: entry.iocType,
      value: entry.value,
      contextLabel: view.contextLabel,
    })
  );
}

export function formatHoverCardCoOccurrenceEntryLine(input: {
  iocType: IocType;
  value: string;
}): string {
  return formatCoOccurrenceEntryDisplayLine(
    buildCoOccurrenceEntryDisplay({
      anchorId: "",
      iocType: input.iocType,
      value: input.value,
    })
  );
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

export type CoOccurrenceListKeyAction =
  | "focus-previous"
  | "focus-next"
  | "focus-first"
  | "focus-last";

export function resolveCoOccurrenceListKeyAction(
  key: string
): CoOccurrenceListKeyAction | null {
  switch (key) {
    case "ArrowDown":
      return "focus-next";
    case "ArrowUp":
      return "focus-previous";
    case "Home":
      return "focus-first";
    case "End":
      return "focus-last";
    default:
      return null;
  }
}

export function resolveAdjacentCoOccurrenceListIndex(
  currentIndex: number,
  action: CoOccurrenceListKeyAction,
  itemCount: number
): number {
  if (itemCount <= 0) {
    return 0;
  }
  if (action === "focus-first") {
    return 0;
  }
  if (action === "focus-last") {
    return itemCount - 1;
  }
  const delta = action === "focus-next" ? 1 : -1;
  return (currentIndex + delta + itemCount) % itemCount;
}

export function focusAdjacentCoOccurrenceListItem(
  currentButton: HTMLButtonElement,
  action: CoOccurrenceListKeyAction,
  itemSelector: string
): void {
  const list = currentButton.closest("ul");
  if (!list) {
    return;
  }
  const buttons = Array.from(
    list.querySelectorAll<HTMLButtonElement>(itemSelector)
  );
  const currentIndex = buttons.indexOf(currentButton);
  if (currentIndex === -1) {
    return;
  }
  const nextIndex = resolveAdjacentCoOccurrenceListIndex(
    currentIndex,
    action,
    buttons.length
  );
  buttons[nextIndex]?.focus();
}

export function handleCoOccurrenceListItemKeyDown(
  event: Pick<
    KeyboardEvent,
    "key" | "currentTarget" | "preventDefault" | "stopPropagation"
  >,
  itemSelector: string
): boolean {
  const action = resolveCoOccurrenceListKeyAction(event.key);
  if (!action) {
    return false;
  }
  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement)) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  focusAdjacentCoOccurrenceListItem(target, action, itemSelector);
  return true;
}
