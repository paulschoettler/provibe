import Link from "next/link";
import {
  checkDiscountAction,
  deleteDiscountAction,
  saveDiscountFormAction,
  setDiscountActiveAction,
} from "@/lib/admin/discounts/actions";
import type { DiscountEditData, DiscountUsage } from "@/lib/admin/discounts/data";
import { isoToBerlinLocal } from "@/lib/admin/discounts/form";
import {
  DISCOUNT_KINDS,
  DISCOUNT_STATUS_LABELS,
  type DiscountInput,
} from "@/lib/admin/discounts/rules";
import type { ProductOption } from "@/lib/admin/products/data";
import { centsToInput } from "@/lib/admin/products/form";
import { ActionForm, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { Field, RadioCards, Select } from "@/components/admin/ui/fields";
import { formatDateTime, formatMoney } from "@/components/admin/ui/format";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SaveBar } from "@/components/admin/ui/SaveBar";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CodeField } from "./CodeField";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { PickerList } from "./PickerList";
import { StateCheckbox } from "./StateCheckbox";
import { StateError, StateNotice } from "./StateError";

/**
 * Rabatt-Editor (keine eigene Figma-Vorlage, Listen- und Detailmuster wie Produkte): Code mit
 * Generator, Art und Wert, Mindestbestellwert, Gültigkeit (Ortszeit Berlin), Limits gesamt und
 * je Kunde, Geltungsbereich (leer = ganze Bestellung), Kombinierbarkeit, Aktiv, Nutzungsliste.
 * Bereiche wechseln ohne JavaScript per CSS (:has, Block "Admin Katalog" in globals.css).
 */
const FORM_ID = "rabatt-form";

export const DISCOUNT_STATUS_TONES: Record<string, BadgeTone> = {
  active: "green",
  scheduled: "blue",
  expired: "gray",
  exhausted: "yellow",
  inactive: "gray",
};

