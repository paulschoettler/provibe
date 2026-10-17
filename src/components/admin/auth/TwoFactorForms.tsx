"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  confirmEnrollmentAction,
  finishEnrollmentAction,
  logoutAction,
  redeemRecoveryAction,
  startEnrollmentAction,
  verifyTotpAction,
} from "@/lib/admin/staff/actions";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { INITIAL_ACTION_STATE } from "@/components/admin/ui/action-state";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Field } from "@/components/admin/ui/fields";
import { Icon } from "@/components/admin/ui/Icon";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CodeInput } from "./CodeInput";

/**
 * Formulare auf /admin/2fa (Figma 27:4478, Fehler 27:4529). "Code erneut senden" aus dem Entwurf
 * gibt es bei Authenticator-Apps nicht; an seiner Stelle steht der Wiederherstellungscode (H15).
 */

function AppHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-admin-text-2 flex items-start gap-2 text-[13px]">
      <span className="mt-px">
        <Icon name="handy" size={18} />
      </span>
      <span>{children}</span>
    </p>
  );
}

function BackToLogin() {
  return (
    <form action={logoutAction} className="flex justify-center">
      <button type="submit" className={buttonClasses("text", "md")}>
        Zurück zur Anmeldung
      </button>
    </form>
  );
}

/** Code bei jeder Anmeldung */
export function VerifyForm({ next }: { next: string }) {
  const [state, action] = useActionState(verifyTotpAction, INITIAL_ACTION_STATE);
  const invalid = state.status === "error";
  return (
    <div className="flex flex-col gap-5">
      <form action={action} noValidate className="flex flex-col gap-5">
        {invalid && state.message ? (
          <FormMessage tone="error" className="mb-0">
            {state.message}
          </FormMessage>
        ) : null}
        <input type="hidden" name="next" value={next} />
        <CodeInput invalid={invalid} autoFocus />
        <AppHint>Öffne deine Authenticator-App. Der Code wechselt alle 30 Sekunden.</AppHint>
        <SubmitButton block pendingLabel="Wird geprüft …">
          Bestätigen
        </SubmitButton>
      </form>
      <div className="flex flex-col items-center">
        <Link
          href={`/admin/2fa?modus=wiederherstellung${next !== "/admin" ? `&next=${encodeURIComponent(next)}` : ""}`}
          className={buttonClasses("text", "md")}
        >
          <Icon name="schild" size={16} />
          Wiederherstellungscode verwenden
        </Link>
        <BackToLogin />
      </div>
    </div>
  );
}

