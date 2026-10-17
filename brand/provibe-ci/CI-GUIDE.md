# PROVIBE – CI-Guide

> Maschinenlesbarer Styleguide für PROVIBE (Protein-Eistee). Abgeleitet aus `newsletter 1 2.ai`.
> Für Claude Code: Lies diese Datei zuerst, nutze die Tokens aus `tokens.css` bzw. `tokens.json` und die SVGs aus `logo/` und `icons/`. Erfinde keine neuen Farben oder Schriften.

## 0. Dateistruktur

```
provibe-ci/
├── CI-GUIDE.md              ← diese Datei (Regeln)
├── tokens.css               ← CSS Custom Properties (--pv-*)
├── tokens.json              ← dieselben Werte als JSON
├── logo/
│   ├── provibe-logo-cream.svg         auf Wildberry (Standard)
│   ├── provibe-logo-wildberry.svg     auf Cream (Standard)
│   ├── provibe-logo-burgundy.svg      auf Cream in Peach-Kommunikation
│   ├── provibe-logo-white.svg         auf Fotos / dunklen Flächen
│   └── provibe-logo-currentColor.svg  für Code (erbt CSS `color`)
└── icons/
    ├── fruits/   Frucht-Icons (Deko), Füllung über Attribut `fill` am <svg>
    │   ├── erdbeere.svg
    │   ├── himbeere.svg
    │   ├── heidelbeere.svg
    │   ├── limette-scheibe.svg        zweifarbig (Lime-Raspberry + Cream), nicht umfärben
    │   ├── pfirsich-blatt-gross.svg
    │   ├── pfirsich-blatt-klein.svg
    │   ├── pfirsich-rund.svg
    │   └── pfirsich-gruppe.svg        fertiges Streumuster aus mehreren Pfirsichen
    └── ui/       fill="currentColor"
        ├── check.svg                  Blatt-Häkchen für USP-Listen
        ├── instagram.svg
        └── tiktok.svg
```

Alle SVGs sind exakte Vektoren aus der AI-Datei, ohne Rand auf die Kontur zugeschnitten, mit `viewBox` und ohne feste `width`/`height`. Einfarbige SVGs tragen die Farbe nur am Root-Element (`<svg fill="…">`), deshalb lässt sich die Farbe per CSS überschreiben (`svg { fill: var(--pv-lime-raspberry) }`) oder per `fill="currentColor"` steuern.

## 1. Markenkern in einem Satz

Frischer, verspielter Eistee-Look: das tiefe Wildberry-Lila und helles Cream als feste Basis, gelbe Frucht-Silhouetten in Lime-Raspberry als Deko, eine runde geometrische Sans für Klarheit und eine elegante Kursiv-Serif für emotionale Akzentwörter.

## 2. Farben

| Token | Hex | RGB | Rolle | Einsatz |
|---|---|---|---|---|
| `--pv-wildberry` | `#702249` | 112 34 73 | Primär + Sortenfarbe Wildberry | Seitenhintergrund, Headlines auf Cream, Buttons, Infoboxen |
| `--pv-cream` | `#F3F1B8` | 243 241 184 | Primär | Karten-Hintergrund, Text und Logo auf Wildberry |
| `--pv-lime-raspberry` | `#E4DF6A` | 228 223 106 | Sortenfarbe Lime-Raspberry | Frucht-Icons auf Cream, Flächen und Akzente in Lime-Raspberry-Kommunikation. Nie für Text auf Cream. |
| `--pv-burgundy` | `#470E14` | 71 14 20 | Textfarbe Peach | Ersetzt Wildberry als Textfarbe in Peach-Kommunikation |
| `--pv-peach` | `#F4A076` | 244 160 118 | Sortenfarbe Peach | CTA-Button und Akzente in Peach-Kommunikation |
| `--pv-white` | `#FFFFFF` | 255 255 255 | Text | Text auf Wildberry-Infoboxen und auf Buttons |