export function DiscountEditor({
  data,
  input,
  usage,
  products,
  collections,
  canEdit,
}: {
  data: DiscountEditData | null;
  input: DiscountInput;
  usage: DiscountUsage | null;
  products: ProductOption[];
  collections: { id: string; title: string; handle: string; status: string }[];
  canEdit: boolean;
}) {
  const d = data?.discount;
  const isNew = !d;
  const scope = input.appliesTo?.scope ?? "order";
  const selected = input.appliesTo && "ids" in input.appliesTo ? input.appliesTo.ids : [];
  const kind = input.kind ?? "percentage";

  return (
    <>
      <PageHeader
        title={isNew ? "Rabatt anlegen" : d.code}
        backHref="/admin/rabatte"
        backLabel="Zurück zu den Rabatten"
        description={data ? `${data.summary}${d?.title ? ` · ${d.title}` : ""}` : undefined}
        meta={
          data ? (
            <Badge tone={DISCOUNT_STATUS_TONES[data.status]} hollow={data.status === "inactive"}>
              {DISCOUNT_STATUS_LABELS[data.status]}
            </Badge>
          ) : null
        }
        actions={
          d && canEdit ? (
            <>
              <form action={setDiscountActiveAction}>
                <input type="hidden" name="discountId" value={d.id} />
                <input type="hidden" name="active" value={d.is_active ? "false" : "true"} />
                <SubmitButton variant="secondary">
                  {d.is_active ? "Deaktivieren" : "Aktivieren"}
                </SubmitButton>
              </form>
              {d.usage_count === 0 ? (
                <form action={deleteDiscountAction}>
                  <input type="hidden" name="discountId" value={d.id} />
                  <ConfirmSubmit variant="danger" confirm={`Rabatt ${d.code} endgültig löschen?`}>
                    Löschen
                  </ConfirmSubmit>
                </form>
              ) : null}
            </>
          ) : null
        }
      />
      {!canEdit ? (
        <p className="rounded-admin-feld bg-admin-blau-hell mb-4 p-3 text-[14px]">
          Nur Ansicht: Rabatte bearbeiten dürfen Owner und Admin.
        </p>
      ) : null}

      <ActionForm
        id={FORM_ID}
        action={saveDiscountFormAction}
        resetOnSuccess={false}
        className="kat-rabatt"
      >
        <StateNotice />
        <fieldset disabled={!canEdit} className="contents">
          {d ? <input type="hidden" name="id" value={d.id} /> : null}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-4">
              <Card title="Code">
                <div className="flex flex-col gap-4">
                  <CodeField defaultValue={input.code ?? ""} disabled={!canEdit} />
                  <Field
                    name="title"
                    label="Interne Bezeichnung"
                    defaultValue={input.title ?? ""}
                    maxLength={120}
                    placeholder="Pre-Sale Herbst 2026"
                    hint="Nur im Backoffice sichtbar."
                  />
                </div>
              </Card>

              <Card title="Art und Wert">
                <div className="flex flex-col gap-4">
                  <RadioCards
                    name="kind"
                    legend="Art des Rabatts"
                    defaultValue={kind}
                    options={DISCOUNT_KINDS.map((k) => ({
                      value: k.value,
                      label: k.label,
                      description:
                        k.value === "percentage"
                          ? "Prozent vom Warenwert (ohne Pfand und Versand)"
                          : k.value === "fixed_amount"
                            ? "Fester Euro-Betrag vom Warenwert"
                            : "Versandkosten entfallen, gilt für die ganze Bestellung",
                    }))}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="kat-wert-prozent">
                      <Field
                        name="valuePercent"
                        label="Rabatt in Prozent"
                        inputMode="decimal"
                        suffix="%"
                        defaultValue={
                          kind === "percentage" && input.value
                            ? String(input.value / 100).replace(".", ",")
                            : ""
                        }
                        hint="Nur bei prozentualem Rabatt."
                      />
                    </div>
                    <div className="kat-wert-betrag">
                      <Field
                        name="valueAmount"
                        label="Rabatt in Euro"
                        inputMode="decimal"
                        suffix="€"
                        defaultValue={
                          kind === "fixed_amount" && input.value ? centsToInput(input.value) : ""
                        }
                        hint="Nur bei festem Betrag."
                      />
                    </div>
                    <Field
                      name="minSubtotal"
                      label="Mindestbestellwert"
                      inputMode="decimal"
                      suffix="€"
                      defaultValue={
                        input.minSubtotalCents ? centsToInput(input.minSubtotalCents) : ""
                      }
                      hint="Warenwert ohne Pfand und Versand. Leer: kein Mindestwert."
                    />
                  </div>
                  <StateError names={["kind"]} />
                </div>
              </Card>

              <Card title="Geltungsbereich">
                <div className="flex flex-col gap-4">
                  <FormMessage tone="info" className="mb-0">
                    Ohne Auswahl gilt der Rabatt für die <strong>ganze Bestellung</strong>. Ein
                    leerer Geltungsbereich heißt also: alle Produkte.
                  </FormMessage>
                  <RadioCards
                    name="scope"
                    legend="Gilt für"
                    defaultValue={scope}
                    options={[
                      {
                        value: "order",
                        label: "Ganze Bestellung",
                        description: "Alle Produkte im Warenkorb",
                      },
                      {
                        value: "products",
                        label: "Bestimmte Produkte",
                        description: "Nur auf die gewählten Produkte",
                      },
                      {
                        value: "collections",
                        label: "Bestimmte Kollektionen",
                        description: "Auf alle Produkte der gewählten Kollektionen",
                      },
                    ]}
                  />
                  <div className="kat-bereich-produkte">
                    <PickerList
                      name="productIds"
                      legend="Produkte"
                      errorName="appliesTo"
                      options={products.map((p) => ({
                        value: p.id,
                        label: p.title,
                        meta:
                          p.status === "active"
                            ? p.priceMinCents != null
                              ? `ab ${formatMoney(p.priceMinCents)}`
                              : undefined
                            : p.status === "draft"
                              ? "Entwurf"
                              : "Archiviert",
                        imageUrl: p.imageUrl,
                      }))}
                      selected={scope === "products" ? selected : []}
                    />
                  </div>
                  <div className="kat-bereich-kollektionen">
                    <PickerList
                      name="collectionIds"
                      legend="Kollektionen"
                      errorName="appliesTo"
                      options={collections.map((c) => ({
                        value: c.id,
                        label: c.title,
                        meta: c.status === "published" ? `/collections/${c.handle}` : "Entwurf",
                      }))}
                      selected={scope === "collections" ? selected : []}
                    />
                  </div>
                  <p className="text-admin-text-2 text-[12px]">
                    Versandkostenfrei gilt immer für die ganze Bestellung. Rabatte erscheinen nur im
                    Warenkorb und an der Kasse, nie als Streichpreis (I15).
                  </p>
                </div>
              </Card>

              {usage ? <UsageCard usage={usage} /> : null}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <Card title="Status">
                <StateCheckbox
                  name="isActive"
                  variant="switch"
                  label="Aktiv"
                  description="Nur aktive Codes lassen sich an der Kasse einlösen."
                  defaultChecked={input.isActive ?? true}
                />
              </Card>
              <Card
                title="Gültigkeit"
                description="Ortszeit Berlin. Leer heißt: ab sofort beziehungsweise ohne Ende."
              >
                <div className="flex flex-col gap-4">
                  <Field
                    name="startsAt"
                    label="Gültig ab"
                    type="datetime-local"
                    defaultValue={isoToBerlinLocal(input.startsAt as string | null)}
                  />
                  <Field
                    name="endsAt"
                    label="Gültig bis"
                    type="datetime-local"
                    defaultValue={isoToBerlinLocal(input.endsAt as string | null)}
                  />
                </div>
              </Card>
              <Card title="Limits">
                <div className="flex flex-col gap-4">
                  <Field
                    name="usageLimit"
                    label="Einlösungen gesamt"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    defaultValue={input.usageLimit != null ? String(input.usageLimit) : ""}
                    hint="Leer: unbegrenzt"
                  />
                  <Field
                    name="usageLimitPerCustomer"
                    label="Einlösungen je Kunde"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    defaultValue={
                      input.usageLimitPerCustomer != null ? String(input.usageLimitPerCustomer) : ""
                    }
                    hint="Gezählt wird je E-Mail-Adresse."
                  />
                  <StateCheckbox
                    name="combinable"
                    label="Mit anderen Rabatten kombinierbar"
                    description="Die Kasse nimmt derzeit einen Code je Bestellung an; die Einstellung gilt, sobald mehrere möglich sind."
                    defaultChecked={Boolean(input.combinable)}
                  />
                  <Select
                    name="customerType"
                    label="Kundengruppe"
                    defaultValue={input.customerType ?? ""}
                    options={[
                      { value: "", label: "Alle Kunden" },
                      { value: "b2c", label: "Nur Privatkunden (B2C)" },
                      { value: "b2b", label: "Nur Geschäftskunden (B2B, vorbereitet)" },
                    ]}
                  />
                </div>
              </Card>
              {d ? (
                <Card title="Übersicht">
                  <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[14px]">
                    <dt className="text-admin-text-2">Eingelöst</dt>
                    <dd className="text-right font-semibold">
                      {d.usage_count}
                      {d.usage_limit != null ? ` von ${d.usage_limit}` : ""}
                    </dd>
                    <dt className="text-admin-text-2">Angelegt</dt>
                    <dd className="text-right">{formatDateTime(d.created_at)}</dd>
                    {d.shopify_discount_id ? (
                      <>
                        <dt className="text-admin-text-2">Herkunft</dt>
                        <dd className="text-right">Shopify-Import</dd>
                      </>
                    ) : null}
                  </dl>
                </Card>
              ) : null}
            </div>
          </div>
        </fieldset>
        {canEdit ? (
          <SaveBar
            formId={FORM_ID}
            alwaysVisible={isNew}
            saveLabel={isNew ? "Rabatt anlegen" : "Speichern"}
          />
        ) : null}
      </ActionForm>

      {d ? (
        <div className="mt-6 max-w-xl">
          <Card
            title="Code prüfen"
            description="Rechnet wie die Kasse (gleiche Regeln aus src/lib/pricing), ohne etwas zu ändern."
          >
            <ActionForm action={checkDiscountAction} showSuccess resetOnSuccess={false}>
              <input type="hidden" name="code" value={d.code} />
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field
                  name="subtotal"
                  label="Warenwert"
                  inputMode="decimal"
                  suffix="€"
                  defaultValue="49,90"
                />
                <Field
                  name="email"
                  label="E-Mail (optional)"
                  type="email"
                  defaultValue=""
                  hint="für das Limit je Kunde"
                />
                <SubmitButton variant="secondary" className="sm:mb-[18px]">
                  Prüfen
                </SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function UsageCard({ usage }: { usage: DiscountUsage }) {
  return (
    <Card
      title="Nutzung"
      description={`${usage.usageCount} Einlösungen${usage.usageLimit != null ? ` von ${usage.usageLimit}` : ""} · ${usage.uniqueCustomers} Kunden · Rabatt gesamt ${formatMoney(usage.totalDiscountCents)}${usage.testRedemptions ? ` · davon ${usage.testRedemptions} Testbestellungen` : ""}`}
      flush
    >
      {usage.redemptions.length === 0 ? (
        <p className="text-admin-text-2 px-4 pb-4 text-[14px]">Noch nicht eingelöst.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <caption className="sr-only">Einlösungen des Codes</caption>
            <thead>
              <tr className="border-admin-rahmen bg-admin-flaeche text-admin-text-2 h-10 border-y text-left text-[13px]">
                <th scope="col" className="px-4 font-medium">
                  Bestellung
                </th>
                <th scope="col" className="px-2 font-medium">
                  Kunde
                </th>
                <th scope="col" className="px-2 text-right font-medium">
                  Rabatt
                </th>
                <th scope="col" className="px-4 font-medium">
                  Zeitpunkt
                </th>
              </tr>
            </thead>
            <tbody>
              {usage.redemptions.map((r) => (
                <tr
                  key={`${r.orderId}-${r.createdAt}`}
                  className="border-admin-rahmen h-11 border-b last:border-b-0"
                >
                  <td className="px-4">
                    <Link
                      href={`/admin/bestellungen/${r.orderId}`}
                      className="font-semibold hover:underline"
                    >
                      {r.orderNumber ?? r.orderId.slice(0, 8)}
                    </Link>
                    {r.isTest ? (
                      <Badge tone="yellow" noDot className="ml-2">
                        Test
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-2">
                    {r.customerId ? (
                      <Link href={`/admin/kunden/${r.customerId}`} className="hover:underline">
                        {r.email}
                      </Link>
                    ) : (
                      r.email
                    )}
                  </td>
                  <td className="px-2 text-right tabular-nums">{formatMoney(r.amountCents)}</td>
                  <td className="text-admin-text-2 px-4 whitespace-nowrap">
                    {formatDateTime(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
