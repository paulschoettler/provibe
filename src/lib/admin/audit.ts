import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { StaffSession } from "./auth";

/**
 * Audit-Log für jede schreibende Aktion im Backoffice (Briefing Abschnitt 8).
 * action im Muster "<entity>.<verb>", zum Beispiel "order.refund", "product.update".
 * before/after nur die geänderten Felder, keine Secrets, keine kompletten Datensätze mit Kundendaten
 * über das Nötige hinaus.
 */
export async function writeAudit(
  actor: StaffSession | null,
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
    userAgent = h.get("user-agent");
  } catch {
    // außerhalb eines Requests (Jobs): ohne IP
  }
  const { error } = await supabaseAdmin()
    .from("audit_log")
    .insert({
      actor_user_id: actor?.userId ?? null,
      actor_email: actor?.email ?? null,
      actor_role: actor?.role ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      before: (input.before ?? null) as never,
      after: (input.after ?? null) as never,
      ip: ip as never,
      user_agent: userAgent,
    });
  if (error) console.error("audit_log:", error.message);
}
