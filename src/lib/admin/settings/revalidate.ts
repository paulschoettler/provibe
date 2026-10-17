import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { revalidateLayout, safeRevalidate } from "@/lib/admin/content/common";
import { CATALOG_TAG } from "@/lib/admin/products/revalidate";
import type { SettingsSection } from "./schema";

/**
 * Storefront nach Einstellungsänderungen erneuern. saveSettings revalidiert bei öffentlichen
 * Schlüsseln schon das Layout (Footer, Announcement, Tracking-IDs); hier kommen die Seiten dazu,
 * die Shopdaten im Inhalt zeigen, und der Katalog-Tag bei Versand und Steuern (Versandschwelle
 * und Lieferzeit stehen auf Produktseiten).
 */
const SECTION_PATHS: Partial<Record<SettingsSection, string[]>> = {
  legalEntity: [
    "/pages/impressum",
    "/pages/contact",
    "/pages/ruckgabe-und-wiederrufsbelehrung",
    "/pages/widerruf-formular",
    "/policies/privacy-policy",
  ],
  contact: ["/pages/contact", "/pages/partner", "/pages/widerruf-formular", "/pages/impressum"],
  social: ["/pages/contact"],
  contactPage: ["/pages/contact"],
  shop: ["/pages/versand"],
};

export function revalidateSettingsSections(sections: SettingsSection[]): void {
  safeRevalidate(() => {
    const paths = new Set(sections.flatMap((s) => SECTION_PATHS[s] ?? []));
    for (const p of paths) revalidatePath(p);
    if (sections.includes("shop")) revalidateTag(CATALOG_TAG, { expire: 0 });
  });
}

/** Versandzonen, Tarife und Steuersätze. */
export function revalidateShippingAndTax(): void {
  revalidateLayout();
  safeRevalidate(() => {
    revalidateTag(CATALOG_TAG, { expire: 0 });
    revalidatePath("/pages/versand");
    revalidatePath("/cart");
  });
}
