import "server-only";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { revalidateLayout } from "@/lib/admin/content/common";
import { serverEnv } from "@/lib/env/server";
import {
  SECTION_HINTS,
  SETTINGS_SECTIONS,
  rowsToSettings,
  sectionToRows,
  type SectionValue,
  type SettingsSection,
} from "./schema";

/**
 * Einstellungen (/admin/einstellungen/*): getSettings() liest alle Abschnitte typisiert,
 * saveSettings(section, input, actor) prüft je Abschnitt mit Zod und schreibt shop_settings.
 * Owner und Admin (editSettings); den Allowlist-Schalter (email) darf nur der Owner ändern.
 */

export interface InvoiceSettingsInfo {
  numbering: "lexware";
  hint: string;
  mode: "draft" | "final";
  lexwareConnected: boolean;
}

export interface AllSettings {
  sections: { [S in SettingsSection]: SectionValue<S> };
  invoices: InvoiceSettingsInfo;
  consentBannerVersion: string | null;
  hints: typeof SECTION_HINTS;
  updatedAt: Record<string, string>;
}

export async function getSettings(): Promise<AllSettings> {
  const { data, error } = await crmDb()
    .from("shop_settings")
    .select("key, value, is_public, updated_at");
  if (error) throw dbError("Einstellungen laden", error);
  const rows = data ?? [];
  const env = serverEnv();
  const consent = rows.find((r) => r.key === "consent.banner_version")?.value;
  return {
    sections: rowsToSettings(rows),
    invoices: {
      numbering: "lexware",
      hint: SECTION_HINTS.invoices ?? "",
      mode: env.LEXWARE_INVOICE_MODE,
      lexwareConnected: Boolean(env.LEXWARE_API_KEY),
    },
    consentBannerVersion: typeof consent === "string" ? consent : null,
    hints: SECTION_HINTS,
    updatedAt: Object.fromEntries(rows.map((r) => [r.key, r.updated_at])),
  };
}

/** Nur öffentliche Einstellungen (is_public), z.B. für Vorschauen; die Storefront liest per RLS selbst. */
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await crmDb()
    .from("shop_settings")
    .select("key, value")
    .eq("is_public", true);
  if (error) throw dbError("Einstellungen laden", error);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

export async function saveSettings<S extends SettingsSection>(
  section: S,
  input: unknown,
  actor: StaffSession,
): Promise<SectionValue<S>> {
  assertPermission(actor, "editSettings");
  if (!(section in SETTINGS_SECTIONS)) throw new Error("Unbekannter Abschnitt");
  if (section === "email" && actor.role !== "owner")
    throw new Error(
      "Den Versand an alle Empfänger schaltet nur der Owner frei (Go-live-Checkliste)",
    );
  const value = parseInput(SETTINGS_SECTIONS[section] as never, input) as SectionValue<S>;
  const rows = sectionToRows(section, value);
  const db = crmDb();
  const { data: before } = await db
    .from("shop_settings")
    .select("key, value")
    .in(
      "key",
      rows.map((r) => r.key),
    );
  const { error } = await db.from("shop_settings").upsert(
    rows.map((r) => ({
      key: r.key,
      value: asJson(r.value),
      is_public: r.is_public,
      updated_by: actor.userId,
    })),
    { onConflict: "key" },
  );
  if (error) throw dbError("Einstellungen speichern", error);
  if (rows.some((r) => r.is_public)) revalidateLayout();
  await writeAudit(actor, {
    action: `settings.${section}`,
    entityType: "shop_settings",
    entityId: section,
    before: Object.fromEntries((before ?? []).map((r) => [r.key, r.value])),
    after: Object.fromEntries(rows.map((r) => [r.key, r.value])),
  });
  return value;
}
