# Architekturentscheidungen (ADRs)

Kurzform: Kontext, Entscheidung, Konsequenz. Neue Einträge oben anfügen.

## ADR-008: Seed-Daten als Migrationen

- Datum: 2026-09-21
- Kontext: Der Supabase-MCP führt `execute_sql` schreibgeschützt aus, `apply_migration` darf schreiben. Das Briefing (Abschnitt 9) verlangt Seed-Daten aus dem aktuellen Shop als reproduzierbare SQL-Dateien im Repo.
- Entscheidung: `scripts/seed/generate-seed-sql.ts` erzeugt aus dem Shopify-Snapshot idempotente Migrationen (`*_seed_shopify_snapshot_part*.sql`, maximal 30 kB je Teil, feste UUIDs aus Handles, `ON CONFLICT`). Sie laufen lokal und remote in derselben Reihenfolge wie Schema-Migrationen.
- Konsequenz: Ein erneuter Lauf des Generators überschreibt die Teile. Auf dem Supabase-Projekt sind Versionen 20260921130000 bis 130005 bereits angewendet; künftige Datenkorrekturen bekommen neue Versionen statt geänderter alter Dateien.

## ADR-007: Datenmodell-Grundsätze

- Datum: 2026-09-21
- Kontext: Briefing Abschnitte 4, 5, 8, 9, 13.
- Entscheidung:
  - Geld als `integer` in Cent, Steuer- und Rabattsätze als Basispunkte (1900 = 19 %), Zeitstempel `timestamptz`.
  - Inhalte je Locale in `*_translations`-Tabellen (Produkte, Kollektionen, Seiten, Blog, Rechtstexte), Standard `de`.
  - Pfand als `deposit_cents_per_unit` am Produkt mal `unit_count` an der Variante, nie im Preis. Grundpreis aus `(Preis − Pfand) / (unit_count × net_content_per_unit)` per SQL-Funktion und identisch in TypeScript (`src/lib/pricing/base-price.ts`).
  - Streichpreise tragen einen `compare_at_kind` (former_price, components_sum, quantity_reference, none). Packgrößen-Referenzen aus Shopify werden nicht als Streichpreis übernommen (Antwort B3), Bundles zeigen die Summe der Komponentenpreise (B4).
  - Bundles sind Produkte mit `kind = 'bundle'` und `bundle_components` je Bundle-Variante. Bestand wird auf Komponentenebene geführt; dafür existieren pro Sorte inaktive Einzeldosen-Varianten (`PV-WB-01` usw.), die nicht einzeln verkauft werden.
  - Bestandsreservierungen hängen an `checkout_sessions`, laufen nach 20 Minuten ab (pg_cron) und werden im Stripe-Webhook in Abgänge gewandelt.
  - Bestellungen entstehen nur aus `payment_intent.succeeded`; `orders.payment_intent_id` ist unique (Idempotenz), `webhook_events(provider, event_id)` ebenfalls.
  - Job-Queue in Postgres (`jobs`, `claim_jobs` mit `SKIP LOCKED`, Backoff in `fail_job`) für Lexware, Mails, DHL, Tracking. Eine Bestellung scheitert nie an einem nachgelagerten Dienst.
  - RLS auf allen Tabellen mit `force row level security`. Öffentliche Lesezugriffe nur auf veröffentlichte Katalog- und Inhaltsdaten, Kunden nur auf eigene Daten, Staff über `is_staff()`/`is_admin()`. Schreibzugriffe für Warenkorb, Checkout und Formulare ausschließlich serverseitig mit Service Role.
  - `available_quantity()` bleibt bewusst `SECURITY DEFINER` und öffentlich aufrufbar (liefert nur eine Zahl), alle anderen Advisor-Befunde sind in Migration 0017 behoben.
  - Rollen: owner, admin, support, fulfillment. "Super-Admin" aus Antwort A7 ist als `owner` abgebildet.
- Konsequenz: Preis-, Rabatt- und Steuerlogik existiert doppelt (SQL für Konsistenz und Reports, TypeScript für Checkout). Beide sind gegen dieselben Beispielwerte getestet (`scripts/db/verify.sql`, `src/lib/pricing/*.test.ts`).

## ADR-006: Allergen "Milch" bleibt trotz laktosefreiem Produkt

- Datum: 2026-09-21
- Kontext: Der Auftraggeber bestätigt, dass der Eistee laktosefrei ist, und möchte Laktose aus den Allergenen streichen. Das Protein ist Beta-Lactoglobulin aus Kuhmilch.
- Entscheidung: Die Allergenkennzeichnung nennt weiterhin "Milch" (in der Zutatenliste hervorgehoben), weil Milchprotein unabhängig von der Laktose ein kennzeichnungspflichtiges Allergen nach LMIV Anhang II ist. Der Zusatz "einschließlich Laktose" entfällt. "Laktosefrei" wird als eigenes Produktattribut geführt und auf der PDP angezeigt.
- Konsequenz: Beide Punkte stehen in `docs/legal-checklist.md` zur anwaltlichen Prüfung, insbesondere die Voraussetzungen für die Auslobung "laktosefrei".

