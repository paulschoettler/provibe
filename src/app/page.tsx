import type { Metadata } from "next";
import { getHomeData } from "@/lib/catalog/home";
import HomeMotion from "@/components/home/HomeMotion";
import CanSceneMount from "@/components/three/CanSceneMount";
import Hero from "@/components/home/Hero";
import StickyAddToCart from "@/components/home/StickyAddToCart";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FlavorCards } from "@/components/home/FlavorCards";
import { PurseBanner } from "@/components/home/PurseBanner";
import { FounderBundles } from "@/components/home/FounderBundles";
import { MoodSection } from "@/components/home/MoodSection";
import { LogoZoom } from "@/components/home/LogoZoom";

/** Katalogdaten ändern sich selten: statisch bauen, spätestens stündlich erneuern, sonst per On-Demand-Revalidation. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "provibe: Eistee mit 15 g Protein",
  description:
    "Schluss mit Shakern und Pulver. provibe ist erfrischender Eistee mit 15 g Protein, ohne Zucker, ready to drink. Wildberry, Raspberry Lime und Peach.",
  alternates: { canonical: "/" },
};

/**
 * Startseite. Alles Inhaltliche steht im Server-HTML; 3D-Szene, Scroll-Animationen und
 * Warenkorb-Drawer sind Progressive Enhancement (ADR-009).
 */
export default async function HomePage() {
  const home = await getHomeData();
  const { flavors } = home;

  return (
    <>
      <HomeMotion />
      <CanSceneMount flavors={flavors} />
      <main id="inhalt">
        <Hero flavors={flavors} />
        <Header variant="home" menus={home.menus.main} announcements={home.announcements} />
        <FlavorCards flavors={flavors} />
        <PurseBanner />
        <FounderBundles bundles={home.bundles} />
        <MoodSection />
        <LogoZoom />
      </main>
      <Footer quickLinks={home.menus.footerQuick} />
      <StickyAddToCart
        flavors={flavors.map((f) => ({
          shortName: f.shortName,
          variantId: f.pack.variantId,
          unitCount: f.pack.unitCount,
        }))}
      />
    </>
  );
}