Hinweis: In der Datei taucht zusätzlich `#702149` auf. Das ist ein Rundungsartefakt von Wildberry. Verwende immer `#702249`.

### Erlaubte Kombinationen (WCAG-Kontrast)

| Vordergrund | Hintergrund | Kontrast | Status |
|---|---|---|---|
| Wildberry | Cream | 8.98 | ✅ Standard |
| Burgundy | Cream | 13.49 | ✅ Peach-Variante |
| White | Wildberry | 10.43 | ✅ |
| Cream | Wildberry | 8.98 | ✅ |
| Wildberry | Lime-Raspberry | 7.48 | ✅ |
| Burgundy | Peach | 7.56 | ✅ empfohlen für Peach-Button |
| White | Peach | 2.07 | ⚠️ so im Newsletter verwendet, für Web zu schwach. Für barrierearme Umsetzungen Burgundy-Text nehmen |
| Lime-Raspberry | Cream | 1.20 | nur Deko, nie Information transportieren |

Die Quelldatei ist RGB. Für Druck (Dose, Flyer) die CMYK-Werte mit der Druckerei bzw. per Farbprofil festlegen, nicht schätzen.

### Sorten-Logik

Jede der drei Sorten hat eine eigene Farbe. Die Farbnamen sind gleichzeitig die Sortennamen.

| Sorte | Sortenfarbe | Token | Textfarbe auf Cream | Früchte |
|---|---|---|---|---|
| Wildberry | `#702249` | `--pv-wildberry` | Wildberry | Erdbeere, Himbeere, Heidelbeere |
| Lime-Raspberry | `#E4DF6A` | `--pv-lime-raspberry` | Wildberry | Limettenscheibe, Himbeere |
| Peach | `#F4A076` | `--pv-peach` | Burgundy `#470E14` | Pfirsiche |

Wildberry ist zugleich die Markenbasis: Seitenhintergrund, Footer und Standard-Headlines bleiben in jeder Kommunikation Wildberry auf bzw. mit Cream. In einer Sorten-Kommunikation übernimmt die jeweilige Sortenfarbe die Akzente (Button, Hervorhebungen, Flächen). Bei Peach wechselt zusätzlich die Textfarbe auf Burgundy. Lime-Raspberry ist zu hell für Text auf Cream (Kontrast 1,20), deshalb bleibt der Text dort Wildberry, und auf Lime-Raspberry-Flächen steht Wildberry-Text (Kontrast 7,48).

## 3. Typografie

| Rolle | Schrift | Schnitt laut Design | CSS `font-family` (Adobe-Kit) |
|---|---|---|---|
| Sans (Headlines, Fließtext, Buttons) | **Filson Pro** | Regular, Book, Medium, Bold, Black | `"filson-pro"` |
| Akzent-Kursive groß (`script-xl`) | **Kepler Std Semicondensed Display** | Semibold Italic | `"kepler-std-semicondensed-dis"` + `font-style: italic` |
| Akzent-Kursive Zeile (`script-l`, `script-m`) | **Kepler Std Semicondensed Subhead** | Medium Italic | `"kepler-std-semicondensed-sub"` + `font-style: italic` |
| Labels / Callouts | **Prenton Condensed** | Regular, Bold | `"prenton-condensed"` |

### Web-Einbindung (Adobe Fonts)

Alle drei Schriften liegen im selben Adobe-Fonts-Kit `sne6rux`. Ein einziger Einbindungs-Code lädt alle drei:

| Schrift | Header-Code |
|---|---|
| Filson Pro | `<link rel="stylesheet" href="https://use.typekit.net/sne6rux.css">` |
| Kepler Std | `<link rel="stylesheet" href="https://use.typekit.net/sne6rux.css">` |
| Prenton Condensed | `<link rel="stylesheet" href="https://use.typekit.net/sne6rux.css">` |

