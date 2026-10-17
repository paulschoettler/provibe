import Link from "next/link";
import { PERIOD_OPTIONS, type Period } from "@/lib/admin/dashboard/period";
import { buttonClasses } from "@/components/admin/ui/Button";
import { cx } from "@/components/admin/ui/cx";
import { Icon } from "@/components/admin/ui/Icon";
import { chipClass } from "@/components/admin/ui/Tabs";

/**
 * Zeitraumwahl (Figma 28:5911): Chips Heute, 7, 30, 90 Tage und "Benutzerdefiniert" als
 * Aufklapper mit zwei Datumsfeldern. Alles über Links und ein GET-Formular, ohne JavaScript.
 */
export function PeriodPicker({ period, path = "/admin" }: { period: Period; path?: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <nav
        aria-label="Zeitraum"
        className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0"
      >
        <ul className="flex w-max items-center gap-2">
          {PERIOD_OPTIONS.map((o) => (
            <li key={o.key}>
              <Link
                href={o.key === "7" ? path : `${path}?zeitraum=${o.key}`}
                aria-current={period.key === o.key ? "page" : undefined}
                className={chipClass(period.key === o.key)}
              >
                {o.label}
              </Link>
            </li>
          ))}
          <li>
            <details className="group relative">
              <summary
                className={cx(
                  chipClass(period.key === "custom", "select"),
                  "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                )}
              >
                <Icon name="kalender" size={16} />
                Benutzerdefiniert
                <Icon
                  name="chevron-unten"
                  size={16}
                  className="transition-transform group-open:rotate-180"
                />
              </summary>
              <form
                action={path}
                method="get"
                className="rounded-admin-karte border-admin-rahmen bg-admin-karte shadow-admin-karte absolute left-0 z-30 mt-1 flex w-72 flex-col gap-3 border p-4 md:right-0 md:left-auto"
              >
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Von
                  <input
                    type="date"
                    name="von"
                    defaultValue={period.fromDay}
                    required
                    className="rounded-admin-feld border-admin-rahmen-stark h-10 border px-3 text-[14px] font-normal"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Bis
                  <input
                    type="date"
                    name="bis"
                    defaultValue={period.toDay}
                    required
                    className="rounded-admin-feld border-admin-rahmen-stark h-10 border px-3 text-[14px] font-normal"
                  />
                </label>
                <button type="submit" className={buttonClasses("primary")}>
                  Anwenden
                </button>
              </form>
            </details>
          </li>
        </ul>
      </nav>
      <p className="text-admin-text-2 text-[13px]">
        {period.label} · Vergleich mit {period.prevLabel}
      </p>
    </div>
  );
}
