import type { Metadata } from "next";
import { hasRole, PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { permissionMatrix } from "@/lib/admin/staff/matrix";
import {
  initials,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  STAFF_ROLES,
  type MfaDisplay,
} from "@/lib/admin/staff/rules";
import { listStaffOverview, type StaffListItem } from "@/lib/admin/staff/users";
import { NoAccess } from "@/components/admin/NoAccess";
import { InviteDialog } from "@/components/admin/settings/InviteDialog";
import { StaffActions } from "@/components/admin/settings/StaffActions";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { formatDate, formatDateTime } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Benutzer und Rollen" };

const PATH = "/admin/einstellungen/benutzer";

const MFA_BADGE: Record<
  MfaDisplay,
  { label: string; tone: "green" | "yellow" | "gray"; hollow?: boolean }
> = {
  active: { label: "2FA aktiv", tone: "green" },
  pending: { label: "2FA ausstehend", tone: "yellow" },
  invite: { label: "nach Annahme", tone: "gray", hollow: true },
};

/**
 * /admin/einstellungen/benutzer (Figma 49:3529, mobil 45:3278, Einladen 50:3732).
 * Sehen dürfen Owner und Admin, ändern nur Owner (H19). Zwei-Faktor ist Pflicht für alle Rollen.
 */
export default async function StaffUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ einladen?: string }>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) return <NoAccess />;
  const canManage = PERMISSIONS.manageUsers(session);
  const { einladen } = await searchParams;

  let users: StaffListItem[] = [];
  let failed = false;
  try {
    users = await listStaffOverview();
  } catch (error) {
    console.error("[admin] Benutzerliste", error);
    failed = true;
  }
  const matrix = permissionMatrix();

  const nameOf = (u: StaffListItem) =>
    u.invitePending ? "Einladung offen" : (u.displayName ?? u.email);
  const lastLogin = (u: StaffListItem) =>
    u.invitePending || u.invitedAt
      ? `eingeladen ${formatDate(u.invitedAt)}`
      : u.lastLoginAt
        ? formatDateTime(u.lastLoginAt)
        : "noch kein Login";

  const actionsFor = (u: StaffListItem) =>
    u.userId === session.userId ? null : (
      <StaffActions
        target={{
          userId: u.userId,
          email: u.email,
          name: u.displayName ?? u.email,
          role: u.role,
          isActive: u.isActive,
          invitePending: u.invitePending,
          isSelf: false,
        }}
      />
    );

  return (
    <>
      <PageHeader
        title="Benutzer und Rollen"
        description="Zugänge zum Backoffice, Zwei-Faktor-Pflicht für alle Rollen"
        actions={canManage ? <InviteDialog defaultOpen={einladen === "1"} /> : null}
      />
      {failed ? (
        <FormMessage tone="error">Die Benutzer konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      {!canManage ? (
        <FormMessage tone="info">
          Benutzer verwalten dürfen nur Owner (Entscheidung H19). Du siehst die Liste nur.
        </FormMessage>
      ) : null}

      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-start gap-3">
            <span className="text-admin-gruen mt-0.5">
              <Icon name="schild" size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Zwei-Faktor-Pflicht</p>
              <p className="text-admin-text-2 mt-0.5 text-[13px]">
                Alle Benutzer melden sich mit Passwort oder Magic Link plus TOTP-Code an. Ohne
                eingerichteten zweiten Faktor ist kein Zugriff möglich. Verlorenes Gerät:
                Wiederherstellungscode oder Zurücksetzen durch einen Owner.
              </p>
            </div>
            <span
              role="switch"
              aria-checked="true"
              aria-disabled="true"
              aria-label="Zwei-Faktor-Pflicht, immer aktiv"
              title="Immer aktiv (Briefing Abschnitt 8)"
              className="bg-admin-akzent relative mt-1 inline-flex h-6 w-10 shrink-0 rounded-full opacity-90"
            >
              <span className="absolute top-1 left-5 size-4 rounded-full bg-white shadow" />
            </span>
          </div>
        </Card>

        <Table
          caption="Backoffice-Benutzer"
          rows={users}
          rowKey={(u) => u.userId ?? `invite:${u.email}`}
          columns={[
            {
              key: "benutzer",
              header: "Benutzer",
              cell: (u) => (
                <span className="flex items-center gap-3">
                  <span className="bg-admin-akzent-hell text-admin-akzent flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold">
                    {initials(u.displayName, u.email)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">
                      {nameOf(u)}
                      {u.userId === session.userId ? (
                        <span className="text-admin-text-2 font-normal"> (du)</span>
                      ) : null}
                    </span>
                    <span className="text-admin-text-2 block truncate text-[12px]">{u.email}</span>
                  </span>
                </span>
              ),
            },
            {
              key: "rolle",
              header: "Rolle",
              width: "130px",
              cell: (u) => (
                <span className="flex flex-wrap gap-1">
                  <Badge tone="accent">{ROLE_LABELS[u.role]}</Badge>
                  {!u.isActive ? (
                    <Badge tone="gray" hollow>
                      Deaktiviert
                    </Badge>
                  ) : null}
                </span>
              ),
            },
            {
              key: "mfa",
              header: "Zwei-Faktor",
              width: "160px",
              cell: (u) => (
                <Badge tone={MFA_BADGE[u.mfa].tone} hollow={MFA_BADGE[u.mfa].hollow}>
                  {MFA_BADGE[u.mfa].label}
                </Badge>
              ),
            },
            { key: "login", header: "Letzter Login", width: "170px", cell: (u) => lastLogin(u) },
          ]}
          rowActions={canManage ? actionsFor : undefined}
          renderCard={(u) => (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className="bg-admin-akzent-hell text-admin-akzent flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold">
                  {initials(u.displayName, u.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{nameOf(u)}</span>
                  <span className="text-admin-text-2 block truncate text-[14px]">{u.email}</span>
                </span>
                {canManage ? actionsFor(u) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="accent">{ROLE_LABELS[u.role]}</Badge>
                <Badge tone={MFA_BADGE[u.mfa].tone} hollow={MFA_BADGE[u.mfa].hollow}>
                  {MFA_BADGE[u.mfa].label}
                </Badge>
                {!u.isActive ? (
                  <Badge tone="gray" hollow>
                    Deaktiviert
                  </Badge>
                ) : null}
              </div>
              <p className="text-admin-text-2 text-[13px]">Letzter Login: {lastLogin(u)}</p>
            </div>
          )}
        />

        <Card
          title="Rollenmatrix"
          description="Lesen dürfen alle Rollen alles außer Kundendaten bei Fulfillment"
        >
          <ul className="mb-4 grid gap-2 md:hidden">
            {STAFF_ROLES.map((r) => (
              <li key={r} className="border-admin-rahmen border-b pb-2 last:border-b-0">
                <p className="text-[15px] font-semibold">{ROLE_LABELS[r]}</p>
                <p className="text-admin-text-2 text-[13px]">{ROLE_DESCRIPTIONS[r]}</p>
              </li>
            ))}
          </ul>
          <div className="rounded-admin-feld border-admin-rahmen overflow-x-auto border">
            <table className="w-full min-w-[560px] text-[14px]">
              <caption className="sr-only">Rechte je Rolle, berechnet aus PERMISSIONS</caption>
              <thead>
                <tr className="bg-admin-flaeche text-admin-text-2 h-10 text-[13px]">
                  <th scope="col" className="px-3 text-left font-medium">
                    Recht
                  </th>
                  {STAFF_ROLES.map((r) => (
                    <th key={r} scope="col" className="w-24 px-3 text-center font-medium">
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.key} className="border-admin-rahmen h-11 border-t">
                    <th scope="row" className="px-3 text-left font-normal">
                      {row.label}
                    </th>
                    {STAFF_ROLES.map((r) => (
                      <td key={r} className="px-3 text-center">
                        {row.roles[r] ? (
                          <span className="text-admin-gruen inline-flex">
                            <Icon name="haken" size={18} label="erlaubt" />
                          </span>
                        ) : (
                          <span className="text-admin-rahmen-stark" aria-label="nicht erlaubt">
                            –
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-admin-text-2 mt-3 text-[12px]">
            Entscheidung H19: Benutzerverwaltung nur Owner, Erstattungen Owner und Admin. Jede
            Rollenänderung landet im Protokoll.
          </p>
        </Card>
      </div>
    </>
  );
}
