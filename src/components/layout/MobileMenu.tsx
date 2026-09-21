"use client";

import { SiteLink } from "./SiteLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MenuItem } from "@/lib/catalog/home";
import { BurgerIcon, CloseIcon, InstagramIcon, TiktokIcon } from "./icons";
import { SOCIAL_LINKS } from "./social";

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/**
 * Mobiles Menü als modaler Drawer: Escape schließt, der Fokus bleibt im Drawer,
 * der Hintergrund scrollt nicht mit und der Fokus kehrt danach zum Burger zurück.
 * Dieselben Menüpunkte stehen zusätzlich im Server-HTML der Desktop-Navigation.
 *
 * Der Drawer hängt per Portal am Body, weil der Header einen backdrop-filter hat und
 * damit ein position: fixed darin nicht mehr am Viewport ausgerichtet wäre.
 */
export function MobileMenu({ menus }: { menus: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  const drawer = (
    <div className="pv-drawer-root">
      <button
        type="button"
        className="pv-drawer-overlay"
        aria-label="Menü schließen"
        tabIndex={-1}
        onClick={close}
      />
      <div ref={panelRef} className="pv-drawer" role="dialog" aria-modal="true" aria-label="Menü">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Menü</span>
          <button
            type="button"
            className="pv-header-icon"
            aria-label="Menü schließen"
            onClick={close}
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <nav aria-label="Hauptnavigation (mobil)">
          <ul className="mt-8 flex flex-col gap-1">
            {menus.map((item) => (
              <li key={`${item.label}-${item.url}`}>
                <SiteLink href={item.url} className="pv-drawer-link" onClick={close}>
                  {item.label}
                </SiteLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-4 pt-10">
          <span className="eyebrow">Folg uns</span>
          <div className="flex gap-3">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.url}
                target="_blank"
                rel="noreferrer noopener"
                className="pv-social"
                aria-label={`provibe auf ${social.label}`}
              >
                {social.label === "Instagram" ? (
                  <InstagramIcon className="h-5 w-5" />
                ) : (
                  <TiktokIcon className="h-5 w-5" />
                )}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="pv-header-icon lg:hidden"
        aria-label="Menü öffnen"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <BurgerIcon className="h-6 w-6" />
      </button>

      {open ? createPortal(drawer, document.body) : null}
    </>
  );
}

export default MobileMenu;
