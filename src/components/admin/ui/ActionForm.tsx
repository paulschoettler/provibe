"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { INITIAL_ACTION_STATE, type ActionState } from "./action-state";
import { cx } from "./cx";
import { useDialog } from "./Dialog";
import { Icon } from "./Icon";

/**
 * Formular für Server Actions mit Rückmeldung (useActionState). Funktioniert ohne JavaScript
 * (Progressive Enhancement). Feldfehler aus dem Ergebnis landen automatisch an den Feldbausteinen
 * (Field, Select, Textarea, Checkbox, Switch), die allgemeine Meldung oben im Formular.
 * Erfolgsmeldungen kommen als Toast (flashToast in der Action), nicht hier.
 *
 * React setzt das Formular nach jeder Action zurück. Damit Auswahlfelder (Select, Checkbox,
 * Switch, RadioCards, CheckboxBox) ihren Wert behalten, zählt ActionForm die Ergebnisse
 * (version) und merkt sich die zuletzt abgeschickten Eingaben (submitted); die Feldbausteine
 * hängen sich je Ergebnis neu ein und übernehmen nach einem Fehler values[name] oder, wenn die
 * Action keine values liefert, den abgeschickten Wert. Nach jedem Ergebnis feuert das <form>
 * zusätzlich das DOM-Ereignis ACTION_RESULT_EVENT (detail.status), darauf hört die SaveBar.
 *
 *   <ActionForm action={inviteStaffAction} closeDialogOnSuccess>
 *     <Field name="email" label="E-Mail" type="email" required />
 *     <SubmitButton>Einladung senden</SubmitButton>
 *   </ActionForm>
 */
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>(INITIAL_ACTION_STATE);

/** Aktueller Zustand des umgebenden ActionForm (für eigene Feldbausteine). */
export function useActionFormState(): ActionState {
  return useContext(FormStateContext);
}

/** DOM-Ereignis am <form> nach jedem Action-Ergebnis, detail: { status: "ok" | "error" }. */
export const ACTION_RESULT_EVENT = "admin:action-result";
/** Attribut am <form> eines ActionForm (die SaveBar wartet dann auf ACTION_RESULT_EVENT). */
export const ACTION_FORM_ATTRIBUTE = "data-action-form";

export interface ActionFormRestore {
  /** Zählt die Ergebnisse der Action; Feldbausteine nutzen ihn als key zum Neu-Einhängen */
  version: number;
  /** Zuletzt abgeschickte Eingaben (nur mit JavaScript, Mehrfachwerte als Liste) */
  submitted: Record<string, string[]> | null;
}

const FormRestoreContext = createContext<ActionFormRestore>({ version: 0, submitted: null });

/** Ergebniszähler und abgeschickte Eingaben des umgebenden ActionForm (für Auswahlfelder). */
export function useActionFormRestore(): ActionFormRestore {
  return useContext(FormRestoreContext);
}

function snapshotForm(
  form: HTMLFormElement,
  submitter: HTMLElement | null,
): Record<string, string[]> {
  let data: FormData;
  try {
    data = new FormData(form, submitter);
  } catch {
    data = new FormData(form);
  }
  const out: Record<string, string[]> = {};
  for (const [key, raw] of data.entries()) {
    if (key.startsWith("$ACTION")) continue;
    (out[key] ??= []).push(typeof raw === "string" ? raw : raw.name);
  }
  return out;
}

export interface ActionFormProps {
  action: FormAction;
  children: ReactNode;
  className?: string;
  id?: string;
  /** Wird nach erfolgreicher Action aufgerufen (zum Beispiel Dialog schließen) */
  onSuccess?: (state: ActionState) => void;
  /** Umgebenden Dialog oder Drawer nach Erfolg schließen */
  closeDialogOnSuccess?: boolean;
  /** Formular nach Erfolg zurücksetzen (Standard: true) */
  resetOnSuccess?: boolean;
  /** Startzustand, zum Beispiel aus Suchparametern */
  initialState?: ActionState;
  /** Fehlerbanner ausblenden, wenn die Seite die Meldung selbst zeigt */
  hideMessage?: boolean;
  /** Erfolgsmeldung im Formular anzeigen (nur wenn kein Toast genutzt wird) */
  showSuccess?: boolean;
  "aria-label"?: string;
}

