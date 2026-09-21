# Phasenplan

Stand: 21.09.2026. Reihenfolge gegenüber dem Briefing angepasst: Das kundenseitige Frontend wartet auf Design-Beispiele des Auftraggebers (Frage E1). Datenmodell und Backoffice ziehen deshalb vor.

| Phase | Inhalt                                                                                                                                                                                                                                                                                                                                 | Status                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1     | Analyse, Asset-Download, Werkzeugprüfung, Fragenrunde                                                                                                                                                                                                                                                                                  | **fertig**, Antworten liegen vor                                               |
| 2     | Projektgerüst: Next.js (App Router, TypeScript, Tailwind), ESLint, Prettier, Vitest, Playwright, `.env.example`, Netlify-Site anlegen (Passwortschutz, Deploy Previews ohne Secrets), CI-Checks, Interfaces und Mocks für Stripe, Resend, Lexware, DHL                                                                                 | **fertig** (Statusbericht unten)                                               |
| 3     | Datenmodell und Migrationen: Produkte, Varianten, Bundles, Preise mit Historie, Pfand, LMIV-Felder, Bestand mit Reservierungen, Kunden (B2C/B2B vorbereitet), Bestellungen, Rabatte, Versandzonen, Rechtstexte versioniert, Consent-Log, Newsletter mit Opt-in-Protokoll, Abo-Tabellen vorbereitet, RLS, Seed aus dem Shopify-Snapshot | **fertig** (Statusbericht unten)                                               |
| 4     | Backoffice-Grundgerüst unter `/admin`: Auth mit 2FA, Rollen, Audit-Log, Produkte, Bestand, Inhalte, Einstellungen                                                                                                                                                                                                                      | offen                                                                          |
| 5     | Storefront: Design-Richtungen aus BYQ Supply auf Basis der Beispiele, Tokens, Basiskomponenten, alle Seiten aus dem URL-Inventar, Redirects, SEO-Grundlagen, `curl`-Test ohne JavaScript                                                                                                                                               | **in Arbeit**: Startseite nach Design-Prompt (5a), restliche Seiten (5b) offen |
| 6     | Warenkorb (Minimalversion entsteht mit der Startseite), Checkout mit Stripe Payment Element (Testmodus), Webhook, Bestellung, Rechnungen über Lexware, transaktionale Mails über Resend                                                                                                                                                | offen                                                                          |
| 7     | Backoffice: Bestellungen, Erstattungen, DHL-Labels (Mock, dann Sandbox), Rabatte, Dashboard                                                                                                                                                                                                                                            | offen                                                                          |
| 8     | CRM, Newsletter, Automationen, Bewertungen                                                                                                                                                                                                                                                                                             | offen                                                                          |
| 9     | Consent, Tracking (Meta, Google, TikTok), Feeds                                                                                                                                                                                                                                                                                        | offen                                                                          |
| 10    | Migration der Shopify-Exporte, Tests, Performance, Accessibility, Rechts-Checkliste, Rechtstexte-Gegenüberstellung                                                                                                                                                                                                                     | offen                                                                          |
| 11    | Go-live-Vorbereitung: DNS, Stripe live, Webhooks, Testbestellung, Search Console, Übergangsphase Shopify                                                                                                                                                                                                                               | offen                                                                          |

## Phase 1: Statusbericht (21.09.2026)

Fertig: Briefing, CLAUDE.md, Analyse, Assets, Quelltexte, Setup, ADRs, 46 Fragen. Antworten liegen vor (`docs/fragen.md`).

## Phase 2 und 3: Statusbericht (21.09.2026)

Fertig:

