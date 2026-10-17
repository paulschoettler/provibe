import "server-only";
import { createHash } from "node:crypto";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { crmDb } from "@/lib/admin/customers/crm-db";
import { assertPermission } from "@/lib/admin/customers/guard";
import { checkImage, fileStem } from "@/lib/admin/media/rules";
import { contentImageUrl } from "./image-url";

/**
 * Bilder für Inhalte (Blog-Titelbild, Startseiten-Module, OG-Bild). Ablage im öffentlichen Bucket
 * "media" unter content/<name>-<hash>.<ext>. Gespeichert wird der Pfad mit Bucket
 * ("media/content/..."), so wie die Storefront Titelbilder auflöst (src/app/blogs/news/page.tsx).
 * Server Actions sind auf 2 MB begrenzt (next.config.ts); größere Bilder vorher verkleinern.
 */

export const CONTENT_BUCKET = "media";
export { contentImageUrl };
export const MAX_CONTENT_IMAGE_BYTES = 2 * 1024 * 1024 - 64 * 1024;

export async function uploadContentImage(
  file: File,
  actor: StaffSession,
): Promise<{ path: string; url: string | null }> {
  assertPermission(actor, "editContent");
  if (file.size > MAX_CONTENT_IMAGE_BYTES)
    throw new Error("Das Bild ist größer als 2 MB. Bitte verkleinere es vor dem Hochladen.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(bytes, file.type || null);
  if (!check.ok) throw new Error(check.error);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const objectPath = `content/${fileStem(file.name)}-${hash}.${check.image.extension}`;
  const { error } = await crmDb().storage.from(CONTENT_BUCKET).upload(objectPath, bytes, {
    contentType: check.image.type,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) {
    console.error("[content] Bild-Upload", error.message);
    throw new Error("Das Bild konnte nicht gespeichert werden.");
  }
  const path = `${CONTENT_BUCKET}/${objectPath}`;
  await writeAudit(actor, {
    action: "content_image.upload",
    entityType: "media",
    entityId: path,
    after: { path, bytes: bytes.length, width: check.image.width, height: check.image.height },
  });
  return { path, url: contentImageUrl(path) };
}
