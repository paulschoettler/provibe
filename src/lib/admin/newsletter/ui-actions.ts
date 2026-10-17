"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { campaignBlockSchema } from "@/emails/campaign";
import { requireStaff, PERMISSIONS } from "@/lib/admin/auth";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { runCrmAction, str } from "@/lib/admin/customers/crm-action";
import { ValidationError } from "@/lib/admin/customers/guard";
import {
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  duplicateCampaign,
  scheduleCampaign,
  sendCampaign,
  sendTestCampaign,
  unscheduleCampaign,
  updateCampaign,
  type CampaignInput,
} from "./campaigns";
import { adminUnsubscribeContact, applyImport, prepareImport } from "./contacts";
import {
  applyIntent,
  berlinLocalToIso,
  fromDraft,
  parseBlocks,
  parseIntent,
  type DraftBlock,
} from "./editor-form";
import { renderCampaignHtml } from "./render";

/**
 * Server Actions des Newsletter-Moduls. Kontakte abmelden darf Support (viewCustomers),
 * Import, Kampagnen bearbeiten, testen, planen und senden nur Owner und Admin (sendNewsletter).
 */

const LIST = "/admin/newsletter";
const uuid = z.string().uuid();

function campaignPath(id: string): string {
  return `${LIST}/kampagnen/${id}`;
}

function safeReturn(path: string): string {
  return /^\/admin\/(kunden|newsletter)(\/[0-9a-z-]+)?(\?[a-z=&-]*)?$/i.test(path) ? path : LIST;
}

/* Kontakte -------------------------------------------------------------------------------- */

export async function unsubscribeContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const back = safeReturn(str(formData, "returnPath") || LIST);
  return runCrmAction(
    "viewCustomers",
    back,
    async (session) => {
      const reason = str(formData, "reason");
      if (reason.length < 3)
        return actionError("Bitte gib einen Grund an.", {
          fieldErrors: { reason: "Mindestens 3 Zeichen" },
        });
      await adminUnsubscribeContact({ contactId: str(formData, "contactId"), reason }, session);
      await flashToast("Kontakt abgemeldet");
      revalidatePath(back.split("?")[0]);
      revalidatePath(LIST);
    },
    { reason: str(formData, "reason") },
  );
}

async function csvFromForm(formData: FormData): Promise<string> {
  const file = formData.get("file");
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) throw new Error("Die Datei ist größer als 2 MB.");
    return await file.text();
  }
  return String(formData.get("csv") ?? "");
}

export async function prepareImportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCrmAction("sendNewsletter", LIST, async () => {
    const csv = await csvFromForm(formData);
    if (!csv.trim())
      return actionError("Bitte wähle eine CSV-Datei.", { fieldErrors: { file: "Pflichtfeld" } });
    const plan = await prepareImport(csv);
    return actionOk(undefined, {
      step: "plan",
      csv,
      columns: plan.columns,
      summary: plan.summary,
      plan: plan.plan,
      duplicates: plan.duplicates,
      errors: plan.errors.slice(0, 20),
      errorCount: plan.errors.length,
      skipped: plan.decisions.filter((d) => d.action === "skip").slice(0, 20),
      issues: plan.rows
        .filter((r) => r.issues.length > 0)
        .slice(0, 20)
        .map((r) => ({ line: r.line, email: r.email, issue: r.issues.join(", ") })),
    });
  });
}

export async function applyImportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCrmAction("sendNewsletter", LIST, async (session) => {
    if (formData.get("consentConfirmed") !== "on")
      return actionError("Bitte bestätige den Einwilligungsnachweis.", {
        fieldErrors: { consentConfirmed: "Pflicht vor dem Import" },
      });
    const csv = String(formData.get("csv") ?? "");
    if (!csv.trim()) return actionError("Die Datei fehlt, bitte noch einmal hochladen.");
    const result = await applyImport(csv, session);
    await flashToast(
      `Import fertig: ${result.inserted} neu, ${result.updated} aktualisiert, ${result.skipped} übersprungen${result.errors ? `, ${result.errors} Zeilen mit Fehlern` : ""}`,
    );
    revalidatePath(LIST);
    return actionOk(undefined, { step: "done" });
  });
}

