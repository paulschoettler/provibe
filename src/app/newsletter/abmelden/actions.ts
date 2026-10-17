"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { unsubscribeByToken } from "@/lib/admin/newsletter/unsubscribe";
import { UNSUBSCRIBE_REASONS } from "./reasons";

const schema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  campaign: z.string().uuid().optional().or(z.literal("")),
  reason: z
    .enum(UNSUBSCRIBE_REASONS.map((r) => r.value) as [string, ...string[]])
    .optional()
    .or(z.literal("")),
});

/**
 * Abmeldung bestätigen (Formular auf /newsletter/abmelden, funktioniert ohne JavaScript).
 * Der GET-Aufruf des Links meldet bewusst nicht ab, weil Mailprogramme Links vorab öffnen.
 */
export async function confirmUnsubscribe(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    token: String(formData.get("token") ?? ""),
    campaign: String(formData.get("campaign") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) redirect("/newsletter/abmelden?ergebnis=ungueltig");
  const { token, campaign, reason } = parsed.data;
  let result: "unsubscribed" | "already" | "invalid";
  try {
    result = await unsubscribeByToken(token, {
      reason: reason || null,
      campaignId: campaign || null,
      source: "page",
    });
  } catch {
    redirect(`/newsletter/abmelden?token=${encodeURIComponent(token)}&ergebnis=fehler`);
  }
  const ergebnis = result === "invalid" ? "ungueltig" : "abgemeldet";
  redirect(`/newsletter/abmelden?token=${encodeURIComponent(token)}&ergebnis=${ergebnis}`);
}
