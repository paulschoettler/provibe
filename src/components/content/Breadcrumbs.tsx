import { SiteLink } from "@/components/layout/SiteLink";
import { JsonLd, breadcrumbJsonLd } from "./JsonLd";

/** Brotkrumen nach Figma (Rechtstext, Widerruf) mit BreadcrumbList im JSON-LD. */
export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  const all = [{ name: "Startseite", path: "/" }, ...items];
  return (
    <nav aria-label="Brotkrumen" className="pv-breadcrumbs">
      <ol>
        {all.map((item, i) =>
          i < all.length - 1 ? (
            <li key={item.path}>
              <SiteLink href={item.path}>{item.name}</SiteLink>
            </li>
          ) : (
            <li key={item.path} aria-current="page">
              {item.name}
            </li>
          ),
        )}
      </ol>
      <JsonLd data={breadcrumbJsonLd(all)} />
    </nav>
  );
}

export default Breadcrumbs;
