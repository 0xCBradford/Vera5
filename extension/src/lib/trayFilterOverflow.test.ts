import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  FILTER_PRIMARY_SLOT_HYSTERESIS_PX,
  partitionTrayFilterTypesForOverflow,
  stabilizeFilterPrimarySlotCount,
} from "./trayFilterOverflow";

describe("partitionTrayFilterTypesForOverflow", () => {
  const ordered = [
    IOC_TYPE.URL,
    IOC_TYPE.IPV4,
    IOC_TYPE.DOMAIN,
    IOC_TYPE.SHA256,
    IOC_TYPE.ASN,
  ] as const;

  it("keeps all types in primary when slots allow", () => {
    expect(partitionTrayFilterTypesForOverflow(ordered, 5, null)).toEqual({
      primary: [...ordered],
      overflow: [],
    });
  });

  it("preserves canonical order in primary and overflow", () => {
    const result = partitionTrayFilterTypesForOverflow(ordered, 2, null);
    expect(result.primary).toEqual([IOC_TYPE.URL, IOC_TYPE.IPV4]);
    expect(result.overflow).toEqual([IOC_TYPE.DOMAIN, IOC_TYPE.SHA256, IOC_TYPE.ASN]);
  });

  it("promotes active overflow type into primary rail", () => {
    const result = partitionTrayFilterTypesForOverflow(ordered, 2, IOC_TYPE.SHA256);
    expect(result.primary).toContain(IOC_TYPE.SHA256);
    expect(result.overflow).not.toContain(IOC_TYPE.SHA256);
    expect(result.primary.length).toBe(2);
  });

  it("does not sort by count — order follows input array", () => {
    const result = partitionTrayFilterTypesForOverflow(ordered, 3, null);
    expect(result.primary.map((t) => t)).toEqual([
      IOC_TYPE.URL,
      IOC_TYPE.IPV4,
      IOC_TYPE.DOMAIN,
    ]);
  });
});

describe("stabilizeFilterPrimarySlotCount", () => {
  it("exports a meaningful hysteresis band", () => {
    expect(FILTER_PRIMARY_SLOT_HYSTERESIS_PX).toBeGreaterThanOrEqual(8);
  });

  it("holds prior slot count when width delta is below hysteresis", () => {
    expect(
      stabilizeFilterPrimarySlotCount({
        proposed: 3,
        previous: 2,
        orderedTypeCount: 5,
        containerWidth: 400,
        lastAppliedWidth: 392,
      })
    ).toBe(2);
  });

  it("applies slot change when width delta exceeds hysteresis", () => {
    expect(
      stabilizeFilterPrimarySlotCount({
        proposed: 3,
        previous: 2,
        orderedTypeCount: 5,
        containerWidth: 420,
        lastAppliedWidth: 392,
      })
    ).toBe(3);
  });

  it("applies immediately when transitioning between full-fit and overflow", () => {
    expect(
      stabilizeFilterPrimarySlotCount({
        proposed: 5,
        previous: 3,
        orderedTypeCount: 5,
        containerWidth: 600,
        lastAppliedWidth: 598,
      })
    ).toBe(5);
  });

  it("leaves unchanged when proposed equals previous", () => {
    expect(
      stabilizeFilterPrimarySlotCount({
        proposed: 2,
        previous: 2,
        orderedTypeCount: 5,
        containerWidth: 400,
        lastAppliedWidth: 400,
      })
    ).toBe(2);
  });
});
