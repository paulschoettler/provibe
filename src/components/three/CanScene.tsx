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
 * - Footer: zwei Dosen fliegen zum Logo-Zoom von außen ins Bild.
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

  const halfVisibleWidth = visibleHeightAt(CAMERA_BASE_Z) * 0.5 * geometry.aspect;
  // Desktop: Dosen neben dem Logo (Logo ist bis 680 px breit), nicht dahinter
  const footerX = geometry.isMobile ? 1.1 : Math.max(1.6, halfVisibleWidth * 0.78);
  const footerStartX = halfVisibleWidth + 1.4;
  const footerScale = geometry.canHeight * (geometry.isMobile ? 0.42 : 0.54);
  const footerY = geometry.isMobile ? -geometry.canHeight * 0.45 : -geometry.canHeight * 0.12;

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
      const hidden = seq >= 1 && !heroVisible.current;
      ring.visible = !hidden;
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

    // Footer-Dosen: linear an footerProgress, die Glättung macht der Scrub des Aufrufers.
    const footer = store.footerProgress;
    for (let index = 0; index < footerRefs.current.length; index += 1) {
      const group = footerRefs.current[index];
      if (!group) continue;
      const side = index === 0 ? -1 : 1;
      group.visible = footer > 0;
      group.position.x = side * THREE.MathUtils.lerp(footerStartX, footerX, footer);
      group.position.y = footerY;
      group.rotation.order = CAN_EULER_ORDER;
      group.rotation.z = -side * THREE.MathUtils.lerp(18, 6, footer) * DEG;
      // Beim Einfliegen drehen sie sich zur Bildmitte und kommen fast frontal an.
      group.rotation.y = CAN_BASE_ROTATION_Y - side * THREE.MathUtils.lerp(35, 10, footer) * DEG;
      group.scale.setScalar(footerScale);
    }
  });

  const setReady = useCallback((index: number) => {
    if (index >= 0) useHomeStore.getState().setModelReady(index, true);
  }, []);

  const footerFlavors = [flavors[0], flavors[flavors.length - 1]];

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
            key={`footer-${flavor.slug}`}
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
