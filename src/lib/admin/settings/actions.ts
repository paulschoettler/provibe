"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import {
  euroToCents,
  flag,
  formValues,
  kgToGrams,
  optText,
  percentToBp,
  text,
} from "@/lib/admin/content/input";
import { runAdminAction } from "@/lib/admin/content/run-action";
import { revalidateSettingsSections, revalidateShippingAndTax } from "./revalidate";
import { SETTINGS_SECTIONS, type SettingsSection } from "./schema";
import { getSettings, saveSettings } from "./settings";
import {
  createShippingRate,
  createShippingZone,
  createTaxRate,
  deleteShippingRate,
  deleteShippingZone,
  deleteTaxRate,
  listShippingZones,
  updateShippingRate,
  updateShippingZone,
  updateTaxRate,
} from "./shipping";

/**
 * Server Actions für /admin/einstellungen/*: Shopdaten, Tracking, Rechnungstexte, Versand,
 * Steuern. Recht editSettings (Owner und Admin). Jede Änderung schreibt das Audit-Log
 * (saveSettings, shipping.ts) und erneuert die betroffenen Storefront-Routen.
 */

const BASE = "/admin/einstellungen";

/** Felder mit Präfix "<abschnitt>." als Objekt. */
function sectionInput(fd: FormData, section: string): Record<string, string> {
  const out: Record<string, string> = {};
  const prefix = `${section}.`;
  for (const [key, value] of fd.entries()) {
    if (key.startsWith(prefix) && typeof value === "string") out[key.slice(prefix.length)] = value;
  }
  return out;
}

/**
 * Mehrere Abschnitte aus einem Formular speichern: erst alle prüfen (Feldfehler mit Präfix),
 * dann nur geänderte Abschnitte schreiben.
 */
async function saveSections(
  fd: FormData,
  sections: { section: SettingsSection; input: (raw: Record<string, string>) => unknown }[],
  path: string,
  aliases: Record<string, string> = {},
): Promise<ActionState> {
  const values = formValues(fd);
  return runAdminAction(
    "editSettings",
    path,
    async (session) => {
      const errors: Record<string, string> = {};
      const parsed: { section: SettingsSection; value: unknown }[] = [];
      for (const { section, input } of sections) {
        const result = SETTINGS_SECTIONS[section].safeParse(input(sectionInput(fd, section)));
        if (!result.success) {
          for (const issue of result.error.issues) {
            const raw = `${section}.${issue.path.join(".")}`;
            const key = aliases[raw] ?? raw;
            if (!errors[key]) errors[key] = issue.message;
          }
        } else parsed.push({ section, value: result.data });
      }
      if (Object.keys(errors).length)
        return actionError(
          Object.keys(errors).length > 1
            ? "Bitte prüf die markierten Felder."
            : Object.values(errors)[0],
          { fieldErrors: errors, values },
        );
      const current = (await getSettings()).sections;
      const changed = parsed.filter(
        (p) => JSON.stringify(current[p.section]) !== JSON.stringify(p.value),
      );
      for (const p of changed) await saveSettings(p.section, p.value, session);
      revalidateSettingsSections(changed.map((p) => p.section));
      revalidatePath(path);
      await flashToast(changed.length ? "Einstellungen gespeichert" : "Keine Änderungen");
    },
    values,
  );
}

export async function saveShopDataAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return saveSections(
    fd,
    [
      {
        section: "shop",
        input: (r) => ({
          name: r.name,
          tagline: r.tagline,
          defaultDeliveryTime: r.defaultDeliveryTime,
          depositDefaultCents: euroToCents(r.deposit) ?? 0,
        }),
      },
      { section: "legalEntity", input: (r) => r },
      { section: "contact", input: (r) => r },
      { section: "social", input: (r) => r },
      { section: "sender", input: (r) => r },
      { section: "contactPage", input: (r) => r },
    ],
    `${BASE}/shopdaten`,
    { "shop.depositDefaultCents": "shop.deposit" },
  );
}

