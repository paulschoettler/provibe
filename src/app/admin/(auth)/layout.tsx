/**
 * Anmeldung, Zwei-Faktor und Abmelden ohne Shell (Figma 27:4155): Karte 420 px mittig auf dem
 * Admin-Hintergrund, mobil volle Breite mit 16 px Rand.
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8 md:py-12">
      <div className="w-full max-w-[420px]">{children}</div>
    </main>
  );
}
