# Startseite: Analyse der Referenzen und technischer Plan

Stand: 21.09.2026. Auftrag: erstes Design der Startseite (Prompt vom Auftraggeber, siehe `docs/fragen.md`, Abschnitt G). Gebaut wird erst nach Freigabe der Fragen unten.

## 1. Unsere Marke (Quelle: aktuelle Shopify-Seite)

Farben, Schrift, Logo und Tonalität sind in `docs/analyse.md`, Abschnitt 6, als Tokens erfasst. Kurz: Magenta `#D9306E` als Akzent und CTA, Aubergine `#4A2F39` als Text, Creme `#FBF8EE` als Seitenhintergrund, Creme 2 `#F3F1E7` für Karten, Butter `#F3EDA4` für Flächen, Sortenfarben Pink `#E98AB0` und Peach `#F7CA99`, dazu Wine `#6B1D49` und Plum `#7E2856` für dunkle Flächen. Schrift Jost (selbst gehostet, SIL OFL), Eyebrows in Versalien mit 0,24em Sperrung in Magenta, Headlines 600 bis 700 mit −0,02em, Buttons als Pills, Karten mit 26px Radius, Dosenbilder mit weichem aubergine-farbenem Schatten. Ton: Du-Ansprache, kurz, frech ("Such dir deinen Vibe.", "Protein, das in jede Tasche passt.").

Abschnitte unterhalb von `#pvshop` auf der aktuellen Startseite, die wir mit Inhalt übernehmen: `#pvbanner` (Eyebrow "Protein for your purse", Titel "Schluss mit dem pelzigen Proteingefühl.", Text, Link "Jetzt entdecken", rundes Bild), zweites `#pvshop` mit den Founder Bundles (Eyebrow "Founder Bundles", Titel "Alles in einem Set.", drei Karten mit Badge "Bundle" und "Limitiertes Set"), `#pvlogo` (Logo-Zoom) und der Footer (Quick-Links, Newsletter, Social, Zahlarten).

Logo-Zoom im Ist: Sektion `#pvlogo` mit 160vh Höhe, darin ein `position: sticky; top: 0; height: 100vh` Container, das Logo startet bei `scale(0.5)` und wächst linear mit dem Scrollfortschritt der Sektion auf `scale(1.45)` (`0.5 + 0.95 × Fortschritt`), per `scroll`-Listener und `transform`. Genau das bauen wir mit GSAP ScrollTrigger (`scrub: true`) nach, mit derselben Kurve.

## 2. Referenzen

### ciaoenergy.com (Hero und Scroll-Sequenz)

Technik: Webflow, GSAP 3.15 mit ScrollTrigger und SplitText, Lenis Smooth Scroll, eine einzige fixe WebGL-Canvas über die gesamte Seite (Three.js als Modul-Bundle mit GLTFLoader, RGBELoader für eine HDRI-Umgebung, EffectComposer mit Bloom, SMAA und FXAA). Zwei GLB-Modelle (`can.glb`, `base.glb`). Je Sorte ein Hintergrund-Video-Loop (WebM/MP4), das beim Sortenwechsel getauscht wird, plus ein Loader-Video.

Ablauf Desktop und Mobil: Hero (`.is-gamme`) mit zentrierter Dose, Pfeilen links und rechts, Sortenname darunter, Fortschrittsbalken in Sortenfarbe, Hinweis "Scroller pour découvrir". Auf Mobil sind Pfeile und Swipe aktiv (Touch-Events im Custom-Code, kein Swiper), die Nachbardosen ragen seitlich ins Bild. Beim Scrollen wird der Bereich gepinnt (`pin`), die Kamera fährt an die Dose heran und die Dose dreht sich per `rotation.y` auf feste Winkel je Schritt (20°, 120°, 130° im Code). Danach folgen vier gepinnte Benefit-Schritte (`.is-benefits`, jeweils eigener Text links, Icon-Navigation rechts, die Dose bleibt sichtbar), dann eine große Typo-Sektion, FAQ und Newsletter. Der Sortenwechsel bleibt in allen gepinnten Schritten möglich, weil die Canvas global ist und nur Kamera und Material wechseln. Auf Mobil ist die Canvas kleiner (390 × 664), der Aufbau identisch, Texte stehen unter der Dose.

Was wir übernehmen: globale, fixe Canvas mit einer Szene und drei Dosen, Pfeile plus Swipe, Kamerafahrt und Rotation per ScrollTrigger-Scrub, Sortenwechsel auch im gezoomten Zustand. Was wir bewusst anders machen: nur ein Zutaten-Schritt statt vier, ganze Dose sichtbar, keine Videos als Hintergrund (Farbflächen in Sortenfarben, deutlich leichter), kein Postprocessing-Stack auf Mobil.

