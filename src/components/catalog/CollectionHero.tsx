import Image from "next/image";
import { CanTrio } from "./CanTrio";
import { Blob } from "./icons";
import { Breadcrumbs, Eyebrow, PageBand, type Crumb } from "./parts";

/**
 * Kopf der Kollektionsseiten (Figma 27:553 / 27:5966): rosa Band, Brotkrumen, Eyebrow
 * "Kollektion", H1 aus der Datenbank, Beschreibung, Dosenmotiv rechts.
 */
export function CollectionHero({
  crumbs,
  eyebrow = "Kollektion",
  title,
  descriptionHtml,
  description,
  motif = "trio",
}: {
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  descriptionHtml?: string | null;
  description?: string;
  motif?: "trio" | "peach";
}) {
  return (
    <PageBand innerClassName="grid items-center gap-4 lg:grid-cols-[1fr_auto]">
      <div className="max-w-[640px] pr-24 sm:pr-0">
        <Breadcrumbs items={crumbs} />
        <Eyebrow className="mt-3">{eyebrow}</Eyebrow>
        <h1 className="mt-2 text-[40px] leading-[1] font-medium tracking-[-0.02em] lg:text-[72px]">
          {title}
        </h1>
        {descriptionHtml ? (
          <div
            className="pvc-richtext mt-3 text-[17px] leading-[1.5] lg:mt-5 lg:text-[20px]"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        ) : description ? (
          <p className="mt-3 text-[17px] leading-[1.5] lg:mt-5 lg:text-[20px]">{description}</p>
        ) : null}
      </div>
      <div
        className="pointer-events-none absolute top-0 right-[-24px] h-[170px] w-[150px] sm:right-4 lg:relative lg:top-auto lg:right-auto lg:h-[280px] lg:w-[380px]"
        aria-hidden="true"
      >
        <Blob className="text-pv-peach absolute inset-0 h-full w-full" />
        {motif === "trio" ? (
          <div className="relative hidden h-full items-center justify-center lg:flex">
            <CanTrio sizes="160px" className="[--trio-h:230px]" />
          </div>
        ) : null}
        <Image
          src="/images/cans/peach.webp"
          alt=""
          width={405}
          height={760}
          sizes="120px"
          className={`relative mx-auto mt-4 h-[140px] w-auto rotate-[18deg] drop-shadow-[0_10px_14px_var(--pv-ui-shadow-strong)] lg:h-[260px] ${motif === "trio" ? "lg:hidden" : ""}`}
        />
      </div>
    </PageBand>
  );
}

export default CollectionHero;
