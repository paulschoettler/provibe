"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import type { HomeFlavor } from "@/lib/catalog/home";
import { useHomeStore } from "@/lib/home/store";
import {
  CAMERA_BASE_Z,
  CAMERA_FOV,
  CAN_TILT_Z_DEG,
  CAN_YAW_DEG,
  NEIGHBOR_OPACITY_ZOOM,
  heroGeometry,
  visibleHeightAt,
  type HeroGeometry,
} from "@/components/home/hero-geometry";
import {
  DRAG_GAIN,
  DRAG_MAX_STEP,
  HERO_DRAG_END_EVENT,
  HERO_DRAG_EVENT,
  type HeroDragDetail,
} from "@/components/home/hero-drag";
import CanLighting, { ENVIRONMENT_INTENSITY } from "./CanLighting";
import { CAN_FRONT_ROTATION_Y, prepareCanMaterial } from "./can-material";

/**
 * Eine einzige fixe WebGL-Canvas für die ganze Startseite (Arbeitspaket A).
 *
 * Sie liegt zwischen Sortenfläche (z-index 0) und DOM-Inhalt (z-index 2) und
 * nimmt keine Zeiger-Ereignisse an. Inhalt:
 * - Karussell: drei Dosen auf einem elliptischen Ring. Jeder Platz bekommt seine
 *   Position, Größe, Neigung und Deckkraft aus seinem aktuellen Ringwinkel, nicht
 *   aus seinem Index. Dadurch ist jede Bewegung automatisch weich und endlos.
 * - Sequenz: 0 bis 0,4 Kamerazoom, 0,4 bis 0,7 aktive Dose dreht 180 Grad, dann halten.
 * - Finale (#pvlogo): drei Dosen fliegen zum Logo-Zoom ins Bild. Lage, Größe,
 *   Winkel und Deckkraft kommen von den PNG-Platzhaltern im DOM
 *   ([data-finale-can], siehe finaleCanPose), die LogoZoomMotion bewegt. In der
 *   Tiefe stehen sie gestaffelt (FINALE_CAN_LAYER), am Ziel schweben sie leicht.
 *
 * Die Datei wird per next/dynamic mit ssr:false eingebunden und darf deshalb
 * three direkt importieren. Ohne tier "3d" rendert sie nichts.
 */

const DEG = Math.PI / 180;
/** Dauer und Kurve der Ringdrehung. Gilt auch für das Einrasten nach dem Ziehen. */
const RING_DURATION = 0.8;
const RING_EASE = "power3.inOut";
/** Grunddrehung um die Y-Achse: Etikett frontal (Herleitung in can-material.ts). */
const CAN_BASE_ROTATION_Y = CAN_FRONT_ROTATION_Y;
/**
 * Erst um die eigene Achse drehen, dann in der Bildebene kippen. Mit der
 * three-Vorgabe "XYZ" würde die Kippung mitgedreht: Bei einer frontal stehenden
 * Dose (rund 90 Grad Grunddrehung) kippte sie dann zur Kamera statt zur Seite.
 */
const CAN_EULER_ORDER: THREE.EulerOrder = "ZYX";
/** Blickrichtung einer Dose ohne Drehung: lokale +z-Achse, also zur Kamera. */
const FORWARD = new THREE.Vector3(0, 0, 1);

/** Lineare Mischung, damit wir nicht für jede Zeile THREE.MathUtils bemühen. */
function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Deckkraft aller Materialien einer Dosengruppe setzen. */
function setGroupOpacity(group: THREE.Object3D, opacity: number): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const next = opacity < 0.999;
      if (material.transparent !== next) {
        material.transparent = next;
        material.needsUpdate = true;
      }
      material.opacity = opacity;
      // depthWrite bleibt an. Zusammen mit side = FrontSide (siehe normalizeCan)
      // verdeckt die Vorderseite der durchsichtigen Nachbardose ihre eigene
      // Rückseite, sonst stünde die Schrift des Etiketts spiegelverkehrt darin.
      material.depthWrite = true;
    }
  });
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Linearer Anteil zwischen zwei Schwellen, auf 0 bis 1 begrenzt. */
function range(value: number, from: number, to: number): number {
  return clamp01((value - from) / (to - from));
}

