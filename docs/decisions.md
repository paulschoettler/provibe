# Architekturentscheidungen (ADRs)

Kurzform: Kontext, Entscheidung, Konsequenz. Neue Einträge oben anfügen.

## ADR-016: Einwilligung als Cookie ohne Personenbezug, Tracking nur hinter der Einwilligung

- Datum: 2026-10-17
- Kontext: TDDDG § 25 und DSGVO Art. 6 und 7 verlangen eine echte Wahl, bevor Meta-Pixel, Google Ads oder TikTok laden. Der Nachweis muss später prüfbar sein, ohne dass wir Besucher identifizieren.
- Entscheidung: Der Stand liegt im Cookie `pv_consent` (12 Monate, nicht httpOnly, weil der Browser ihn vor dem Laden eines Skripts lesen muss). Inhalt: Textversion, Zufallskennung, Zeitpunkt, Auswahl als Buchstabenfolge. Keine personenbezogenen Daten. Die Kennung verknüpft den Cookie mit `consent_logs` als Nachweis. Alle Anbieter sitzen hinter Adaptern in `src/lib/tracking/adapters.ts`, die erst nach Einwilligung laden; serverseitige Ereignisse landen in `tracking_events` nur mit Einwilligung. Steigt die Textversion (`CONSENT_VERSION`), fragt das Banner alle erneut. Banner ohne Dark Patterns: Ablehnen gleichwertig zu Annehmen, Einstellungen jederzeit unter `/cookie-einstellungen` und im Footer.
- Konsequenz: Ohne Einwilligung lädt kein Fremdskript, auch nicht zum Vorladen. Neue Anbieter brauchen einen Adapter, einen Buchstaben im Cookie und eine neue Textversion.

## ADR-015: Importskripte mit direkter PostgreSQL-Verbindung statt Supabase-Client

- Datum: 2026-10-17
- Kontext: Der Shopify-Import (Kunden, Bestellungen, Rabatte, Newsletter) braucht Transaktionen je Block mit Savepoint je Zeile, damit eine kaputte Zeile nicht den ganzen Lauf verwirft und ein Lauf vollständig zurückrollbar bleibt. Der REST-Client von Supabase kann keine Transaktionen.
- Entscheidung: `scripts/import/*` verbindet sich per `pg` direkt mit der Datenbank. Standard ist die lokale Datenbank (`scripts/db/local-pg.sh`), jede andere Adresse braucht `--remote` und ein frisches `pg_dump`-Backup (höchstens 24 Stunden alt). `.env.local` wird in den Skripten bewusst nicht geladen. Jeder Lauf schreibt eine Zeile in `import_runs`, `rollback.ts` entfernt genau die Datensätze eines Laufs.
- Konsequenz: Der Import ist der einzige Code mit direktem Datenbankzugang außerhalb von Supabase. Er läuft nur von Hand, nie aus der Anwendung, und ist durch die Backup-Pflicht an die Schutzregeln in CLAUDE.md gebunden.

## ADR-014: Produktbilder nur als Original, Ableitungen über das Netlify Image CDN

- Datum: 2026-10-17
- Kontext: Das Backoffice lädt Produktbilder hoch. Eine eigene Bildverarbeitung mit `sharp` in Netlify Functions ist groß (native Abhängigkeit, Kaltstart, Bundle-Grenze) und doppelt, was `next/image` ohnehin leistet.
- Entscheidung: Der Upload prüft Typ aus dem Dateikopf, Größe (10 MB) und Abmessungen, speichert nur das Original im Bucket `product-media` unter einem Pfad aus Handle und Inhalts-Hash. AVIF, WebP und responsive Größen erzeugt `next/image` über das Netlify Image CDN. `sharp` kommt zur Laufzeit nicht vor.
- Konsequenz: Kein nativer Build-Schritt auf Netlify, keine Bildvarianten im Bucket. Freisteller und Zuschnitte macht der Auftraggeber vor dem Upload.

## ADR-013: Kundensegmente als geprüfte Regel-DSL, Werte nie im SQL-Text

- Datum: 2026-10-17
- Kontext: Segmente für Newsletter und Automationen brauchen flexible Bedingungen (Bestellanzahl, Umsatz, letzte Bestellung, Newsletter-Status, Tags, Postleitzahl). Freitext-SQL aus dem Backoffice wäre eine Einfallstür.
- Entscheidung: Eine Regel ist JSON (`match: all | any`, `conditions: [{ field, op, value }]`). Felder und Operatoren stammen aus einer festen Zod-Whitelist in `src/lib/admin/segments/rules.ts`. Der SQL-Text entsteht ausschließlich aus festen Bausteinen dieser Datei, Werte wandern als jsonb-Array in den Parameter der Datenbankfunktion (Migration 20261017204000, STABLE, nur lesend). Die Übersetzung ist rein und per Vitest getestet.
- Konsequenz: Neue Felder brauchen Code und Test, nicht nur Konfiguration. Mitgliederzahlen werden bei Bedarf berechnet, nicht gespeichert.

## ADR-012: Hintergrundjobs in der Datenbank mit Netlify Scheduled Function als Taktgeber

