import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Backoffice", template: "%s | provibe Backoffice" },
  robots: { index: false, follow: false, noarchive: true },
};

/** Backoffice-Rahmen. Login, Navigation und Module folgen in Phase 4. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div data-admin-shell>{children}</div>;
}
