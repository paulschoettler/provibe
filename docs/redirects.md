# Redirects: alte Shopify-Pfade auf den neuen Shop

Stand: 17.10.2026. Grundlage: URL-Inventar in `docs/analyse.md` (Abschnitt 2), `docs/seitenplan.md`, Fragen F2 und F12 in `docs/fragen.md`. Ziel laut Briefing Abschnitt 3: Kein alter Pfad endet in einer 404. Alle Weiterleitungen sind dauerhaft (301) und stehen in `netlify.toml`. Die Tabelle `redirects` in Supabase ist für später im Backoffice gepflegte Weiterleitungen vorbereitet.

## 1. Pfade, die unverändert bleiben (keine Weiterleitung)

| Alter Pfad                                                                 | Neue Route                                 |
| -------------------------------------------------------------------------- | ------------------------------------------ |
| `/`                                                                        | Startseite                                 |
| `/pages/shop`                                                              | Shop-Übersicht                             |
| `/pages/uber-uns`, `/pages/partner`, `/pages/contact`, `/pages/messe`      | Inhaltsseiten (Messe mit `noindex`)        |
| `/pages/impressum`, `/pages/allgemeine-geschaftsbedingungen`               | Rechtstexte aus `legal_documents`          |
| `/pages/ruckgabe-und-wiederrufsbelehrung`, `/pages/versand`                | Rechtstexte aus `legal_documents`          |
| `/policies/privacy-policy`                                                 | Datenschutzerklärung aus `legal_documents` |
| `/pages/widerruf-formular`                                                 | eigene Widerrufsfunktion                   |
| `/collections`, `/collections/all`, `/alle-produkte`, `/eistee`, `/aktion` | Kollektionen                               |
| `/products/{handle}` (alle neun Handles, inklusive `founder-bundle-iii-1`) | Produktseiten                              |
| `/cart`, `/search`                                                         | Warenkorb, Suche                           |
| `/blogs/news`                                                              | Blog (bis zum ersten Beitrag `noindex`)    |

## 2. Weiterleitungen (Soll)

| Alter Pfad                                          | Ziel                                      | Grund                                                    | In `netlify.toml` |
| --------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- | ----------------- |
| `/pages/qrcode`                                     | `/pages/shop`                             | Duplikat der Shop-Seite, QR-Codes auf Druckmaterial      | ja                |
| `/pages/qr-code-page-investoren`                    | `/pages/messe`                            | Duplikat der Messe-Seite                                 | ja                |
| `/pages/provibe-paket`                              | `/collections/aktion`                     | leere Template-Seite (F12)                               | ja                |
| `/pages/provibe-founder-paket`                      | `/collections/aktion`                     | leere Template-Seite (F12)                               | ja                |
| `/pages/datenschutzerklarung`                       | `/policies/privacy-policy`                | enthielt keine Datenschutzerklärung                      | ja                |
| `/pages/widerrufsbutton`                            | `/pages/widerruf-formular`                | Duplikat (Shopify-App)                                   | ja                |
| `/products/founder-bundle-iii`                      | `/products/founder-bundle-iii-1`          | naheliegender Tippfehler, war 404                        | ja                |
| `/policies/terms-of-service`                        | `/pages/allgemeine-geschaftsbedingungen`  | Shopify-Standardpfad                                     | ja                |
| `/policies/refund-policy`                           | `/pages/ruckgabe-und-wiederrufsbelehrung` | Shopify-Standardpfad                                     | ja                |
| `/policies/shipping-policy`                         | `/pages/versand`                          | Shopify-Standardpfad                                     | ja                |
| `/policies/legal-notice`                            | `/pages/impressum`                        | Shopify-Standardpfad                                     | ja                |
| `/policies/contact-information`                     | `/pages/contact`                          | Shopify-Standardpfad                                     | ja                |
| `/policies/subscription-policy`                     | `/pages/allgemeine-geschaftsbedingungen`  | Shopify-Standardpfad (Abo-Regeln stehen in AGB § 3)      | **fehlt**         |
| `/collections/{collection}/products/{handle}`       | `/products/{handle}`                      | Shopify-Produktpfad innerhalb einer Kollektion           | ja                |
| `/customer_authentication/redirect`                 | `/account/login`                          | Login-Link aus dem alten Header                          | ja, Ziel falsch   |
| `/customer_authentication/*`                        | `/account/login`                          | weitere Shopify-Login-Pfade (zum Beispiel `/login`)      | **fehlt**         |
| `/account/register`                                 | `/account/login`                          | Shopify-Registrierung                                    | ja, Ziel falsch   |
| `/account/activate/*`                               | `/account/konto-aktivieren`               | Aktivierungslinks aus alten Shopify-Mails                | **fehlt**         |
| `/account/reset/*`                                  | `/account/login`                          | Passwort-Links aus alten Shopify-Mails                   | **fehlt**         |
| `/account/orders/*`                                 | `/account/bestellungen`                   | Bestelllinks aus alten Shopify-Mails                     | **fehlt**         |
| `/account/addresses`                                | `/account/adressen`                       | Shopify-Pfad                                             | **fehlt**         |
| `/account/logout`                                   | `/account/login`                          | Shopify-Pfad                                             | **fehlt**         |
| `/blogs/news.atom`                                  | `/blogs/news`                             | Shopify-Feed                                             | **fehlt**         |
| `/blogs/news/tagged/*`                              | `/blogs/news`                             | Shopify-Tag-Archiv                                       | **fehlt**         |
| `/sitemap_products_1.xml` und weitere Teil-Sitemaps | `/sitemap.xml`                            | in der Search Console eingereichte Shopify-Teil-Sitemaps | **fehlt**         |
| `/agents.md`                                        | `/llms.txt`                               | GEO                                                      | ja                |

