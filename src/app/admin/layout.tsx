import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Backoffice", template: "%s | provibe Backoffice" },
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export const viewport: Viewport = { themeColor: "#4a2f39" };

/**
 * Wurzel des Backoffice. [data-admin] schaltet die Admin-Tokens frei (globals.css, Block "Admin Shell").
 * Anmeldung und Zwei-Faktor liegen in (auth) ohne Shell, alle übrigen Seiten in (shell) mit requireStaff.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div data-admin="">{children}</div>;
}
