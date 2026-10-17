import type { ReactNode } from "react";
import type { BadgeTone } from "@/lib/auth/order-status";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

/**
 * Bausteine der Kontoseiten nach Figma "03 Kasse und Konto" (Bausteine 26:1003):
 * Formularfeld (26:1040), Checkbox (26:1059), Hinweisbox (26:1311), Badge, Eyebrow, Karten.
 * Ohne Hooks, damit sie in Server- und Client-Komponenten funktionieren.
 */

/** Outline-Button (Figma "Button/Sekundär"): Aubergine-Rahmen, transparent */
export const BTN_OUTLINE =
  "btn-pill border-[1.5px] border-aubergine bg-transparent text-aubergine hover:bg-aubergine/5";
/** Textlink in Plum, unterstrichen (Kontrast auf Creme) */
export const LINK_PLUM =
  "font-semibold text-plum underline decoration-[1.5px] underline-offset-4 hover:text-wine";
/** Karte auf Creme (Figma: Cream-2, Radius 26, Schatten/Karte) */
export const CARD = "rounded-card bg-cream-2 shadow-[0_12px_32px_-6px_rgba(74,46,56,0.12)]";
/** Flache Karte ohne Schatten (Adressen, Zahlart) */
export const CARD_FLAT = "rounded-[22px] bg-cream-2";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-plum flex items-center gap-2 text-[13px] leading-[1.2] font-semibold tracking-[0.24em] uppercase ${className}`}
    >
      <span className="bg-magenta size-2 rounded-full" aria-hidden="true" />
      {children}
    </p>
  );
}

export type NoticeTone = "info" | "error" | "success";

const NOTICE_STYLES: Record<NoticeTone, string> = {
  info: "bg-butter border-aubergine text-aubergine",
  error: "bg-pink-light border-magenta text-berry",
  success: "bg-cream border-mauve/60 text-aubergine",
};

/** Hinweisbox (Info, Fehler, Erfolg). Fehler mit Magenta-Rahmen und Berry-Text (Frage H9). */
export function Notice({
  tone = "info",
  title,
  children,
  role,
  id,
  className = "",
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
  id?: string;
  className?: string;
}) {
  return (
    <div
      id={id}
      role={role}
      className={`flex items-start gap-3 rounded-[18px] border-[1.5px] p-4 ${NOTICE_STYLES[tone]} ${className}`}
    >
      {tone === "success" ? (
        <span className="bg-magenta mt-px flex size-6 items-center justify-center rounded-full text-white">
          <CheckIcon className="size-4" />
        </span>
      ) : tone === "error" ? (
        <AlertIcon className="text-magenta size-6" />
      ) : (
        <InfoIcon className="size-6" />
      )}
      <div className="min-w-0 flex-1">
        {title ? <p className="text-[15px] leading-[1.4] font-semibold">{title}</p> : null}
        {children ? <div className="mt-0.5 text-[14px] leading-[1.45]">{children}</div> : null}
      </div>
    </div>
  );
}

const BADGE_STYLES: Record<BadgeTone, string> = {
  butter: "bg-butter border-aubergine text-aubergine",
  success: "bg-[#dff1e3] border-[#2f6b3c] text-[#1f4d2a]",
  neutral: "bg-cream border-mauve text-aubergine",
  alert: "bg-pink-light border-magenta text-berry",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`rounded-pill inline-flex items-center border-[1.5px] px-2.5 py-px text-[12px] leading-[1.5] font-semibold whitespace-nowrap ${BADGE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

export interface FieldProps {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "tel";
  defaultValue?: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  inputMode?: "email" | "numeric" | "tel" | "text";
  /** Eindeutiges Präfix, falls ein Feldname mehrfach auf der Seite vorkommt */
  idPrefix?: string;
  className?: string;
}

/** Formularfeld mit Label, Hinweis und Fehler (aria-describedby, aria-invalid). */
export function Field({
  name,
  label,
  type = "text",
  defaultValue,
  error,
  hint,
  autoComplete,
  required,
  placeholder,
  minLength,
  maxLength,
  inputMode,
  idPrefix = "f",
  className = "",
}: FieldProps) {
  const id = `${idPrefix}-${name}`;
  const hintId = hint ? `${id}-hinweis` : undefined;
  const errorId = error ? `${id}-fehler` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[14px] leading-[1.4] font-semibold">
        {label}
        {required ? null : <span className="text-mauve font-normal"> (optional)</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={maxLength}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`pv-acc-input ${error ? "pv-acc-input--error" : ""}`}
      />
      {error ? (
        <p id={errorId} className="text-berry flex items-center gap-1.5 text-[13px] font-semibold">
          <AlertIcon className="text-magenta size-4" />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-[13px] leading-[1.4]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Checkbox mit 44-px-Touchziel, nie vorangekreuzt außer bei gespeichertem Zustand */
export function Checkbox({
  name,
  label,
  defaultChecked,
  error,
  idPrefix = "f",
}: {
  name: string;
  label: ReactNode;
  defaultChecked?: boolean;
  error?: string;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${name}`;
  const errorId = error ? `${id}-fehler` : undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] leading-[1.4]"
      >
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="pv-acc-check"
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p id={errorId} className="text-berry flex items-center gap-1.5 text-[13px] font-semibold">
          <AlertIcon className="text-magenta size-4" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Honeypot gegen Bots: für Menschen unsichtbar und nicht fokussierbar */
export function Honeypot({ idPrefix = "f" }: { idPrefix?: string }) {
  return (
    <div className="pv-acc-hp" aria-hidden="true">
      <label htmlFor={`${idPrefix}-website`}>Website</label>
      <input
        id={`${idPrefix}-website`}
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}
