"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountIcon } from "@/components/layout/icons";
import { readAccountSummary, type AccountSummary } from "@/lib/auth/summary";

/**
 * Konto-Eintrag im Header: "Anmelden" oder der Vorname. Der Header ist Teil statischer Seiten,
 * deshalb steht im Server-HTML immer der Link mit "Anmelden"; nach dem Laden fragt die
 * Komponente den Zustand per Server Action ab (gleiches Muster wie der Warenkorb, ADR-010).
 * Nebeneffekt: Die Server Action darf Cookies schreiben und frischt so die Session auf.
 */
export function AccountMenu({ className = "pv-header-icon" }: { className?: string }) {
  const [summary, setSummary] = useState<AccountSummary>({ loggedIn: false, firstName: null });

  useEffect(() => {
    let active = true;
    readAccountSummary()
      .then((s) => {
        if (active) setSummary(s);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const label = summary.loggedIn ? (summary.firstName ?? "Konto") : "Anmelden";
  const aria = summary.loggedIn
    ? `Dein Konto${summary.firstName ? `, angemeldet als ${summary.firstName}` : ""}`
    : "Anmelden";

  return (
    <Link
      href={summary.loggedIn ? "/account" : "/account/login"}
      className={`${className} pv-acc-menu`}
      aria-label={aria}
    >
      <AccountIcon className="h-6 w-6" />
      <span className="pv-acc-menu__label" aria-hidden="true">
        {label}
      </span>
    </Link>
  );
}

export default AccountMenu;