- Next.js 16.3 mit TypeScript strict, Tailwind 4, ESLint, Prettier, Vitest (25 Tests grün), Build läuft
- `netlify.toml`: Build, Next-Runtime, Security-Header, `X-Robots-Tag: noindex` bis zum Go-live, 20 Redirects aus dem alten Shop, Deploy Previews ohne Live-Secrets
- `src/proxy.ts`: optionaler Basic-Auth-Schutz der gesamten Site (`SITE_PROTECT_USER`/`PASSWORD`), Webhooks ausgenommen
- `.env.example` vollständig, `src/lib/env`: validierte Server-Env, Testkey-Zwang außerhalb production, E-Mail-Allowlist
- Preislogik in `src/lib/pricing`: Grundpreis ohne Pfand, Rabatte (prozentual, fest, Gratisversand, Limits, Laufzeit), Versandtarife mit Freigrenze auf rabattiertem Warenwert ohne Pfand, Steuerzeilen je Satz, Rabattverteilung ohne Rundungsdifferenz
- Provider-Interfaces mit Mocks: Payments (Stripe fertig implementiert), E-Mail (Resend fertig implementiert), Rechnungen (Lexware-Gerüst), Versand (DHL-Gerüst), zentrale Fabrik `integrations()`
- Datenmodell: 17 Migrationen unter `supabase/migrations/`, lokal gegen PostgreSQL 16 verifiziert (`scripts/db/verify.sql`: RLS auf 71 Tabellen, Pfand, Grundpreis, Preishistorie, Bundle-Verfügbarkeit, Reservierung, Überverkaufsschutz, Job-Queue, Rate Limit, Suche, anon-Sichtprüfung) und identisch auf Supabase angewendet
- Seed: 6 generierte Migrationen mit 9 Produkten, 38 Varianten (inklusive Einzeldosen als Bundle-Komponenten), 31 Bundle-Komponenten, 28 Bildern, 4 Kollektionen, 5 Rechtstexten (Version 1, Entwurf), 6 Seiten, 5 Startseiten-Modulen, Versandzonen DE/AT, Steuersätze, PRESALE10, Announcement-Bar, Menüs, Staff-Einladungen
- Security Advisors: alle Befunde behoben oder begründet (ADR-007)
- TypeScript-Typen der Datenbank generiert (`src/lib/supabase/database.types.ts`)

Offen und was ich von dir brauche:

- `NETLIFY_AUTH_TOKEN` (A1) oder die Klicks aus `docs/setup.md`, Abschnitt "Netlify ohne Token"
- `SUPABASE_SERVICE_ROLE_KEY` und `SUPABASE_ACCESS_TOKEN` in der Umgebung, damit ich die 42 Originalbilder in den Bucket `product-media` laden und Backups per `pg_dump` ziehen kann
- Design-Beispiele (E1) für die Storefront
- Gewichte (C3), EANs (C4), Etikett-Texte (B9), LUCID (B13), Custom-Pixel-Code (D1), Shopify-Testexport (C9)

Nächster Schritt: Phase 4, Backoffice-Grundgerüst (nicht kundenseitig).

## Phase 5a: Statusbericht Startseite (21.09.2026)

Fertig: Startseite nach Design-Prompt (Hero mit 3D-Karussell, Scroll-Sequenz mit Zutaten, dauerhafter Warenkorb-Button, Header nach der Sequenz, Sektionen Unsere Sorten, Protein for your purse, Founder Bundles, Stimmungsbild, Logo-Zoom mit Dosen, Footer, fünf Wellen), minimaler Warenkorb (Drawer und `/cart`), Newsletter-Anmeldung mit Double Opt-in. Details und Prüfprotokoll in `docs/design-startseite.md`, Abschnitt 7. Deploy auf https://provibe-shop.netlify.app (Basic Auth).

Offen: alle weiteren Seiten aus dem URL-Inventar (Phase 5b: Kollektionen, Produktseiten, Inhaltsseiten, Rechtstexte, Suche, Konto), Checkout (Phase 6), Redirects der alten Pfade.

Vom Auftraggeber gebraucht: Abnahme der Startseite auf dem Handy und am Desktop, Antworten H1 bis H2 in `docs/fragen.md` (Pfand in den Bundles, Steuersatz), weiterhin die Lieferungen aus Phase 1 (Gewichte, EANs, Etikett-Texte, LUCID, Shopify-Export).
