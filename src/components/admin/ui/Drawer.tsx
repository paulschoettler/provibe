"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "./Button";
import { cx } from "./cx";
import { DialogContext, useFocusTrap, type DialogTrigger } from "./Dialog";
import { Icon } from "./Icon";

/**
 * Seitenpanel (Detail ohne Seitenwechsel, zum Beispiel Protokolleintrag). Zwei Arten:
 *
 * 1. Über die URL gesteuert (empfohlen für Details, teilbar, ohne JavaScript nutzbar):
 *      <Drawer open={Boolean(eintrag)} closeHref={withParams(path, sp, { eintrag: null })} title="…">…</Drawer>
 *    Die Seite rendert den Inhalt serverseitig; Schließen führt zu closeHref.
 *
 * 2. Mit Auslöser wie ein Dialog: <Drawer trigger={{ label: "Filter" }} title="Filter">…</Drawer>
 *
 * Basis ist <dialog> mit showModal() (Hintergrund inert, Esc schließt) plus Fokusfalle.
 */
export interface DrawerProps {
  title: string;
  description?: ReactNode;
  open?: boolean;
  closeHref?: string;
  trigger?: DialogTrigger;
  side?: "right" | "left";
  /** Breite am Desktop, Standard 480 px */
  width?: "sm" | "md" | "lg";
  footer?: ReactNode;
  /** Kopf ausblenden (eigener Kopf, zum Beispiel mobile Navigation) */
  bare?: boolean;
  className?: string;
  children: ReactNode;
}

const WIDTHS = { sm: "md:w-[360px]", md: "md:w-[480px]", lg: "md:w-[640px]" };

export function Drawer({
  title,
  description,
  open: openProp,
  closeHref,
  trigger,
  side = "right",
  width = "md",
  footer,
  bare,
  className,
  children,
}: DrawerProps) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [openState, setOpenState] = useState(Boolean(openProp));
  const open = trigger ? openState : Boolean(openProp);
  const titleId = useId();
  const trap = useFocusTrap(ref);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      // Serverseitig mit open gerendert: erst schließen, dann modal öffnen
      if (el.open && !el.matches(":modal")) el.close();
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  const close = useCallback(() => {
    if (trigger) setOpenState(false);
    else if (closeHref) router.replace(closeHref, { scroll: false });
    else ref.current?.close();
  }, [trigger, closeHref, router]);

  const closeControl =
    closeHref && !trigger ? (
      <Link
        href={closeHref}
        scroll={false}
        replace
        aria-label="Panel schließen"
        className="rounded-admin-feld hover:bg-admin-flaeche flex size-11 shrink-0 items-center justify-center"
      >
        <Icon name="schliessen" size={20} />
      </Link>
    ) : (
      <button
        type="button"
        onClick={close}
        aria-label="Panel schließen"
        className="rounded-admin-feld hover:bg-admin-flaeche flex size-11 shrink-0 items-center justify-center"
      >
        <Icon name="schliessen" size={20} />
      </button>
    );

  return (
    <>
      {trigger ? (
        <Button
          variant={trigger.variant ?? "secondary"}
          icon={trigger.icon}
          block={trigger.block}
          className={trigger.className}
          aria-haspopup="dialog"
          onClick={() => setOpenState(true)}
        >
          {trigger.label}
        </Button>
      ) : null}
      <dialog
        ref={ref}
        open={!trigger && open ? true : undefined}
        aria-labelledby={titleId}
        onClose={() => {
          if (trigger) setOpenState(false);
          else if (closeHref && openProp) router.replace(closeHref, { scroll: false });
        }}
        onCancel={(e) => {
          if (!trigger && closeHref) {
            e.preventDefault();
            close();
          }
        }}
        onKeyDown={trap}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className={cx(
          "admin-drawer bg-admin-karte text-admin-text shadow-admin-karte fixed inset-y-0 z-50 m-0 h-dvh max-h-dvh w-full max-w-full overflow-hidden p-0",
          side === "right"
            ? "right-0 left-auto ml-auto"
            : "admin-drawer--links right-auto left-0 mr-auto",
          WIDTHS[width],
          className,
        )}
      >
        <DialogContext.Provider value={{ close }}>
          {open ? (
            <div className="flex h-full flex-col">
              {bare ? (
                <h2 id={titleId} className="sr-only">
                  {title}
                </h2>
              ) : (
                <div className="border-admin-rahmen flex items-start gap-2 border-b py-2 pr-2 pl-5">
                  <div className="min-w-0 flex-1 py-2.5">
                    <h2 id={titleId} className="text-[18px] leading-[1.4] font-semibold">
                      {title}
                    </h2>
                    {description ? (
                      <p className="text-admin-text-2 mt-0.5 text-[13px]">{description}</p>
                    ) : null}
                  </div>
                  {closeControl}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
              {footer ? (
                <div className="border-admin-rahmen flex items-center justify-end gap-2 border-t px-5 py-4">
                  {footer}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContext.Provider>
      </dialog>
    </>
  );
}