## ADR-005: Netlify-Konfiguration ausschließlich im Repo

- Datum: 2026-09-21
- Kontext: Die Netlify-Site ist per Oberfläche mit dem GitHub-Repo verbunden, ein API-Token liegt (noch) nicht vor.
- Entscheidung: Build, Redirects, Header, Functions, Scheduled Functions und Kontext-Regeln (Deploy Previews ohne Secrets) stehen vollständig in `netlify.toml`. Secrets werden als Umgebungsvariablen in Netlify gepflegt, entweder per CLI mit Token oder per Oberfläche nach Anleitung. Nichts davon liegt im Repo.
- Konsequenz: Jede Änderung an Infrastruktur ist im Git-Verlauf nachvollziehbar. Bis der Token da ist, kann ich Build-Logs nicht selbst lesen.

## ADR-004: Bestehendes Supabase-Projekt als einzige Instanz

- Datum: 2026-09-21
- Kontext: Der Auftraggeber stellt das Projekt `ajscwnbgaijknmdrtihn` (eu-central-1, Postgres 17, leer) bereit.
- Entscheidung: Dieses Projekt ist die einzige Instanz für Entwicklung vor dem Go-live und für den Betrieb danach. Migrationen liegen als nummerierte SQL-Dateien unter `supabase/migrations/` und werden identisch über den Supabase-MCP (`apply_migration`) beziehungsweise später über die CLI angewendet, sodass die Migrationshistorie in der Datenbank mit dem Repo übereinstimmt.
- Konsequenz: Ab dem Import echter Kundendaten gelten die Schutzregeln aus `CLAUDE.md`.

## ADR-003: Lokale Tests ohne Docker gegen PostgreSQL 16

- Datum: 2026-09-21
- Kontext: Das Briefing sieht lokale Entwicklung gegen den Supabase-Local-Stack (Docker) vor. In der Cloud-Umgebung von Claude Code gibt es keinen Docker-Daemon, PostgreSQL 16 ist aber installiert.
- Entscheidung (vorbehaltlich Frage A4): Migrationen und Unit-Tests laufen gegen einen lokalen PostgreSQL-16-Server (`initdb` in ein temporäres Datenverzeichnis, `pg_ctl start`). Ein Test-Setup-Skript legt die Schemas `auth` und `storage` mit den Spalten an, auf die unsere Policies verweisen (`auth.users`, `auth.uid()`, `auth.jwt()`), damit RLS-Policies lokal geprüft werden können. Integrationstests gegen Supabase Auth und Storage laufen vor dem Go-live gegen das Live-Projekt, danach gegen einen separaten Schema-Namespace oder ein Supabase-Branch, falls der Plan das erlaubt.
- Konsequenz: Kein `supabase start`. `supabase db push` und `supabase gen types` funktionieren weiterhin über die Remote-Verbindung. Wer lokal mit Docker arbeitet, kann den offiziellen Stack trotzdem nutzen, die Migrationsdateien sind identisch.

## ADR-002: Quell-Assets und Shopify-Snapshot im Repo

- Datum: 2026-09-21
- Kontext: Das Briefing verlangt Assets in höchster Auflösung unter `assets/source/`. Der Stand ist 42 Dateien mit 107 MB, größte Datei 37 MB (Video), 16 MB (PNG). GitHub warnt ab 50 MB pro Datei und blockiert ab 100 MB.
- Entscheidung: Originale liegen in Git unter `assets/source/` ohne Git LFS, dazu `manifest.json` mit Quelle, Maßen und Größe. Der Shopify-Datenstand (`products.json`, `collections.json`, Sitemaps, SEO-Inventar) liegt unter `assets/source/data/shopify-snapshot/`. Optimierte Ableitungen entstehen im Build und werden nicht eingecheckt.
- Konsequenz: Klonen dauert etwas länger. Sollte das Volumen 300 MB überschreiten oder Videos dazukommen, wechseln wir auf Git LFS oder einen Supabase-Storage-Bucket `source-assets` (Frage F1).

## ADR-001: Dokumentstruktur und verbindliches Briefing

- Datum: 2026-09-21
- Kontext: Das Projekt läuft über viele Sessions, der Anhang mit dem Briefing ist später nicht mehr sichtbar.
- Entscheidung: `docs/briefing.md` ist die unveränderte Kopie des Briefings und gilt als verbindlich. `CLAUDE.md` verweist darauf und hält die Kernregeln fest. Analyse, Fragen, Plan, ADRs, Setup und Quelltexte liegen unter `docs/`. Antworten auf Fragen werden in `docs/fragen.md` nachgetragen und, wo es Architektur betrifft, als ADR festgehalten.
- Konsequenz: Jede Session beginnt mit `CLAUDE.md`, `docs/briefing.md`, `docs/plan.md` und offenen Punkten in `docs/fragen.md`.