export function ActionForm({
  action,
  children,
  className,
  id,
  onSuccess,
  closeDialogOnSuccess,
  resetOnSuccess = true,
  initialState = INITIAL_ACTION_STATE,
  hideMessage,
  showSuccess,
  ...rest
}: ActionFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<ActionState | null>(null);
  const announced = useRef<ActionState | null>(null);
  const dialog = useDialog();
  const [submitted, setSubmitted] = useState<Record<string, string[]> | null>(null);
  // Ergebnisse zählen (Zustand während des Renderns anpassen, kein Effekt)
  const [result, setResult] = useState({ state, version: 0 });
  if (result.state !== state) setResult({ state, version: result.version + 1 });
  const version = result.version;

  useEffect(() => {
    if (state.status !== "ok" || handled.current === state) return;
    handled.current = state;
    if (resetOnSuccess) formRef.current?.reset();
    onSuccess?.(state);
    if (closeDialogOnSuccess) dialog?.close();
  }, [state, onSuccess, resetOnSuccess, closeDialogOnSuccess, dialog]);

  // Nach dem automatischen Zurücksetzen durch React: Ergebnis im DOM melden (SaveBar)
  useEffect(() => {
    if (state.status === "idle" || announced.current === state) return;
    announced.current = state;
    formRef.current?.dispatchEvent(
      new CustomEvent(ACTION_RESULT_EVENT, { detail: { status: state.status } }),
    );
  }, [state]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter ?? null;
    setSubmitted(snapshotForm(event.currentTarget, submitter));
  };

  return (
    <FormStateContext.Provider value={state}>
      <FormRestoreContext.Provider value={{ version, submitted }}>
        <form
          ref={formRef}
          id={id}
          action={formAction}
          onSubmit={onSubmit}
          className={className}
          noValidate
          data-action-form=""
          {...rest}
        >
          {!hideMessage && state.status === "error" && state.message ? (
            <FormMessage tone="error">{state.message}</FormMessage>
          ) : null}
          {showSuccess && state.status === "ok" && state.message ? (
            <FormMessage tone="success">{state.message}</FormMessage>
          ) : null}
          {children}
        </form>
      </FormRestoreContext.Provider>
    </FormStateContext.Provider>
  );
}

/** Hinweisbox (Fehler, Erfolg, Info, Warnung) nach Figma Login-Fehlermeldung (27:4425). */
export function FormMessage({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "info" | "warning";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    error: { box: "bg-admin-rot-hell", icon: "text-admin-rot", name: "warnung" as const },
    success: { box: "bg-admin-gruen-hell", icon: "text-admin-gruen", name: "haken" as const },
    info: { box: "bg-admin-blau-hell", icon: "text-admin-blau", name: "info" as const },
    warning: { box: "bg-admin-gelb-hell", icon: "text-admin-gelb", name: "warnung" as const },
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-admin-feld mb-4 flex items-start gap-2.5 p-3 text-[14px]",
        styles.box,
        className,
      )}
    >
      <span className={cx("mt-px", styles.icon)}>
        <Icon name={styles.name} size={18} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Fehlermeldung des umgebenden ActionForm an eigener Stelle (mit hideMessage am Formular). */
export function ActionFormMessage({ className }: { className?: string }) {
  const state = useActionFormState();
  if (state.status !== "error" || !state.message) return null;
  return (
    <FormMessage tone="error" className={cx("mb-0", className)}>
      {state.message}
    </FormMessage>
  );
}
