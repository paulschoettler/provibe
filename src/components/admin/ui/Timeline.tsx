import type { ReactNode } from "react";
import { cx } from "./cx";
import { formatDateTime, isoOrUndefined } from "./format";
import { Icon, type IconName } from "./Icon";

/**
 * Aktivitätsverlauf (Bestellung, Kunde, Lead): senkrechte Linie, Icon je Ereignis,
 * Zeitpunkt in Europe/Berlin. Neueste Einträge zuerst übergeben.
 */
export interface TimelineItem {
  id: string | number;
  title: ReactNode;
  description?: ReactNode;
  at: string | Date;
  icon?: IconName;
  tone?: "default" | "accent" | "green" | "red";
  /** zum Beispiel Name des Bearbeiters */
  actor?: string | null;
}

const TONE: Record<NonNullable<TimelineItem["tone"]>, string> = {
  default: "bg-admin-flaeche text-admin-text-2",
  accent: "bg-admin-akzent-hell text-admin-akzent",
  green: "bg-admin-gruen-hell text-admin-gruen",
  red: "bg-admin-rot-hell text-admin-rot",
};

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cx("relative flex flex-col", className)}>
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < items.length - 1 ? (
            <span
              aria-hidden="true"
              className="bg-admin-rahmen absolute top-8 bottom-0 left-[15px] w-px"
            />
          ) : null}
          <span
            className={cx(
              "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
              TONE[item.tone ?? "default"],
            )}
          >
            <Icon name={item.icon ?? "notiz"} size={16} />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="text-[14px] font-medium">{item.title}</div>
            {item.description ? (
              <div className="text-admin-text-2 mt-0.5 text-[13px]">{item.description}</div>
            ) : null}
            <p className="text-admin-text-2 mt-0.5 text-[12px]">
              <time dateTime={isoOrUndefined(item.at)}>{formatDateTime(item.at)}</time>
              {item.actor ? ` · ${item.actor}` : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
