import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { customersToCsv } from "@/lib/admin/customers/csv-export";
import { ACCOUNT_STATUS_LABEL, NEWSLETTER_STATUS_LABEL } from "@/lib/admin/customers/profile";
import { listCustomers, type CustomerListItem } from "@/lib/admin/customers/queries";
import { customerFilterFromParams } from "../filters";

/**
 * CSV-Export der Kundenliste mit den Filtern aus der URL. Nur Rollen mit Kundendaten
 * (viewCustomers), höchstens 20.000 Zeilen, jeder Export im Protokoll (Filter und Anzahl, keine Daten).
 */
const MAX_ROWS = 20_000;
const PAGE = 200;

export async function GET(request: Request) {
  const session = await requireStaff("support", { next: "/admin/kunden" });
  if (!PERMISSIONS.viewCustomers(session))
    return new Response("Keine Berechtigung", { status: 403 });
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const { filter } = customerFilterFromParams(sp);

  const rows: CustomerListItem[] = [];
  for (let page = 1; rows.length < MAX_ROWS; page++) {
    const { items, total } = await listCustomers({ ...filter, page, pageSize: PAGE });
    rows.push(...items);
    if (items.length < PAGE || rows.length >= total) break;
  }
  const csv = customersToCsv(
    rows.slice(0, MAX_ROWS).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      customerType: c.customerType,
      companyName: c.companyName,
      ordersCount: c.ordersCount,
      totalSpentCents: c.totalSpentCents,
      lastOrderAt: c.lastOrderAt,
      createdAt: c.createdAt,
      newsletterStatus: NEWSLETTER_STATUS_LABEL[c.newsletterStatus],
      tags: c.tags,
      accountStatus: ACCOUNT_STATUS_LABEL[c.accountStatus],
      acquisitionSource: c.acquisitionSource,
    })),
  );
  await writeAudit(session, {
    action: "customer.export",
    entityType: "customer",
    after: { rows: Math.min(rows.length, MAX_ROWS), filter },
  });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kunden-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
