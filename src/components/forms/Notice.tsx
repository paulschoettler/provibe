import type { ReactNode } from "react";

export type NoticeVariant = "info" | "success" | "error";

export interface NoticeProps {
  variant?: NoticeVariant;
  title: ReactNode;
  children?: ReactNode;
  /** Zusätzlicher Inhalt rechts (zum Beispiel ein Button), auf Mobil darunter */
  action?: ReactNode;
  id?: string;
  className?: string;
  /** Fokusziel nach einem Formularfehler (tabIndex -1) */
  focusable?: boolean;
}

function InfoIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M19.25 11C19.25 15.5563 15.5563 19.25 11 19.25C6.44365 19.25 2.75 15.5563 2.75 11C2.75 6.44365 6.44365 2.75 11 2.75C15.5563 2.75 19.25 6.44365 19.25 11Z"
        stroke="#7E2856"
        strokeWidth="1.83333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 10.0833V15.5833M11 6.875V6.88417"
        stroke="#7E2856"
        strokeWidth="1.83333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4.58333 11.4583L8.70833 15.5833L17.4167 6.875"
        stroke="#D9306E"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Hinweisbox nach Figma (Baustein 21:224): Radius 16, Innenabstand 16, Icon 22 px.
 * info: Butter mit Info-Icon. success: Pink-Light mit Haken. error: Butter mit Info-Icon
 * (Figma Kontakt-Fehler 26:3500, die Marke hat kein Rot, H9), als role="alert".
 */
export function Notice({
  variant = "info",
  title,
  children,
  action,
  id,
  className = "",
  focusable,
}: NoticeProps) {
  const role = variant === "error" ? "alert" : variant === "success" ? "status" : undefined;
  return (
    <div
      id={id}
      role={role}
      tabIndex={focusable ? -1 : undefined}
      className={`pv-notice pv-notice--${variant} ${action ? "pv-notice--action" : ""} ${className}`}
    >
      <span className="pv-notice-icon">{variant === "success" ? <CheckIcon /> : <InfoIcon />}</span>
      <div className="pv-notice-body">
        <p className="pv-notice-title">{title}</p>
        {children ? <div className="pv-notice-text">{children}</div> : null}
      </div>
      {action ? <div className="pv-notice-action">{action}</div> : null}
    </div>
  );
}

export default Notice;
