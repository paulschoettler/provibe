import type { Metadata } from "next";
import Link from "next/link";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  createMenuAction,
  deleteMenuItemAction,
  moveMenuItemAction,
  saveMenuItemAction,
} from "@/lib/admin/content/layout-actions";
import {
  listMenus,
  WITHDRAWAL_URL,
  type MenuItemView,
  type MenuView,
} from "@/lib/admin/content/navigation";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { Hint, ReadOnlyNotice } from "@/components/admin/content/parts";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Drawer } from "@/components/admin/ui/Drawer";
import { Checkbox, Field, Select } from "@/components/admin/ui/fields";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

export const metadata: Metadata = { title: "Navigation" };

const PATH = "/admin/inhalte/navigation";

/** Menüs, die die Storefront heute liest (src/lib/catalog/navigation.ts, home.ts). */
const USED_MENUS: Record<string, string> = {
  main: "Hauptmenü im Header",
  "footer-quick": "Footer-Spalte mit Rechtstexten",
};

function find(items: MenuItemView[], id: string): MenuItemView | null {
  for (const i of items) {
    if (i.id === id) return i;
    const c = find(i.children, id);
    if (c) return c;
  }
  return null;
}

/**
 * /admin/inhalte/navigation: Hauptmenü und Footer-Spalten (menus, menu_items) mit Reihenfolge,
 * internen und externen Links. "Vertrag widerrufen" bleibt fest im Footer (Widerrufsbutton).
 */