### royalbev.com (Wellen-Übergänge)

Technik: WordPress-Theme mit eigenem Bundle, Lenis Smooth Scroll, Swiper, GSAP im Bundle. Die Wellen sind statische Inline-SVGs (`h-wave h-wave--outer-top`, 1920 × 297, und `h-wave--outer-bottom`, 1920 × 87) mit `viewBox`, die an der Ober- beziehungsweise Unterkante einer farbigen Sektion sitzen und in die Nachbarsektion hineinragen, Füllfarbe gleich der Sektionsfarbe. Sie bewegen sich beim Scrollen nicht mit; animiert werden nur die Sektionen selbst (Reveal-Klassen `e-reveal`, `e-reveal--clip` mit clip-path, insgesamt 23 clip-path-Elemente). Auf Mobil skaliert dieselbe SVG über `preserveAspectRatio` mit, die Welle wird flacher, bleibt aber sauber, weil sie als Vektor gerendert wird. Rote Flächen (`o-products--red`) über Schwarzweißfotos, genau wie im Beispielbild des Auftraggebers.

Was wir übernehmen: Inline-SVG-Wellen als React-Komponente `WaveDivider` mit zwei bis drei Wellenformen (flach, geschwungen, doppelt), Füllfarbe aus unseren Tokens, `preserveAspectRatio="none"` mit fester Höhe in `vw`, Ober- und Unterkante, optional gespiegelt. Zusätzlich ein dezenter Parallax-Versatz (wenige Pixel, per ScrollTrigger) als Verbesserung gegenüber der Referenz, abschaltbar per `prefers-reduced-motion`.

### ballaurent.com (Elemente fliegen ins Bild)

Technik: handgeschriebenes Vanilla-JS ohne Framework (`startAnimation9.js`, `imageSequenceCanvas.js`, `bezier-easing`). Kein GSAP, kein Lenis. Die "schwebenden" Taschen (`.schweben`, Klassen `schweben-brass`, `schweben-silver`) werden per `scroll`-Listener direkt aus `window.scrollY` positioniert: Fortschritt der Sektion = (scrollY − Sektionsstart + Viewporthöhe) / Viewporthöhe, daraus `rotateZ((0.5 − Fortschritt) × ±24°)` und `translateY((1 − Fortschritt) × 150px)`, auf Mobil mit einem Multiplikator gedämpft (`mobile_mult`). Die Elemente kommen also von unten außen mit leichter Gegenrotation herein und richten sich beim Weiterscrollen auf. Die Produktrotation im Hero ist eine Bildsequenz auf einer 2D-Canvas (25 Frames, Bezier-Easing `.39,1.62,.59,1.05`, leichtes Überschwingen).

Was wir übernehmen: die Bewegungslogik (Fortschritt der Sektion im Viewport, Rotation von ±20° auf 0°, Versatz von außen zur Mitte), umgesetzt mit GSAP ScrollTrigger `scrub: 0.6` statt eigenem Scroll-Listener, als Transform auf zwei Three.js-Gruppen mit je einer Dose (links Wildberry, rechts Peach als Vorschlag). Fallback ohne WebGL: die freigestellten Dosen-PNGs mit derselben CSS-Transform-Logik.

## 3. Die 3D-Modelle

| Datei                | Sorte          | Zuordnung                                                      | Geometrie                                            | Texturen (Original)                                   |
| -------------------- | -------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| `Wildberry.glb`      | Wildberry      | eindeutig (Dateiname, Textur `Druck_Icetea_Wildberry_4k.jpeg`) | 9.617 Vertices, 17.984 Dreiecke, Meshopt-komprimiert | Basecolor 4096², Metal/Roughness 4096² PNG (12,45 MB) |
| `Peach.glb`          | Peach          | eindeutig (`Druck_Icetea_Peach_4k.jpeg`)                       | identisch                                            | identisch                                             |
| `Raspberry_Lime.glb` | Raspberry Lime | eindeutig (`Druck_Icetea_rasp_4k`)                             | identisch                                            | identisch                                             |

Alle drei sind das gleiche Mesh mit anderem Etikett. Die Metal/Roughness-Textur ist in allen drei Dateien dieselbe 12,45-MB-PNG, deshalb je 14 MB. Testlauf mit gltf-transform (Texturen auf 2048 px, WebP, Meshopt, Quantisierung): 299 bis 311 KB je Modell. Mit 1024 px: 176 bis 181 KB. Plan: 2K-Variante für Desktop, 1K für Mobil, Metal/Roughness-Textur einmal laden und in allen drei Materialien teilen (spart weitere zwei Drittel), Basecolor als KTX2 prüfen, falls WebP auf iOS zu viel GPU-Speicher braucht. Originale liegen unter `assets/source/3d/` und im Bucket `source-assets/3d/`.

