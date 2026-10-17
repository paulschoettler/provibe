import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { linkSchema, revalidateLayout } from "./common";

/**
 * Announcement-Bar (announcement_messages) sowie Navigation und Footer (menus, menu_items).
 * Alles steckt im Layout, deshalb revalidatePath("/", "layout") nach jeder Änderung.
 */

const uuid = z.string().uuid("Ungültige ID");
/** Elektronische Widerrufsfunktion, muss dauerhaft erreichbar bleiben (Briefing 5) */
export const WITHDRAWAL_URL = "/pages/widerruf-formular";

/* Announcement-Bar ------------------------------------------------------------------------- */

const announcementSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, "Bitte gib einen Text ein.")
      .max(160, "Höchstens 160 Zeichen."),
    linkUrl: linkSchema.optional().nullable().or(z.literal("")),
    isActive: z.boolean().default(true),
    startsAt: z.string().datetime({ offset: true }).optional().nullable(),
    endsAt: z.string().datetime({ offset: true }).optional().nullable(),
    locale: z.enum(["de"]).default("de"),
  })
  .refine((v) => !v.startsAt || !v.endsAt || Date.parse(v.endsAt) > Date.parse(v.startsAt), {
    message: "Das Ende muss nach dem Start liegen.",
    path: ["endsAt"],
  });

export type AnnouncementInput = z.input<typeof announcementSchema>;

export interface AnnouncementView {
  id: string;
  message: string;
  linkUrl: string | null;
  isActive: boolean;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  /** aktiv und im Zeitfenster */
  isLive: boolean;
}

export async function listAnnouncements(locale = "de"): Promise<AnnouncementView[]> {
  const { data, error } = await crmDb()
    .from("announcement_messages")
    .select("*")
    .eq("locale", locale)
    .order("position");
  if (error) throw dbError("Announcement-Bar laden", error);
  const now = Date.now();
  return (data ?? []).map((a) => ({
    id: a.id,
    message: a.message,
    linkUrl: a.link_url,
    isActive: a.is_active,
    position: a.position,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    isLive:
      a.is_active &&
      (!a.starts_at || Date.parse(a.starts_at) <= now) &&
      (!a.ends_at || Date.parse(a.ends_at) > now),
  }));
}

function announcementRow(d: z.infer<typeof announcementSchema>) {
  return {
    message: d.message,
    link_url: d.linkUrl || null,
    is_active: d.isActive,
    starts_at: d.startsAt ?? null,
    ends_at: d.endsAt ?? null,
    locale: d.locale,
  };
}

export async function createAnnouncement(
  input: AnnouncementInput,
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "editContent");
  const d = parseInput(announcementSchema, input);
  const db = crmDb();
  const { data: last } = await db
    .from("announcement_messages")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("announcement_messages")
    .insert({ ...announcementRow(d), position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error) throw dbError("Meldung anlegen", error);
  revalidateLayout();
  await writeAudit(actor, {
    action: "announcement.create",
    entityType: "announcement",
    entityId: data.id,
    after: announcementRow(d),
  });
  return { id: data.id };
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editContent");
  const aId = parseInput(uuid, id);
  const d = parseInput(announcementSchema, input);
  const db = crmDb();
  const { data: before } = await db
    .from("announcement_messages")
    .select("*")
    .eq("id", aId)
    .maybeSingle();
  if (!before) throw new Error("Meldung nicht gefunden");
  const { error } = await db.from("announcement_messages").update(announcementRow(d)).eq("id", aId);
  if (error) throw dbError("Meldung speichern", error);
  revalidateLayout();
  await writeAudit(actor, {
    action: "announcement.update",
    entityType: "announcement",
    entityId: aId,
    before,
    after: announcementRow(d),
  });
}

export async function deleteAnnouncement(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editContent");
  const aId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db
    .from("announcement_messages")
    .select("*")
    .eq("id", aId)
    .maybeSingle();
  if (!before) return;
  const { error } = await db.from("announcement_messages").delete().eq("id", aId);
  if (error) throw dbError("Meldung löschen", error);
  revalidateLayout();
  await writeAudit(actor, {
    action: "announcement.delete",
    entityType: "announcement",
    entityId: aId,
    before,
  });
}

export async function reorderAnnouncements(ids: string[], actor: StaffSession): Promise<void> {
  assertPermission(actor, "editContent");
  const list = parseInput(z.array(uuid).min(1).max(50), ids);
  const db = crmDb();
  for (const [position, id] of list.entries()) {
    const { error } = await db.from("announcement_messages").update({ position }).eq("id", id);
    if (error) throw dbError("Reihenfolge speichern", error);
  }
  revalidateLayout();
  await writeAudit(actor, {
    action: "announcement.reorder",
    entityType: "announcement",
    after: list,
  });
}

/* Navigation und Footer ---------------------------------------------------------------------- */

export interface MenuItemView {
  id: string;
  parentId: string | null;
  position: number;
  label: string;
  labels: Record<string, string>;
  url: string;
  isExternal: boolean;
  opensNewTab: boolean;
  children: MenuItemView[];
}

export interface MenuView {
  id: string;
  handle: string;
  name: string;
  items: MenuItemView[];
}

function labelsOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === "string",
    ),
  );
}

