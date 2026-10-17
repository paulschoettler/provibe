import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { iconButtonClasses } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * Seitenkopf im Inhaltsbereich: Titel (24 bis 28 px), Beschreibung, Aktionen rechts.
 * Mobil rutschen die Aktionen unter den Titel. Es gibt genau eine h1 je Seite: diese hier.
 */
export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Zurück-Pfeil links vom Titel (Detailseiten) */
  backHref?: string;
  backLabel?: string;
  /** Badges oder Meta-Infos neben dem Titel */
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  backHref,
  backLabel = "Zurück",
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cx("mb-5 flex flex-col gap-3 md:mb-6", className)}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          {backHref ? (
            <Link
              href={backHref}
              aria-label={backLabel}
              className={iconButtonClasses("outline", "md", "mt-0.5")}
            >
              <Icon name="chevron-links" size={18} />
            </Link>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] leading-[1.25] font-semibold tracking-[-0.01em] md:text-[28px]">
                {title}
              </h1>
              {meta}
            </div>
            {description ? (
              <p className="text-admin-text-2 mt-1 text-[14px]">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
