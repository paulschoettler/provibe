import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { isAllowlistActive } from "@/lib/admin/emails/context";
import { renderTemplate } from "@/lib/admin/emails/templates";
import { enqueueCrmJob } from "./queue";
import {
  AUTOMATION_KEYS,
  AUTOMATION_META,
  automationConfigSchemas,
  delayLabel,
  parseAutomationConfig,
  sweepBucket,
  type AutomationKey,
} from "./rules";

/**
 * Automationen im Backoffice (/admin/automationen): Übersicht mit Schalter, Verzögerung, Vorlage,
 * Versandzahl der letzten 30 Tage; Speichern mit Zod je Automation. Owner und Admin.
 */

export interface AutomationView {
  key: AutomationKey;
  name: string;
  description: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  delayLabel: string;
  template: string;
  consentHint: string | null;
  sentLast30Days: number;
  skippedLast30Days: number;
  /** Zuletzt geändert (für "pausiert seit") */
  updatedAt: string;
  /** Hinweis bis zum Go-live: Versand nur an die Allowlist */
  allowlistActive: boolean;
}

export async function listAutomations(): Promise<AutomationView[]> {
  const db = crmDb();
  const { data, error } = await db.from("automations").select("*");
  if (error) throw dbError("Automationen laden", error);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const allowlistActive = await isAllowlistActive();
  const byKey = new Map((data ?? []).map((a) => [a.key, a]));
  return Promise.all(
    AUTOMATION_KEYS.map(async (key) => {
      const row = byKey.get(key);
      const config = parseAutomationConfig(key, row?.config) as Record<string, unknown>;
      const [sent, skipped] = await Promise.all(
        (["sent", "skipped"] as const).map(async (status) => {
          const { count } = await db
            .from("automation_runs")
            .select("id", { count: "exact", head: true })
            .eq("automation_key", key)
            .eq("status", status)
            .gte("created_at", since);
          return count ?? 0;
        }),
      );
      const meta = AUTOMATION_META[key];
      return {
        key,
        name: row?.name ?? meta.name,
        description: meta.description,
        isEnabled: row?.is_enabled ?? false,
        config,
        delayLabel: delayLabel(key, config),
        template: meta.template,
        consentHint: meta.consentHint,
        sentLast30Days: sent,
        skippedLast30Days: skipped,
        updatedAt: row?.updated_at ?? new Date(0).toISOString(),
        allowlistActive,
      };
    }),
  );
}

const updateSchema = z.object({
  key: z.enum(AUTOMATION_KEYS),
  isEnabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

/** Schalter und Konfiguration speichern. Einschalten plant den Sweep der Automationen ein. */
export async function updateAutomation(
  input: { key: AutomationKey; isEnabled?: boolean; config?: Record<string, unknown> },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "sendNewsletter");
  const data = parseInput(updateSchema, input);
  const db = crmDb();
  const { data: before } = await db
    .from("automations")
    .select("*")
    .eq("key", data.key)
    .maybeSingle();
  if (!before) throw new Error("Automation nicht gefunden");
  const current = parseAutomationConfig(data.key, before.config) as Record<string, unknown>;
  const config = data.config
    ? parseInput(automationConfigSchemas[data.key] as z.ZodType, { ...current, ...data.config })
    : current;
  const isEnabled = data.isEnabled ?? before.is_enabled;
  const { error } = await db
    .from("automations")
    .update({ is_enabled: isEnabled, config: asJson(config) })
    .eq("key", data.key);
  if (error) throw dbError("Automation speichern", error);
  if (isEnabled) await ensureCrmSweepScheduled();
  await writeAudit(actor, {
    action: "automation.update",
    entityType: "automation",
    entityId: data.key,
    before: { is_enabled: before.is_enabled, config: before.config },
    after: { is_enabled: isEnabled, config },
  });
}

/** Vorschau der Vorlage einer Automation. */
export async function previewAutomation(key: AutomationKey) {
  const k = parseInput(z.enum(AUTOMATION_KEYS), key);
  return renderTemplate(AUTOMATION_META[k].template);
}

/**
 * Sweep im Viertelstundentakt einplanen (idempotent je Viertelstunde). Der Sweep plant sich selbst
 * neu ein, solange mindestens eine Automation eingeschaltet ist.
 */
export async function ensureCrmSweepScheduled(now: Date = new Date()): Promise<void> {
  const bucket = sweepBucket(now);
  await enqueueCrmJob({
    kind: "automation.sweep",
    payload: { bucket: bucket.key },
    idempotencyKey: `automation.sweep:${bucket.key}`,
    runAt: now.toISOString(),
    priority: 150,
    maxAttempts: 3,
  });
}
