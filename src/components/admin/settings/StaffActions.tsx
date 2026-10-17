"use client";

import { useEffect, useRef, useState } from "react";
import {
  changeRoleAction,
  resetMfaAction,
  revokeInviteAction,
  setActiveAction,
} from "@/lib/admin/staff/user-actions";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { DialogBody, DialogClose, DialogFooter, Dialog } from "@/components/admin/ui/Dialog";
import { RadioCards } from "@/components/admin/ui/fields";
import { Icon } from "@/components/admin/ui/Icon";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { ROLE_OPTIONS } from "@/lib/admin/staff/rules";

/**
 * Aktionsmenü je Benutzer (Figma 49:3529, Mehr-Button): Rolle ändern, deaktivieren oder
 * aktivieren, Zwei-Faktor zurücksetzen, Einladung zurückziehen. Jede Aktion bestätigt ein Dialog;
 * die Regeln (letzter Owner, nicht sich selbst) prüft der Server.
 */
export interface StaffActionTarget {
  userId: string | null;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  invitePending: boolean;
  isSelf: boolean;
}

type DialogKind = "role" | "active" | "mfa" | "revoke" | null;

export function StaffActions({ target }: { target: StaffActionTarget }) {
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const open = (kind: DialogKind) => {
    setMenu(false);
    setDialog(kind);
  };
  const items: { kind: DialogKind; label: string; danger?: boolean }[] = target.invitePending
    ? [{ kind: "revoke", label: "Einladung zurückziehen", danger: true }]
    : [
        { kind: "role", label: "Rolle ändern" },
        { kind: "mfa", label: "Zwei-Faktor zurücksetzen" },
        {
          kind: "active",
          label: target.isActive ? "Deaktivieren" : "Wieder aktivieren",
          danger: target.isActive,
        },
      ];

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-label={`Aktionen für ${target.name}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className="rounded-admin-feld hover:bg-admin-flaeche flex size-11 items-center justify-center md:size-8"
      >
        <Icon name="mehr" size={18} />
      </button>
      {menu ? (
        <ul
          role="menu"
          className="rounded-admin-karte border-admin-rahmen bg-admin-karte shadow-admin-karte absolute right-0 z-30 mt-1 w-60 overflow-hidden border py-1"
        >
          {items.map((item) => (
            <li key={item.kind} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => open(item.kind)}
                className={`hover:bg-admin-flaeche block w-full px-4 py-2.5 text-left text-[14px] ${item.danger ? "text-admin-rot" : ""}`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog
        title="Rolle ändern"
        description={`${target.name} (${target.email})`}
        open={dialog === "role"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <ActionForm action={changeRoleAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="userId" value={target.userId ?? ""} />
          <DialogBody>
            <ActionFormMessage />
            <RadioCards
              name="role"
              legend="Rolle"
              options={ROLE_OPTIONS}
              defaultValue={target.role}
            />
            <p className="text-admin-text-2 text-[13px]">
              Die Änderung gilt sofort und landet im Protokoll.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton pendingLabel="Wird gespeichert …">Rolle speichern</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      <Dialog
        title={target.isActive ? "Benutzer deaktivieren?" : "Benutzer wieder aktivieren?"}
        open={dialog === "active"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <ActionForm action={setActiveAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="userId" value={target.userId ?? ""} />
          <input type="hidden" name="active" value={target.isActive ? "false" : "true"} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              {target.isActive
                ? `${target.name} kommt danach nicht mehr ins Backoffice. Bestehende Sitzungen enden beim nächsten Seitenaufruf. Das Konto bleibt erhalten und lässt sich wieder aktivieren.`
                : `${target.name} kann sich danach wieder anmelden, mit der bisherigen Rolle.`}
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton
              variant={target.isActive ? "danger" : "primary"}
              pendingLabel="Wird gespeichert …"
            >
              {target.isActive ? "Deaktivieren" : "Aktivieren"}
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      <Dialog
        title="Zwei-Faktor zurücksetzen?"
        open={dialog === "mfa"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <ActionForm action={resetMfaAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="userId" value={target.userId ?? ""} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              Alle Authenticator-Verknüpfungen und Wiederherstellungscodes von {target.name} werden
              gelöscht und alle Sitzungen beendet. Beim nächsten Login richtet {target.name} die
              Zwei-Faktor-Anmeldung neu ein.
            </p>
            <p className="text-admin-text-2 text-[13px]">
              Mach das nur, wenn du die Person sicher erkannt hast, zum Beispiel per Rückruf.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton variant="danger" pendingLabel="Wird zurückgesetzt …">
              Zurücksetzen
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>

      <Dialog
        title="Einladung zurückziehen?"
        open={dialog === "revoke"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <ActionForm action={revokeInviteAction} closeDialogOnSuccess hideMessage>
          <input type="hidden" name="email" value={target.email} />
          <DialogBody>
            <ActionFormMessage />
            <p className="text-[14px]">
              Die Einladung an {target.email} verfällt. Du kannst die Adresse später erneut
              einladen.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton variant="danger" pendingLabel="Wird zurückgezogen …">
              Zurückziehen
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>
    </div>
  );
}
