"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, Honeypot, Notice, SubmitButton, Textarea } from "@/components/forms";
import { cancelWithoutLogin } from "@/lib/subscriptions/cancel-public";
import { INITIAL_ABO_STATE } from "@/lib/subscriptions/types";

/**
 * Kündigungsformular ohne Login (Figma 71:1592 mobil, 71:2162 Desktop), § 312k BGB:
 * Name, E-Mail, optional Abo-Nummer, Art der Kündigung (ordentlich oder außerordentlich mit
 * Grund), gewünschter Zeitpunkt. "Jetzt kündigen" erklärt die Kündigung sofort (H23).
 * Ohne JavaScript ein normales Formular; Grund und Datum sind dann immer sichtbar.
 */
export function PublicCancelForm({ today }: { today: string }) {
  const [state, action] = useActionState(cancelWithoutLogin, INITIAL_ABO_STATE);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const [kind, setKind] = useState(v.kind || "ordinary");
  const [timing, setTiming] = useState(v.timing || "next_possible");
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate aria-label="Abo kündigen">
      {state.status === "error" ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Notice variant="error" title="Da fehlt noch was">
            <p>{state.message}</p>
          </Notice>
        </div>
      ) : null}
      <Field
        name="name"
        label="Vor- und Nachname"
        placeholder="Paul Muster"
        autoComplete="name"
        required
        maxLength={120}
        defaultValue={v.name}
        error={e.name}
      />
      <Field
        name="email"
        type="email"
        label="E-Mail-Adresse"
        placeholder="paul@beispiel.de"
        autoComplete="email"
        inputMode="email"
        required
        maxLength={200}
        defaultValue={v.email}
        error={e.email}
        hint="Die Adresse, mit der du dein Abo abgeschlossen hast."
      />
      <Field
        name="subscriptionNumber"
        label="Abo-Nummer"
        optional
        placeholder="ABO-1001"
        autoComplete="off"
        maxLength={20}
        defaultValue={v.subscriptionNumber}
        error={e.subscriptionNumber}
        hint="Steht in jeder Abo-E-Mail. Hilft uns, wenn du mehrere Abos hast."
      />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-[14px] font-bold">Art der Kündigung</legend>
        <label className="co-choice !min-h-[64px]">
          <input
            type="radio"
            name="kind"
            value="ordinary"
            checked={kind === "ordinary"}
            onChange={() => setKind("ordinary")}
            className="co-radio"
          />
          <span className="flex flex-col leading-[1.35]">
            <span className="text-[16px] font-bold">Ordentliche Kündigung</span>
            <span className="text-pv-wildberry text-[13px]">
              Zum nächsten Liefertermin, ohne Grund
            </span>
          </span>
        </label>
        <label className="co-choice !min-h-[64px]">
          <input
            type="radio"
            name="kind"
            value="extraordinary"
            checked={kind === "extraordinary"}
            onChange={() => setKind("extraordinary")}
            className="co-radio"
          />
          <span className="flex flex-col leading-[1.35]">
            <span className="text-[16px] font-bold">Außerordentliche Kündigung</span>
            <span className="text-pv-wildberry text-[13px]">
              Aus wichtigem Grund, mit Angabe des Grundes
            </span>
          </span>
        </label>
        {e.kind ? <p className="text-pv-wildberry text-[13px] font-bold">{e.kind}</p> : null}
      </fieldset>
      <div className={kind === "extraordinary" ? "" : "pv-abo-js-hide"}>
        <Textarea
          name="reason"
          label="Wichtiger Grund (nur bei außerordentlicher Kündigung)"
          placeholder="Bitte beschreib kurz den Grund."
          rows={3}
          maxLength={1000}
          defaultValue={v.reason}
          error={e.reason}
        />
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-[14px] font-bold">Wann soll das Abo enden?</legend>
        <label className="co-choice !min-h-[64px]">
          <input
            type="radio"
            name="timing"
            value="next_possible"
            checked={timing === "next_possible"}
            onChange={() => setTiming("next_possible")}
            className="co-radio"
          />
          <span className="flex flex-col leading-[1.35]">
            <span className="text-[16px] font-bold">Zum nächstmöglichen Zeitpunkt</span>
            <span className="text-pv-wildberry text-[13px]">
              Keine weitere Lieferung, keine weitere Abbuchung
            </span>
          </span>
        </label>
        <label className="co-choice !min-h-[64px]">
          <input
            type="radio"
            name="timing"
            value="date"
            checked={timing === "date"}
            onChange={() => setTiming("date")}
            className="co-radio"
          />
          <span className="flex flex-col leading-[1.35]">
            <span className="text-[16px] font-bold">Zu einem Wunschdatum</span>
            <span className="text-pv-wildberry text-[13px]">
              Du wählst das Datum im nächsten Feld
            </span>
          </span>
        </label>
      </fieldset>
      <div className={timing === "date" ? "" : "pv-abo-js-hide"}>
        <Field
          name="desiredDate"
          type="date"
          label="Wunschdatum"
          defaultValue={v.desiredDate || today}
          error={e.desiredDate}
          hint="Lieferungen bis zu diesem Tag kommen noch, danach buchen wir nichts mehr ab."
        />
      </div>

      <Honeypot />
      <SubmitButton pendingLabel="Wird gekündigt …" className="w-full">
        Jetzt kündigen
      </SubmitButton>
      <p className="text-pv-wildberry -mt-2 text-[13px] leading-[1.45]">
        Mit dem Klick ist deine Kündigung erklärt. Du siehst sofort eine Bestätigung mit Datum und
        Uhrzeit und bekommst sie zusätzlich per E-Mail.
      </p>
    </form>
  );
}