Befund vom 17.10.2026 (Reparatur der Dosen): Die Dateien waren an zwei Stellen fehlerhaft. Die Metal/Roughness-Textur setzt das ganze Etikett auf Metalness 1 bei Roughness etwa 0,3 (dazu ein `roughnessFactor` von 1,7 außerhalb der glTF-Spanne), ein voll metallisches Etikett hat keinen diffusen Farbanteil und wirkt dunkel, kupfern und streifig. Bei Raspberry Lime ist die Basecolor ein PNG mit Alphakanal, außerhalb des Etiketts steht transparentes Schwarz bei opakem Material, deshalb waren Deckel und Boden schwarz. Die UV-Naht selbst ist sauber; der Streifen mit Rückseitentext kam von einem falschen Grundwinkel (120 statt 98 Grad, aus den UVs hergeleitet). `scripts/3d/prepare-can.mjs` (aufgerufen von `optimize.sh`) flattet die Basecolor auf Weiß, baut die Metal/Roughness-Textur neu (Druckbereich Metalness 0,12, Roughness etwa 0,38, Rand, Deckel und Boden bleiben Aluminium), verkleinert mit Lanczos, schreibt WebP q90 und Meshopt mit 16-Bit-Texcoords. Größen jetzt 391 bis 424 KB (2k) und 231 bis 246 KB (1k). Licht: `CanLighting.tsx` (RoomEnvironment 0,5, Führungslicht, warmes Fülllicht, Kantenlicht), Tone Mapping Neutral. Nachbardosen drehen sich mit 17 Grad zur Kamera und kippen 11,5 Grad nach außen (Euler-Reihenfolge ZYX).

## 4. Technischer Plan je Sektion

Gemeinsame Basis: GSAP mit ScrollTrigger (Lizenz seit 2024 frei), Lenis für weiches Scrollen (nur Desktop, auf Mobil natives Scrollen, wie bei Ciao), React Three Fiber mit drei und `@react-three/drei` (`useGLTF`, `Environment`, `Preload`, `PerformanceMonitor`), `three-stdlib` Meshopt-Decoder. Eine einzige `<Canvas>` liegt fix hinter der Seite (`position: fixed; inset: 0; pointer-events: none`), Sektionen darüber sind transparent, wo die Dose sichtbar sein soll. Alle Texte, Preise und Buttons stehen im Server-HTML (Rendering-Regel aus dem Briefing), die Canvas ist reines Progressive Enhancement: ohne WebGL, bei `prefers-reduced-motion` oder auf schwachen Geräten (`navigator.hardwareConcurrency <= 4`, `deviceMemory <= 2`, WebGL-Kontextverlust) zeigt dieselbe Stelle das freigestellte Dosen-PNG mit CSS-Übergängen. Modelle werden lazy per `dynamic(() => import(...), { ssr: false })` und erst nach dem ersten Paint geladen, Prioritätsreihenfolge: aktive Sorte, dann die beiden anderen.

### Sektion 1: Hero ohne Header

Aufbau mobil: volle Viewporthöhe (`100svh`), oben klein das Logo als reiner Bildmarker ohne Navigation, mittig die 3D-Dose (Canvas-Ausschnitt), links und rechts Pfeil-Buttons (44 × 44 px Touchziele), darunter Sortenname als H1-Zusatz ("Wildberry") mit Untertitel "Eistee mit 15 g Protein" und Preis je Dose, Fortschrittspunkte (3), unten "Scrollen" Hinweis. Hintergrund ist eine weiche Farbfläche je Sorte (Wildberry: Berry/Plum-Verlauf, Raspberry Lime: Pink/Magenta, Peach: Peach/Butter), Wechsel per GSAP-Tween auf CSS-Variablen (0,6 s, `power2.out`). Desktop: Dose größer, Pfeile weiter außen, Text zentriert unter der Dose.

Mechanik: Zustand `activeFlavor` (0 bis 2) in einem kleinen Store (zustand). Pfeile und Swipe (Pointer-Events mit 40 px Schwelle, wie Ciao ohne Slider-Library) setzen den Index modulo 3, also endlos. Die drei Dosen stehen in der Szene nebeneinander auf einem Karussell-Ring; der Wechsel dreht die Gruppe um 120° (GSAP auf `rotation.y`, 0,8 s, `power3.inOut`), die Nachbardosen ragen seitlich leicht ins Bild, auf Mobil dezenter. H1 bleibt "Protein, das in jede Tasche passt." als sichtbarer, aber kleiner Text oberhalb oder als visually-hidden H1, je nach Antwort G3.

