"use client";

import dynamic from "next/dynamic";
import type { HomeFlavor } from "@/lib/catalog/home";
import { useHomeStore } from "@/lib/home/store";

/**
 * Einhängepunkt der 3D-Szene (Arbeitspaket A).
 *
 * next/dynamic mit ssr:false ist in Server Components nicht erlaubt, deshalb
 * liegt der Aufruf in dieser kleinen Client-Insel. Sie lädt das three-Bündel
 * erst, wenn die Fähigkeitsprüfung in HomeMotion tier "3d" gesetzt hat. Geräte
 * ohne WebGL, mit reduzierter Bewegung oder mit wenig Leistung laden es nie.
 */
const CanScene = dynamic(() => import("./CanScene"), { ssr: false });

export default function CanSceneMount({ flavors }: { flavors: HomeFlavor[] }) {
  const tier = useHomeStore((state) => state.tier);
  if (tier !== "3d") return null;
  return <CanScene flavors={flavors} />;
}
