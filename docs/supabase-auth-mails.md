# Supabase Auth: E-Mail-Vorlagen

Zum Einfügen unter Authentication, Email Templates. Betreff in das Feld „Subject“, HTML in „Message body“. Die Farben stammen aus `brand/provibe-ci/tokens.json` (Cream, Weiß, Wildberry), die Schrift fällt im Mailclient auf Helvetica oder Arial zurück. Das Logo lädt von der Site; solange der Passwortschutz steht, zeigen Mailclients nur den Alt-Text „provibe“.

Alle Links führen über `/auth/callback` mit `token_hash` und `type`, dadurch funktionieren sie auch auf einem anderen Gerät als dem, das den Link angefordert hat. `next={{ .RedirectTo }}` übergibt das Rücksprungziel, das die App beim Anfordern mitschickt (zum Beispiel zurück in die Kasse); `safeNextPath` in `src/lib/auth/redirect.ts` packt daraus nur den inneren Pfad aus. Die Einladung ins Backoffice läuft über `/admin/callback`; die App verschickt Einladungen und Staff-Logins mit eigener Vorlage über Resend, diese Supabase-Vorlage greift nur bei Einladungen aus dem Supabase-Dashboard. Den Code zur erneuten Bestätigung (Reauthentication) nutzt die App derzeit nicht, die Vorlage ist der Vollständigkeit halber dabei.

Voraussetzung im Free-Plan: eigene SMTP-Einstellungen (Resend) unter Authentication, SMTP Settings, sonst lässt Supabase die Vorlagen nicht speichern. Linkgültigkeit steht auf 15 Minuten (Auth, Settings), darauf bezieht sich der Hinweistext.

## Confirm signup

Betreff: `Bestätige deine E-Mail-Adresse bei provibe`

