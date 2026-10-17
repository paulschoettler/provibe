import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { ValidationError, assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { isAllowlistActive, siteUrl } from "@/lib/admin/emails/context";
import { canSendTo } from "@/lib/admin/emails/policy";
import { sendTrackedEmail, type EmailStatus } from "@/lib/admin/emails/send";
import { renderTemplate } from "@/lib/admin/emails/templates";
import { serverEnv } from "@/lib/env/server";
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
  const config = (
    data.config
      ? parseInput(automationConfigSchemas[data.key] as z.ZodType, { ...current, ...data.config })
      : current
  ) as Record<string, unknown>;
  if (typeof config.discount_code === "string") {
    const { data: code } = await db
      .from("discount_codes")
      .select("code, is_active, ends_at")
      .eq("code", config.discount_code)
      .maybeSingle();
    if (!code || !code.is_active || (code.ends_at && new Date(code.ends_at) < new Date()))
      throw new ValidationError({
        discount_code: "Diesen Rabattcode gibt es nicht oder er ist nicht aktiv.",
      });
  }
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

export interface AutomationRunRow {
  id: string;
  key: AutomationKey;
  targetType: string;
  targetId: string;
  email: string;
  status: "scheduled" | "sent" | "skipped" | "failed";
  scheduledFor: string;
  sentAt: string | null;
  skipReason: string | null;
  error: string | null;
  createdAt: string;
}

/** Letzte Läufe (automation_runs) mit Ergebnis und Grund aus den Regeln in rules.ts. */
export async function listAutomationRuns(
  filter: { key?: AutomationKey; status?: AutomationRunRow["status"]; limit?: number } = {},
): Promise<AutomationRunRow[]> {
  let query = crmDb()
    .from("automation_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(filter.limit ?? 20, 1), 200));
  if (filter.key) query = query.eq("automation_key", filter.key);
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query;
  if (error) throw dbError("Automationsläufe laden", error);
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.automation_key as AutomationKey,
    targetType: r.target_type,
    targetId: r.target_id,
    email: String(r.email),
    status: r.status as AutomationRunRow["status"],
    scheduledFor: r.scheduled_for,
    sentAt: r.sent_at,
    skipReason: r.skip_reason,
    error: r.error,
    createdAt: r.created_at,
  }));
}

/**
 * Testversand einer Automation an eine Adresse der Allowlist (auch nach dem Go-live), mit
 * Beispieldaten und Banner "TESTVERSAND". Wird wie jede Werbemail protokolliert.
 */
export async function sendAutomationTest(
  input: { key: AutomationKey; to: string },
  actor: StaffSession,
): Promise<{ status: EmailStatus }> {
  assertPermission(actor, "sendNewsletter");
  const data = parseInput(
    z.object({
      key: z.enum(AUTOMATION_KEYS),
      to: z.string().trim().toLowerCase().email("Bitte gib eine gültige Testadresse ein."),
    }),
    input,
  );
  if (!canSendTo(data.to, serverEnv(), true))
    throw new ValidationError({ to: "Testversand nur an Adressen der Allowlist." });
  const mail = await renderTemplate(AUTOMATION_META[data.key].template, { first_name: "Test" });
  if (!mail) throw new Error("Vorlage nicht gefunden");
  const unsubscribeUrl = `${siteUrl()}/newsletter/abmelden?token=testversand`;
  const result = await sendTrackedEmail({
    to: data.to,
    subject: `[TEST] ${mail.subject}`,
    html: mail.html.replace(/VORSCHAU/g, "TESTVERSAND"),
    text: mail.text.replace(/VORSCHAU/g, "TESTVERSAND"),
    category: "marketing",
    template: AUTOMATION_META[data.key].template,
    unsubscribeUrl,
    metadata: { test: true, automation: data.key, by: actor.email },
  });
  await writeAudit(actor, {
    action: "automation.test_send",
    entityType: "automation",
    entityId: data.key,
    after: { to: data.to, status: result.status },
  });
  return { status: result.status };
}
