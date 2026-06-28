# Phase 2 IOC detector specification

Grammar, positive examples, and negative (decoy) cases for the next Vera5 indicator types: **email addresses**, **ASN**, **IPv4 CIDR**, **conservative file paths**, and **Tor onion domains**. Implementation targets the same scan surface as the current release—visible text nodes on `http://` and `https://` pages, with `script`, `style`, `textarea`, and metadata subtrees skipped by default.

This document is the detector contract for regex authors and fixture tests. Enrichment, pivot links, and composite scoring for types without live connector support are defined separately in connector and export docs.

**Related:** MVP types and existing false-positive tables — [architecture.md](architecture.md#known-false-positives-and-suppressions). Contributor pipeline overview — [contributors/detection-engine.md](contributors/detection-engine.md).

## Scope

| Type | Detect in Phase 2 | Enrichment in Phase 2 |
|------|-------------------|------------------------|
| Email address | Yes | Pivot links only until a vendor supports the type |
| ASN | Yes | Pivot links only |
| IPv4 CIDR | Yes | Pivot links only; distinct from bare IPv4 literals |
| File path (conservative) | Yes | Pivot links only |
| Onion domain (Tor v3) | Yes | Pivot links only |

**Out of scope for this spec:** IPv6 CIDR, MITRE ATT&CK technique IDs, cryptocurrency wallet addresses, malware family names, cloud resource IDs, and automatic live enrichment for types without connector support.

## Shared rules

- **Visible text only** — Same walker eligibility as MVP (`textWalker.ts`); attributes are not scanned.
- **Conservative matching** — Prefer false negatives over noisy false positives on prose, licenses, and system paths.
- **Per-type toggles** — Each Phase 2 type gets an independent enable flag in `iocTypeEnabled` (schema version 3); Options exposes one checkbox per type; defaults **on** for new installs and migrations from version 2.
- **Overlap deduplication** — When spans collide, apply the priority order in [Overlap priority](#overlap-priority) before surfacing a highlight.
- **Provenance** — Each match stores a rule id and source text hint for **Why detected?** on the overlay and IOC tray.
- **Private-space literals** — CIDR and email hosts follow the same private-space policy as IPv4 where applicable (`includePrivateIpv4` gate for RFC1918, loopback, and link-local CIDRs and literals).

## Email address

### Grammar

- Form: `local-part@domain` where both parts are non-empty.
- **Local part:** ASCII letters, digits, and common symbols (`.`, `_`, `%`, `+`, `-`); no whitespace; length bounded (implementation cap ≤ 64 characters).
- **Domain:** Hostname-style labels per domain detector rules (at least one dot or a documented exception list for single-label lab hosts); bracket-dot defanging normalized before validation.
- **Case:** Store normalized lowercase domain; preserve local-part case from page text unless product copy standardizes later.

### Positive examples (must match)

| Example | Notes |
|---------|--------|
| `analyst@corp.example.com` | Standard corporate address in alert body |
| `security+alerts@bank.co.uk` | Plus-tag addressing |
| `user.name@sub.domain.org` | Dotted local part |
| `noreply@phish-c2.example` | Single-label TLD-style lab domain when allowed by domain rules |
| `soc-team@192.0.2.10` | Domain literal is IPv4 (rare in CTI; valid when domain part parses) |

### Negative examples (must not match)

| Example | Reason |
|---------|--------|
| `corp.example.com` | Domain only — existing **domain** type |
| `@corp` | Incomplete token; social @-mention, not email |
| `user@` | Missing domain |
| `@example.com` | Missing local part |
| `mailto:analyst@corp.example.com` | Full `mailto:` URL — existing **URL** type wins on span |
| `analyst(at)corp.example.com` | Non-standard defang not in MVP refang set unless explicitly added |
| `name@localhost` | Suppressed when localhost is excluded from domain acceptance |
| `CVE-2024-1234@vendor` | CVE-like local part without valid email grammar |

### Overlap and suppressions

- **Email vs domain:** When a valid `local@domain` span is matched, do not also emit a standalone **domain** match for the same domain substring inside that span.
- **Email vs URL:** `http(s)://` or defanged URL schemes take priority over email when the span is a full URL.
- **Email vs hash:** Hex runs inside local part do not split into MD5/SHA hashes when bounded by `@` email grammar.

---

## ASN (Autonomous System Number)

### Grammar

- Form: case-insensitive prefix `AS` or `ASN` followed by optional whitespace and a decimal ASN in **1–4294967295** (32-bit ASN space).
- Optional decorative punctuation: `AS15169`, `ASN 64512`, `as32934`.
- Require word boundary before prefix so prose `"as well"` does not match.

### Positive examples (must match)

| Example | Normalized value |
|---------|------------------|
| `AS15169` | `AS15169` |
| `ASN 64512` | `AS64512` |
| `as32934` | `AS32934` |
| `Seen from ASN 20473` | `AS20473` |
| `(AS13335)` | `AS13335` |

### Negative examples (must not match)

| Example | Reason |
|---------|--------|
| `as well as` | Prose; no word boundary before AS |
| `AS IS` / `AS-IS` | License wording |
| `ASAP` | Prefix collision |
| `AS0` | Invalid ASN (0 reserved) |
| `AS4294967296` | Out of 32-bit range |
| `AS15169.0` | Trailing semver-like segment |
| `class AS something` | Programming-language prose |
| `deadbeef` inside hash | Hex digest — **hash** type wins |

### Overlap and suppressions

- **ASN vs CVE:** `CVE-2024-…` sequences are not ASN prefixes.
- **ASN vs IPv4:** Dotted quads without `AS` prefix remain **IPv4**, not ASN.

---

## IPv4 CIDR

### Grammar

- Form: four decimal octets (0–255 each), `/`, prefix length **0–32**.
- Optional whitespace around `/` is not allowed in the canonical match (strict token).
- IPv6 CIDR is out of scope for this spec.

### Positive examples (must match)

| Example | Notes |
|---------|--------|
| `10.0.0.0/8` | RFC1918 range notation |
| `192.168.0.0/16` | Common lab range |
| `203.0.113.0/24` | TEST-NET-3 documentation range |
| `192.0.2.5/32` | Host route |
| `0.0.0.0/0` | Default route (valid syntax; may be suppressed by analyst toggle later) |

### Negative examples (must not match)

| Example | Reason |
|---------|--------|
| `192.168.1.10` | Bare IPv4 — existing **IPv4** type |
| `10.0.0.0/33` | Invalid prefix length |
| `256.0.0.0/8` | Invalid octet |
| `10/8` | Incomplete octets |
| `/24` | Missing network address |
| `10.0.0.0 / 8` | Internal whitespace breaks strict token |
| `version 1.2.3.4/32` | Semver-like prefix suppression (same family as MVP IPv4 decoy) |
| `from 1.2.3.4/32 to 2.0.0/16` | Upgrade-range prose decoy |

### Overlap and suppressions

- **CIDR vs IPv4:** When `/prefix` is present and grammar validates, classify as **CIDR**, not **IPv4**.
- **CIDR vs domain:** Denylisted filename TLDs do not apply; CIDR has explicit `/` delimiter.
- **Private space:** When `includePrivateIpv4` is false, omit RFC1918, loopback, and link-local CIDR blocks matching the same policy as bare IPv4 literals.

---

## File path (conservative)

Detect **analyst-relevant** paths in CTI prose—dropper locations, staging directories, and UNC shares—not every filesystem reference on a page. Conservative matching **prefers false negatives**: if a token is ambiguous or falls under a system-path denylist, omit it rather than highlight runbook noise.

Implementation applies grammar first, then denylist checks in `iocRegex.ts` (or a dedicated path helper called from the detector). Rule id: `ioc.regex.filepath`.

### Design goals

| Goal | Rule |
|------|------|
| Reduce Windows system noise | Reject paths under `\Windows\`, `\Program Files\`, and other OS install trees |
| Reduce Unix system noise | Reject paths under `/bin`, `/usr/bin`, `/etc`, and other standard hierarchy roots |
| CTI relevance | Favor user-writable, case-artifact, temp, web-root, and UNC share paths seen in IR reports |
| No relative paths | Reject `.` / `..` prefixes and bare filenames without directory separators |
| No env-var tokens | Reject `%VAR%` and `${VAR}` prefixes until explicit expansion support is added |

### Grammar (summary)

- **Windows:** Drive letter `X:\` or UNC `\\host\share\…` with backslash-separated segments; optional surrounding double quotes stripped before validation.
- **Unix:** Absolute path beginning with `/` and at least **two** path segments after the root (for example `/tmp/stage`, not `/tmp` alone).
- **Extensions:** Final segment may include `.` followed by 1–10 alphanumeric characters. Executable and script extensions (`.exe`, `.dll`, `.ps1`, `.bat`, `.cmd`, `.vbs`, `.js`, `.jar`, `.scr`, `.hta`, `.php`, `.sh`, `.bin`, `.dat`, `.iso`) strengthen acceptance on borderline paths; extensionless paths are allowed only when the prefix is not denylisted and depth ≥ 3 segments on Windows or ≥ 3 on Unix.
- **Length cap:** Whole path token ≤ 260 characters (Windows `MAX_PATH` convention).
- **Case normalization:** Compare Windows denylist prefixes case-insensitively; store matched value as it appeared on the page.

### Windows system-path denylist

After normalizing `\` separators and trimming quotes, **reject** when the path matches any rule below. `X:` denotes any drive letter (`A:`–`Z:`).

| Denylist prefix (case-insensitive) | Rationale |
|------------------------------------|-----------|
| `X:\Windows\` | OS root — highest-volume false positive on SOC runbooks and EDR docs |
| `X:\Windows\System32\` | System binaries (`cmd.exe`, `svchost.exe`, drivers) |
| `X:\Windows\SysWOW64\` | WoW64 system binaries |
| `X:\Windows\WinSxS\` | Side-by-side assembly store |
| `X:\Windows\servicing\` | Windows servicing logs |
| `X:\Windows\Installer\` | MSI cache |
| `X:\Windows\Fonts\` | Font directory |
| `X:\Windows\Microsoft.NET\` | Runtime install tree |
| `X:\Program Files\` | Vendor application installs |
| `X:\Program Files (x86)\` | 32-bit vendor installs |
| `X:\ProgramData\Microsoft\` | Microsoft application state |
| `X:\ProgramData\Package Cache\` | Installer package cache |
| `X:\$Recycle.Bin\` | Recycle bin metadata |
| `X:\System Volume Information\` | Volume metadata |
| `X:\Recovery\` | WinRE artifacts |
| `\\.\` | Device namespace paths |
| `\\?\` | Extended-length path prefix in prose |

**Allowed under `ProgramData` (not denylisted):** sibling directories used in malware staging—for example `X:\ProgramData\Updater\`, `X:\ProgramData\Adobe\`, or custom vendor folders—when they do not fall under a denylisted Microsoft or Package Cache prefix above.

**Allowed under `Users`:** `X:\Users\*\` profile paths including `Desktop`, `Downloads`, `AppData\Local\Temp`, and `AppData\Roaming` unless a future tuning pass adds AppData Microsoft subtrees. Analyst case exports frequently cite `%USERPROFILE%`-equivalent paths; literal `C:\Users\analyst\…` forms should match when grammar validates.

### Unix system-path denylist

Reject when the normalized absolute path starts with any prefix below (case-sensitive on Unix).

| Denylist prefix | Rationale |
|-----------------|-----------|
| `/bin/` | Core system binaries |
| `/sbin/` | System administration binaries |
| `/usr/bin/` | Distribution binaries (`python`, `bash`) |
| `/usr/sbin/` | System daemons |
| `/usr/lib/` | Shared libraries |
| `/usr/lib64/` | 64-bit libraries |
| `/lib/` | Root-level libraries |
| `/lib64/` | 64-bit root libraries |
| `/etc/` | System configuration (`passwd`, `hosts`) |
| `/sys/` | Virtual sysfs |
| `/proc/` | Process pseudo-fs |
| `/dev/` | Device nodes |
| `/boot/` | Boot loader artifacts |
| `/run/systemd/` | Systemd runtime state |
| `/var/lib/dpkg/` | Package manager state |
| `/var/lib/rpm/` | RPM state |
| `/var/lib/systemd/` | Systemd unit state |

**Explicitly allowed (not denylisted):** `/tmp/`, `/var/tmp/`, `/var/www/`, `/var/log/` (when cited as exfil or web-shell staging in CTI), `/home/*/` user home subtrees, and `/opt/*/` optional software trees when depth and extension rules pass.

### UNC and admin-share rules

| Pattern | Action |
|---------|--------|
| `\\host\share\path\file.exe` | **Allow** when `share` is not an admin-only share name |
| `\\host\C$\`, `\\host\ADMIN$\`, `\\host\IPC$` | **Reject** — administrative shares, not CTI dropper paths |
| `\\host\c$\` | **Reject** — case-insensitive admin share match |

### Additional rejection rules

| Pattern | Action |
|---------|--------|
| Leading `.` or `..` segment | **Reject** — relative paths omitted in conservative mode |
| Bare filename (`report.pdf`, `chart.png`) | **Reject** — not a path; may match **domain** TLD denylist separately |
| `%TEMP%\`, `%APPDATA%\`, `${HOME}/` | **Reject** — environment placeholder, not a literal path |
| `file://` or `file:\\` URL span | **Reject** for filepath type — **URL** wins |
| Path with embedded whitespace | **Reject** — breaks strict token |
| Path with `<`, `>`, `\|`, `*` | **Reject** — invalid or redacted placeholder prose |
| Single-segment Unix path `/tmp` | **Reject** — requires at least one subdirectory segment |

### Positive examples (must match)

| Example | Notes |
|---------|--------|
| `C:\Users\Public\malware.exe` | User-writable staging path |
| `C:\ProgramData\Updater\stage2.dll` | ProgramData dropper outside Microsoft denylist |
| `C:\Users\analyst\AppData\Local\Temp\invoice.ps1` | Profile temp script |
| `\\fileserver\share\payload.ps1` | UNC share path (non-admin share) |
| `/tmp/.X11-unix/exploit` | Unix temp staging |
| `/var/www/html/shell.php` | Web shell path in IR report |
| `D:\Cases\2024-0312\artifacts\sample.bin` | Case artifact path |
| `"C:\Users\Public\dropper.exe"` | Quoted Windows path — quotes stripped before denylist |

### Negative examples (must not match)

| Example | Reason |
|---------|--------|
| `C:\Windows\System32\drivers\etc\hosts` | `\Windows\` denylist |
| `C:\Windows\System32\cmd.exe` | `\Windows\System32\` denylist |
| `C:\Windows\SysWOW64\kernel32.dll` | `\Windows\SysWOW64\` denylist |
| `C:\Program Files\Google\Chrome\Application\chrome.exe` | `\Program Files\` denylist |
| `C:\Program Files (x86)\Microsoft Office\root\Office16\WINWORD.EXE` | `\Program Files (x86)\` denylist |
| `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\` | `\ProgramData\Microsoft\` denylist |
| `\\server\C$\Windows\temp\evil.exe` | Admin share `C$` |
| `/usr/bin/python` | `/usr/bin/` denylist |
| `/usr/bin/bash` | `/usr/bin/` denylist |
| `/etc/passwd` | `/etc/` denylist |
| `/etc/hosts` | `/etc/` denylist |
| `chart.png` | Filename only — not a path |
| `https://example.com/path/file.exe` | **URL** type wins |
| `.\relative\path.exe` | Relative path |
| `%TEMP%\dropper.exe` | Environment-variable prefix |
| `C:\Windows\Temp\malware.exe` | Under `\Windows\` tree (use user temp paths instead in CTI fixtures) |

### Overlap and suppressions

- **Path vs URL:** Schemes `http://`, `https://`, `ftp://`, `file://`, and defanged variants classify as **URL**, not file path.
- **Path vs domain:** Bare filenames without directory separators are not file paths.
- **Path vs IPv4:** Dotted quads inside UNC hostnames are not standalone **IPv4** matches when bounded by UNC grammar.

### Implementation notes

- Denylist checks run **after** a candidate path token matches grammar; return no match rather than a suppressed placeholder row.
- Unit tests in `iocRegex.test.ts` (or `filepathDetector.test.ts`) must include at least one positive and one negative example per denylist family (Windows OS, Program Files, Unix bin, Unix etc, admin UNC).
- When tuning, add decoys to this section before changing regex—see [soc-validation-fixtures.md](soc-validation-fixtures.md) for regression pages.

---

## Onion domain (Tor v3)

### Grammar

- **Tor v3 service address:** exactly **56** characters from `[a-z2-7]` (base32), lowercase in normalized storage, followed by `.onion`.
- Word boundary before the hostname; optional `http://` / `https://` wrapper classifies as **URL** when the full URL span is matched first.

### Positive examples (must match)

| Example | Notes |
|---------|--------|
| `bbcnewsd73hkzno2ini43t4gblxvycyac5aw4gnv7t2n2fh4t5nqeyd.onion` | 56-char v3 hostname |
| `http://thehiddenwiki7qzb4q2.onion/wiki/index.php` | Full URL — **URL** type; onion host extracted in URL parser |
| `contactxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.onion` | Synthetic 56-char v3 form for tests |

### Negative examples (must not match)

| Example | Reason |
|---------|--------|
| `example.com` | Clearnet domain |
| `foo.onion` | Too short for v3 |
| `visit a .onion site` | Prose without valid hostname token |
| `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.onion` | 57 characters — invalid v3 length |
| `ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ.onion` | Invalid base32 alphabet |
| `oldv2address.onion` | v2 length/onion — deprecated; do not match as v3 |

### Overlap and suppressions

- **Onion vs domain:** Valid v3 `.onion` hostnames classify as **onion**, not generic **domain**.
- **Onion vs URL:** When the page text is a full `http(s)://…onion/…` URL, **URL** wins; pivot recipes may still surface the onion host.

---

## Overlap priority

When two or more types match the same or overlapping character span, resolve in this order (highest priority first):

| Priority | Type |
|----------|------|
| 1 | URL |
| 2 | Email address |
| 3 | File path (conservative) |
| 4 | Onion domain |
| 5 | SHA256 |
| 6 | SHA1 |
| 7 | MD5 |
| 8 | CVE |
| 9 | IPv4 CIDR |
| 10 | IPv4 |
| 11 | ASN |
| 12 | Domain |

Longest-match within the same priority tier applies for hash types (unchanged from MVP).

## Detection rule identifiers (planned)

| Type | Rule id (planned) |
|------|-------------------|
| Email | `ioc.regex.email` |
| ASN | `ioc.regex.asn` |
| CIDR | `ioc.regex.cidr` |
| File path | `ioc.regex.filepath` |
| Onion | `ioc.regex.onion` |

## Fixture and validation plan

Extended indicator strings live in [`examples/sample-iocs.txt`](../examples/sample-iocs.txt) and [`examples/sample-extended-ioc-alert.html`](../examples/sample-extended-ioc-alert.html). Unit and fixture tests in `fixtureTuning.test.ts` cover positive and negative cases.

SOC regression: after extended-indicator detector changes, re-run the checklist in [soc-validation-fixtures.md](soc-validation-fixtures.md) on `sample-splunk-export.html` and `sample-security-onion-alert.html` (and baseline alert pages) to confirm MVP types, decoys, and match counts are unchanged and no extended-type false positives appear on dashboard-shaped fixtures.

## Connector and enrichment expectations

Phase 2 types appear on the hover card and IOC tray with type badges. Live connectors continue to skip unsupported types with explicit copy; pivot links follow the enrichment source registry where defined. No automatic upload of file contents or mailbox bodies—indicator tokens only, consistent with BYOK/BYOA posture in [SECURITY.md](../SECURITY.md).
