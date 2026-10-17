/**
 * Gemeinsame Geometrie von Hero, Scroll-Sequenz und 3D-Szene (Arbeitspaket A).
 *
 * Warum eine eigene Datei: Das PNG-Fallback im DOM und die 3D-Dose auf der Canvas
 * müssen an derselben Stelle und in derselben Größe stehen, sonst springt die
 * Überblendung (G11). Beide Seiten rechnen deshalb mit denselben Zahlen:
 * `HeroExperience` schreibt sie als CSS-Variablen auf die Sektion, `CanScene`
 * benutzt sie direkt in Welteinheiten. Kein React, kein three, kein DOM hier.
 *
 * Kamera: Perspektive, fov 35, Blick entlang -z, Ursprung in der Bildmitte.
 *
 * Der Ring ist eine Ellipse: `ringRadiusX` zur Seite, `ringRadiusZ` in die Tiefe.
 * Die seitliche Halbachse wird so gelöst, dass der Mittelpunkt einer Nachbardose
 * genau auf `neighborCenterFraction` der halben Bildbreite landet. Damit sitzen
 * die Nachbarn auf jeder Bildschirmbreite gleich, statt wie bei einem Kreis aus
 * dem Bild zu wandern oder im Nichts zu verschwinden.
 */

/** Öffnungswinkel der Kamera in Grad. Muss zur <Canvas camera> in CanScene passen. */
export const CAMERA_FOV = 35;
/** Kameraabstand im Hero (Start der Sequenz). */
export const CAMERA_BASE_Z = 6;
/** Halber Tangens des Öffnungswinkels: sichtbare Höhe = 2 * Abstand * TAN_HALF_FOV. */
const TAN_HALF_FOV = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);
/** Ab dieser Breite laden wir die großen Modelle (Tailwind md). */
export const MOBILE_MAX_WIDTH = 768;
/**
 * Ab dieser Breite und diesem Seitenverhältnis steht der Zutatenblock im
 * gezoomten Zustand rechts neben der Dose. Darunter liegt er unter der Dose.
 * Muss zur Medienabfrage in globals.css passen (min-width 900px, min-aspect-ratio 5/4).
 */
export const SIDE_MIN_WIDTH = 900;
export const SIDE_MIN_ASPECT = 1.25;
/** Breite des Zutatenpanels im Seitenlayout, identisch zu globals.css (Richtung A: 560 px bei 1440). */
const FACTS_WIDTH_VW = 0.39;
const FACTS_MAX_PX = 560;
const FACTS_RIGHT_VW = 0.042;
/**
 * Radius der Dose geteilt durch ihre Höhe (aus der Bounding Box der GLB: 1,98 zu 3,96).
 * Die sichtbare Silhouette entsteht an der vorderen Kante, also einen Radius näher
 * an der Kamera als die Achse. Ohne diese Korrektur wirkt die 3D-Dose rund 9 Prozent
 * größer als das PNG an derselben Stelle und die Überblendung springt.
 */
const CAN_RADIUS_RATIO = 0.25;
/** Winkel der Nachbardose auf dem Ring (drei Sorten, also 120 Grad). */
const NEIGHBOR_ANGLE = (2 * Math.PI) / 3;
/**
 * Nachbardosen stehen hinten auf dem Ring und sind zusätzlich etwas kleiner.
 * Steht der Zutatenblock unter der Dose (schmale Bildschirme), sind sie deutlicher
 * kleiner, sonst bliebe neben der aktiven Dose kein Platz für sie.
 */
const NEIGHBOR_SCALE_SIDE = 0.86;
const NEIGHBOR_SCALE_STACKED = 0.74;
/** Höhe der gezoomten Dose im gestapelten Layout als Anteil der Bildhöhe (Tablet). */
const STACKED_ZOOM_HEIGHT = 0.33;
/** Senkrechter Mittelpunkt der gezoomten Dose im gestapelten Layout (von oben, Tablet). */
const STACKED_ZOOM_CENTER = 0.235;
/** Oberkante des Zutatenpanels im gestapelten Layout (Tablet), identisch zu globals.css. */
const STACKED_FACTS_TOP = 0.417;