export async function listMenus(locale = "de"): Promise<MenuView[]> {
  const db = crmDb();
  const [{ data: menus, error }, { data: items, error: iErr }] = await Promise.all([
    db.from("menus").select("*").order("handle"),
    db.from("menu_items").select("*").order("position"),
  ]);
  if (error || iErr) throw dbError("Menüs laden", error ?? iErr);
  return (menus ?? []).map((m) => {
    const own = (items ?? []).filter((i) => i.menu_id === m.id);
    const toView = (i: (typeof own)[number]): MenuItemView => {
      const labels = labelsOf(i.label);
      return {
        id: i.id,
        parentId: i.parent_id,
        position: i.position,
        label: labels[locale] ?? Object.values(labels)[0] ?? "",
        labels,
        url: i.url,
        isExternal: i.is_external,
        opensNewTab: i.opens_new_tab,
        children: own.filter((c) => c.parent_id === i.id).map(toView),
      };
    };
    return {
      id: m.id,
      handle: m.handle,
      name: m.name,
      items: own.filter((i) => !i.parent_id).map(toView),
    };
  });
}

const menuItemSchema = z.object({
  menuId: uuid,
  parentId: uuid.optional().nullable(),
  label: z.string().trim().min(1, "Bitte gib eine Beschriftung ein.").max(60),
  locale: z.enum(["de"]).default("de"),
  url: linkSchema,
  opensNewTab: z.boolean().default(false),
});

export type MenuItemInput = z.input<typeof menuItemSchema>;

export async function createMenuItem(
  input: MenuItemInput,
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "editContent");
  const d = parseInput(menuItemSchema, input);
  const db = crmDb();
  const { data: last } = await db
    .from("menu_items")
    .select("position")
    .eq("menu_id", d.menuId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("menu_items")
    .insert({
      menu_id: d.menuId,
      parent_id: d.parentId ?? null,
      position: (last?.position ?? -1) + 1,
      label: asJson({ [d.locale]: d.label }),
      url: d.url,
      is_external: /^https?:\/\//i.test(d.url),
      opens_new_tab: d.opensNewTab,
    })
    .select("id")
    .single();
  if (error) throw dbError("Menüpunkt anlegen", error);
  revalidateLayout();
  await writeAudit(actor, {
    action: "menu_item.create",
    entityType: "menu_item",
    entityId: data.id,
    after: { label: d.label, url: d.url },
  });
  return { id: data.id };
}

export async function updateMenuItem(
  id: string,
  input: MenuItemInput,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editContent");
  const itemId = parseInput(uuid, id);
  const d = parseInput(menuItemSchema, input);
  if (d.parentId === itemId)
    throw new Error("Ein Menüpunkt kann nicht sein eigener Elternpunkt sein");
  const db = crmDb();
  const { data: before } = await db.from("menu_items").select("*").eq("id", itemId).maybeSingle();
  if (!before) throw new Error("Menüpunkt nicht gefunden");
  if (before.url === WITHDRAWAL_URL && (d.url !== WITHDRAWAL_URL || d.menuId !== before.menu_id))
    throw new Error(
      "„Vertrag widerrufen“ muss dauerhaft im Footer auf /pages/widerruf-formular zeigen (Widerrufsbutton)",
    );
  const labels = { ...labelsOf(before.label), [d.locale]: d.label };
  const { error } = await db
    .from("menu_items")
    .update({
      menu_id: d.menuId,
      parent_id: d.parentId ?? null,
      label: asJson(labels),
      url: d.url,
      is_external: /^https?:\/\//i.test(d.url),
      opens_new_tab: d.opensNewTab,
    })
    .eq("id", itemId);
  if (error) throw dbError("Menüpunkt speichern", error);
  revalidateLayout();
  await writeAudit(actor, {
    action: "menu_item.update",
    entityType: "menu_item",
    entityId: itemId,
    before: { label: before.label, url: before.url },
    after: { label: labels, url: d.url },
  });
}

export async function deleteMenuItem(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editContent");
  const itemId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db.from("menu_items").select("*").eq("id", itemId).maybeSingle();
  if (!before) return;
  if (before.url === WITHDRAWAL_URL)
    throw new Error(
      "„Vertrag widerrufen“ muss dauerhaft erreichbar bleiben (Widerrufsbutton) und lässt sich nicht löschen",
    );
  const { error } = await db.from("menu_items").delete().eq("id", itemId);
  if (error) throw dbError("Menüpunkt löschen", error);
  revalidateLayout();
  await writeAudit(actor, {
    action: "menu_item.delete",
    entityType: "menu_item",
    entityId: itemId,
    before,
  });
}

export async function reorderMenuItems(
  input: { menuId: string; ids: string[] },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editContent");
  const d = parseInput(z.object({ menuId: uuid, ids: z.array(uuid).min(1).max(100) }), input);
  const db = crmDb();
  for (const [position, id] of d.ids.entries()) {
    const { error } = await db
      .from("menu_items")
      .update({ position })
      .eq("id", id)
      .eq("menu_id", d.menuId);
    if (error) throw dbError("Reihenfolge speichern", error);
  }
  revalidateLayout();
  await writeAudit(actor, {
    action: "menu_item.reorder",
    entityType: "menu",
    entityId: d.menuId,
    after: d.ids,
  });
}

export async function createMenu(
  input: { handle: string; name: string },
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "editContent");
  const d = parseInput(
    z.object({
      handle: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche."),
      name: z.string().trim().min(2, "Bitte gib einen Namen ein.").max(80),
    }),
    input,
  );
  const { data, error } = await crmDb().from("menus").insert(d).select("id").single();
  if (error) throw dbError("Menü anlegen", error);
  await writeAudit(actor, {
    action: "menu.create",
    entityType: "menu",
    entityId: data.id,
    after: d,
  });
  return { id: data.id };
}
