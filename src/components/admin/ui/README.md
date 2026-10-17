# Admin-UI-Kit (Backoffice)

Bausteine nach Figma "Admin-Bausteine" (Datei `wttVzqEheGArNkqUliXd3x`, Seite 05 node 24:1399, Seite 06 node 26:624). Alles mit Tailwind und den Admin-Tokens aus `src/app/globals.css` (Block `/* Admin Shell */`, nur unter `[data-admin]` wirksam). Import gesammelt aus `@/components/admin/ui`, serverseitige Helfer direkt aus `./toast-server`.

## Tokens (Tailwind-Klassen)

| Zweck                             | Klasse                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Hintergrund, Karte, ruhige Fläche | `bg-admin-hintergrund`, `bg-admin-karte`, `bg-admin-flaeche`                                                                              |
| Rahmen                            | `border-admin-rahmen`, `border-admin-rahmen-stark` (Felder, Sekundär-Button)                                                              |
| Text                              | `text-admin-text`, `text-admin-text-2`                                                                                                    |
| Akzent Wildberry                  | `bg-admin-akzent`, `hover:bg-admin-akzent-hover` (Burgundy), `bg-admin-akzent-hell` (Cream); Überschriften `text-admin-ueberschrift`      |
| Seitenleiste                      | `bg-admin-seitenleiste`, `text-admin-seitenleiste-text`, `bg-admin-seitenleiste-aktiv`/`-aktiv-text`, `hover:bg-admin-seitenleiste-hover` |
| Status                            | `admin-gruen`, `admin-gelb` (Text `admin-gelb-text`), `admin-blau`, `admin-rot`, `admin-grau` (Text `admin-grau-text`), je mit `-hell`    |
| Radius                            | `rounded-admin-karte` (10), `rounded-admin-feld` (8), `rounded-admin-badge` (Pill), `rounded-admin-dialog` (12)                           |
| Schatten                          | `shadow-admin-karte`                                                                                                                      |

Höhen: Button 36 px (mobil 44), Feld 40 (mobil 44), Kopfzeile 56, Seitenleiste 240, Tabellenkopf 40, Zeile 52 (mit Bild 64). Schrift Filson Pro (`var(--pv-font-sans)`). Farben nur über die Admin-Tokens, die auf CI-Tokens (`--pv-*`) und Funktionsfarben (`--pv-ui-*`, `src/styles/ui-tokens.css`) zeigen; keine Hex-Werte, keine Transparenz-Modifier.

## Bausteine und Props

**Icon** `name: IconName` (53 Linien-Icons, Liste `ICON_NAMES`), `size = 20`, `label?` (ohne Label dekorativ).

**Button** `variant: "primary" | "secondary" | "danger" | "text"`, `size: "md" | "sm"`, `icon?`, `block?`, alle `<button>`-Props (`type` Standard `button`). **ButtonLink** gleiche Optik als `next/link`. **IconButton** `icon`, `label` (Pflicht), `look: "ghost" | "outline"`, `size: "md" | "lg"`. **SubmitButton** wie Button, `type=submit`, sperrt sich beim Senden, `pendingLabel?`. Klassen ohne Komponente: `buttonClasses(variant, size, extra)`, `iconButtonClasses(look, size, extra)`.

**Badge** `tone: "green" | "yellow" | "blue" | "red" | "gray" | "accent"`, `hollow?` (Ring statt Punkt, wartende Zustände), `noDot?`. **StatusBadge** `kind: "order" | "payment" | "fulfilment" | "record"`, `value` (Enum-Wert). Für Bestellungen in Listen besser `deriveOrderBadges()` aus `src/lib/admin/orders/status.ts` (H16) und `<Badge tone={b.tone} hollow={b.hollow}>{b.label}</Badge>`.

**Card** `title?`, `description?`, `action?` (rechts im Kopf, Link mit `cardActionClass`), `flush?` (Inhalt ohne Rand, für Tabellen), `footer?`, `id?`.

**PageHeader** `title`, `description?`, `actions?`, `breadcrumbs?: Crumb[]`, `backHref?`, `meta?` (Badges neben dem Titel). Genau eine h1 je Seite. **Breadcrumbs** `items: { label, href? }[]`.

**Stat** `label`, `value`, `delta?: { text, direction: "up" | "down" | "flat", goodWhen? }`, `deltaSuffix?`, `hint?`.

**Table** (Server Component) `rows`, `columns: Column<T>[]` (`key`, `header`, `cell(row)`, `align?`, `width?`, `sortable?`, `hideBelowLg?`), `rowKey(row)`, `caption` (Pflicht, für Screenreader), `rowHref?(row)` (ganze Zeile klickbar), `renderCard?(row)` (mobile Kartenliste, mit `CardRow`), `selection?: { formId, name = "ids", value(row), selected?, label? }`, `sort?: { key, dir }` mit `sortHref(key, dir)`, `empty?`, `rowActions?(row)`, `toolbar?`, `footer?`, `density: "default" | "media"`. Tabelle und Karten haben je eine Checkbox pro Zeile: in der Action `[...new Set(formData.getAll("ids"))]`.

