import { getNavigation } from "@/lib/catalog/navigation";
import { Footer } from "./Footer";
import { Header } from "./Header";

/**
 * Seitenrahmen für alle Unterseiten: Header (Variante default, oben, sticky), Inhalt, Footer.
 * Die Startseite baut ihren Rahmen selbst (Header erst nach dem Hero).
 * Server Component, Menüs und Meldungen aus der Datenbank.
 */
export async function SiteShell({
  children,
  mainClassName,
}: {
  children: React.ReactNode;
  /** Klassen für <main>, Standard ohne Innenabstand (Sektionen bringen ihren eigenen mit) */
  mainClassName?: string;
}) {
  const nav = await getNavigation();
  return (
    <>
      <Header variant="default" menus={nav.main} announcements={nav.announcements} />
      <main id="inhalt" className={mainClassName}>
        {children}
      </main>
      <Footer quickLinks={nav.footerQuick} />
    </>
  );
}

export default SiteShell;