```html
<!-- in den <head>, nur einmal einbinden -->
<link rel="stylesheet" href="https://use.typekit.net/sne6rux.css">
```

```css
/* oder in CSS (steht bereits oben in tokens.css) */
@import url("https://use.typekit.net/sne6rux.css");
```

Für Claude Code: Binde den Link genau einmal ein, nutze ausschließlich die `font-family`-Namen aus der Tabelle oben bzw. die Variablen `--pv-font-*` aus `tokens.css`. Keine Google Fonts oder andere Ersatzschriften laden.

### Kit-Abdeckung (Stand Oktober 2026)

Das Kit enthält aktuell nur diese Schnitte:

| `font-family` | Gewichte im Kit | Stile |
|---|---|---|
| `filson-pro` | 400, 700 | normal, italic |
| `kepler-std-semicondensed-dis` | 400, 700 | normal, italic |
| `kepler-std-semicondensed-sub` | 400, 700 | normal, italic |
| `prenton-condensed` | 400, 700 | normal |

Im Design kommen aber Filson **Medium (500)**, **Book** und **Black (900)** sowie Kepler **Semibold** und **Medium** vor. Diese fehlen im Kit. Der Browser fällt dann automatisch auf den nächsten vorhandenen Schnitt zurück (500 → 400, 900 → 700, Kepler 600 → 700). Setze im Code trotzdem die Sollgewichte aus `tokens.css` (`--pv-fw-medium: 500` usw.). Sobald die Schnitte im Adobe-Kit ergänzt sind, stimmt die Darstellung ohne Codeänderung.

### Schriftgrößen

Artboard = 1080 px breit. Web = 600 px Newsletterbreite (Faktor 0.556).

| Token | Schrift / Schnitt | Artboard | Web | Tracking | Beispiel |
|---|---|---|---|---|---|
| `display` | Filson Medium | 242 | 134 | −0.09em | „Peach“ |
| `hero` | Filson Medium | 113 | 63 | −0.09em | „Unser Vorrat ist limitiert!“ |
| `h1` | Filson Medium | 93 | 52 | −0.015em | „Taste The Trio!“ |
| `script-xl` | Kepler Semibold Italic | 135 | 75 | 0 | „Pre-Sale“, „Klassiker“ |
| `script-l` | Kepler Medium Italic | 105–118 | 62 | 0 | „sei schnell“, „unsere erste Sorte ist“ |
| `script-m` | Kepler Medium Italic | 79 | 44 | 0 | „Unsere Lieferkonditionen“ |
| `h2` | Filson Medium (oder Book) | 64 | 35 | 0 | „Es ist soweit!“, „Endlich“ |
| `usp` | Filson Regular | 41 | 23 | 0 | „0g Zucker · 15g Protein · 100% natürlich“ |
| `label` | Prenton Cond Regular | 39.5 | 22 | 0, LH 1.27 | Produkt-Callouts neben der Dose |
| `body` | Filson Regular | 34 | 19 | 0, LH 1.2 | Fließtext |
| `body-emph` | Filson Black | 39 | 22 | 0 | Hervorhebung im Fließtext („16.06.“) |
| `button` | Filson Bold | 34 | 19 | 0 | URL im Button |
| `social` | Prenton Cond Bold | 32 | 18 | 0 | „provibe.de“ neben Social-Icons |
| `legal` | Filson Regular | 21 | 11.5 | 0, zentriert | Abmelde-Hinweis im Footer |

### Typo-Regeln

