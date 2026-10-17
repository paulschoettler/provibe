"use client";

import { useState } from "react";
import { refundAction } from "@/lib/admin/orders/actions";
import {
  computeRefund,
  refundLineAmount,
  type RefundableItem,
} from "@/lib/admin/orders/refund-calc";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { Button } from "@/components/admin/ui/Button";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import {
  Checkbox,
  CheckboxBox,
  inputClasses,
  Select,
  Textarea,
} from "@/components/admin/ui/fields";
import { formatMoney } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { RemountOnError } from "./RemountOnError";

/**
 * Erstattung ganz oder teilweise (Figma 35:13250, mobil als Sheet 35:13523). Positionen mit Menge,
 * Versandkosten, Betrag (Vorschlag aus refund-calc, abweichend möglich bis zum erstattbaren Rest),
 * Grund, Bestand zurückbuchen, Kunden informieren. Die Vorschau rechnet mit derselben Funktion wie
 * der Server (computeRefund); verbindlich ist die Berechnung in createRefund. Zweiter Schritt:
 * Bestätigung mit Betrag und Zahlungsweg.
 */
export interface RefundDialogItem extends RefundableItem {
  variantTitle: string | null;
  unitCount: number;
}

export interface RefundDialogProps {
  orderId: string;
  orderNumber: string;
  paymentLabel: string;
  manual: boolean;
  testMode: boolean;
  items: RefundDialogItem[];
  totalCents: number;
  refundedCents: number;
  shippingCents: number;
  refundableShippingCents: number;
  shippingName: string | null;
}

const REASONS = [
  { value: "damaged", label: "Ware beschädigt angekommen" },
  { value: "missing", label: "Ware fehlt im Paket" },
  { value: "wrong", label: "Falscher Artikel geliefert" },
  { value: "withdrawal", label: "Widerruf" },
  { value: "goodwill", label: "Kulanz" },
  { value: "cancelled", label: "Storno vor Versand" },
  { value: "other", label: "Anderer Grund" },
];

