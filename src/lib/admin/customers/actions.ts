import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { callbackUrl } from "@/lib/auth/links";
import { sendActivationMail } from "@/lib/auth/mails";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import { isAllowlistActive } from "@/lib/admin/emails/context";
import { canSendTo } from "@/lib/admin/emails/policy";
import { asJson, crmDb, dbError } from "./crm-db";
import { assertPermission, parseInput } from "./guard";
import { normalizeTags } from "./profile";

/**
 * Schreibende Aktionen im Kundenprofil. Aufruf aus Server Actions nach requireStaff(); jede
 * Funktion prüft das Modulrecht, validiert mit Zod, schreibt audit_log und customer_events.
 */

const uuid = z.string().uuid("Ungültige ID");

async function loadCustomer(id: string) {
  const { data, error } = await crmDb()
    .from("customers")
    .select(
      "id, email, first_name, last_name, phone, locale, tags, auth_user_id, anonymized_at, blocked_at, blocked_reason",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw dbError("Kunde laden", error);
  if (!data) throw new Error("Kunde nicht gefunden");
  return data;
}

async function customerEvent(customerId: string, kind: string, data: Record<string, unknown> = {}) {
  const { error } = await crmDb()
    .from("customer_events")
    .insert({ customer_id: customerId, kind, data: asJson(data) });
  if (error) console.error("[crm] customer_events", error.message);
}

/* Tags ----------------------------------------------------------------------------------- */

const tagsSchema = z.object({ customerId: uuid, tags: z.array(z.string().max(100)).max(50) });

export async function setCustomerTags(
  input: { customerId: string; tags: string[] },
  actor: StaffSession,
): Promise<string[]> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(tagsSchema, input);
  const customer = await loadCustomer(data.customerId);
  const tags = normalizeTags(data.tags);
  const { error } = await crmDb().from("customers").update({ tags }).eq("id", customer.id);
  if (error) throw dbError("Tags speichern", error);
  await customerEvent(customer.id, "tags_changed", { tags, by: actor.email });
  await writeAudit(actor, {
    action: "customer.tags",
    entityType: "customer",
    entityId: customer.id,
    before: { tags: customer.tags },
    after: { tags },
  });
  return tags;
}

export async function addCustomerTag(
  input: { customerId: string; tag: string },
  actor: StaffSession,
): Promise<string[]> {
  const { customerId, tag } = parseInput(
    z.object({ customerId: uuid, tag: z.string().trim().min(1).max(40) }),
    input,
  );
  const customer = await loadCustomer(customerId);
  return setCustomerTags({ customerId, tags: [...customer.tags, tag] }, actor);
}

export async function removeCustomerTag(
  input: { customerId: string; tag: string },
  actor: StaffSession,
): Promise<string[]> {
  const { customerId, tag } = parseInput(
    z.object({ customerId: uuid, tag: z.string().min(1).max(100) }),
    input,
  );
  const customer = await loadCustomer(customerId);
  const key = tag.trim().toLocaleLowerCase("de-DE");
  return setCustomerTags(
    { customerId, tags: customer.tags.filter((t) => t.toLocaleLowerCase("de-DE") !== key) },
    actor,
  );
}

/* Notizen (customer_notes, nur intern sichtbar) ------------------------------------------- */

export async function addCustomerNote(
  input: { customerId: string; body: string },
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(
    z.object({
      customerId: uuid,
      body: z.string().trim().min(1, "Bitte schreib eine Notiz.").max(5000),
    }),
    input,
  );
  await loadCustomer(data.customerId);
  const { data: note, error } = await crmDb()
    .from("customer_notes")
    .insert({ customer_id: data.customerId, author_user_id: actor.userId, body: data.body })
    .select("id")
    .single();
  if (error) throw dbError("Notiz speichern", error);
  await writeAudit(actor, {
    action: "customer.note_add",
    entityType: "customer",
    entityId: data.customerId,
    after: { note_id: note.id, length: data.body.length },
  });
  return { id: note.id };
}

