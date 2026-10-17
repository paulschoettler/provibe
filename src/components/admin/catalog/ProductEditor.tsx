import Link from "next/link";
import type { ReactNode } from "react";
import {
  archiveProductAction,
  checkProductHandleAction,
  duplicateProductAction,
  imageOpAction,
  removeVariantAction,
  saveProductFormAction,
  uploadImageFormAction,
} from "@/lib/admin/products/actions";
import type {
  CollectionMembership,
  ComponentCandidate,
  PriceHistoryEntry,
  ProductEditData,
} from "@/lib/admin/products/data";
import type { ProductLine } from "@/lib/admin/products/lines";
import { PRODUCT_LINE_LABELS } from "@/lib/admin/products/lines";
import type { ProductInput, VariantInput } from "@/lib/admin/products/rules";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Badge, StatusBadge } from "@/components/admin/ui/Badge";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { formatDateTime } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SaveBar } from "@/components/admin/ui/SaveBar";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { HandleField } from "./HandleField";
import { ImageManager } from "./ImageManager";
import {
  BundleCard,
  CollectionsCard,
  DepositCard,
  GeneralCard,
  LmivCard,
  PriceHistoryCard,
  ShippingCard,
  StatusCard,
  TaxCard,
  VariantsCard,
} from "./product-cards";
import { SeoFields } from "./SeoFields";
import { StateNotice } from "./StateError";

/**
 * Produkt-Editor (Figma 40:13025 Desktop, 41:13346 Mobil): links Allgemein, Bilder, Varianten,
 * Bundle-Komponenten, LMIV, SEO und Preis-Historie, rechts Status und Typ, Kollektionen, Pfand und
 * Grundpreis, Steuer, Versand. Ein Formular für alles, was gemeinsam gespeichert wird; Bilder,
 * Duplizieren, Archivieren und Variante entfernen laufen über eigene Formulare außerhalb.
 * Ohne Schreibrecht ist alles schreibgeschützt (fieldset disabled).
 */

export const FORM_ID = "produkt-form";
const IMAGE_OP_FORM = "bild-aktion";
const UPLOAD_FORM = "bild-upload";
const REMOVE_VARIANT_FORM = "variante-entfernen";

export interface ProductEditorProps {
  mode: "edit" | "new";
  canEdit: boolean;
  input: ProductInput;
  variants: VariantInput[];
  line: ProductLine;
  data: ProductEditData | null;
  collections: CollectionMembership[];
  taxClasses: { value: string; label: string; rateBp: number }[];
  candidates: ComponentCandidate[];
  stock: Record<string, number>;
  depositByVariant: Record<string, number>;
  priceHistory: PriceHistoryEntry[];
  /** Summe verfügbarer Bestand (nur geführte Varianten) für die Kopfzeile */
  availableTotal: number | null;
  updatedBy: string | null;
}

