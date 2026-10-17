"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import {
  createHomepageModule,
  deleteHomepageModule,
  HOMEPAGE_MODULE_KINDS,
  listHomepageModules,
  reorderHomepageModules,
  updateHomepageModule,
} from "./homepage";
import { berlinLocalToIso, flag, formValues, optText, text } from "./input";
import { formToConfig } from "./module-fields";
import {
  createAnnouncement,
  createMenu,
  createMenuItem,
  deleteAnnouncement,
  deleteMenuItem,
  listAnnouncements,
  listMenus,
  reorderAnnouncements,
  reorderMenuItems,
  updateAnnouncement,
  updateMenuItem,
  type MenuItemView,
} from "./navigation";
import { createRedirect, deleteRedirect, setRedirectEnabled, updateRedirect } from "./redirects";
import { runAdminAction } from "./run-action";

/**
 * Server Actions für Startseite (Module, Announcement-Bar), Navigation und Weiterleitungen.
 * Reihenfolge per "nach oben/unten" (funktioniert ohne JavaScript), Revalidierung der Storefront
 * in der Serverlogik (Layout, Startseite, Tag "redirects").
 */

const BASE = "/admin/inhalte";

function move<T>(list: T[], index: number, dir: "up" | "down"): T[] | null {
  const target = dir === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= list.length) return null;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const direction = (fd: FormData): "up" | "down" => (text(fd, "dir") === "up" ? "up" : "down");

/* Startseiten-Module -------------------------------------------------------------------------- */

export async function saveModuleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  const values = formValues(fd);
  return runAdminAction(
    "editContent",
    `${BASE}/startseite`,
    async (session) => {
      const current = (await listHomepageModules()).find((m) => m.id === id);
      if (!current) return actionError("Modul nicht gefunden.");
      const config = formToConfig(current.kind, values, current.config);
      await updateHomepageModule({ id, isEnabled: flag(fd, "isEnabled"), config }, session);
      revalidatePath(`${BASE}/startseite`);
      await flashToast(`${current.label} gespeichert`);
    },
    values,
  );
}

export async function toggleModuleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction("editContent", `${BASE}/startseite`, async (session) => {
    const enabled = text(fd, "enabled") === "1";
    await updateHomepageModule({ id: text(fd, "id"), isEnabled: enabled }, session);
    revalidatePath(`${BASE}/startseite`);
    await flashToast(enabled ? "Modul eingeblendet" : "Modul ausgeblendet");
  });
}

export async function moveModuleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction("editContent", `${BASE}/startseite`, async (session) => {
    const ids = (await listHomepageModules()).map((m) => m.id);
    const next = move(ids, ids.indexOf(text(fd, "id")), direction(fd));
    if (!next) return actionOk();
    await reorderHomepageModules({ ids: next }, session);
    revalidatePath(`${BASE}/startseite`);
    await flashToast("Reihenfolge gespeichert");
  });
}

export async function createModuleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const kind = text(fd, "kind");
  let createdId: string | null = null;
  const result = await runAdminAction("editContent", `${BASE}/startseite`, async (session) => {
    if (!(HOMEPAGE_MODULE_KINDS as readonly string[]).includes(kind))
      return actionError("Bitte wähle eine Modulart.", { fieldErrors: { kind: "Modulart fehlt" } });
    const created = await createHomepageModule({ kind }, session);
    createdId = created.id;
    await flashToast("Modul angelegt, noch ausgeblendet");
  });
  if (createdId) redirect(`${BASE}/startseite?modul=${createdId}` as Route);
  return result;
}

export async function deleteModuleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await runAdminAction("editContent", `${BASE}/startseite`, async (session) => {
    await deleteHomepageModule(text(fd, "id"), session);
    await flashToast("Modul gelöscht");
    done = true;
  });
  if (done) redirect(`${BASE}/startseite` as Route);
  return result;
}

/* Announcement-Bar ---------------------------------------------------------------------------- */

export async function saveAnnouncementAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const id = text(fd, "id");
  const values = formValues(fd);
  let done = false;
  const result = await runAdminAction(
    "editContent",
    `${BASE}/startseite`,
    async (session) => {
      const startsRaw = text(fd, "startsAt");
      const endsRaw = text(fd, "endsAt");
      const startsAt = startsRaw ? berlinLocalToIso(startsRaw) : null;
      const endsAt = endsRaw ? berlinLocalToIso(endsRaw) : null;
      if (startsRaw && !startsAt)
        return actionError("Ungültiger Start.", {
          fieldErrors: { startsAt: "Datum prüfen" },
          values,
        });
      if (endsRaw && !endsAt)
        return actionError("Ungültiges Ende.", { fieldErrors: { endsAt: "Datum prüfen" }, values });
      const input = {
        message: text(fd, "message"),
        linkUrl: optText(fd, "linkUrl"),
        isActive: flag(fd, "isActive"),
        startsAt,
        endsAt,
      };
      if (id) await updateAnnouncement(id, input, session);
      else await createAnnouncement(input, session);
      revalidatePath(`${BASE}/startseite`);
      await flashToast(id ? "Meldung gespeichert" : "Meldung angelegt");
      done = true;
    },
    values,
  );
  if (done) redirect(`${BASE}/startseite` as Route);
  return result;
}

