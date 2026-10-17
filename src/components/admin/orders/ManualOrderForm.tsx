"use client";

import { useMemo, useState, useTransition } from "react";
import { createManualOrderAction, searchCustomersAction } from "@/lib/admin/orders/actions";
import type { CustomerHit, OrderableVariant, ShippingRateOption } from "@/lib/admin/orders/lookup";
import {
  ActionForm,
  ActionFormMessage,
  useActionFormState,
} from "@/components/admin/ui/ActionForm";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import {
  Checkbox,
  Field,
  inputClasses,
  RadioCards,
  Select,
  Textarea,
} from "@/components/admin/ui/fields";
import { formatMoney } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { AddressEditor } from "./AddressFields";

/**
 * Manuelle Bestellung (/admin/bestellungen/neu): Kunde suchen oder neu, Positionen aus dem Katalog,
 * Versandart, Rabatt als Betrag mit Grund, Zahlungsweise, Notizen. Die angezeigten Preise sind nur
 * eine Orientierung aus dem Katalog; den verbindlichen Betrag rechnet createManualOrder serverseitig
 * mit der Preislogik des Checkouts. Ohne JavaScript stehen drei Positionszeilen bereit.
 */
interface Line {
  key: number;
  variantId: string;
  quantity: number;
}

export function ManualOrderForm({
  variants,
  rates,
  testForced,
}: {
  variants: OrderableVariant[];
  rates: ShippingRateOption[];
  testForced: boolean;
}) {
  return (
    <ActionForm action={createManualOrderAction} hideMessage resetOnSuccess={false}>
      <ManualOrderFields variants={variants} rates={rates} testForced={testForced} />
    </ActionForm>
  );
}

