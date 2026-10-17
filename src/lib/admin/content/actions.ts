"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import {
  archiveBlogPost,
  createBlogPost,
  deleteBlogPost,
  publishBlogPost,
  unpublishBlogPost,
  updateBlogPost,
} from "./blog";
import { berlinLocalToIso, flag, formValues, optText, text } from "./input";
import {
  createLegalDraft,
  deleteLegalDraft,
  getLegalVersion,
  LEGAL_KINDS,
  publishLegalVersion,
  updateLegalDraft,
} from "./legal";
import { uploadContentImage } from "./media";
import {
  archivePage,
  createPage,
  publishPage,
  unpublishPage,
  updatePage,
  type PageInput,
} from "./pages";
import { runAdminAction } from "./run-action";

/**
 * Server Actions für /admin/inhalte: Seiten, Rechtstexte, Blog, Bilder. Jede Action prüft
 * requireStaff und editContent (runAdminAction), die Serverlogik prüft mit Zod, schreibt das
 * Audit-Log und revalidiert die Storefront (Tags "content" und "legal").
 */

const BASE = "/admin/inhalte";
const uuid = z.string().uuid();

/* Seiten -------------------------------------------------------------------------------------- */

function pageInput(fd: FormData): PageInput {
  return {
    title: text(fd, "title"),
    handle: text(fd, "handle"),
    template: (text(fd, "template") || "default") as PageInput["template"],
    bodyHtml: text(fd, "bodyHtml"),
    seoTitle: optText(fd, "seoTitle"),
    seoDescription: optText(fd, "seoDescription"),
    ogImagePath: optText(fd, "ogImagePath"),
    noindex: flag(fd, "noindex"),
    showInSitemap: flag(fd, "showInSitemap"),
    position: Number(text(fd, "position") || 0),
  };
}

export async function savePageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  let createdId: string | null = null;
  const result = await runAdminAction(
    "editContent",
    `${BASE}/seiten`,
    async (session) => {
      if (id) {
        await updatePage(id, pageInput(fd), session);
        revalidatePath(`${BASE}/seiten`);
        revalidatePath(`${BASE}/seiten/${id}`);
        await flashToast("Seite gespeichert");
        return actionOk();
      }
      const created = await createPage({ ...pageInput(fd), template: "default" }, session);
      createdId = created.id;
      await flashToast("Seite als Entwurf angelegt");
    },
    formValues(fd),
  );
  if (createdId) redirect(`${BASE}/seiten/${createdId}` as Route);
  return result;
}

export async function pageStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  const intent = text(fd, "intent");
  return runAdminAction("editContent", `${BASE}/seiten/${id}`, async (session) => {
    if (intent === "publish") await publishPage(id, session);
    else if (intent === "unpublish") await unpublishPage(id, session);
    else if (intent === "archive") await archivePage(id, session);
    else return actionError("Unbekannte Aktion.");
    revalidatePath(`${BASE}/seiten`);
    revalidatePath(`${BASE}/seiten/${id}`);
    await flashToast(
      intent === "publish"
        ? "Seite veröffentlicht"
        : intent === "unpublish"
          ? "Seite ist wieder ein Entwurf"
          : "Seite archiviert",
    );
  });
}

/* Rechtstexte --------------------------------------------------------------------------------- */

const kindSchema = z.enum(LEGAL_KINDS);

export async function createLegalDraftAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const kind = kindSchema.safeParse(text(fd, "kind"));
  if (!kind.success) return actionError("Unbekannter Rechtstext.");
  const basedOn = text(fd, "basedOnVersionId");
  let done = false;
  const result = await runAdminAction("editContent", `${BASE}/rechtstexte`, async (session) => {
    const draft = await createLegalDraft(
      {
        kind: kind.data,
        basedOnVersionId: basedOn || undefined,
        changeNote: basedOn ? (optText(fd, "changeNote") ?? undefined) : undefined,
      },
      session,
    );
    await flashToast(
      basedOn
        ? `Version ${draft.version} als Entwurf aus der älteren Fassung angelegt`
        : `Entwurf Version ${draft.version} angelegt`,
    );
    done = true;
  });
  if (done) redirect(`${BASE}/rechtstexte/${kind.data}` as Route);
  return result;
}

/**
 * Entwurf speichern (intent=save) oder speichern und veröffentlichen (intent=publish, Felder
 * effectiveMode und effectiveFrom aus dem Bestätigungsdialog, der per form-Attribut zum
 * Editor gehört). Veröffentlichte Versionen bleiben unverändert erhalten (Trigger in der DB).
 */