export async function toggleAnnouncementAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAdminAction("editContent", `${BASE}/startseite`, async (session) => {
    const current = (await listAnnouncements()).find((a) => a.id === text(fd, "id"));
    if (!current) return actionError("Meldung nicht gefunden.");
    await updateAnnouncement(
      current.id,
      {
        message: current.message,
        linkUrl: current.linkUrl,
        isActive: text(fd, "active") === "1",
        startsAt: current.startsAt,
        endsAt: current.endsAt,
      },
      session,
    );
    revalidatePath(`${BASE}/startseite`);
    await flashToast(text(fd, "active") === "1" ? "Meldung aktiv" : "Meldung pausiert");
  });
}

export async function moveAnnouncementAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAdminAction("editContent", `${BASE}/startseite`, async (session) => {
    const ids = (await listAnnouncements()).map((a) => a.id);
    const next = move(ids, ids.indexOf(text(fd, "id")), direction(fd));
    if (!next) return actionOk();
    await reorderAnnouncements(next, session);
    revalidatePath(`${BASE}/startseite`);
    await flashToast("Reihenfolge gespeichert");
  });
}

export async function deleteAnnouncementAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  let done = false;
  const result = await runAdminAction("editContent", `${BASE}/startseite`, async (session) => {
    await deleteAnnouncement(text(fd, "id"), session);
    await flashToast("Meldung gelöscht");
    done = true;
  });
  if (done) redirect(`${BASE}/startseite` as Route);
  return result;
}

/* Navigation ---------------------------------------------------------------------------------- */

function findItem(items: MenuItemView[], id: string): MenuItemView | null {
  for (const item of items) {
    if (item.id === id) return item;
    const child = findItem(item.children, id);
    if (child) return child;
  }
  return null;
}

export async function saveMenuItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  const values = formValues(fd);
  let done = false;
  const result = await runAdminAction(
    "editContent",
    `${BASE}/navigation`,
    async (session) => {
      const input = {
        menuId: text(fd, "menuId"),
        parentId: optText(fd, "parentId"),
        label: text(fd, "label"),
        url: text(fd, "url"),
        opensNewTab: flag(fd, "opensNewTab"),
      };
      if (id) await updateMenuItem(id, input, session);
      else await createMenuItem(input, session);
      revalidatePath(`${BASE}/navigation`);
      await flashToast(id ? "Menüpunkt gespeichert" : "Menüpunkt angelegt");
      done = true;
    },
    values,
  );
  if (done) redirect(`${BASE}/navigation` as Route);
  return result;
}

export async function moveMenuItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction("editContent", `${BASE}/navigation`, async (session) => {
    const id = text(fd, "id");
    const menu = (await listMenus()).find((m) => findItem(m.items, id));
    if (!menu) return actionError("Menüpunkt nicht gefunden.");
    const item = findItem(menu.items, id)!;
    const siblings = item.parentId
      ? (findItem(menu.items, item.parentId)?.children ?? [])
      : menu.items;
    const ids = siblings.map((s) => s.id);
    const next = move(ids, ids.indexOf(id), direction(fd));
    if (!next) return actionOk();
    await reorderMenuItems({ menuId: menu.id, ids: next }, session);
    revalidatePath(`${BASE}/navigation`);
    await flashToast("Reihenfolge gespeichert");
  });
}

export async function deleteMenuItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await runAdminAction("editContent", `${BASE}/navigation`, async (session) => {
    await deleteMenuItem(text(fd, "id"), session);
    await flashToast("Menüpunkt gelöscht");
    done = true;
  });
  if (done) redirect(`${BASE}/navigation` as Route);
  return result;
}

export async function createMenuAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd);
  return runAdminAction(
    "editContent",
    `${BASE}/navigation`,
    async (session) => {
      await createMenu({ handle: text(fd, "handle"), name: text(fd, "name") }, session);
      revalidatePath(`${BASE}/navigation`);
      await flashToast("Menü angelegt");
    },
    values,
  );
}

/* Weiterleitungen ----------------------------------------------------------------------------- */

export async function saveRedirectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, "id");
  const values = formValues(fd);
  let done = false;
  const result = await runAdminAction(
    "editContent",
    `${BASE}/weiterleitungen`,
    async (session) => {
      const input = {
        fromPath: text(fd, "fromPath"),
        toPath: text(fd, "toPath"),
        statusCode: Number(text(fd, "statusCode") || 301),
        isEnabled: flag(fd, "isEnabled"),
        note: optText(fd, "note"),
      };
      const { warnings } = id
        ? await updateRedirect(id, input, session)
        : await createRedirect(input, session);
      revalidatePath(`${BASE}/weiterleitungen`);
      await flashToast(
        `${id ? "Weiterleitung gespeichert" : "Weiterleitung angelegt"}${warnings.length ? `. Hinweis: ${warnings[0]}` : ""}`,
      );
      done = true;
    },
    values,
  );
  if (done) redirect(`${BASE}/weiterleitungen` as Route);
  return result;
}

export async function toggleRedirectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction("editContent", `${BASE}/weiterleitungen`, async (session) => {
    const enabled = text(fd, "enabled") === "1";
    await setRedirectEnabled(text(fd, "id"), enabled, session);
    revalidatePath(`${BASE}/weiterleitungen`);
    await flashToast(enabled ? "Weiterleitung aktiv" : "Weiterleitung inaktiv");
  });
}

export async function deleteRedirectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await runAdminAction("editContent", `${BASE}/weiterleitungen`, async (session) => {
    await deleteRedirect(text(fd, "id"), session);
    await flashToast("Weiterleitung gelöscht");
    done = true;
  });
  if (done) redirect(`${BASE}/weiterleitungen` as Route);
  return result;
}