/** Finale-Dosen in Zeichenreihenfolge, wie in LogoZoom.tsx (Raspberry Lime vorn). */
const FINALE_CAN_SLUGS = ["wildberry", "peach", "raspberry-lime"] as const;
/**
 * Blickwinkel von oben auf die Finale-Dosen, wie auf den PNG-Produktfotos: Der
 * Deckel ist als schmale Ellipse zu sehen. Ohne diese Neigung stünde die Oberkante
 * über der Bildmitte auf Augenhöhe oder darüber, der Deckel verschwände und die
 * Dose wirkte oben waagerecht abgeschnitten (Feedback vom 17.10.2026).
 */
const FINALE_VIEW_TILT = 8 * DEG;
/**
 * Tiefenstaffel der Finale-Dosen, gleiche Reihenfolge wie FINALE_CAN_SLUGS:
 * Raspberry Lime vorn (Ebene 0), Wildberry eine Ebene dahinter, Peach eine halbe
 * Ebene weiter hinten, damit sich auch die beiden nach innen gekippten Böden der
 * hinteren Dosen nicht berühren. Die PNG-Platzhalter überlappen sich in der
 * Bildebene; stünden die Modelle alle bei z = 0, steckten sie ineinander.
 */
const FINALE_CAN_LAYER = [1, 1.5, 0] as const;
/** Dosenradius geteilt durch die Höhe (Bounding Box der GLB, siehe hero-geometry). */
const FINALE_CAN_RADIUS = 0.25;
/**
 * Idle-Bewegung im Endzustand: Schweben (Anteil der Dosenhöhe), Hin- und Herdrehen
 * um die Hochachse (Grad, das Etikett bleibt lesbar) und Vor und Zurück in der Tiefe
 * (Anteil der Dosenhöhe). Je Dose versetzt, damit sie nicht im Gleichtakt laufen.
 */
const FINALE_IDLE_FLOAT = 0.022;
const FINALE_IDLE_YAW = 5 * DEG;
const FINALE_IDLE_DEPTH = 0.07;
const FINALE_IDLE_PHASE = [0, 2.1, 4.2] as const;
/** Ab hier stehen die Dosen am Ziel (Choreografie: letzte Dose bei 0,8, Haltezone ab 0,95). */
const FINALE_SETTLE_FROM = 0.8;
const FINALE_SETTLE_TO = 0.95;

/**
 * Abstand in der Tiefe zwischen zwei Ebenen der Finale-Staffel, in Welteinheiten.
 * Vordere und hintere Dose dürfen sich nicht durchdringen, egal wie weit sich ihre
 * Platzhalter überlappen: Achsabstand mindestens Radius vorn plus Radius hinten plus
 * ein halber Dosendurchmesser Luft plus der Ausschlag der Idle-Bewegung beider Dosen.
 * Die hintere Dose wird mit der Tiefe größer skaliert (Faktor (D + dz) / D), deshalb
 * ist dz nach sich selbst aufgelöst.
 */
function finaleLayerGap(frontHeight: number, backHeight: number, distance: number): number {
  const front = FINALE_CAN_RADIUS * frontHeight + FINALE_IDLE_DEPTH * frontHeight;
  const back = (2 * FINALE_CAN_RADIUS + FINALE_IDLE_DEPTH) * backHeight;
  const grow = back / Math.max(distance, 0.0001);
  return (front + back) / Math.max(0.2, 1 - grow);
}

interface FinaleCanPose {
  x: number;
  y: number;
  /** Höhe in Welteinheiten (Modelle sind auf Höhe 1 normiert) */
  height: number;
  /** Winkel in Grad wie CSS rotate */
  rotate: number;
  /** Abstand zum Endwinkel in Grad, für die Drehung zur Bildmitte */
  turn: number;
  opacity: number;
}

/**
 * Lage eines PNG-Platzhalters in der Ebene z = 0 der Szene. Die Mitte der
 * Bounding Box bleibt bei einer Drehung gleich, die Höhe kommt aus offsetHeight
 * (ohne Transform). Winkel und Deckkraft schreibt LogoZoomMotion als data-r und
 * data-o, data-r-end ist der Endwinkel.
 */
