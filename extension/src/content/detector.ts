import type { IocMatch, IocRegexOptions, IocType } from "../lib/iocRegex";
import {
  findCvesInText,
  findDomainsInText,
  findHashesInText,
  findIpv4InText,
  findUrlsInText,
} from "../lib/iocRegex";
import type { TextWalkerSkipOptions } from "./textWalker";
import { collectIocScanTextBlocks } from "./textWalker";

export type DetectedIoc = IocMatch;

export type DetectedIocInTextNode = DetectedIoc & {
  textNode: Text;
};

export type IocDetectorScanOptions = {
  ioc?: IocRegexOptions;
  walker?: TextWalkerSkipOptions;
};

type TextSpan = { start: number; end: number };

function isIocTypeEnabledForDetection(
  type: IocType,
  enabledTypes: IocRegexOptions["enabledTypes"]
): boolean {
  if (!enabledTypes) {
    return true;
  }
  return enabledTypes[type] !== false;
}

const TYPE_PRIORITY: Record<IocType, number> = {
  url: 0,
  sha256: 1,
  sha1: 2,
  md5: 3,
  cve: 4,
  ipv4: 5,
  domain: 6,
};

function spansOverlap(a: TextSpan, b: TextSpan): boolean {
  return a.start < b.end && a.end > b.start;
}

function overlapsSpan(
  start: number,
  end: number,
  spans: ReadonlyArray<TextSpan>
): boolean {
  return spans.some((span) => start < span.end && end > span.start);
}

function matchIdentity(match: DetectedIoc): string {
  return `${match.start}:${match.end}:${match.type}:${match.value}`;
}

export function dedupeOverlappingMatches(
  matches: ReadonlyArray<DetectedIoc>
): DetectedIoc[] {
  const unique = new Map<string, DetectedIoc>();
  for (const match of matches) {
    unique.set(matchIdentity(match), match);
  }

  const ordered = [...unique.values()].sort((a, b) => {
    const priorityDiff = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return b.end - a.end;
  });

  const kept: DetectedIoc[] = [];
  for (const candidate of ordered) {
    const span = { start: candidate.start, end: candidate.end };
    if (!kept.some((existing) => spansOverlap(span, existing))) {
      kept.push(candidate);
    }
  }

  return kept.sort((a, b) => a.start - b.start);
}

export function detectIocsInText(
  text: string,
  options: IocRegexOptions = {}
): DetectedIoc[] {
  const results: DetectedIoc[] = [];
  const occupied: TextSpan[] = [];

  const urls = findUrlsInText(text);
  for (const match of urls) {
    results.push(match);
    occupied.push({ start: match.start, end: match.end });
  }

  for (const match of findHashesInText(text, occupied)) {
    results.push(match);
    occupied.push({ start: match.start, end: match.end });
  }

  for (const match of findCvesInText(text, occupied)) {
    results.push(match);
    occupied.push({ start: match.start, end: match.end });
  }

  for (const match of findIpv4InText(text, options)) {
    if (!overlapsSpan(match.start, match.end, occupied)) {
      results.push(match);
      occupied.push({ start: match.start, end: match.end });
    }
  }

  for (const match of findDomainsInText(text, occupied)) {
    results.push(match);
    occupied.push({ start: match.start, end: match.end });
  }

  const deduped = dedupeOverlappingMatches(results);
  if (!options.enabledTypes) {
    return deduped;
  }
  return deduped.filter((match) =>
    isIocTypeEnabledForDetection(match.type, options.enabledTypes)
  );
}

export function scanTextNodesForIocs(
  root: Node = document.body,
  options: IocDetectorScanOptions = {}
): DetectedIocInTextNode[] {
  const iocOptions = options.ioc ?? {};
  const walkerOptions = options.walker ?? {};
  const blocks = collectIocScanTextBlocks(root, walkerOptions);
  const detected: DetectedIocInTextNode[] = [];

  for (const block of blocks) {
    const matches = detectIocsInText(block.text, iocOptions);
    for (const match of matches) {
      detected.push({
        ...match,
        textNode: block.node,
      });
    }
  }

  return detected;
}
