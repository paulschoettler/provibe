# Brand-Assets: Herkunft, Ableitungen, Verwendung

Einzige Quelle für Logo und Icons ist `brand/provibe-ci/` (CI-Guide, wird nicht verändert). Die SVGs liegen unverändert zusätzlich unter `public/brand/logo/`, `public/brand/icons/fruits/` und `public/brand/icons/ui/`, damit `<img>` und `next/image` sie ausliefern.

## Einbindung im Code

| Asset        | Technik                                                                                                                                                                                                                                               | Stellen                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo         | `<img>` bzw. `next/image` auf `public/brand/logo/*.svg` (SVG wird automatisch unoptimiert ausgeliefert), `width={202} height={79}`                                                                                                                    | Header, Hero, Finale, Checkout-Rahmen, Admin-Anmeldung: `provibe-logo-wildberry.svg` (auf Cream). Footer, Admin-Seitenleiste: `provibe-logo-cream.svg` (auf Wildberry) |
| Frucht-Icons | `FruitIcon` aus `src/components/brand/BrandIcon.tsx`: Server-Komponente, liest die Datei aus `brand/provibe-ci/icons/fruits/` und rendert sie inline mit `fill="currentColor"`; Farbe über `tone` (`lime-raspberry` auf Cream, `cream` auf Wildberry) | Hero-Sticker (`src/components/home/hero/FruitStickers.tsx`), Finale (`LogoZoom.tsx`), Inhaltsseiten über `src/components/brand/FruitSticker.tsx` (404, Über uns)       |
| UI-Icons     | `InstagramIcon`, `TiktokIcon`, `CheckIcon` aus `BrandIcon.tsx`, inline in der Textfarbe (`currentColor`)                                                                                                                                              | Footer, Kontaktkarte, mobiles Menü (der Header reicht die Icons an die Client-Komponente durch)                                                                        |

Beim Inline-Rendern fallen nur das `<metadata>`-Element (C2PA-Manifest) und das Füllattribut am `<svg>` weg; `viewBox` und alle Pfade bleiben identisch (Test: `src/components/brand/svg-source.test.ts`). Die Limettenscheibe ist zweifarbig und behält die Füllungen aus der Datei. Die Dateien werden über Literal-Pfade gelesen, damit die Dateiverfolgung von Next.js sie in die Server-Bundles übernimmt; nach dem nächsten `pnpm build` in `.next/server/**/*.nft.json` prüfen, dass `brand/provibe-ci/icons/**` enthalten ist (sonst `outputFileTracingIncludes` ergänzen).

## Abgeleitete Rasterdateien

Für Stellen ohne SVG-Unterstützung gibt es PNG-Ableitungen. Sie sind reine Renderings der unveränderten CI-SVGs, keine Nachzeichnungen.

| Datei                                                     | Quelle                                                      | Erzeugung                                                               | Verwendung                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `public/brand/logo-derived/provibe-logo-wildberry@2x.png` | `provibe-logo-wildberry.svg`                                | 600 × 235 px, transparenter Hintergrund                                 | Logo-Kopf aller E-Mails (`src/emails/components.ts`, angezeigt mit 120 × 47 px) |
| `public/brand/logo-derived/provibe-logo-cream@2x.png`     | `provibe-logo-cream.svg`                                    | 600 × 235 px, transparenter Hintergrund                                 | Reserve für Mails oder Dokumente auf Wildberry                                  |
| `src/app/icon.png`                                        | `icons/ui/check.svg` (Blatt-Häkchen, das "v" der Wortmarke) | 256 × 256 px, Wildberry auf Cream, Zeichen 76 % der Kantenlänge, mittig | Favicon                                                                         |
| `src/app/apple-icon.png`                                  | wie oben                                                    | 180 × 180 px                                                            | Apple Touch Icon                                                                |

Erzeugung mit Playwright (Chromium): SVG-Datei unverändert in eine HTML-Seite einsetzen, Elementgröße setzen, `locator.screenshot({ omitBackground: true })` für die Logos. Beim Favicon setzt die Seite Hintergrund (Cream) und Farbe (Wildberry) aus `brand/provibe-ci/tokens.json`; ein Haarstrich von 0,2 Einheiten in derselben Farbe schließt die Kantenglättungs-Naht zwischen den drei Teilpfaden des Häkchens. Ändert sich ein CI-SVG, alle Ableitungen neu erzeugen.

## Entfernte Altbestände (CI-Angleichung Oktober 2026)

- `public/images/brand/logo-wine.png`, `logo-cream.png` (altes Logo, 1000 × 297 px, Verhältnis 3,37:1; das CI-Logo hat 2,55:1, deshalb gilt an allen Stellen die alte Höhe, die Breite folgt)
- `public/images/inhalte/sticker-brombeere.svg`, `sticker-erdbeere.svg`, `sticker-pfirsich.svg` und die selbst gezeichneten Kontur-Früchte in `FruitStickers.tsx`
- eigene Instagram- und TikTok-Icons in `src/components/layout/icons.tsx`

`public/images/inhalte/icon-check-white.svg` bleibt: Es ist das Häkchen der Formular-Checkbox und des Erfolgs-Badges, kein USP-Häkchen.