function finaleCanPose(
  anchor: HTMLElement,
  viewport: { width: number; height: number },
  distance: number,
): FinaleCanPose | null {
  if (viewport.width === 0 || viewport.height === 0) return null;
  const rect = anchor.getBoundingClientRect();
  const visibleHeight = visibleHeightAt(distance);
  const visibleWidth = visibleHeight * (viewport.width / viewport.height);
  const rotate = Number.parseFloat(anchor.dataset.r ?? "0") || 0;
  const rotateEnd = Number.parseFloat(anchor.dataset.rEnd ?? "0") || 0;
  const opacity = Number.parseFloat(anchor.dataset.o ?? "1");
  return {
    x: ((rect.left + rect.width / 2) / viewport.width - 0.5) * visibleWidth,
    y: (0.5 - (rect.top + rect.height / 2) / viewport.height) * visibleHeight,
    height: (anchor.offsetHeight / viewport.height) * visibleHeight,
    rotate,
    turn: rotate - rotateEnd,
    opacity: Number.isFinite(opacity) ? clamp01(opacity) : 1,
  };
}

/**
 * Dose auf Einheitshöhe bringen und im Ursprung zentrieren. Das Quellmodell
 * steht auf der Y-Achse (Ursprung am Boden) und ist knapp vier Einheiten hoch.
 */
function normalizeCan(source: THREE.Object3D, maxAnisotropy: number): THREE.Group {
  const clone = source.clone(true);
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    // Material je Dose klonen, damit sich Nachbardosen einzeln ausblenden lassen.
    const original = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = original.map((material) => prepareCanMaterial(material, maxAnisotropy));
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
  });

  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? 1 / size.y : 1;
  clone.scale.setScalar(scale);
  clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

  const group = new THREE.Group();
  group.add(clone);
  return group;
}

function CanModel({
  url,
  index,
  onReady,
}: {
  url: string;
  /** Index der Sorte im Store, -1 für die Footer-Dosen. */
  index: number;
  onReady: (index: number) => void;
}) {
  // useDraco: false, damit drei keinen Decoder von einer CDN zieht. Meshopt bleibt an.
  const { scene } = useGLTF(url, false, true);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const object = useMemo(() => normalizeCan(scene, maxAnisotropy), [scene, maxAnisotropy]);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    onReady(index);
    invalidate();
    return () => {
      // Nur die geklonten Materialien freigeben, die Texturen gehören dem useGLTF-Cache.
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
    };
  }, [object, index, onReady, invalidate]);

  return <primitive object={object} />;
}

interface SceneProps {
  flavors: HomeFlavor[];
  mobileModels: boolean;
}

