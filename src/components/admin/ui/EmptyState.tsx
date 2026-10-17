import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

/** Leerer Zustand für Listen, Tabellen und Karten: Icon, Titel, kurzer Text, optionale Aktion. */
export function EmptyState({
  icon = "info",
  title,
  children,
  action,
  compact,
  className,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** Kleinere Variante innerhalb einer Karte */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <span className="bg-admin-akzent-hell text-admin-akzent flex size-11 items-center justify-center rounded-full">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-[15px] font-bold">{title}</p>
      {children ? <div className="text-admin-text-2 max-w-md text-[14px]">{children}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
