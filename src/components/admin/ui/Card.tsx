import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Karte nach Figma (26:5138): weiß, 1 px Rahmen, Radius 10. Kopf mit Titel (16 px, SemiBold)
 * und optionaler Aktion rechts (Magenta-Link oder Button).
 */
export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Rechts im Kopf, zum Beispiel <Link className="text-admin-akzent">Bearbeiten</Link> */
  action?: ReactNode;
  /** Ohne Innenabstand im Inhalt (Tabellen, Listen bis zum Rand) */
  flush?: boolean;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** id für Sprungmarken und aria-labelledby */
  id?: string;
  children?: ReactNode;
}

export function Card({
  title,
  description,
  action,
  flush,
  footer,
  className,
  bodyClassName,
  id,
  children,
}: CardProps) {
  const headingId = id ? `${id}-titel` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={cx(
        "rounded-admin-karte border-admin-rahmen bg-admin-karte min-w-0 overflow-hidden border",
        className,
      )}
    >
      {title || action ? (
        <div className={cx("flex items-start gap-2 px-4 pt-4", flush ? "pb-3" : "pb-2")}>
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 id={headingId} className="text-[16px] leading-[1.4] font-semibold">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-admin-text-2 mt-0.5 text-[13px]">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div
        className={cx(
          flush ? "" : "px-4 pb-4",
          !title && !action && !flush && "pt-4",
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="border-admin-rahmen flex items-center justify-end gap-2 border-t px-4 py-3">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** Magenta-Textlink im Kartenkopf ("Alle Bestellungen", "Bearbeiten") */
export const cardActionClass =
  "text-[14px] font-medium text-admin-akzent hover:underline underline-offset-2";
