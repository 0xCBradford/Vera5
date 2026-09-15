import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { IocType } from "../lib/iocRegex";
import type { PageContextType } from "../lib/pageContext";
import {
  IOC_TYPE_TRAY_LABEL,
  listIocTypesPresentInSummaryForPageContext,
  type IocTypeFilter,
  type TabScanSummary,
} from "../lib/tabScanSummary";
import { partitionTrayFilterTypesForOverflow, stabilizeFilterPrimarySlotCount } from "../lib/trayFilterOverflow";

export type DetectedIndicatorsFilterRailProps = {
  summary: TabScanSummary;
  pageContextType: PageContextType | null | undefined;
  typeFilter: IocTypeFilter;
  trayShowSuppressed: boolean;
  suppressedCount: number;
  countSummaryAria: string;
  whyStillVisibleTooltip?: string;
  workspaceGeneration: number;
  activeWorkspace: string;
  onSelectAll: () => void;
  onSelectType: (type: IocType) => void;
  onSelectSuppressed: () => void;
};

type MeasuredWidths = {
  all: number;
  suppressed: number;
  more: number;
  byType: Map<IocType, number>;
  gap: number;
};

function measureFilterWidths(
  orderedTypes: IocType[],
  summary: TabScanSummary,
  suppressedCount: number
): MeasuredWidths | null {
  if (typeof document === "undefined") {
    return null;
  }

  const probe = document.createElement("div");
  probe.className = "vera5-ioc-filter-probe vera5-ioc-filter-probe--measure";
  probe.innerHTML = `
    <span class="vera5-ioc-filter-item vera5-ioc-filter-item--all" data-vera5-probe="all">
      <span class="vera5-ioc-filter-label">All</span>
      <span class="vera5-ioc-filter-count">${summary.totalCount}</span>
    </span>
    ${orderedTypes
      .map(
        (type) =>
          `<span class="vera5-ioc-filter-item" data-vera5-probe="${type}" data-ioc-type="${type}">
            <span class="vera5-ioc-filter-label">${IOC_TYPE_TRAY_LABEL[type]}</span>
            <span class="vera5-ioc-filter-count">${summary.countByType[type] ?? 0}</span>
          </span>`
      )
      .join("")}
    <span class="vera5-ioc-filter-item vera5-ioc-filter-item--more" data-vera5-probe="more">
      <span class="vera5-ioc-filter-label">More</span>
      <span class="vera5-ioc-filter-more-badge">99</span>
    </span>
    <span class="vera5-ioc-filter-item vera5-ioc-filter-item--suppressed" data-vera5-probe="suppressed">
      <span class="vera5-ioc-filter-label">Suppressed</span>
      <span class="vera5-ioc-filter-count">${suppressedCount}</span>
    </span>`;
  document.body.appendChild(probe);

  const gap = Number.parseFloat(getComputedStyle(probe).columnGap || "0") || 4;
  const allEl = probe.querySelector<HTMLElement>('[data-vera5-probe="all"]');
  const suppressedEl = probe.querySelector<HTMLElement>('[data-vera5-probe="suppressed"]');
  const moreEl = probe.querySelector<HTMLElement>('[data-vera5-probe="more"]');
  if (!allEl || !suppressedEl || !moreEl) {
    probe.remove();
    return null;
  }

  const byType = new Map<IocType, number>();
  for (const type of orderedTypes) {
    const el = probe.querySelector<HTMLElement>(`[data-vera5-probe="${type}"]`);
    if (el) {
      byType.set(type, el.offsetWidth);
    }
  }

  const widths: MeasuredWidths = {
    all: allEl.offsetWidth,
    suppressed: suppressedEl.offsetWidth,
    more: moreEl.offsetWidth,
    byType,
    gap,
  };
  probe.remove();
  return widths;
}

function useMeasuredFilterWidths(
  orderedTypes: IocType[],
  summary: TabScanSummary,
  suppressedCount: number
): MeasuredWidths | null {
  const [widths, setWidths] = useState<MeasuredWidths | null>(null);

  useLayoutEffect(() => {
    setWidths(measureFilterWidths(orderedTypes, summary, suppressedCount));
  }, [orderedTypes, summary, suppressedCount]);

  return widths;
}

/**
 * Phase 16F — when all types fit: reserve ALL + SUPPRESSED.
 * When overflow: reserve ALL + MORE only (SUPPRESSED moves into MORE; MORE is last).
 */
