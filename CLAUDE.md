## Design: CI-Guide ist verpflichtend

Für alles Visuelle gilt verbindlich `brand/provibe-ci/CI-GUIDE.md`. Lies ihn vor jeder UI-Änderung.

- Farben ausschließlich über die Tokens aus `brand/provibe-ci/tokens.css` (`--pv-*`). Keine Hex-Werte im Code, keine neuen Farben, keine Verläufe, keine Transparenz-Abstufungen.
- Sortenfarben: Wildberry `--pv-wildberry` #702249 (zugleich Markenbasis), Lime-Raspberry `--pv-lime-raspberry` #E4DF6A, Peach `--pv-peach` #F4A076. Text auf Cream: Wildberry, in Peach-Kontexten Burgundy `--pv-burgundy`.
- Lime-Raspberry nie als Textfarbe auf Cream.
- Schriften nur über das Adobe-Kit `https://use.typekit.net/sne6rux.css`: `filson-pro` (Headlines, Fließtext, Buttons), `kepler-std-semicondensed-dis` / `kepler-std-semicondensed-sub` italic (Akzentwörter), `prenton-condensed` (Labels, Callouts). Keine weiteren Schriften.
- Logo nur als SVG aus `brand/provibe-ci/logo/`, nie nachbauen oder als Text setzen.
- Frucht-Icons nur aus `brand/provibe-ci/icons/fruits/`, nie eigene zeichnen, generieren oder aus anderen Quellen nehmen. Fehlt eine Frucht, nachfragen.
- Der Look der Seite (Layout, Abstände, Animationen, 3D-Dosen) bleibt bestehen. Der CI-Guide regelt Farben, Schriften, Logo und Icons.
- Ausnahme Funktionsfarben: Für Fehler, Erfolg, Warnung und neutrale Grautöne im Backoffice und in Formularen dürfen eigene Tokens existieren. Sie liegen gesammelt in einer Datei als `--pv-ui-*` und werden nie für Markenflächen genutzt.

### Umsetzung im Repo

- `brand/provibe-ci/` ist die einzige Quelle für Farben, Schriften, Logo und Icons und wird nicht verändert. Die SVGs liegen zusätzlich unverändert unter `public/brand/` (`logo/`, `icons/fruits/`, `icons/ui/`), damit `next/image` und `<img>` sie ausliefern können.
- `brand/provibe-ci/tokens.css` wird in `src/app/globals.css` importiert; sein `@import` lädt das Adobe-Kit genau einmal, deshalb steht kein zweiter `<link>` im Root-Layout. Tailwind (Version 4, `@theme` in `globals.css`) bildet die Tokens als `--color-pv-*` und `--font-sans`, `--font-serif-italic`, `--font-serif-italic-sub`, `--font-condensed` ab, immer über die CSS-Variablen, nie über kopierte Hex-Werte.
- Die Funktionsfarben stehen in `src/styles/ui-tokens.css` (`--pv-ui-*`): Fehler, Erfolg, Warnung, Hinweis, Grautöne für Backoffice und Formulare, dazu Schatten und Abdunkelung als Ableitung aus Wildberry. Nur diese Datei und `brand/provibe-ci/` dürfen Farbwerte enthalten.
- Werte, die nicht per CSS-Variable gehen (E-Mail-Vorlagen, `themeColor`, Open-Graph-Bilder), kommen aus `brand/provibe-ci/tokens.json`, nie als Hex im Code.
- Sortenbereiche nutzen nur die passenden Früchte: Wildberry Erdbeere, Himbeere, Heidelbeere; Lime-Raspberry Limettenscheibe, Himbeere; Peach die Pfirsich-Icons. Frucht-Icons sind Deko hinter Inhalten, Lime-Raspberry auf Cream, Cream auf Wildberry.

# PROVIBE Shop (Ablösung Shopify)

