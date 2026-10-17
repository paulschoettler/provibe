import Link from "next/link";
import { cx } from "./cx";

/**
 * Tabs als Links (Statusfilter, Unterseiten). Jeder Tab ist eine eigene URL, damit Filter
 * teilbar sind und ohne JavaScript funktionieren. Aktiver Tab mit aria-current.
 * variant "underline" (Seitenebene, Figma Einstellungen mobil) oder "chip" (Filter-Chips, 24:3113).
 */
export interface TabItem {
  label: string;
  href: string;
  active?: boolean;
  count?: number | string;
}

export function Tabs({
  items,
  label,
  variant = "underline",
  className,
}: {
  items: TabItem[];
  /** Beschriftung der Navigation für Screenreader */
  label: string;
  variant?: "underline" | "chip";
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cx("min-w-0 overflow-x-auto", className)}>
      <ul
        className={cx(
          "flex w-max min-w-full items-center",
          variant === "underline" ? "border-admin-rahmen gap-1 border-b" : "gap-2",
        )}
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={
                variant === "underline" ? underlineClass(item.active) : chipClass(item.active)
              }
            >
              <span>{item.label}</span>
              {item.count !== undefined ? (
                <span className="text-admin-text-2 text-[12px] font-medium tabular-nums">
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function underlineClass(active?: boolean) {
  return cx(
    "-mb-px flex h-11 items-center gap-1.5 border-b-2 px-3 text-[15px] whitespace-nowrap",
    active
      ? "border-admin-akzent font-semibold text-admin-text"
      : "border-transparent text-admin-text-2 hover:text-admin-text",
  );
}

/**
 * Klassen eines Filter-Chips (Figma 24:3113, auch für eigene Buttons im Chip-Look):
 * "tab" ohne Rahmen im Ruhezustand, "select" (Auswahlfilter mit Chevron) mit Rahmen auf Weiß.
 */
export function chipClass(active?: boolean, kind: "tab" | "select" = "tab") {
  return cx(
    "flex h-9 items-center gap-1.5 rounded-admin-feld border px-3 text-[14px] leading-[1.4] whitespace-nowrap",
    active
      ? "border-admin-akzent bg-admin-akzent-hell font-semibold text-admin-text"
      : kind === "select"
        ? "border-admin-rahmen-stark bg-admin-karte font-medium text-admin-text hover:bg-admin-flaeche"
        : "border-transparent font-medium text-admin-text-2 hover:bg-admin-flaeche hover:text-admin-text",
  );
}
