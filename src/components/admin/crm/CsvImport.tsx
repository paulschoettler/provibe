"use client";

import { useActionState } from "react";
import { applyImportAction, prepareImportAction } from "@/lib/admin/newsletter/ui-actions";
import { ActionForm, FormMessage } from "@/components/admin/ui/ActionForm";
import { INITIAL_ACTION_STATE } from "@/components/admin/ui/action-state";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Checkbox } from "@/components/admin/ui/fields";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

/**
 * CSV-Import von Newsletter-Kontakten in zwei Schritten: Datei prüfen (csv.ts, nichts wird
 * geschrieben), dann mit bestätigtem Einwilligungsnachweis übernehmen. Pflichtspalten: E-Mail und
 * Status; versandfähig wird nur "abonniert" mit gültigem Einwilligungszeitpunkt.
 */

interface PlanData {
  step: "plan";
  csv: string;
  columns: {
    email: string | null;
    firstName: string | null;
    status: string | null;
    consent: string | null;
  };
  summary: { total: number; subscribed: number; pending: number; unsubscribed: number };
  plan: { insert: number; update: number; skip: number };
  duplicates: number;
  errors: { line: number; message: string }[];
  errorCount: number;
  skipped: { email: string; line: number; reason?: string }[];
  issues: { line: number; email: string; issue: string }[];
}

export function CsvImport({ defaultOpen }: { defaultOpen?: boolean }) {
  const [state, formAction] = useActionState(prepareImportAction, INITIAL_ACTION_STATE);
  const plan =
    state.status === "ok" && state.data?.step === "plan"
      ? (state.data as unknown as PlanData)
      : null;

  return (
    <Dialog
      title="Kontakte importieren"
      description="CSV aus Shopify oder einer eigenen Liste, Trenner Komma oder Semikolon"
      trigger={{ label: "Kontakte importieren", variant: "secondary", icon: "upload" }}
      defaultOpen={defaultOpen}
      size="lg"
    >
      <form action={formAction} noValidate>
        <DialogBody>
          {state.status === "error" && state.message ? (
            <FormMessage tone="error">{state.message}</FormMessage>
          ) : null}
          <div className="rounded-admin-feld bg-admin-flaeche p-3 text-[13px] leading-[1.5]">
            <p className="font-semibold">Pflichtfelder für den Einwilligungsnachweis</p>
            <ul className="mt-1 list-disc pl-5">
              <li>
                <strong>E-Mail</strong> und <strong>Status</strong> (abonniert, unbestätigt oder
                abgemeldet)
              </li>
              <li>
                <strong>Einwilligungszeitpunkt</strong> für jeden abonnierten Kontakt (zum Beispiel
                „2025-05-01 08:00:00 +0200“ oder „01.05.2025 08:00“). Ohne Zeitpunkt wird der
                Kontakt als unbestätigt angelegt und nicht angeschrieben.
              </li>
              <li>Optional: Vorname. Bestehende Abmeldungen und Sperren bleiben unverändert.</li>
            </ul>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            CSV-Datei (höchstens 2 MB)
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte file:bg-admin-flaeche min-h-11 border px-2 py-2 text-[14px] font-normal file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5"
            />
          </label>
        </DialogBody>
        <DialogFooter>
          <DialogClose />
          <SubmitButton variant="secondary" pendingLabel="Wird geprüft …">
            Datei prüfen
          </SubmitButton>
        </DialogFooter>
      </form>

      {plan ? (
        <ActionForm
          action={applyImportAction}
          closeDialogOnSuccess
          className="border-admin-rahmen border-t"
        >
          <input type="hidden" name="csv" value={plan.csv} />
          <DialogBody>
            <h3 className="text-[15px] font-semibold">Ergebnis der Prüfung</h3>
            <dl className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
              <Fact label="Neu" value={plan.plan.insert} />
              <Fact label="Aktualisiert" value={plan.plan.update} />
              <Fact label="Übersprungen" value={plan.plan.skip} />
              <Fact label="Fehlerhafte Zeilen" value={plan.errorCount} />
            </dl>
            <p className="text-admin-text-2 text-[13px]">
              {plan.summary.total} gültige Zeilen: {plan.summary.subscribed} versandfähig abonniert,{" "}
              {plan.summary.pending} unbestätigt, {plan.summary.unsubscribed} abgemeldet
              {plan.duplicates ? `, ${plan.duplicates} doppelte Adressen ignoriert` : ""}. Erkannte
              Spalten: E-Mail „{plan.columns.email ?? "–"}“, Status „{plan.columns.status ?? "–"}“,
              Einwilligung „{plan.columns.consent ?? "fehlt"}“.
            </p>
            {plan.issues.length || plan.errors.length || plan.skipped.length ? (
              <details className="rounded-admin-feld border-admin-rahmen border text-[13px]">
                <summary className="cursor-pointer px-3 py-2.5 font-medium">
                  Hinweise je Zeile
                </summary>
                <ul className="divide-admin-rahmen max-h-48 divide-y overflow-y-auto border-t">
                  {plan.errors.map((e) => (
                    <li key={`e${e.line}`} className="text-admin-rot px-3 py-1.5">
                      Zeile {e.line}: {e.message}
                    </li>
                  ))}
                  {plan.issues.map((e) => (
                    <li key={`i${e.line}`} className="px-3 py-1.5">
                      Zeile {e.line} ({e.email}): {e.issue}
                    </li>
                  ))}
                  {plan.skipped.map((e) => (
                    <li key={`s${e.line}`} className="text-admin-text-2 px-3 py-1.5">
                      Zeile {e.line} ({e.email}): {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <Checkbox
              name="consentConfirmed"
              label="Einwilligungsnachweis liegt vor"
              description="Für alle als abonniert markierten Kontakte gibt es eine nachweisbare Einwilligung mit dem angegebenen Zeitpunkt. Beim Import geht keine Mail raus."
            />
          </DialogBody>
          <DialogFooter>
            <SubmitButton pendingLabel="Wird importiert …" disabled={plan.summary.total === 0}>
              {plan.plan.insert + plan.plan.update} Kontakte übernehmen
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      ) : null}
    </Dialog>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-admin-feld border-admin-rahmen border px-3 py-2">
      <dt className="text-admin-text-2">{label}</dt>
      <dd className="text-[18px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