/*
 * Kompaktes Telefonlayout im Zutaten-Schritt (Breite unter 768 px): Das ganze
 * Panel passt ohne inneren Scroll zwischen Dose und Warenkorb-Dock. Die Maße in
 * Pixeln müssen zu globals.css passen (#pv-hero[data-layout="compact"] und
 * [data-layout="vignette"]).
 */
/** Ab dieser Höhe steht die kleine Dose über dem Panel, darunter als Vignette im Panelkopf. */
export const VIGNETTE_MAX_HEIGHT = 700;
/** Oberkante der gezoomten Dose: unter Logo (bis 42 px) und Sortenpunkten (bis 48 px). */
const COMPACT_CAN_TOP_PX = 50;
/** Abstand zwischen Dosenunterkante und Panel. */
const COMPACT_FACTS_GAP_PX = 10;
/**
 * Höhe der gezoomten Dose über dem Panel, Anteil der Bildhöhe. Untergrenze bei
 * 700 px Höhe, Obergrenze auf hohen Telefonen (vorher 33 Prozent).
 */
const COMPACT_ZOOM_MIN = 0.19;
const COMPACT_ZOOM_MAX = 0.26;
/**
 * Höhe, die das Panel mindestens bekommt (Pixel). Gemessen: Panel mit Innenabstand
 * 368 px bei 360 px Breite, 352 px ab 390 px Breite (Sorte mit den längsten
 * Zutaten). Der Rest ist Reserve für größere Schrifteinstellungen.
 */
export const COMPACT_FACTS_MIN_PX = 400;
/** Platz unter der Dose: Abstand, Panel, Dock (64 px) mit 16 px Rand und 12 px Luft. */
const COMPACT_BELOW_CAN_PX = COMPACT_FACTS_GAP_PX + COMPACT_FACTS_MIN_PX + 92;
/** Vignette: Oberkante des Panels mindestens (unter Logo und Punkten). */
export const VIGNETTE_FACTS_TOP_PX = 54;
/** Vignette: linker und oberer Innenabstand des Panels. */
export const VIGNETTE_PAD_X_PX = 16;
export const VIGNETTE_PAD_TOP_PX = 14;
/** Vignette: halbe Breite und halbe Höhe des ovalen Fensters im Panelkopf. */
export const VIGNETTE_RX_PX = 27;
export const VIGNETTE_RY_PX = 37;
/** Vignette: Höhe von Kopfzeile plus Titel, an deren Mitte das Fenster ausgerichtet ist. */
export const VIGNETTE_BLOCK_PX = 54;
/** Vignette: Höhe der Dose im Fenster. */
const VIGNETTE_CAN_PX = 58;
/** Panelbreite: links und rechts 16 px, höchstens 600 px breit, identisch zu globals.css. */
const FACTS_SIDE_PX = 16;
const FACTS_STACKED_MAX_PX = 600;
/** Deckkraft der Nachbardosen im gezoomten Zustand (Feedback 7: dezent sichtbar). */
export const NEIGHBOR_OPACITY_ZOOM = 0.4;
/** Kippung der Nachbardosen um die z-Achse, Oberkante nach außen. */
export const CAN_TILT_Z_DEG = 11.5;
/**
 * y-Drehung der Nachbardosen zur Kamera hin, damit Schriftzug und Früchte frontal
 * lesbar bleiben (nicht die Nährwerttabelle). Bei 120 Grad Ringwinkel wirken davon
 * sin(120°) = 0,87, also rund 15 Grad: So schräg sieht die Kamera eine Nachbardose
 * auf Desktop-Breiten an. Vorzeichen je Seite setzt CanScene.
 */
export const CAN_YAW_DEG = 17;