Das verbindliche Projektbriefing liegt unter `docs/briefing.md`. Lies es zu Beginn jeder Session vollständig. Abschnitt 13 enthält bereits getroffene Entscheidungen, die nicht erneut abgefragt werden.

Weitere Projektdokumente:

- `docs/analyse.md`: Inventar des bestehenden Shopify-Shops (URLs, Funktionen, Assets, Gap-Liste)
- `docs/plan.md`: Phasenplan mit Status
- `docs/seitenplan.md`: alle Routen von Storefront und Backoffice mit Vorlagen, Status und Abnahme-Screens
- `docs/decisions.md`: Architekturentscheidungen (kurze ADRs)
- `docs/setup.md`: Einmalige Einrichtung von Werkzeugen und Zugängen
- `docs/fragen.md`: Offene Fragen mit Empfehlungen und nachgetragenen Antworten
- `docs/quelltexte/`: Originaltexte aller Shopify-Seiten (Rechtstexte, Produkttexte), `assets/source/`: Originalmedien und Shopify-Snapshot
- `supabase/migrations/`: Schema- und Seed-Migrationen, lokal per `pnpm db:local` prüfbar (PostgreSQL 16 ohne Docker), remote per Supabase-MCP `apply_migration` mit identischem Namen anwenden. Supabase-Projekt: `ajscwnbgaijknmdrtihn`.
- `src/lib/pricing/`: einzige Stelle für Preis-, Pfand-, Grundpreis-, Rabatt-, Versand- und Steuerlogik. `src/lib/integrations/`: Provider-Interfaces mit Mocks (APP_INTEGRATIONS=mock).
- `docs/golive.md`: Go-live-Checkliste mit Erinnerungen (Stripe, Resend, Lexware, DHL, Rechtstexte, Lieferungen). `docs/konto-und-abo-plan.md`: Plan für Kundenkonto und Abo. `docs/handbuch.md`: Betriebshandbuch für das Backoffice.
- `docs/redirects.md`, `docs/legal-checklist.md`, `docs/rechtstexte-aenderungen.md`, `docs/import.md`, `docs/tracking.md`, `docs/zahlarten-logos.md`: Weiterleitungen, Rechts-Checkliste, Rechtstext-Gegenüberstellung, Shopify-Import, Tracking, Quellen der Zahlarten-Zeichen

## Arbeitsweise

- Rolle: Lead Engineer. Der Shopify-Store https://www.provibe-drinks.de/ wird als eigene Anwendung nachgebaut. Keine Funktion, keine Unterseite und kein alter Pfad darf verloren gehen.
- Phase für Phase nach `docs/plan.md`. Nach jeder Phase ein kurzer Statusbericht: fertig, offen, was vom Auftraggeber gebraucht wird.
- Offene Fragen gesammelt stellen, jede mit einer konkreten Empfehlung. Bei Recht, Geld und Kundendaten nie raten.
- So lange wie möglich ohne Zugänge arbeiten: alle externen Dienste (Stripe, Resend, Lexware, DHL, Supabase) hinter Interfaces mit Mock-Implementierungen. `.env.example` vollständig pflegen. Zugänge erst anfordern, wenn sie wirklich gebraucht werden, dann mit exakter Angabe von Key und Berechtigungen.
- Jede Architekturentscheidung als kurzer ADR in `docs/decisions.md`.
- Stack ist gesetzt: Next.js (App Router, TypeScript, Tailwind) mit statischer Generierung und On-Demand-Revalidation, Storefront und Backoffice (`/admin`) in einem Repo, Netlify, Supabase (EU, Frankfurt), Stripe (Payment Element), Resend, Lexware Office, DHL. Figma-Datei "PROVIBE Shop" (wttVzqEheGArNkqUliXd3x) für Layout und Screens; Farben, Schriften, Logo und Icons kommen aus dem CI-Guide.
- Harte Rendering-Regel: Jede kundenseitige Seite liefert vollständiges HTML vom Server oder aus dem Build. Kein Inhalt nur per Client-JavaScript. Mit `curl` prüfen und dokumentieren.
- Sprache im Chat und in den Dokumenten: Deutsch, Ansprache per Du, keine Gedankenstriche im Fließtext.

