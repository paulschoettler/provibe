import type { ReactNode } from "react";
import { Badge } from "@/components/admin/ui/Badge";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { cx } from "@/components/admin/ui/cx";
import { Icon } from "@/components/admin/ui/Icon";

/** Status von Seiten, Blogbeiträgen und Rechtstext-Versionen. */
export function PublishBadge({
  status,
  upcoming,
}: {
  status: "draft" | "published" | "archived";
  upcoming?: boolean;
}) {
  if (status === "published" && upcoming)
    return (
      <Badge tone="blue" hollow>
        Geplant
      </Badge>
    );
  if (status === "published") return <Badge tone="green">Veröffentlicht</Badge>;
  if (status === "archived")
    return (
      <Badge tone="gray" hollow>
        Archiviert
      </Badge>
    );
  return <Badge tone="gray">Entwurf</Badge>;
}

/** Hinweis für Rollen, die Inhalte oder Einstellungen nur lesen dürfen. */
export function ReadOnlyNotice({ what = "Inhalte" }: { what?: string }) {
  return (
    <FormMessage tone="info">
      {what} ändern dürfen nur Owner und Admin. Du siehst alles, kannst aber nichts speichern.
    </FormMessage>
  );
}

/** Gelbe Hinweisbox wie in Figma (Warnung am Kartenende), ohne role=alert. */
export function Hint({
  children,
  tone = "warning",
  className,
}: {
  children: ReactNode;
  tone?: "warning" | "info" | "accent";
  className?: string;
}) {
  const styles = {
    warning: "bg-admin-gelb-hell text-admin-text [&_svg]:text-admin-gelb",
    info: "bg-admin-blau-hell text-admin-text [&_svg]:text-admin-blau",
    accent: "bg-admin-akzent-hell text-admin-text [&_svg]:text-admin-akzent",
  }[tone];
  return (
    <div
      className={cx(
        "rounded-admin-feld flex items-start gap-2.5 p-3 text-[13px]",
        styles,
        className,
      )}
    >
      <span className="mt-px shrink-0">
        <Icon name="info" size={16} />
      </span>
      <div className="min-w-0 flex-1 leading-[1.5]">{children}</div>
    </div>
  );
}

/** Schlüssel-Wert-Zeile in Statuskarten (Figma "Status", "Consent-Banner"). */
export function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="border-admin-rahmen flex items-baseline justify-between gap-3 border-b py-2.5 text-[13px] last:border-b-0">
      <dt className="text-admin-text-2">{label}</dt>
      <dd className="text-right font-bold">{children}</dd>
    </div>
  );
}