function Scene({ flavors, mobileModels }: SceneProps) {
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  /** Winkel zwischen zwei Dosen auf dem Ring (bei drei Sorten 120 Grad). */
  const step = (Math.PI * 2) / flavors.length;

  const geometry: HeroGeometry = useMemo(() => heroGeometry(size.width, size.height), [size]);

  const ringRef = useRef<THREE.Group>(null);
  const slotRefs = useRef<Array<THREE.Group | null>>([]);
  const slotOpacity = useRef<number[]>([]);
  const footerRefs = useRef<Array<THREE.Group | null>>([]);
  const ringAngle = useRef({ value: 0 });
  /** Zusatzwinkel, solange der Finger oder die Maus den Ring zieht. */
  const dragAngle = useRef({ value: 0 });
  const lastIndex = useRef(useHomeStore.getState().flavorIndex);
  const heroVisible = useRef(true);
  const reduced = useRef(false);

  const [footerMounted, setFooterMounted] = useState(false);

  /** Welche Modelle sind schon eingehängt. Aktive Sorte zuerst, dann der Rest. */
  const [mounted, setMounted] = useState<boolean[]>(() => {
    const start = flavors.map(() => false);
    start[useHomeStore.getState().flavorIndex] = true;
    return start;
  });

  const modelUrl = useCallback(
    (flavor: HomeFlavor) => (mobileModels ? flavor.modelUrl1k : flavor.modelUrl2k),
    [mobileModels],
  );

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Nachladen der übrigen Sorten, sobald der Browser Luft hat.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      for (const flavor of flavors) useGLTF.preload(modelUrl(flavor), false, true);
      setMounted(flavors.map(() => true));
      setFooterMounted(true);
    };
    const hasIdle = typeof window.requestIdleCallback === "function";
    const handle = hasIdle
      ? window.requestIdleCallback(run, { timeout: 1500 })
      : window.setTimeout(run, 900);
    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [flavors, modelUrl]);

  // Karussell: Winkel akkumulieren, damit der Ring endlos in eine Richtung dreht.
  useEffect(() => {
    const angle = ringAngle.current;
    const count = flavors.length;
    const unsubscribe = useHomeStore.subscribe((state) => {
      if (state.flavorIndex === lastIndex.current) return;
      // Sprünge über die Punkte können mehr als eine Position weit sein. Die
      // Richtung aus dem Store entscheidet nur, herum welche Seite gedreht wird.
      let steps = state.flavorIndex - lastIndex.current;
      if (state.direction === 1 && steps < 0) steps += count;
      if (state.direction === -1 && steps > 0) steps -= count;
      lastIndex.current = state.flavorIndex;
      const target = angle.value - steps * ((Math.PI * 2) / count);
      gsap.killTweensOf(angle);
      if (reduced.current) {
        angle.value = target;
        invalidate();
        return;
      }
      gsap.to(angle, {
        value: target,
        duration: RING_DURATION,
        ease: RING_EASE,
        onUpdate: invalidate,
      });
    });
    return () => {
      gsap.killTweensOf(angle);
      unsubscribe();
    };
  }, [flavors.length, invalidate]);

  // Ziehen mit Finger oder Maus: Der Ring folgt, beim Loslassen rastet er ein.
  // Weil Grunddrehung und Zusatzwinkel dieselbe Dauer und Kurve benutzen, ist die
  // Summe beider Tweens wieder eine saubere power3.inOut-Bewegung.
  useEffect(() => {
    const drag = dragAngle.current;
    const step = (Math.PI * 2) / flavors.length;

    const onDrag = (event: Event) => {
      const detail = (event as CustomEvent<HeroDragDetail>).detail;
      if (!detail) return;
      gsap.killTweensOf(drag);
      const limit = step * DRAG_MAX_STEP;
      drag.value = Math.max(-limit, Math.min(limit, detail.progress * DRAG_GAIN * step));
      invalidate();
    };

    const onDragEnd = (event: Event) => {
      const detail = (event as CustomEvent<HeroDragDetail>).detail;
      gsap.killTweensOf(drag);
      if (reduced.current) {
        drag.value = 0;
        invalidate();
        return;
      }
      gsap.to(drag, {
        value: 0,
        duration: detail?.settled ? RING_DURATION : 0.45,
        ease: detail?.settled ? RING_EASE : "power3.out",
        onUpdate: invalidate,
      });
    };

    window.addEventListener(HERO_DRAG_EVENT, onDrag);
    window.addEventListener(HERO_DRAG_END_EVENT, onDragEnd);
    return () => {
      gsap.killTweensOf(drag);
      window.removeEventListener(HERO_DRAG_EVENT, onDrag);
      window.removeEventListener(HERO_DRAG_END_EVENT, onDragEnd);
    };
  }, [flavors.length, invalidate]);

  // Das Karussell verschwindet, sobald die Hero- und Sequenz-Bühne aus dem Bild ist.
  useEffect(() => {
    const stage = document.getElementById("pv-sequence") ?? document.getElementById("pv-hero");
    if (!stage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) heroVisible.current = entry.isIntersecting;
        invalidate();
      },
      { threshold: 0 },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [invalidate]);

  /** Deckkraft und Bildzähler der Finale-Dosen, Platzhalter im DOM je Sorte. */
  const footerOpacity = useRef<number[]>([]);
  const footerFrames = useRef<number[]>([]);
  const footerAnchors = useRef<Array<HTMLElement | null>>([]);
  const finalePoses = useRef<Array<FinaleCanPose | null>>([]);
  /** Wiederverwendete Rechenobjekte für die Ausrichtung der Finale-Dosen. */
  const finalePose = useMemo(
    () => ({
      euler: new THREE.Euler(),
      local: new THREE.Quaternion(),
      look: new THREE.Quaternion(),
      ray: new THREE.Vector3(),
    }),
    [],
  );

  // Fällt die Szene weg, sind die PNG-Platzhalter wieder die Dosen.
  useEffect(() => {
    return () => {
      const anchors = document.querySelectorAll<HTMLElement>(
        "[data-finale-can][data-canvas-ready]",
      );
      for (const anchor of anchors) delete anchor.dataset.canvasReady;
    };
  }, []);

  /**
   * Sobald die aktive Sorte zwei Bilder lang wirklich gerendert wurde, verschwindet
   * das PNG (Feedback 1). Die Marke steht als data-Attribut auf der Sektion, damit
   * sie ein erneutes Rendern von React übersteht, und wird jedes Bild nachgesetzt,
   * falls der Knoten doch einmal ausgetauscht wird.
   */
  const readyFrames = useRef(0);
  const markCanvasReady = useCallback((slot: THREE.Group | null) => {
    if (!slot || slot.children.length === 0) {
      readyFrames.current = 0;
      return;
    }
    if (readyFrames.current < 2) {
      readyFrames.current += 1;
      return;
    }
    const hero = document.getElementById("pv-hero");
    if (hero && hero.dataset.canvasReady !== "true") hero.dataset.canvasReady = "true";
  }, []);

  // Fällt die Szene weg (Kontextverlust, reduzierte Bewegung), ist das PNG wieder die Dose.
  useEffect(() => {
    return () => {
      const hero = document.getElementById("pv-hero");
      if (hero) delete hero.dataset.canvasReady;
    };
  }, []);

  useFrame((state) => {
    const store = useHomeStore.getState();
    const seq = store.seqProgress;
    const zoom = range(seq, 0, 0.4);
    const spin = range(seq, 0.4, 0.7);
    const time = state.clock.elapsedTime;
    const still = reduced.current;

    // Kamera fährt an die Dose heran und bleibt ab 0,4 stehen.
    state.camera.position.z = THREE.MathUtils.lerp(CAMERA_BASE_Z, geometry.zoomZ, zoom);

    const ring = ringRef.current;
    if (ring) {
      // Nur sichtbar, solange die Hero-Bühne im Bild ist und das Finale nicht.
      // Früher hing das zusätzlich an seq >= 1: Nach einem Neuladen weiter unten
      // (Scroll-Wiederherstellung) oder wenn scrub noch hinterherläuft, steht seq
      // unter 1, und das ganze Karussell stand mitten im Finale (Feedback 17.10.2026).
      ring.visible = heroVisible.current && store.footerProgress === 0;
      // Die Plätze stehen auf einer Ellipse und werden einzeln gesetzt, deshalb
      // dreht sich die Gruppe selbst nicht.
      ring.rotation.y = 0;
      ring.position.x = geometry.seqShiftX * zoom;
      ring.position.y = geometry.canCenterY + geometry.seqShiftY * zoom;
    }

    // Im gezoomten Zustand rücken die Nachbardosen so weit zur Seite, dass sie
    // neben dem Zutatenblock Platz haben (Feedback 7).
    const spread = mix(1, geometry.neighborSpreadZoom, zoom);
    const base = ringAngle.current.value + dragAngle.current.value;

    for (let index = 0; index < slotRefs.current.length; index += 1) {
      const slot = slotRefs.current[index];
      if (!slot) continue;
      // Alles hängt am aktuellen Ringwinkel, nicht am Index. Damit kippt, wächst
      // und leuchtet jede Dose beim Wechsel von allein weich auf.
      const angle = base + index * step;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      /** 1 vorne in der Mitte, 0 ab 120 Grad und weiter hinten. */
      const front = clamp01((cos + 0.5) / 1.5);

      slot.position.x = sin * geometry.ringRadiusX * spread;
      slot.position.z = cos * geometry.ringRadiusZ;

      const float = still ? 0 : Math.sin(time * 0.8) * 0.018 * front;
      slot.position.y = float * geometry.canHeight;

      const idle = still ? 0 : Math.sin(time * 0.45) * 8 * DEG * front;
      // Nachbardosen kippen nach außen: links gegen, rechts mit dem Uhrzeigersinn.
      slot.rotation.order = CAN_EULER_ORDER;
      slot.rotation.z = -sin * CAN_TILT_Z_DEG * DEG;
      // Nachbardosen drehen sich leicht zur Kamera (rechts negativ, links positiv),
      // damit auch bei ihnen Schriftzug und Früchte zu sehen sind. Der Anteil hängt
      // am Ringwinkel: Eine einfahrende Dose dreht sich dabei von selbst auf frontal.
      slot.rotation.y =
        CAN_BASE_ROTATION_Y - sin * CAN_YAW_DEG * DEG + idle + spin * Math.PI * front;
      slot.scale.setScalar(geometry.canHeight * mix(geometry.neighborScale, 1, front));

      // Beim Zoom treten die Nachbardosen zurück, bleiben aber sichtbar.
      const opacity = 1 - zoom * (1 - NEIGHBOR_OPACITY_ZOOM) * (1 - front);
      // Ein Modell, das gerade erst eingehängt wurde, braucht seine Deckkraft neu.
      if (slot.children.length === 0) slotOpacity.current[index] = -1;
      if (Math.abs((slotOpacity.current[index] ?? -1) - opacity) > 0.004) {
        slotOpacity.current[index] = opacity;
        setGroupOpacity(slot, opacity);
      }
    }

    markCanvasReady(slotRefs.current[store.flavorIndex]);

    // Finale-Dosen: Sie folgen ihren PNG-Platzhaltern. footerProgress > 0 heißt nur
    // "Sektion im Bild"; die Bewegung selbst steckt in Lage und data-r/data-o im DOM.
    const footer = store.footerProgress;
    const distance = state.camera.position.z;
    const poses = finalePoses.current;
    for (let index = 0; index < FINALE_CAN_SLUGS.length; index += 1) {
      let anchor = footerAnchors.current[index] ?? null;
      if (!anchor || !anchor.isConnected) {
        anchor = document.querySelector<HTMLElement>(
          `[data-finale-can="${FINALE_CAN_SLUGS[index]}"]`,
        );
        footerAnchors.current[index] = anchor;
      }
      poses[index] = footer > 0 && anchor ? finaleCanPose(anchor, size, distance) : null;
    }
    // Tiefenstaffel aus den Höhen der Platzhalter: vordere Dose gegen die größere
    // der hinteren, damit der Abstand für beide Seiten reicht.
    const frontPose = poses[FINALE_CAN_LAYER.indexOf(0)];
    const backHeight = Math.max(
      ...poses.map((pose, index) => (pose && FINALE_CAN_LAYER[index] > 0 ? pose.height : 0)),
    );
    const layerGap = frontPose ? finaleLayerGap(frontPose.height, backHeight, distance) : 0;
    /** 0 im Flug, 1 am Ziel: blendet die Idle-Bewegung weich ein. */
    const settle = still
      ? 0
      : THREE.MathUtils.smoothstep(footer, FINALE_SETTLE_FROM, FINALE_SETTLE_TO);

    for (let index = 0; index < footerRefs.current.length; index += 1) {
      const group = footerRefs.current[index];
      if (!group) continue;
      const anchor = footerAnchors.current[index] ?? null;
      const pose = poses[index] ?? null;
      if (!pose) {
        group.visible = false;
        continue;
      }
      group.visible = pose.opacity > 0.01;

      // Jede Dose bekommt ihre eigene Tiefe. Lage und Größe wachsen mit dem Abstand
      // zur Kamera, damit sie auf dem Schirm genau auf ihrem Platzhalter bleibt.
      const z = -(FINALE_CAN_LAYER[index] ?? 0) * layerGap;
      const grow = (distance - z) / distance;
      const phase = FINALE_IDLE_PHASE[index] ?? 0;
      const floatY = Math.sin(time * 0.9 + phase) * FINALE_IDLE_FLOAT * pose.height * settle;
      const idleYaw = Math.sin(time * 0.55 + phase * 1.3) * FINALE_IDLE_YAW * settle;
      // Vor und zurück ohne Ausgleich der Größe: Die Dose wird dabei sichtbar ein
      // wenig größer und kleiner. Der Ausschlag steckt schon in layerGap.
      const idleZ = Math.sin(time * 0.6 + phase * 0.7) * FINALE_IDLE_DEPTH * pose.height * settle;
      const x = pose.x * grow;
      const y = pose.y * grow + floatY;
      group.position.set(x, y, z + idleZ);

      // Erst um die eigene Achse (im Flug zur Bildmitte, am Ziel frontal), dann
      // mit dem Deckel zur Kamera neigen, dann in der Bildebene kippen wie CSS rotate.
      finalePose.euler.set(
        FINALE_VIEW_TILT,
        CAN_BASE_ROTATION_Y - pose.turn * 1.2 * DEG + idleYaw,
        -pose.rotate * DEG,
        "ZXY",
      );
      finalePose.local.setFromEuler(finalePose.euler);
      // Die Dosen stehen weit außerhalb der Bildmitte, die perspektivische Kamera
      // sähe sie dort schräg von unten (beim Herausscrollen mit sichtbarem Boden)
      // oder von oben. Deshalb zeigt ihre Vorderseite immer genau zur Kamera: Jede
      // Dose sieht an jeder Bildposition so aus wie in der Bildmitte.
      finalePose.ray
        .set(state.camera.position.x - x, state.camera.position.y - y, distance - z)
        .normalize();
      finalePose.look.setFromUnitVectors(FORWARD, finalePose.ray);
      group.quaternion.multiplyQuaternions(finalePose.look, finalePose.local);
      group.scale.setScalar(pose.height * grow);
      if (group.children.length === 0) footerOpacity.current[index] = -1;
      if (Math.abs((footerOpacity.current[index] ?? -1) - pose.opacity) > 0.004) {
        footerOpacity.current[index] = pose.opacity;
        setGroupOpacity(group, pose.opacity);
      }
      // Erst wenn das Modell zwei Bilder lang steht, verschwindet das PNG.
      if (group.children.length === 0) {
        footerFrames.current[index] = 0;
      } else if ((footerFrames.current[index] ?? 0) < 2) {
        footerFrames.current[index] = (footerFrames.current[index] ?? 0) + 1;
      } else if (anchor && anchor.dataset.canvasReady !== "true") {
        anchor.dataset.canvasReady = "true";
      }
    }
  });

  const setReady = useCallback((index: number) => {
    if (index >= 0) useHomeStore.getState().setModelReady(index, true);
  }, []);

  const footerFlavors = FINALE_CAN_SLUGS.map((slug) => flavors.find((f) => f.slug === slug));

  return (
    <>
      <CanLighting />

      <group ref={ringRef}>
        {flavors.map((flavor, index) => (
          <group
            key={flavor.slug}
            ref={(node) => {
              slotRefs.current[index] = node;
            }}
          >
            {mounted[index] ? (
              <Suspense fallback={null}>
                <CanModel url={modelUrl(flavor)} index={index} onReady={setReady} />
              </Suspense>
            ) : null}
          </group>
        ))}
      </group>

      {footerFlavors.map((flavor, index) =>
        flavor ? (
          <group
            key={`finale-${flavor.slug}`}
            ref={(node) => {
              footerRefs.current[index] = node;
            }}
            visible={false}
          >
            {footerMounted ? (
              <Suspense fallback={null}>
                <CanModel url={modelUrl(flavor)} index={-1} onReady={setReady} />
              </Suspense>
            ) : null}
          </group>
        ) : null,
      )}
    </>
  );
}

