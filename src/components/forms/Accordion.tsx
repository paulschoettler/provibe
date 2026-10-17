import type { ReactNode } from "react";

export interface AccordionItem {
  /** Stabiler Schlüssel, zugleich Anker-id */
  id: string;
  question: ReactNode;
  answer: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** id des Eintrags, der beim Laden offen ist */
  defaultOpenId?: string;
  /** Überschriftenebene der Fragen für die Dokumentstruktur */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/**
 * Akkordeon nach Figma (Baustein 21:246) mit <details>/<summary>: funktioniert ohne
 * JavaScript, ist per Tastatur bedienbar (Enter/Leertaste) und wird von Screenreadern
 * als aufklappbar angesagt. Alle Antworten stehen im Server-HTML.
 * Plus/Minus im Pink-Light-Kreis rechts, Trennlinie Aubergine 15 %.
 */
export function Accordion({
  items,
  defaultOpenId,
  headingLevel = 3,
  className = "",
}: AccordionProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={`pv-accordion ${className}`}>
      {items.map((item) => (
        <details
          key={item.id}
          id={item.id}
          className="pv-accordion-item"
          open={item.id === defaultOpenId}
        >
          <summary className="pv-accordion-summary">
            <Heading className="pv-accordion-question">{item.question}</Heading>
            <span className="pv-accordion-symbol" aria-hidden="true">
              <svg
                className="pv-accordion-plus"
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
              >
                <path
                  d="M9 3.75V14.25M3.75 9H14.25"
                  stroke="var(--pv-wildberry)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <svg
                className="pv-accordion-minus"
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
              >
                <path
                  d="M3.75 9H14.25"
                  stroke="var(--pv-wildberry)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </summary>
          <div className="pv-accordion-answer">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

export default Accordion;
