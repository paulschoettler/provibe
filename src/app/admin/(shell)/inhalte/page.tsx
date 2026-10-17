import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin/auth";

/** /admin/inhalte führt zur ersten Unterseite (Seiten). */
export default async function InhaltePage() {
  await requireStaff("support", { next: "/admin/inhalte" });
  redirect("/admin/inhalte/seiten");
}
