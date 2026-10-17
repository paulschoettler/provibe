import Link from "next/link";
import type { ProductInput, VariantInput } from "@/lib/admin/products/rules";
import { COMPARE_AT_KINDS, FORMER_PRICE_ENABLED, UNIT_MEASURES } from "@/lib/admin/products/rules";
import { PRODUCT_LINES, type ProductLine } from "@/lib/admin/products/lines";
import {
  centsToInput,
  decimalToInput,
  NUTRIENTS,
  nutritionToInputs,
} from "@/lib/admin/products/form";
import type {
  BundleComponentView,
  CollectionMembership,
  ComponentCandidate,
  PriceHistoryEntry,
  VariantEditView,
} from "@/lib/admin/products/data";
import { Badge } from "@/components/admin/ui/Badge";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { Field, Select, Textarea } from "@/components/admin/ui/fields";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { formatDateTime, formatMoney } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { BasePriceBox } from "./BasePriceBox";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { PickerList } from "./PickerList";
import { RichTextEditor } from "./RichTextEditor";
import { StateCheckbox } from "./StateCheckbox";
import { StateError } from "./StateError";

/**
 * Karten des Produkt-Editors (Figma 40:13025 Desktop, 41:13346 Mobil, 41:13690 Bundle).
 * Server Components mit den Feldbausteinen des UI-Kits; Feldnamen siehe
 * src/lib/admin/products/form.ts.
 */

const UNLIMITED = 999999;

/** Label, das am Desktop nur für Screenreader da ist (Tabellenkopf übernimmt). */
function L({ children }: { children: string }) {
  return <span className="md:sr-only">{children}</span>;
}

/* ------------------------------------------------------------------------------------------ */
/* Allgemein                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export function GeneralCard({ input }: { input: ProductInput }) {
  return (
    <Card title="Allgemein">
      <div className="flex flex-col gap-4">
        <Field name="title" label="Titel" defaultValue={input.title} required maxLength={200} />
        <Field
          name="subtitle"
          label="Untertitel"
          defaultValue={input.subtitle ?? ""}
          maxLength={300}
          hint="Kurzzeile unter dem Titel, zum Beispiel „Eistee mit 15 g Protein“."
        />
        <RichTextEditor
          name="descriptionHtml"
          label="Beschreibung"
          defaultValue={input.descriptionHtml ?? ""}
          hint="Wird beim Speichern bereinigt: erlaubt sind Absätze, Überschriften, fett, kursiv, Listen und Links."
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Status, Typ, Tags                                                                           */
/* ------------------------------------------------------------------------------------------ */