export function ProductEditor(props: ProductEditorProps) {
  const { mode, canEdit, input, variants, line, data } = props;
  const isNew = mode === "new";
  const p = data?.product;
  const isBundle = line === "bundle";
  const title = isNew ? "Produkt hinzufügen" : input.title;
  const taxLabel = (() => {
    const t = props.taxClasses.find((x) => x.value === (input.taxClass ?? "standard"));
    return t ? `${(t.rateBp / 100).toLocaleString("de-DE")} %` : "19 %";
  })();
  const plainDescription = (input.descriptionHtml ?? "").replace(/<[^>]*>/g, " ");

  return (
    <>
      <PageHeader
        title={title}
        backHref="/admin/produkte"
        backLabel="Zurück zu den Produkten"
        meta={
          p ? (
            <>
              <StatusBadge kind="record" value={p.status} />
              <Badge tone="gray" noDot>
                {PRODUCT_LINE_LABELS[line]}
              </Badge>
            </>
          ) : null
        }
        actions={
          p ? (
            <>
              <Link
                href={`/products/${p.handle}`}
                target="_blank"
                rel="noopener"
                className={buttonClasses("text", "md")}
              >
                <Icon name="extern" size={16} />
                Im Shop ansehen
              </Link>
              {canEdit ? (
                <>
                  <form action={duplicateProductAction}>
                    <input type="hidden" name="productId" value={p.id} />
                    <SubmitButton variant="secondary" icon="kopieren" pendingLabel="Wird kopiert …">
                      Duplizieren
                    </SubmitButton>
                  </form>
                  {p.status !== "archived" ? (
                    <form action={archiveProductAction}>
                      <input type="hidden" name="productId" value={p.id} />
                      <ConfirmSubmit
                        icon="archivieren"
                        confirm={`„${input.title}“ archivieren? Das Produkt verschwindet aus dem Shop. ${p.status === "active" ? "Lege danach bei Bedarf eine Weiterleitung an." : ""}`}
                      >
                        Archivieren
                      </ConfirmSubmit>
                    </form>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null
        }
      />

      {p ? (
        <p className="text-admin-text-2 -mt-3 mb-4 text-[13px]">
          {variants.length} {variants.length === 1 ? "Variante" : "Varianten"}
          {props.availableTotal != null
            ? ` · ${props.availableTotal} verfügbar`
            : " · Bestand nicht geführt"}
          {` · zuletzt geändert ${formatDateTime(p.updatedAt)}`}
          {props.updatedBy ? ` von ${props.updatedBy}` : ""}
          {p.status !== "active" ? " · im Shop nicht sichtbar" : ""}
        </p>
      ) : null}

      {!canEdit ? (
        <p className="rounded-admin-feld bg-admin-blau-hell mb-4 p-3 text-[14px]">
          Nur Ansicht: Produkte bearbeiten dürfen Owner und Admin.
        </p>
      ) : null}

      <ActionForm
        id={FORM_ID}
        action={saveProductFormAction}
        resetOnSuccess={false}
        aria-label={isNew ? "Neues Produkt" : `Produkt ${input.title} bearbeiten`}
      >
        <StateNotice />
        <fieldset disabled={!canEdit} className="contents">
          {p ? <input type="hidden" name="id" value={p.id} /> : null}
          <input type="hidden" name="locale" value={data?.locale ?? "de"} />
          <input type="hidden" name="vendor" value={input.vendor ?? "provibe"} />
          <input
            type="hidden"
            name="attributesJson"
            value={JSON.stringify(input.attributes ?? {})}
          />
          <input type="hidden" name="faqJson" value={JSON.stringify(input.faq ?? [])} />
          <input type="hidden" name="seo.ogImagePath" value={input.seo?.ogImagePath ?? ""} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-4">
              <GeneralCard input={input} />

              {p && data ? (
                <Card
                  title="Bilder"
                  description="Erstes Bild ist das Hauptbild. Reihenfolge per Ziehen oder mit den Pfeilen ändern, Alt-Text je Bild pflegen."
                >
                  <ImageManager
                    productId={p.id}
                    productTitle={input.title}
                    images={data.images.map((i) => ({
                      id: i.id,
                      url: i.url,
                      alt: i.alt,
                      width: i.width,
                      height: i.height,
                    }))}
                    canEdit={canEdit}
                    opFormId={IMAGE_OP_FORM}
                    uploadFormId={UPLOAD_FORM}
                  />
                </Card>
              ) : (
                <Hint>Bilder, Bundle-Komponenten und Preis-Historie gibt es nach dem Anlegen.</Hint>
              )}

              <VariantsCard
                variants={variants}
                views={data?.variants ?? []}
                isBundle={isBundle}
                taxLabel={taxLabel}
                depositPerUnit={input.depositCentsPerUnit ?? 0}
                removeFormId={REMOVE_VARIANT_FORM}
                isNew={isNew}
                canEdit={canEdit}
                unitLabel={input.unitLabel ?? "Stück"}
              />

              {isBundle && data ? (
                <BundleCard
                  views={data.variants}
                  candidates={props.candidates}
                  stock={props.stock}
                  depositByVariant={props.depositByVariant}
                  canEdit={canEdit}
                />
              ) : null}

              <LmivCard input={input} isFood={Boolean(input.isFood)} />

              <Card title="Suchmaschinen (SEO)">
                <div className="flex flex-col gap-4">
                  <SeoFields
                    defaultTitle={input.seo?.title ?? ""}
                    defaultDescription={input.seo?.description ?? ""}
                    fallbackTitle={input.title}
                    fallbackDescription={plainDescription}
                    pathPrefix="products"
                    handle={input.handle ?? ""}
                  />
                  <HandleField
                    defaultValue={input.handle ?? ""}
                    prefix="/products/"
                    exceptId={p?.id}
                    check={checkProductHandleAction}
                    followTitle={isNew}
                    note={
                      p
                        ? `provibe-drinks.de/products/${p.handle}${p.publishedAt ? " · Bei Änderung leitet der alte Pfad automatisch weiter." : ""}`
                        : undefined
                    }
                  />
                </div>
              </Card>

              {p && data ? (
                <PriceHistoryCard entries={props.priceHistory} views={data.variants} />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <StatusCard input={input} line={line} isNew={isNew} />
              <CollectionsCard collections={props.collections} />
              <DepositCard input={input} variants={variants} isBundle={isBundle} />
              <TaxCard input={input} taxClasses={props.taxClasses} />
              <ShippingCard input={input} />
            </div>
          </div>
        </fieldset>
        {canEdit ? (
          <SaveBar
            formId={FORM_ID}
            alwaysVisible={isNew}
            saveLabel={isNew ? "Als Entwurf anlegen" : "Speichern"}
          />
        ) : null}
      </ActionForm>

      {/* Eigene Formulare außerhalb des Editors (keine verschachtelten Formulare) */}
      {p && canEdit ? (
        <>
          <form id={IMAGE_OP_FORM} action={imageOpAction} hidden>
            <input type="hidden" name="productId" value={p.id} />
          </form>
          <form id={UPLOAD_FORM} action={uploadImageFormAction} hidden>
            <input type="hidden" name="productId" value={p.id} />
          </form>
          <form id={REMOVE_VARIANT_FORM} action={removeVariantAction} hidden>
            <input type="hidden" name="productId" value={p.id} />
          </form>
        </>
      ) : null}
    </>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-admin-karte border-admin-rahmen bg-admin-karte text-admin-text-2 border border-dashed p-4 text-[14px]">
      {children}
    </p>
  );
}