BYQ: keine passende Hero-Wireframe mit 3D-Objekt vorhanden (die Treffer sind Video-Heros). Ich nehme nur die Pfeil-Buttons und den Fortschrittsindikator als Muster aus BYQ-Gems nicht, sondern baue sie selbst, weil die Gems dafür (Carousel) fehlen.

### Sektion 2: Scroll-Sequenz (Zoom, Sortenwechsel, Zutaten)

Ein Wrapper mit 300vh Höhe, innen ein `sticky`-Container mit 100svh (Pin ohne GSAP-Pin, damit Lenis und iOS sauber bleiben). ScrollTrigger mit `scrub: 0.8` steuert eine Timeline:

1. 0 bis 40 %: Kamera fährt von z = 6 auf z = 3,2 (Zoom), Hero-Text blendet aus, Pfeile bleiben sichtbar und funktionieren weiter (sie ändern nur `activeFlavor`, die Timeline bleibt unberührt).
2. 40 bis 70 %: die aktive Dose dreht sich um 180° (`rotation.y`), gleichzeitig blendet rechts (Desktop) beziehungsweise unter der Dose (Mobil) der Zutatenblock ein: Zutatenliste der aktiven Sorte aus der Datenbank, Allergen "Milch", Nährwerte je 100 ml als kompakte Zeile, Badges "15 g Protein", "Ohne Zucker", "Laktosefrei". Alles in einem Schritt, ganze Dose sichtbar.
3. 70 bis 100 %: Halten, dann löst sich der Sticky-Container und der Header scrollt ins Bild.

Sortenwechsel im gezoomten Zustand tauscht Zutatentext und Farben per Crossfade (0,4 s). Auf Mobil ist der Zoom etwas schwächer (z = 3,8), damit die Dose nicht den Text verdeckt.

BYQ: Gem `scroll-text-reveal-01` (Wörter clip-rise beim Scrubben) als Muster für das Einblenden der Zutatenzeilen, an unsere Typo angepasst.

### Sektion 3: Dauerhafter Warenkorb-Button

Ein fixer Button "In den Warenkorb" (Pill, Magenta, Jost 600) mit der aktiven Sorte und dem Dosenpreis plus Pfandhinweis ("2,65 € + 0,25 € Pfand"), sichtbar vom Hero bis zum Ende der Scroll-Sequenz, danach blendet er aus, sobald der Header sticky wird. Position unten links, `left: 16px; bottom: max(16px, env(safe-area-inset-bottom))`. Prüfung mobil: unten links liegt im Daumenbereich für Rechtshänder (die Mehrheit) noch gut, kollidiert aber auf iOS mit der Safari-Adressleiste nur, wenn `safe-area` fehlt, was der Wert abfängt. Der Nachteil: Der linke Pfeil sitzt auf mittlerer Höhe, dort keine Kollision. Empfehlung siehe Frage G5, Alternative: Button unten mittig in voller Breite minus Rand, wie bei den meisten D2C-Shops, weil er dann mit beiden Daumen erreichbar ist und den Sortenwechsel nicht überlagert.

Der Klick legt die 9er-Variante der aktiven Sorte in den Warenkorb (Server Action, Warenkorb-Drawer öffnet), oder die Einzeldosen-Variante, siehe Frage G6.

### Sektion 4: Header

Erscheint erst nach der Scroll-Sequenz: ScrollTrigger auf dem Ende der Sequenz, Header fährt mit `y: -100% → 0` in 0,4 s ein und bleibt `position: sticky; top: 0`. Inhalt wie heute: Logo links, Navigation Shop, Über uns, Partner, Kontakt, rechts Suche, Konto, Warenkorb mit Zähler. Mobil: Burger mit Drawer (Links plus Instagram und TikTok), wie im Ist. Announcement-Bar mit den zwei rotierenden Meldungen oberhalb des Headers, ebenfalls erst ab diesem Punkt.

BYQ: Komponente `avenir-navigation-bar-1` als Struktur- und Verhaltensmuster (sticky, Hintergrundwechsel beim Scrollen, Mobile-Drawer), komplett auf unsere Farben und Jost umgestellt, ohne Mega-Menü.

### Sektion 5: "Unsere Sorten" (`#pvshop`)

