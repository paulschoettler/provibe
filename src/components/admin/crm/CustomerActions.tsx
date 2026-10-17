"use client";

import { useEffect, useRef, useState } from "react";
import {
  blockCustomerAction,
  eraseCustomerAction,
  sendActivationAction,
  unblockCustomerAction,
} from "@/lib/admin/customers/ui-actions";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Field, Textarea } from "@/components/admin/ui/fields";
import { Icon } from "@/components/admin/ui/Icon";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

/**
 * Mehr-Menü im Kundenprofil (Figma 29:6892, "…"): Aktivierungslink, Sperren oder Entsperren,
 * Löschung beantragen. Jede Aktion bestätigt ein Dialog, die Regeln prüft der Server.
 */
export interface CustomerActionTarget {
  id: string;
  name: string;
  email: string;
  blocked: boolean;
  anonymized: boolean;
  activatable: boolean;
  canManage: boolean;
  erasureRules: { label: string; action: string; detail: string }[];
}

type DialogKind = "block" | "unblock" | "erase" | "activate" | null;

export function CustomerActions({ target }: { target: CustomerActionTarget }) {
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (target.anonymized) return null;

  const items: { kind: DialogKind; label: string; danger?: boolean }[] = [
    ...(target.activatable
      ? [{ kind: "activate" as const, label: "Aktivierungslink senden" }]
      : []),
    ...(target.canManage
      ? [
          target.blocked
            ? { kind: "unblock" as const, label: "Sperre aufheben" }
            : { kind: "block" as const, label: "Kunde sperren", danger: true },
          { kind: "erase" as const, label: "Löschung beantragen (Art. 17)", danger: true },
        ]
      : []),
  ];
  if (items.length === 0) return null;

  const close = (o: boolean) => !o && setDialog(null);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        aria-label={`Weitere Aktionen für ${target.name}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte hover:bg-admin-flaeche flex size-11 items-center justify-center border md:size-9"
      >
        <Icon name="mehr" size={18} />
      </button>
      {menu ? (
        <ul
          role="menu"
          className="rounded-admin-karte border-admin-rahmen bg-admin-karte shadow-admin-karte absolute right-0 z-30 mt-1 w-64 overflow-hidden border py-1"
        >
          {items.map((item) => (
            <li key={item.kind} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  setDialog(item.kind);
                }}
                className={`hover:bg-admin-flaeche block min-h-11 w-full px-4 py-2.5 text-left text-[14px] ${item.danger ? "text-admin-rot" : ""}`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog
        title="Aktivierungslink senden?"
        open={dialog === "activate"}
        onOpenChange={close}
        size="sm"
      >
        <ActionForm action={sendActivationAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="customerId" value={target.id} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              {target.email} bekommt einen Link, mit dem das Kundenkonto ohne Passwort aktiviert
              wird. Bis zum Go-live geht die Mail nur an Adressen der Allowlist.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton pendingLabel="Wird gesendet …">Link senden</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      <Dialog
        title="Kunde sperren?"
        description={`${target.name} (${target.email})`}
        open={dialog === "block"}
        onOpenChange={close}
      >
        <ActionForm action={blockCustomerAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="customerId" value={target.id} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              Das Kundenkonto wird gesperrt, eine Anmeldung ist nicht mehr möglich. Bestellungen,
              Daten und Newsletter-Status bleiben unverändert. Die Sperre lässt sich jederzeit
              aufheben.
            </p>
            <Textarea
              name="reason"
              label="Grund"
              required
              rows={3}
              hint="Steht im Profil und im Protokoll, nur intern sichtbar."
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton variant="danger" pendingLabel="Wird gesperrt …">
              Sperren
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      <Dialog title="Sperre aufheben?" open={dialog === "unblock"} onOpenChange={close} size="sm">
        <ActionForm action={unblockCustomerAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="customerId" value={target.id} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              {target.name} kann sich danach wieder anmelden und bestellen.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton pendingLabel="Wird gespeichert …">Sperre aufheben</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      <Dialog
        title="Kundendaten löschen?"
        description="Löschung auf Antrag nach Art. 17 DSGVO. Das lässt sich nicht rückgängig machen."
        open={dialog === "erase"}
        onOpenChange={close}
        size="lg"
      >
        <ActionForm action={eraseCustomerAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="customerId" value={target.id} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              Personenbezogene Daten werden gelöscht oder pseudonymisiert. Bestellungen bleiben
              wegen der Aufbewahrungspflicht mit ihren Rechnungsdaten erhalten und hängen danach an
              einem Pseudonym.
            </p>
            <details className="rounded-admin-feld border-admin-rahmen border text-[13px]">
              <summary className="cursor-pointer px-3 py-2.5 font-medium">
                Was genau passiert ({target.erasureRules.length} Bereiche)
              </summary>
              <ul className="divide-admin-rahmen max-h-64 divide-y overflow-y-auto border-t">
                {target.erasureRules.map((r) => (
                  <li key={r.label} className="flex flex-col gap-0.5 px-3 py-2">
                    <span>
                      <span className="font-bold">{r.label}</span>{" "}
                      <span className="text-admin-text-2">({r.action})</span>
                    </span>
                    <span className="text-admin-text-2">{r.detail}</span>
                  </li>
                ))}
              </ul>
            </details>
            <Field
              name="confirmEmail"
              label={`Zur Bestätigung die E-Mail-Adresse eingeben: ${target.email}`}
              type="email"
              autoComplete="off"
              required
            />
            <Field
              name="reason"
              label="Anlass (optional)"
              hint="Zum Beispiel „Antrag per E-Mail vom 17.10.2026“. Nur IDs und dieser Text landen im Protokoll."
              maxLength={300}
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton variant="danger" pendingLabel="Wird gelöscht …">
              Endgültig löschen
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>
    </div>
  );
}