export function StatusCard({
  input,
  line,
  isNew,
}: {
  input: ProductInput;
  line: ProductLine;
  isNew: boolean;
}) {
  return (
    <Card title="Status und Typ">
      <div className="flex flex-col gap-4">
        <Select
          name="status"
          label="Status"
          defaultValue={isNew ? "draft" : input.status}
          disabled={isNew}
          options={[
            { value: "active", label: "Aktiv" },
            { value: "draft", label: "Entwurf" },
            { value: "archived", label: "Archiviert" },
          ]}
          hint={
            isNew
              ? "Neue Produkte starten als Entwurf. Aktiv geht erst mit Varianten und Pflichtangaben."
              : "Aktiv ist im Shop sichtbar, Entwurf und Archiviert nur im Backoffice."
          }
        />
        {isNew ? <input type="hidden" name="status" value="draft" /> : null}
        <Select
          name="line"
          label="Typ"
          defaultValue={line}
          options={PRODUCT_LINES.map((l) => ({ value: l.value, label: l.label }))}
          hint="Bundle bucht den Bestand der Komponenten ab. Sorte und Mixed sind Lebensmittel, Merch nicht."
        />
        <Field
          name="tags"
          label="Tags"
          defaultValue={(input.tags ?? []).join(", ")}
          hint="Mit Komma trennen. Tags steuern regelbasierte Kollektionen."
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            name="position"
            label="Position"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={input.position != null ? String(input.position) : ""}
            hint="Reihenfolge im Shop"
          />
          <Field
            name="productType"
            label="Produktart"
            defaultValue={input.productType ?? ""}
            hint="aus Shopify, für Regeln"
          />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Kollektionen                                                                                */
/* ------------------------------------------------------------------------------------------ */

export function CollectionsCard({ collections }: { collections: CollectionMembership[] }) {
  const manual = collections.filter((c) => c.kind === "manual");
  const auto = collections.filter((c) => c.kind === "automatic");
  return (
    <Card
      title="Kollektionen"
      action={
        <Link href="/admin/kollektionen" className={cardActionClass}>
          Verwalten
        </Link>
      }
    >
      <input type="hidden" name="collectionIds.present" value="1" />
      <div className="flex flex-col gap-3">
        <PickerList
          name="collectionIds"
          legend="Manuelle Kollektionen"
          errorName="collectionIds"
          options={manual.map((c) => ({
            value: c.id,
            label: c.title,
            meta: c.status === "published" ? `/collections/${c.handle}` : "Entwurf",
          }))}
          selected={manual.filter((c) => c.member).map((c) => c.id)}
          emptyText="Noch keine manuellen Kollektionen."
        />
        {auto.length ? (
          <div>
            <p className="text-[13px] font-medium">Regelbasiert (automatisch)</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {auto.map((c) => (
                <li key={c.id}>
                  <Badge tone={c.member ? "green" : "gray"} hollow={!c.member}>
                    {c.title}
                    {c.member ? "" : " (passt nicht)"}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-admin-text-2 mt-1.5 text-[12px]">
              Ergibt sich aus den Bedingungen der Kollektion, zum Beispiel aus Tags oder Status.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Pfand und Grundpreis, Steuer, Versand                                                       */
/* ------------------------------------------------------------------------------------------ */

export function DepositCard({
  input,
  variants,
  isBundle,
}: {
  input: ProductInput;
  variants: VariantInput[];
  isBundle: boolean;
}) {
  const measures = UNIT_MEASURES.map((m) => ({ value: m.value, label: m.label }));
  return (
    <Card title="Pfand und Grundpreis">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            name="depositCentsPerUnit"
            label="Pfand je Einheit"
            defaultValue={centsToInput(input.depositCentsPerUnit ?? 0)}
            inputMode="decimal"
            suffix="€"
          />
          <Field
            name="netContentPerUnit"
            label="Füllmenge je Einheit"
            defaultValue={decimalToInput(input.netContentPerUnit ?? null)}
            inputMode="decimal"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            name="netContentMeasure"
            label="Einheit der Füllmenge"
            defaultValue={input.netContentMeasure ?? "piece"}
            options={measures}
          />
          <Select
            name="basePriceMeasure"
            label="Grundpreis je"
            defaultValue={input.basePriceMeasure ?? "piece"}
            options={measures}
          />
        </div>
        <Field
          name="unitLabel"
          label="Bezeichnung der Einheit"
          defaultValue={input.unitLabel ?? "Stück"}
          hint="Zum Beispiel Dose. Varianten bestehen aus mehreren Einheiten (9 bis 48 Dosen)."
        />
        <p className="text-admin-text-2 text-[12px]">
          Der Preis der Variante enthält das Pfand (Datenbankstand). Shop und Kasse weisen das Pfand
          getrennt aus und rechnen es nicht in den Grundpreis ein (§ 7 PAngV, H22). Standard 0 €,
          bis die Pfandfrage geklärt ist.
        </p>
        {isBundle ? (
          <p className="text-admin-text-2 text-[13px]">
            Bundles haben keinen Grundpreis; das Pfand ergibt sich aus den Komponenten (H1).
          </p>
        ) : (
          <BasePriceBox
            initial={{
              deposit: input.depositCentsPerUnit ?? 0,
              netContent: input.netContentPerUnit ?? null,
              measure: (input.basePriceMeasure ?? "piece") as "l" | "kg" | "piece",
              rows: variants.map((v, i) => ({
                index: i,
                title: v.title,
                priceCents: v.priceCents,
                unitCount: v.unitCount ?? 1,
                isActive: v.isActive ?? true,
              })),
            }}
          />
        )}
      </div>
    </Card>
  );
}

export function TaxCard({
  input,
  taxClasses,
}: {
  input: ProductInput;
  taxClasses: { value: string; label: string; rateBp: number }[];
}) {
  return (
    <Card title="Steuer">
      <Select
        name="taxClass"
        label="Steuersatz"
        defaultValue={input.taxClass ?? "standard"}
        options={taxClasses.map((t) => ({
          value: t.value,
          label: `${(t.rateBp / 100).toLocaleString("de-DE")} % (${t.label})`,
        }))}
        hint="Gilt für alle Varianten, für Preis und Pfand. Ermäßigter Satz nur nach Rücksprache mit der Steuerberatung (H2)."
      />
    </Card>
  );
}

export function ShippingCard({ input }: { input: ProductInput }) {
  return (
    <Card title="Versand">
      <div className="flex flex-col gap-4">
        <Field
          name="weightGramsPerUnit"
          label="Gewicht je Einheit"
          type="number"
          min={0}
          inputMode="numeric"
          suffix="g"
          defaultValue={input.weightGramsPerUnit != null ? String(input.weightGramsPerUnit) : ""}
          hint="Vorlage für neue Varianten; maßgeblich ist das Gewicht je Variante."
        />
        <Field
          name="deliveryTimeText"
          label="Lieferzeit-Hinweis"
          defaultValue={input.deliveryTimeText ?? ""}
          maxLength={80}
          placeholder="Lieferzeit 3 bis 5 Werktage"
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Varianten                                                                                   */
/* ------------------------------------------------------------------------------------------ */

function stockLabel(v: VariantEditView): { text: string; tone: string } {
  // Lagereinheit Dose (H24): Packs haben keinen eigenen Bestand, er kommt aus den Einzeldosen
  if (v.stockUnits.length > 0) {
    const a = v.inventory?.available;
    if (a == null || a >= UNLIMITED)
      return { text: "Bestand aus Dosen, nicht geführt", tone: "text-admin-text-2" };
    return {
      text: `Bestand aus Dosen: ${a} ${a === 1 ? "Pack" : "Packs"}`,
      tone: a <= 0 ? "text-admin-rot" : "text-admin-text-2",
    };
  }
  const prefix = v.isStockUnit ? "Lagereinheit, Bestand" : "Bestand";
  if (
    !v.inventory ||
    !v.inventory.trackInventory ||
    v.inventory.available == null ||
    v.inventory.available >= UNLIMITED
  )
    return { text: `${prefix} –`, tone: "text-admin-text-2" };
  const a = v.inventory.available;
  if (a <= 0) return { text: `${prefix} 0`, tone: "text-admin-rot" };
  if (a <= v.inventory.lowStockThreshold)
    return { text: `${prefix} ${a}`, tone: "text-admin-gelb-text" };
  return { text: `${prefix} ${a}`, tone: "" };
}

export function VariantsCard({
  variants,
  views,
  isBundle,
  taxLabel,
  depositPerUnit,
  removeFormId,
  isNew,
  canEdit,
  unitLabel,
}: {
  variants: VariantInput[];
  views: VariantEditView[];
  isBundle: boolean;
  taxLabel: string;
  depositPerUnit: number;
  removeFormId: string;
  isNew: boolean;
  canEdit: boolean;
  unitLabel: string;
}) {
  const viewById = new Map(views.map((v) => [v.id, v]));
  const n = variants.length;
  const missingWeight = variants.filter((v) => v.isActive && v.weightGrams == null).length;
  const SHORT: Record<string, string> = {
    none: "Keiner",
    components_sum: "Einzeln",
    former_price: FORMER_PRICE_ENABLED ? "Früherer Preis" : "Früherer Preis (gesperrt, H17)",
  };
  const kinds = COMPARE_AT_KINDS.map((k) => ({
    value: k.value,
    label: SHORT[k.value] ?? k.label,
    disabled:
      (k.value === "former_price" && !FORMER_PRICE_ENABLED) ||
      (k.value === "components_sum" && !isBundle),
  }));

  return (
    <Card
      title="Varianten"
      description={`Steuersatz ${taxLabel} für alle Varianten · Pfand ${centsToInput(depositPerUnit)} € je ${unitLabel}`}
      flush
    >
      <StateError names={["variants"]} box />
      {n > 0 ? (
        <div className="overflow-x-auto">
          <table className="kat-varianten w-full text-[14px] max-md:block md:min-w-[800px] md:table-fixed">
            <caption className="sr-only">Varianten bearbeiten</caption>
            <colgroup className="max-md:hidden">
              <col />
              <col className="w-[64px]" />
              <col className="w-[108px]" />
              <col className="w-[120px]" />
              <col className="w-[116px]" />
              <col className="w-[104px]" />
              <col className="w-[76px]" />
              <col className="w-[48px]" />
              <col className="w-[40px]" />
            </colgroup>
            <thead className="max-md:hidden">
              <tr className="border-admin-rahmen bg-admin-flaeche text-admin-text-2 h-10 border-y text-left text-[13px]">
                <th scope="col" className="pr-1.5 pl-4 font-medium">
                  Variante
                </th>
                <th scope="col" className="px-1.5 font-medium">
                  Einh.
                </th>
                <th scope="col" className="px-1.5 font-medium">
                  Preis
                </th>
                <th scope="col" className="px-1.5 font-medium">
                  Streichpreis
                </th>
                <th scope="col" className="px-1.5 font-medium">
                  SKU
                </th>
                <th scope="col" className="px-1.5 font-medium">
                  GTIN
                </th>
                <th scope="col" className="px-1.5 font-medium">
                  Gewicht
                </th>
                <th scope="col" className="px-1.5 text-center font-medium">
                  Aktiv
                </th>
                <th scope="col" className="px-1.5">
                  <span className="sr-only">Entfernen</span>
                </th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {variants.map((v, i) => {
                const view = v.id ? viewById.get(v.id) : undefined;
                const p = `variants.${i}`;
                const stock = view ? stockLabel(view) : { text: "–", tone: "" };
                return (
                  <tr
                    key={v.id ?? i}
                    className="border-admin-rahmen border-b align-top max-md:grid max-md:grid-cols-2 max-md:gap-3 max-md:p-4 md:[&>td]:py-2"
                  >
                    <td className="pr-1.5 pl-4 max-md:col-span-2 max-md:px-0">
                      <input type="hidden" name={`${p}.id`} value={v.id ?? ""} />
                      <input type="hidden" name={`${p}.titleOriginal`} value={v.title} />
                      <input
                        type="hidden"
                        name={`${p}.optionValues`}
                        value={JSON.stringify(v.optionValues ?? {})}
                      />
                      <input
                        type="hidden"
                        name={`${p}.packagingWeightGrams`}
                        value={String(v.packagingWeightGrams ?? 0)}
                      />
                      <input type="hidden" name={`${p}.position`} value={String(v.position ?? i)} />
                      {!FORMER_PRICE_ENABLED ? (
                        <input
                          type="hidden"
                          name={`${p}.compareAtCents`}
                          value={centsToInput(v.compareAtCents ?? null)}
                        />
                      ) : null}
                      <Field
                        name={`${p}.title`}
                        label={<L>Variante</L>}
                        defaultValue={v.title}
                        maxLength={120}
                        hint={<span className={stock.tone}>{stock.text}</span>}
                      />
                    </td>
                    <td className="px-1.5 max-md:px-0">
                      <Field
                        name={`${p}.unitCount`}
                        label={<L>Einheiten</L>}
                        inputMode="numeric"
                        defaultValue={String(v.unitCount ?? 1)}
                      />
                    </td>
                    <td className="px-1.5 max-md:px-0">
                      <Field
                        name={`${p}.priceCents`}
                        label={<L>Preis</L>}
                        inputMode="decimal"
                        suffix="€"
                        defaultValue={centsToInput(v.priceCents)}
                        hint={
                          !isBundle && depositPerUnit > 0
                            ? `inkl. ${centsToInput(depositPerUnit * (v.unitCount ?? 1))} € Pfand`
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-1.5 max-md:px-0">
                      <Select
                        name={`${p}.compareAtKind`}
                        label={<L>Streichpreis-Art</L>}
                        defaultValue={v.compareAtKind ?? "none"}
                        options={kinds}
                        hint={
                          v.compareAtKind === "components_sum" && view?.componentsSumCents != null
                            ? `Einzeln: ${formatMoney(view.componentsSumCents)}`
                            : undefined
                        }
                      />
                      {FORMER_PRICE_ENABLED ? (
                        <Field
                          name={`${p}.compareAtCents`}
                          label="Früherer Preis"
                          inputMode="decimal"
                          suffix="€"
                          defaultValue={centsToInput(v.compareAtCents ?? null)}
                          hint={
                            view?.lowestPrice30dCents != null
                              ? `niedrigster Preis 30 Tage: ${formatMoney(view.lowestPrice30dCents)}`
                              : undefined
                          }
                        />
                      ) : null}
                    </td>
                    <td className="px-1.5 max-md:px-0">
                      <Field
                        name={`${p}.sku`}
                        label={<L>SKU</L>}
                        defaultValue={v.sku ?? ""}
                        maxLength={64}
                        autoComplete="off"
                      />
                    </td>
                    <td className="px-1.5 max-md:px-0">
                      <Field
                        name={`${p}.gtin`}
                        label={<L>GTIN</L>}
                        defaultValue={v.gtin ?? ""}
                        inputMode="numeric"
                        placeholder="optional"
                      />
                    </td>
                    <td className="px-1.5 max-md:px-0">
                      <Field
                        name={`${p}.weightGrams`}
                        label={<L>Gewicht (g)</L>}
                        inputMode="numeric"
                        defaultValue={v.weightGrams != null ? String(v.weightGrams) : ""}
                        placeholder="g"
                      />
                    </td>
                    <td className="px-1.5 max-md:self-end max-md:px-0 md:pt-[19px] md:text-center">
                      <StateCheckbox
                        name={`${p}.isActive`}
                        label="Aktiv"
                        variant="box"
                        aria-label={`Variante ${v.title} aktiv`}
                        defaultChecked={v.isActive ?? true}
                      />
                      <span className="ml-2 text-[13px] md:hidden">Aktiv</span>
                    </td>
                    <td className="px-1 max-md:col-span-2 max-md:px-0 md:pt-[11px]">
                      {canEdit && v.id ? (
                        <ConfirmSubmit
                          form={removeFormId}
                          name="variantId"
                          value={v.id}
                          variant="text"
                          size="sm"
                          icon="schliessen"
                          aria-label={`Variante ${v.title} entfernen`}
                          confirm={`Variante „${v.title}“ entfernen? Hat sie Bestellungen oder Bestand, wird sie nur deaktiviert.`}
                        >
                          <span className="md:sr-only">Entfernen</span>
                        </ConfirmSubmit>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 p-4">
        {missingWeight ? (
          <FormMessage tone="warning" className="mb-0">
            <strong className="block">
              Gewicht fehlt bei{" "}
              {missingWeight === n && n > 1
                ? "allen Varianten"
                : missingWeight === 1
                  ? "einer Variante"
                  : `${missingWeight} Varianten`}
            </strong>
            DHL braucht das Gewicht für das Versandlabel. GTIN ist optional und für Google Shopping
            empfohlen.
          </FormMessage>
        ) : null}
        {canEdit ? <NewVariantRow index={n} open={isNew || n === 0} isBundle={isBundle} /> : null}
        <p className="text-admin-text-2 text-[12px]">
          Streichpreise: keine Packgrößen-Vergleiche (B3). Bundles zeigen „Einzeln: X €“ aus den
          Komponenten. Frühere Preise (30-Tage-Regel) bleiben bis zur Freigabe ausgeschaltet (H17).
        </p>
      </div>
    </Card>
  );
}

function NewVariantRow({
  index,
  open,
  isBundle,
}: {
  index: number;
  open: boolean;
  isBundle: boolean;
}) {
  const p = `variants.${index}`;
  return (
    <details
      open={open}
      className="rounded-admin-feld border-admin-rahmen-stark group border border-dashed"
    >
      <summary className="text-admin-akzent flex min-h-11 cursor-pointer items-center gap-2 px-3 text-[14px] font-bold">
        <Icon name="plus" size={16} />
        {index === 0 ? "Erste Variante" : "Variante hinzufügen"}
      </summary>
      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name={`${p}.isNew`} value="1" />
        <input type="hidden" name={`${p}.position`} value={String(index)} />
        <Field
          name={`${p}.title`}
          label="Titel"
          placeholder={isBundle ? "Größe M" : "9 Dosen"}
          defaultValue=""
        />
        <Field
          name={`${p}.unitCount`}
          label="Einheiten"
          type="number"
          min={1}
          defaultValue={isBundle ? "1" : ""}
          inputMode="numeric"
        />
        <Field
          name={`${p}.priceCents`}
          label="Preis"
          inputMode="decimal"
          suffix="€"
          defaultValue=""
        />
        <Field name={`${p}.sku`} label="SKU" defaultValue="" autoComplete="off" />
        <Field name={`${p}.gtin`} label="GTIN" defaultValue="" inputMode="numeric" />
        <Field
          name={`${p}.weightGrams`}
          label="Gewicht (g)"
          type="number"
          min={0}
          defaultValue=""
        />
        <input
          type="hidden"
          name={`${p}.compareAtKind`}
          value={isBundle ? "components_sum" : "none"}
        />
        <StateCheckbox name={`${p}.isActive`} label="Aktiv" defaultChecked className="self-end" />
      </div>
      <p className="text-admin-text-2 px-3 pb-3 text-[12px]">
        Wird beim Speichern angelegt, wenn ein Titel eingetragen ist. Neue Varianten bekommen eine
        Bestandszeile mit 0.
      </p>
    </details>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Bundle-Komponenten                                                                          */
/* ------------------------------------------------------------------------------------------ */

export function BundleCard({
  views,
  candidates,
  stock,
  depositByVariant,
  canEdit,
}: {
  views: VariantEditView[];
  candidates: ComponentCandidate[];
  stock: Record<string, number>;
  depositByVariant: Record<string, number>;
  canEdit: boolean;
}) {
  return (
    <Card
      title="Bundle-Komponenten"
      description="Verfügbarkeit ergibt sich aus den Komponenten. Ein Verkauf bucht den Bestand der Komponenten ab (H14: Lagereinheit ist die einzelne Dose)."
      flush
    >
      {views.length === 0 ? (
        <p className="text-admin-text-2 px-4 pb-4 text-[14px]">
          Lege zuerst eine Variante an, dann ihre Komponenten.
        </p>
      ) : null}
      {views.map((v) => (
        <BundleVariantComponents
          key={v.id}
          view={v}
          showTitle={views.length > 1}
          candidates={candidates}
          stock={stock}
          depositByVariant={depositByVariant}
          canEdit={canEdit}
        />
      ))}
    </Card>
  );
}

function availText(n: number | undefined): string {
  if (n == null) return "–";
  return n >= UNLIMITED ? "nicht geführt" : String(n);
}

function BundleVariantComponents({
  view,
  showTitle,
  candidates,
  stock,
  depositByVariant,
  canEdit,
}: {
  view: VariantEditView;
  showTitle: boolean;
  candidates: ComponentCandidate[];
  stock: Record<string, number>;
  depositByVariant: Record<string, number>;
  canEdit: boolean;
}) {
  const base = `components.${view.id}`;
  const comps: BundleComponentView[] = view.components;
  const limits = comps.map((c) => {
    const a = stock[c.componentVariantId];
    return a == null || a >= UNLIMITED ? Number.POSITIVE_INFINITY : Math.floor(a / c.quantity);
  });
  const bundleAvail = comps.length ? Math.min(...limits) : 0;
  const limiting = comps.find((_, i) => limits[i] === bundleAvail && Number.isFinite(bundleAvail));
  const units = comps.reduce((s, c) => s + c.quantity, 0);
  const deposit = comps.reduce(
    (s, c) => s + (depositByVariant[c.componentVariantId] ?? 0) * c.quantity,
    0,
  );
  const used = new Set(comps.map((c) => c.componentVariantId));

  return (
    <div className="border-admin-rahmen border-t first:border-t-0">
      <input type="hidden" name={`${base}.present`} value="1" />
      {showTitle ? (
        <h3 className="bg-admin-flaeche px-4 py-2 text-[14px] font-bold">Variante {view.title}</h3>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <caption className="sr-only">Komponenten der Variante {view.title}</caption>
          <thead>
            <tr className="border-admin-rahmen text-admin-text-2 h-10 border-b text-left text-[13px]">
              <th scope="col" className="px-4 font-medium">
                Komponente
              </th>
              <th scope="col" className="w-[120px] px-2 font-medium">
                Menge je Bundle
              </th>
              <th scope="col" className="w-[110px] px-2 font-medium max-sm:hidden">
                Verfügbar
              </th>
              <th scope="col" className="w-[120px] px-2 font-medium max-sm:hidden">
                Reicht für
              </th>
              <th scope="col" className="w-[90px] px-2 font-medium">
                Entfernen
              </th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c, j) => {
              const lim = limits[j];
              const short = Number.isFinite(lim) && lim === 0;
              return (
                <tr
                  key={c.componentVariantId}
                  className={`border-admin-rahmen border-b ${short ? "bg-admin-rot-hell" : ""}`}
                >
                  <td className="px-4 py-2">
                    <input
                      type="hidden"
                      name={`${base}.${j}.componentVariantId`}
                      value={c.componentVariantId}
                    />
                    <Link
                      href={`/admin/produkte/${c.productId}`}
                      className="font-bold hover:underline"
                    >
                      {c.productTitle}
                    </Link>
                    <span className="text-admin-text-2 block text-[13px]">
                      {c.variantTitle} · {formatMoney(c.priceCents)}
                      {c.isActive ? "" : " · nur als Komponente"}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <Field
                      name={`${base}.${j}.quantity`}
                      label={`Menge ${c.productTitle}`}
                      hideLabel
                      type="number"
                      min={1}
                      max={100}
                      inputMode="numeric"
                      defaultValue={String(c.quantity)}
                    />
                  </td>
                  <td className={`px-2 py-2 max-sm:hidden ${short ? "text-admin-rot" : ""}`}>
                    {availText(stock[c.componentVariantId])}
                  </td>
                  <td
                    className={`px-2 py-2 font-bold max-sm:hidden ${short ? "text-admin-rot" : ""}`}
                  >
                    {Number.isFinite(lim) ? `${lim} Bundles` : "unbegrenzt"}
                  </td>
                  <td className="px-2 py-2">
                    {canEdit ? (
                      <StateCheckbox
                        name={`${base}.${j}.remove`}
                        label="Entfernen"
                        variant="box"
                        aria-label={`${c.productTitle} entfernen`}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <StateError names={[base]} box />
        {comps.length && Number.isFinite(bundleAvail) && bundleAvail === 0 && limiting ? (
          <FormMessage tone="error" className="mb-0">
            <strong className="block">Bundle verfügbar: 0</strong>
            Begrenzt durch {limiting.productTitle}. Im Shop als ausverkauft angezeigt.
          </FormMessage>
        ) : null}
        {canEdit ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <Select
              name={`${base}.new.componentVariantId`}
              label="Komponente hinzufügen"
              placeholder="Variante wählen"
              defaultValue=""
              options={candidates
                .filter((c) => !used.has(c.variantId))
                .map((c) => ({
                  value: c.variantId,
                  label: `${c.productTitle} · ${c.variantTitle}${c.sku ? ` (${c.sku})` : ""}`,
                }))}
              hint="Nur Einzelvarianten (1 Einheit), mehrere Dosen über die Menge."
            />
            <Field
              name={`${base}.new.quantity`}
              label="Menge"
              type="number"
              min={1}
              defaultValue="1"
              inputMode="numeric"
            />
          </div>
        ) : null}
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-[14px]">
          <dt className="text-admin-text-2">Summe Einzelpreise ({units} Einheiten)</dt>
          <dd className="text-right font-bold">
            {view.componentsSumCents != null ? formatMoney(view.componentsSumCents) : "–"}
          </dd>
          <dt className="text-admin-text-2">Bundle-Preis</dt>
          <dd className="text-right font-bold">{formatMoney(view.priceCents)}</dd>
          <dt className="text-admin-text-2">Pfand aus Komponenten</dt>
          <dd className="text-right font-bold">{formatMoney(deposit)}</dd>
        </dl>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* LMIV                                                                                        */
/* ------------------------------------------------------------------------------------------ */

export function LmivCard({ input, isFood }: { input: ProductInput; isFood: boolean }) {
  const l = input.lmiv ?? {
    foodName: null,
    ingredientsHtml: null,
    allergens: null,
    nutrition: null,
    storageInstructions: null,
    foodBusinessOperator: null,
    countryOfOrigin: null,
  };
  const req = isFood;
  return (
    <Card
      title="Lebensmittelangaben (LMIV)"
      description="Pflichtangaben für Lebensmittel, erscheinen auf der Produktseite unter „Zutaten und Nährwerte“. Mit * markierte Felder braucht ein aktives Lebensmittel."
    >
      <div className="flex flex-col gap-4">
        <StateCheckbox
          name="isFood"
          label="Dieses Produkt ist ein Lebensmittel"
          description="Dann gelten die Pflichtangaben nach LMIV und ein Grundpreis je Liter oder Kilogramm."
          defaultChecked={Boolean(input.isFood)}
        />
        <Field
          name="lmiv.foodName"
          label="Bezeichnung des Lebensmittels"
          required={req}
          defaultValue={l.foodName ?? ""}
          maxLength={200}
          placeholder="Eistee mit Molkenprotein, mit Süßungsmittel"
        />
        <RichTextEditor
          name="lmiv.ingredientsHtml"
          label={req ? "Zutaten *" : "Zutaten"}
          inline
          minHeight={90}
          defaultValue={l.ingredientsHtml ?? ""}
          hint="Allergene fett hervorheben (B). Erlaubt sind nur Hervorhebungen und Absätze."
        />
        <Field
          name="lmiv.allergens"
          label="Allergene"
          required={req}
          defaultValue={l.allergens ?? ""}
          maxLength={1000}
          placeholder="Milch (Molkenprotein). Laktosefrei."
        />
        <NutritionTable nutrition={l.nutrition} required={req} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="lmiv.storageInstructions"
            label="Lagerung"
            required={req}
            defaultValue={l.storageInstructions ?? ""}
            maxLength={500}
            placeholder="Kühl und trocken lagern, vor Sonnenlicht schützen."
          />
          <Field
            name="lmiv.countryOfOrigin"
            label="Herkunft"
            defaultValue={l.countryOfOrigin ?? ""}
            maxLength={120}
            placeholder="Deutschland"
          />
        </div>
        <Textarea
          name="lmiv.foodBusinessOperator"
          label="Hersteller (Lebensmittelunternehmer)"
          required={req}
          rows={2}
          defaultValue={l.foodBusinessOperator ?? ""}
          maxLength={500}
          hint="Name und Anschrift des verantwortlichen Lebensmittelunternehmers."
        />
      </div>
    </Card>
  );
}

function NutritionTable({ nutrition, required }: { nutrition: unknown; required: boolean }) {
  const values = nutritionToInputs(nutrition);
  const keys = (
    typeof values["lmiv.nutrition.keys"] === "string" ? values["lmiv.nutrition.keys"] : ""
  )
    .split(",")
    .filter(Boolean);
  const cols = keys.length
    ? keys.map((k) => ({ key: k, prefix: `lmiv.nutrition.variants.${k}`, label: k }))
    : [{ key: "", prefix: "lmiv.nutrition", label: "Wert" }];
  const v = (name: string) => (typeof values[name] === "string" ? (values[name] as string) : "");
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-medium">Nährwerte{required ? " *" : ""}</legend>
      <input type="hidden" name="lmiv.nutrition.keys" value={keys.join(",")} />
      <div className="grid max-w-xs grid-cols-[auto_1fr] items-center gap-2">
        <label htmlFor="naehrwerte-je" className="text-admin-text-2 text-[13px]">
          je
        </label>
        <input
          id="naehrwerte-je"
          name="lmiv.nutrition.per"
          defaultValue={v("lmiv.nutrition.per") || "100 ml"}
          className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte focus-visible:border-admin-akzent h-11 border px-3 text-[14px] focus-visible:border-2 focus-visible:outline-none md:h-10"
        />
      </div>
      <div className="rounded-admin-feld border-admin-rahmen overflow-x-auto border">
        <table className="w-full text-[14px]">
          <caption className="sr-only">Nährwerttabelle</caption>
          {keys.length ? (
            <thead>
              <tr className="bg-admin-flaeche text-admin-text-2 text-left text-[13px]">
                <th scope="col" className="px-3 py-2 font-medium">
                  Nährwert
                </th>
                {cols.map((c) => (
                  <th key={c.key} scope="col" className="px-2 py-2 font-medium capitalize">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {NUTRIENTS.map((n, i) => (
              <tr key={n.key} className={i % 2 ? "bg-admin-flaeche" : ""}>
                <th
                  scope="row"
                  className={`px-3 py-1.5 text-left font-normal ${n.indent ? "text-admin-text-2 pl-6" : ""}`}
                >
                  {n.label}
                  {n.key === "energy" ? " (kJ / kcal)" : " (g)"}
                </th>
                {cols.map((c) => (
                  <td key={c.key} className={`px-2 py-1.5 ${keys.length ? "" : "w-[240px]"}`}>
                    {n.key === "energy" ? (
                      <div className="flex gap-2">
                        <Field
                          name={`${c.prefix}.energy_kj`}
                          label={`Energie kJ ${c.label}`}
                          hideLabel
                          inputMode="numeric"
                          defaultValue={v(`${c.prefix}.energy_kj`)}
                          placeholder="kJ"
                        />
                        <Field
                          name={`${c.prefix}.energy_kcal`}
                          label={`Energie kcal ${c.label}`}
                          hideLabel
                          inputMode="numeric"
                          defaultValue={v(`${c.prefix}.energy_kcal`)}
                          placeholder="kcal"
                        />
                      </div>
                    ) : (
                      <Field
                        name={`${c.prefix}.${n.key}`}
                        label={`${n.label} ${c.label}`}
                        hideLabel
                        defaultValue={v(`${c.prefix}.${n.key}`)}
                        placeholder={n.key === "fibre_g" ? "optional" : "<0,5"}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StateError names={["lmiv.nutrition"]} />
      <p className="text-admin-text-2 text-[12px]">
        Werte wie 4,5 oder &lt;0,5. Alle Felder leer heißt: keine Nährwerttabelle.
        {keys.length ? " Mixed: eine Spalte je enthaltener Sorte." : ""}
      </p>
    </fieldset>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Preis-Historie                                                                              */
/* ------------------------------------------------------------------------------------------ */

export function PriceHistoryCard({
  entries,
  views,
}: {
  entries: PriceHistoryEntry[];
  views: VariantEditView[];
}) {
  return (
    <Card
      title="Preis-Historie"
      description="Jede Preisänderung aus price_history, neueste zuerst. Grundlage für den niedrigsten Preis der letzten 30 Tage (PAngV § 11)."
      flush
    >
      {views.length ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 pb-3 text-[13px] sm:grid-cols-[1fr_auto_1fr_auto]">
          {views.map((v) => (
            <div key={v.id} className="contents">
              <dt className="text-admin-text-2 truncate">Niedrigster Preis 30 Tage, {v.title}</dt>
              <dd className="text-right font-bold">
                {v.lowestPrice30dCents != null ? formatMoney(v.lowestPrice30dCents) : "–"}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {entries.length === 0 ? (
        <p className="text-admin-text-2 px-4 pb-4 text-[14px]">Noch keine Einträge.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Preis-Historie</caption>
            <thead>
              <tr className="border-admin-rahmen bg-admin-flaeche text-admin-text-2 h-9 border-y text-left">
                <th scope="col" className="px-4 font-medium">
                  Variante
                </th>
                <th scope="col" className="px-2 text-right font-medium">
                  Preis
                </th>
                <th scope="col" className="px-2 text-right font-medium max-sm:hidden">
                  Streichpreis
                </th>
                <th scope="col" className="px-2 font-medium">
                  Gültig ab
                </th>
                <th scope="col" className="px-2 font-medium max-sm:hidden">
                  bis
                </th>
                <th scope="col" className="px-2 font-medium max-lg:hidden">
                  Quelle
                </th>
                <th scope="col" className="px-2 font-medium max-lg:hidden">
                  Geändert von
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-admin-rahmen h-10 border-b last:border-b-0">
                  <td className="px-4">{e.variantTitle}</td>
                  <td className="px-2 text-right font-bold tabular-nums">
                    {formatMoney(e.priceCents)}
                  </td>
                  <td className="px-2 text-right tabular-nums max-sm:hidden">
                    {e.compareAtCents != null ? formatMoney(e.compareAtCents) : "–"}
                  </td>
                  <td className="px-2 whitespace-nowrap">{formatDateTime(e.validFrom)}</td>
                  <td className="px-2 whitespace-nowrap max-sm:hidden">
                    {e.validTo ? formatDateTime(e.validTo) : <Badge tone="green">aktuell</Badge>}
                  </td>
                  <td className="text-admin-text-2 px-2 max-lg:hidden">{e.source}</td>
                  <td className="text-admin-text-2 px-2 max-lg:hidden">
                    {e.changedBy ?? "System"}
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
