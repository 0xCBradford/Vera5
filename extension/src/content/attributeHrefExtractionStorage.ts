import { safeStorageLocalGet } from "../lib/extensionContext";
import {
  normalizeAttributeHrefSitePreferencesRecord,
  resolveAttributeHrefExtractionForHost,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES,
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES,
} from "../lib/storage";

export const CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED =
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED;
export const CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES =
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES;
export const CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES =
  STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES;

function resolvePageHostname(doc: Document = document): string {
  const location = doc.defaultView?.location ?? doc.location;
  return typeof location?.hostname === "string" ? location.hostname : "";
}

export async function isAttributeHrefExtractionEnabledForCurrentPage(
  doc: Document = document
): Promise<boolean> {
  const result = await safeStorageLocalGet([
    STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED,
    STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES,
    STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES,
  ]);

  return resolveAttributeHrefExtractionForHost(
    {
      attributeHrefExtractionEnabled: Boolean(
        result[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED]
      ),
      attributeHrefExtractionRememberSiteChoices: Boolean(
        result[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES]
      ),
      attributeHrefExtractionSitePreferences:
        normalizeAttributeHrefSitePreferencesRecord(
          result[STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES]
        ),
    },
    resolvePageHostname(doc)
  );
}