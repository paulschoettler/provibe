import Link from "next/link";
import { Icon } from "./Icon";

export interface Crumb {
  label: string;
  href?: string;
}

/** Brotkrumen über dem Seitentitel. Der letzte Eintrag ist die aktuelle Seite. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Brotkrumen" className="text-admin-text-2 text-[13px]">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-admin-text hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-admin-text" : ""}
                >
                  {item.label}
                </span>
              )}
              {!last ? <Icon name="chevron-rechts" size={14} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