```html
<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#F3F1B8;">
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background:#F3F1B8;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width:560px;"
          >
            <tr>
              <td style="padding:0 0 24px;text-align:center;">
                <a href="{{ .SiteURL }}" style="text-decoration:none;"
                  ><img
                    src="{{ .SiteURL }}/brand/logo-derived/provibe-logo-wildberry@2x.png"
                    width="120"
                    height="47"
                    alt="provibe"
                    style="display:inline-block;width:120px;height:47px;border:0;"
                /></a>
              </td>
            </tr>
            <tr>
              <td style="background:#FFFFFF;border-radius:24px;padding:32px 28px;">
                <h1
                  style="margin:0 0 12px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:#702249;"
                >
                  Fast geschafft.
                </h1>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Bitte bestätige deine E-Mail-Adresse, dann ist dein provibe-Konto startklar. Dort
                  siehst du deine Bestellungen, Adressen und dein Abo an einem Ort.
                </p>
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="margin:8px 0 24px;"
                >
                  <tr>
                    <td style="border-radius:100px;background:#702249;">
                      <a
                        href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}"
                        style="display:inline-block;padding:14px 28px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:100px;"
                        >E-Mail-Adresse bestätigen</a
                      >
                    </td>
                  </tr>
                </table>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;color:#702249;"
                >
                  Der Link ist 15 Minuten gültig und funktioniert nur einmal. Wenn du das nicht
                  warst, ignorier diese E-Mail einfach.
                </p>
                <p
                  style="margin:0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Dein provibe-Team
                </p>
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br /><span
                  style="word-break:break-all;"
                  >{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next={{
                  .RedirectTo }}</span
                >
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                provibe · CG Projects UG (haftungsbeschränkt) · hello@provibe-drinks.de
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Magic Link

Betreff: `Dein Anmeldelink für provibe`

```html
<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#F3F1B8;">
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background:#F3F1B8;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width:560px;"
          >
            <tr>
              <td style="padding:0 0 24px;text-align:center;">
                <a href="{{ .SiteURL }}" style="text-decoration:none;"
                  ><img
                    src="{{ .SiteURL }}/brand/logo-derived/provibe-logo-wildberry@2x.png"
                    width="120"
                    height="47"
                    alt="provibe"
                    style="display:inline-block;width:120px;height:47px;border:0;"
                /></a>
              </td>
            </tr>
            <tr>
              <td style="background:#FFFFFF;border-radius:24px;padding:32px 28px;">
                <h1
                  style="margin:0 0 12px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:#702249;"
                >
                  Dein Anmeldelink.
                </h1>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Ein Klick, und du bist in deinem provibe-Konto angemeldet. Kein Passwort nötig.
                </p>
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="margin:8px 0 24px;"
                >
                  <tr>
                    <td style="border-radius:100px;background:#702249;">
                      <a
                        href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next={{ .RedirectTo }}"
                        style="display:inline-block;padding:14px 28px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:100px;"
                        >Jetzt anmelden</a
                      >
                    </td>
                  </tr>
                </table>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;color:#702249;"
                >
                  Der Link ist 15 Minuten gültig und funktioniert nur einmal. Wenn du das nicht
                  warst, ignorier diese E-Mail einfach.
                </p>
                <p
                  style="margin:0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Dein provibe-Team
                </p>
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br /><span
                  style="word-break:break-all;"
                  >{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next={{
                  .RedirectTo }}</span
                >
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                provibe · CG Projects UG (haftungsbeschränkt) · hello@provibe-drinks.de
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Reset password

Betreff: `Passwort zurücksetzen bei provibe`

```html
<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#F3F1B8;">
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background:#F3F1B8;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width:560px;"
          >
            <tr>
              <td style="padding:0 0 24px;text-align:center;">
                <a href="{{ .SiteURL }}" style="text-decoration:none;"
                  ><img
                    src="{{ .SiteURL }}/brand/logo-derived/provibe-logo-wildberry@2x.png"
                    width="120"
                    height="47"
                    alt="provibe"
                    style="display:inline-block;width:120px;height:47px;border:0;"
                /></a>
              </td>
            </tr>
            <tr>
              <td style="background:#FFFFFF;border-radius:24px;padding:32px 28px;">
                <h1
                  style="margin:0 0 12px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:#702249;"
                >
                  Neues Passwort gefällig?
                </h1>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Du hast ein neues Passwort für dein provibe-Konto angefragt. Über den Button legst
                  du es fest.
                </p>
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="margin:8px 0 24px;"
                >
                  <tr>
                    <td style="border-radius:100px;background:#702249;">
                      <a
                        href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}"
                        style="display:inline-block;padding:14px 28px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:100px;"
                        >Neues Passwort festlegen</a
                      >
                    </td>
                  </tr>
                </table>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;color:#702249;"
                >
                  Der Link ist 15 Minuten gültig und funktioniert nur einmal. Wenn du das nicht
                  warst, ignorier diese E-Mail einfach.
                </p>
                <p
                  style="margin:0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Dein provibe-Team
                </p>
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br /><span
                  style="word-break:break-all;"
                  >{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next={{
                  .RedirectTo }}</span
                >
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                provibe · CG Projects UG (haftungsbeschränkt) · hello@provibe-drinks.de
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Change email address

Betreff: `Bestätige deine neue E-Mail-Adresse bei provibe`

```html
<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#F3F1B8;">
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background:#F3F1B8;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width:560px;"
          >
            <tr>
              <td style="padding:0 0 24px;text-align:center;">
                <a href="{{ .SiteURL }}" style="text-decoration:none;"
                  ><img
                    src="{{ .SiteURL }}/brand/logo-derived/provibe-logo-wildberry@2x.png"
                    width="120"
                    height="47"
                    alt="provibe"
                    style="display:inline-block;width:120px;height:47px;border:0;"
                /></a>
              </td>
            </tr>
            <tr>
              <td style="background:#FFFFFF;border-radius:24px;padding:32px 28px;">
                <h1
                  style="margin:0 0 12px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:#702249;"
                >
                  Neue E-Mail-Adresse bestätigen.
                </h1>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Du möchtest die Adresse deines provibe-Kontos von {{ .Email }} auf {{ .NewEmail }}
                  ändern. Bitte bestätige den Wechsel über den Button.
                </p>
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="margin:8px 0 24px;"
                >
                  <tr>
                    <td style="border-radius:100px;background:#702249;">
                      <a
                        href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next={{ .RedirectTo }}"
                        style="display:inline-block;padding:14px 28px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:100px;"
                        >Neue Adresse bestätigen</a
                      >
                    </td>
                  </tr>
                </table>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;color:#702249;"
                >
                  Der Link ist 15 Minuten gültig und funktioniert nur einmal. Wenn du das nicht
                  warst, ignorier diese E-Mail einfach.
                </p>
                <p
                  style="margin:0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Dein provibe-Team
                </p>
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br /><span
                  style="word-break:break-all;"
                  >{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash
                  }}&type=email_change&next={{ .RedirectTo }}</span
                >
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                provibe · CG Projects UG (haftungsbeschränkt) · hello@provibe-drinks.de
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Invite user

