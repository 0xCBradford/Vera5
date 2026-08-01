import { safeStorageLocalGet } from "../lib/extensionContext";
import {
  DEFAULT_ON_PAGE_POPOUT_ENABLED,
  STORAGE_KEY_ON_PAGE_POPOUT_ENABLED,
} from "../lib/onPagePopoutPreference";

export const CONTENT_STORAGE_KEY_ON_PAGE_POPOUT_ENABLED = STORAGE_KEY_ON_PAGE_POPOUT_ENABLED;

export async function getOnPagePopoutEnabledForContent(): Promise<boolean> {
  const result = await safeStorageLocalGet(CONTENT_STORAGE_KEY_ON_PAGE_POPOUT_ENABLED);
  const value = result[CONTENT_STORAGE_KEY_ON_PAGE_POPOUT_ENABLED];
  if (value === undefined) {
    return DEFAULT_ON_PAGE_POPOUT_ENABLED;
  }
  return Boolean(value);
}
