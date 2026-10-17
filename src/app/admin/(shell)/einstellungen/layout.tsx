import { SettingsNav } from "@/components/admin/shell/SettingsNav";

/** Einstellungen: Unternavigation links (Desktop) bzw. als Tabs (mobil), Inhalt rechts. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[212px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <SettingsNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
