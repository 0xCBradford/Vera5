import browser from "webextension-polyfill";

/**
 * Canonical promise-based extension API namespace.
 *
 * On Firefox this is the native `browser` object; on Chromium it is a
 * promise-wrapped shim over `chrome`. Both targets therefore share a single
 * `Promise`-returning surface, avoiding callback/promise branching at call
 * sites. Importing this module requires a live extension runtime — the
 * underlying polyfill throws when no extension API is present.
 */
export { browser };
export default browser;
