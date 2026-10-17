import * as THREE from "three";

/**
 * Material und Ausrichtung der Dosenmodelle, gemeinsam für Szene und Prüfseiten.
 *
 * Die Dateien in public/3d bringen ihr Material schon richtig mit (siehe
 * scripts/3d/prepare-can.mjs): Etikett als Druckfarbe mit wenig Metall, Deckel und
 * Boden als blankes Aluminium. Hier bleibt nur, was eine GLB nicht festlegen kann:
 * Farbraum absichern und Anisotropie. Die Stärke der Umgebung steht in CanLighting.
 */

/**
 * Grunddrehung um die Y-Achse, damit das Etikett frontal zur Kamera zeigt.
 *
 * Im UV-Layout aller drei Modelle liegt die Naht bei Winkel 0 (lokale +z-Achse), u
 * wächst mit dem Winkel nach rechts herum (u 0,76 liegt bei -90 Grad). Die
 * Vorderseite (provibe-Schriftzug, 15g-Siegel, Früchte) reicht von u 0,53 bis 0,99.
 * Wie auf den Produktfotos steht der Schriftzug links gut lesbar und die Früchte
 * laufen rechts um die Kante, die optische Mitte liegt also bei u 0,72 (-98 Grad).
 * Eine Drehung um +98 Grad bringt sie zur Kamera. Die Zutatenspalte der Rückseite
 * (bis u 0,51) erreicht dann selbst am Ausschlag der Idle-Drehung (8 Grad) nur die
 * letzten Grad vor der Silhouette und ist dort auf wenige Pixel zusammengedrückt.
 * Beim früheren Wert von 120 Grad stand die Mitte bei u 0,67, und links lief ein
 * gut sichtbarer Streifen der Zutatenspalte ins Bild.
 */
export const CAN_FRONT_ROTATION_Y = (98 * Math.PI) / 180;

/** Anisotropie und Farbraum einer Textur einmalig setzen (die Textur teilt sich der Cache). */
function tuneTexture(
  texture: THREE.Texture | null,
  anisotropy: number,
  colorSpace: THREE.ColorSpace,
): void {
  if (!texture) return;
  let changed = false;
  if (texture.anisotropy !== anisotropy) {
    texture.anisotropy = anisotropy;
    changed = true;
  }
  if (texture.colorSpace !== colorSpace) {
    texture.colorSpace = colorSpace;
    changed = true;
  }
  if (changed) texture.needsUpdate = true;
}

/**
 * Material einer Dose für die Szene klonen und einstellen. Je Dose ein eigener Klon,
 * damit sich Nachbardosen einzeln ausblenden lassen.
 */
export function prepareCanMaterial(
  material: THREE.Material,
  maxAnisotropy: number,
): THREE.MeshStandardMaterial {
  const standard = material.clone() as THREE.MeshStandardMaterial;
  // Rückseiten wegschneiden, sonst scheint bei durchsichtigen Nachbardosen die
  // Innenseite des Etiketts durch. needsUpdate, weil side in das Shader-Programm eingeht.
  standard.side = THREE.FrontSide;
  standard.needsUpdate = true;
  // Basecolor ist sRGB, Metal/Roughness sind Daten und bleiben linear. GLTFLoader setzt
  // das schon so, die Absicherung kostet nichts.
  tuneTexture(standard.map, maxAnisotropy, THREE.SRGBColorSpace);
  tuneTexture(standard.metalnessMap, maxAnisotropy, THREE.NoColorSpace);
  tuneTexture(standard.roughnessMap, maxAnisotropy, THREE.NoColorSpace);
  // glTF erlaubt nur 0 bis 1. Ältere Exporte lieferten 1,7.
  standard.roughness = Math.min(1, standard.roughness);
  return standard;
}
