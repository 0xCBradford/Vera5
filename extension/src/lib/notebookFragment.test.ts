import { describe, expect, it } from "vitest";
import {
  MAX_NOTEBOOK_FRAGMENT_BODY_LENGTH,
  NOTEBOOK_FRAGMENT_FIELD_KEYS,
  NOTEBOOK_FRAGMENT_FORBIDDEN_BODY_PAYLOAD_PATTERNS,
  NOTEBOOK_FRAGMENT_HYPOTHESIS_UNVERIFIED_BADGE,
  NOTEBOOK_FRAGMENT_TYPE,
  NOTEBOOK_FRAGMENT_TYPES,
  NOTEBOOK_FRAGMENT_TYPE_HINT,
  NOTEBOOK_FRAGMENT_TYPE_LABEL,
  buildNotebookFragmentId,
  buildNotebookFragmentUiHintView,
  createNotebookFragment,
  formatNotebookFragmentTypeLabel,
  isNotebookFragmentType,
  normalizeNotebookFragment,
  normalizeNotebookFragmentAuthorLabel,
  normalizeNotebookFragmentBody,
  notebookFragmentBodyContainsEmbeddedBinaryOrScreenshot,
  notebookFragmentBodyExceedsMaxLength,
  notebookFragmentHasOnlyAllowlistedFields,
  resolveNotebookFragmentTypeUiHint,
} from "./notebookFragment";

