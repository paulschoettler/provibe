"use client";

import { useState } from "react";
import {
  cancelSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  retrySubscriptionPaymentAction,
  setSubscriptionDiscountAction,
  skipSubscriptionAction,
} from "@/lib/subscriptions/admin-actions";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Button } from "@/components/admin/ui/Button";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Checkbox, Field, RadioCards, Select, Textarea } from "@/components/admin/ui/fields";
import { formatMoney } from "@/components/admin/ui/format";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

/**
 * Aktionen im Kopf der Abo-Detailseite (Figma 82:2420, Dialog Rabatt 82:3535): Pausieren bis Datum,
 * Fortsetzen, Überspringen oder doch liefern, Rabatt mit Preisvorschau, Zahlung erneut versuchen,
 * Kündigen. Jede Aktion bestätigt ein Dialog; Rechte und Zustände prüft zusätzlich der Server.
 */
export interface SubscriptionActionsProps {
  id: string;
  number: string;
  status: "draft" | "active" | "paused" | "past_due" | "cancelled";
  summary: string;
  skipNext: boolean;
  /** "14.11.2026" (geplanter Termin, ohne Überspringen) */
  plannedLabel: string | null;
  /** Termin nach dem Überspringen */
  afterSkipLabel: string | null;
  pausedUntilLabel: string | null;
  pausedForPayment: boolean;
  pause: { min: string; max: string; defaultDay: string; maxLabel: string };
  /** nächster möglicher Liefertermin für die Kündigung zum Termin */
  nextDeliveryLabel: string | null;
  cancelScheduledLabel: string | null;
  canOperate: boolean;
  canManage: boolean;
  discountBp: number;
  preview: { totals: Record<number, number>; currentBp: number } | null;
  reasons: { value: string; label: string }[];
  testMode: boolean;
}

type Kind = "pause" | "resume" | "skip" | "discount" | "retry" | "cancel" | null;

function bpFromInput(raw: string): number | null {
  const s = raw.replace(",", ".").replace("%", "").trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) return null;
  const bp = Math.round(Number(s) * 100);
  return bp >= 0 && bp <= 5000 ? bp : null;
}