Nachbau mit identischem Inhalt und Design aus dem gelieferten HTML: Eyebrow, Titel, "Alle ansehen", drei Karten (Creme-2-Hintergrund, 26px Radius, Badge "15 g Protein" in Berry, Dosenbild mit Schatten, Name, Zeile "Eistee · 0,33 l", Geschmacksnoten, Preis "2,65 €"). Preise kommen aus der Datenbank (Dosenpreis = 9er-Preis geteilt durch 9 abzüglich Pfand, dazu der Grundpreis je Liter als kleine Zeile, weil die Preisangabenverordnung ihn an jedem Preis verlangt). Mobil: Karten untereinander, wie heute. Hover: Karte hebt sich 6 px, Schatten.

BYQ: Komponente `hummingbird-ecommerce-1` (Produktgrid mit Headline-Slide-in und Fade der Karten per IntersectionObserver) als Animationsmuster; Layout und Styles kommen komplett aus unserem `#pvshop`.

### Übernommene Sektionen darunter

`#pvbanner` ("Schluss mit dem pelzigen Proteingefühl.") und die Founder-Bundles-Sektion 1:1 mit Inhalten, Bundle-Preise aus der Datenbank mit "Einzeln: X €" statt Streichpreis (Antwort B4). Beide Sektionen bekommen Scroll-Reveals (Fade und 24 px Versatz, IntersectionObserver, einmalig).

### Sektion 6: Wellen-Übergänge (Vorschlag der Stellen)

1. Ende der Scroll-Sequenz zu "Unsere Sorten": Welle in der Sortenfarbe der aktiven Sorte läuft nach unten in die Creme-Fläche aus (Übergang vom dunklen 3D-Bereich in den hellen Shop-Bereich).
2. "Unsere Sorten" zu `#pvbanner`: Butter-Fläche (`#F3EDA4`) beginnt mit einer Welle oben, das runde Bild des Banners ragt in die Welle.
3. `#pvbanner` zu Founder Bundles: Welle am unteren Rand der Butter-Fläche zurück in Creme.
4. Vor dem Logo-Zoom: Magenta oder Wine als Farbfläche mit Welle oben über einem Schwarzweiß-Stimmungsbild (wie im Beispielbild), darunter der Logo-Zoom in Creme.
5. Footer: Wine-Fläche mit flacher Welle oben.

Alle Wellen als eine Komponente mit drei Pfadvarianten, Höhe 8 bis 14 vw auf Mobil und 6 bis 9 vw auf Desktop, damit sie auf schmalen Bildschirmen nicht zu Strichen werden.

### Sektion 7: Footer-Bereich mit Logo-Zoom und Dosen

Logo-Zoom exakt wie im Ist (160vh, sticky, `scale 0.5 → 1.45` linear über den Scrollfortschritt), umgesetzt mit ScrollTrigger `scrub: true`. Dazu zwei Dosen aus der globalen Canvas: links kommt Wildberry von außerhalb des linken Rands, rechts Peach von rechts, beide mit `rotation.z` von ±18° auf ±6° und `rotation.y` um 25° (dezent, keine volle Umdrehung), Position von x = ±4 auf x = ±1,6, Bewegung an denselben Scroll-Trigger gekoppelt (`scrub: 0.6`). Fallback: PNGs mit CSS-Transforms und derselben Kurve. Auf Mobil kommen die Dosen kleiner und weiter unten, damit das Logo frei bleibt.

Danach der Footer mit Quick-Links, Newsletter (Double Opt-in), Social, Zahlarten und Impressumsangaben, Struktur wie heute.

BYQ: Komponente `kelvin-video-2` (SVG-Logo-Maske mit Scroll-Reveal) als Gegencheck für die Sticky-Struktur, aber unser Effekt bleibt der Zoom aus dem Ist.

## 5. Performance und Barrierefreiheit

- Canvas erst nach `requestIdleCallback` mounten, Modelle nach Priorität, `dpr` auf maximal 1,5 auf Mobil und 2 auf Desktop, `PerformanceMonitor` senkt dpr bei Frame-Einbrüchen, `frameloop="demand"` außerhalb aktiver Animationen.
- Umgebungsbeleuchtung als kleines HDR (unter 200 KB) oder `Environment preset` aus drei, kein Bloom auf Mobil.
- `prefers-reduced-motion`: keine Scroll-Scrubs, statische Dose, Sortenwechsel ohne Rotation, Wellen ohne Parallax.
- Tastatur: Pfeile sind Buttons mit `aria-label`, Sortenname als `aria-live="polite"`, Warenkorb-Button im Fokusfluss, Header-Navigation ab dem Erscheinen erreichbar, Skip-Link ganz oben.
- Alles Inhaltliche im Server-HTML, geprüft per `curl`-Test aus dem Briefing.