Betreff: `Dein Zugang zum provibe-Backoffice`

```html
<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#F3F1B8;">
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background:#F3F1B8;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width:560px;"
          >
            <tr>
              <td style="padding:0 0 24px;text-align:center;">
                <a href="{{ .SiteURL }}" style="text-decoration:none;"
                  ><img
                    src="{{ .SiteURL }}/brand/logo-derived/provibe-logo-wildberry@2x.png"
                    width="120"
                    height="47"
                    alt="provibe"
                    style="display:inline-block;width:120px;height:47px;border:0;"
                /></a>
              </td>
            </tr>
            <tr>
              <td style="background:#FFFFFF;border-radius:24px;padding:32px 28px;">
                <h1
                  style="margin:0 0 12px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:#702249;"
                >
                  Willkommen im Team.
                </h1>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Du bist zum provibe-Backoffice eingeladen. Über den Button richtest du deinen
                  Zugang ein und legst ein Passwort fest.
                </p>
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="margin:8px 0 24px;"
                >
                  <tr>
                    <td style="border-radius:100px;background:#702249;">
                      <a
                        href="{{ .SiteURL }}/admin/callback?token_hash={{ .TokenHash }}&type=invite&next=/admin"
                        style="display:inline-block;padding:14px 28px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:100px;"
                        >Zugang einrichten</a
                      >
                    </td>
                  </tr>
                </table>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;color:#702249;"
                >
                  Der Link ist 15 Minuten gültig und funktioniert nur einmal. Wenn du das nicht
                  warst, ignorier diese E-Mail einfach.
                </p>
                <p
                  style="margin:0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Dein provibe-Team
                </p>
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br /><span
                  style="word-break:break-all;"
                  >{{ .SiteURL }}/admin/callback?token_hash={{ .TokenHash
                  }}&type=invite&next=/admin</span
                >
              </td>
            </tr>
            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                provibe · CG Projects UG (haftungsbeschränkt) · hello@provibe-drinks.de
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Reauthentication

Betreff: `Dein Bestätigungscode für provibe`

```html
<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#F3F1B8;">
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background:#F3F1B8;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width:560px;"
          >
            <tr>
              <td style="padding:0 0 24px;text-align:center;">
                <a href="{{ .SiteURL }}" style="text-decoration:none;"
                  ><img
                    src="{{ .SiteURL }}/brand/logo-derived/provibe-logo-wildberry@2x.png"
                    width="120"
                    height="47"
                    alt="provibe"
                    style="display:inline-block;width:120px;height:47px;border:0;"
                /></a>
              </td>
            </tr>
            <tr>
              <td style="background:#FFFFFF;border-radius:24px;padding:32px 28px;">
                <h1
                  style="margin:0 0 12px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:#702249;"
                >
                  Dein Bestätigungscode.
                </h1>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Gib diesen Code ein, um die Änderung in deinem provibe-Konto zu bestätigen:
                </p>
                <p
                  style="margin:8px 0 24px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:0.18em;color:#702249;"
                >
                  {{ .Token }}
                </p>
                <p
                  style="margin:0 0 16px;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Der Code ist nur kurz gültig. Wenn du das nicht warst, ignorier diese E-Mail
                  einfach.
                </p>
                <p
                  style="margin:0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#702249;"
                >
                  Dein provibe-Team
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="padding:20px 8px 0;font-family:'filson-pro','Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#702249;text-align:center;"
              >
                provibe · CG Projects UG (haftungsbeschränkt) · hello@provibe-drinks.de
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```
