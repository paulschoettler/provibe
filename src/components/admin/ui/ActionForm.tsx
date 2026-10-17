"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
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
  const dialog = useDialog();

  useEffect(() => {
    if (state.status !== "ok" || handled.current === state) return;
    handled.current = state;
    if (resetOnSuccess) formRef.current?.reset();
    onSuccess?.(state);
    if (closeDialogOnSuccess) dialog?.close();
  }, [state, onSuccess, resetOnSuccess, closeDialogOnSuccess, dialog]);

  return (
    <FormStateContext.Provider value={state}>
      <form ref={formRef} id={id} action={formAction} className={className} noValidate {...rest}>
        {!hideMessage && state.status === "error" && state.message ? (
          <FormMessage tone="error">{state.message}</FormMessage>
        ) : null}
        {showSuccess && state.status === "ok" && state.message ? (
          <FormMessage tone="success">{state.message}</FormMessage>
        ) : null}
        {children}
      </form>
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