export async function saveTrackingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return saveSections(
    fd,
    [
      {
        section: "tracking",
        input: (r) => {
          const labels: Record<string, string> = {};
          for (const event of ["purchase", "sign_up", "generate_lead"]) {
            const v = (r[`label_${event}`] ?? "").trim();
            if (v) labels[event] = v;
          }
          return {
            metaEnabled: flag(fd, "tracking.metaEnabled"),
            metaPixelId: r.metaPixelId ?? "",
            googleEnabled: flag(fd, "tracking.googleEnabled"),
            ga4MeasurementId: r.ga4MeasurementId ?? "",
            googleAdsConversionId: r.googleAdsConversionId ?? "",
            googleAdsLabels: labels,
            tiktokEnabled: flag(fd, "tracking.tiktokEnabled"),
            tiktokPixelId: r.tiktokPixelId ?? "",
          };
        },
      },
    ],
    `${BASE}/tracking`,
    {
      "tracking.googleAdsLabels.purchase": "tracking.label_purchase",
      "tracking.googleAdsLabels.sign_up": "tracking.label_sign_up",
      "tracking.googleAdsLabels.generate_lead": "tracking.label_generate_lead",
    },
  );
}

export async function saveInvoiceTextsAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return saveSections(fd, [{ section: "invoices", input: (r) => r }], `${BASE}/rechnungen`);
}

/* Versand ------------------------------------------------------------------------------------- */

export async function saveZoneAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  const values = formValues(fd);
  let done = false;
  const result = await runAdminAction(
    "editSettings",
    `${BASE}/versand`,
    async (session) => {
      const input = {
        code: text(fd, "code"),
        name: text(fd, "name"),
        countryCodes: text(fd, "countryCodes")
          .split(/[\s,;]+/)
          .map((c) => c.trim())
          .filter(Boolean),
        isEnabled: flag(fd, "isEnabled"),
        position: Number(text(fd, "position") || 0),
      };
      if (id) await updateShippingZone(id, input, session);
      else await createShippingZone(input, session);
      revalidateShippingAndTax();
      revalidatePath(`${BASE}/versand`);
      await flashToast(id ? "Versandzone gespeichert" : "Versandzone angelegt");
      done = true;
    },
    values,
  );
  if (done) redirect(`${BASE}/versand` as Route);
  return result;
}

export async function toggleZoneAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction("editSettings", `${BASE}/versand`, async (session) => {
    const zone = (await listShippingZones()).find((z) => z.id === text(fd, "id"));
    if (!zone) return actionError("Versandzone nicht gefunden.");
    const enabled = text(fd, "enabled") === "1";
    await updateShippingZone(
      zone.id,
      {
        code: zone.code,
        name: zone.name,
        countryCodes: zone.countryCodes,
        isEnabled: enabled,
        position: zone.position,
      },
      session,
    );
    revalidateShippingAndTax();
    revalidatePath(`${BASE}/versand`);
    await flashToast(enabled ? `${zone.name} ist aktiv` : `${zone.name} ist abgeschaltet`);
  });
}

export async function deleteZoneAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await runAdminAction("editSettings", `${BASE}/versand`, async (session) => {
    await deleteShippingZone(text(fd, "id"), session);
    revalidateShippingAndTax();
    await flashToast("Versandzone gelöscht");
    done = true;
  });
  if (done) redirect(`${BASE}/versand` as Route);
  return result;
}

