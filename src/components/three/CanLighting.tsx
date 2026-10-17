"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Licht der Dosenszene, gemeinsam für Startseite und Prüfseiten.
 *
 * Ziel sind die Produktfotos in public/images/cans: helle, kräftige Etikettfarben,
 * eine weiche helle Lichtkante seitlich, keine dunklen Spiegelbänder. Dazu:
 * - Umgebung aus einem lokal gebauten RoomEnvironment (keine CDN, keine HDR-Datei).
 *   Sie liefert die Spiegelungen auf Deckel, Boden und dem Glanz des Drucks.
 * - Ein weiches Führungslicht von vorn oben rechts, ein breites Fülllicht von links,
 *   ein Kantenlicht von hinten für die helle Silhouette.
 * - Wenig Umgebungslicht, damit die Dose Körper behält.
 */

/**
 * Belichtung: Der Auftraggeber hat am 17.10.2026 in drei Runden abgenommen, wie hell
 * die Dosen stehen sollen (seidenmatt, nicht überbelichtet). Umgebung und alle drei
 * Lichter liegen deshalb 30 Prozent unter dem ersten Entwurf; eine freie
 * Etikettfläche von Wildberry misst im Bild dann 203/27/81 gegenüber 221/41/95 in
 * der Textur (Headless-Chromium, Neutral Tone Mapping wie in der Canvas).
 */

/**
 * Stärke der Umgebung auf allen Materialien der Szene. three liest bei
 * scene.environment nur diesen Wert, envMapIntensity am Material zählt dann nicht.
 * Wird als scene-Prop der Canvas gesetzt (CanScene), nicht hier per Mutation.
 */
export const ENVIRONMENT_INTENSITY = 0.35;

function LocalEnvironment() {
  const gl = useThree((state) => state.gl);

  const texture = useMemo(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    generator.dispose();
    room.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    return target.texture;
  }, [gl]);

  useEffect(() => () => texture.dispose(), [texture]);

  return <primitive object={texture} attach="environment" />;
}

export default function CanLighting() {
  return (
    <>
      <LocalEnvironment />
      <ambientLight intensity={0.07} />
      {/* Führungslicht: vorn, leicht rechts und oben. */}
      <directionalLight position={[2.5, 3, 6]} intensity={0.66} />
      {/* Fülllicht von links, warm, damit die Schattenseite nicht absäuft. */}
      <directionalLight position={[-5, 1.5, 3]} intensity={0.25} color="#fff3f6" />
      {/* Kantenlicht von hinten oben für die helle Silhouette. */}
      <directionalLight position={[-2, 4, -5]} intensity={0.85} />
    </>
  );
}