## Befehle

- `pnpm dev -p <port>`: Dev-Server (Next 16 erlaubt nur einen Dev-Server je Ordner). `pnpm build`, `pnpm start -p <port>` für den Produktions-Build.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest), `pnpm test:import` (Importskripte), `pnpm prettier --write <dateien>`.
- `bash scripts/db/local-pg.sh migrate`: alle Migrationen lokal gegen PostgreSQL 16 ohne Docker anwenden. Remote-Migrationen per Supabase-MCP `apply_migration` beziehungsweise Management API, danach `src/lib/supabase/database.types.ts` neu erzeugen.
- Playwright-Prüfungen mit Chromium unter `/opt/pw-browsers/chromium`, Import aus `node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs`.

## Aktuelle Sperren

- Startseite: Design-Prompt des Auftraggebers vom 21.09.2026 (Referenzen ciaoenergy.com, royalbev.com, ballaurent.com, drei GLB-Dosenmodelle), Analyse und Plan in `docs/design-startseite.md`. Fragen G1 bis G12 sind beantwortet (kein Preis im Hero), Startseite gebaut und live; Änderungswünsche des Auftraggebers gehen vor. Regeln: Mobile first, alles Inhaltliche im Server-HTML, 3D nur als Progressive Enhancement mit PNG-Fallback.
- Keys liegen ausschließlich in `.env.local` (gitignoriert). Nie in Docs, Commits oder Logs übernehmen.
- Kein Produktivcode, solange die mit **jetzt** markierten Fragen in `docs/fragen.md` unbeantwortet sind.
- Freigabe vom 17.10.2026: Alle Unterseiten (Storefront, Konto, Checkout, Backoffice) werden zuerst in Figma entworfen und danach ohne weitere Rückfrage im Code gebaut, inklusive allem, was für den Go-live noch fehlt. Kundenkonto und Abo laut `docs/konto-und-abo-plan.md` sind freigegeben und gebaut. Keine Erlaubnisfragen mehr im Chat; Entscheidungen mit Annahme treffen, die Annahme in `docs/fragen.md` Abschnitt H festhalten. Externe Dienste bleiben Mock, bis Keys vorliegen. Die Gründerin ist Celine Grimm; Texte und Bilder bei Bedarf von https://www.provibe-drinks.de/ übernehmen.
- Git und Netlify: Das Repo ist vorübergehend öffentlich, weil Netlify Builds von Autoren ohne Team-Verknüpfung blockiert. Commits laufen unter der Inhaber-Identität (`git config user.name/email` lokal gesetzt), bis Celine der Nutzung ihres GitHub-Kontos zustimmt. Netlify-Site `provibe-shop` baut den Standard-Branch; Deploy-Stand per Netlify-API prüfen.

## Schutzregeln für die Live-Instanz

Es gibt genau ein Supabase-Projekt und eine Netlify-Site, beides live. Kein Staging.

