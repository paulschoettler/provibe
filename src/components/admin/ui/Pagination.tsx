import Link from "next/link";
import { iconButtonClasses } from "./Button";
import { cx } from "./cx";
import { formatNumber } from "./format";
import { Icon } from "./Icon";

/**
 * Seitenweise Navigation über Links (funktioniert ohne JavaScript).
 * page beginnt bei 1. hrefFor baut den Link, meist mit withParams(...).
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const prev = page > 1 ? hrefFor(page - 1) : null;
  const next = page < pages ? hrefFor(page + 1) : null;
  return (
    <nav
      aria-label="Seiten"
      className={cx(
        "text-admin-text-2 flex items-center justify-between gap-3 px-1 py-3 text-[13px]",
        className,
      )}
    >
      <p>
        {formatNumber(from)} bis {formatNumber(to)} von {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        {prev ? (
          <Link
            href={prev}
            rel="prev"
            aria-label="Vorherige Seite"
            className={iconButtonClasses("outline")}
          >
            <Icon name="chevron-links" size={18} />
          </Link>
        ) : (
          <span aria-hidden="true" className={iconButtonClasses("outline", "md", "opacity-40")}>
            <Icon name="chevron-links" size={18} />
          </span>
        )}
        <span className="tabular-nums">
          Seite {page} von {pages}
        </span>
        {next ? (
          <Link
            href={next}
            rel="next"
            aria-label="Nächste Seite"
            className={iconButtonClasses("outline")}
          >
            <Icon name="chevron-rechts" size={18} />
          </Link>
        ) : (
          <span aria-hidden="true" className={iconButtonClasses("outline", "md", "opacity-40")}>
            <Icon name="chevron-rechts" size={18} />
          </span>
        )}
      </div>
    </nav>
  );
}

/** Seitenzahl aus dem Suchparameter lesen (mindestens 1, ganzzahlig). */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value > 0 ? Math.min(value, 10_000) : 1;
}
