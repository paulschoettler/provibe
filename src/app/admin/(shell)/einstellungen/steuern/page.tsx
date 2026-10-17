import type { Metadata } from "next";
import Link from "next/link";
import { hasRole, PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { deleteTaxRateAction, saveTaxRateAction } from "@/lib/admin/settings/actions";
import { taxClassesByProductType } from "@/lib/admin/settings/overview";
import { listTaxRates, rateLabel, type TaxRateView } from "@/lib/admin/settings/shipping";
import { NoAccess } from "@/components/admin/NoAccess";
import { Hint, ReadOnlyNotice } from "@/components/admin/content/parts";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { Drawer } from "@/components/admin/ui/Drawer";
import { Field, Select } from "@/components/admin/ui/fields";
import { formatDate } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CardRow, Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Steuern" };

const PATH = "/admin/einstellungen/steuern";
const CLASS_LABELS: Record<string, string> = {
  standard: "Regelsatz",
  reduced: "Ermäßigt",
  zero: "Steuerfrei",
};

/**
 * /admin/einstellungen/steuern: Steuersätze je Land und Steuerklasse (tax_rates) und welche
 * Produktarten welche Klasse nutzen (products.tax_class). Satzänderungen als neuer Satz mit
 * "gültig ab"; Bestellungen behalten ihren Satz als Snapshot.
 */
export default async function TaxSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) return <NoAccess />;
  const canEdit = PERMISSIONS.editSettings(session);
  const sp = await searchParams;
  const [rates, groups] = await Promise.all([
    listTaxRates(),
    taxClassesByProductType().catch(() => []),
  ]);
  const satz = firstParam(sp.satz);
  const editing = satz && satz !== "neu" ? (rates.find((r) => r.id === satz) ?? null) : null;
  const open = satz === "neu" || Boolean(editing);
  const closeHref = withParams(PATH, sp, { satz: null });
  const today = new Date().toISOString().slice(0, 10);
  const deRate = (cls: string) =>
    rates.find(
      (r) =>
        r.countryCode === "DE" &&
        r.taxClass === cls &&
        r.validFrom <= today &&
        (!r.validTo || r.validTo > today),
    );

  return (
    <>
      <PageHeader
        title="Steuern"
        description="Umsatzsteuersätze je Land und Steuerklasse"
        actions={
          canEdit ? (
            <ButtonLink href={withParams(PATH, {}, { satz: "neu" })} icon="plus">
              Satz anlegen
            </ButtonLink>
          ) : null
        }
      />
      {!canEdit ? <ReadOnlyNotice what="Einstellungen" /> : null}
      <div className="flex flex-col gap-4">
        <Hint>
          Alle Produkte rechnen mit dem Regelsatz 19 % (Eistee als Getränk, Shirt, Becher). 7 %
          trifft nach heutigem Stand nicht zu (H2, Frage an die Steuerberatung). Pfand folgt dem
          Steuersatz der Ware, also 19 %. Versand folgt der Steuerklasse des Tarifs.
        </Hint>
        <Table
          caption="Steuersätze"
          rows={rates}
          rowKey={(r) => r.id}
          columns={[
            { key: "land", header: "Land", width: "80px", cell: (r) => r.countryCode },
            {
              key: "klasse",
              header: "Klasse",
              width: "130px",
              cell: (r) => CLASS_LABELS[r.taxClass] ?? r.taxClass,
            },
            {
              key: "satz",
              header: "Satz",
              width: "80px",
              align: "right",
              cell: (r) => r.rateLabel,
            },
            { key: "name", header: "Name", cell: (r) => r.name },
            {
              key: "gueltig",
              header: "Gültig",
              width: "190px",
              cell: (r) =>
                `ab ${formatDate(r.validFrom)}${r.validTo ? ` bis ${formatDate(r.validTo)}` : ""}`,
            },
          ]}
          rowActions={(r: TaxRateView) => (
            <Link
              href={withParams(PATH, {}, { satz: r.id })}
              className={`${cardActionClass} inline-flex min-h-11 items-center`}
              aria-label={`${r.name} bearbeiten`}
            >
              {canEdit ? "Bearbeiten" : "Ansehen"}
            </Link>
          )}
          renderCard={(r) => (
            <div>
              <CardRow
                primary={r.name}
                aside={r.rateLabel}
                secondary={`${r.countryCode} · ${CLASS_LABELS[r.taxClass] ?? r.taxClass}`}
                secondaryAside={`ab ${formatDate(r.validFrom)}`}
              />
              <Link
                href={withParams(PATH, {}, { satz: r.id })}
                className={`${cardActionClass} inline-flex min-h-11 items-center`}
              >
                {canEdit ? "Bearbeiten" : "Ansehen"}
              </Link>
            </div>
          )}
        />
        <Card
          title="Sätze je Produktart"
          description="Steuerklasse steht am Produkt (Produkt-Editor)"
          flush
        >
          <ul>
            {groups.map((g) => (
              <li
                key={`${g.productType}-${g.taxClass}`}
                className="border-admin-rahmen flex items-center justify-between gap-3 border-t px-4 py-3 text-[14px]"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{g.productType}</span>
                  <span className="text-admin-text-2 block truncate text-[12px]">
                    {g.count} {g.count === 1 ? "Produkt" : "Produkte"}, zum Beispiel{" "}
                    {g.examples.join(", ")}
                  </span>
                </span>
                <Badge tone={g.taxClass === "standard" ? "accent" : "blue"} noDot>
                  {CLASS_LABELS[g.taxClass] ?? g.taxClass}{" "}
                  {deRate(g.taxClass) ? rateLabel(deRate(g.taxClass)!.rateBp) : ""}
                </Badge>
              </li>
            ))}
            <li className="border-admin-rahmen flex items-center justify-between gap-3 border-t px-4 py-3 text-[14px]">
              <span className="font-medium">Pfand</span>
              <Badge tone="accent" noDot>
                wie die Ware {deRate("standard") ? rateLabel(deRate("standard")!.rateBp) : ""}
              </Badge>
            </li>
          </ul>
        </Card>
      </div>

      <Drawer
        open={open}
        closeHref={closeHref}
        title={editing ? "Steuersatz bearbeiten" : "Neuer Steuersatz"}
        width="md"
      >
        {open ? (
          <div className="flex flex-col gap-6 p-5">
            <ActionForm action={saveTaxRateAction} resetOnSuccess={false}>
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <fieldset disabled={!canEdit} className="flex flex-col gap-4">
                <Field
                  name="name"
                  label="Name"
                  defaultValue={editing?.name ?? ""}
                  placeholder="Deutschland 19 %"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    name="countryCode"
                    label="Land"
                    defaultValue={editing?.countryCode ?? "DE"}
                    maxLength={2}
                    required
                  />
                  <Select
                    name="taxClass"
                    label="Steuerklasse"
                    defaultValue={editing?.taxClass ?? "standard"}
                    options={Object.entries(CLASS_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                  <Field
                    name="rate"
                    label="Satz"
                    suffix="%"
                    inputMode="decimal"
                    defaultValue={editing ? String(editing.rateBp / 100).replace(".", ",") : ""}
                    required
                  />
                  <span />
                  <Field
                    name="validFrom"
                    label="Gültig ab"
                    type="date"
                    defaultValue={editing?.validFrom ?? today}
                    required
                  />
                  <Field
                    name="validTo"
                    label="Gültig bis"
                    type="date"
                    defaultValue={editing?.validTo ?? ""}
                    hint="Leer: unbefristet"
                  />
                </div>
                <Hint tone="info">
                  Für eine Satzänderung lieber einen neuen Satz mit „gültig ab“ anlegen und den
                  alten befristen, statt ihn zu überschreiben. Rechnungen in Lexware nutzen den Satz
                  je Position.
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
            {canEdit && editing ? (
              <div className="border-admin-rahmen border-t pt-4">
                <InlineAction
                  action={deleteTaxRateAction}
                  fields={{ id: editing.id }}
                  label="Satz löschen"
                  variant="text"
                  confirm={{
                    title: `${editing.name} löschen?`,
                    description: "Der letzte Satz einer Steuerklasse lässt sich nicht löschen.",
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