/** Setzt dpr herunter, wenn die Bildrate einbricht. */
function DprGuard({ max }: { max: number }) {
  const setDpr = useThree((state) => state.setDpr);
  return <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(max)} />;
}

export default function CanScene({ flavors }: { flavors: HomeFlavor[] }) {
  const tier = useHomeStore((state) => state.tier);
  const footerActive = useHomeStore((state) => state.footerProgress > 0);
  const [stageVisible, setStageVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const stage = document.getElementById("pv-sequence") ?? document.getElementById("pv-hero");
    if (!stage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setStageVisible(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  if (tier !== "3d" || flavors.length === 0) return null;

  const maxDpr = isMobile ? 1.5 : 2;

  return (
    <div className="pv-canvas" aria-hidden="true">
      <Canvas
        frameloop={stageVisible || footerActive ? "always" : "demand"}
        dpr={[1, maxDpr]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          // Khronos PBR Neutral statt ACES: hält die Etikettfarben nah an der
          // Druckvorlage, ACES dunkelt Pink und Grün ab und verschiebt den Farbton.
          toneMapping: THREE.NeutralToneMapping,
        }}
        scene={{ environmentIntensity: ENVIRONMENT_INTENSITY }}
        camera={{ fov: CAMERA_FOV, near: 0.1, far: 60, position: [0, 0, CAMERA_BASE_Z] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            "webglcontextlost",
            () => useHomeStore.getState().setTier("static"),
            { once: true },
          );
        }}
      >
        <DprGuard max={maxDpr} />
        <Scene flavors={flavors} mobileModels={isMobile} />
      </Canvas>
    </div>
  );
}
