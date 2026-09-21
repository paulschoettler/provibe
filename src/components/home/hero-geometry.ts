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
 */

/** Öffnungswinkel der Kamera in Grad. Muss zur <Canvas camera> in CanScene passen. */
export const CAMERA_FOV = 35;
/** Kameraabstand im Hero (Start der Sequenz). */
export const CAMERA_BASE_Z = 6;
/** Halber Tangens des Öffnungswinkels: sichtbare Höhe = 2 * Abstand * TAN_HALF_FOV. */
const TAN_HALF_FOV = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);
/** Ab dieser Breite gilt das Desktop-Layout (Tailwind md). */
export const MOBILE_MAX_WIDTH = 768;
/**
 * Radius der Dose geteilt durch ihre Höhe (aus der Bounding Box der GLB: 1,98 zu 3,96).
 * Die sichtbare Silhouette entsteht an der vorderen Kante, also einen Radius näher
 * an der Kamera als die Achse. Ohne diese Korrektur wirkt die 3D-Dose rund 9 Prozent
 * größer als das PNG an derselben Stelle und die Überblendung springt.
 */
const CAN_RADIUS_RATIO = 0.25;

export interface HeroGeometry {
  /** Schmales Layout: kleinere Dose, Zutaten unter der Dose, 1k-Modelle. */
  isMobile: boolean;
  /** Seitenverhältnis der Canvas (Breite durch Höhe). */
  aspect: number;
  /** Radius des Karussell-Rings in Welteinheiten. */
  ringRadius: number;
  /** Höhe einer Dose in Welteinheiten (Bounding Box, nicht Silhouette). */
  canHeight: number;
  /** Höhe der aktiven Dose als Anteil der Viewporthöhe (0,62 mobil, 0,70 Desktop). */
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
  /** Versatz in Welteinheiten am Ende des Zooms. */
  seqShiftX: number;
  seqShiftY: number;
}

/** Sichtbare Höhe in Welteinheiten an einem Kameraabstand. */
export function visibleHeightAt(distance: number): number {
  return 2 * distance * TAN_HALF_FOV;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Ringradius so wählen, dass die Nachbardosen seitlich ins Bild ragen: ihr
 * Mittelpunkt soll bei `targetFraction` der halben Bildbreite liegen. Die
 * Nachbardose steht bei 120 Grad, also x = sin(120°) * r und z = cos(120°) * r.
 */
function ringRadiusFor(targetFraction: number, aspect: number): number {
  const sin120 = Math.sin((120 * Math.PI) / 180); // 0,866
  const k = targetFraction * TAN_HALF_FOV * aspect;
  const denominator = sin120 - 0.5 * k;
  if (denominator <= 0.05) return 3;
  return clamp((CAMERA_BASE_Z * k) / denominator, 0.45, 3);
}

/** Alle Maße aus der aktuellen Canvas-Größe in CSS-Pixeln. */
export function heroGeometry(width: number, height: number): HeroGeometry {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const aspect = safeWidth / safeHeight;
  const isMobile = safeWidth < MOBILE_MAX_WIDTH;

  // Mobil stehen die Nachbardosen weiter außen (dezenter), auf Desktop näher an der Mitte.
  const ringRadius = ringRadiusFor(isMobile ? 0.95 : 0.4, aspect);
  const activeDistance = CAMERA_BASE_Z - ringRadius;

  const canHeightFraction = isMobile ? 0.62 : 0.7;
  const canCenterYFraction = isMobile ? 0.04 : 0.03;

  // canHeight = f * sichtbare Höhe an der Vorderkante der Dose, also an
  // (activeDistance - Radius). Der Radius hängt selbst von canHeight ab, deshalb
  // aufgelöst: canHeight = 2 f t d / (1 + 2 f t r).
  const canHeight =
    (2 * canHeightFraction * TAN_HALF_FOV * activeDistance) /
    (1 + 2 * canHeightFraction * TAN_HALF_FOV * CAN_RADIUS_RATIO);
  const canRadius = CAN_RADIUS_RATIO * canHeight;
  /** Sichtbare Höhe an der Vorderkante der Dose: Maßstab für alle Bildschirmanteile. */
  const visibleHeight = visibleHeightAt(activeDistance - canRadius);
  const canCenterY = canCenterYFraction * visibleHeight;

  // Größenänderung der aktiven Dose am Ende der Sequenz. Bedingung aus dem Plan:
  // die ganze Dose bleibt sichtbar. Auf Desktop heißt das Zoom nach vorn mit
  // Versatz nach links (Zutaten rechts daneben). Auf einem Telefon passt ein
  // Zoom nicht neben den Zutatenblock, dort tritt die Dose leicht zurück und
  // wandert nach oben (Zutaten darunter).
  const seqScale = isMobile ? 0.84 : 1.15;
  const zoomZ = ringRadius + canRadius + (activeDistance - canRadius) / seqScale;

  const seqShiftXFraction = isMobile ? 0 : -0.19;
  const seqShiftYFraction = isMobile ? -0.165 : -0.02;

  const visibleHeightZoomed = visibleHeightAt(zoomZ - ringRadius - canRadius);
  const seqShiftX = seqShiftXFraction * visibleHeightZoomed * aspect;
  const seqShiftY = -seqShiftYFraction * visibleHeightZoomed;

  return {
    isMobile,
    aspect,
    ringRadius,
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
  };
}
