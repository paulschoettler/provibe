import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin/auth";

/** /admin/einstellungen führt zur ersten fertigen Unterseite (Welle 2 kann auf Shopdaten umstellen). */
export default async function SettingsIndexPage() {
  await requireStaff("support", { next: "/admin/einstellungen" });
  redirect("/admin/einstellungen/benutzer");
}
