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
- `docs/redirects.md`, `docs/legal-checklist.md`, `docs/rechtstexte-aenderungen.md`, `docs/golive.md`, `docs/handbuch.md` entstehen in späteren Phasen

## Arbeitsweise

- Rolle: Lead Engineer. Der Shopify-Store https://www.provibe-drinks.de/ wird als eigene Anwendung nachgebaut. Keine Funktion, keine Unterseite und kein alter Pfad darf verloren gehen.
- Phase für Phase nach `docs/plan.md`. Nach jeder Phase ein kurzer Statusbericht: fertig, offen, was vom Auftraggeber gebraucht wird.
- Offene Fragen gesammelt stellen, jede mit einer konkreten Empfehlung. Bei Recht, Geld und Kundendaten nie raten.
- So lange wie möglich ohne Zugänge arbeiten: alle externen Dienste (Stripe, Resend, Lexware, DHL, Supabase) hinter Interfaces mit Mock-Implementierungen. `.env.example` vollständig pflegen. Zugänge erst anfordern, wenn sie wirklich gebraucht werden, dann mit exakter Angabe von Key und Berechtigungen.
- Jede Architekturentscheidung als kurzer ADR in `docs/decisions.md`.
- Stack ist gesetzt: Next.js (App Router, TypeScript, Tailwind) mit statischer Generierung und On-Demand-Revalidation, Storefront und Backoffice (`/admin`) in einem Repo, Netlify, Supabase (EU, Frankfurt), Stripe (Payment Element), Resend, Lexware Office, DHL, BYQ Supply für das Design.
- Harte Rendering-Regel: Jede kundenseitige Seite liefert vollständiges HTML vom Server oder aus dem Build. Kein Inhalt nur per Client-JavaScript. Mit `curl` prüfen und dokumentieren.
- Sprache im Chat und in den Dokumenten: Deutsch, Ansprache per Du, keine Gedankenstriche im Fließtext.

## Aktuelle Sperren

- Storefront-Design: Der Auftraggeber hat am 21.09.2026 einen Design-Prompt für die Startseite geliefert (Referenzen ciaoenergy.com, royalbev.com, ballaurent.com, drei GLB-Dosenmodelle). Analyse und Plan in `docs/design-startseite.md`. Fragen G1 bis G12 sind beantwortet (kein Preis im Hero), die Startseite ist gebaut (`docs/design-startseite.md`, Abschnitt 7) und wartet auf Abnahme; Änderungswünsche des Auftraggebers gehen vor. Regeln: Mobile first, alles Inhaltliche im Server-HTML, 3D nur als Progressive Enhancement mit PNG-Fallback.
- Keys liegen ausschließlich in `.env.local` (gitignoriert). Nie in Docs, Commits oder Logs übernehmen.
- Kein Produktivcode, solange die mit **jetzt** markierten Fragen in `docs/fragen.md` unbeantwortet sind.
- Freigabe vom 17.10.2026: Hero-Richtung A (Figma-Datei "PROVIBE Shop", wttVzqEheGArNkqUliXd3x). Alle Unterseiten (Storefront, Konto, Checkout, Backoffice) werden zuerst in Figma entworfen und danach ohne weitere Rückfrage im Code gebaut, inklusive allem, was für den Go-live noch fehlt. Keine Erlaubnisfragen mehr im Chat; Entscheidungen mit Annahme treffen, die Annahme in `docs/fragen.md` Abschnitt H festhalten. Externe Dienste bleiben Mock, bis Keys vorliegen. Die Gründerin ist Celine Grimm; Texte und Bilder bei Bedarf von https://www.provibe-drinks.de/ übernehmen.
- Git und Netlify: Das Repo ist vorübergehend öffentlich, weil Netlify Builds von Autoren ohne Team-Verknüpfung blockiert. Commits laufen unter der Inhaber-Identität (`git config user.name/email` lokal gesetzt), bis Celine der Nutzung ihres GitHub-Kontos zustimmt.

## Schutzregeln für die Live-Instanz

Es gibt genau ein Supabase-Projekt und eine Netlify-Site, beides live. Kein Staging.

- Vor dem Go-live darf auf der Instanz frei gearbeitet werden. Ab dem Import echter Kundendaten gilt sie als Produktion.
- Ab dann: Jede Migration zuerst lokal testen (Supabase CLI, Docker). Migrationen sind vorwärtskompatibel und haben einen dokumentierten Rückweg. Vor jeder Migration ein Backup per `pg_dump` an einen privaten Ort.
- Destruktive Befehle auf der Live-Instanz (`DROP`, `TRUNCATE`, `DELETE` ohne enges `WHERE`, Migrations-Reset, Löschen von Buckets, Pausieren oder Löschen des Projekts) niemals ohne ausdrückliche Freigabe des Auftraggebers im Chat.
- Entwicklung und automatisierte Tests laufen ausschließlich lokal gegen Supabase per CLI und gegen Stripe im Testmodus, nie gegen die Live-Datenbank.
- Netlify Deploy Previews abschalten oder ohne Live-Secrets betreiben.
- Bis zum Go-live liegt die Site hinter Passwortschutz oder `noindex`. Der Schutz fällt erst mit dem DNS-Umzug.
- Stripe bleibt im Testmodus, bis der Auftraggeber den Wechsel nach Checkliste selbst freigibt. Lexware-Rechnungen und DHL-Labels bis dahin nur als Entwurf, Sandbox oder Mock. Testbestellungen markieren und vor dem Go-live nach Rücksprache entfernen.
- Newsletter- und Automations-Versand bis zum Go-live hart auf eine Allowlist von Testadressen begrenzt.

## Umgang mit Secrets

- Secrets landen nie im Repo, nie im Client-Bundle, nie in Logs, nie in Commit-Messages oder Dokumenten.
- Nur Variablen mit Präfix `NEXT_PUBLIC_` dürfen in den Client. Service-Role-Key, Stripe Secret Key, Resend-, Lexware- und DHL-Zugänge existieren nur in Netlify Functions beziehungsweise serverseitigem Code.
- `.env*` steht in `.gitignore`, `.env.example` enthält nur Platzhalter und eine Beschreibung je Variable.
- Bei Bedarf einen Restricted Key mit minimalen Rechten anfordern und die Rechte dokumentieren.
- Geldbeträge als Integer in Cent, Zeitstempel in UTC, Eingaben serverseitig mit Zod validieren, RLS auf jeder Tabelle.

## Git

- Arbeit auf dem jeweils zugewiesenen Branch, klare Commit-Messages, Push mit `git push -u origin <branch>`.
- Keine Pull Requests ohne ausdrückliche Bitte.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
