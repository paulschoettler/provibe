# Einmalige Einrichtung: Werkzeuge und Zugänge

Stand: 21.09.2026, geprüft in der Claude-Code-Cloud-Umgebung (Linux, Node 22, pnpm 10, Python 3.11, Chromium/Playwright vorinstalliert).

## Was bereits funktioniert

| Werkzeug | Status | Details |
|---|---|---|
| BYQ Supply MCP | verfügbar | `search_byq_styles` liefert 50 Marketplace-Designsysteme, Komponenten, Wireframes und Gems sind abrufbar |
| Supabase MCP | verfügbar und autorisiert | Organisation "Abimanufaktur GmbH" (`coollircnlwtzulzhrbj`), 8 bestehende Projekte in `eu-central-1` (Frankfurt), noch kein PROVIBE-Projekt |
| Supabase CLI | verfügbar über `npx supabase@latest` (2.117.0) | für Migrationen, Typgenerierung, `db push`, `db dump` |
| Netlify CLI | verfügbar über `npx netlify-cli@latest` (27.8.0) | **nicht eingeloggt**, braucht `NETLIFY_AUTH_TOKEN` |
| GitHub MCP | verfügbar | Repo `paulschoettler/provibe` |
| PostgreSQL 16 lokal | installiert (`/usr/lib/postgresql/16/bin`, `psql`, `pg_dump`) | Ersatz für den Docker-basierten Supabase-Local-Stack (siehe unten) |
| Playwright + Chromium | vorinstalliert | End-to-End-Tests, Lighthouse |

## Was fehlt oder eingeschränkt ist

| Werkzeug | Status | Konsequenz |
|---|---|---|
| Docker-Daemon | **nicht verfügbar** (Client installiert, kein Socket) | `supabase start` (lokaler Supabase-Stack) läuft in dieser Umgebung nicht. Lokale Tests laufen stattdessen gegen einen lokalen PostgreSQL-16-Server, den ich per `initdb`/`pg_ctl` starte. Supabase-spezifische Schemas (`auth`, `storage`) werden dafür als Stubs mitgeführt. Details in `docs/decisions.md` (ADR-003). |
| Stripe CLI | nicht installiert | Ich lade das Binary aus den GitHub-Releases, sobald Phase 5 startet. Webhook-Tests laufen alternativ über die Stripe-API (`POST /v1/webhook_endpoints`) und signierte Test-Events. |
| Netlify Login | Token fehlt | siehe unten |

## Was du einmalig einrichten musst

### 1. Netlify Personal Access Token (jetzt, vor Phase 2)

1. Netlify öffnen, oben rechts Avatar, **User settings**, dann **Applications**.
2. Unter **Personal access tokens** auf **New access token**, Name `claude-code-provibe`, Ablauf zum Beispiel 1 Jahr, **Generate token**.
3. Token kopieren und in der Claude-Code-Umgebung als Umgebungsvariable hinterlegen: claude.ai/code, **Settings**, deine Umgebung, **Environment variables**, Name `NETLIFY_AUTH_TOKEN`, Wert einfügen.
4. Falls die Site in einem Team liegen soll, das nicht dein Standard-Team ist: Team-Slug nennen (Netlify, Team settings, General, Team slug).

Der Token landet damit nur in der Umgebung, nie im Repo. Ich prüfe mit `netlify status`.

### 2. Supabase-Projekt (jetzt, vor Phase 3)

Der Supabase-MCP ist bereits autorisiert. Zwei Wege:

- **Empfohlen:** Du legst das Projekt an (Dashboard, **New project**, Organisation Abimanufaktur GmbH, Name `provibe`, Region **Frankfurt (eu-central-1)**, Datenbank-Passwort generieren lassen und in deinem Passwort-Manager speichern, Plan siehe Frage A2 in `docs/fragen.md`). Danach nennst du mir nur die Project-Ref. So bleibt das DB-Passwort bei dir.
- Alternativ lege ich das Projekt per MCP an. Dann erzeuge ich das Passwort, hinterlege es ausschließlich als Netlify-Umgebungsvariable und du setzt es bei Bedarf im Dashboard zurück.

Für CLI-Aktionen (`supabase db push`, Typgenerierung, `pg_dump`-Backups) brauche ich zusätzlich einen **Supabase Access Token** als Umgebungsvariable `SUPABASE_ACCESS_TOKEN` (Dashboard, Account, **Access Tokens**, **Generate new token**, Name `claude-code-provibe`). Für Backups per `pg_dump` brauche ich später den Datenbank-Connection-String, den ich als `SUPABASE_DB_URL` in der Umgebung erwarte.

### 3. Später, jeweils erst wenn die Phase beginnt

| Phase | Zugang | Was ich genau brauche |
|---|---|---|
| 5 (Checkout) | Stripe Restricted Key (Testmodus) | Rechte liste ich in der Anfrage auf: Payment Intents (write), Customers (write), Webhook Endpoints (write), Refunds (write), Apple Pay Domains (write), Payment Methods (read) |
| 5 (Mails) | Resend API Key | Full access für Domain-Anlage, danach Sending-Key für den Betrieb |
| 5 (Rechnungen) | Lexware Office API Key | aus Lexware Office, Einstellungen, Erweiterungen, Public API |
| 5/6 (Versand) | DHL Geschäftskundenportal: API-Zugang, Abrechnungsnummer (EKP + Verfahren + Teilnahme) | erst Sandbox, dann Produktion |
| 8 (Tracking) | Meta Pixel ID + CAPI Token, GA4 Measurement ID + API Secret, Google Ads Conversion ID/Labels, TikTok Pixel ID + Events API Token | trägst du im Backoffice ein |
| 10 (Go-live) | Zugriff auf DNS beim Registrar | ich liefere die exakten Einträge |

## Was ich in dieser Umgebung selbst erledige

- Netlify: Site anlegen, mit GitHub verbinden, Build-Settings, Env-Variablen, Functions, Redirects, Header, Deploy Previews ohne Live-Secrets, Passwortschutz bis zum Go-live.
- Supabase: Migrationen, RLS, Storage-Buckets, Auth-Konfiguration, SMTP über Resend, Advisors, Typgenerierung, Owner-Account.
- Stripe, Resend, Lexware, DHL: Konfiguration über deren APIs, sobald die Keys da sind.