## 6. Offene Fragen

Siehe `docs/fragen.md`, Abschnitt G.

## 7. Umsetzung (Stand 17.10.2026)

Die Startseite ist gebaut und auf dem Branch `claude/epic-edison-nb0vts` deployt (Netlify-Vorschau hinter Basic Auth). Aufbau in `src/app/page.tsx`, Architektur in ADR-009 und ADR-010. Der Hero folgt seit dem 17.10.2026 der freigegebenen Figma-Richtung A "Vibe" (Datei wttVzqEheGArNkqUliXd3x, Sektion 9-24): Sortenverlauf mit Blob-Formen und cremefarbenem Wellenband, riesiger Sortenname in zwei Ebenen um die 3D-Dose (hintere Zeile unter der Canvas, vordere darüber; WILD/BERRY, RASPBERRY/LIME, JUICY/PEACH, Riesentypo aria-hidden, Name als echter Text im aria-live-Bereich), Sticker (15 g Protein, Such dir deinen Vibe., Frucht-Illustrationen als Inline-SVG je Sorte), große runde Pfeile, Dosen-Silhouetten als Punkte, Warenkorb-Dock mit Mini-Dose, Zutatenpanel in Creme mit Radius 64/28 und Nährwert-Kacheln. Komponenten unter `src/components/home/hero/`.

Gebaut wurde in drei parallelen Arbeitspaketen mit vorab festgelegten Verträgen (`src/lib/home/store.ts`, `src/lib/cart/types.ts`, `src/components/cart/cart-context.tsx`):

| Paket | Dateien                                                                                                                                                                                                | Inhalt                                                                                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `src/components/three/CanScene.tsx`, `CanSceneMount.tsx`, `src/components/home/Hero.tsx`, `HeroExperience.tsx`, `HomeMotion.tsx`, `StickyAddToCart.tsx`, `hero-geometry.ts`                            | Eine fixe Canvas mit Karussell (endlos, Wechselrichtung), Zoom und 180-Grad-Drehung per ScrollTrigger, Footer-Dosen, Fähigkeitsprüfung (`html[data-tier]`), Lenis nur Desktop, PNG-zu-3D-Überblendung, Pfeile, Punkte, Tastatur, Wischen                |
| B     | `src/components/layout/*`, `src/components/home/FlavorCards.tsx`, `PurseBanner.tsx`, `FounderBundles.tsx`, `MoodSection.tsx`, `LogoZoom.tsx`, `src/lib/newsletter/*`, `src/app/newsletter/bestaetigen` | Header (sticky nach der Sequenz, Announcement-Bar, mobiler Drawer), Footer, `WaveDivider` mit fünf Übergängen, Sektionen 1:1 aus dem alten Shop plus Pfand- und Grundpreiszeile, Logo-Zoom mit derselben Kurve wie im Ist, Newsletter mit Double Opt-in |
| C     | `src/lib/cart/*`, `src/components/cart/*`, `src/app/cart`                                                                                                                                              | Warenkorb über httpOnly-Cookie und Server Actions, Drawer, Seite `/cart` ohne JavaScript, 12 Tests für die Abbildungslogik                                                                                                                              |

Abweichungen vom Plan, jeweils mit Grund:

- Hero und Scroll-Sequenz sind eine Sektion (`#pv-hero`, 400vh, klebende Bühne `#pv-sequence`), weil Dose und Pfeile sonst beim Scrollen wegwandern würden.
- Der Zoom arbeitet mit einem Zielfaktor statt fester Kamerawerte (Desktop mit Versatz nach links, mobil mit Versatz nach oben), weil auf einem Telefon "ganze Dose sichtbar" und "Zutaten darunter" sonst nicht zusammenpassen. Stellschrauben in `hero-geometry.ts`.
- Das Karussell ist eine Ellipse statt eines Kreises: Der seitliche Radius wird aus der gewünschten Bildschirmposition der Nachbardosen gelöst (55 Prozent der halben Bildbreite im Seitenlayout, 42 Prozent gestapelt, auf 390 px Breite geometrisch nur 53 Prozent), damit beide Nachbarn bei jeder Bildschirmgröße vollständig sichtbar sind. Kippung (11,5 Grad um z), Etikettdrehung, Größe und Deckkraft jeder Dose folgen kontinuierlich ihrem Ringwinkel, dadurch kippt die einfahrende Dose weich in die Mitte.
- Im gezoomten Zustand bleiben die Nachbardosen mit 40 Prozent Deckkraft sichtbar und rücken neben den Zutatenblock, damit klar bleibt, dass man wechseln kann. Die Pfeile wandern mit der Dose.
- Ziehen funktioniert mit Maus und Finger (Achsensperre ab 8 px, Schwelle 40 px, Ring folgt live und rastet ein), vertikales Scrollen bleibt per `touch-action: pan-y` erhalten.
- Das PNG ist nur Ladeplatzhalter und Fallback: Sobald die Szene die aktive Sorte zwei Bilder lang gerendert hat (`#pv-hero[data-canvas-ready]`, nur unter `html[data-tier="3d"]`), verschwindet der ganze PNG-Block hart, ohne Überblendung. PNG und 3D sind nie gleichzeitig sichtbar.
- Das Seitenlayout (Text rechts neben der Dose) gilt ab 900 px Breite und Seitenverhältnis 5:4, hochkant stehende Tablets bekommen das gestapelte Layout.
- `#pvbanner` liegt auf Butter statt Creme, damit die Wellen 2 und 3 sichtbar sind.
- Wellen ohne Parallax (wie bei royalbev), Pfeile ohne JavaScript und bei reduzierter Bewegung ausgeblendet.
- Im 3D-Modus ist `#pvlogo` durchsichtig, damit die Canvas mit den einfliegenden Dosen dahinter sichtbar ist; die PNG-Dosen sind der Fallback (seit 17.10.2026 durch die Finale-Sektion ersetzt, siehe unten).

Finale-Sektion (Feedback vom 17.10.2026, Figma-Sektion "Finale" 95:577): `#pvlogo` ist jetzt Logo-Zoom mit drei Dosen und finalem CTA. Eyebrow "Bereit für deinen Vibe?", H2 "Dein Vibe. Deine Dose.", Subline, Buttons zu `/pages/shop` und `/collections/aktion`, Preiszeile aus den Katalogdaten (günstigster 9er-Pack ohne Pfand, Pfand getrennt nach H22, Grundpreis), drei Pills und ein schräges Laufband mit den Sortennamen (aria-hidden, 28 s). Die Choreografie aus dem Frame "Finale / Choreografie" steht als reine Funktion in `src/components/home/finale/choreography.ts` (mit Tests) und läuft über einen ScrollTrigger auf der Pin-Strecke (mobil 90vh, Desktop ab 900 px im Querformat 100vh); das Kleben unter der Header-Leiste macht CSS (`position: sticky`, Höhe gemessen). Die Bühne besteht aus zwei gleich großen Ebenen: hinten Blobs und Logo, vorne Dosen, Sticker und Text. Im 3D-Modus rutscht die hintere Ebene unter die Canvas, und `CanScene` zeichnet drei Dosen genau auf die PNG-Platzhalter (Lage aus dem DOM, Winkel und Deckkraft aus `data-r`/`data-o`); das PNG verschwindet erst, wenn die 3D-Dose steht. Weil die Kamera der Szene perspektivisch in der Bildmitte sitzt, richtet `CanScene` jede Finale-Dose einzeln auf die Kamera aus und neigt sie um 8 Grad mit dem Deckel zur Kamera (`FINALE_VIEW_TILT`, wie auf den Produktfotos); sonst fehlte oberhalb der Bildmitte der Deckel und beim Herausscrollen entstand eine Untersicht (Feedback vom 17.10.2026 abends). Ohne JavaScript und bei reduzierter Bewegung gibt es keine Pin-Strecke und sofort den Endzustand, bei reduzierter Bewegung blendet die Bühne nur weich ein. Komponenten: `LogoZoom.tsx`, `LogoZoomMotion.tsx`, `finale/*`, Blobs in `public/images/finale`, Stile im Block "Finale" in `globals.css`.

Finale-Dosen gestaffelt (Feedback vom 17.10.2026 nachts): Die vermeintlichen Fallback-Bilder im Finale waren das 3D-Karussell aus dem Hero. Es verschwand nur bei `seqProgress >= 1`; nach einem Neuladen weiter unten (Scroll-Wiederherstellung) oder solange `scrub` hinterherläuft, steht der Wert darunter, und Wildberry groß in der Mitte mit Peach und Raspberry Lime schräg daneben stand mitten im Finale. Jetzt ist das Karussell nur sichtbar, solange die Hero-Bühne im Bild ist und das Finale nicht. Die drei Finale-Dosen standen alle bei z = 0, ihre Platzhalter überlappen sich aber in der Bildebene, deshalb steckten die Modelle ineinander und verdeckten sich gegenseitig das Etikett. Sie haben jetzt eigene Tiefen (`FINALE_CAN_LAYER`: Raspberry Lime vorn, Wildberry dahinter, Peach eine halbe Ebene weiter hinten, wie Figma 95:578 und 96:615); der Abstand reicht für beide Radien, einen halben Dosendurchmesser Luft und die Idle-Bewegung, und Lage und Größe wachsen mit der Tiefe, damit jede Dose auf ihrem Platzhalter bleibt. Am Ziel (ab Fortschritt 0,8 weich eingeblendet) schweben die Dosen leicht, drehen sich um bis zu 5 Grad hin und her und gehen ein wenig vor und zurück, je Dose versetzt; bei reduzierter Bewegung gibt es keine 3D-Szene, die PNGs bleiben.