- Datum: 2026-10-17
- Kontext: Mails, Rechnungen, Reservierungsfreigaben und Automationen dürfen den Checkout nicht blockieren und müssen Fehler überstehen. Netlify bietet keine persistente Queue, Supabase keine Cron-Garantie im Free-Plan.
- Entscheidung: Jobs liegen in der Tabelle `jobs` mit `kind`, `payload`, `run_at`, `attempts`. Die Funktion `claim_due_jobs` holt fällige Jobs mit `FOR UPDATE SKIP LOCKED`, `fail_job_with_backoff` plant Wiederholungen mit 2^attempts Minuten, nach `max_attempts` landet der Job in `dead` und erscheint im Backoffice. Der Runner (`src/lib/admin/jobs/runner.ts`) läuft über `/api/jobs/run`, geschützt mit `JOBS_RUNNER_SECRET`, und wird alle fünf Minuten von der Netlify Scheduled Function `jobs-run` angestoßen. Der Checkout versucht kritische Jobs zusätzlich sofort inline. Alle `kind`-Werte sind in `src/lib/admin/jobs/handlers.ts` registriert; unbekannte Kinds schlagen sofort fehl.
- Konsequenz: Höchstens fünf Minuten Verzögerung für asynchrone Mails. Jobs sind idempotent zu schreiben, weil ein Job nach einem Absturz des Runners erneut läuft.

## ADR-011: Katalog einmal je Build oder Request laden, Erneuerung über Cache-Tags

- Datum: 2026-10-17
- Kontext: Produktseiten, Kollektionen, Suche und Startseite brauchen denselben Katalog. Viele kleine Abfragen je Seite wären langsam und schwer zu invalidieren.
- Entscheidung: `loadRawCatalog` in `src/lib/catalog/products.ts` lädt Produkte, Varianten, Übersetzungen, Bilder, Kollektionen und Bundle-Komponenten in einem Durchgang und hält sie je Request mit React `cache`. Seiten sind statisch mit `revalidate = 3600`; das Backoffice ruft nach jeder Änderung `revalidateTag("catalog")` und `revalidatePath` für die betroffenen Routen auf. Weitere Tags: `content`, `legal`, `redirects`, `reviews`.
- Konsequenz: Änderungen im Backoffice sind innerhalb von Sekunden sichtbar, ohne dass die Seiten dynamisch werden. Neue Datenquellen für den Katalog gehören in `loadRawCatalog`, nicht in einzelne Seiten.

## ADR-010: Warenkorb über httpOnly-Cookie und Service-Role

- Datum: 2026-09-21
- Kontext: Gäste kaufen ohne Konto. `carts` und `cart_items` haben RLS ohne anon-Policies (ADR-007), der Client soll nie Preise oder fremde Warenkörbe sehen.
- Entscheidung: Der Warenkorb ist an ein zufälliges Token (`carts.token`) gebunden, das ausschließlich in einem httpOnly-Cookie `pv_cart` liegt. Alle Änderungen laufen über Server Actions (`src/lib/cart/actions.ts`) mit dem Service-Role-Client; der Client sendet nur Varianten-IDs und Mengen, Summen rechnet `src/lib/pricing` auf dem Server. Der Drawer ist eine Client-Erweiterung, `/cart` funktioniert vollständig ohne JavaScript über Formulare.
- Konsequenz: Kein Warenkorbzustand im localStorage, kein Preis vom Client. Beim Login wird der Gast-Warenkorb später per `customer_id` übernommen (Status `merged`).

## ADR-009: Startseite mit einer fixen 3D-Canvas als Progressive Enhancement

- Datum: 2026-09-21
- Kontext: Design-Prompt des Auftraggebers (Hero mit 3D-Dose, Scroll-Sequenz, Sortenwechsel jederzeit, Dosen im Footer). Harte Rendering-Regel: alles Inhaltliche im Server-HTML.
- Entscheidung: Genau eine `<Canvas>` (React Three Fiber) liegt fix hinter der Seite und rendert alle Dosen (Hero-Karussell, Sequenz, Footer). Sie wird per `next/dynamic` ohne SSR nach dem ersten Paint geladen und nur, wenn WebGL vorhanden ist, `prefers-reduced-motion` nicht gesetzt ist und das Gerät nicht als schwach gilt (`html[data-tier]`). Alle Texte, Zutaten, Buttons und die freigestellten Dosen-PNGs stehen im Server-HTML; das PNG blendet zur 3D-Dose über, sobald das Modell geladen ist. Der Zustand (aktive Sorte, Scroll-Fortschritte, Tier) liegt in einem kleinen zustand-Store (`src/lib/home/store.ts`), der die einzige Kopplung zwischen DOM-Sektionen und Szene ist. Scroll-Animationen laufen über GSAP ScrollTrigger mit `scrub`, Lenis nur auf Desktop. Modelle liegen als optimierte GLB (2K Desktop, 1K Mobil, Meshopt, WebP) unter `public/3d/`.
- Konsequenz: `curl` zeigt die volle Seite ohne JS. Die Startseite ist die einzige Seite mit WebGL; Produktseiten nutzen später dieselbe Szene oder nur PNGs. Der Bau lief in drei parallelen Arbeitspaketen (Szene/Hero, Layout/Sektionen, Warenkorb) mit vorab festgelegten Verträgen (Store, `CartView`, `useCart`).

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