export default async function NavigationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  const canEdit = PERMISSIONS.editContent(session);
  const sp = await searchParams;
  const order = (h: string) => (h === "main" ? 0 : h === "footer-quick" ? 1 : 2);
  const menus = (await listMenus()).sort((a, b) => order(a.handle) - order(b.handle));
  const eintrag = firstParam(sp.eintrag);
  const menuParam = firstParam(sp.menu);
  const menuForItem = menus.find((m) =>
    eintrag && eintrag !== "neu" ? find(m.items, eintrag) : m.id === menuParam,
  );
  const item =
    eintrag && eintrag !== "neu" && menuForItem ? find(menuForItem.items, eintrag) : null;
  const drawerOpen = Boolean(menuForItem && (eintrag === "neu" || item));
  const closeHref = withParams(PATH, sp, { eintrag: null, menu: null });
  const locked = item?.url === WITHDRAWAL_URL;

  const row = (
    menu: MenuView,
    it: MenuItemView,
    index: number,
    siblings: number,
    depth: number,
  ) => (
    <li key={it.id} className="border-admin-rahmen border-t first:border-t-0">
      <div className="flex items-center gap-2 px-3 py-2" style={{ paddingLeft: 12 + depth * 24 }}>
        {canEdit ? (
          <span className="flex shrink-0 flex-col">
            <InlineAction
              action={moveMenuItemAction}
              fields={{ id: it.id, dir: "up" }}
              label="↑"
              srLabel={`${it.label} nach oben`}
              variant="text"
              disabled={index === 0}
            />
            <InlineAction
              action={moveMenuItemAction}
              fields={{ id: it.id, dir: "down" }}
              label="↓"
              srLabel={`${it.label} nach unten`}
              variant="text"
              disabled={index === siblings - 1}
            />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
            {it.label || "(ohne Beschriftung)"}
            {it.isExternal ? (
              <Badge tone="gray" noDot>
                extern
              </Badge>
            ) : null}
            {it.url === WITHDRAWAL_URL ? (
              <Badge tone="accent" noDot>
                Pflicht
              </Badge>
            ) : null}
          </span>
          <span className="text-admin-text-2 flex items-center gap-1 truncate text-[12px]">
            {it.url}
            {it.opensNewTab ? <Icon name="extern" size={12} label="neuer Tab" /> : null}
          </span>
        </span>
        <Link
          href={withParams(PATH, {}, { eintrag: it.id })}
          className={`${cardActionClass} inline-flex min-h-11 items-center px-1`}
          aria-label={`${it.label} bearbeiten`}
        >
          {canEdit ? "Bearbeiten" : "Ansehen"}
        </Link>
      </div>
      {it.children.length ? (
        <ul>{it.children.map((c, i) => row(menu, c, i, it.children.length, depth + 1))}</ul>
      ) : null}
    </li>
  );

  return (
    <>
      <PageHeader
        title="Navigation"
        description="Hauptmenü und Footer-Spalten. Links intern (/pages/…) oder extern (https://…)."
        actions={
          canEdit ? (
            <Dialog
              title="Menü anlegen"
              description="Zum Beispiel eine weitere Footer-Spalte. Die Storefront zeigt neue Menüs erst, wenn ihr Layout sie einbindet."
              size="sm"
              trigger={{ label: "Menü anlegen", icon: "plus" }}
            >
              <ActionForm action={createMenuAction} closeDialogOnSuccess>
                <DialogBody>
                  <Field name="name" label="Name" placeholder="Footer Service" required />
                  <Field
                    name="handle"
                    label="Kennung"
                    placeholder="footer-service"
                    hint="Kleinbuchstaben, Ziffern und Bindestriche, Footer-Spalten mit footer- beginnen."
                    required
                  />
                </DialogBody>
                <DialogFooter>
                  <DialogClose />
                  <SubmitButton>Anlegen</SubmitButton>
                </DialogFooter>
              </ActionForm>
            </Dialog>
          ) : null
        }
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {menus.map((menu) => (
          <Card
            key={menu.id}
            title={menu.name}
            description={
              USED_MENUS[menu.handle] ??
              `Kennung ${menu.handle}, in der Storefront noch nicht eingebunden`
            }
            flush
            action={
              canEdit ? (
                <ButtonLink
                  href={withParams(PATH, {}, { eintrag: "neu", menu: menu.id })}
                  size="sm"
                  icon="plus"
                >
                  Menüpunkt
                </ButtonLink>
              ) : null
            }
          >
            {menu.items.length ? (
              <ul>{menu.items.map((it, i) => row(menu, it, i, menu.items.length, 0))}</ul>
            ) : (
              <p className="text-admin-text-2 px-4 pb-4 text-[14px]">Noch keine Menüpunkte.</p>
            )}
          </Card>
        ))}
      </div>
      <Hint className="mt-4" tone="info">
        „Vertrag widerrufen“ führt dauerhaft auf {WITHDRAWAL_URL} (elektronische Widerrufsfunktion)
        und lässt sich weder löschen noch umleiten. Änderungen am Menü erneuern das Layout aller
        Seiten sofort.
      </Hint>

      <Drawer
        open={drawerOpen}
        closeHref={closeHref}
        title={item ? "Menüpunkt bearbeiten" : "Neuer Menüpunkt"}
        description={menuForItem?.name}
        width="md"
      >
        {drawerOpen && menuForItem ? (
          <div className="flex flex-col gap-6 p-5">
            <ActionForm action={saveMenuItemAction} resetOnSuccess={false}>
              {item ? <input type="hidden" name="id" value={item.id} /> : null}
              <input type="hidden" name="menuId" value={menuForItem.id} />
              <fieldset disabled={!canEdit} className="flex flex-col gap-4">
                <Field
                  name="label"
                  label="Beschriftung"
                  defaultValue={item?.label ?? ""}
                  maxLength={60}
                  required
                />
                {locked ? <input type="hidden" name="url" value={WITHDRAWAL_URL} /> : null}
                <Field
                  name={locked ? "url_anzeige" : "url"}
                  label="Link"
                  defaultValue={item?.url ?? ""}
                  placeholder="/pages/uber-uns oder https://…"
                  disabled={locked}
                  required
                  hint={
                    locked
                      ? "Fest: Widerrufsbutton muss dauerhaft erreichbar bleiben."
                      : "Intern mit /, extern mit https://, E-Mail mit mailto:."
                  }
                />
                <Select
                  name="parentId"
                  label="Ebene"
                  defaultValue={item?.parentId ?? ""}
                  placeholder="Oberste Ebene"
                  options={menuForItem.items
                    .filter((i) => i.id !== item?.id)
                    .map((i) => ({ value: i.id, label: `Unter „${i.label}“` }))}
                  hint="Unterpunkte zeigt die Storefront heute noch nicht an."
                />
                <Checkbox
                  name="opensNewTab"
                  label="In neuem Tab öffnen"
                  description="Nur für externe Links sinnvoll."
                  defaultChecked={item?.opensNewTab ?? false}
                />
                {canEdit ? (
                  <div className="flex justify-end gap-2">
                    <ButtonLink href={closeHref} variant="secondary">
                      Abbrechen
                    </ButtonLink>
                    <SubmitButton>Speichern</SubmitButton>
                  </div>
                ) : null}
              </fieldset>
            </ActionForm>
            {canEdit && item && !locked ? (
              <div className="border-admin-rahmen border-t pt-4">
                <InlineAction
                  action={deleteMenuItemAction}
                  fields={{ id: item.id }}
                  label="Menüpunkt löschen"
                  variant="text"
                  confirm={{
                    title: `„${item.label}“ löschen?`,
                    description: "Der Link verschwindet sofort aus der Navigation.",
                    confirmLabel: "Löschen",
                    danger: true,
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
