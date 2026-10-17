import { InhalteNav } from "@/components/admin/content/InhalteNav";

/** Inhalte: Unternavigation links (Desktop) bzw. als Tabs (mobil), Inhalt rechts (Figma 41:13808). */
export default function InhalteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[212px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <InhalteNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