Die Shopify-Teil-Sitemaps heißen `sitemap_products_1.xml`, `sitemap_pages_1.xml`, `sitemap_collections_1.xml`, `sitemap_blogs_1.xml` und `sitemap_agentic_discovery.xml` (Analyse Abschnitt 3).

## 3. Konflikt in der heutigen `netlify.toml` (Vorschlag)

Die heutigen Regeln `/account` → `/konto`, `/account/login` → `/konto/login`, `/account/register` → `/konto/login` und `/customer_authentication/redirect` → `/konto/login` stammen aus einer früheren Planung. Laut `docs/seitenplan.md` und dem gebauten Paket Konto heißen die neuen Routen `/account/*`. Netlify wendet Weiterleitungen ohne `force` an, sobald unter dem Pfad keine statische Datei liegt; Seiten des Next-Runtimes zählen nicht als Datei. Die Regeln würden die neuen Kontoseiten deshalb auf nicht existierende `/konto`-Pfade umleiten. Vorschlag (Diff für `netlify.toml`, gehört nicht zum Paket Inhalte):

```diff
-[[redirects]]
-  from = "/account/login"
-  to = "/konto/login"
-  status = 301
-
 [[redirects]]
   from = "/account/register"
-  to = "/konto/login"
+  to = "/account/login"
   status = 301

-[[redirects]]
-  from = "/account"
-  to = "/konto"
-  status = 301
-
 [[redirects]]
-  from = "/customer_authentication/redirect"
-  to = "/konto/login"
+  from = "/customer_authentication/*"
+  to = "/account/login"
+  status = 301
+
+[[redirects]]
+  from = "/account/activate/*"
+  to = "/account/konto-aktivieren"
+  status = 301
+
+[[redirects]]
+  from = "/account/reset/*"
+  to = "/account/login"
+  status = 301
+
+[[redirects]]
+  from = "/account/orders/*"
+  to = "/account/bestellungen"
+  status = 301
+
+[[redirects]]
+  from = "/account/addresses"
+  to = "/account/adressen"
+  status = 301
+
+[[redirects]]
+  from = "/account/logout"
+  to = "/account/login"
+  status = 301
+
+[[redirects]]
+  from = "/policies/subscription-policy"
+  to = "/pages/allgemeine-geschaftsbedingungen"
+  status = 301
+
+[[redirects]]
+  from = "/blogs/news.atom"
+  to = "/blogs/news"
+  status = 301
+
+[[redirects]]
+  from = "/blogs/news/tagged/*"
+  to = "/blogs/news"
+  status = 301
+
+[[redirects]]
+  from = "/sitemap_products_1.xml"
+  to = "/sitemap.xml"
+  status = 301
+
+[[redirects]]
+  from = "/sitemap_pages_1.xml"
+  to = "/sitemap.xml"
+  status = 301
+
+[[redirects]]
+  from = "/sitemap_collections_1.xml"
+  to = "/sitemap.xml"
+  status = 301
+
+[[redirects]]
+  from = "/sitemap_blogs_1.xml"
+  to = "/sitemap.xml"
+  status = 301
+
+[[redirects]]
+  from = "/sitemap_agentic_discovery.xml"
+  to = "/sitemap.xml"
   status = 301
```

Ob `/account/konto-aktivieren` das richtige Ziel für Aktivierungslinks ist, entscheidet das Paket Konto. Kein Sammel-Redirect auf `/policies/*`: Er würde `/policies/privacy-policy` überdecken.

Passend dazu sperrt `src/app/robots.ts` im Live-Zustand noch `/konto` statt `/account` (Vorschlag: `"/konto"` durch `"/account"` ersetzen).

## 4. Prüfung vor dem Go-live

1. Jede Zeile aus Abschnitt 2 per `curl -sI https://<netlify-domain><alter-pfad>` prüfen: Status 301, `location` wie in der Tabelle.
2. Jede Zeile aus Abschnitt 1 liefert 200.
3. Das komplette alte URL-Inventar (Analyse Abschnitt 2 plus Shopify-Sitemaps) gegen die neue Domain laufen lassen: keine 404 (`docs/golive.md`).