function countPrimarySlots(
  containerWidth: number,
  widths: MeasuredWidths,
  orderedTypes: IocType[],
  activeType: IocType | null
): number {
  if (containerWidth <= 0 || orderedTypes.length === 0) {
    return orderedTypes.length;
  }

  const typeWidth = (type: IocType) => widths.byType.get(type) ?? 0;
  const allTypesWidth =
    orderedTypes.reduce((sum, type) => sum + typeWidth(type), 0) +
    widths.gap * Math.max(0, orderedTypes.length - 1);

  const noOverflowFixed = widths.all + widths.suppressed + widths.gap * 2;
  if (noOverflowFixed + allTypesWidth <= containerWidth) {
    return orderedTypes.length;
  }

  // Overflow mode: ALL + visible types + MORE (Suppressed not on primary rail).
  let budget = containerWidth - widths.all - widths.more - widths.gap * 2;
  if (budget <= 0) {
    return activeType && orderedTypes.includes(activeType) ? 1 : 0;
  }

  let slots = 0;
  for (const type of orderedTypes) {
    const next = typeWidth(type) + (slots > 0 ? widths.gap : 0);
    if (next > budget) {
      break;
    }
    budget -= next;
    slots += 1;
  }

  if (activeType && orderedTypes.includes(activeType) && slots === 0) {
    return 1;
  }

  return slots;
}

