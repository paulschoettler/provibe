import type { Metadata } from "next";
import Link from "next/link";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  deleteRedirectAction,
  saveRedirectAction,
  toggleRedirectAction,
} from "@/lib/admin/content/layout-actions";
import { REDIRECT_STATUS_LABELS } from "@/lib/admin/content/redirect-rules";
import { getRedirect, listRedirects, type RedirectView } from "@/lib/admin/content/redirects";
import { Hint, ReadOnlyNotice } from "@/components/admin/content/parts";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { SwitchAction } from "@/components/admin/content/SwitchAction";
import { ActionForm, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { cardActionClass } from "@/components/admin/ui/Card";
import { Drawer } from "@/components/admin/ui/Drawer";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { Checkbox, Field, Select } from "@/components/admin/ui/fields";
import { formatDate, formatNumber } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { Textarea } from "@/components/admin/ui/fields";

export const metadata: Metadata = { title: "Weiterleitungen" };

const PATH = "/admin/inhalte/weiterleitungen";

/**
 * /admin/inhalte/weiterleitungen: Tabelle redirects mit Prüfung auf Schleifen und doppelte
 * Quellen. Die Storefront wertet sie im Proxy vor dem Routing aus (src/lib/redirects/proxy.ts),
 * die bekannten Shopify-Pfade stehen zusätzlich statisch in netlify.toml.
 */
export default async function RedirectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  const canEdit = PERMISSIONS.editContent(session);
  const sp = await searchParams;
  const status = firstParam(sp.status);
  const q = firstParam(sp.q);
  const page = parsePage(firstParam(sp.seite));
  const eintrag = firstParam(sp.eintrag);
  let data: Awaited<ReturnType<typeof listRedirects>> | null = null;
  try {
    data = await listRedirects({
      q,
      status: status === "aktiv" || status === "inaktiv" ? status : undefined,
      page,
    });
  } catch {
    data = null;
  }
  const editing: RedirectView | null =
    eintrag && eintrag !== "neu" ? await getRedirect(eintrag).catch(() => null) : null;
  const drawerOpen = eintrag === "neu" || Boolean(editing);
  const closeHref = withParams(PATH, sp, { eintrag: null });
  const rows = data?.rows ?? [];

  const target = (r: RedirectView) => (
    <span className="min-w-0">
      <span className="block truncate font-medium">{r.fromPath}</span>
      <span className="text-admin-text-2 block truncate text-[12px]">→ {r.toPath}</span>
    </span>
  );

  return (
    <>
      <PageHeader
        title="Weiterleitungen"
        description="Alte Pfade auf neue Ziele, damit kein Link und kein Ranking verloren geht."
        actions={
          canEdit ? (
            <ButtonLink
              href={withParams(PATH, sp, { eintrag: "neu" })}
              variant="primary"
              icon="plus"
            >
              Weiterleitung anlegen
            </ButtonLink>
          ) : null
        }
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      {!data ? (
        <FormMessage tone="error">
          Die Weiterleitungen konnten gerade nicht geladen werden.
        </FormMessage>
      ) : null}
      <Table
        caption="Weiterleitungen"
        rows={rows}
        rowKey={(r) => r.id}
        toolbar={
          <FilterBar
            action={PATH}
            search={{ value: q, placeholder: "Pfad oder Notiz", label: "Weiterleitungen suchen" }}
            hidden={{ status }}
            resetHref={PATH}
            chips={[
              {
                label: "Alle",
                href: withParams(PATH, sp, { status: null, seite: null }),
                active: !status,
                count: data?.counts.alle,
              },
              {
                label: "Aktiv",
                href: withParams(PATH, sp, { status: "aktiv", seite: null }),
                active: status === "aktiv",
                count: data?.counts.aktiv,
              },
              {
                label: "Inaktiv",
                href: withParams(PATH, sp, { status: "inaktiv", seite: null }),
                active: status === "inaktiv",
                count: data?.counts.inaktiv,
              },
            ]}
          />
        }
        columns={[
          { key: "pfad", header: "Quelle und Ziel", cell: target },
          {
            key: "code",
            header: "Art",
            width: "150px",
            cell: (r) => REDIRECT_STATUS_LABELS[r.statusCode] ?? r.statusCode,
          },
          {
            key: "treffer",
            header: "Treffer",
            width: "90px",
            align: "right",
            hideBelowLg: true,
            cell: (r) => formatNumber(r.hits),
          },
          {
            key: "aktiv",
            header: "Aktiv",
            width: "80px",
            cell: (r) =>
              canEdit ? (
                <SwitchAction
                  action={toggleRedirectAction}
                  fields={{ id: r.id }}
                  checked={r.isEnabled}
                  label={`Weiterleitung ${r.fromPath} aktiv`}
                />
              ) : r.isEnabled ? (
                <Badge tone="green">aktiv</Badge>
              ) : (
                <Badge tone="gray" hollow>
                  inaktiv
                </Badge>
              ),
          },
        ]}
        rowActions={(r) => (
          <Link
            href={withParams(PATH, sp, { eintrag: r.id })}
            className={`${cardActionClass} inline-flex min-h-11 items-center`}
            aria-label={`Weiterleitung ${r.fromPath} bearbeiten`}
          >
            {canEdit ? "Bearbeiten" : "Ansehen"}
          </Link>
        )}
        renderCard={(r) => (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CardRow
                primary={r.fromPath}
                secondary={`→ ${r.toPath}`}
                badges={
                  <>
                    <Badge tone={r.isEnabled ? "green" : "gray"} hollow={!r.isEnabled}>
                      {r.isEnabled ? "aktiv" : "inaktiv"}
                    </Badge>
                    <Badge tone="gray" noDot>
                      {r.statusCode}
                    </Badge>
                  </>
                }
              />
              <Link
                href={withParams(PATH, sp, { eintrag: r.id })}
                className={`${cardActionClass} mt-1 inline-flex min-h-11 items-center`}
              >
                {canEdit ? "Bearbeiten" : "Ansehen"}
              </Link>
            </div>
            {canEdit ? (
              <SwitchAction
                action={toggleRedirectAction}
                fields={{ id: r.id }}
                checked={r.isEnabled}
                label={`Weiterleitung ${r.fromPath} aktiv`}
              />
            ) : null}
          </div>
        )}
        empty={
          <EmptyState
            icon="extern"
            title={q || status ? "Keine Treffer" : "Noch keine Weiterleitungen"}
          >
            Die Shopify-Pfade (zum Beispiel /policies/*) leitet netlify.toml schon weiter. Hier
            legst du neue an, etwa nach dem Umbenennen einer Seite (passiert dann automatisch).
          </EmptyState>
        }
        footer={
          data && data.total > data.pageSize ? (
            <Pagination
              page={page}
              pageSize={data.pageSize}
              total={data.total}
              hrefFor={(p) => withParams(PATH, sp, { seite: p })}
            />
          ) : null
        }
      />
      <Hint tone="info" className="mt-4">
        Weiterleitungen aus dieser Tabelle prüft die Storefront vor dem Routing, also auch für Pfade
        mit eigener Seite (dann ist die Seite nicht mehr erreichbar). Neue oder geänderte Einträge
        greifen nach spätestens fünf Minuten. Treffer werden nicht gezählt (die Storefront schreibt
        im Request nicht in die Datenbank); 404-Pfade stehen in den Netlify-Logs als „404 /pfad“.
      </Hint>

      <Drawer
        open={drawerOpen}
        closeHref={closeHref}
        title={editing ? "Weiterleitung bearbeiten" : "Neue Weiterleitung"}
        width="md"
      >
        {drawerOpen ? (
          <div className="flex flex-col gap-6 p-5">
            <ActionForm action={saveRedirectAction} resetOnSuccess={false}>
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <fieldset disabled={!canEdit} className="flex flex-col gap-4">
                <Field
                  name="fromPath"
                  label="Alter Pfad (Quelle)"
                  defaultValue={editing?.fromPath ?? ""}
                  placeholder="/pages/alte-seite"
                  required
                  hint="Ohne Domain und ohne Parameter. Groß- und Kleinschreibung zählt nicht."
                />
                <Field
                  name="toPath"
                  label="Ziel"
                  defaultValue={editing?.toPath ?? ""}
                  placeholder="/collections/all oder https://…"
                  required
                />
                <Select
                  name="statusCode"
                  label="Art"
                  defaultValue={String(editing?.statusCode ?? 301)}
                  options={[301, 302, 308, 307].map((c) => ({
                    value: String(c),
                    label: REDIRECT_STATUS_LABELS[c],
                  }))}
                  hint="301 für dauerhaft umgezogene Seiten (Rankings wandern mit)."
                />
                <Textarea
                  name="note"
                  label="Notiz (optional)"
                  defaultValue={editing?.note ?? ""}
                  rows={2}
                  maxLength={300}
                />
                <Checkbox
                  name="isEnabled"
                  label="Aktiv"
                  defaultChecked={editing?.isEnabled ?? true}
                />
                {editing ? (
                  <p className="text-admin-text-2 text-[12px]">
                    Angelegt {formatDate(editing.createdAt)}, Treffer {formatNumber(editing.hits)}
                  </p>
                ) : null}
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
            {canEdit && editing ? (
              <div className="border-admin-rahmen border-t pt-4">
                <InlineAction
                  action={deleteRedirectAction}
                  fields={{ id: editing.id }}
                  label="Weiterleitung löschen"
                  variant="text"
                  confirm={{
                    title: "Weiterleitung löschen?",
                    description: `${editing.fromPath} endet danach in einer 404, falls es dort keine Seite gibt.`,
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
