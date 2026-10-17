"use server";

import { getCurrentCustomer } from "./session";

/**
 * Zustand für das Konto-Icon im Header. Der Header ist Teil statischer Seiten, deshalb holt
 * AccountMenu den Zustand nach dem Laden per Server Action (wie der Warenkorb, ADR-010).
 * Gibt nur den Vornamen heraus, keine E-Mail oder IDs.
 */
export interface AccountSummary {
  loggedIn: boolean;
  firstName: string | null;
}

export async function readAccountSummary(): Promise<AccountSummary> {
  const customer = await getCurrentCustomer();
  if (!customer) return { loggedIn: false, firstName: null };
  return { loggedIn: true, firstName: customer.firstName?.trim() || null };
}
