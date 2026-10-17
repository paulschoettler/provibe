import "server-only";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import type { StaffRole } from "@/lib/admin/auth";
import { ROLE_LABELS } from "./rules";

/**
 * Mails der Backoffice-Anmeldung über integrations().email (bis zum Go-live Mock bzw. Allowlist).
 * Die Links führen über /admin/callback (token_hash) und funktionieren auf jedem Gerät.
 */

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#F6F6F7;font-family:Jost,Helvetica,Arial,sans-serif;color:#1A1A1A">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="background:#ffffff;border:1px solid #E3E3E3;border-radius:10px;padding:32px">
      <p style="font-size:13px;font-weight:600;color:#D9306E;margin:0 0 12px">provibe Backoffice</p>
      <h1 style="font-size:22px;font-weight:600;margin:0 0 16px">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="font-size:12px;line-height:1.6;color:#616161;margin:16px 0 0">Geschützter Bereich. Jede Anmeldung wird protokolliert. Du hast nichts angefordert? Dann ignorier diese E-Mail und sag dem Owner Bescheid.</p>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:#D9306E;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:100px">${label}</a></p>`;
}

const p = (text: string) => `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">${text}</p>`;
const small = (text: string) =>
  `<p style="font-size:13px;line-height:1.6;color:#616161;margin:0 0 8px">${text}</p>`;

function logLinkForLocalDev(label: string, link: string) {
  const env = serverEnv();
  if (env.APP_STAGE === "local" && env.APP_INTEGRATIONS === "mock") {
    console.info(`[admin:mock] ${label}: ${link}`);
  }
}

/** Link auf /admin/callback mit token_hash (aus auth.admin.generateLink) */
export function staffCallbackLink(
  hashedToken: string,
  type: "magiclink" | "invite",
  next = "/admin",
): string {
  const params = new URLSearchParams({ token_hash: hashedToken, type, next });
  return `${publicEnv.siteUrl}/admin/callback?${params.toString()}`;
}

export async function sendStaffMagicLinkMail(to: string, link: string) {
  logLinkForLocalDev("Magic Link Backoffice", link);
  const html = layout(
    "Dein Anmeldelink",
    p(
      "Mit diesem Link meldest du dich im provibe Backoffice an. Danach fragen wir den Code aus deiner Authenticator-App ab.",
    ) +
      button(link, "Im Backoffice anmelden") +
      small(
        `Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span>`,
      ) +
      small("Der Link funktioniert einmal und läuft nach kurzer Zeit ab."),
  );
  return integrations().email.send({
    to,
    subject: "Dein Anmeldelink für das provibe Backoffice",
    html,
    text: `Mit diesem Link meldest du dich im provibe Backoffice an:\n${link}\n\nDer Link funktioniert einmal und läuft nach kurzer Zeit ab.`,
    category: "auth",
    template: "admin_magic_link",
  });
}

export async function sendStaffInviteMail(
  to: string,
  link: string,
  role: StaffRole,
  invitedBy: string,
) {
  logLinkForLocalDev("Einladung Backoffice", link);
  const roleLabel = ROLE_LABELS[role];
  const html = layout(
    "Du bist ins Backoffice eingeladen",
    p(
      `${escapeHtml(invitedBy)} hat dich als <strong>${roleLabel}</strong> ins provibe Backoffice eingeladen.`,
    ) +
      p(
        "Beim ersten Login richtest du die Zwei-Faktor-Anmeldung mit einer Authenticator-App ein (zum Beispiel 1Password, Google Authenticator oder Authy).",
      ) +
      button(link, "Einladung annehmen") +
      small(
        `Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span>`,
      ) +
      small(
        `Ist der Link abgelaufen, fordere unter ${escapeHtml(publicEnv.siteUrl)}/admin/login einfach einen Magic Link an.`,
      ),
  );
  return integrations().email.send({
    to,
    subject: "Einladung ins provibe Backoffice",
    html,
    text: `${invitedBy} hat dich als ${roleLabel} ins provibe Backoffice eingeladen.\n\nEinladung annehmen:\n${link}\n\nIst der Link abgelaufen, fordere unter ${publicEnv.siteUrl}/admin/login einen Magic Link an.`,
    category: "auth",
    template: "admin_invite",
  });
}
