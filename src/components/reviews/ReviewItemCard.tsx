import Image from "next/image";
import { Notice } from "@/components/forms";
import type { ReviewFormItem } from "@/lib/reviews/types";
import { ReviewForm } from "./ReviewForm";
import { StarRating } from "./StarRating";

const STATUS_LABEL = {
  pending: "In Prüfung",
  approved: "Veröffentlicht",
  rejected: "Nicht veröffentlicht",
} as const;

/**
 * Karte je Produkt der Bestellung (Figma 89:1795 / 89:1838): Produktkopf, dann entweder das
 * Formular oder die bestehende Bewertung mit Status und "Bewertung ändern" (details/summary,
 * ohne JavaScript bedienbar). Nach dem Speichern steht oben der Erfolgshinweis.
 */
export function ReviewItemCard({
  item,
  token,
  justSaved,
}: {
  item: ReviewFormItem;
  token: string;
  justSaved: boolean;
}) {
  const existing = item.existing;
  const headingId = `produkt-${item.productId}-titel`;
  return (
    <section
      id={`produkt-${item.productId}`}
      aria-labelledby={headingId}
      className="bg-cream-2 flex scroll-mt-28 flex-col gap-5 rounded-[26px] px-[18px] pt-[22px] pb-6 lg:gap-[22px] lg:px-9 lg:pt-8 lg:pb-9"
    >
      <div className="flex items-center gap-3.5 lg:gap-[18px]">
        <span
          className="relative flex h-16 w-16 shrink-0 items-end justify-center overflow-hidden rounded-[16px] lg:h-20 lg:w-20 lg:rounded-[18px]"
          style={{ background: item.tint }}
          aria-hidden="true"
        >
          {item.image ? (
            <Image
              src={item.image.src}
              alt=""
              width={item.image.width}
              height={item.image.height}
              sizes="80px"
              className="h-[90%] w-auto object-contain"
            />
          ) : null}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5 lg:gap-1">
          <h2
            id={headingId}
            className="text-wine m-0 text-[22px] leading-[1.15] font-semibold lg:text-[28px]"
          >
            {item.title}
          </h2>
          {item.meta ? (
            <p className="text-plum m-0 text-[14px] leading-[1.4] lg:text-[15px]">{item.meta}</p>
          ) : null}
          {existing ? (
            <span className="bg-butter text-aubergine mt-1 self-start rounded-full px-2.5 py-1 text-[13px] leading-none font-semibold">
              {STATUS_LABEL[existing.status]}
            </span>
          ) : null}
        </div>
      </div>

      {existing ? (
        <>
          {justSaved ? (
            <Notice variant="success" title="Danke, gespeichert.">
              <p>
                Wir lesen deine Bewertung und schalten sie danach frei. Du kannst sie bis dahin noch
                ändern.
              </p>
            </Notice>
          ) : existing.status === "rejected" ? (
            <Notice variant="info" title="Diese Fassung haben wir nicht veröffentlicht.">
              <p>Du kannst sie überarbeiten, dann prüfen wir sie noch einmal.</p>
            </Notice>
          ) : null}
          <figure className="bg-cream m-0 flex flex-col gap-2 rounded-[16px] px-4 py-3.5 lg:px-5 lg:py-4">
            <StarRating value={existing.rating} size={18} />
            {existing.title ? (
              <p className="text-wine m-0 text-[16px] font-semibold lg:text-[17px]">
                {existing.title}
              </p>
            ) : null}
            {existing.body ? (
              <blockquote className="m-0 text-[15px] leading-[1.45] whitespace-pre-line lg:text-[16px]">
                {existing.body}
              </blockquote>
            ) : null}
          </figure>
          <details className="pv-review-edit">
            <summary className="pv-btn-secondary">Bewertung ändern</summary>
            <div className="pt-5">
              <ReviewForm
                token={token}
                productId={item.productId}
                productTitle={item.title}
                defaults={existing}
                submitLabel="Änderung speichern"
              />
            </div>
          </details>
        </>
      ) : (
        <ReviewForm token={token} productId={item.productId} productTitle={item.title} />
      )}
    </section>
  );
}