/** Aufbau des Zutaten-Schritts, steht als data-layout auf #pv-hero. */
export type HeroFactsLayout = "side" | "stacked" | "compact" | "vignette";

export interface HeroGeometry {
  /** Schmales Layout: kleinere Modelle laden. */
  isMobile: boolean;
  /** Zutaten stehen im gezoomten Zustand seitlich neben der Dose. */
  isSide: boolean;
  /**
   * Aufbau im Zutaten-Schritt: "side" Panel rechts, "stacked" Panel unter der
   * Dose (Tablet), "compact" kleine Dose über dem Panel (Telefon), "vignette"
   * Dose im Panelkopf links neben dem Titel (Telefon unter 700 px Höhe).
   */
  factsLayout: HeroFactsLayout;
  /** Oberkante des Zutatenpanels als Anteil der Viewporthöhe (nicht im Seitenlayout). */
  factsTopFraction: number;
  /** Höhe der gezoomten aktiven Dose als Anteil der Viewporthöhe. */
  zoomHeightFraction: number;
  /** Seitenverhältnis der Canvas (Breite durch Höhe). */
  aspect: number;
  /** Seitliche Halbachse des Karussell-Rings in Welteinheiten. */
  ringRadiusX: number;
  /** Tiefe des Karussell-Rings in Welteinheiten. */
  ringRadiusZ: number;
  /** Höhe einer Dose in Welteinheiten (Bounding Box, nicht Silhouette). */
  canHeight: number;
  /** Höhe der aktiven Dose als Anteil der Viewporthöhe. */
  canHeightFraction: number;
  /** Mittelpunkt der Dose oberhalb der Bildmitte, in Welteinheiten. */
  canCenterY: number;
  /** Mittelpunkt der Dose oberhalb der Bildmitte, als Anteil der Viewporthöhe. */
  canCenterYFraction: number;
  /** Kamera-z am Ende des Zooms (Sequenzfortschritt 0,4). */
  zoomZ: number;
  /** Faktor, um den die aktive Dose am Ende des Zooms größer erscheint. */
  seqScale: number;
  /** Versatz der Dose am Ende des Zooms, Anteil der Viewportbreite (negativ = nach links). */
  seqShiftXFraction: number;
  /** Versatz der Dose am Ende des Zooms, Anteil der Viewporthöhe (negativ = nach oben). */
  seqShiftYFraction: number;
  /** Versatz des Rings in Welteinheiten am Ende des Zooms. */
  seqShiftX: number;
  seqShiftY: number;
  /** Mittelpunkt der Nachbardose als Anteil der halben Bildbreite (Hero-Zustand). */
  neighborCenterFraction: number;
  /** Größe der Nachbardose auf dem Schirm, relativ zur aktiven Dose. */
  neighborScreenScale: number;
  /** Maßstab der Nachbardose in der Szene, relativ zur aktiven Dose. */
  neighborScale: number;
  /** Faktor auf die seitliche Ringposition im gezoomten Zustand. */
  neighborSpreadZoom: number;
  /** Halbe Breite der aktiven Dose als Anteil der halben Bildbreite (Hero-Zustand). */
  activeHalfFraction: number;
  /** Halbe Breite der aktiven Dose als Anteil der halben Bildbreite (gezoomt). */
  activeHalfFractionZoom: number;
}