- Vor dem Go-live darf auf der Instanz frei gearbeitet werden. Ab dem Import echter Kundendaten gilt sie als Produktion.
- Ab dann: Jede Migration zuerst lokal testen (Supabase CLI, Docker). Migrationen sind vorwärtskompatibel und haben einen dokumentierten Rückweg. Vor jeder Migration ein Backup per `pg_dump` an einen privaten Ort.
- Destruktive Befehle auf der Live-Instanz (`DROP`, `TRUNCATE`, `DELETE` ohne enges `WHERE`, Migrations-Reset, Löschen von Buckets, Pausieren oder Löschen des Projekts) niemals ohne ausdrückliche Freigabe des Auftraggebers im Chat.
- Entwicklung und automatisierte Tests laufen ausschließlich lokal gegen Supabase per CLI und gegen Stripe im Testmodus, nie gegen die Live-Datenbank. Testdaten in der Remote-Datenbank nur gekennzeichnet (E-Mail `test-*@provibe-drinks.de`, `is_test`, Notiz TEST) und gezielt wieder löschen.
- Netlify Deploy Previews abschalten oder ohne Live-Secrets betreiben.
- Bis zum Go-live liegt die Site hinter Passwortschutz oder `noindex`. Der Schutz fällt erst mit dem DNS-Umzug.
- Stripe bleibt im Testmodus, bis der Auftraggeber den Wechsel nach Checkliste selbst freigibt. Lexware-Rechnungen und DHL-Labels bis dahin nur als Entwurf, Sandbox oder Mock. Testbestellungen markieren und vor dem Go-live nach Rücksprache entfernen.
- Newsletter- und Automations-Versand bis zum Go-live hart auf eine Allowlist von Testadressen begrenzt.

## Architektur in Kürze

- `src/app/`: Storefront-Routen, `src/app/admin/(auth)` und `(shell)` für das Backoffice (jede Seite und Action mit `requireStaff` und `PERMISSIONS`), `src/app/api/` für Webhooks, Health und den Job-Runner.
- `src/components/`: `home` (Startseite mit Hero, Sequenz, Finale), `three` (eine fixe 3D-Canvas als Progressive Enhancement, ADR-009), `layout`, `catalog`, `cart`, `checkout`, `account`, `subscriptions`, `reviews`, `consent`, `content`, `forms`, `admin/ui` (UI-Kit des Backoffice, siehe `src/components/admin/ui/README.md`).
- `src/lib/`: `catalog` (Katalog einmal je Request, Cache-Tags `catalog`, `content`, `legal`, `redirects`, `reviews`, ADR-011), `pricing`, `cart` (httpOnly-Cookie, ADR-010), `checkout`, `subscriptions`, `reviews`, `auth` (Kundenkonto), `admin/<modul>` (Serverlogik je Backoffice-Modul, `writeAudit` bei jedem Schreiben), `admin/jobs` (Job-Runner, ADR-012), `tracking` und `consent` (ADR-016), `routing` (404 im Proxy, ADR-017), `integrations` (Mocks).
- Datenbank: Supabase mit RLS auf jeder Tabelle, Geld als Integer in Cent, Zeitstempel in UTC, Zod auf jeder Server Action. Bestand in Dosen (H24, ADR-018). Importskripte unter `scripts/import` mit direkter PostgreSQL-Verbindung (ADR-015).
- Deploy: Netlify baut den Standard-Branch; Scheduled Function `jobs-run` alle fünf Minuten, pg_cron legt die täglichen Abo-Jobs an.

## Umgang mit Secrets

- Secrets landen nie im Repo, nie im Client-Bundle, nie in Logs, nie in Commit-Messages oder Dokumenten.
- Nur Variablen mit Präfix `NEXT_PUBLIC_` dürfen in den Client. Service-Role-Key, Stripe Secret Key, Resend-, Lexware- und DHL-Zugänge existieren nur in Netlify Functions beziehungsweise serverseitigem Code.
- `.env*` steht in `.gitignore`, `.env.example` enthält nur Platzhalter und eine Beschreibung je Variable.
- Bei Bedarf einen Restricted Key mit minimalen Rechten anfordern und die Rechte dokumentieren.
- Geldbeträge als Integer in Cent, Zeitstempel in UTC, Eingaben serverseitig mit Zod validieren, RLS auf jeder Tabelle.

## Git

- Arbeit auf dem jeweils zugewiesenen Branch, klare Commit-Messages, Push mit `git push -u origin <branch>`.
- Keine Pull Requests ohne ausdrückliche Bitte. Kein Merge und kein manuelles Deploy ohne Freigabe des Auftraggebers.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
