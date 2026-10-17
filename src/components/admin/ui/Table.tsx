import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { CheckboxBox } from "./fields";
import { Icon } from "./Icon";
import { SelectAllCheckbox } from "./SelectAllCheckbox";

/**
 * Tabelle nach Figma (26:4773): Kopf 40 px auf ruhiger Fläche, Zeilen 52 px (mit Bild 64 px),
 * Auswahl links, Aktionen rechts. Ab md eine echte <table>, darunter eine Kartenliste über
 * renderCard (Figma "Kartenliste mobil", 26:5105). Beides steht im Server-HTML, CSS schaltet um.
 *
 * Sortieren: Spalten mit sortable verlinken auf sortHref(key, dir). Die Seite liest ?sort und ?dir.
 * Auswahl: selection.formId verbindet die Checkboxen mit einem Formular (Sammelaktion), Name ids.
 * Tabelle und Karten haben je eine Checkbox pro Zeile (synchronisiert); die Action muss die Werte
 * deshalb entdoppeln: [...new Set(formData.getAll("ids"))].
 */
export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** feste Breite, zum Beispiel "110px"; ohne Angabe teilen sich die Spalten den Rest */
  width?: string;
  sortable?: boolean;
  /** Spalte am Desktop unter lg ausblenden */
  hideBelowLg?: boolean;
  className?: string;
}

export interface TableSort {
  key: string;
  dir: "asc" | "desc";
}

export interface TableSelection<T> {
  /** id des <form>, das die Sammelaktion ausführt */
  formId: string;
  /** Feldname der Checkboxen, Standard "ids" */
  name?: string;
  value: (row: T) => string;
  /** bereits ausgewählte Werte (zum Beispiel nach einem Fehler) */
  selected?: string[];
  label?: (row: T) => string;
}