/** Gerät verloren: Wiederherstellungscode einlösen */
export function RecoveryForm({ next }: { next: string }) {
  const [state, action] = useActionState(redeemRecoveryAction, INITIAL_ACTION_STATE);
  return (
    <div className="flex flex-col gap-5">
      <form action={action} noValidate className="flex flex-col gap-5">
        {state.status === "error" && state.message ? (
          <FormMessage tone="error" className="mb-0">
            {state.message}
          </FormMessage>
        ) : null}
        <FormMessage tone="info" className="mb-0">
          Jeder Code funktioniert einmal. Danach wirst du abgemeldet, meldest dich neu an und
          richtest die Zwei-Faktor-Anmeldung mit deinem neuen Gerät ein.
        </FormMessage>
        <Field
          name="recovery"
          label="Wiederherstellungscode"
          placeholder="XXXXX-XXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          error={state.fieldErrors?.recovery}
        />
        <SubmitButton block pendingLabel="Wird geprüft …">
          Code einlösen
        </SubmitButton>
      </form>
      <div className="flex flex-col items-center">
        <Link
          href={`/admin/2fa${next !== "/admin" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className={buttonClasses("text", "md")}
        >
          Zurück zur Code-Eingabe
        </Link>
        <p className="text-admin-text-2 mt-2 text-center text-[12px]">
          Keine Codes mehr? Ein Owner kann deine Zwei-Faktor-Anmeldung unter Einstellungen, Benutzer
          zurücksetzen.
        </p>
      </div>
    </div>
  );
}

interface ScanData {
  step: "scan";
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

/** Erster Login: Authenticator einrichten, ersten Code prüfen, Wiederherstellungscodes zeigen */
export function EnrollmentFlow({ next }: { next: string }) {
  const [startState, start] = useActionState(startEnrollmentAction, INITIAL_ACTION_STATE);
  const [confirmState, confirm] = useActionState(confirmEnrollmentAction, INITIAL_ACTION_STATE);

  if (confirmState.status === "ok" && confirmState.data?.step === "codes") {
    return (
      <RecoveryCodes
        codes={(confirmState.data.codes as string[]) ?? []}
        next={String(confirmState.data.next ?? next)}
      />
    );
  }
  const scan = (
    confirmState.data?.step === "scan"
      ? confirmState.data
      : startState.data?.step === "scan"
        ? startState.data
        : null
  ) as ScanData | null;

  if (!scan) {
    return (
      <div className="flex flex-col gap-5">
        {startState.status === "error" && startState.message ? (
          <FormMessage tone="error" className="mb-0">
            {startState.message}
          </FormMessage>
        ) : null}
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px]">
          <li>
            Installiere eine Authenticator-App, zum Beispiel 1Password, Google Authenticator oder
            Authy.
          </li>
          <li>Scanne den QR-Code, den wir dir gleich zeigen.</li>
          <li>
            Gib den sechsstelligen Code aus der App ein und sichere deine Wiederherstellungscodes.
          </li>
        </ol>
        <form action={start}>
          <SubmitButton block pendingLabel="Wird vorbereitet …">
            Einrichtung starten
          </SubmitButton>
        </form>
        <BackToLogin />
      </div>
    );
  }

  const invalid = confirmState.status === "error";
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-admin-feld border-admin-rahmen flex flex-col items-center gap-3 border p-4">
        {/* QR-Code kommt als SVG-Data-URL von Supabase, kein externer Dienst */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={scan.qrCode}
          alt="QR-Code für die Authenticator-App"
          width={176}
          height={176}
          className="size-44"
        />
        <details className="w-full text-[13px]">
          <summary className="text-admin-akzent cursor-pointer text-center font-medium">
            QR-Code geht nicht? Schlüssel manuell eingeben
          </summary>
          <p className="text-admin-text-2 mt-2">
            Konto: provibe Backoffice, Typ: zeitbasiert (TOTP)
          </p>
          <code className="rounded-admin-feld bg-admin-flaeche mt-1 block px-3 py-2 font-mono text-[13px] break-all select-all">
            {scan.secret}
          </code>
        </details>
      </div>
      <form action={confirm} noValidate className="flex flex-col gap-5">
        {invalid && confirmState.message ? (
          <FormMessage tone="error" className="mb-0">
            {confirmState.message}
          </FormMessage>
        ) : null}
        <input type="hidden" name="factorId" value={scan.factorId} />
        <input type="hidden" name="next" value={next} />
        <CodeInput invalid={invalid} />
        <AppHint>
          Gib den Code ein, den die App nach dem Scannen anzeigt. Er wechselt alle 30 Sekunden.
        </AppHint>
        <SubmitButton block pendingLabel="Wird geprüft …">
          Bestätigen und aktivieren
        </SubmitButton>
      </form>
    </div>
  );
}

function RecoveryCodes({ codes, next }: { codes: string[]; next: string }) {
  const [saved, setSaved] = useState(false);
  if (codes.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage tone="warning" className="mb-0">
          Zwei-Faktor ist aktiv. Wiederherstellungscodes konnten gerade nicht gespeichert werden;
          bitte einen Owner, sie später neu zu erzeugen (Zwei-Faktor zurücksetzen und neu
          einrichten).
        </FormMessage>
        <form action={finishEnrollmentAction}>
          <input type="hidden" name="next" value={next} />
          <SubmitButton block>Weiter zum Backoffice</SubmitButton>
        </form>
      </div>
    );
  }
  const text = `provibe Backoffice: Wiederherstellungscodes\nJeder Code funktioniert einmal.\n\n${codes.join("\n")}\n`;
  return (
    <div className="flex flex-col gap-5">
      <FormMessage tone="success" className="mb-0">
        Zwei-Faktor-Anmeldung ist aktiv.
      </FormMessage>
      <div>
        <h2 className="text-[16px] font-semibold">Deine Wiederherstellungscodes</h2>
        <p className="text-admin-text-2 mt-1 text-[13px]">
          Wir zeigen sie nur dieses eine Mal. Bewahre sie sicher auf, zum Beispiel im
          Passwortmanager. Mit einem Code kommst du rein, wenn dein Handy weg ist.
        </p>
      </div>
      <ul className="rounded-admin-feld bg-admin-flaeche grid grid-cols-2 gap-2 p-3 font-mono text-[14px] select-all">
        {codes.map((c) => (
          <li key={c} className="tabular-nums">
            {c}
          </li>
        ))}
      </ul>
      <a
        href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
        download="provibe-backoffice-wiederherstellungscodes.txt"
        className={buttonClasses("secondary", "md", "w-full")}
      >
        <Icon name="download" size={16} />
        Als Textdatei speichern
      </a>
      <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.currentTarget.checked)}
          className="mt-0.5 size-[18px] accent-[var(--admin-farbe-akzent)]"
        />
        Ich habe die Codes sicher gespeichert.
      </label>
      <form action={finishEnrollmentAction}>
        <input type="hidden" name="next" value={next} />
        <SubmitButton block disabled={!saved}>
          Weiter zum Backoffice
        </SubmitButton>
      </form>
    </div>
  );
}
