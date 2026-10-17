import type { ReactNode } from "react";
import { cx } from "@/components/admin/ui/cx";
import { Icon } from "@/components/admin/ui/Icon";

/**
 * Kleine Bausteine der CRM-Seiten: Schlüssel-Wert-Liste (Figma "Kontakt", "Newsletter"),
 * Mail-Vorschau im iframe (srcdoc, serverseitig gerendert) und Testmodus-Hinweis.
 */

export function InfoList({
  rows,
  className,
}: {
  rows: { label: ReactNode; value: ReactNode; key?: string }[];
  className?: string;
}) {
  return (
    <dl className={cx("divide-admin-rahmen flex flex-col divide-y text-[14px]", className)}>
      {rows.map((r, i) => (
        <div
          key={r.key ?? (typeof r.label === "string" ? r.label : i)}
          className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
        >
          <dt className="text-admin-text-2 text-[13px]">{r.label}</dt>
          <dd className="min-w-0 text-right font-semibold break-words">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Vorschau einer E-Mail. sandbox ohne allow-scripts: das HTML kann nichts ausführen und erreicht
 * die Admin-Seite nicht. Links öffnen nicht im Backoffice.
 */
export function MailPreview({
  html,
  title,
  height = 720,
  className,
  id,
}: {
  html: string;
  title: string;
  height?: number;
  className?: string;
  id?: string;
}) {
  return (
    <iframe
      id={id}
      title={title}
      srcDoc={html}
      sandbox=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className={cx("rounded-admin-feld border-admin-rahmen w-full border bg-white", className)}
      style={{ height }}
    />
  );
}

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warning" | "accent";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    info: "bg-admin-blau-hell text-admin-text [&_svg]:text-admin-blau",
    warning: "bg-admin-gelb-hell text-admin-text [&_svg]:text-admin-gelb",
    accent: "bg-admin-akzent-hell text-admin-text [&_svg]:text-admin-akzent",
  }[tone];
  return (
    <div
      role="note"
      className={cx(
        "rounded-admin-feld flex items-start gap-2.5 px-3 py-2.5 text-[13px] leading-[1.5]",
        styles,
        className,
      )}
    >
      <span className="mt-0.5">
        <Icon name={tone === "warning" ? "warnung" : "info"} size={16} />
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Kennzahl-Karte im Stil der Figma-Kacheln (Label, großer Wert, Zusatz). */
export function KpiCard({
  label,
  value,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-admin-karte border-admin-rahmen bg-admin-karte min-w-0 border p-4">
      <p className="text-admin-text-2 text-[13px]">{label}</p>
      <p className="mt-1 truncate text-[22px] leading-[1.25] font-semibold tabular-nums md:text-[26px]">
        {value}
      </p>
      {hint ? <p className="text-admin-text-2 mt-1 line-clamp-2 text-[12px]">{hint}</p> : null}
    </div>
  );
}