export function DetectedIndicatorsFilterRail({
  summary,
  pageContextType,
  typeFilter,
  trayShowSuppressed,
  suppressedCount,
  countSummaryAria,
  whyStillVisibleTooltip,
  workspaceGeneration,
  activeWorkspace,
  onSelectAll,
  onSelectType,
  onSelectSuppressed,
}: DetectedIndicatorsFilterRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const primarySlotsRef = useRef(0);
  const lastAppliedWidthRef = useRef(0);

  const orderedTypes = useMemo(
    () => listIocTypesPresentInSummaryForPageContext(summary, pageContextType),
    [summary, pageContextType]
  );

  const activeType =
    !trayShowSuppressed && typeFilter !== "all" ? typeFilter : null;

  const measuredWidths = useMeasuredFilterWidths(orderedTypes, summary, suppressedCount);

  useLayoutEffect(() => {
    primarySlotsRef.current = 0;
    lastAppliedWidthRef.current = 0;
  }, [orderedTypes, summary, suppressedCount]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    const update = () => setContainerWidth(rail.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(rail);
    return () => ro.disconnect();
  }, [orderedTypes, summary, suppressedCount]);

  const maxPrimarySlots = useMemo(() => {
    if (!measuredWidths) {
      return orderedTypes.length;
    }
    const proposed = countPrimarySlots(
      containerWidth,
      measuredWidths,
      orderedTypes,
      activeType
    );
    const stabilized = stabilizeFilterPrimarySlotCount({
      proposed,
      previous: primarySlotsRef.current,
      orderedTypeCount: orderedTypes.length,
      containerWidth,
      lastAppliedWidth: lastAppliedWidthRef.current,
    });
    if (stabilized !== primarySlotsRef.current) {
      primarySlotsRef.current = stabilized;
      lastAppliedWidthRef.current = containerWidth;
    }
    return stabilized;
  }, [measuredWidths, containerWidth, orderedTypes, activeType]);

  const { primary, overflow } = useMemo(
    () => partitionTrayFilterTypesForOverflow(orderedTypes, maxPrimarySlots, activeType),
    [orderedTypes, maxPrimarySlots, activeType]
  );

  const showMore = overflow.length > 0;
  const moreHiddenTypeCount = overflow.length;
  /** When MORE exists, Suppressed lives inside MORE; MORE remains the final rail control. */
  const suppressedInMore = showMore;

  useEffect(() => {
    setMoreOpen(false);
  }, [workspaceGeneration, activeWorkspace]);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        moreMenuRef.current?.contains(target) ||
        moreTriggerRef.current?.contains(target)
      ) {
        return;
      }
      setMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setMoreOpen(false);
      moreTriggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const selectType = useCallback(
    (type: IocType) => {
      onSelectType(type);
      setMoreOpen(false);
    },
    [onSelectType]
  );

  const selectSuppressed = useCallback(() => {
    onSelectSuppressed();
    setMoreOpen(false);
  }, [onSelectSuppressed]);

  const renderTypeButton = (type: IocType, inMenu = false) => {
    const count = summary.countByType[type] ?? 0;
    const pressed = !trayShowSuppressed && typeFilter === type;
    const label = IOC_TYPE_TRAY_LABEL[type];
    return (
      <button
        key={inMenu ? `menu-${type}` : type}
        type="button"
        className={`vera5-ioc-filter-item${inMenu ? " vera5-ioc-filter-item--menu" : ""}`}
        data-ioc-type={type}
        role={inMenu ? "menuitem" : undefined}
        aria-pressed={inMenu ? undefined : pressed}
        aria-current={inMenu && pressed ? "true" : undefined}
        onClick={() => selectType(type)}
      >
        {inMenu ? (
          <span className="vera5-ioc-type-badge" aria-hidden="true">
            <span className="vera5-ioc-type-badge-label">{label}</span>
          </span>
        ) : null}
        <span className="vera5-ioc-filter-label">{label}</span>
        <span className="vera5-ioc-filter-count">{count}</span>
      </button>
    );
  };

  const renderSuppressedButton = (inMenu: boolean) => (
    <button
      key={inMenu ? "menu-suppressed" : "suppressed"}
      type="button"
      className={`vera5-ioc-filter-item vera5-ioc-filter-item--suppressed${
        inMenu ? " vera5-ioc-filter-item--menu" : ""
      }`}
      data-ioc-type="suppressed"
      data-vera5-tray-suppressed-filter="true"
      role={inMenu ? "menuitem" : undefined}
      aria-pressed={inMenu ? undefined : trayShowSuppressed}
      aria-current={inMenu && trayShowSuppressed ? "true" : undefined}
      title={whyStillVisibleTooltip}
      onClick={selectSuppressed}
    >
      <span className="vera5-ioc-filter-label">Suppressed</span>
      <span className="vera5-ioc-filter-count">{suppressedCount}</span>
    </button>
  );

  const moreReflectsSuppressed = suppressedInMore && trayShowSuppressed;

  return (
    <div className="vera5-ioc-filter-rail" ref={railRef}>
      <div
        className="vera5-ioc-filter-rail-primary"
        role="group"
        aria-label={`Filter by indicator type. ${countSummaryAria}`}
      >
        <button
          type="button"
          className="vera5-ioc-filter-item vera5-ioc-filter-item--all"
          data-ioc-type="all"
          aria-pressed={!trayShowSuppressed && typeFilter === "all"}
          onClick={onSelectAll}
        >
          <span className="vera5-ioc-filter-label">All</span>
          <span className="vera5-ioc-filter-count">{summary.totalCount}</span>
        </button>

        {primary.map((type) => renderTypeButton(type))}

        {showMore ? (
          <button
            type="button"
            ref={moreTriggerRef}
            className={`vera5-ioc-filter-item vera5-ioc-filter-item--more${
              moreReflectsSuppressed ? " vera5-ioc-filter-item--more-suppressed" : ""
            }`}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-controls="vera5-ioc-filter-more-menu"
            aria-pressed={moreReflectsSuppressed || undefined}
            aria-label={
              moreReflectsSuppressed
                ? `Suppressed filter active. ${moreHiddenTypeCount} more indicator type${
                    moreHiddenTypeCount === 1 ? "" : "s"
                  }`
                : `${moreHiddenTypeCount} more indicator type${
                    moreHiddenTypeCount === 1 ? "" : "s"
                  }, including Suppressed`
            }
            onClick={() => setMoreOpen((open) => !open)}
          >
            <span className="vera5-ioc-filter-label">
              {moreReflectsSuppressed ? "Suppressed" : "More"}
            </span>
            <span className="vera5-ioc-filter-more-badge" aria-hidden="true">
              {moreReflectsSuppressed ? suppressedCount : moreHiddenTypeCount}
            </span>
          </button>
        ) : (
          renderSuppressedButton(false)
        )}
      </div>

      {showMore && moreOpen ? (
        <div
          ref={moreMenuRef}
          id="vera5-ioc-filter-more-menu"
          className="vera5-ioc-filter-more-menu"
          role="menu"
          aria-label="More indicator types"
        >
          {overflow.map((type) => renderTypeButton(type, true))}
          <div className="vera5-ioc-filter-more-separator" role="separator" />
          {renderSuppressedButton(true)}
        </div>
      ) : null}
    </div>
  );
}
