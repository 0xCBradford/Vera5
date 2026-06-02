import {
  normalizeIocTypeEnabledRecord,
  STORAGE_KEY_IOC_TYPE_ENABLED,
  type IocTypeEnabledRecord,
} from "../lib/storage";
import { safeStorageLocalGet } from "../lib/extensionContext";

export const CONTENT_STORAGE_KEY_IOC_TYPE_ENABLED = STORAGE_KEY_IOC_TYPE_ENABLED;

export async function getIocTypeEnabledForContent(): Promise<IocTypeEnabledRecord> {
  const result = await safeStorageLocalGet(CONTENT_STORAGE_KEY_IOC_TYPE_ENABLED);
  return normalizeIocTypeEnabledRecord(
    result[CONTENT_STORAGE_KEY_IOC_TYPE_ENABLED]
  );
}
