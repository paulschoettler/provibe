import type { ReactNode } from "react";

/** Gemeinsame Teile der Formularbausteine. Rein serverseitig renderbar. */

export function describedBy(id: string, hasError: boolean, hasHint: boolean): string | undefined {
  const ids = [hasHint ? `${id}-hinweis` : null, hasError ? `${id}-fehler` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function FieldLabel({
  htmlFor,
  optional,
  children,
}: {
  htmlFor: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="pv-form-label">
      {children}
      {optional ? <span className="pv-form-optional"> (optional)</span> : null}
    </label>
  );
}

/** Warn-Icon aus dem Figma-Baustein (Icon/alert, 16 px, Magenta). */
export function AlertIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z"
        stroke="#D9306E"
        strokeWidth="1.46667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 4.66667V8.66667M8 11V11.0067"
        stroke="#D9306E"
        strokeWidth="1.46667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Fehlerzeile unter einem Feld. Bleibt leer im DOM, damit aria-describedby stabil ist. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="pv-form-error">
      <AlertIcon className="pv-form-error-icon" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Honeypot gegen Bots: für Menschen unsichtbar, nicht fokussierbar, von Screenreadern
 * ignoriert. Server Actions brechen still ab, wenn das Feld gefüllt ist.
 */
export function Honeypot({ name = "website", id }: { name?: string; id?: string }) {
  const fieldId = id ?? `feld-${name}-hp`;
  return (
    <div className="pv-honeypot" aria-hidden="true">
      <label htmlFor={fieldId}>Website (bitte frei lassen)</label>
      <input id={fieldId} name={name} type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