export async function saveLegalDraftAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const versionId = text(fd, "versionId");
  const intent = text(fd, "intent") === "publish" ? "publish" : "save";
  let publishedKind: string | null = null;
  const result = await runAdminAction(
    "editContent",
    `${BASE}/rechtstexte`,
    async (session) => {
      if (!uuid.safeParse(versionId).success) return actionError("Version nicht gefunden.");
      // Beim Veröffentlichen erst die Bestätigung prüfen, dann speichern (kein halber Zustand)
      let effectiveFrom: string | null = null;
      if (intent === "publish") {
        if (!flag(fd, "confirmChecked"))
          return actionError("Bitte bestätige, dass der Text geprüft ist.", {
            fieldErrors: { confirmChecked: "Bestätigung fehlt" },
            values: formValues(fd),
          });
        if (text(fd, "effectiveMode") === "later") {
          effectiveFrom = berlinLocalToIso(text(fd, "effectiveFrom"));
          if (!effectiveFrom)
            return actionError("Bitte gib Datum und Uhrzeit an.", {
              fieldErrors: { effectiveFrom: "Datum und Uhrzeit fehlen" },
              values: formValues(fd),
            });
        }
      }
      await updateLegalDraft(
        versionId,
        {
          title: text(fd, "title"),
          bodyHtml: text(fd, "bodyHtml"),
          changeNote: optText(fd, "changeNote"),
        },
        session,
      );
      const version = await getLegalVersion(versionId);
      if (intent === "save") {
        if (version?.kind) revalidatePath(`${BASE}/rechtstexte/${version.kind}`);
        await flashToast("Entwurf gespeichert, live bleibt die veröffentlichte Version");
        return actionOk();
      }
      await publishLegalVersion({ versionId, effectiveFrom }, session);
      publishedKind = version?.kind ?? "";
      await flashToast(
        effectiveFrom
          ? `Version ${version?.version} veröffentlicht, gültig ab dem gewählten Zeitpunkt`
          : `Version ${version?.version} ist jetzt live`,
      );
    },
    formValues(fd),
  );
  if (publishedKind !== null) {
    revalidatePath(`${BASE}/rechtstexte`);
    redirect(`${BASE}/rechtstexte/${publishedKind}` as Route);
  }
  return result;
}

export async function deleteLegalDraftAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const versionId = text(fd, "versionId");
  const kind = kindSchema.safeParse(text(fd, "kind"));
  let done = false;
  const result = await runAdminAction("editContent", `${BASE}/rechtstexte`, async (session) => {
    await deleteLegalDraft(versionId, session);
    await flashToast("Entwurf verworfen");
    done = true;
  });
  if (done) redirect(`${BASE}/rechtstexte/${kind.success ? kind.data : ""}` as Route);
  return result;
}

/* Blog ---------------------------------------------------------------------------------------- */

function blogInput(fd: FormData) {
  return {
    title: text(fd, "title"),
    handle: text(fd, "handle"),
    excerpt: optText(fd, "excerpt"),
    bodyHtml: text(fd, "bodyHtml"),
    coverImagePath: optText(fd, "coverImagePath"),
    authorName: optText(fd, "authorName"),
    seoTitle: optText(fd, "seoTitle"),
    seoDescription: optText(fd, "seoDescription"),
  };
}

export async function saveBlogPostAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  let createdId: string | null = null;
  const result = await runAdminAction(
    "editContent",
    `${BASE}/blog`,
    async (session) => {
      if (id) {
        await updateBlogPost(id, blogInput(fd), session);
        revalidatePath(`${BASE}/blog`);
        revalidatePath(`${BASE}/blog/${id}`);
        await flashToast("Beitrag gespeichert");
        return actionOk();
      }
      const created = await createBlogPost(blogInput(fd), session);
      createdId = created.id;
      await flashToast("Beitrag als Entwurf angelegt");
    },
    formValues(fd),
  );
  if (createdId) redirect(`${BASE}/blog/${createdId}` as Route);
  return result;
}

export async function blogStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  const intent = text(fd, "intent");
  let deleted = false;
  const result = await runAdminAction("editContent", `${BASE}/blog/${id}`, async (session) => {
    if (intent === "publish") await publishBlogPost(id, session);
    else if (intent === "unpublish") await unpublishBlogPost(id, session);
    else if (intent === "archive") await archiveBlogPost(id, session);
    else if (intent === "delete") {
      await deleteBlogPost(id, session);
      deleted = true;
    } else return actionError("Unbekannte Aktion.");
    revalidatePath(`${BASE}/blog`);
    revalidatePath(`${BASE}/blog/${id}`);
    await flashToast(
      {
        publish: "Beitrag veröffentlicht",
        unpublish: "Beitrag ist wieder ein Entwurf",
        archive: "Beitrag archiviert",
        delete: "Entwurf gelöscht",
      }[intent] ?? "Gespeichert",
    );
  });
  if (deleted) redirect(`${BASE}/blog` as Route);
  return result;
}

/* Bilder -------------------------------------------------------------------------------------- */

/** Bild hochladen (Client ruft die Action mit FormData auf, Feld "file"). */
export async function uploadContentImageAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return actionError("Bitte wähle ein Bild aus.");
  return runAdminAction("editContent", BASE, async (session) => {
    const stored = await uploadContentImage(file, session);
    return actionOk("Bild hochgeladen", stored);
  });
}
