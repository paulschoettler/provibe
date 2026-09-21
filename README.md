# PROVIBE Shop

Eigener Shop für PROVIBE (Eistee mit Protein) als Ablösung des Shopify-Stores. Next.js (App Router, TypeScript, Tailwind), Netlify, Supabase, Stripe, Resend, Lexware Office, DHL.

Das verbindliche Briefing steht in `docs/briefing.md`, die Arbeitsregeln in `CLAUDE.md`, der Plan in `docs/plan.md`.

## Setup

```bash
pnpm install
cp .env.example .env.local        # Werte eintragen, für lokale Arbeit reicht APP_INTEGRATIONS=mock
pnpm dev                          # http://localhost:3000
```

## Befehle

| Befehl                                   | Zweck                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js                                                                                            |
| `pnpm check`                             | Lint, Typecheck, Unit-Tests                                                                        |
| `pnpm test`                              | Vitest (Preis-, Rabatt-, Versand-, Steuer-, Grundpreislogik)                                       |
| `pnpm db:local`                          | Lokalen PostgreSQL 16 starten, Migrationen anwenden, Verifikation ausführen (ohne Docker, ADR-003) |
| `pnpm db:local:stop`                     | Lokalen PostgreSQL stoppen                                                                         |
| `pnpm db:seed:generate`                  | `supabase/seed.sql` aus dem Shopify-Snapshot erzeugen                                              |

## Datenbank

- Migrationen: `supabase/migrations/*.sql`, nummeriert, werden identisch lokal (`scripts/db/apply-migrations.sh`) und auf dem Supabase-Projekt angewendet.
- Verifikation: `scripts/db/verify.sql` prüft RLS auf allen Tabellen, Preislogik, Reservierungen, Job-Queue.
- Seed: generierte, idempotente Migrationen `*_seed_shopify_snapshot_part*.sql` (Briefing 9: Seed aus dem aktuellen Shop im Repo).
- Geldbeträge in Cent, Zeitstempel UTC, Locale in allen Inhaltstabellen.

## Umgebungsvariablen

Siehe `.env.example`. Nur `NEXT_PUBLIC_*` gelangt in den Client. Live-Keys ausschließlich im Netlify-Kontext `production`. Deploy Previews laufen mit `APP_INTEGRATIONS=mock`.

## Deploy

Netlify baut bei jedem Push. Konfiguration in `netlify.toml` (Build, Header, Redirects, Kontexte). Bis zum Go-live ist die Site per `X-Robots-Tag: noindex` gesperrt; optional zusätzlich Basic Auth über `SITE_PROTECT_USER` und `SITE_PROTECT_PASSWORD`.

## Betrieb

- Externe Dienste hinter Interfaces in `src/lib/integrations/` (Stripe, Resend, Lexware, DHL) mit Mock-Implementierungen.
- Job-Queue in Postgres (`jobs`, `claim_jobs`, `fail_job` mit Backoff). Worker folgt als Netlify Scheduled Function.
- Backoffice unter `/admin` (Phase 4), Handbuch später in `docs/handbuch.md`.