/* Kampagnen ------------------------------------------------------------------------------- */

export async function createCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = { name: str(formData, "name"), subject: str(formData, "subject") };
  let id: string | null = null;
  const state = await runCrmAction(
    "sendNewsletter",
    `${LIST}/kampagnen/neu`,
    async (session) => {
      const segmentId = str(formData, "segmentId");
      const created = await createCampaign(
        {
          name: values.name,
          subject: values.subject,
          preheader: str(formData, "preheader") || null,
          segmentId: uuid.safeParse(segmentId).success ? segmentId : null,
          blocks: [
            { id: "b1", type: "text", heading: values.subject, body: "" },
            { id: "b2", type: "button", label: "Jetzt entdecken", href: "/collections/all" },
          ],
        },
        session,
      );
      id = created.id;
      await flashToast("Entwurf angelegt");
      revalidatePath(LIST);
    },
    values,
  );
  if (id) redirect(campaignPath(id));
  return state;
}

function metaFromForm(formData: FormData) {
  const segmentId = str(formData, "segmentId");
  return {
    name: str(formData, "name"),
    subject: str(formData, "subject"),
    preheader: str(formData, "preheader") || null,
    replyTo: str(formData, "replyTo") || null,
    segmentId: uuid.safeParse(segmentId).success ? segmentId : null,
  };
}

/**
 * Editor speichern. Buttons mit name="intent" (add:text, up:2, down:2, remove:2) ändern ohne
 * JavaScript nur die Blockliste und geben sie zurück; "save" prüft und speichert.
 */
export async function saveCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "campaignId");
  const path = uuid.safeParse(id).success ? campaignPath(id) : LIST;
  const intent = parseIntent(str(formData, "intent"));
  const parsedBlocks = parseBlocks(
    Array.from(formData.entries()).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  const meta = metaFromForm(formData);
  const values = {
    name: meta.name,
    subject: meta.subject,
    preheader: meta.preheader ?? "",
    replyTo: meta.replyTo ?? "",
  };
  if (intent.kind !== "save") {
    await requireStaff("support", { next: path });
    const next = applyIntent(parsedBlocks, intent);
    return actionOk(undefined, { blocks: next.blocks, focus: next.focus, meta: values });
  }
  return runCrmAction(
    "sendNewsletter",
    path,
    async (session) => {
      try {
        await updateCampaign(
          id,
          { ...meta, blocks: parsedBlocks.map(fromDraft) as unknown as CampaignInput["blocks"] },
          session,
        );
      } catch (error) {
        if (error instanceof ValidationError)
          return {
            status: "error",
            message: error.message,
            fieldErrors: error.fieldErrors,
            data: { blocks: parsedBlocks, meta: values },
          };
        throw error;
      }
      await flashToast("Entwurf gespeichert");
      revalidatePath(path);
      revalidatePath(LIST);
      return actionOk(undefined, { blocks: parsedBlocks, saved: Date.now(), meta: values });
    },
    values,
  );
}

const previewSchema = z.object({
  campaignId: z.string().uuid().nullable(),
  subject: z.string().max(150),
  preheader: z.string().max(200).nullable(),
  blocks: z.array(z.unknown()).max(60),
});

/**
 * Live-Vorschau im Editor: rendert den aktuellen Entwurf serverseitig (Brand-Vorlage, aktuelle
 * Katalogpreise). Unvollständige Blöcke werden ausgelassen statt Fehler zu werfen.
 */
