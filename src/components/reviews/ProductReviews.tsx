import { Eyebrow } from "@/components/catalog/parts";
import { formatAverage, formatReviewDate, type RatingValue } from "@/lib/reviews/logic";
import type { ProductReviews as ProductReviewsData, PublicReview } from "@/lib/reviews/types";
import { AuthenticityNote } from "./AuthenticityNote";
import { CheckIcon } from "./icons";
import { StarRating } from "./StarRating";

/** Sichtbar ohne Aufklappen; der Rest steht in einem details-Element (ohne JavaScript bedienbar). */
const VISIBLE = 6;

/**
 * Abschnitt "Bewertungen" der Produktseite (Figma "Produkt Bewertungen / Mobil" 92:1983,
 * leer 92:2108). Wird nur mit mindestens einer freigegebenen Bewertung voll gerendert, sonst
 * steht dort eine Zeile mit dem Hinweis, wie man bewerten kann.
 */
export function ProductReviews({ data }: { data: ProductReviewsData }) {
  const { summary, reviews } = data;
  if (summary.count === 0 || summary.averageRounded === null || reviews.length === 0) {
    return (
      <section
        id="bewertungen"
        aria-label="Bewertungen"
        className="mx-auto w-full max-w-[1200px] px-4 sm:px-6"
      >
        <p className="text-pv-wildberry m-0 text-[15px] leading-[1.5]">
          Noch keine Bewertungen. Nach deiner Bestellung bekommst du von uns einen Link zum
          Bewerten.
        </p>
      </section>
    );
  }

  const visible = reviews.slice(0, VISIBLE);
  const more = reviews.slice(VISIBLE);
  const countText = summary.count === 1 ? "1 Bewertung" : `${summary.count} Bewertungen`;

  return (
    <section
      id="bewertungen"
      aria-labelledby="bewertungen-titel"
      className="mx-auto w-full max-w-[1200px] scroll-mt-28 px-4 sm:px-6"
    >
      <div className="mb-5 flex flex-col gap-2.5 lg:mb-8">
        <Eyebrow>Bewertungen</Eyebrow>
        <h2 id="bewertungen-titel" className="pvc-h2">
          Das sagen andere
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="flex flex-col gap-5 lg:sticky lg:top-28">
          <div className="bg-pv-cream flex flex-col gap-[18px] rounded-[26px] px-5 py-[22px]">
            <div className="flex items-center gap-4">
              <p className="text-pv-wildberry m-0 text-[56px] leading-none font-bold tracking-[-0.02em]">
                <span className="sr-only">Durchschnitt </span>
                {formatAverage(summary.averageRounded)}
                <span className="sr-only"> von 5 Sternen</span>
              </p>
              <div className="flex flex-col gap-1.5">
                <StarRating value={summary.averageRounded} size={22} />
                <p className="text-pv-wildberry m-0 text-[14px]">Durchschnitt aus {countText}</p>
              </div>
            </div>
            <Distribution distribution={summary.distribution} total={summary.count} />
          </div>
          <AuthenticityNote details />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {visible.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </ul>
          {more.length ? (
            <details className="pv-review-more">
              <summary className="pv-btn-secondary self-start">
                {`Alle ${reviews.length} Bewertungen anzeigen`}
              </summary>
              <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
                {more.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Distribution({
  distribution,
  total,
}: {
  distribution: Record<RatingValue, number>;
  total: number;
}) {
  const rows: RatingValue[] = [5, 4, 3, 2, 1];
  return (
    <table className="w-full border-collapse text-[14px]">
      <caption className="sr-only">Verteilung der Sterne</caption>
      <tbody>
        {rows.map((n) => {
          const count = distribution[n];
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <tr key={n}>
              <th
                scope="row"
                className="w-[72px] py-1 pr-2.5 text-left font-medium whitespace-nowrap"
              >
                {n} {n === 1 ? "Stern" : "Sterne"}
              </th>
              <td className="py-1">
                <span
                  className="bg-pv-cream block h-2.5 overflow-hidden rounded-full"
                  aria-hidden="true"
                >
                  <span
                    className="bg-pv-wildberry block h-full rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </td>
              <td className="text-pv-wildberry w-8 py-1 pl-2.5 text-right tabular-nums">{count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ReviewCard({ review: r }: { review: PublicReview }) {
  return (
    <li>
      <article className="border-pv-ui-hairline bg-pv-cream flex flex-col gap-2.5 rounded-[20px] border-[1.5px] p-[18px] lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <StarRating value={r.rating} size={18} />
          <time dateTime={r.createdAt} className="text-pv-wildberry text-[13px]">
            {formatReviewDate(r.createdAt)}
          </time>
        </div>
        {r.title ? (
          <h3 className="text-pv-wildberry m-0 text-[17px] leading-[1.25] font-medium">
            {r.title}
          </h3>
        ) : null}
        {r.body ? (
          <p className="m-0 text-[15px] leading-[1.5] whitespace-pre-line">{r.body}</p>
        ) : null}
        <p className="m-0 flex flex-wrap items-center gap-2.5 text-[14px]">
          <span className="font-bold">{r.authorName}</span>
          {r.verified ? (
            <span className="bg-pv-cream text-pv-wildberry inline-flex items-center gap-1 rounded-full py-[3px] pr-2.5 pl-2 text-[12px] font-bold">
              <CheckIcon className="h-3.5 w-3.5" />
              Verifizierter Kauf
            </span>
          ) : null}
        </p>
        {r.reply ? (
          <div className="bg-pv-cream rounded-[14px] px-3.5 py-3">
            <p className="text-pv-wildberry m-0 text-[13px] font-bold">Antwort von provibe</p>
            <p className="m-0 mt-1 text-[14px] leading-[1.5] whitespace-pre-line">{r.reply}</p>
          </div>
        ) : null}
      </article>
    </li>
  );
}