1. **Mischsatz ist das Markenzeichen.** Eine Zeile kombiniert Filson mit einem Kepler-Kursivwort: „Der *Klassiker*,“ oder „Endlich *Pre-Sale*“. Das Kursivwort ist etwa doppelt so groß wie die Filson-Zeile.
2. Kepler Italic nur für einzelne Akzentwörter oder kurze Zeilen. Nie für Fließtext.
3. Große Filson-Headlines (`display`, `hero`) eng spationieren (−0.09em) und mit Zeilenabstand ~1.0 setzen.
4. Prenton Condensed nur für Callouts, Beschriftungen und Social-Handles.
5. Schreibweise im Text: „Provibe“. Im Logo: Wortmarke klein „provibe“. Nie „PROVIBE“ als Textersatz fürs Logo setzen.

## 4. Logo

Wortmarke „provibe“ als Kontur. Das „v“ ist als zwei Blätter gezeichnet (Häkchen-Form, siehe `icons/ui/check.svg`). Seitenverhältnis 201.8 × 79.1 (≈ 2.55 : 1).

| Hintergrund | Datei |
|---|---|
| Wildberry | `provibe-logo-cream.svg` (Standard im Newsletter-Footer) |
| Cream | `provibe-logo-wildberry.svg` |
| Cream, Peach-Kommunikation | `provibe-logo-burgundy.svg` |
| Foto / dunkel | `provibe-logo-white.svg` |

Regeln: Schutzzone rundherum mindestens die Höhe des „o“. Mindestbreite Web 80 px. Nicht verzerren, nicht drehen, keine Schatten, keine Verläufe, keine anderen Farben als die vier oben.

## 5. Frucht-Icons

Flache, einfarbige Silhouetten ohne Kontur. Einige haben Aussparungen (Kerne der Erdbeere, Glanzlicht am Pfirsich), die als Löcher im Pfad angelegt sind, deshalb scheint der Hintergrund durch.

| Datei | Motiv | Bezug zur Sorte |
|---|---|---|
| `erdbeere.svg` | Erdbeere mit Kernen | Wildberry |
| `himbeere.svg` | Himbeere (Draufsicht) | Lime-Raspberry / Wildberry |
| `heidelbeere.svg` | Heidelbeere mit Blütenansatz | Wildberry |
| `limette-scheibe.svg` | Zitrusscheibe, zweifarbig | Lime-Raspberry |
| `pfirsich-blatt-gross.svg` | Pfirsich mit Blatt | Peach |
| `pfirsich-blatt-klein.svg` | Pfirsich mit Blatt, rundere Form | Peach |
| `pfirsich-rund.svg` | Pfirsich ohne Blatt | Peach |
| `pfirsich-gruppe.svg` | Mehrere Pfirsiche als Streumuster | Peach |

Regeln für den Einsatz:

