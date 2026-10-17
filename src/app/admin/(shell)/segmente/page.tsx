import type { Metadata } from "next";
import Link from "next/link";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  FIELD_KEYS,
  opsFor,
  parseEditorParams,
  rowsToRules,
  rulesToRows,
  valueKind,
  type EditorRow,
  type EditorState,
} from "@/lib/admin/segments/editor-state";
import {
  NEWSLETTER_SEGMENT_STATUSES,
  NEWSLETTER_STATUS_LABELS,
  SEGMENT_FIELDS,
} from "@/lib/admin/segments/rules";
import {
  evaluateSegment,
  getSegment,
  listSegments,
  previewSegmentMembers,
  segmentCampaignUsage,
  segmentProductOptions,
  type SegmentMember,
  type SegmentSummary,
} from "@/lib/admin/segments/segments";
import { deleteSegmentAction, saveSegmentFormAction } from "@/lib/admin/segments/ui-actions";
import { NoAccess } from "@/components/admin/NoAccess";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { AutoSubmit } from "@/components/admin/ui/AutoSubmit";
import { Button, ButtonLink, buttonClasses } from "@/components/admin/ui/Button";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Field, Select, type SelectOption } from "@/components/admin/ui/fields";
import { formatDate, formatDateTime, formatNumber } from "@/components/admin/ui/format";
import { firstParam, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { Notice } from "@/components/admin/crm/parts";

export const metadata: Metadata = { title: "Segmente" };

const PATH = "/admin/segmente";
const UUID = /^[0-9a-f-]{36}$/i;
const EDITOR_KEYS = /^(name|beschreibung|match|add|del|[fov]\d{1,2})$/;

/**
 * /admin/segmente (Figma 28:1711, mobil 27:5237): Editor mit Regelzeilen aus der Whitelist in
 * rules.ts, Trefferzahl und Vorschau (erste 20) live beim Aufruf, gespeicherte Segmente rechts.
 * Der Editor ist ein GET-Formular (Zustand in der URL), Speichern eine Server Action.
 */
export default async function SegmentePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  const sp = await searchParams;
  const editRaw = firstParam(sp.bearbeiten);
  const editId = editRaw && UUID.test(editRaw) ? editRaw : undefined;
  const hasEditorParams = Object.keys(sp).some((k) => EDITOR_KEYS.test(k));

  let failed = false;
  let segments: SegmentSummary[] = [];
  let usage = new Map<string, { count: number; names: string[] }>();
  let products: SelectOption[] = [];
  let editing: SegmentSummary | null = null;
  try {
    [segments, usage, products, editing] = await Promise.all([
      listSegments({ refreshCounts: true }),
      segmentCampaignUsage(),
      segmentProductOptions(),
      editId ? getSegment(editId) : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error("[admin] Segmente", error);
    failed = true;
  }

  let state: EditorState;
  if (hasEditorParams || !editing) {
    state = parseEditorParams(sp);
  } else {
    state = {
      name: editing.name,
      description: editing.description ?? "",
      match: editing.rules?.match ?? "all",
      rows: editing.rules ? rulesToRows(editing.rules) : [],
    };
  }
  const { rules, errors } = rowsToRules(state);
  let count: number | null = null;
  let summary = "";
  let preview: SegmentMember[] = [];
  if (rules && !failed) {
    try {
      const [evaluated, members] = await Promise.all([
        evaluateSegment(rules),
        previewSegmentMembers(rules, 20),
      ]);
      count = evaluated.count;
      summary = evaluated.summary;
      preview = members;
    } catch (error) {
      console.error("[admin] Segment auswerten", error);
    }
  }
  const nameError = firstParam(sp.fehler) === "name" ? "Bitte gib einen Namen ein." : undefined;
  const countedAt = segments.find((s) => s.lastCountedAt)?.lastCountedAt;

  return (
    <>
      <PageHeader
        title="Segmente"
        description="Gespeicherte Filter, nutzbar als Kundenliste und als Newsletter-Zielgruppe"
        actions={
          <>
            {editId || hasEditorParams ? <ButtonLink href={PATH}>Abbrechen</ButtonLink> : null}
            <ButtonLink href={`${PATH}?bearbeiten=neu`} variant="primary" icon="plus">
              Neues Segment
            </ButtonLink>
          </>
        }
      />
      {failed ? (
        <FormMessage tone="error">Die Segmente konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title={editing ? `Segment bearbeiten: ${editing.name}` : "Neues Segment"}>
            <form
              action={PATH}
              method="get"
              className="flex flex-col gap-4"
              aria-label="Segment-Editor"
            >
              <AutoSubmit />
              <input type="hidden" name="bearbeiten" value={editId ?? "neu"} />
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <Field
                  name="name"
                  label="Name"
                  defaultValue={state.name}
                  placeholder="zum Beispiel Stammkunden ohne Kauf seit 60 Tagen"
                  maxLength={120}
                  error={nameError}
                  required
                />
                <Select
                  name="match"
                  label="Kunden erfüllen"
                  defaultValue={state.match}
                  options={[
                    { value: "all", label: "alle Bedingungen" },
                    { value: "any", label: "eine der Bedingungen" },
                  ]}
                />
              </div>
              <Field
                name="beschreibung"
                label="Beschreibung (optional)"
                defaultValue={state.description}
                maxLength={500}
              />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[13px] font-medium">Bedingungen</legend>
                {state.rows.length === 0 ? (
                  <p className="text-admin-text-2 text-[13px]">
                    Ohne Bedingung gehören alle Kunden zum Segment.
                  </p>
                ) : null}
                {state.rows.map((row, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    {i > 0 ? (
                      <p className="text-admin-text-2 text-[12px] font-semibold tracking-wide uppercase">
                        {state.match === "any" ? "oder" : "und"}
                      </p>
                    ) : null}
                    <RuleRow row={row} index={i} products={products} error={errors[i]} />
                  </div>
                ))}
                <div>
                  <button
                    type="submit"
                    name="add"
                    value="1"
                    className={buttonClasses("text", "md")}
                    disabled={state.rows.length >= 20}
                  >
                    <Icon name="plus" size={16} />
                    Bedingung hinzufügen
                  </button>
                </div>
              </fieldset>

              <div
                className="rounded-admin-karte bg-admin-akzent-hell flex flex-wrap items-center gap-3 px-4 py-3"
                role="status"
              >
                <span className="text-admin-akzent">
                  <Icon name="kunden" size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[18px] font-semibold">
                    {count === null
                      ? rules
                        ? "Treffer nicht verfügbar"
                        : "Bedingungen unvollständig"
                      : `${formatNumber(count)} ${count === 1 ? "Kunde passt" : "Kunden passen"}`}
                  </p>
                  <p className="text-admin-text-2 text-[13px]">
                    {rules
                      ? `${summary || "Alle Kunden"}. Berechnet beim Aufruf, gelöschte Kunden zählen nicht.`
                      : "Bitte prüf die markierten Bedingungen."}
                  </p>
                </div>
                {editId && !hasEditorParams ? (
                  <Link
                    href={`/admin/kunden?segment=${editId}`}
                    className={`${cardActionClass} inline-flex items-center gap-1`}
                  >
                    <Icon name="chevron-rechts" size={16} />
                    In Kundenliste öffnen
                  </Link>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit">Treffer aktualisieren</Button>
                <SubmitButton formAction={saveSegmentFormAction} pendingLabel="Wird gespeichert …">
                  {editing ? "Änderungen speichern" : "Als Segment speichern"}
                </SubmitButton>
              </div>
            </form>
          </Card>

          <Table
            caption="Vorschau der Treffer"
            rows={preview}
            rowKey={(m) => m.id}
            rowHref={(m) => `/admin/kunden/${m.id}`}
            toolbar={
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-[16px] font-semibold">Vorschau</h2>
                <span className="text-admin-text-2 text-[13px]">
                  {count ? `erste ${Math.min(20, preview.length)} von ${formatNumber(count)}` : ""}
                </span>
              </div>
            }
            empty={
              <p className="text-admin-text-2 px-4 py-6 text-center text-[14px]">
                {rules
                  ? "Keine Kunden erfüllen diese Bedingungen."
                  : "Vorschau nach gültigen Bedingungen."}
              </p>
            }
            columns={[
              {
                key: "name",
                header: "Name",
                cell: (m) => [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email,
              },
              {
                key: "email",
                header: "E-Mail",
                cell: (m) => <span className="text-admin-text-2 break-all">{m.email}</span>,
              },
              {
                key: "bestellungen",
                header: "Bestellungen",
                align: "right",
                width: "120px",
                cell: (m) => m.ordersCount,
              },
              {
                key: "letzte",
                header: "Letzte Bestellung",
                width: "150px",
                cell: (m) => formatDate(m.lastOrderAt),
              },
            ]}
            renderCard={(m) => (
              <CardRow
                primary={[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email}
                secondary={m.email}
                secondaryAside={`${m.ordersCount} Best. · ${formatDate(m.lastOrderAt)}`}
              />
            )}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Gespeicherte Segmente"
            description={
              countedAt ? `Kundenzahlen neu berechnet ${formatDateTime(countedAt)}` : undefined
            }
          >
            {segments.length === 0 ? (
              <p className="text-admin-text-2 text-[13px]">Noch keine Segmente gespeichert.</p>
            ) : (
              <ul className="divide-admin-rahmen flex flex-col divide-y">
                {segments.map((s) => {
                  const used = usage.get(s.id);
                  return (
                    <li key={s.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`${PATH}?bearbeiten=${s.id}`}
                          className="text-[15px] font-semibold hover:underline"
                          aria-current={s.id === editId ? "true" : undefined}
                        >
                          {s.name}
                        </Link>
                        <span className="text-admin-text-2 shrink-0 text-[13px] tabular-nums">
                          {s.lastCount === null ? "–" : `${formatNumber(s.lastCount)} Kunden`}
                        </span>
                      </div>
                      <p className="text-admin-text-2 text-[13px]">
                        {s.summary} · geändert {formatDate(s.updatedAt)}
                      </p>
                      {used ? (
                        <p className="text-admin-text-2 text-[12px]">
                          Genutzt von {used.count} {used.count === 1 ? "Kampagne" : "Kampagnen"}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          href={`/admin/kunden?segment=${s.id}`}
                          className={`${cardActionClass} inline-flex items-center gap-1`}
                        >
                          Kundenliste
                        </Link>
                        <Link
                          href={`/admin/newsletter/kampagnen/neu?segment=${s.id}`}
                          className={`${cardActionClass} inline-flex items-center gap-1`}
                        >
                          <Icon name="newsletter" size={16} />
                          Als Newsletter-Zielgruppe
                        </Link>
                        <Link
                          href={`${PATH}?bearbeiten=${s.id}`}
                          className={`${cardActionClass} inline-flex items-center gap-1`}
                        >
                          Bearbeiten
                        </Link>
                        {used ? null : <DeleteSegment id={s.id} name={s.name} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Notice>
            Als Zielgruppe zählen nur Kontakte mit bestätigtem Opt-in. Abgemeldete und gebouncte
            Kontakte werden automatisch ausgeschlossen. Segmente, die eine Kampagne nutzt, lassen
            sich nicht löschen.
          </Notice>
        </div>
      </div>
    </>
  );
}

function RuleRow({
  row,
  index: i,
  products,
  error,
}: {
  row: EditorRow;
  index: number;
  products: SelectOption[];
  error?: string;
}) {
  const kind = valueKind(row.field, row.op);
  const valueProps = {
    name: `v${i}`,
    label: `Wert ${i + 1}`,
    hideLabel: true,
    defaultValue: row.value,
    error,
  };
  let value;
  switch (kind) {
    case "none":
      value = (
        <Field
          {...valueProps}
          defaultValue=""
          disabled
          placeholder="kein Wert nötig"
          error={undefined}
        />
      );
      break;
    case "number":
      value = <Field {...valueProps} type="number" min={0} inputMode="numeric" />;
      break;
    case "days":
      value = <Field {...valueProps} type="number" min={0} inputMode="numeric" suffix="Tagen" />;
      break;
    case "euro":
      value = <Field {...valueProps} inputMode="decimal" suffix="€" placeholder="50" />;
      break;
    case "date":
      value = <Field {...valueProps} type="date" />;
      break;
    case "product":
      value = <Select {...valueProps} placeholder="Produkt wählen" options={products} />;
      break;
    case "newsletter":
      value = (
        <Select
          {...valueProps}
          options={NEWSLETTER_SEGMENT_STATUSES.map((s) => ({
            value: s,
            label: NEWSLETTER_STATUS_LABELS[s],
          }))}
        />
      );
      break;
    case "customer_type":
      value = (
        <Select
          {...valueProps}
          options={[
            { value: "b2c", label: "B2C" },
            { value: "b2b", label: "B2B" },
          ]}
        />
      );
      break;
    default:
      value = <Field {...valueProps} maxLength={kind === "postal" ? 5 : 100} />;
  }
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <Select
        name={`f${i}`}
        label={`Feld ${i + 1}`}
        hideLabel
        defaultValue={row.field}
        options={FIELD_KEYS.map((f) => ({ value: f, label: SEGMENT_FIELDS[f].label }))}
        className="max-md:col-span-1"
      />
      <button
        type="submit"
        name="del"
        value={String(i)}
        aria-label={`Bedingung ${i + 1} entfernen`}
        className="hover:bg-admin-flaeche text-admin-text-2 flex size-11 items-center justify-center rounded md:order-last md:size-10"
      >
        <Icon name="schliessen" size={18} />
      </button>
      <Select
        name={`o${i}`}
        label={`Operator ${i + 1}`}
        hideLabel
        defaultValue={row.op}
        options={opsFor(row.field)}
        className="max-md:col-span-2"
      />
      <div className="max-md:col-span-2">{value}</div>
    </div>
  );
}

function DeleteSegment({ id, name }: { id: string; name: string }) {
  return (
    <Dialog
      title="Segment löschen?"
      description={name}
      trigger={{ label: "Löschen", variant: "text" }}
      size="sm"
    >
      <ActionForm action={deleteSegmentAction} hideMessage>
        <input type="hidden" name="segmentId" value={id} />
        <DialogBody>
          <ActionFormMessage />
          <p className="text-[14px]">
            Das Segment wird gelöscht. Kunden und Kontakte bleiben unverändert.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose />
          <SubmitButton variant="danger" pendingLabel="…">
            Löschen
          </SubmitButton>
        </DialogFooter>
      </ActionForm>
    </Dialog>
  );
}
