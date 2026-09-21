"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import gsap from "gsap";
import type { HomeFlavor } from "@/lib/catalog/home";
import { useHomeStore } from "@/lib/home/store";
import {
  CAMERA_BASE_Z,
  CAMERA_FOV,
  heroGeometry,
  visibleHeightAt,
  type HeroGeometry,
} from "@/components/home/hero-geometry";

/**
 * Eine einzige fixe WebGL-Canvas für die ganze Startseite (Arbeitspaket A).
 *
 * Sie liegt zwischen Sortenfläche (z-index 0) und DOM-Inhalt (z-index 2) und
 * nimmt keine Zeiger-Ereignisse an. Inhalt:
 * - Karussell: drei Dosen auf einem Ring, Wechsel dreht die Gruppe um 120 Grad.
 * - Sequenz: 0 bis 0,4 Kamerazoom, 0,4 bis 0,7 aktive Dose dreht 180 Grad, dann halten.
 * - Footer: zwei Dosen fliegen zum Logo-Zoom von außen ins Bild.
 *
 * Die Datei wird per next/dynamic mit ssr:false eingebunden und darf deshalb
 * three direkt importieren. Ohne tier "3d" rendert sie nichts.
 */

const DEG = Math.PI / 180;
/**
 * Grunddrehung der Dose um die Y-Achse, damit das Etikett zur Kamera zeigt.
 * Alle drei Modelle teilen Mesh und UV-Layout, ein Wert reicht. Stellschraube,
 * falls der Schriftzug beim ersten Blick nicht mittig sitzt.
 */
const CAN_BASE_ROTATION_Y = (120 * Math.PI) / 180;

/** Deckkraft aller Materialien einer Dosengruppe setzen. */
function setGroupOpacity(group: THREE.Object3D, opacity: number): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material.opacity = opacity;
      material.transparent = opacity < 0.999;
      material.depthWrite = opacity >= 0.999;
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
function normalizeCan(source: THREE.Object3D): THREE.Group {
  const clone = source.clone(true);
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    // Material je Dose klonen, damit sich Nachbardosen einzeln ausblenden lassen.
    const original = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = original.map((material) => {
      const standard = material.clone() as THREE.MeshStandardMaterial;
      if (typeof standard.roughness === "number") {
        // Die Quelle liefert roughnessFactor 1.7, außerhalb der glTF-Spanne.
        standard.roughness = Math.min(1, standard.roughness);
        standard.envMapIntensity = 0.85;
      }
      return standard;
    });
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
  const object = useMemo(() => normalizeCan(scene), [scene]);
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

/** Umgebungslicht aus einem lokal gebauten RoomEnvironment, ohne CDN und ohne HDR-Datei. */
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
  const footerRefs = useRef<Array<THREE.Group | null>>([]);
  const ringAngle = useRef({ value: 0 });
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
        duration: 0.8,
        ease: "power3.inOut",
        onUpdate: invalidate,
      });
    });
    return () => {
      gsap.killTweensOf(angle);
      unsubscribe();
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
  const footerScale = geometry.canHeight * (geometry.isMobile ? 0.42 : 0.6);
  const footerY = geometry.isMobile ? -geometry.canHeight * 0.45 : -geometry.canHeight * 0.12;

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
      ring.rotation.y = ringAngle.current.value;
      ring.position.x = geometry.seqShiftX * zoom;
      ring.position.y = geometry.canCenterY + geometry.seqShiftY * zoom;
    }

    for (let index = 0; index < slotRefs.current.length; index += 1) {
      const slot = slotRefs.current[index];
      if (!slot) continue;
      const isActive = index === store.flavorIndex;
      const idle = still || !isActive ? 0 : Math.sin(time * 0.45) * 8 * DEG;
      const float = still || !isActive ? 0 : Math.sin(time * 0.8) * 0.018;
      slot.rotation.y = index * step + CAN_BASE_ROTATION_Y + idle + (isActive ? spin * Math.PI : 0);
      slot.position.y = float * geometry.canHeight;
      slot.scale.setScalar(geometry.canHeight);
      // Beim Zoom treten die Nachbardosen zurück, damit der Zutatenblock frei liegt.
      setGroupOpacity(slot, isActive ? 1 : 1 - zoom);
    }

    // Footer-Dosen: linear an footerProgress, die Glättung macht der Scrub des Aufrufers.
    const footer = store.footerProgress;
    for (let index = 0; index < footerRefs.current.length; index += 1) {
      const group = footerRefs.current[index];
      if (!group) continue;
      const side = index === 0 ? -1 : 1;
      group.visible = footer > 0;
      group.position.x = side * THREE.MathUtils.lerp(footerStartX, footerX, footer);
      group.position.y = footerY;
      group.rotation.z = -side * THREE.MathUtils.lerp(18, 6, footer) * DEG;
      group.rotation.y = CAN_BASE_ROTATION_Y + footer * 25 * DEG;
      group.scale.setScalar(footerScale);
    }
  });

  const setReady = useCallback((index: number) => {
    if (index >= 0) useHomeStore.getState().setModelReady(index, true);
  }, []);

  const footerFlavors = [flavors[0], flavors[flavors.length - 1]];

  return (
    <>
      <LocalEnvironment />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3.2, 4.5, 5]} intensity={2.4} />
      <directionalLight position={[-4, 2.2, -3.5]} intensity={1.7} color="#ffe9f2" />
      <directionalLight position={[0, -3, 3]} intensity={0.55} />

      <group ref={ringRef}>
        {flavors.map((flavor, index) => (
          <group
            key={flavor.slug}
            ref={(node) => {
              slotRefs.current[index] = node;
            }}
            position={[
              Math.sin(index * step) * geometry.ringRadius,
              0,
              Math.cos(index * step) * geometry.ringRadius,
            ]}
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
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
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