export async function renderDraftPreview(input: {
  campaignId: string | null;
  subject: string;
  preheader: string | null;
  blocks: DraftBlock[];
}): Promise<{ html: string; skipped: number } | { error: string }> {
  const session = await requireStaff("support");
  if (!PERMISSIONS.viewCustomers(session)) return { error: "Keine Berechtigung" };
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { error: "Ungültige Vorschau" };
  const valid = [];
  let skipped = 0;
  for (const b of parsed.data.blocks) {
    const res = campaignBlockSchema.safeParse(fromDraft(b as DraftBlock));
    if (res.success) valid.push(res.data);
    else skipped++;
  }
  try {
    const mail = await renderCampaignHtml(
      {
        id: parsed.data.campaignId,
        subject: parsed.data.subject || "Ohne Betreff",
        preheader: parsed.data.preheader,
        content: valid,
      },
      { preview: true },
    );
    return { html: mail.html, skipped };
  } catch (error) {
    console.error("[newsletter] Vorschau", error);
    return { error: "Vorschau konnte nicht erstellt werden" };
  }
}

export async function testSendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = str(formData, "campaignId");
  const to = str(formData, "to");
  return runCrmAction(
    "sendNewsletter",
    campaignPath(id),
    async (session) => {
      const result = await sendTestCampaign({ campaignId: id, to }, session);
      const text =
        result.status === "sent"
          ? `Testversand an ${to} verschickt`
          : result.status === "suppressed"
            ? `${to} steht auf der Sperrliste, nicht verschickt`
            : `Testversand an ${to}: ${result.status}`;
      await flashToast(text, result.status === "sent" ? "success" : "error");
      revalidatePath(campaignPath(id));
    },
    { to },
  );
}

export async function scheduleCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "campaignId");
  const values = { date: str(formData, "date"), time: str(formData, "time") };
  return runCrmAction(
    "sendNewsletter",
    campaignPath(id),
    async (session) => {
      const iso = berlinLocalToIso(values.date, values.time);
      if (!iso)
        return actionError("Bitte wähle Datum und Uhrzeit.", {
          fieldErrors: { date: "Pflichtfeld", time: "Pflichtfeld" },
          values,
        });
      await scheduleCampaign({ campaignId: id, scheduledAt: iso }, session);
      await flashToast("Versand geplant");
      revalidatePath(campaignPath(id));
      revalidatePath(LIST);
    },
    values,
  );
}

export async function sendNowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = str(formData, "campaignId");
  return runCrmAction("sendNewsletter", campaignPath(id), async (session) => {
    await sendCampaign(id, session);
    await flashToast("Versand gestartet. Die Job-Queue verschickt in Paketen.");
    revalidatePath(campaignPath(id));
    revalidatePath(LIST);
  });
}

export async function unscheduleCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "campaignId");
  return runCrmAction("sendNewsletter", campaignPath(id), async (session) => {
    await unscheduleCampaign(id, session);
    await flashToast("Planung aufgehoben, die Kampagne ist wieder ein Entwurf");
    revalidatePath(campaignPath(id));
    revalidatePath(LIST);
  });
}

export async function cancelCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "campaignId");
  return runCrmAction("sendNewsletter", campaignPath(id), async (session) => {
    await cancelCampaign(id, session);
    await flashToast("Versand abgebrochen");
    revalidatePath(campaignPath(id));
    revalidatePath(LIST);
  });
}

export async function duplicateCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "campaignId");
  let copy: string | null = null;
  const state = await runCrmAction("sendNewsletter", campaignPath(id), async (session) => {
    copy = (await duplicateCampaign(id, session)).id;
    await flashToast("Kampagne kopiert");
    revalidatePath(LIST);
  });
  if (copy) redirect(campaignPath(copy));
  return state;
}

export async function deleteCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "campaignId");
  let deleted = false;
  const state = await runCrmAction("sendNewsletter", campaignPath(id), async (session) => {
    await deleteCampaign(id, session);
    deleted = true;
    await flashToast("Entwurf gelöscht");
    revalidatePath(LIST);
  });
  if (deleted) redirect(`${LIST}?tab=kampagnen`);
  return state;
}
