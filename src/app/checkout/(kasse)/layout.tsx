import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";

/** Kasse: eigener reduzierter Rahmen ohne SiteShell, nie im Index (robots.txt schließt /checkout aus). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <CheckoutFrame>{children}</CheckoutFrame>;
}