function ManualOrderFields({
  variants,
  rates,
  testForced,
}: {
  variants: OrderableVariant[];
  rates: ShippingRateOption[];
  testForced: boolean;
}) {
  const state = useActionFormState();
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [lines, setLines] = useState<Line[]>([
    { key: 1, variantId: "", quantity: 1 },
    { key: 2, variantId: "", quantity: 1 },
    { key: 3, variantId: "", quantity: 1 },
  ]);
  const [formKey, setFormKey] = useState(0);
  // React setzt das Formular nach jeder Action zurück. Nach einem Fehler die Felder neu einhängen
  // (Zustand der Positionen bleibt hier oben erhalten, Feldwerte kommen über values zurück)
  const [seen, setSeen] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "error") setVersion((v) => v + 1);
  }

  const byId = useMemo(() => new Map(variants.map((v) => [v.variantId, v])), [variants]);

  const estimate = lines.reduce((s, l) => {
    const v = byId.get(l.variantId);
    return v ? s + l.quantity * v.priceCents : s;
  }, 0);
  const deposit = lines.reduce((s, l) => {
    const v = byId.get(l.variantId);
    return v ? s + l.quantity * v.depositCents : s;
  }, 0);

  const runSearch = () => {
    const q = query.trim();
    if (q.length < 2) return;
    startSearch(async () => setHits(await searchCustomersAction(q)));
  };
  const choose = (hit: CustomerHit | null) => {
    setCustomer(hit);
    setHits(null);
    setFormKey((k) => k + 1);
  };

  const groups = new Map<string, OrderableVariant[]>();
  for (const v of variants) groups.set(v.productTitle, [...(groups.get(v.productTitle) ?? []), v]);
  const variantLabel = (v: OrderableVariant) =>
    `${v.variantTitle}${v.sku ? ` (${v.sku})` : ""} · ${formatMoney(v.priceCents)}${v.depositCents ? ` zzgl. ${formatMoney(v.depositCents)} Pfand` : ""}`;

  return (
    <div key={version} className="grid gap-4 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <ActionFormMessage />
        <Card
          title="Positionen"
          description="Aus dem Katalog, aktive Varianten. Preise rechnet der Server."
        >
          <div className="flex flex-col gap-3">
            {lines.map((line, index) => (
              <div key={line.key} className="grid grid-cols-[1fr_88px_44px] items-end gap-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor={`line-${line.key}`}
                    className={index === 0 ? "text-[13px] font-medium" : "sr-only"}
                  >
                    Artikel {index + 1}
                  </label>
                  <div className="relative">
                    <select
                      id={`line-${line.key}`}
                      name="line_variant"
                      value={line.variantId}
                      onChange={(e) =>
                        setLines((ls) =>
                          ls.map((l) =>
                            l.key === line.key ? { ...l, variantId: e.target.value } : l,
                          ),
                        )
                      }
                      className={inputClasses(
                        Boolean(state.fieldErrors?.lines && index === 0),
                        "appearance-none pr-9",
                      )}
                    >
                      <option value="">Artikel wählen</option>
                      {[...groups].map(([title, list]) => (
                        <optgroup key={title} label={title}>
                          {list.map((v) => (
                            <option key={v.variantId} value={v.variantId}>
                              {variantLabel(v)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <span className="text-admin-text-2 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                      <Icon name="chevron-unten" size={16} />
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`qty-${line.key}`}
                    className={index === 0 ? "text-[13px] font-medium" : "sr-only"}
                  >
                    Menge {index + 1}
                  </label>
                  <input
                    id={`qty-${line.key}`}
                    name="line_qty"
                    type="number"
                    min={1}
                    max={999}
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((l) =>
                          l.key === line.key
                            ? {
                                ...l,
                                quantity: Math.max(
                                  1,
                                  Math.min(999, Math.trunc(Number(e.target.value) || 1)),
                                ),
                              }
                            : l,
                        ),
                      )
                    }
                    className={inputClasses(false, "text-right tabular-nums")}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Position ${index + 1} entfernen`}
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                  className="rounded-admin-feld hover:bg-admin-flaeche flex size-11 items-center justify-center disabled:opacity-40 md:size-10"
                >
                  <Icon name="schliessen" size={18} />
                </button>
              </div>
            ))}
            {state.fieldErrors?.lines ? (
              <p className="text-admin-rot text-[13px]" role="alert">
                {state.fieldErrors.lines}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                icon="plus"
                size="sm"
                onClick={() =>
                  setLines((ls) => [
                    ...ls,
                    { key: Math.max(0, ...ls.map((l) => l.key)) + 1, variantId: "", quantity: 1 },
                  ])
                }
              >
                Position hinzufügen
              </Button>
              <p className="text-admin-text-2 text-[13px]">
                Katalog: {formatMoney(estimate)}
                {deposit > 0 ? ` zzgl. ${formatMoney(deposit)} Pfand` : ""} (ohne Versand und
                Rabatt)
              </p>
            </div>
          </div>
        </Card>

        <Card title="Kunde" description="Bestehenden Kunden suchen oder Daten neu eingeben">
          <div className="flex flex-col gap-3">
            {customer ? (
              <div className="rounded-admin-feld border-admin-rahmen bg-admin-flaeche flex items-start gap-3 border p-3">
                <Icon name="kunden" size={18} />
                <div className="min-w-0 flex-1 text-[14px]">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-admin-text-2 text-[13px]">
                    {customer.email} · {customer.ordersCount} Bestellungen
                  </p>
                </div>
                <Button size="sm" variant="text" onClick={() => choose(null)}>
                  Anderer Kunde
                </Button>
                <input type="hidden" name="customerId" value={customer.id} />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label htmlFor="kundensuche" className="text-[13px] font-medium">
                  Kunde suchen
                </label>
                <div className="flex gap-2">
                  <input
                    id="kundensuche"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        runSearch();
                      }
                    }}
                    placeholder="Name, E-Mail oder Firma"
                    className={inputClasses(false)}
                  />
                  <Button
                    onClick={runSearch}
                    disabled={searching || query.trim().length < 2}
                    icon="suche"
                  >
                    Suchen
                  </Button>
                </div>
                {hits ? (
                  hits.length === 0 ? (
                    <p className="text-admin-text-2 text-[13px]">
                      Kein Kunde gefunden. Gib die Daten unten neu ein.
                    </p>
                  ) : (
                    <ul className="rounded-admin-feld border-admin-rahmen divide-admin-rahmen divide-y border">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            onClick={() => choose(h)}
                            className="hover:bg-admin-flaeche flex min-h-11 w-full flex-col items-start px-3 py-2 text-left"
                          >
                            <span className="text-[14px] font-medium">
                              {h.name}
                              {h.company ? ` · ${h.company}` : ""}
                            </span>
                            <span className="text-admin-text-2 text-[13px]">
                              {h.email} · {h.ordersCount} Bestellungen
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </div>
            )}
            <div key={formKey} className="flex flex-col gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  name="email"
                  label="E-Mail"
                  type="email"
                  required
                  defaultValue={customer?.email ?? ""}
                  readOnly={Boolean(customer)}
                  hint={customer ? "Aus dem Kundenprofil" : "Neue Adresse legt einen Kunden an"}
                />
                <Field
                  name="phone"
                  label="Telefon (optional)"
                  type="tel"
                  defaultValue={customer?.phone ?? ""}
                />
              </div>
              <AddressEditor
                shipping={
                  customer?.lastAddress ??
                  (customer
                    ? {
                        first_name: customer.name.split(" ")[0],
                        last_name: customer.name.split(" ").slice(1).join(" "),
                        company: customer.company,
                      }
                    : null)
                }
                billing={null}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card title="Versand">
          <div className="flex flex-col gap-3">
            <Select
              name="shippingRateId"
              label="Versandart"
              placeholder="Automatisch (wie im Checkout)"
              options={rates.map((r) => ({
                value: r.id,
                label: `${r.name} · ${formatMoney(r.priceCents)}${r.freeAboveSubtotalCents ? `, frei ab ${formatMoney(r.freeAboveSubtotalCents)}` : ""}`,
              }))}
            />
            <Checkbox
              name="waiveShipping"
              label="Versandkosten erlassen"
              description="Tarifname bleibt für Lieferschein und Rechnung."
            />
          </div>
        </Card>
        <Card
          title="Rabatt"
          description="Fester Betrag auf den Warenwert, nie auf Pfand oder Versand"
        >
          <div className="flex flex-col gap-3">
            <Field
              name="discountAmount"
              label="Betrag (optional)"
              inputMode="decimal"
              suffix="€"
              placeholder="0,00"
            />
            <Field
              name="discountReason"
              label="Grund"
              placeholder="zum Beispiel Messe, Kulanz"
              maxLength={200}
            />
          </div>
        </Card>
        <Card title="Zahlung">
          <RadioCards
            name="payment"
            legend="Zahlungsweise"
            defaultValue="invoice"
            options={[
              {
                value: "invoice",
                label: "Rechnung",
                description: "Offen bis zum Zahlungseingang, Zahlungsziel 14 Tage",
              },
              {
                value: "paid",
                label: "Bereits bezahlt",
                description:
                  "Zahlungseingang wird sofort verbucht (zum Beispiel bar oder Überweisung)",
              },
            ]}
          />
        </Card>
        <Card title="Notizen">
          <div className="flex flex-col gap-3">
            <Textarea
              name="customerNote"
              label="Hinweis für den Lieferschein (optional)"
              rows={2}
              maxLength={1000}
            />
            <Textarea name="note" label="Interne Notiz (optional)" rows={2} maxLength={2000} />
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-3">
            {testForced ? <input type="hidden" name="isTest" value="on" /> : null}
            <Checkbox
              name={testForced ? "isTestAnzeige" : "isTest"}
              label="Testbestellung"
              defaultChecked
              disabled={testForced}
              description={
                testForced
                  ? "Vor dem Go-live ist jede manuelle Bestellung eine Testbestellung."
                  : "Erscheint nur im Tab Test und zählt nicht in Auswertungen."
              }
            />
            <SubmitButton block icon="plus" pendingLabel="Wird angelegt …">
              Bestellung anlegen
            </SubmitButton>
            <p className="text-admin-text-2 text-[12px]">
              Der Bestand wird sofort abgebucht. Eine Rechnung entsteht als Entwurf.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
