import { describe, expect, it } from "vitest";
import { IOC_TYPE, type IocType } from "./iocRegex";
import {
  addIocCollectionMember,
  addIocCollectionMembers,
  buildIocCollectionMemberDedupeKey,
  createIocCollection,
  generateIocCollectionId,
  IOC_COLLECTION_ID_PREFIX,
  isIocCollection,
  MAX_IOC_COLLECTION_DESCRIPTION_LENGTH,
  MAX_IOC_COLLECTION_MEMBERS,
  MAX_IOC_COLLECTION_NAME_LENGTH,
  normalizeIocCollection,
  normalizeIocCollectionDescription,
  normalizeIocCollectionMember,
  normalizeIocCollectionMembers,
  normalizeIocCollectionMemberValue,
  normalizeIocCollectionName,
} from "./iocCollection";

describe("iocCollection schema", () => {
  it("creates a collection with required fields and empty members", () => {
    const collection = createIocCollection({
      name: "  Phishing Campaign  ",
      id: "vera5-col-test-1",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    });

    expect(collection).toEqual({
      id: "vera5-col-test-1",
      name: "Phishing Campaign",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      members: [],
    });
  });

  it("includes optional description and typed members when provided", () => {
    const collection = createIocCollection({
      name: "Qakbot Investigation",
      description: "  Hunt notes  ",
      members: [
        { iocType: IOC_TYPE.IPV4, value: "  8.8.8.8  " },
        { iocType: IOC_TYPE.DOMAIN, value: "evil.example" },
        { iocType: IOC_TYPE.URL, value: "   " },
      ],
      id: "vera5-col-test-2",
      createdAt: 100,
      updatedAt: 200,
    });

    expect(collection).toEqual({
      id: "vera5-col-test-2",
      name: "Qakbot Investigation",
      description: "Hunt notes",
      createdAt: 100,
      updatedAt: 200,
      members: [
        { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { iocType: IOC_TYPE.DOMAIN, value: "evil.example" },
      ],
    });
    expect(isIocCollection(collection)).toBe(true);
  });

  it("omits description when blank", () => {
    const collection = createIocCollection({
      name: "APT29 Research",
      description: "   ",
      id: "vera5-col-test-3",
      createdAt: 100,
      updatedAt: 100,
    });

    expect(collection?.description).toBeUndefined();
  });

  it("rejects empty names and invalid timestamps", () => {
    expect(
      createIocCollection({
        name: "   ",
        id: "vera5-col-test-4",
        createdAt: 100,
        updatedAt: 100,
      })
    ).toBeNull();

    expect(
      createIocCollection({
        name: "Valid",
        id: "vera5-col-test-5",
        createdAt: 200,
        updatedAt: 100,
      })
    ).toBeNull();
  });

  it("truncates long names and descriptions", () => {
    const longName = "n".repeat(MAX_IOC_COLLECTION_NAME_LENGTH + 10);
    const longDescription = "d".repeat(MAX_IOC_COLLECTION_DESCRIPTION_LENGTH + 10);

    expect(normalizeIocCollectionName(longName)).toHaveLength(
      MAX_IOC_COLLECTION_NAME_LENGTH
    );
    expect(normalizeIocCollectionDescription(longDescription)).toHaveLength(
      MAX_IOC_COLLECTION_DESCRIPTION_LENGTH
    );
  });

  it("normalizes member values and dedupes by type plus normalized value", () => {
    expect(normalizeIocCollectionMemberValue("  185.220.101.4  ")).toBe(
      "185.220.101.4"
    );
    expect(
      normalizeIocCollectionMembers([
        { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { iocType: IOC_TYPE.IPV4, value: "  8.8.8.8 " },
        { iocType: IOC_TYPE.DOMAIN, value: "  evil.example " },
        { iocType: IOC_TYPE.URL, value: "   " },
        { iocType: "bad" as IocType, value: "8.8.8.8" },
      ])
    ).toEqual([
      { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
      { iocType: IOC_TYPE.DOMAIN, value: "evil.example" },
    ]);
  });

  it("caps members at the configured maximum", () => {
    const members = Array.from({ length: MAX_IOC_COLLECTION_MEMBERS + 5 }, (_, index) => ({
      iocType: IOC_TYPE.IPV4,
      value: `185.220.${Math.floor(index / 65536)}.${index % 65536}`,
    }));
    expect(normalizeIocCollectionMembers(members)).toHaveLength(
      MAX_IOC_COLLECTION_MEMBERS
    );
  });

  it("generates ids with the collection prefix", () => {
    expect(generateIocCollectionId(1_700_000_000_000)).toMatch(
      new RegExp(`^${IOC_COLLECTION_ID_PREFIX}`)
    );
  });

  it("validates and normalizes persisted collection records", () => {
    const raw = {
      id: "vera5-col-test-6",
      name: "Phishing Campaign",
      description: "Campaign IOCs",
      createdAt: 100,
      updatedAt: 150,
      members: [
        { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { iocType: IOC_TYPE.URL, value: "hxxps://evil[.]example/path" },
      ],
    };

    expect(isIocCollection(raw)).toBe(true);
    expect(normalizeIocCollection(raw)).toEqual(raw);
  });

  it("rejects malformed collection records", () => {
    expect(
      isIocCollection({
        id: "vera5-col-test-7",
        name: "Valid",
        createdAt: 100,
        updatedAt: 150,
        members: [{ iocType: IOC_TYPE.IPV4, value: "  untrimmed  " }],
      })
    ).toBe(false);

    expect(
      isIocCollection({
        id: "vera5-col-test-8",
        name: "Valid",
        createdAt: 100,
        updatedAt: 150,
        members: [{ iocType: IOC_TYPE.IPV4, value: "8.8.8.8" }],
        description: "   ",
      })
    ).toBe(false);

    expect(normalizeIocCollection(null)).toBeNull();
  });
});

describe("iocCollection add helpers", () => {
  it("preserves the first member type and normalized value on duplicate add", () => {
    const base = createIocCollection({
      id: "vera5-col-dedupe",
      name: "Case",
      createdAt: 100,
      updatedAt: 100,
    })!;

    const withFirst = addIocCollectionMember(
      base,
      {
        iocType: IOC_TYPE.URL,
        value: "https://evil.example/path",
      },
      150
    );

    const withDuplicate = addIocCollectionMembers(
      withFirst,
      [
        { iocType: IOC_TYPE.URL, value: "  https://evil.example/path  " },
        { iocType: IOC_TYPE.DOMAIN, value: "other.example" },
      ],
      200
    );

    expect(withDuplicate).toEqual({
      id: "vera5-col-dedupe",
      name: "Case",
      createdAt: 100,
      updatedAt: 200,
      members: [
        { iocType: IOC_TYPE.URL, value: "https://evil.example/path" },
        { iocType: IOC_TYPE.DOMAIN, value: "other.example" },
      ],
    });
  });

  it("treats the same normalized value under different types as distinct members", () => {
    const base = createIocCollection({
      id: "vera5-col-type-distinct",
      name: "Case",
      createdAt: 100,
      updatedAt: 100,
    })!;

    const updated = addIocCollectionMembers(
      base,
      [
        { iocType: IOC_TYPE.DOMAIN, value: "example.com" },
        { iocType: IOC_TYPE.URL, value: "example.com" },
      ],
      200
    );

    expect(updated.members).toEqual([
      { iocType: IOC_TYPE.DOMAIN, value: "example.com" },
      { iocType: IOC_TYPE.URL, value: "example.com" },
    ]);
    expect(
      buildIocCollectionMemberDedupeKey(updated.members[0]!)
    ).not.toBe(buildIocCollectionMemberDedupeKey(updated.members[1]!));
  });

  it("normalizes invalid member inputs to null", () => {
    expect(normalizeIocCollectionMember(null)).toBeNull();
    expect(
      normalizeIocCollectionMember({ iocType: IOC_TYPE.IPV4, value: "   " })
    ).toBeNull();
  });
});
