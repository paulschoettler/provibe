import { SiteLink } from "@/components/layout/SiteLink";
import { ArrowRightIcon, Blob, CupIcon, SearchLineIcon, ShirtIcon } from "./icons";

/**
 * Leerzustand (Figma Kollektion leer 27:853, Suche leer 38:3850): Blob mit Icon, Überschrift,
 * Text, Weg zurück zu allen Produkten.
 */
export function EmptyState({
  title,
  text,
  icon = "search",
  children,
  headingLevel = 2,
}: {
  title: string;
  text: React.ReactNode;
  icon?: "search" | "merch";
  children?: React.ReactNode;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="mx-auto flex max-w-[520px] flex-col items-center py-12 text-center lg:py-16">
      <div className="pvc-empty-blob" aria-hidden="true">
        <Blob />
        <span className="relative flex items-center gap-4">
          {icon === "merch" ? (
            <>
              <ShirtIcon className="h-12 w-12" />
              <CupIcon className="h-11 w-11" />
            </>
          ) : (
            <SearchLineIcon className="h-12 w-12" />
          )}
        </span>
      </div>
      <H className="mt-6 text-[28px] leading-[1.1] font-medium tracking-[-0.02em] lg:text-[34px]">
        {title}
      </H>
      <div className="mt-3 text-[16px] leading-[1.5]">{text}</div>
      {children}
      <SiteLink href="/collections/all" className="btn-primary mt-6">
        <ArrowRightIcon className="h-4 w-4" />
        Alle Produkte ansehen
      </SiteLink>
    </div>
  );
}

export default EmptyState;