Durchsichtige Dosen im Hero (Feedback vom 17.10.2026 nachts): Was durch die Dosen schien, waren die PNG-Platzhalter, nicht die 3D-Dosen. Die Ebenen stimmen (hintere Zeile der Riesentypo und Blobs in `.pv-hero__bg` mit z-index -1 unter der Canvas mit 0, Bühne mit Text, Pfeilen, Stickern, Zutaten und vorderer Zeile mit 2 darüber), die 3D-Dose deckt das Wort voll ab. In der Ladephase, beim Sortenwechsel vor dem ersten 3D-Bild und dauerhaft ohne WebGL steht aber das PNG vor dem Wort, und das war nicht deckend: Der Freisteller `wildberry.webp` hat einen halbtransparenten Deckel (Alpha 0,58 bis 0,9, dort schienen die Balken von WILD durch), die Nachbardosen standen mit Deckkraft 0,9 (RASPBERRY durch Peach), und beim Wechsel zu 3D lief eine Überblendung über 0,25 s. Jetzt machen ein SVG-Filter (`#pv-can-solid` in `Hero.tsx`, Alpha mal 2) und Deckkraft 1 alle PNGs deckend, und der PNG-Block verschwindet ohne Zwischenwerte, sobald die 3D-Dose steht. Offen: `wildberry.webp` mit deckendem Deckel neu exportieren, dann kann der Filter entfallen.

- Der Warenkorbstand kommt nach dem Mounten per Server Action, damit das Root-Layout und die Startseite statisch bleiben (`revalidate = 3600`).

Robustheit gegen Browser-Erweiterungen: Schreibt eine Erweiterung vor der Hydration ins DOM, rendert React die Seite client-seitig neu und setzt dabei die Attribute von `<html>` aus seinem eigenen Bild. Zustands-Flags liegen deshalb als data-Attribute (`data-js`, `data-tier`, `data-flat`, `data-lenis`, `data-scrolled`), nie als Klassen; das Inline-Skript in `layout.tsx` hält `data-js` per MutationObserver fest, `HomeMotion` setzt es im Effekt erneut. Ein Playwright-Test mit simulierter Erweiterung ist Teil der Abnahme.

Geprüft am Produktions-Build (`pnpm build`, `pnpm start`):

- `curl` ohne JavaScript: alle Sorten, Zutaten, Nährwerte, Preise mit Pfand und Grundpreis, Menüs, Newsletter, Zahlarten stehen im HTML (Skript `ssr-check`, 27 Stichproben). Ohne JavaScript ist die Seite 9.240 px hoch und zeigt alle drei Zutatenblöcke untereinander.
- Playwright 390 × 844 und 1440 × 900: zwölf Scrollpositionen je Gerät, keine Skriptfehler. Reduzierte Bewegung: `tier=static`, Sequenz flach, Zutaten sofort sichtbar.
- Keine externen Anfragen beim Laden (Fonts, Modelle, Umgebungslicht liegen lokal).
- Warenkorb: Sortenwechsel per Pfeil, Klick auf den Button legt den 9er-Pack der aktiven Sorte ab, Drawer zeigt Preis, Pfand, Grundpreis, Versandschwelle, MwSt.; nach Reload steht der Zähler auf 1. Testwarenkorb danach gelöscht.
- 404-Meldungen in der Konsole stammen von Prefetches auf Seiten, die es noch nicht gibt (`/pages/*`, `/search`, `/account`, `/collections/*`, `/products/*`, `/checkout`). Sie verschwinden mit Phase 5b.

Offen für die Abnahme durch den Auftraggeber: Am Ende der Sequenz zeigt die aktive Dose ihre Rückseite mit Zutaten und Strichcode (180-Grad-Drehung laut Plan; ein kleinerer Winkel wie 140 Grad zeigt mehr Etikett), Position der Footer-Dosen, Texte der Stimmungs-Sektion ("Powered by Protein", "15 g Protein.") sind Vorschläge.