1. Farbe immer `--pv-lime-raspberry` (#E4DF6A) auf `--pv-cream`. Ausnahme: auf Wildberry dürfen sie in Cream stehen (nicht im Original belegt, aber logisch konsistent).
2. Icons sind Hintergrund-Deko. Sie liegen **hinter** Text und Bildern, groß, und dürfen vom Kartenrand angeschnitten werden.
3. Größen variieren stark (klein 50 px bis riesig 450 px im Web), Streuung locker, nicht im Raster.
4. Pro Sorten-Kommunikation die passenden Früchte nehmen (Peach-Mail = nur Pfirsiche).
5. Spiegeln ist erlaubt (`transform: scaleX(-1)`), Drehen um wenige Grad auch. Umfärben in andere Markenfarben nicht.

## 6. Layout & Komponenten (Newsletter / Web)

Aufbau: Wildberry-Fläche → darauf eine große Cream-Karte mit runden Ecken → darin Inhalte → Footer wieder auf Wildberry.

| Komponente | Werte (Web, 600 px) |
|---|---|
| Seite | `background: var(--pv-wildberry)` |
| Karte | `background: var(--pv-cream)`, `border-radius: 31px`, Abstand zum Rand 24 px, Innenabstand 32 px |
| Infobox (in Karte) | `background: var(--pv-wildberry)`, Text `--pv-white`, Headline Kepler Italic in `--pv-cream`, `border-radius: 24px`, Innenabstand 35 px |
| Button / URL-Leiste | volle Kartenbreite minus Innenabstand, Höhe 52 px, `border-radius: 12px`, Hintergrund Wildberry (Standard) oder Peach (Peach-Variante), Text Filson Bold weiß, zentriert |
| USP-Zeile | drei Werte nebeneinander, gleichmäßig verteilt: „0g Zucker“ „15g Protein“ „100% natürlich“ |
| Produkt-Callouts | Prenton Cond, dünne Wildberry-Linien (Hairline) zur Dose, Häkchen `check.svg` vor USPs |
| Fotos | runde Ecken wie Box (24 px) |
| Footer | Logo cream zentriert, darunter TikTok- und Instagram-Icon in Cream mit „provibe.de“ (Prenton Bold), darunter Legal-Text |

### Minimalbeispiel

```html
<link rel="stylesheet" href="https://use.typekit.net/sne6rux.css">
<link rel="stylesheet" href="provibe-ci/tokens.css">
<body style="background:var(--pv-wildberry);margin:0;padding:var(--pv-gutter)">
  <main style="background:var(--pv-cream);border-radius:var(--pv-radius-card);padding:var(--pv-card-padding);color:var(--pv-wildberry);font-family:var(--pv-font-sans)">
    <h1 style="font-weight:500;font-size:var(--pv-fs-h1);letter-spacing:var(--pv-track-headline);text-align:center;margin:0">Taste The Trio!</h1>
    <h2 style="font-weight:500;font-size:var(--pv-fs-h2);margin:24px 0 0">
      Endlich <em style="font-family:var(--pv-font-serif-italic);font-size:var(--pv-fs-script-xl);font-weight:600">Pre-Sale</em>
    </h2>
    <p style="font-size:var(--pv-fs-body);line-height:var(--pv-lh-body)">Unser Pre-Sale Datum steht endlich fest!</p>
    <a href="#" style="display:block;background:var(--pv-wildberry);color:var(--pv-white);border-radius:var(--pv-radius-button);font-weight:700;font-size:var(--pv-fs-button);line-height:var(--pv-button-height);text-align:center;text-decoration:none">provibe-drinks.de</a>
  </main>
</body>
```

## 7. Tonalität (aus den Texten abgeleitet)

Duzt die Zielgruppe. Kurz, locker, mit Ausrufezeichen und Alltagsbildern („am Schreibtisch, unterwegs oder beim Chillen mit Freund:innen“). Gendert mit Doppelpunkt. Kernbotschaften wiederholen sich: **0g Zucker, 15g Protein, 100% natürlich, produziert in Deutschland.** Claim: „Taste The Trio!“

## 8. Regeln für Claude Code (Kurzfassung)

- Farben nur aus `tokens.css`. Keine Abstufungen, keine Transparenzen, keine Verläufe erfinden.
- Text auf Cream: Wildberry (oder Burgundy in Peach-Kommunikation). Text auf Wildberry: Cream oder Weiß.
- Lime-Raspberry niemals als Textfarbe auf Cream. Als Fläche nur mit Wildberry-Text.
- Schriften immer über das Adobe-Kit laden: `<link rel="stylesheet" href="https://use.typekit.net/sne6rux.css">` (einmal im `<head>`).
- Headlines Filson Medium, Akzentwort Kepler Italic, Labels Prenton Condensed. Keine weiteren Schriften, keine Google Fonts.
- Logo und Icons immer als SVG aus diesem Ordner einbinden, nie nachbauen oder als Text setzen.
- Frucht-Icons nur als Deko hinter Inhalten.
- Runde Ecken überall (Karte 31, Box 24, Button 12 px). Keine harten Ecken, keine Schlagschatten.
- Sortenfarben: Wildberry `#702249`, Lime-Raspberry `#E4DF6A`, Peach `#F4A076`. Keine weiteren Sortenfarben erfinden.