function euro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function parseEuro(text: string): number | undefined {
  const v = text.replace(/\s|€/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return undefined;
  return Math.round(Number(v) * 100);
}

export function RefundDialog(props: RefundDialogProps) {
  return (
    <Dialog
      title="Erstattung"
      description={`Bestellung ${props.orderNumber} · ${props.paymentLabel}`}
      trigger={{ label: "Erstatten", icon: "erstatten", variant: "secondary" }}
      size="lg"
    >
      <RefundForm {...props} />
    </Dialog>
  );
}

function RefundForm(props: RefundDialogProps) {
  const open = (i: RefundDialogItem) => i.quantity - i.refundedQuantity;
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(props.items.map((i) => [i.id, 0])),
  );
  const [shipping, setShipping] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [touched, setTouched] = useState(false);
  const [reasonKey, setReasonKey] = useState("");
  const [restock, setRestock] = useState(true);
  const [step, setStep] = useState<"form" | "confirm">("form");

  const refundedShipping = props.shippingCents - props.refundableShippingCents;
  const lines = props.items
    .filter((i) => (qty[i.id] ?? 0) > 0)
    .map((i) => ({ orderItemId: i.id, quantity: qty[i.id] }));
  const override = touched ? parseEuro(amountText) : undefined;
  const calc = computeRefund(
    {
      totalCents: props.totalCents,
      shippingCents: props.shippingCents,
      refundedCents: props.refundedCents,
      refundedShippingCents: refundedShipping,
      items: props.items,
    },
    {
      lines,
      shippingCents: shipping ? props.refundableShippingCents : 0,
      amountCents: touched && override !== undefined ? override : undefined,
    },
  );
  const suggestedCents = calc.ok
    ? calc.value.suggestedCents
    : lines.reduce(
        (s, l) =>
          s +
          refundLineAmount(
            props.items.find((i) => i.id === l.orderItemId)!,
            l.quantity,
          ).amountCents,
        0,
      ) + (shipping ? props.refundableShippingCents : 0);
  const amountCents = calc.ok ? calc.value.amountCents : 0;
  const remaining = Math.max(0, props.totalCents - props.refundedCents);
  // Lagereinheit ist bis H24 die Variante (Pack), Bundles buchen ihre Komponenten
  const restockUnits = props.items.reduce((s, i) => s + (qty[i.id] ?? 0), 0);
  const restockText = props.items
    .filter((i) => (qty[i.id] ?? 0) > 0)
    .map((i) => `${qty[i.id] ?? 0} × ${i.title}${i.variantTitle ? ` (${i.variantTitle})` : ""}`)
    .join(", ");
  const canContinue = calc.ok && reasonKey !== "";

  return (
    <ActionForm action={refundAction} closeDialogOnSuccess hideMessage resetOnSuccess={false}>
      <RemountOnError>
        <input type="hidden" name="orderId" value={props.orderId} />
        <input type="hidden" name="suggested" value={euro(suggestedCents)} />
        <div className={step === "form" ? "" : "hidden"}>
          <DialogBody>
            <ActionFormMessage />
            <div className="rounded-admin-feld border-admin-rahmen overflow-hidden border">
              <div className="bg-admin-flaeche text-admin-text-2 flex h-10 items-center justify-between px-3 text-[13px]">
                <span>Positionen erstatten</span>
                <span>Menge</span>
              </div>
              <ul>
                {props.items.map((item) => {
                  const max = open(item);
                  const value = qty[item.id] ?? 0;
                  return (
                    <li
                      key={item.id}
                      className="border-admin-rahmen flex items-center gap-3 border-t px-3 py-3"
                    >
                      <CheckboxBox
                        aria-label={`${item.title} erstatten`}
                        checked={value > 0}
                        disabled={max === 0}
                        onChange={(e) =>
                          setQty((q) => ({ ...q, [item.id]: e.target.checked ? max : 0 }))
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium">{item.title}</p>
                        <p className="text-admin-text-2 text-[12px]">
                          {[
                            item.variantTitle,
                            item.unitDepositCents > 0
                              ? `zzgl. ${formatMoney(item.unitDepositCents)} Pfand je Stück`
                              : null,
                            item.refundedQuantity > 0
                              ? `${item.refundedQuantity} bereits erstattet`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <label className="flex items-center gap-1.5 text-[13px]">
                        <span className="sr-only">Menge {item.title}</span>
                        <input
                          type="number"
                          name={`qty_${item.id}`}
                          min={0}
                          max={max}
                          value={value}
                          disabled={max === 0}
                          onChange={(e) => {
                            const n = Math.max(
                              0,
                              Math.min(max, Math.trunc(Number(e.target.value) || 0)),
                            );
                            setQty((q) => ({ ...q, [item.id]: n }));
                          }}
                          className={inputClasses(false, "w-16 text-right tabular-nums")}
                        />
                        <span className="text-admin-text-2 whitespace-nowrap">von {max}</span>
                      </label>
                      <span className="w-20 text-right text-[14px] font-semibold tabular-nums">
                        {formatMoney(refundLineAmount(item, value > 0 ? value : max).amountCents)}
                      </span>
                    </li>
                  );
                })}
                <li className="border-admin-rahmen flex items-center gap-3 border-t px-3 py-3">
                  <CheckboxBox
                    id="refund-shipping"
                    name="shipping"
                    checked={shipping}
                    disabled={props.refundableShippingCents === 0}
                    onChange={(e) => setShipping(e.target.checked)}
                  />
                  <label htmlFor="refund-shipping" className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">Versandkosten</span>
                    <span className="text-admin-text-2 block text-[12px]">
                      {props.shippingName ?? "Versand"}
                      {refundedShipping > 0 ? " · bereits teilweise erstattet" : ""}
                    </span>
                  </label>
                  <span className="w-20 text-right text-[14px] font-semibold tabular-nums">
                    {formatMoney(props.refundableShippingCents)}
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="refund-amount" className="text-[13px] font-medium">
                Erstattungsbetrag
              </label>
              <div
                className={`${inputClasses(false)} focus-within:border-admin-akzent flex items-center gap-2 focus-within:border-2`}
              >
                <input
                  id="refund-amount"
                  name="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={touched ? amountText : euro(suggestedCents)}
                  onChange={(e) => {
                    setTouched(true);
                    setAmountText(e.target.value);
                  }}
                  aria-describedby="refund-amount-hint"
                  className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                />
                <span className="text-admin-text-2">€</span>
              </div>
              <p id="refund-amount-hint" className="text-admin-text-2 text-[12px]">
                Maximal {formatMoney(remaining)} erstattbar.{" "}
                {touched ? (
                  <button
                    type="button"
                    className="text-admin-akzent underline"
                    onClick={() => {
                      setTouched(false);
                      setAmountText("");
                    }}
                  >
                    Vorschlag übernehmen ({formatMoney(suggestedCents)})
                  </button>
                ) : (
                  "Vorschlag aus den gewählten Positionen."
                )}
              </p>
              {!calc.ok && (lines.length > 0 || shipping || touched) ? (
                <p className="text-admin-rot text-[12px]" role="alert">
                  {calc.error}
                </p>
              ) : null}
            </div>

            <Select
              name="reasonKey"
              label="Grund"
              placeholder="Bitte wählen"
              options={REASONS}
              value={reasonKey}
              onChange={(e) => setReasonKey(e.target.value)}
              hint="Wird im Verlauf gespeichert, nicht an den Kunden gesendet."
            />
            <Textarea
              name="reasonText"
              label={reasonKey === "other" ? "Beschreibung" : "Ergänzung (optional)"}
              rows={2}
              maxLength={400}
            />
            <Checkbox
              name="restock"
              label="Bestand zurückbuchen"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
              description={
                restockUnits > 0
                  ? `${restockText} gehen zurück in den verfügbaren Bestand (nur, was für diese Bestellung abgebucht wurde).`
                  : "Wähle Positionen, um Bestand zurückzubuchen."
              }
            />
            <Checkbox
              name="notify"
              label="Kunden per E-Mail informieren"
              defaultChecked
              description="Erstattungsbestätigung geht an die Adresse aus der Bestellung."
            />
          </DialogBody>
          <DialogFooter className="md:justify-between">
            <p className="text-admin-text-2 flex items-start gap-2 text-[12px] md:max-w-[300px]">
              <Icon name="info" size={16} />
              <span>
                {props.manual
                  ? "Manuelle Bestellung: Die Erstattung wird nur verbucht, die Überweisung machst du selbst."
                  : `Erstattung über den Zahlungsanbieter auf das ursprüngliche Zahlungsmittel${props.testMode ? " (Testmodus, keine echte Rückzahlung)" : ""}.`}{" "}
                Wird im Audit-Log protokolliert.
              </span>
            </p>
            <div className="flex flex-col-reverse gap-2 md:flex-row">
              <DialogClose />
              <Button
                variant="danger"
                icon="erstatten"
                disabled={!canContinue}
                onClick={() => setStep("confirm")}
              >
                {calc.ok ? `${formatMoney(amountCents)} erstatten` : "Erstatten"}
              </Button>
            </div>
          </DialogFooter>
        </div>

        {step === "confirm" ? (
          <>
            <DialogBody>
              <ActionFormMessage />
              <div className="rounded-admin-feld bg-admin-rot-hell flex items-start gap-3 p-4">
                <span className="text-admin-rot mt-0.5">
                  <Icon name="warnung" size={20} />
                </span>
                <div className="text-[14px]">
                  <p className="font-semibold">
                    {formatMoney(amountCents)} an{" "}
                    {props.manual ? "den Kunden (Überweisung)" : props.paymentLabel} erstatten?
                  </p>
                  <p className="text-admin-text-2 mt-1 text-[13px]">
                    Das lässt sich nicht rückgängig machen.
                    {calc.ok && calc.value.isFull
                      ? " Danach ist die Bestellung vollständig erstattet."
                      : calc.ok
                        ? ` Danach bleiben ${formatMoney(calc.value.remainingAfterCents)} erstattbar.`
                        : ""}
                  </p>
                </div>
              </div>
              {calc.ok ? (
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[14px]">
                  {calc.value.lines.map((l) => (
                    <div key={l.orderItemId} className="contents">
                      <dt>
                        {l.quantity} × {l.title}
                        {l.discountCents > 0 ? (
                          <span className="text-admin-text-2">
                            {" "}
                            (abzgl. {formatMoney(l.discountCents)} Rabatt)
                          </span>
                        ) : null}
                      </dt>
                      <dd className="text-right tabular-nums">{formatMoney(l.amountCents)}</dd>
                    </div>
                  ))}
                  {calc.value.shippingCents > 0 ? (
                    <>
                      <dt>Versandkosten</dt>
                      <dd className="text-right tabular-nums">
                        {formatMoney(calc.value.shippingCents)}
                      </dd>
                    </>
                  ) : null}
                  {calc.value.overridden ? (
                    <>
                      <dt className="text-admin-text-2">Vorschlag</dt>
                      <dd className="text-admin-text-2 text-right tabular-nums">
                        {formatMoney(calc.value.suggestedCents)}
                      </dd>
                    </>
                  ) : null}
                  <dt className="border-admin-rahmen border-t pt-1.5 font-semibold">Erstattung</dt>
                  <dd className="border-admin-rahmen border-t pt-1.5 text-right font-semibold tabular-nums">
                    {formatMoney(calc.value.amountCents)}
                  </dd>
                </dl>
              ) : null}
              <p className="text-admin-text-2 text-[13px]">
                {restock && restockUnits > 0
                  ? "Bestand wird zurückgebucht. "
                  : "Kein Bestand wird zurückgebucht. "}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => setStep("form")}>Zurück</Button>
              <SubmitButton variant="danger" icon="erstatten" pendingLabel="Wird erstattet …">
                Jetzt {formatMoney(amountCents)} erstatten
              </SubmitButton>
            </DialogFooter>
          </>
        ) : null}
      </RemountOnError>
    </ActionForm>
  );
}