/** Notiz löschen: eigene Notizen oder als Owner/Admin. */
export async function deleteCustomerNote(
  input: { noteId: string },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "viewCustomers");
  const { noteId } = parseInput(z.object({ noteId: uuid }), input);
  const db = crmDb();
  const { data: note } = await db.from("customer_notes").select("*").eq("id", noteId).maybeSingle();
  if (!note) return;
  const mayDelete =
    note.author_user_id === actor.userId || actor.role === "owner" || actor.role === "admin";
  if (!mayDelete) throw new Error("Nur eigene Notizen lassen sich löschen");
  const { error } = await db.from("customer_notes").delete().eq("id", noteId);
  if (error) throw dbError("Notiz löschen", error);
  await writeAudit(actor, {
    action: "customer.note_delete",
    entityType: "customer",
    entityId: note.customer_id,
    before: { note_id: note.id, body: note.body },
  });
}

/* Kontaktdaten ---------------------------------------------------------------------------- */

const contactSchema = z.object({
  customerId: uuid,
  firstName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+0-9 ()/-]*$/, "Bitte gib eine gültige Telefonnummer ein.")
    .nullable()
    .optional(),
  locale: z.enum(["de"]).optional(),
});

export async function updateCustomerContact(
  input: z.input<typeof contactSchema>,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(contactSchema, input);
  const before = await loadCustomer(data.customerId);
  if (before.anonymized_at) throw new Error("Gelöschte Kunden lassen sich nicht bearbeiten");
  const patch = {
    ...(data.firstName !== undefined ? { first_name: data.firstName || null } : {}),
    ...(data.lastName !== undefined ? { last_name: data.lastName || null } : {}),
    ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
    ...(data.locale ? { locale: data.locale } : {}),
  };
  const { error } = await crmDb().from("customers").update(patch).eq("id", data.customerId);
  if (error) throw dbError("Kontaktdaten speichern", error);
  await writeAudit(actor, {
    action: "customer.update",
    entityType: "customer",
    entityId: data.customerId,
    before: {
      first_name: before.first_name,
      last_name: before.last_name,
      phone: before.phone,
      locale: before.locale,
    },
    after: patch,
  });
}

/* Aktivierungslink ------------------------------------------------------------------------ */

export type ActivationResult =
  | { status: "sent" }
  | { status: "already_active" }
  | { status: "blocked_allowlist" }
  | { status: "not_allowed"; reason: string };

/**
 * "Konto aktivieren"-Mail für Bestandskunden ohne Login (Shopify-Import, Gastbestellung).
 * Nutzt die Bausteine des Konto-Pakets (callbackUrl, sendActivationMail). Bis zum Go-live nur an
 * Adressen der Allowlist, damit kein importierter Kunde versehentlich eine Mail bekommt.
 */
export async function sendActivationLink(
  customerId: string,
  actor: StaffSession,
): Promise<ActivationResult> {
  assertPermission(actor, "viewCustomers");
  const id = parseInput(uuid, customerId);
  const customer = await loadCustomer(id);
  if (customer.anonymized_at) return { status: "not_allowed", reason: "Kunde ist gelöscht" };
  if (customer.blocked_at) return { status: "not_allowed", reason: "Kunde ist gesperrt" };
  if (customer.auth_user_id) return { status: "already_active" };

  const env = serverEnv();
  const db = crmDb();
  const email = String(customer.email);
  const logBase = {
    to_email: email,
    from_email: env.EMAIL_FROM_TRANSACTIONAL,
    reply_to: env.EMAIL_REPLY_TO,
    subject: "Dein provibe Konto ist bereit",
    template: "account_activate",
    category: "auth" as const,
    provider: integrations().email.name,
    customer_id: customer.id,
    metadata: asJson({ triggered_by: actor.email }),
  };

  if (!canSendTo(email, env, await isAllowlistActive())) {
    await db.from("email_messages").insert({ ...logBase, status: "blocked_allowlist" });
    await writeAudit(actor, {
      action: "customer.activation_blocked",
      entityType: "customer",
      entityId: customer.id,
      after: { reason: "allowlist" },
    });
    return { status: "blocked_allowlist" };
  }

  const next = "/account";
  const { data, error } = await supabaseAuthAdmin().generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: callbackUrl(next) },
  });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) throw dbError("Aktivierungslink erzeugen", error);
  const link = `${publicEnv.siteUrl}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${encodeURIComponent(next)}`;
  const result = await sendActivationMail(email, link, customer.first_name);
  const now = new Date().toISOString();
  await db.from("email_messages").insert({
    ...logBase,
    status: result.status,
    provider_message_id: result.providerMessageId,
    sent_at: result.status === "sent" ? now : null,
  });
  if (result.status !== "sent") return { status: "blocked_allowlist" };
  await db.from("customers").update({ activation_email_sent_at: now }).eq("id", customer.id);
  await customerEvent(customer.id, "activation_sent", { by: actor.email });
  await writeAudit(actor, {
    action: "customer.activation_sent",
    entityType: "customer",
    entityId: customer.id,
  });
  return { status: "sent" };
}

