import { ShieldIcon } from "./icons";

/**
 * Hinweis zur Echtheitsprüfung (UWG Anhang Nr. 23b): Wer Bewertungen zugänglich macht, muss
 * angeben, ob und wie er sicherstellt, dass sie von Personen stammen, die das Produkt gekauft
 * haben. Steht an den Bewertungen der Produktseite und auf der Bewertungsseite.
 */
export const AUTHENTICITY_TEXT =
  "Bewerten kann nur, wer bei uns bestellt hat. Wir prüfen jede Bewertung vor der Veröffentlichung.";

export function AuthenticityNote({
  className = "",
  details = false,
}: {
  className?: string;
  /** Zusätzlicher Satz zum Verfahren (Produktseite) */
  details?: boolean;
}) {
  return (
    <div
      className={`bg-butter text-aubergine flex gap-2.5 rounded-[16px] px-3.5 py-3 text-[14px] leading-[1.45] font-medium lg:text-[15px] ${className}`}
    >
      <ShieldIcon className="text-plum mt-px h-[22px] w-[22px] shrink-0" />
      <p className="m-0">
        {AUTHENTICITY_TEXT}
        {details ? (
          <span className="font-normal">
            {" "}
            Den Link zum Bewerten bekommst du nach der Lieferung per E-Mail. Wir veröffentlichen
            positive wie kritische Bewertungen und kürzen den Namen auf Vorname und Initiale.
          </span>
        ) : null}
      </p>
    </div>
  );
}
