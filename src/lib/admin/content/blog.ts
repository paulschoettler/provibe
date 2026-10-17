import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { slugify } from "@/lib/content/html";
import { handleSchema, revalidateBlogPost } from "./common";
import { sanitizeRichHtml } from "./sanitize";

/**
 * Blog (blog_posts, blog_post_translations): Beiträge mit Slug, Teaser, Titelbild, Veröffentlichen.
 * /blogs/news bleibt noindex bis zum ersten veröffentlichten Beitrag (Storefront).
 */

const uuid = z.string().uuid("Ungültige ID");

const postSchema = z.object({
  title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(200),
  handle: handleSchema.optional().or(z.literal("")),
  blogHandle: z.enum(["news"]).default("news"),
  locale: z.enum(["de"]).default("de"),
  excerpt: z.string().trim().max(400).optional().nullable(),
  bodyHtml: z.string().max(500_000).optional().nullable(),
  coverImagePath: z.string().trim().max(500).optional().nullable(),
  authorName: z.string().trim().max(120).optional().nullable(),
  seoTitle: z.string().trim().max(120).optional().nullable(),
  seoDescription: z.string().trim().max(320).optional().nullable(),
});

export type BlogPostInput = z.input<typeof postSchema>;

export interface BlogPostListItem {
  id: string;
  handle: string;
  path: string;
  title: string;
  excerpt: string | null;
  status: "draft" | "published" | "archived";
  coverImagePath: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export async function listBlogPosts(): Promise<BlogPostListItem[]> {
  const { data, error } = await crmDb()
    .from("blog_posts")
    .select(
      "id, handle, blog_handle, status, cover_image_path, published_at, updated_at, blog_post_translations(title, excerpt, locale)",
    )
    .order("created_at", { ascending: false });
  if (error) throw dbError("Blog laden", error);
  return (data ?? []).map((p) => {
    const t = p.blog_post_translations?.find((x) => x.locale === "de");
    return {
      id: p.id,
      handle: p.handle,
      path: `/blogs/${p.blog_handle}/${p.handle}`,
      title: t?.title ?? p.handle,
      excerpt: t?.excerpt ?? null,
      status: p.status,
      coverImagePath: p.cover_image_path,
      publishedAt: p.published_at,
      updatedAt: p.updated_at,
    };
  });
}

export async function getBlogPost(id: string, locale = "de") {
  const postId = parseInput(uuid, id);
  const db = crmDb();
  const { data: p, error } = await db.from("blog_posts").select("*").eq("id", postId).maybeSingle();
  if (error) throw dbError("Beitrag laden", error);
  if (!p) return null;
  const { data: t } = await db
    .from("blog_post_translations")
    .select("*")
    .eq("post_id", p.id)
    .eq("locale", locale)
    .maybeSingle();
  return {
    id: p.id,
    handle: p.handle,
    blogHandle: p.blog_handle,
    path: `/blogs/${p.blog_handle}/${p.handle}`,
    status: p.status,
    authorName: p.author_name,
    coverImagePath: p.cover_image_path,
    publishedAt: p.published_at,
    updatedAt: p.updated_at,
    title: t?.title ?? "",
    excerpt: t?.excerpt ?? null,
    bodyHtml: t?.body_html ?? "",
    seoTitle: t?.seo_title ?? null,
    seoDescription: t?.seo_description ?? null,
  };
}

async function uniqueHandle(base: string, exceptId?: string): Promise<string> {
  const root = base.slice(0, 100) || "beitrag";
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const { data } = await crmDb()
      .from("blog_posts")
      .select("id")
      .eq("handle", candidate)
      .maybeSingle();
    if (!data || data.id === exceptId) return candidate;
  }
  throw new Error("Kein freier URL-Name gefunden");
}

function translationRow(postId: string, d: z.infer<typeof postSchema>) {
  return {
    post_id: postId,
    locale: d.locale,
    title: d.title,
    excerpt: d.excerpt || null,
    body_html: d.bodyHtml ? sanitizeRichHtml(d.bodyHtml) : null,
    seo_title: d.seoTitle || null,
    seo_description: d.seoDescription || null,
  };
}