**CardRow** `primary`, `aside?`, `secondary?`, `secondaryAside?`, `badges?` (Figma Kartenliste mobil).

**FilterBar** (GET-Formular, Filter in der URL) `action` (Pfad), `search?: { name = "q", value, placeholder, label }`, `chips?: TabItem[]`, `hidden?` (Parameter behalten), `resetHref?`, `children` (zum Beispiel `<Select hideLabel …>`; Auswahlfelder schicken mit JS sofort ab).

**Tabs** `items: { label, href, active?, count? }[]`, `label`, `variant: "underline" | "chip"`. Chip-Optik für Eigenes: `chipClass(active, "tab" | "select")`.

**Felder** (Client): **Field** (`name`, `label`, `hint?`, `error?`, `hideLabel?`, `prefix?`, `suffix?`, alle Input-Props), **Select** (`options`, `placeholder?` als leere Option), **Textarea**, **Checkbox** (`label`, `description?`), **CheckboxBox** (nur das Kästchen), **Switch** (`role="switch"`), **RadioCards** (`name`, `legend`, `options: { value, label, description? }[]`, `defaultValue`). Innerhalb von `ActionForm` kommen Fehler (`fieldErrors[name]`) und Werte automatisch aus dem Action-Ergebnis. React setzt Formulare nach jeder Action zurück; Field und Textarea bekommen ihren Wert über `defaultValue` aus `values[name]`. Select, Checkbox, CheckboxBox, Switch und RadioCards hängen sich je Ergebnis neu ein (key aus `useActionFormRestore().version`) und übernehmen nach einem Fehler `values[name]` (Mehrfachwerte als Liste oder kommagetrennt), ohne `values` den zuletzt abgeschickten Wert; kontrollierte Felder (`value`/`checked`) zeigen danach ihren State. Ein eigener Wrapper zum Neu-Einhängen (früher `RemountOnError`) ist nicht mehr nötig.

**ActionForm** (Client) `action: (state, formData) => Promise<ActionState>`, `closeDialogOnSuccess?`, `onSuccess?`, `resetOnSuccess = true`, `hideMessage?` (Meldung dann mit `<ActionFormMessage />` selbst platzieren), `showSuccess?`. Das `<form>` trägt `data-action-form` und feuert nach jedem Ergebnis das DOM-Ereignis `ACTION_RESULT_EVENT` (`"admin:action-result"`, `detail.status`: `"ok"` oder `"error"`), zum Beispiel für Bausteine außerhalb des Formulars. Für eigene Auswahlfelder: `useActionFormState()` (Ergebnis) und `useActionFormRestore()` (`version`, `submitted`). **FormMessage** `tone: "error" | "success" | "info" | "warning"`. Rückgabewerte aus `action-state.ts`: `actionOk(msg?, data?)`, `actionError(msg, { fieldErrors, values })`, `fieldErrors(zodError)`, `formDataToObject(formData)`.

**Dialog** (Client, natives `<dialog>`, Fokusfalle, Esc, Fokus zurück) `title`, `description?`, `trigger?: { label, variant?, icon?, block? }`, `defaultOpen?`, gesteuert `open` + `onOpenChange`, `size: "sm" | "md" | "lg"`. Innen `DialogBody`, `DialogFooter`, `DialogClose`. Erstes Eingabefeld bekommt den Fokus (oder `data-autofocus`).

**Drawer** (Seitenpanel) über die URL: `open`, `closeHref` (empfohlen für Details, ohne JS nutzbar) oder mit `trigger`. Weiter `title`, `description?`, `side: "right" | "left"`, `width: "sm" | "md" | "lg"`, `footer?`.

**Toast** Rückmeldung ohne Client-State-Bibliothek: in der Server Action `await flashToast("Gespeichert")` bzw. `flashToast("…", "error")` (Cookie, `./toast-server`); die Shell zeigt ihn (`ToastRegion`). Nach `redirect()` alternativ `?toast=gespeichert` und `<Toast toast={TOAST_MESSAGES[sp.toast] ?? null} />` auf der Seite.

**Timeline** `items: { id, title, description?, at, icon?, tone?: "default" | "accent" | "green" | "red", actor? }[]` (neueste zuerst).

**SaveBar** (Client, sticky unten) `formId`, `saveLabel?`, `discardLabel?`, `message?`, `alwaysVisible?`. Erscheint bei Änderungen im Formular, ohne JS immer. Bei einem `ActionForm` bleibt sie nach dem Absenden sichtbar, bis die Action Erfolg meldet (`ACTION_RESULT_EVENT` mit `"ok"`); nach einem Fehler bleibt sie stehen, "Verwerfen" blendet sie aus. Bei anderen Formularen verschwindet sie beim Absenden. Ausgleich per künstlichem `input`-Ereignis nach Fehlern ist nicht mehr nötig.

