"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Button, type ButtonVariant } from "./Button";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

/**
 * Modaler Dialog nach Figma (26:5144) auf Basis von <dialog> mit showModal():
 * Hintergrund inert, Esc schließt, Fokus kehrt zum Auslöser zurück. Zusätzlich hält eine
 * Fokusfalle Tab und Umschalt+Tab im Dialog (WAI-ARIA Dialog Pattern).
 *
 * Aus Server Components nutzbar, Inhalte als children:
 *
 *   <Dialog title="Benutzer einladen" description="…" trigger={{ label: "Benutzer einladen", variant: "primary" }}>
 *     <ActionForm action={inviteStaffAction} closeDialogOnSuccess>
 *       <DialogBody>…Felder…</DialogBody>
 *       <DialogFooter><DialogClose>Abbrechen</DialogClose><SubmitButton>Einladung senden</SubmitButton></DialogFooter>
 *     </ActionForm>
 *   </Dialog>
 */

interface DialogContextValue {
  close: () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

/** Schließen-Funktion des umgebenden Dialogs oder Drawers (null außerhalb). */
export function useDialog(): DialogContextValue | null {
  return useContext(DialogContext);
}

export { DialogContext };

/** Ziel für den Anfangsfokus: [data-autofocus] oder das erste sichtbare Eingabefeld */
const AUTOFOCUS =
  '[data-autofocus], input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tab-Taste im Container halten. Gibt den Handler für onKeyDown zurück. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>) {
  return useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Tab" || !ref.current) return;
      const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [ref],
  );
}

export interface DialogTrigger {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  className?: string;
  block?: boolean;
}

export interface DialogProps {
  title: string;
  description?: ReactNode;
  /** Button, der den Dialog öffnet. Ohne trigger steuert defaultOpen das Öffnen. */
  trigger?: DialogTrigger;
  defaultOpen?: boolean;
  /** Gesteuert von außen (zum Beispiel aus einem Aktionsmenü); dann onOpenChange setzen */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Beim Schließen aufgerufen (zum Beispiel Suchparameter entfernen) */
  onClose?: () => void;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const SIZES = { sm: "md:w-[400px]", md: "md:w-[480px]", lg: "md:w-[640px]" };

export function Dialog({
  title,
  description,
  trigger,
  defaultOpen,
  open: openProp,
  onOpenChange,
  onClose,
  size = "md",
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [openState, setOpenState] = useState(Boolean(defaultOpen));
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = useCallback(
    (value: boolean) => {
      if (!controlled) setOpenState(value);
      onOpenChange?.(value);
    },
    [controlled, onOpenChange],
  );
  const titleId = useId();
  const descId = useId();
  const trap = useFocusTrap(ref);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Erstes Eingabefeld fokussieren (Formulare), sonst bleibt der Fokus auf "Schließen"
      el.querySelector<HTMLElement>(AUTOFOCUS)?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <>
      {trigger ? (
        <Button
          variant={trigger.variant ?? "secondary"}
          icon={trigger.icon}
          block={trigger.block}
          className={trigger.className}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          {trigger.label}
        </Button>
      ) : null}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        onKeyDown={trap}
        onClick={(e) => {
          // Klick auf die Abdunklung schließt (nur wenn direkt das <dialog> getroffen wurde)
          if (e.target === ref.current) close();
        }}
        className={cx(
          "admin-dialog rounded-admin-dialog bg-admin-karte text-admin-text shadow-admin-karte m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] overflow-hidden p-0",
          SIZES[size],
        )}
      >
        <DialogContext.Provider value={{ close }}>
          {open ? (
            <div className="flex max-h-[calc(100dvh-32px)] flex-col">
              <div className="border-admin-rahmen flex items-start gap-2 border-b py-3 pr-2 pl-5">
                <div className="min-w-0 flex-1 py-1.5">
                  <h2 id={titleId} className="text-[18px] leading-[1.4] font-bold">
                    {title}
                  </h2>
                  {description ? (
                    <p id={descId} className="text-admin-text-2 mt-0.5 text-[13px]">
                      {description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Dialog schließen"
                  className="rounded-admin-feld hover:bg-admin-flaeche flex size-11 shrink-0 items-center justify-center"
                >
                  <Icon name="schliessen" size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            </div>
          ) : null}
        </DialogContext.Provider>
      </dialog>
    </>
  );
}

/** Inhaltsbereich mit 20 px Abstand */
export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-col gap-4 p-5", className)}>{children}</div>;
}

/** Fußzeile mit Aktionen rechts (Abbrechen, primäre Aktion) */
export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "border-admin-rahmen flex flex-col-reverse gap-2 border-t px-5 py-4 md:flex-row md:items-center md:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Schließt den umgebenden Dialog oder Drawer */
export function DialogClose({ children = "Abbrechen" }: { children?: ReactNode }) {
  const dialog = useDialog();
  return (
    <Button variant="secondary" onClick={() => dialog?.close()}>
      {children}
    </Button>
  );
}
