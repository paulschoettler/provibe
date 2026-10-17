"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/components/admin/ui/Dialog";
import { Icon } from "@/components/admin/ui/Icon";
import type { NavLink } from "./nav-shared";
import { SidebarContent, type ShellUser } from "./Sidebar";

/**
 * Mobile Navigation (Figma 26:5224): Burger öffnet die Seitenleiste als Drawer von links
 * (300 px, Abdunklung, Schließen-Button rechts daneben). Natives <dialog> mit Fokusfalle;
 * schließt bei Esc, Klick auf die Abdunklung und beim Navigieren.
 */
export function MobileNav({ items, user }: { items: NavLink[]; user: ShellUser }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const trap = useFocusTrap(ref);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Navigation öffnen"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="rounded-admin-feld hover:bg-admin-flaeche flex size-11 shrink-0 items-center justify-center lg:hidden"
      >
        <Icon name="menue" size={22} />
      </button>
      <dialog
        ref={ref}
        aria-label="Navigation"
        onClose={close}
        onKeyDown={trap}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className="admin-drawer admin-drawer--links fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-[300px] max-w-[calc(100%-56px)] overflow-visible bg-transparent p-0 lg:hidden"
      >
        {open ? (
          <div className="relative h-full">
            <SidebarContent items={items} user={user} onNavigate={close} />
            <button
              type="button"
              onClick={close}
              aria-label="Navigation schließen"
              className="rounded-admin-feld absolute top-3 -right-[56px] flex size-11 items-center justify-center text-white hover:bg-white/10"
            >
              <Icon name="schliessen" size={20} />
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