export interface TableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Ganze Zeile verlinkt (erste Spalte bekommt den Link, Rest per Overlay klickbar) */
  rowHref?: (row: T) => string;
  /** Mobile Karte je Zeile; ohne Angabe scrollt die Tabelle mobil waagerecht */
  renderCard?: (row: T) => ReactNode;
  selection?: TableSelection<T>;
  sort?: TableSort;
  sortHref?: (key: string, dir: "asc" | "desc") => string;
  /** Leerer Zustand, zum Beispiel <EmptyState … /> */
  empty?: ReactNode;
  /** Aktionen am Zeilenende (Mehr-Menü, Icon-Buttons) */
  rowActions?: (row: T) => ReactNode;
  /** Beschriftung für Screenreader */
  caption: string;
  /** Leiste über der Tabelle (Filter, Sammelaktionen) */
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Zeilenhöhe: 52 px Standard, 64 px mit Bildern */
  density?: "default" | "media";
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function Table<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  renderCard,
  selection,
  sort,
  sortHref,
  empty,
  rowActions,
  caption,
  toolbar,
  footer,
  className,
  density = "default",
}: TableProps<T>) {
  const selName = selection?.name ?? "ids";
  const rowH = density === "media" ? "h-16" : "h-[52px]";

  return (
    <div
      className={cx(
        "rounded-admin-karte border-admin-rahmen bg-admin-karte min-w-0 overflow-hidden border",
        className,
      )}
    >
      {toolbar ? <div className="border-admin-rahmen border-b">{toolbar}</div> : null}

      {rows.length === 0 ? (
        (empty ?? (
          <p className="text-admin-text-2 px-4 py-10 text-center text-[14px]">Keine Einträge.</p>
        ))
      ) : (
        <>
          <div className={cx(renderCard ? "max-md:hidden" : "", "overflow-x-auto")}>
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="border-admin-rahmen bg-admin-flaeche h-10 border-b">
                  {selection ? (
                    <th scope="col" className="w-11 px-3">
                      <SelectAllCheckbox formId={selection.formId} name={selName} />
                    </th>
                  ) : null}
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      style={col.width ? { width: col.width } : undefined}
                      aria-sort={
                        sort?.key === col.key
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cx(
                        "text-admin-text-2 px-3 text-[13px] font-medium whitespace-nowrap",
                        ALIGN[col.align ?? "left"],
                        col.hideBelowLg && "max-lg:hidden",
                      )}
                    >
                      {col.sortable && sortHref ? (
                        <SortLink col={col} sort={sort} sortHref={sortHref} />
                      ) : (
                        col.header
                      )}
                    </th>
                  ))}
                  {rowActions ? (
                    <th scope="col" className="w-14 px-3">
                      <span className="sr-only">Aktionen</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = rowHref?.(row);
                  const value = selection?.value(row);
                  return (
                    <tr
                      key={rowKey(row)}
                      className={cx(
                        rowH,
                        "border-admin-rahmen has-[input[data-row-select]:checked]:bg-admin-akzent-hell relative border-b last:border-b-0",
                        href && "hover:bg-admin-hintergrund",
                      )}
                    >
                      {selection && value !== undefined ? (
                        <td className="relative z-10 w-11 px-3">
                          <CheckboxBox
                            form={selection.formId}
                            name={selName}
                            value={value}
                            defaultChecked={selection.selected?.includes(value)}
                            data-row-select=""
                            aria-label={
                              selection.label ? selection.label(row) : `Zeile ${value} auswählen`
                            }
                          />
                        </td>
                      ) : null}
                      {columns.map((col, i) => (
                        <td
                          key={col.key}
                          className={cx(
                            "px-3 py-2",
                            ALIGN[col.align ?? "left"],
                            col.hideBelowLg && "max-lg:hidden",
                            col.className,
                          )}
                        >
                          {href && i === 0 ? (
                            <Link
                              href={href}
                              className="font-bold after:absolute after:inset-0 after:content-[''] hover:underline"
                            >
                              {col.cell(row)}
                            </Link>
                          ) : (
                            col.cell(row)
                          )}
                        </td>
                      ))}
                      {rowActions ? (
                        <td className="relative z-10 w-14 px-3 text-right">{rowActions(row)}</td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {renderCard ? (
            <ul className="bg-admin-hintergrund flex flex-col gap-2 p-2 md:hidden">
              {rows.map((row) => {
                const href = rowHref?.(row);
                const value = selection?.value(row);
                return (
                  <li
                    key={rowKey(row)}
                    className="rounded-admin-karte border-admin-rahmen bg-admin-karte has-[input[data-row-select]:checked]:border-admin-akzent has-[input[data-row-select]:checked]:bg-admin-akzent-hell relative border"
                  >
                    {selection && value !== undefined ? (
                      <span className="absolute top-3 right-3 z-10">
                        <CheckboxBox
                          form={selection.formId}
                          name={selName}
                          value={value}
                          data-row-select=""
                          aria-label={
                            selection.label ? selection.label(row) : `Zeile ${value} auswählen`
                          }
                        />
                      </span>
                    ) : null}
                    {href ? (
                      <Link href={href} className={cx("block p-4", selection && "pr-12")}>
                        {renderCard(row)}
                      </Link>
                    ) : (
                      <div className={cx("p-4", selection && "pr-12")}>{renderCard(row)}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
      {footer ? <div className="border-admin-rahmen border-t px-3">{footer}</div> : null}
    </div>
  );
}

function SortLink<T>({
  col,
  sort,
  sortHref,
}: {
  col: Column<T>;
  sort?: TableSort;
  sortHref: (key: string, dir: "asc" | "desc") => string;
}) {
  const active = sort?.key === col.key;
  const nextDir = active && sort?.dir === "asc" ? "desc" : "asc";
  return (
    <Link
      href={sortHref(col.key, nextDir)}
      scroll={false}
      className={cx(
        "hover:text-admin-text inline-flex items-center gap-1",
        col.align === "right" && "flex-row-reverse",
        active && "text-admin-text",
      )}
    >
      {col.header}
      <span
        className={cx(
          active ? "opacity-100" : "opacity-40",
          active && sort?.dir === "asc" && "rotate-180",
        )}
      >
        <Icon name="chevron-unten" size={14} />
      </span>
    </Link>
  );
}

/**
 * Bausteine für mobile Karten (Figma 26:5105): Zeile 1 fett mit Betrag rechts,
 * Zeile 2 sekundär, Zeile 3 Badges und Chevron.
 */
export function CardRow({
  primary,
  aside,
  secondary,
  secondaryAside,
  badges,
}: {
  primary: ReactNode;
  aside?: ReactNode;
  secondary?: ReactNode;
  secondaryAside?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-[16px] font-bold">
        <span className="min-w-0 flex-1 truncate">{primary}</span>
        {aside ? <span className="shrink-0 tabular-nums">{aside}</span> : null}
      </div>
      {secondary || secondaryAside ? (
        <div className="text-admin-text-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px]">{secondary}</span>
          {secondaryAside ? <span className="shrink-0 text-[13px]">{secondaryAside}</span> : null}
        </div>
      ) : null}
      {badges ? (
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{badges}</div>
          <Icon name="chevron-rechts" size={18} className="text-admin-text-2" />
        </div>
      ) : null}
    </div>
  );
}
