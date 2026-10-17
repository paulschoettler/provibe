"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { StatusBadge } from "@/components/admin/ui/Badge";
import { buttonClasses } from "@/components/admin/ui/Button";
import { cx } from "@/components/admin/ui/cx";
import { Icon } from "@/components/admin/ui/Icon";
import { StateCheckbox } from "./StateCheckbox";

/**
 * Produkte einer manuellen Kollektion in Reihenfolge (Feldnamen products.<i>.id, .position,
 * .remove). Mit JavaScript: Ziehen oder Pfeile, Entfernen per Button. Ohne JavaScript: Position
 * als Zahl eintragen und Entfernen ankreuzen; der Server sortiert nach der Zahl.
 */
export interface ListProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  imageUrl: string | null;
}

function noop() {
  return () => {};
}

export function ManualProductList({
  items,
  disabled,
}: {
  items: ListProduct[];
  disabled?: boolean;
}) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [order, setOrder] = useState(items);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const key = items.map((i) => i.id).join(",");

  const [syncedKey, setSyncedKey] = useState(key);
  if (key !== syncedKey) {
    setSyncedKey(key);
    setOrder(items);
  }

  // "Verwerfen" stellt den gespeicherten Stand her; nach dem Absenden bleibt die Reihenfolge
  // (React setzt das Formular nach der Action zurück, die neuen Daten kommen per key oben).
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let submitted = false;
    const onSubmit = () => {
      submitted = true;
    };
    const onReset = () => {
      if (!submitted) setOrder(itemsRef.current);
      submitted = false;
    };
    form.addEventListener("submit", onSubmit);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("reset", onReset);
    };
  }, []);

  const changed = () => ref.current?.dispatchEvent(new Event("input", { bubbles: true })); // SaveBar meldet Änderung

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setOrder(next);
    changed();
  };

  return (
    <div ref={ref}>
      <input type="hidden" name="products.present" value="1" />
      {order.length === 0 ? (
        <p className="text-admin-text-2 text-[14px]">
          Noch keine Produkte. Wähle unten Produkte aus.
        </p>
      ) : (
        <ol
          className="rounded-admin-feld border-admin-rahmen divide-admin-rahmen divide-y border"
          aria-label="Produkte in Reihenfolge"
        >
          {order.map((p, i) => (
            <li
              key={p.id}
              draggable={hydrated && !disabled}
              onDragStart={() => setDrag(p.id)}
              onDragEnd={() => {
                setDrag(null);
                setOver(null);
              }}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                setOver(p.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!drag || drag === p.id) return;
                move(
                  order.findIndex((x) => x.id === drag),
                  i,
                );
                setDrag(null);
                setOver(null);
              }}
              className={cx(
                "bg-admin-karte flex min-h-14 items-center gap-3 px-3 py-2",
                over === p.id &&
                  drag !== p.id &&
                  "shadow-[inset_0_2px_0_var(--color-admin-akzent)]",
                drag === p.id && "opacity-50",
              )}
            >
              <input type="hidden" name={`products.${i}.id`} value={p.id} />
              {hydrated ? (
                <>
                  <input type="hidden" name={`products.${i}.position`} value={String(i + 1)} />
                  <span className="text-admin-text-2 cursor-grab" aria-hidden="true">
                    <Icon name="griff" size={16} />
                  </span>
                  <span className="text-admin-text-2 w-6 text-right text-[13px] tabular-nums">
                    {i + 1}
                  </span>
                </>
              ) : (
                <label className="flex items-center gap-1.5">
                  <span className="sr-only">Position von {p.title}</span>
                  <input
                    type="number"
                    min={1}
                    name={`products.${i}.position`}
                    defaultValue={String(i + 1)}
                    disabled={disabled}
                    className="rounded-admin-feld border-admin-rahmen-stark h-11 w-16 border px-2 text-[14px] md:h-9"
                  />
                </label>
              )}
              <span className="bg-admin-flaeche rounded-admin-feld flex size-10 shrink-0 items-center justify-center overflow-hidden">
                {p.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="size-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Icon name="bild" size={16} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{p.title}</span>
                <span className="text-admin-text-2 block truncate text-[12px]">
                  /products/{p.handle}
                </span>
              </span>
              <StatusBadge kind="record" value={p.status} />
              {hydrated ? (
                <span className="flex items-center">
                  <button
                    type="button"
                    disabled={disabled || i === 0}
                    onClick={() => move(i, i - 1)}
                    aria-label={`${p.title} nach oben`}
                    className={buttonClasses("text", "sm", "text-admin-text px-1.5")}
                  >
                    <Icon name="chevron-unten" size={16} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || i === order.length - 1}
                    onClick={() => move(i, i + 1)}
                    aria-label={`${p.title} nach unten`}
                    className={buttonClasses("text", "sm", "text-admin-text px-1.5")}
                  >
                    <Icon name="chevron-unten" size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setOrder(order.filter((x) => x.id !== p.id));
                      changed();
                    }}
                    aria-label={`${p.title} aus der Kollektion entfernen`}
                    className={buttonClasses("text", "sm", "text-admin-rot px-1.5")}
                  >
                    <Icon name="schliessen" size={16} />
                  </button>
                </span>
              ) : (
                <StateCheckbox
                  name={`products.${i}.remove`}
                  label="Entfernen"
                  disabled={disabled}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