describe("NotebookFragment schema", () => {
  it("accepts the four fragment types", () => {
    expect(isNotebookFragmentType("observation")).toBe(true);
    expect(isNotebookFragmentType("tag")).toBe(true);
    expect(isNotebookFragmentType("conclusion")).toBe(true);
    expect(isNotebookFragmentType("hypothesis")).toBe(true);
    expect(isNotebookFragmentType("note")).toBe(false);
    expect(isNotebookFragmentType("")).toBe(false);
  });

  it("creates a fragment with id, type, body, createdAt, updatedAt", () => {
    const fragment = createNotebookFragment({
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "Seen C2 beacon in proxy logs.",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_500,
    });

    expect(fragment).toEqual({
      id: buildNotebookFragmentId({
        type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
        body: "Seen C2 beacon in proxy logs.",
      }),
      type: "observation",
      body: "Seen C2 beacon in proxy logs.",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_500,
    });
    expect(fragment).not.toHaveProperty("authorLabel");
  });

  it("includes optional authorLabel when provided", () => {
    const fragment = createNotebookFragment({
      id: "nf-custom",
      type: NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS,
      body: "Possibly related to campaign X.",
      authorLabel: "Analyst A",
      createdAt: 10,
      updatedAt: 20,
    });

    expect(fragment.authorLabel).toBe("Analyst A");
    expect(fragment.type).toBe("hypothesis");
    expect(fragment.id).toBe("nf-custom");
  });

  it("omits authorLabel when blank", () => {
    const fragment = createNotebookFragment({
      type: NOTEBOOK_FRAGMENT_TYPE.TAG,
      body: "phishing",
      authorLabel: "   ",
      createdAt: 1,
      updatedAt: 1,
    });

    expect(fragment).not.toHaveProperty("authorLabel");
  });

  it("normalizes markdown-subset body text", () => {
    expect(normalizeNotebookFragmentBody("  ## Finding\n\n- item  ")).toBe(
      "## Finding\n\n- item"
    );
    expect(normalizeNotebookFragmentBody("")).toBeNull();
    expect(normalizeNotebookFragmentBody("   ")).toBeNull();
    expect(normalizeNotebookFragmentBody(12)).toBeNull();
  });

  it("rejects bodies over the max length", () => {
    const overLimit = "a".repeat(MAX_NOTEBOOK_FRAGMENT_BODY_LENGTH + 1);
    const atLimit = "a".repeat(MAX_NOTEBOOK_FRAGMENT_BODY_LENGTH);

    expect(notebookFragmentBodyExceedsMaxLength(overLimit)).toBe(true);
    expect(notebookFragmentBodyExceedsMaxLength(atLimit)).toBe(false);
    expect(normalizeNotebookFragmentBody(overLimit)).toBeNull();
    expect(normalizeNotebookFragmentBody(atLimit)).toBe(atLimit);
    expect(() =>
      createNotebookFragment({
        type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
        body: overLimit,
      })
    ).toThrow(/at most 8192 characters/i);
  });

  it("rejects embedded binary and screenshot payloads in the body", () => {
    const cases = [
      "See capture: data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      "![shot](data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD)",
      '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">',
      "blob data:application/octet-stream;base64,AAAA",
      "attach data:application/pdf;base64,JVBERi0x",
      `raw png header iVBORw0KGgo${"A".repeat(40)}`,
      `jpeg /9j/${"A".repeat(40)}`,
      "gif R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "webp UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73",
      "binary\0payload",
    ];

    expect(NOTEBOOK_FRAGMENT_FORBIDDEN_BODY_PAYLOAD_PATTERNS.length).toBeGreaterThan(
      0
    );

    for (const body of cases) {
      expect(notebookFragmentBodyContainsEmbeddedBinaryOrScreenshot(body)).toBe(
        true
      );
      expect(normalizeNotebookFragmentBody(body)).toBeNull();
      expect(() =>
        createNotebookFragment({
          type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
          body,
        })
      ).toThrow(/binary or screenshot/i);
      expect(
        normalizeNotebookFragment({
          type: "observation",
          body,
          createdAt: 1,
          updatedAt: 1,
        })
      ).toBeNull();
    }

    expect(
      notebookFragmentBodyContainsEmbeddedBinaryOrScreenshot(
        "Plain observation about 10.0.0.1 — no media."
      )
    ).toBe(false);
  });

  it("rejects invalid type, empty body, and inverted timestamps", () => {
    expect(() =>
      createNotebookFragment({
        type: "note" as never,
        body: "x",
      })
    ).toThrow(/valid type/i);

    expect(() =>
      createNotebookFragment({
        type: NOTEBOOK_FRAGMENT_TYPE.CONCLUSION,
        body: "   ",
      })
    ).toThrow(/non-empty/i);

    expect(() =>
      createNotebookFragment({
        type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
        body: "ok",
        createdAt: 100,
        updatedAt: 50,
      })
    ).toThrow(/updatedAt/i);
  });

  it("normalizes unknown records or returns null", () => {
    expect(
      normalizeNotebookFragment({
        id: "nf-1",
        type: "conclusion",
        body: "Host is compromised.",
        createdAt: 5,
        updatedAt: 5,
        authorLabel: "Local",
      })
    ).toEqual({
      id: "nf-1",
      type: "conclusion",
      body: "Host is compromised.",
      createdAt: 5,
      updatedAt: 5,
      authorLabel: "Local",
    });

    expect(normalizeNotebookFragment(null)).toBeNull();
    expect(
      normalizeNotebookFragment({
        type: "observation",
        body: "",
      })
    ).toBeNull();
  });

  it("builds a stable id for the same type and body", () => {
    const a = buildNotebookFragmentId({
      type: NOTEBOOK_FRAGMENT_TYPE.TAG,
      body: "c2",
    });
    const b = buildNotebookFragmentId({
      type: NOTEBOOK_FRAGMENT_TYPE.TAG,
      body: "c2",
    });
    expect(a).toBe(b);
    expect(a.startsWith("nf-")).toBe(true);
  });

  it("treats authorLabel normalize failures as null for create", () => {
    expect(normalizeNotebookFragmentAuthorLabel("ok")).toBe("ok");
    expect(normalizeNotebookFragmentAuthorLabel("")).toBeUndefined();
    expect(normalizeNotebookFragmentAuthorLabel(1)).toBeNull();
  });

  it("allowlists only schema fields", () => {
    const fragment = createNotebookFragment({
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "note",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(notebookFragmentHasOnlyAllowlistedFields(fragment)).toBe(true);
    expect(
      notebookFragmentHasOnlyAllowlistedFields({
        ...fragment,
        screenshotPng: "nope",
      })
    ).toBe(false);
    expect(NOTEBOOK_FRAGMENT_FIELD_KEYS).toEqual([
      "id",
      "type",
      "body",
      "createdAt",
      "updatedAt",
      "authorLabel",
    ]);
  });

  it("exposes type-specific UI hints and Unverified badge for hypothesis", () => {
    expect(formatNotebookFragmentTypeLabel("observation")).toBe("Observation");
    expect(NOTEBOOK_FRAGMENT_TYPE_LABEL.hypothesis).toBe("Hypothesis");
    expect(NOTEBOOK_FRAGMENT_HYPOTHESIS_UNVERIFIED_BADGE).toBe("Unverified");

    for (const type of NOTEBOOK_FRAGMENT_TYPES) {
      const hint = resolveNotebookFragmentTypeUiHint(type);
      expect(hint.type).toBe(type);
      expect(hint.typeLabel).toBe(NOTEBOOK_FRAGMENT_TYPE_LABEL[type]);
      expect(hint.hint).toBe(NOTEBOOK_FRAGMENT_TYPE_HINT[type]);
      expect(hint.tone).toBe(type);
      expect(hint.cssModifier).toBe(type);

      if (type === NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS) {
        expect(hint.showStatusBadge).toBe(true);
        expect(hint.statusBadgeLabel).toBe("Unverified");
        expect(hint.hint).toMatch(/unverified/i);
      } else {
        expect(hint.showStatusBadge).toBe(false);
        expect(hint.statusBadgeLabel).toBeNull();
      }
    }

    const hypothesis = createNotebookFragment({
      id: "nf-hyp-1",
      type: NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS,
      body: "May be staging infrastructure.",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(buildNotebookFragmentUiHintView(hypothesis)).toEqual({
      type: "hypothesis",
      typeLabel: "Hypothesis",
      statusBadgeLabel: "Unverified",
      showStatusBadge: true,
      hint: NOTEBOOK_FRAGMENT_TYPE_HINT.hypothesis,
      tone: "hypothesis",
      cssModifier: "hypothesis",
      fragmentId: "nf-hyp-1",
    });

    const observation = createNotebookFragment({
      id: "nf-obs-1",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "DNS query observed.",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(buildNotebookFragmentUiHintView(observation).showStatusBadge).toBe(
      false
    );
  });
});
