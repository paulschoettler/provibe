import Link from "next/link";
import type { ReactNode } from "react";
import { AutoSubmit } from "./AutoSubmit";
import { buttonClasses } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { Tabs, type TabItem } from "./Tabs";

/**
 * Filterleiste über Listen: Status-Chips (Links), Suchfeld und weitere Filter (children, zum
 * Beispiel <Select hideLabel …>) in einem GET-Formular. Filter landen in der URL, damit sie teilbar
 * sind und ohne JavaScript funktionieren; mit JavaScript schicken Auswahlfelder sofort ab.
 */
export interface FilterBarProps {
  /** Ziel des GET-Formulars, meist der aktuelle Pfad */
  action: string;
  search?: { name?: string; value?: string; placeholder?: string; label?: string };
  chips?: TabItem[];
  chipsLabel?: string;
  /** Parameter, die beim Absenden erhalten bleiben (zum Beispiel Status-Chip, Sortierung) */
  hidden?: Record<string, string | undefined>;
  /** Link zum Zurücksetzen, wenn Filter aktiv sind */
  resetHref?: string;
  children?: ReactNode;
  className?: string;
}

export function FilterBar({
  action,
  search,
  chips,
  chipsLabel = "Statusfilter",
  hidden,
  resetHref,
  children,
  className,
}: FilterBarProps) {
  return (
    <div className={cx("flex flex-col gap-3 p-3", className)}>
      {chips?.length ? <Tabs items={chips} label={chipsLabel} variant="chip" /> : null}
      <form
        action={action}
        method="get"
        role="search"
        className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end"
      >
        <AutoSubmit />
        {hidden
          ? Object.entries(hidden).map(([k, v]) =>
              v ? <input key={k} type="hidden" name={k} value={v} /> : null,
            )
          : null}
        {search ? (
          <label className="relative flex min-w-0 flex-1 items-center md:min-w-[240px]">
            <span className="sr-only">{search.label ?? "Suchen"}</span>
            <span className="text-admin-text-2 pointer-events-none absolute left-3">
              <Icon name="suche" size={16} />
            </span>
            <input
              type="search"
              name={search.name ?? "q"}
              defaultValue={search.value}
              placeholder={search.placeholder ?? "Suchen"}
              className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte placeholder:text-admin-text-2 focus-visible:border-admin-akzent h-11 w-full border pr-3 pl-9 text-[14px] focus-visible:border-2 focus-visible:outline-none md:h-9"
            />
          </label>
        ) : null}
        {children ? (
          <div className="flex flex-col gap-2 md:flex-row md:items-end [&>*]:md:w-48">
            {children}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <button type="submit" className={buttonClasses("secondary", "md")}>
            Filtern
          </button>
          {resetHref ? (
            <Link href={resetHref} className={buttonClasses("text", "md")}>
              Zurücksetzen
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}