export async function saveRateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  const values = formValues(fd);
  let done = false;
  const result = await runAdminAction(
    "editSettings",
    `${BASE}/versand`,
    async (session) => {
      const input = {
        zoneId: text(fd, "zoneId"),
        name: text(fd, "name"),
        description: optText(fd, "description"),
        priceCents: euroToCents(text(fd, "price")) ?? Number.NaN,
        freeAboveSubtotalCents: euroToCents(text(fd, "freeAbove")),
        minSubtotalCents: euroToCents(text(fd, "minSubtotal")) ?? 0,
        maxSubtotalCents: euroToCents(text(fd, "maxSubtotal")),
        minWeightGrams: kgToGrams(text(fd, "minWeight")) ?? 0,
        maxWeightGrams: kgToGrams(text(fd, "maxWeight")),
        service: text(fd, "service") || "V01PAK",
        deliveryTimeText: optText(fd, "deliveryTimeText"),
        taxClass: (text(fd, "taxClass") || "standard") as "standard" | "reduced",
        isEnabled: flag(fd, "isEnabled"),
        position: Number(text(fd, "position") || 0),
      };
      // Feldnamen der Oberfläche (Euro, kg) statt der Schema-Namen (Cent, Gramm)
      try {
        if (id) await updateShippingRate(id, input, session);
        else await createShippingRate(input, session);
      } catch (error) {
        const map: Record<string, string> = {
          priceCents: "price",
          freeAboveSubtotalCents: "freeAbove",
          minSubtotalCents: "minSubtotal",
          maxSubtotalCents: "maxSubtotal",
          minWeightGrams: "minWeight",
          maxWeightGrams: "maxWeight",
        };
        if (error && typeof error === "object" && "fieldErrors" in error) {
          const fe = (error as { fieldErrors: Record<string, string> }).fieldErrors;
          for (const [from, to] of Object.entries(map)) {
            if (fe[from]) {
              fe[to] = /nan|number/i.test(fe[from])
                ? "Bitte gib einen gültigen Wert ein."
                : fe[from];
              delete fe[from];
            }
          }
        }
        throw error;
      }
      revalidateShippingAndTax();
      revalidatePath(`${BASE}/versand`);
      await flashToast(id ? "Tarif gespeichert" : "Tarif angelegt");
      done = true;
    },
    values,
  );
  if (done) redirect(`${BASE}/versand` as Route);
  return result;
}

export async function deleteRateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await runAdminAction("editSettings", `${BASE}/versand`, async (session) => {
    await deleteShippingRate(text(fd, "id"), session);
    revalidateShippingAndTax();
    await flashToast("Tarif gelöscht");
    done = true;
  });
  if (done) redirect(`${BASE}/versand` as Route);
  return result;
}

/* Steuern ------------------------------------------------------------------------------------- */

export async function saveTaxRateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  const values = formValues(fd);
  let done = false;
  const result = await runAdminAction(
    "editSettings",
    `${BASE}/steuern`,
    async (session) => {
      const bp = percentToBp(text(fd, "rate"));
      if (bp === null || Number.isNaN(bp))
        return actionError("Bitte gib den Satz in Prozent ein.", {
          fieldErrors: { rate: "Zum Beispiel 19 oder 7" },
          values,
        });
      const input = {
        countryCode: text(fd, "countryCode"),
        taxClass: text(fd, "taxClass") as "standard" | "reduced" | "zero",
        rateBp: bp,
        name: text(fd, "name"),
        validFrom: text(fd, "validFrom"),
        validTo: optText(fd, "validTo"),
      };
      if (id) await updateTaxRate(id, input, session);
      else await createTaxRate(input, session);
      revalidateShippingAndTax();
      revalidatePath(`${BASE}/steuern`);
      await flashToast(id ? "Steuersatz gespeichert" : "Steuersatz angelegt");
      done = true;
    },
    values,
  );
  if (done) redirect(`${BASE}/steuern` as Route);
  return result;
}

export async function deleteTaxRateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await runAdminAction("editSettings", `${BASE}/steuern`, async (session) => {
    await deleteTaxRate(text(fd, "id"), session);
    revalidateShippingAndTax();
    await flashToast("Steuersatz gelöscht");
    done = true;
  });
  if (done) redirect(`${BASE}/steuern` as Route);
  return result;
}
