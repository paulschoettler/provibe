# Einmalige Einrichtung: Werkzeuge und Zugänge

Stand: 21.09.2026, geprüft in der Claude-Code-Cloud-Umgebung (Linux, Node 22, pnpm 10, Python 3.11, Chromium/Playwright vorinstalliert).

## Was bereits funktioniert

| Werkzeug              | Status                                                        | Details                                                                                                                                    |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| BYQ Supply MCP        | verfügbar                                                     | `search_byq_styles` liefert 50 Marketplace-Designsysteme, Komponenten, Wireframes und Gems sind abrufbar                                   |
| Supabase MCP          | verfügbar und autorisiert                                     | Organisation "Abimanufaktur GmbH" (`coollircnlwtzulzhrbj`), 8 bestehende Projekte in `eu-central-1` (Frankfurt), noch kein PROVIBE-Projekt |
| Supabase CLI          | verfügbar über `npx supabase@latest` (2.117.0)                | für Migrationen, Typgenerierung, `db push`, `db dump`                                                                                      |
| Netlify CLI           | verfügbar über `npx netlify-cli@latest` (27.8.0)              | **nicht eingeloggt**, braucht `NETLIFY_AUTH_TOKEN`                                                                                         |
| GitHub MCP            | verfügbar                                                     | Repo `paulschoettler/provibe`                                                                                                              |
| PostgreSQL 16 lokal   | installiert (`/usr/lib/postgresql/16/bin`, `psql`, `pg_dump`) | Ersatz für den Docker-basierten Supabase-Local-Stack (siehe unten)                                                                         |
| Playwright + Chromium | vorinstalliert                                                | End-to-End-Tests, Lighthouse                                                                                                               |

## Was fehlt oder eingeschränkt ist

| Werkzeug      | Status                                                | Konsequenz                                                                                                                                                                                                                                                                                                              |
| ------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker-Daemon | **nicht verfügbar** (Client installiert, kein Socket) | `supabase start` (lokaler Supabase-Stack) läuft in dieser Umgebung nicht. Lokale Tests laufen stattdessen gegen einen lokalen PostgreSQL-16-Server, den ich per `initdb`/`pg_ctl` starte. Supabase-spezifische Schemas (`auth`, `storage`) werden dafür als Stubs mitgeführt. Details in `docs/decisions.md` (ADR-003). |
| Stripe CLI    | nicht installiert                                     | Ich lade das Binary aus den GitHub-Releases, sobald Phase 5 startet. Webhook-Tests laufen alternativ über die Stripe-API (`POST /v1/webhook_endpoints`) und signierte Test-Events.                                                                                                                                      |
| Netlify Login | Token fehlt                                           | siehe unten                                                                                                                                                                                                                                                                                                             |

## Was du einmalig einrichten musst

### 1. Netlify Personal Access Token (jetzt, vor Phase 2)

1. Netlify öffnen, oben rechts Avatar, **User settings**, dann **Applications**.
2. Unter **Personal access tokens** auf **New access token**, Name `claude-code-provibe`, Ablauf zum Beispiel 1 Jahr, **Generate token**.
3. Token kopieren und in der Claude-Code-Umgebung als Umgebungsvariable hinterlegen: claude.ai/code, **Settings**, deine Umgebung, **Environment variables**, Name `NETLIFY_AUTH_TOKEN`, Wert einfügen.
4. Falls die Site in einem Team liegen soll, das nicht dein Standard-Team ist: Team-Slug nennen (Netlify, Team settings, General, Team slug).

Der Token landet damit nur in der Umgebung, nie im Repo. Ich prüfe mit `netlify status`.

### 2. Supabase-Projekt (erledigt) und Keys

Das Projekt `ajscwnbgaijknmdrtihn` ist angelegt, Schema und Seed sind drauf. Für die nächsten Schritte brauche ich drei Werte als Umgebungsvariablen in der Claude-Code-Umgebung (nicht im Repo):

1. `SUPABASE_SERVICE_ROLE_KEY`: Dashboard, **Project Settings**, **API Keys**, Tab **Legacy** oder **Secret keys**, Service-Role- beziehungsweise Secret-Key kopieren. Damit lade ich Bilder in Storage, lege die Owner-Accounts an und teste RLS gegen das Live-Schema.
2. `SUPABASE_ACCESS_TOKEN`: Dashboard, Avatar, **Account**, **Access Tokens**, **Generate new token**, Name `claude-code-provibe`.
3. `SUPABASE_DB_URL`: Dashboard, **Connect** (oben), **Session pooler** oder **Direct connection**, URI kopieren und das Datenbank-Passwort einsetzen. Nur für `pg_dump`-Backups.

