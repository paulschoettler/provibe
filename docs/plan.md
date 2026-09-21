# Phasenplan

Stand: 21.09.2026. Reihenfolge gegenüber dem Briefing angepasst: Das kundenseitige Frontend wartet auf Design-Beispiele des Auftraggebers (Frage E1). Datenmodell und Backoffice ziehen deshalb vor.

| Phase | Inhalt | Status |
|---|---|---|
| 1 | Analyse, Asset-Download, Werkzeugprüfung, Fragenrunde | **fertig**, wartet auf Antworten (`docs/fragen.md`) |
| 2 | Projektgerüst: Next.js (App Router, TypeScript, Tailwind), ESLint, Prettier, Vitest, Playwright, `.env.example`, Netlify-Site anlegen (Passwortschutz, Deploy Previews ohne Secrets), CI-Checks, Interfaces und Mocks für Stripe, Resend, Lexware, DHL | offen, blockiert durch A1 |
| 3 | Datenmodell und Migrationen: Produkte, Varianten, Bundles, Preise mit Historie, Pfand, LMIV-Felder, Bestand mit Reservierungen, Kunden (B2C/B2B vorbereitet), Bestellungen, Rabatte, Versandzonen, Rechtstexte versioniert, Consent-Log, Newsletter mit Opt-in-Protokoll, Abo-Tabellen vorbereitet, RLS, Seed aus dem Shopify-Snapshot | offen, blockiert durch A2 bis A4, B1, B2 |
| 4 | Backoffice-Grundgerüst unter `/admin`: Auth mit 2FA, Rollen, Audit-Log, Produkte, Bestand, Inhalte, Einstellungen | offen |
| 5 | Storefront: Design-Richtungen aus BYQ Supply auf Basis der Beispiele, Tokens, Basiskomponenten, alle Seiten aus dem URL-Inventar, Redirects, SEO-Grundlagen, `curl`-Test ohne JavaScript | offen, blockiert durch E1 |
| 6 | Warenkorb, Checkout mit Stripe Payment Element (Testmodus), Webhook, Bestellung, Rechnungen über Lexware, transaktionale Mails über Resend | offen |
| 7 | Backoffice: Bestellungen, Erstattungen, DHL-Labels (Mock, dann Sandbox), Rabatte, Dashboard | offen |
| 8 | CRM, Newsletter, Automationen, Bewertungen | offen |
| 9 | Consent, Tracking (Meta, Google, TikTok), Feeds | offen |
| 10 | Migration der Shopify-Exporte, Tests, Performance, Accessibility, Rechts-Checkliste, Rechtstexte-Gegenüberstellung | offen |
| 11 | Go-live-Vorbereitung: DNS, Stripe live, Webhooks, Testbestellung, Search Console, Übergangsphase Shopify | offen |

## Phase 1: Statusbericht

Fertig:

- `docs/briefing.md` (unverändert), `CLAUDE.md`, `.gitignore`
- `docs/analyse.md` mit URL-Inventar (51 geprüfte URLs), SEO-Zustand, Funktionsliste, Produktdaten, LMIV-Angaben, Brand-Tokens, Asset-Liste, Gap-Liste
- `assets/source/`: 42 Originaldateien (107 MB) mit Manifest, Shopify-Snapshot (Produkte, Kollektionen, Sitemaps, SEO-Inventar)
- `docs/quelltexte/`: alle Seitentexte inklusive AGB, Widerruf, Datenschutz, Impressum, Versand, Produkttexte
- `docs/setup.md`: Werkzeugstatus und Einrichtungsschritte
- `docs/decisions.md`: ADR-001 bis ADR-003
- `docs/fragen.md`: 46 Fragen mit Empfehlungen

Offen:

- Antworten auf die Fragen, mindestens A1 bis A4, B1, B2, E1
- Design-Beispiele des Auftraggebers

Kein Produktivcode geschrieben.