function pct(bp: number): string {
  return `${(bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

export function SubscriptionActions(props: SubscriptionActionsProps) {
  const [open, setOpen] = useState<Kind>(null);
  const close = (o: boolean) => {
    if (!o) setOpen(null);
  };
  const { status } = props;
  if (status === "cancelled" || status === "draft") return null;
  if (!props.canOperate && !props.canManage) return null;

  const buttons: { kind: Exclude<Kind, null>; label: string; show: boolean }[] = [
    { kind: "resume", label: "Fortsetzen", show: props.canOperate && status === "paused" },
    {
      kind: "pause",
      label: status === "paused" ? "Pause ändern" : "Pausieren",
      show:
        props.canOperate &&
        (status === "active" || (status === "paused" && !props.pausedForPayment)),
    },
    {
      kind: "skip",
      label: props.skipNext ? "Doch liefern" : "Nächste überspringen",
      show: props.canOperate && status === "active",
    },
    {
      kind: "retry",
      label: "Zahlung erneut versuchen",
      show: props.canManage && status === "past_due",
    },
    { kind: "discount", label: "Rabatt anpassen", show: props.canManage },
  ];

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {buttons
        .filter((b) => b.show)
        .map((b) => (
          <Button
            key={b.kind}
            variant={b.kind === "retry" ? "primary" : "secondary"}
            aria-haspopup="dialog"
            onClick={() => setOpen(b.kind)}
          >
            {b.label}
          </Button>
        ))}
      {props.canOperate ? (
        <Button
          variant="danger"
          className="md:ml-auto"
          aria-haspopup="dialog"
          onClick={() => setOpen("cancel")}
        >
          Kündigen
        </Button>
      ) : null}

      <Dialog
        title={status === "paused" ? "Pause ändern" : "Abo pausieren"}
        description={props.summary}
        open={open === "pause"}
        onOpenChange={close}
      >
        <ActionForm action={pauseSubscriptionAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="id" value={props.id} />
          <DialogBody>
            <ActionFormMessage />
            <Field
              name="until"
              type="date"
              label="Pausieren bis"
              min={props.pause.min}
              max={props.pause.max}
              defaultValue={props.pause.defaultDay}
              required
              hint={`An diesem Tag kommt die nächste Lieferung. Höchstens bis ${props.pause.maxLabel}.`}
            />
            <p className="text-admin-text-2 text-[13px]">
              Bis dahin wird nichts abgebucht und nichts verschickt. Ein Überspringen wird dabei
              aufgehoben. Die Änderung landet im Protokoll und in den Ereignissen.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton pendingLabel="Wird gespeichert …">Pausieren</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      <Dialog
        title="Abo fortsetzen?"
        description={props.summary}
        open={open === "resume"}
        onOpenChange={close}
      >
        <ActionForm action={resumeSubscriptionAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="id" value={props.id} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              {props.pausedForPayment
                ? "Das Abo ist wegen abgelehnter Zahlungen pausiert. Beim Fortsetzen buchen wir sofort mit dem hinterlegten Zahlungsmittel ab; klappt es, geht die Lieferung raus."
                : `Das Abo ist pausiert${props.pausedUntilLabel ? ` bis ${props.pausedUntilLabel}` : ""}. Beim Fortsetzen ist die nächste Lieferung morgen, die Abbuchung erfolgt am Liefertag.`}
            </p>
            {props.testMode && props.pausedForPayment ? (
              <FormMessage tone="info" className="mb-0">
                Testmodus: Die Zahlung läuft gegen den Zahlungs-Mock, es fließt kein Geld.
              </FormMessage>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton pendingLabel="Wird fortgesetzt …">Fortsetzen</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      <Dialog
        title={props.skipNext ? "Doch liefern?" : "Nächste Lieferung überspringen?"}
        description={props.summary}
        open={open === "skip"}
        onOpenChange={close}
      >
        <ActionForm action={skipSubscriptionAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="id" value={props.id} />
          <input type="hidden" name="skip" value={props.skipNext ? "false" : "true"} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              {props.skipNext
                ? `Die Lieferung am ${props.plannedLabel ?? "geplanten Termin"} kommt wieder wie geplant und wird an diesem Tag abgebucht.`
                : `Die Lieferung am ${props.plannedLabel ?? "nächsten Termin"} entfällt, es wird nichts abgebucht. Die nächste Lieferung kommt dann am ${props.afterSkipLabel ?? "Termin danach"}.`}
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton pendingLabel="Wird gespeichert …">
              {props.skipNext ? "Doch liefern" : "Überspringen"}
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      <Dialog
        title="Zahlung erneut versuchen?"
        description={props.summary}
        open={open === "retry"}
        onOpenChange={close}
      >
        <ActionForm action={retrySubscriptionPaymentAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="id" value={props.id} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              Wir buchen jetzt mit dem hinterlegten Zahlungsmittel ab. Klappt es, entsteht sofort
              die Bestellung und der nächste Termin läuft im Rhythmus weiter. Wird die Zahlung
              wieder abgelehnt, zählt das als weiterer Fehlversuch und der Kunde bekommt eine Mail.
            </p>
            {props.testMode ? (
              <FormMessage tone="info" className="mb-0">
                Testmodus: Die Zahlung läuft gegen den Zahlungs-Mock, es fließt kein Geld.
              </FormMessage>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton pendingLabel="Zahlung läuft …">Jetzt abbuchen</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      {props.canManage ? (
        <Dialog
          title="Rabatt anpassen"
          description={props.summary}
          open={open === "discount"}
          onOpenChange={close}
        >
          {open === "discount" ? <DiscountForm {...props} /> : null}
        </Dialog>
      ) : null}

      <Dialog
        title="Abo kündigen"
        description={props.summary}
        open={open === "cancel"}
        onOpenChange={close}
      >
        {open === "cancel" ? <CancelForm {...props} /> : null}
      </Dialog>
    </div>
  );
}

function DiscountForm(props: SubscriptionActionsProps) {
  const [raw, setRaw] = useState(String(props.discountBp / 100).replace(".", ","));
  const bp = bpFromInput(raw);
  const before = props.preview?.totals[props.preview.currentBp] ?? null;
  const after = bp !== null ? (props.preview?.totals[bp] ?? null) : null;
  const lower = bp !== null && bp < props.discountBp;
  return (
    <ActionForm action={setSubscriptionDiscountAction} closeDialogOnSuccess hideMessage>
      <input type="hidden" name="id" value={props.id} />
      <DialogBody>
        <ActionFormMessage />
        <p className="text-admin-text-2 text-[13px]">
          Aktuell {pct(props.discountBp)}. Der neue Rabatt gilt ab der nächsten Lieferung.
        </p>
        <Field
          name="percent"
          label="Rabatt in Prozent"
          inputMode="decimal"
          defaultValue={raw}
          onChange={(e) => setRaw(e.currentTarget.value)}

          required
          hint="Wirkt nur auf den Warenwert, nie auf Pfand und Versand. 0 bis 50, in Schritten von 0,5 für die Vorschau."
        />
        <div
          className="rounded-admin-feld bg-admin-flaeche flex flex-col gap-2 p-3 text-[14px]"
          aria-live="polite"
        >
          <p className="flex justify-between gap-3">
            <span className="text-admin-text-2">Preis je Lieferung bisher</span>
            <span className="font-semibold tabular-nums">
              {before !== null ? formatMoney(before) : "–"}
            </span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-admin-text-2">Preis je Lieferung neu</span>
            <span className="font-semibold tabular-nums">
              {after !== null
                ? formatMoney(after)
                : bp === null
                  ? "Eingabe prüfen"
                  : "nach dem Speichern"}
            </span>
          </p>
          {before !== null && after !== null ? (
            <p className="flex justify-between gap-3">
              <span className="text-admin-text-2">
                {after <= before ? "Ersparnis je Lieferung" : "Mehrpreis je Lieferung"}
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(Math.abs(before - after))}
              </span>
            </p>
          ) : null}
        </div>
        <Field
          name="reason"
          label="Grund (intern)"
          placeholder="Zum Beispiel Kulanz nach verspäteter Lieferung"
          required
          hint="Erscheint im Protokoll."
        />
        {lower ? (
          <>
            <FormMessage tone="warning" className="mb-0">
              Weniger Rabatt heißt höherer Preis. Ohne Preisanpassungsklausel (wartet auf rechtliche
              Freigabe, I17) nur mit ausdrücklicher Zustimmung des Kunden.
            </FormMessage>
            <Checkbox
              name="consent"
              label="Der Kunde hat dem höheren Preis ausdrücklich zugestimmt"
            />
          </>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose />
        <SubmitButton pendingLabel="Wird gespeichert …">Rabatt speichern</SubmitButton>
      </DialogFooter>
    </ActionForm>
  );
}

function CancelForm(props: SubscriptionActionsProps) {
  const [mode, setMode] = useState("next");
  return (
    <ActionForm action={cancelSubscriptionAction} closeDialogOnSuccess hideMessage>
      <input type="hidden" name="id" value={props.id} />
      <DialogBody>
        <ActionFormMessage />
        {props.cancelScheduledLabel ? (
          <FormMessage tone="info" className="mb-0">
            Eine Kündigung zum {props.cancelScheduledLabel} ist schon vorgemerkt. Eine neue Auswahl
            ersetzt sie.
          </FormMessage>
        ) : null}
        <div onChange={(e) => setMode((e.target as HTMLInputElement).value)}>
          <RadioCards
            name="mode"
            legend="Zeitpunkt"
            defaultValue="next"
            options={[
              {
                value: "next",
                label: "Zum nächsten Liefertermin (ordentlich)",
                description: props.nextDeliveryLabel
                  ? `Ab sofort keine Lieferung und keine Abbuchung mehr, Vertragsende am ${props.nextDeliveryLabel}.`
                  : "Ab sofort keine Lieferung und keine Abbuchung mehr.",
              },
              {
                value: "now",
                label: "Sofort (außerordentlich)",
                description: "Vertragsende jetzt, offene Zahlungen werden verworfen.",
              },
              {
                value: "date",
                label: "Zu einem Wunschdatum",
                description:
                  "Lieferungen bis dahin laufen weiter (nur auf ausdrücklichen Wunsch des Kunden).",
              },
            ]}
          />
        </div>
        {mode === "date" ? (
          <Field name="desiredDay" type="date" label="Wunschdatum" min={props.pause.min} required />
        ) : null}
        <Select
          name="reason"
          label="Grund"
          defaultValue="backoffice"
          options={[
            { value: "backoffice", label: "Im Auftrag des Kunden (ohne Angabe)" },
            ...props.reasons,
          ]}
        />
        <Textarea
          name="note"
          label="Notiz (optional)"
          rows={2}
          placeholder="Zum Beispiel Anruf am 17.10., Kundin zieht um"
        />
        <Checkbox
          name="sendMail"
          defaultChecked
          label="Kündigungsbestätigung per E-Mail an den Kunden"
          description="Pflicht bei einer Kündigung durch den Kunden (§ 312k BGB). Nur abwählen, wenn die Bestätigung schon anders rausging."
        />
      </DialogBody>
      <DialogFooter>
        <DialogClose />
        <SubmitButton variant="danger" pendingLabel="Wird gekündigt …">
          Verbindlich kündigen
        </SubmitButton>
      </DialogFooter>
    </ActionForm>
  );
}