Dieselben Werte 1 und die Publishable/anon-Keys gehören später in Netlify (Kontext production) als `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

### 3. Netlify ohne Token: was du einmal klicken musst

Die Site ist mit dem Repo verbunden. Solange kein `NETLIFY_AUTH_TOKEN` vorliegt, bitte einmalig in Netlify, **Site configuration**, **Environment variables**, **Add a variable**, jeweils mit Scope "All" und, wo angegeben, nur für den Kontext **Production**:

| Variable                                      | Wert                                       | Kontext                                                          |
| --------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `APP_INTEGRATIONS`                            | `mock`                                     | alle (bis Stripe-Testmodus steht, dann `live` nur in Production) |
| `NEXT_PUBLIC_SITE_URL`                        | `https://<deine-site>.netlify.app`         | alle                                                             |
| `NEXT_PUBLIC_SUPABASE_URL`                    | `https://ajscwnbgaijknmdrtihn.supabase.co` | alle                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`        | Publishable Key aus Supabase (API Keys)    | alle                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`                   | Service-Role-Key                           | **nur Production**                                               |
| `SITE_PROTECT_USER` / `SITE_PROTECT_PASSWORD` | frei wählbar                               | alle (Basic-Auth-Schutz bis zum Go-live)                         |
| `APP_TOKEN_SECRET`                            | 32+ zufällige Zeichen                      | **nur Production**                                               |
| `JOBS_RUNNER_SECRET`                          | 32+ zufällige Zeichen                      | **nur Production**                                               |

Außerdem: **Site configuration**, **Build & deploy**, **Deploy Previews**: entweder deaktivieren oder so lassen (sie laufen dank `netlify.toml` mit Mock-Integrationen und ohne Production-Secrets). Bitte schick mir die Netlify-Site-URL, dann trage ich sie in `.env.example` und `docs` ein.

### 3a. Netlify und Git-Autor (seit 17.10.2026)

Netlify baut private Repos nur noch, wenn der Autor des Commits ein verifiziertes Teammitglied ist ("Unrecognized Git contributor"). Commits mit dem Autor "Claude" werden blockiert, auch manuelle Builds per API und CLI. Deshalb committet die Entwicklungsumgebung im Repo mit deiner Identität (`git config user.name "Paul Schöttler"`, `git config user.email "info@abimanufaktur.de"`), die Mitarbeit von Claude steht weiterhin als Co-Authored-By-Zeile in jeder Commit-Nachricht. Sollte der Build trotzdem blockieren, passt die E-Mail nicht zu deinem GitHub-Konto; dann die bei GitHub hinterlegte Adresse eintragen.

### 4. Später, jeweils erst wenn die Phase beginnt

| Phase          | Zugang                                                                                                                           | Was ich genau brauche                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5 (Checkout)   | Stripe Restricted Key (Testmodus)                                                                                                | Rechte liste ich in der Anfrage auf: Payment Intents (write), Customers (write), Webhook Endpoints (write), Refunds (write), Apple Pay Domains (write), Payment Methods (read) |
| 5 (Mails)      | Resend API Key                                                                                                                   | Full access für Domain-Anlage, danach Sending-Key für den Betrieb                                                                                                              |
| 5 (Rechnungen) | Lexware Office API Key                                                                                                           | aus Lexware Office, Einstellungen, Erweiterungen, Public API                                                                                                                   |
| 5/6 (Versand)  | DHL Geschäftskundenportal: API-Zugang, Abrechnungsnummer (EKP + Verfahren + Teilnahme)                                           | erst Sandbox, dann Produktion                                                                                                                                                  |
| 8 (Tracking)   | Meta Pixel ID + CAPI Token, GA4 Measurement ID + API Secret, Google Ads Conversion ID/Labels, TikTok Pixel ID + Events API Token | trägst du im Backoffice ein                                                                                                                                                    |
| 10 (Go-live)   | Zugriff auf DNS beim Registrar                                                                                                   | ich liefere die exakten Einträge                                                                                                                                               |

## Was ich in dieser Umgebung selbst erledige

- Netlify: Site anlegen, mit GitHub verbinden, Build-Settings, Env-Variablen, Functions, Redirects, Header, Deploy Previews ohne Live-Secrets, Passwortschutz bis zum Go-live.
- Supabase: Migrationen, RLS, Storage-Buckets, Auth-Konfiguration, SMTP über Resend, Advisors, Typgenerierung, Owner-Account.
- Stripe, Resend, Lexware, DHL: Konfiguration über deren APIs, sobald die Keys da sind.
