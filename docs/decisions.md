# Architekturentscheidungen (ADRs)

Kurzform: Kontext, Entscheidung, Konsequenz. Neue Einträge oben anfügen.

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
