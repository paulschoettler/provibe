"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Dialog des Abo-Portals (Figma 68:1101 Pausieren, 68:1287 Kündigen). Der Server rendert ihn
 * geöffnet, wenn ?dialog=... in der URL steht; so funktioniert er ohne JavaScript (Schließen ist
 * ein Link). Mit JavaScript: Fokus in den Dialog, Fokusfalle, Esc schließt, Hintergrund scrollt nicht.
 */
export function AboDialog({
  title,
  closeHref,
  children,
  id = "abo-dialog",
}: {
  title: string;
  closeHref: string;
  children: ReactNode;
  id?: string;
}) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea, select',
        ),
      ).filter((el) => !el.closest("[aria-hidden='true']"));
    (node.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0])?.focus();
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        router.replace(closeHref as Route, { scroll: false });
      }
      if (event.key === "Tab") {
        const list = focusables();
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = body;
      previous?.focus?.();
    };
  }, [closeHref, router]);

  return (
    <div className="pv-abo-dialog" role="presentation">
      <Link
        href={closeHref as Route}
        scroll={false}
        className="pv-abo-dialog__backdrop"
        aria-label="Dialog schließen"
        tabIndex={-1}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titel`}
        className="pv-abo-dialog__panel"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${id}-titel`} className="text-[24px] leading-[1.2] font-semibold lg:text-[28px]">
            {title}
          </h2>
          <Link
            href={closeHref as Route}
            scroll={false}
            className="bg-cream-2 hover:bg-sand flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-label="Schließen"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
