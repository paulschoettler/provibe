import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin/auth";

/** /admin/einstellungen führt zu den Shopdaten (erste Unterseite der Navigation). */
export default async function SettingsIndexPage() {
  await requireStaff("support", { next: "/admin/einstellungen" });
  redirect("/admin/einstellungen/shopdaten");
}
