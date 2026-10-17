import { Fragment } from "react";
import { SiteLink } from "@/components/layout/SiteLink";
import { WaveDivider } from "@/components/layout/WaveDivider";
import type { ShippingInfo } from "@/lib/catalog/products";
import { formatEur } from "@/lib/money";

/**
 * Kleine gemeinsame Bausteine der Katalogseiten: Eyebrow (Plum mit Magenta-Punkt),
 * Brotkrumen, Seitenband mit Welle, Fußnote zu Preisen. Alles Server-Komponenten.
 */

export function Eyebrow({
  children,
  className = "",
  as: Tag = "p",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "p" | "h2" | "h3" | "span";
  id?: string;
}) {
  return (
    <Tag id={id} className={`pvc-eyebrow ${className}`}>
      {children}
    </Tag>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Brotkrumen" className={className}>
      <ol className="text-pv-wildberry flex flex-wrap items-center gap-x-2 text-[14px] leading-[1.45] font-medium">
        {items.map((item, i) => (
          <Fragment key={`${item.label}-${i}`}>
            <li>
              {item.href && i < items.length - 1 ? (
                <SiteLink
                  href={item.href}
                  className="hover:text-pv-wildberry underline-offset-4 hover:underline"
                >
                  {item.label}
                </SiteLink>
              ) : (
                <span aria-current={i === items.length - 1 ? "page" : undefined}>{item.label}</span>
              )}
            </li>
            {i < items.length - 1 ? (
              <li aria-hidden="true" className="text-pv-wildberry">
                ›
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/** Rosa Kopfband mit Welle nach unten (Kollektion, Suche). */
export function PageBand({
  children,
  className = "",
  innerClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <section className={`pvc-band ${className}`}>
      <div
        className={`relative z-[1] mx-auto w-full max-w-[1200px] px-4 sm:px-6 ${innerClassName}`}
      >
        {children}
      </div>
      <WaveDivider shape="soft" fill="var(--pv-cream)" position="top" className="pvc-wave-inside" />
    </section>
  );
}

export function PriceFootnote({
  shipping,
  className = "",
}: {
  shipping: ShippingInfo;
  className?: string;
}) {
  return (
    <p className={`text-pv-wildberry text-[13px] leading-[1.45] ${className}`}>
      Alle Preise inkl. MwSt., zzgl.{" "}
      <SiteLink href="/pages/versand" className="underline underline-offset-2">
        Versandkosten
      </SiteLink>{" "}
      ({shippingText(shipping)}). Pfand kommt hinzu und wird getrennt ausgewiesen.
    </p>
  );
}

/** "4,90 €, ab 50,00 € versandkostenfrei" aus dem Versandtarif. */
export function shippingText(shipping: ShippingInfo): string {
  const free =
    shipping.freeAboveCents !== null
      ? `, ab ${formatEur(shipping.freeAboveCents).replace(",00", "")} versandkostenfrei`
      : "";
  return `${formatEur(shipping.priceCents)}${free}`;
}

export function SectionHead({
  eyebrow,
  title,
  id,
  aside,
  level = 2,
}: {
  eyebrow: string;
  title: string;
  id?: string;
  aside?: React.ReactNode;
  level?: 1 | 2;
}) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-8">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <H id={id} className="pvc-h2 mt-3">
          {title}
        </H>
      </div>
      {aside}
    </div>
  );
}
