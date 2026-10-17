import { SiteLink } from "@/components/layout/SiteLink";
import {
  CATALOG_FILTERS,
  CATALOG_SORTS,
  catalogHref,
  type CatalogFilter,
  type CatalogSort,
} from "@/lib/catalog/products";
import { CheckIcon } from "./icons";

/**
 * Filter- und Sortierleiste der Kollektionsseite (Figma Filter-Chip 23:418). Reine Links mit
 * Suchparametern: funktioniert ohne JavaScript, Ergebnis kommt servergerendert.
 */
export function FilterBar({
  base,
  filter,
  sort,
  count,
}: {
  base: string;
  filter: CatalogFilter;
  sort: CatalogSort;
  count: number;
}) {
  return (
    <div className="border-pv-ui-hairline flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
      <nav
        aria-label="Filtern"
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
      >
        <span className="text-[15px] font-bold">Filtern:</span>
        <ul className="flex flex-wrap gap-2">
          {CATALOG_FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <li key={f.value}>
                <SiteLink
                  href={catalogHref(base, f.value, sort)}
                  className="pvc-chip"
                  aria-current={active ? "true" : undefined}
                  scroll={false}
                >
                  {active ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                  {f.label}
                </SiteLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <p className="text-pv-wildberry text-[14px] font-medium" aria-live="polite">
          {count} {count === 1 ? "Produkt" : "Produkte"}
        </p>
        <nav aria-label="Sortieren" className="flex items-center gap-3">
          <span className="sr-only text-[15px] font-bold sm:not-sr-only">Sortieren:</span>
          <ul className="flex flex-wrap gap-2">
            {CATALOG_SORTS.map((s) => {
              const active = s.value === sort;
              return (
                <li key={s.value}>
                  <SiteLink
                    href={catalogHref(base, filter, s.value)}
                    className="pvc-chip"
                    aria-current={active ? "true" : undefined}
                    scroll={false}
                  >
                    {active ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                    {s.label}
                    {s.arrow ? <span aria-hidden="true">{s.arrow}</span> : null}
                    {s.srText ? <span className="sr-only"> {s.srText}</span> : null}
                  </SiteLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default FilterBar;