**EmptyState** `icon?`, `title`, `children?`, `action?`, `compact?`. **Pagination** `page`, `pageSize`, `total`, `hrefFor(page)`; `parsePage(sp.seite)`.

**Format und Links**: `formatDate`, `formatDateTime`, `formatShortDate` (Europe/Berlin), `formatMoney(cents)`, `formatNumber`, `formatPercent`; `withParams(path, searchParams, overrides)` (null entfernt einen Parameter), `firstParam`.

Seitenrahmen: `NoAccess` (Rolle darf die Seite nicht sehen) und `ComingSoon` aus `@/components/admin/NoAccess`.

## Neue Modulseite (Welle 2)

Seiten liegen unter `src/app/admin/(shell)/<modul>/`, die Shell (Seitenleiste, Kopfzeile, Toast) kommt aus dem Layout. Jede Seite und jede Action prüft selbst `requireStaff()` und das Modulrecht aus `PERMISSIONS`. Serverlogik unter `src/lib/admin/<modul>/`, Schreibzugriffe mit `writeAudit`.

```tsx
// src/app/admin/(shell)/leads/page.tsx
import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listLeads } from "@/lib/admin/leads/queries";
import { setLeadStatusAction } from "@/lib/admin/leads/actions";
import { NoAccess } from "@/components/admin/NoAccess";
import {
  ActionForm,
  Badge,
  CardRow,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SubmitButton,
  Table,
  firstParam,
  formatDate,
  parsePage,
  withParams,
  type SearchParamsInput,
} from "@/components/admin/ui";

export const metadata: Metadata = { title: "Leads" };
const PATH = "/admin/leads";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  const sp = await searchParams;
  const status = firstParam(sp.status);
  const page = parsePage(sp.seite);
  const { rows, total } = await listLeads({ status, q: firstParam(sp.q), page });

  return (
    <>
      <PageHeader title="Leads" description="Partner- und B2B-Anfragen" />
      <Table
        caption="Leads"
        rows={rows}
        rowKey={(l) => l.id}
        rowHref={(l) => `${PATH}/${l.id}`}
        selection={{ formId: "leads-sammel", value: (l) => l.id }}
        toolbar={
          <>
            <FilterBar
              action={PATH}
              search={{ value: firstParam(sp.q), placeholder: "Firma oder E-Mail" }}
              chips={[
                { label: "Alle", href: PATH, active: !status },
                {
                  label: "Neu",
                  href: withParams(PATH, sp, { status: "new", seite: null }),
                  active: status === "new",
                },
              ]}
            />
            <ActionForm
              id="leads-sammel"
              action={setLeadStatusAction}
              className="flex gap-2 px-3 pb-3"
            >
              <input type="hidden" name="status" value="contacted" />
              <SubmitButton variant="secondary" size="sm">
                Als kontaktiert markieren
              </SubmitButton>
            </ActionForm>
          </>
        }
        columns={[
          { key: "firma", header: "Firma", cell: (l) => l.company },
          { key: "datum", header: "Eingang", width: "120px", cell: (l) => formatDate(l.createdAt) },
          {
            key: "status",
            header: "Status",
            width: "140px",
            cell: (l) => <Badge tone="blue">{l.statusLabel}</Badge>,
          },
        ]}
        renderCard={(l) => (
          <CardRow
            primary={l.company}
            secondary={l.email}
            secondaryAside={formatDate(l.createdAt)}
          />
        )}
        empty={<EmptyState icon="leads" title="Keine Leads" />}
        footer={
          <Pagination
            page={page}
            pageSize={50}
            total={total}
            hrefFor={(p) => withParams(PATH, sp, { seite: p })}
          />
        }
      />
    </>
  );
}
```

```ts
// src/lib/admin/leads/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Bitte wähle mindestens einen Lead."),
  status: z.enum(["new", "contacted", "qualified", "won", "lost"]),
});

export async function setLeadStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaff("support", { next: "/admin/leads" });
  if (!PERMISSIONS.viewCustomers(session)) return actionError("Dafür fehlt dir die Berechtigung.");
  const parsed = schema.safeParse({
    ids: [...new Set(formData.getAll("ids").map(String))],
    status: formData.get("status"),
  });
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  const { error } = await supabaseAdmin()
    .from("leads")
    .update({ status: parsed.data.status })
    .in("id", parsed.data.ids);
  if (error) return actionError("Speichern fehlgeschlagen.");
  await writeAudit(session, {
    action: "lead.status",
    entityType: "lead",
    entityId: parsed.data.ids.join(","),
    after: { status: parsed.data.status },
  });
  await flashToast(`${parsed.data.ids.length} Leads aktualisiert`);
  revalidatePath("/admin/leads");
  return actionOk();
}
```

Hinweise: Detailseiten nutzen `PageHeader backHref`, Karten (`Card`) im Raster `grid gap-4 lg:grid-cols-3` und für Formulare `ActionForm id="…"` plus `SaveBar formId="…"`. Bestätigungen (Stornieren, Löschen) als `Dialog` mit `SubmitButton variant="danger"`.
