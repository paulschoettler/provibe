import type { Route } from "next";
import Link from "next/link";

/** Infokarte "Gut zu wissen" neben dem Kündigungsformular (Figma 71:2162, 71:2602). */
export function GoodToKnow() {
  return (
    <aside className="pv-abo-know" aria-labelledby="gut-zu-wissen">
      <h2 id="gut-zu-wissen" className="flex items-center gap-2 text-[20px] font-semibold">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 11v5M12 8v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Gut zu wissen
      </h2>
      <ul className="flex flex-col gap-3 text-[15px] leading-[1.5]">
        <li>Du kannst jederzeit zum nächsten Liefertermin kündigen, ohne Frist und ohne Grund.</li>
        <li>
          Lieferungen, die schon unterwegs sind, kommen noch. Danach buchen wir nichts mehr ab.
        </li>
        <li>Mit Login geht es auch im Konto unter „Abo“.</li>
      </ul>
      <Link
        href={"/account/abo" as Route}
        className="text-plum self-start font-semibold underline underline-offset-4"
      >
        Zum Login
      </Link>
    </aside>
  );
}
