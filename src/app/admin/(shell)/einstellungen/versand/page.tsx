import type { Metadata } from "next";
import Link from "next/link";
import { hasRole, PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { centsToEuroInput, gramsToKgInput } from "@/lib/admin/content/input";
import {
  deleteRateAction,
  deleteZoneAction,
  saveRateAction,
  saveZoneAction,
  toggleZoneAction,
} from "@/lib/admin/settings/actions";
import { shippingPreview } from "@/lib/admin/settings/overview";
import {
  listShippingZones,
  type ShippingRateView,
  type ShippingZoneView,
} from "@/lib/admin/settings/shipping";
import { NoAccess } from "@/components/admin/NoAccess";
import { Hint, InfoRow, ReadOnlyNotice } from "@/components/admin/content/parts";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { SwitchAction } from "@/components/admin/content/SwitchAction";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { Drawer } from "@/components/admin/ui/Drawer";
import { Checkbox, Field, Select } from "@/components/admin/ui/fields";
import { formatMoney } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Versand" };

const PATH = "/admin/einstellungen/versand";

const DHL_SERVICES = [
  { value: "V01PAK", label: "DHL Paket (V01PAK)" },
  { value: "V53WPAK", label: "DHL Paket International (V53WPAK)" },
  { value: "V62WP", label: "Warenpost (V62WP)" },
];

function weight(r: ShippingRateView) {
  if (r.minWeightGrams === 0 && r.maxWeightGrams == null) return "offen";
  return `${gramsToKgInput(r.minWeightGrams)} bis ${r.maxWeightGrams != null ? `${gramsToKgInput(r.maxWeightGrams)} kg` : "offen"}`;
}

/**
 * /admin/einstellungen/versand (Figma 48:3343, mobil 45:3160): Versandzonen mit Ländern und
 * Schalter, Tarife mit Preis, Freigrenze, Gewicht und Lieferzeit. Deutschland aktiv, Österreich
 * vorbereitet und abgeschaltet (Briefing 13). Berechnung in src/lib/pricing/shipping.ts.
 */
export default async function ShippingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) return <NoAccess />;
  const canEdit = PERMISSIONS.editSettings(session);
  const sp = await searchParams;
  const zones = await listShippingZones();
  const preview = await shippingPreview(zones).catch(() => null);
  const zoneParam = firstParam(sp.zone);
  const rateParam = firstParam(sp.tarif);
  const allRates = zones.flatMap((z) => z.rates);
  const rate =
    rateParam && rateParam !== "neu" ? (allRates.find((r) => r.id === rateParam) ?? null) : null;
  const rateZone = zones.find((z) => z.id === (rate?.zoneId ?? zoneParam)) ?? null;
  const rateOpen = Boolean(rateZone && (rate || rateParam === "neu"));
  const zone =
    !rateParam && zoneParam && zoneParam !== "neu"
      ? (zones.find((z) => z.id === zoneParam) ?? null)
      : null;
  const zoneOpen = !rateParam && (zoneParam === "neu" || Boolean(zone));
  const closeHref = withParams(PATH, sp, { zone: null, tarif: null });

  const zoneCard = (z: ShippingZoneView) => (
    <Card key={z.id} flush>
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <span className="text-admin-text-2 mt-1">
          <Icon name="ort" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold">{z.name}</h2>
          <p className="text-admin-text-2 text-[13px]">
            Länder: {z.countryCodes.join(", ")}
            {!z.isEnabled ? " · vorbereitet, abgeschaltet" : ""}
          </p>
          <Link
            href={withParams(PATH, {}, { zone: z.id })}
            className={`${cardActionClass} inline-flex min-h-11 items-center md:min-h-0`}
          >
            Zone bearbeiten
          </Link>
        </div>
        {z.isEnabled ? <Badge tone="green">Aktiv</Badge> : <Badge tone="gray">Aus</Badge>}
        {canEdit ? (
          <SwitchAction
            action={toggleZoneAction}
            fields={{ id: z.id }}
            checked={z.isEnabled}
            label={`Versandzone ${z.name} aktiv`}
          />
        ) : null}
      </div>
      <div className="px-4">
        <Table
          caption={`Tarife ${z.name}`}
          rows={z.rates}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "tarif",
              header: "Tarif",
              cell: (r) => (
                <span className="flex items-center gap-2 font-medium">
                  {r.name}
                  {!r.isEnabled ? (
                    <Badge tone="gray" hollow>
                      aus
                    </Badge>
                  ) : null}
                </span>
              ),
            },
            {
              key: "preis",
              header: "Preis",
              width: "90px",
              align: "right",
              cell: (r) => formatMoney(r.priceCents),
            },
            {
              key: "frei",
              header: "Frei ab",
              width: "100px",
              align: "right",
              cell: (r) =>
                r.freeAboveSubtotalCents != null ? formatMoney(r.freeAboveSubtotalCents) : "–",
            },
            { key: "gewicht", header: "Gewicht", width: "120px", hideBelowLg: true, cell: weight },
            {
              key: "lieferzeit",
              header: "Lieferzeit",
              width: "130px",
              cell: (r) => r.deliveryTimeText ?? "–",
            },
            {
              key: "dienst",
              header: "Dienst",
              width: "110px",
              hideBelowLg: true,
              cell: (r) => r.service,
            },
          ]}
          rowActions={(r) => (
            <Link
              href={withParams(PATH, {}, { tarif: r.id })}
              className={`${cardActionClass} inline-flex min-h-11 items-center`}
              aria-label={`Tarif ${r.name} bearbeiten`}
            >
              {canEdit ? "Bearbeiten" : "Ansehen"}
            </Link>
          )}
          renderCard={(r) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <Icon name="lkw" size={18} /> {r.name}
                </span>
                <span className="font-semibold">{formatMoney(r.priceCents)}</span>
              </div>
              <p className="text-admin-text-2 text-[13px]">
                {r.freeAboveSubtotalCents != null
                  ? `Versandkostenfrei ab ${formatMoney(r.freeAboveSubtotalCents)} Warenwert (nach Rabatt, ohne Pfand)`
                  : "Keine Freigrenze"}
              </p>
              <p className="text-admin-text-2 text-[13px]">
                Gewicht {weight(r)} · {r.deliveryTimeText ?? "ohne Lieferzeit"}
              </p>
              <Link
                href={withParams(PATH, {}, { tarif: r.id })}
                className={`${cardActionClass} inline-flex min-h-11 items-center`}
              >
                {canEdit ? "Tarif bearbeiten" : "Ansehen"}
              </Link>
            </div>
          )}
          empty={<p className="text-admin-text-2 p-4 text-[14px]">Noch kein Tarif.</p>}
        />
      </div>
      <div className="px-4 pt-2 pb-4">
        <p className="text-admin-text-2 text-[12px]">
          „Frei ab“ rechnet auf den Warenwert nach Rabatt, ohne Pfand. Bei mehreren passenden
          Tarifen gewinnt der günstigste.
        </p>
        {canEdit ? (
          <Link
            href={withParams(PATH, {}, { tarif: "neu", zone: z.id })}
            className={`${cardActionClass} mt-2 inline-flex min-h-11 items-center gap-1 md:min-h-0`}
          >
            <Icon name="plus" size={16} /> Tarif hinzufügen
          </Link>
        ) : null}
      </div>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Versand"
        description="Versandzonen und Tarife für Checkout und DHL-Labels"
        actions={
          canEdit ? (
            <ButtonLink href={withParams(PATH, {}, { zone: "neu" })} icon="plus">
              Zone hinzufügen
            </ButtonLink>
          ) : null
        }
      />
      {!canEdit ? <ReadOnlyNotice what="Einstellungen" /> : null}
      <div className="flex flex-col gap-4">
        {zones.map(zoneCard)}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card title="Vorschau im Warenkorb" description="Beispiel mit den aktuellen Tarifen">
            {preview ? (
              <dl>
                <InfoRow label={preview.label}>{formatMoney(preview.priceCents)}</InfoRow>
                <InfoRow label="davon Pfand">{formatMoney(preview.depositCents)}</InfoRow>
                <InfoRow label="Warenwert ohne Pfand">{formatMoney(preview.goodsCents)}</InfoRow>
                <InfoRow label={`Versand ${preview.rateName ?? ""}`}>
                  {preview.free ? "kostenlos" : formatMoney(preview.shippingCents)}
                </InfoRow>
                <InfoRow label="Bis versandkostenfrei">{formatMoney(preview.toFreeCents)}</InfoRow>
              </dl>
            ) : (
              <p className="text-admin-text-2 text-[14px]">Kein Beispiel verfügbar.</p>
            )}
          </Card>
          <Card title="Pfand und Gewicht">
            <dl>
              <InfoRow label="Pfand je Dose">getrennt vom Preis (H22)</InfoRow>
              <InfoRow label="Pfand in der Freigrenze">zählt nicht mit</InfoRow>
              <InfoRow label="Paket maximal (DHL)">31,5 kg</InfoRow>
              <InfoRow label="Gewicht je Dose">offen (C3)</InfoRow>
            </dl>
          </Card>
        </div>
        <Hint>
          Ohne echte Gewichte (Frage C3) rechnen Checkout und DHL-Label nur mit der Preisregel.
          Änderungen gelten sofort für Warenkorb, Checkout und die Versandschwelle auf den
          Produktseiten.
        </Hint>
      </div>

      <Drawer
        open={zoneOpen}
        closeHref={closeHref}
        title={zone ? "Versandzone bearbeiten" : "Neue Versandzone"}
        width="md"
      >
        {zoneOpen ? (
          <div className="flex flex-col gap-6 p-5">
            <ActionForm action={saveZoneAction} resetOnSuccess={false}>
              {zone ? <input type="hidden" name="id" value={zone.id} /> : null}
              <input type="hidden" name="position" value={zone?.position ?? zones.length} />
              <fieldset disabled={!canEdit} className="flex flex-col gap-4">
                <Field
                  name="name"
                  label="Name"
                  defaultValue={zone?.name ?? ""}
                  placeholder="Österreich"
                  required
                />
                <Field
                  name="code"
                  label="Kurzname"
                  defaultValue={zone?.code ?? ""}
                  placeholder="at"
                  required
                />
                <Field
                  name="countryCodes"
                  label="Länder"
                  defaultValue={zone?.countryCodes.join(", ") ?? ""}
                  placeholder="AT"
                  hint="Ländercodes mit zwei Buchstaben, durch Komma getrennt."
                  required
                />
                <Checkbox
                  name="isEnabled"
                  label="Aktiv"
                  description="Neue Länder erst nach Prüfung von Rechtstexten, Steuern und DHL-Produkt aktivieren."
                  defaultChecked={zone?.isEnabled ?? false}
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
            {canEdit && zone && !zone.isEnabled ? (
              <div className="border-admin-rahmen border-t pt-4">
                <InlineAction
                  action={deleteZoneAction}
                  fields={{ id: zone.id }}
                  label="Zone löschen"
                  variant="text"
                  confirm={{
                    title: `${zone.name} löschen?`,
                    description: "Die Zone und ihre Tarife werden entfernt.",
                    confirmLabel: "Löschen",
                    danger: true,
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={rateOpen}
        closeHref={closeHref}
        title={rate ? `Tarif bearbeiten: ${rate.name}` : "Neuer Tarif"}
        description={rateZone?.name}
        width="md"
      >
        {rateOpen && rateZone ? (
          <div className="flex flex-col gap-6 p-5">
            <ActionForm action={saveRateAction} resetOnSuccess={false}>
              {rate ? <input type="hidden" name="id" value={rate.id} /> : null}
              <input type="hidden" name="zoneId" value={rateZone.id} />
              <input
                type="hidden"
                name="position"
                value={rate?.position ?? rateZone.rates.length}
              />
              <fieldset disabled={!canEdit} className="flex flex-col gap-4">
                <Field
                  name="name"
                  label="Name im Checkout"
                  defaultValue={rate?.name ?? ""}
                  placeholder="DHL Paket"
                  required
                />
                <Field
                  name="description"
                  label="Beschreibung (intern)"
                  defaultValue={rate?.description ?? ""}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    name="price"
                    label="Preis"
                    suffix="€"
                    inputMode="decimal"
                    defaultValue={centsToEuroInput(rate?.priceCents ?? null)}
                    required
                  />
                  <Field
                    name="freeAbove"
                    label="Frei ab"
                    suffix="€"
                    inputMode="decimal"
                    defaultValue={centsToEuroInput(rate?.freeAboveSubtotalCents ?? null)}
                    hint="Leer: keine Freigrenze"
                  />
                  <Field
                    name="minSubtotal"
                    label="Warenwert ab"
                    suffix="€"
                    inputMode="decimal"
                    defaultValue={centsToEuroInput(rate?.minSubtotalCents ?? 0)}
                  />
                  <Field
                    name="maxSubtotal"
                    label="Warenwert bis"
                    suffix="€"
                    inputMode="decimal"
                    defaultValue={centsToEuroInput(rate?.maxSubtotalCents ?? null)}
                    hint="Leer: offen"
                  />
                  <Field
                    name="minWeight"
                    label="Gewicht ab"
                    suffix="kg"
                    inputMode="decimal"
                    defaultValue={gramsToKgInput(rate?.minWeightGrams ?? 0)}
                  />
                  <Field
                    name="maxWeight"
                    label="Gewicht bis"
                    suffix="kg"
                    inputMode="decimal"
                    defaultValue={gramsToKgInput(rate?.maxWeightGrams ?? null)}
                    hint="Leer: offen"
                  />
                </div>
                <Field
                  name="deliveryTimeText"
                  label="Lieferzeit"
                  defaultValue={rate?.deliveryTimeText ?? ""}
                  placeholder="3–5 Werktage"
                  hint="Erscheint im Checkout, auf Produktseiten und in der Bestellbestätigung."
                />
                <Select
                  name="service"
                  label="Versanddienst"
                  defaultValue={rate?.service ?? "V01PAK"}
                  options={DHL_SERVICES}
                />
                <Select
                  name="taxClass"
                  label="Steuer auf Versand"
                  defaultValue={rate?.taxClass ?? "standard"}
                  options={[
                    { value: "standard", label: "Regelsatz (19 %)" },
                    { value: "reduced", label: "Ermäßigt (7 %)" },
                  ]}
                />
                <Checkbox name="isEnabled" label="Aktiv" defaultChecked={rate?.isEnabled ?? true} />
                <Hint>
                  Gewichte der Varianten fehlen noch (Frage C3). Bis dahin greift nur die
                  Preisregel.
                </Hint>
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
            {canEdit && rate ? (
              <div className="border-admin-rahmen border-t pt-4">
                <InlineAction
                  action={deleteRateAction}
                  fields={{ id: rate.id }}
                  label="Tarif löschen"
                  variant="text"
                  confirm={{
                    title: `Tarif ${rate.name} löschen?`,
                    description:
                      "Mindestens eine aktive Zone mit aktivem Tarif muss bleiben, sonst kann niemand bestellen.",
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