function supabaseAuthAdmin() {
  return crmDb().auth.admin;
}

/* Sperren -------------------------------------------------------------------------------- */

/**
 * Kunde sperren: Login wird über Supabase Auth gebannt, blocked_at gesetzt. Bestellungen bleiben.
 * Der Checkout sollte blocked_at prüfen (offen, Paket Checkout).
 */
export async function blockCustomer(
  input: { customerId: string; reason: string },
  actor: StaffSession,
): Promise<void> {
  if (actor.role !== "owner" && actor.role !== "admin")
    throw new Error("Keine Berechtigung für diese Aktion");
  const data = parseInput(
    z.object({
      customerId: uuid,
      reason: z.string().trim().min(3, "Bitte gib einen Grund an.").max(500),
    }),
    input,
  );
  const customer = await loadCustomer(data.customerId);
  if (customer.blocked_at) return;
  const now = new Date().toISOString();
  const { error } = await crmDb()
    .from("customers")
    .update({ blocked_at: now, blocked_reason: data.reason, blocked_by: actor.userId })
    .eq("id", customer.id);
  if (error) throw dbError("Kunde sperren", error);
  if (customer.auth_user_id) {
    const { error: banError } = await supabaseAuthAdmin().updateUserById(customer.auth_user_id, {
      ban_duration: "876000h",
    });
    if (banError) console.error("[crm] Auth-Sperre fehlgeschlagen", banError.message);
  }
  await customerEvent(customer.id, "blocked", { reason: data.reason, by: actor.email });
  await writeAudit(actor, {
    action: "customer.block",
    entityType: "customer",
    entityId: customer.id,
    after: { blocked_at: now, reason: data.reason },
  });
}

export async function unblockCustomer(
  input: { customerId: string },
  actor: StaffSession,
): Promise<void> {
  if (actor.role !== "owner" && actor.role !== "admin")
    throw new Error("Keine Berechtigung für diese Aktion");
  const { customerId } = parseInput(z.object({ customerId: uuid }), input);
  const customer = await loadCustomer(customerId);
  if (!customer.blocked_at) return;
  const { error } = await crmDb()
    .from("customers")
    .update({ blocked_at: null, blocked_reason: null, blocked_by: null })
    .eq("id", customer.id);
  if (error) throw dbError("Sperre aufheben", error);
  if (customer.auth_user_id) {
    const { error: banError } = await supabaseAuthAdmin().updateUserById(customer.auth_user_id, {
      ban_duration: "none",
    });
    if (banError) console.error("[crm] Auth-Sperre aufheben fehlgeschlagen", banError.message);
  }
  await customerEvent(customer.id, "unblocked", { by: actor.email });
  await writeAudit(actor, {
    action: "customer.unblock",
    entityType: "customer",
    entityId: customer.id,
    before: { blocked_at: customer.blocked_at, reason: customer.blocked_reason },
  });
}