export async function createBlogPost(
  input: BlogPostInput,
  actor: StaffSession,
): Promise<{ id: string; handle: string }> {
  assertPermission(actor, "editContent");
  const d = parseInput(postSchema, input);
  const handle = await uniqueHandle(d.handle || slugify(d.title));
  const db = crmDb();
  const { data: post, error } = await db
    .from("blog_posts")
    .insert({
      handle,
      blog_handle: d.blogHandle,
      status: "draft",
      author_name: d.authorName || null,
      cover_image_path: d.coverImagePath || null,
    })
    .select("id")
    .single();
  if (error) throw dbError("Beitrag anlegen", error);
  const { error: tErr } = await db
    .from("blog_post_translations")
    .insert(translationRow(post.id, d));
  if (tErr) throw dbError("Beitragstext speichern", tErr);
  await writeAudit(actor, {
    action: "blog.create",
    entityType: "blog_post",
    entityId: post.id,
    after: { handle, title: d.title },
  });
  return { id: post.id, handle };
}

export async function updateBlogPost(
  id: string,
  input: BlogPostInput,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editContent");
  const postId = parseInput(uuid, id);
  const d = parseInput(postSchema, input);
  const db = crmDb();
  const { data: before } = await db.from("blog_posts").select("*").eq("id", postId).maybeSingle();
  if (!before) throw new Error("Beitrag nicht gefunden");
  // Veröffentlichte Beiträge behalten ihren URL-Namen (Links und Rankings)
  const handle =
    before.status === "published" || !d.handle || d.handle === before.handle
      ? before.handle
      : await uniqueHandle(d.handle, postId);
  const { error } = await db
    .from("blog_posts")
    .update({
      handle,
      author_name: d.authorName || null,
      cover_image_path: d.coverImagePath || null,
    })
    .eq("id", postId);
  if (error) throw dbError("Beitrag speichern", error);
  const { error: tErr } = await db
    .from("blog_post_translations")
    .upsert(translationRow(postId, d), { onConflict: "post_id,locale" });
  if (tErr) throw dbError("Beitragstext speichern", tErr);
  if (before.status === "published") revalidateBlogPost(handle);
  await writeAudit(actor, {
    action: "blog.update",
    entityType: "blog_post",
    entityId: postId,
    before: { handle: before.handle },
    after: { handle, title: d.title },
  });
}

async function setStatus(
  id: string,
  status: "draft" | "published" | "archived",
  actor: StaffSession,
) {
  assertPermission(actor, "editContent");
  const postId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db
    .from("blog_posts")
    .select("id, handle, status, published_at")
    .eq("id", postId)
    .maybeSingle();
  if (!before) throw new Error("Beitrag nicht gefunden");
  if (status === "published") {
    const { data: t } = await db
      .from("blog_post_translations")
      .select("title, body_html")
      .eq("post_id", postId)
      .eq("locale", "de")
      .maybeSingle();
    if (!t?.title || !t.body_html)
      throw new Error("Titel und Text sind Pflicht, bevor der Beitrag erscheint");
  }
  const { error } = await db
    .from("blog_posts")
    .update({
      status,
      published_at:
        status === "published"
          ? (before.published_at ?? new Date().toISOString())
          : before.published_at,
    })
    .eq("id", postId);
  if (error) throw dbError("Status speichern", error);
  revalidateBlogPost(before.handle);
  await writeAudit(actor, {
    action: `blog.${status === "published" ? "publish" : status === "draft" ? "unpublish" : "archive"}`,
    entityType: "blog_post",
    entityId: postId,
    before: { status: before.status },
    after: { status },
  });
}

export const publishBlogPost = (id: string, actor: StaffSession) =>
  setStatus(id, "published", actor);
export const unpublishBlogPost = (id: string, actor: StaffSession) => setStatus(id, "draft", actor);
export const archiveBlogPost = (id: string, actor: StaffSession) =>
  setStatus(id, "archived", actor);

/** Nur Entwürfe, die nie veröffentlicht waren, lassen sich löschen; sonst archivieren. */
export async function deleteBlogPost(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editContent");
  const postId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db.from("blog_posts").select("*").eq("id", postId).maybeSingle();
  if (!before) return;
  if (before.status !== "draft" || before.published_at)
    throw new Error("Veröffentlichte Beiträge bitte archivieren statt löschen");
  const { error } = await db.from("blog_posts").delete().eq("id", postId);
  if (error) throw dbError("Beitrag löschen", error);
  await writeAudit(actor, {
    action: "blog.delete",
    entityType: "blog_post",
    entityId: postId,
    before: { handle: before.handle },
  });
}