/** Sichtbare Höhe in Welteinheiten an einem Kameraabstand. */
export function visibleHeightAt(distance: number): number {
  return 2 * distance * TAN_HALF_FOV;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Alle Maße aus der aktuellen Canvas-Größe in CSS-Pixeln. */
export function heroGeometry(width: number, height: number): HeroGeometry {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const aspect = safeWidth / safeHeight;
  const isMobile = safeWidth < MOBILE_MAX_WIDTH;
  const isSide = safeWidth >= SIDE_MIN_WIDTH && aspect >= SIDE_MIN_ASPECT;
  const factsLayout: HeroFactsLayout = isSide
    ? "side"
    : !isMobile
      ? "stacked"
      : safeHeight < VIGNETTE_MAX_HEIGHT
        ? "vignette"
        : "compact";

  /** Halbe sichtbare Breite an einem Kameraabstand, in Welteinheiten. */
  const halfAt = (distance: number) => Math.max(0.0001, distance * TAN_HALF_FOV * aspect);

  // Flacher Ring: die Nachbardosen sollen nur wenig kleiner wirken als die aktive.
  const ringRadiusZ = isSide ? 0.75 : 0.55;
  const activeDistance = CAMERA_BASE_Z - ringRadiusZ;
  // Steht der Zutatenblock unter der Dose, begrenzt die Bildbreite die Dosenhöhe:
  // je schmaler der Bildschirm, desto kleiner die Dose, sonst haben die
  // Nachbardosen daneben keinen Platz mehr.
  // Richtung A: im Seitenlayout etwas kleiner als früher (0,64 statt 0,7), damit
  // die Riesentypo über und unter der Dose Platz hat und das Wellenband frei bleibt.
  const canHeightFraction = isSide ? 0.64 : clamp(0.3 + 0.35 * aspect, 0.4, 0.58);
  // Gestapelt steht die Dose etwas höher (Richtung A), damit unter ihr Platz für
  // die vordere Typozeile und das Wellenband bleibt.
  const canCenterYFraction = isSide ? 0.03 : 0.09;

  // canHeight = f * sichtbare Höhe an der Vorderkante der Dose, also an
  // (activeDistance - Radius). Der Radius hängt selbst von canHeight ab, deshalb
  // aufgelöst: canHeight = 2 f t d / (1 + 2 f t r).
  const canHeight =
    (2 * canHeightFraction * TAN_HALF_FOV * activeDistance) /
    (1 + 2 * canHeightFraction * TAN_HALF_FOV * CAN_RADIUS_RATIO);
  const canRadius = CAN_RADIUS_RATIO * canHeight;
  /** Abstand der vorderen Kante der aktiven Dose: Maßstab für alle Bildschirmanteile. */
  const activeFront = activeDistance - canRadius;
  const canCenterY = canCenterYFraction * visibleHeightAt(activeFront);

  // Nachbardose bei 120 Grad: z = cos(120°) * ringRadiusZ, also ein halber
  // Ringradius hinter der Ringmitte.
  const neighborDepth = CAMERA_BASE_Z + 0.5 * ringRadiusZ;
  const neighborScale = isSide ? NEIGHBOR_SCALE_SIDE : NEIGHBOR_SCALE_STACKED;
  const activeHalfFraction = canRadius / halfAt(activeFront);
  // Die Kippung nach außen macht die Nachbardose deutlich breiter als ihren
  // Radius. Ohne diesen Anteil schneidet der Bildrand sie ab.
  const tilt = CAN_TILT_Z_DEG * (Math.PI / 180);
  const neighborHalfWorld =
    neighborScale * (canRadius * Math.cos(tilt) + 0.5 * canHeight * Math.sin(tilt));
  const neighborHalfFraction = neighborHalfWorld / halfAt(neighborDepth - canRadius);
  const neighborScreenScale = (neighborScale * activeFront) / (neighborDepth - canRadius);

  // Wunschwert des Auftraggebers, aber nie so weit innen, dass die Nachbardose
  // hinter der aktiven verschwindet, und nie so weit außen, dass sie am Bildrand
  // abgeschnitten wird. Auf schmalen Telefonen gewinnt der Bildrand.
  const targetCenter = isSide ? 0.55 : 0.42;
  const minCenter = activeHalfFraction + 0.2 * neighborHalfFraction;
  const maxCenter = Math.max(0.25, 1 - neighborHalfFraction - 0.03);
  const neighborCenterFraction = clamp(Math.max(targetCenter, minCenter), 0.25, maxCenter);

  const ringRadiusX = (neighborCenterFraction * halfAt(neighborDepth)) / Math.sin(NEIGHBOR_ANGLE);

  // Größenänderung der aktiven Dose am Ende der Sequenz. Bedingung aus dem Plan:
  // die ganze Dose bleibt sichtbar. Im Seitenlayout heißt das Zoom nach vorn mit
  // Versatz nach links (Zutaten rechts daneben). Steht der Zutatenblock unter der
  // Dose, tritt sie zurück und wandert nach oben.
  // Gestapelt auf dem Tablet (Richtung A): Die gezoomte Dose ist ein Drittel der
  // Bildhöhe hoch und steht oben, das Zutatenpanel beginnt bei rund 42 Prozent.
  // Kompakt auf dem Telefon: Die Dose ist nur so groß, dass das ganze Panel samt
  // Nährwerten und Link darunter Platz hat (19 bis 26 Prozent der Bildhöhe). Als
  // Vignette steht sie 58 px hoch im ovalen Fenster links neben dem Titel.
  let zoomHeightFraction = STACKED_ZOOM_HEIGHT;
  let zoomCenterFromTop = STACKED_ZOOM_CENTER;
  let factsTopFraction = STACKED_FACTS_TOP;
  /** Waagerechter Mittelpunkt der gezoomten Dose, Anteil der Bildbreite ab der Mitte. */
  let zoomCenterX = 0;
  if (factsLayout === "compact") {
    zoomHeightFraction = clamp(
      (safeHeight - COMPACT_CAN_TOP_PX - COMPACT_BELOW_CAN_PX) / safeHeight,
      COMPACT_ZOOM_MIN,
      COMPACT_ZOOM_MAX,
    );
    const canPx = zoomHeightFraction * safeHeight;
    // Bleibt auf hohen Telefonen Platz übrig, steht der Block aus Dose und Panel
    // mittig zwischen Logo und Dock statt oben angeklebt.
    const spare = safeHeight - COMPACT_CAN_TOP_PX - canPx - COMPACT_BELOW_CAN_PX;
    const canTop = COMPACT_CAN_TOP_PX + Math.max(0, spare / 2);
    zoomCenterFromTop = (canTop + canPx / 2) / safeHeight;
    factsTopFraction = (canTop + canPx + COMPACT_FACTS_GAP_PX) / safeHeight;
  } else if (factsLayout === "vignette") {
    zoomHeightFraction = VIGNETTE_CAN_PX / safeHeight;
    const spare = safeHeight - VIGNETTE_FACTS_TOP_PX - COMPACT_FACTS_MIN_PX - 92;
    const factsTop = VIGNETTE_FACTS_TOP_PX + Math.max(0, spare / 2);
    const centerY = factsTop + VIGNETTE_PAD_TOP_PX + VIGNETTE_BLOCK_PX / 2;
    zoomCenterFromTop = centerY / safeHeight;
    factsTopFraction = factsTop / safeHeight;
    const panelLeft = Math.max(FACTS_SIDE_PX, safeWidth / 2 - FACTS_STACKED_MAX_PX / 2);
    zoomCenterX = (panelLeft + VIGNETTE_PAD_X_PX + VIGNETTE_RX_PX - safeWidth / 2) / safeWidth;
  }
  const seqScale = isSide
    ? 1.12
    : isMobile
      ? clamp(zoomHeightFraction / canHeightFraction, 0.08, 1)
      : clamp(zoomHeightFraction / canHeightFraction, 0.55, 1);
  // Tatsächliche Höhe nach der Begrenzung von seqScale (Seitenlayout, Tablet).
  if (!isMobile) zoomHeightFraction = canHeightFraction * seqScale;
  const zoomZ = ringRadiusZ + canRadius + activeFront / seqScale;
  const activeAxisZoom = zoomZ - ringRadiusZ;
  const neighborAxisZoom = zoomZ + 0.5 * ringRadiusZ;
  const activeHalfFractionZoom = canRadius / halfAt(activeAxisZoom - canRadius);
  const neighborHalfZoom = neighborHalfWorld / halfAt(neighborAxisZoom - canRadius);
  /** Wo die Nachbardose ohne zusätzliche Spreizung im gezoomten Bild läge. */
  const neighborBaseZoom = (neighborCenterFraction * neighborDepth) / neighborAxisZoom;

  let seqShiftX = 0;
  let seqShiftXFraction = 0;
  let neighborSpreadZoom = 1;

  if (isSide) {
    // Linke Kante des Zutatenblocks als Anteil der halben Bildbreite.
    const textLeft =
      1 - 2 * FACTS_RIGHT_VW - 2 * Math.min(FACTS_WIDTH_VW, FACTS_MAX_PX / safeWidth);
    // Ringversatz P und Spreizung s so wählen, dass die rechte Nachbardose mit
    // Abstand vor dem Text endet und die linke im Bild bleibt.
    const right = textLeft - 0.05 - neighborHalfZoom;
    const left = -0.97 + neighborHalfZoom;
    // Die symmetrische Lösung hält beide Bedingungen genau ein: kein Text unter
    // der Nachbardose, kein Anschnitt am linken Rand. Auf schmalen Fenstern wird
    // die Spreizung klein, die Nachbardosen rücken also hinter die aktive Dose.
    const spread = Math.max(0.05, (right - left) / 2);
    const shift = (right + left) / 2;
    neighborSpreadZoom = spread / Math.max(0.0001, neighborBaseZoom);
    seqShiftX = shift * halfAt(neighborAxisZoom);
    seqShiftXFraction = seqShiftX / halfAt(activeAxisZoom) / 2;
  } else if (isMobile) {
    // Telefon: Dose als Vignette nach links (sonst mittig), die Nachbardosen
    // weichen beim Zoom ganz aus dem Bild. Neben der kleinen Dose wären sie nur
    // Störer über Logo, Pfeilen und Panel.
    seqShiftXFraction = zoomCenterX;
    seqShiftX = 2 * zoomCenterX * halfAt(activeAxisZoom);
    const shiftAtNeighbor = Math.abs(seqShiftX) / halfAt(neighborAxisZoom);
    const outside = 1 + neighborHalfZoom + 0.12 + shiftAtNeighbor;
    neighborSpreadZoom = Math.max(1, outside / Math.max(0.0001, neighborBaseZoom));
  }

  // Gestapelt: Mittelpunkt der gezoomten Dose auf zoomCenterFromTop der Bildhöhe.
  // Für das PNG ist das ein Versatz in Bildanteilen. In der 3D-Szene wirkt der
  // Grundversatz canCenterY nach dem Zurückfahren der Kamera nur noch verkleinert,
  // deshalb wird dort die Zielhöhe direkt in Welteinheiten gelöst. Sonst sitzt die
  // 3D-Dose auf dem Telefon bis zu 50 px tiefer als ihr PNG und unter dem Panel.
  const seqShiftYFraction = isSide ? -0.02 : zoomCenterFromTop - (0.5 - canCenterYFraction);
  const seqShiftY = isSide
    ? -seqShiftYFraction * visibleHeightAt(activeAxisZoom)
    : (0.5 - zoomCenterFromTop) * visibleHeightAt(activeAxisZoom) - canCenterY;

  return {
    isMobile,
    isSide,
    factsLayout,
    factsTopFraction,
    zoomHeightFraction,
    aspect,
    ringRadiusX,
    ringRadiusZ,
    canHeight,
    canHeightFraction,
    canCenterY,
    canCenterYFraction,
    zoomZ,
    seqScale,
    seqShiftXFraction,
    seqShiftYFraction,
    seqShiftX,
    seqShiftY,
    neighborCenterFraction,
    neighborScreenScale,
    neighborScale,
    neighborSpreadZoom,
    activeHalfFraction,
    activeHalfFractionZoom,
  };
}
