"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useActionFormState } from "@/components/admin/ui/ActionForm";
import { Button, buttonClasses } from "@/components/admin/ui/Button";
import { cx } from "@/components/admin/ui/cx";
import { Field } from "@/components/admin/ui/fields";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Icon } from "@/components/admin/ui/Icon";
import {
  createImageUploadUrlAction,
  finalizeImageUploadAction,
  reorderImagesAction,
} from "@/lib/admin/products/actions";

/**
 * Bilder im Produkt-Editor (Figma 40:13025, Karte Bilder): erstes Bild ist das Hauptbild,
 * Reihenfolge per Ziehen oder mit den Pfeil-Buttons, Alt-Text je Bild (Pflicht, wird mit dem
 * Produkt gespeichert), Hochladen mit Vorschau, Löschen.
 *
 * Ohne JavaScript: Pfeile, Hauptbild und Löschen senden das eigene Formular "opFormId", der
 * Upload das Formular "uploadFormId" (bis 2 MB). Mit JavaScript lädt der Browser direkt per
 * signierter URL in den Bucket (bis 10 MB), der Server prüft danach Typ, Größe und Abmessungen.
 */
function noop() {
  return () => {};
}

export interface ManagedImage {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export function ImageManager({
  productId,
  images,
  canEdit,
  opFormId,
  uploadFormId,
  productTitle,
}: {
  productId: string;
  images: ManagedImage[];
  canEdit: boolean;
  opFormId: string;
  uploadFormId: string;
  productTitle: string;
}) {
  const router = useRouter();
  const state = useActionFormState();
  const [order, setOrder] = useState(images.map((i) => i.id));
  const [selected, setSelected] = useState(images[0]?.id ?? null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);

  // Serverstand übernehmen (nach Upload, Löschen, Reihenfolge)
  const key = images.map((i) => i.id).join(",");
  const [syncedKey, setSyncedKey] = useState(key);
  if (key !== syncedKey) {
    setSyncedKey(key);
    setOrder(images.map((i) => i.id));
    setSelected((s) => (s && images.some((i) => i.id === s) ? s : (images[0]?.id ?? null)));
  }

  const byId = new Map(images.map((i) => [i.id, i]));
  const list = order.map((id) => byId.get(id)).filter((x): x is ManagedImage => !!x);

  const commitOrder = (next: string[]) => {
    setOrder(next);
    start(async () => {
      const r = await reorderImagesAction(productId, next);
      setMessage(
        r.ok
          ? { tone: "success", text: "Reihenfolge gespeichert." }
          : { tone: "error", text: r.message ?? "Fehler." },
      );
      router.refresh();
    });
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((id) => id !== dragId);
    next.splice(next.indexOf(targetId), 0, dragId);
    setDragId(null);
    setOverId(null);
    commitOrder(next);
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    const alt = altRef.current?.value.trim() ?? "";
    if (!file) return setMessage({ tone: "error", text: "Bitte wähle eine Bilddatei aus." });
    if (!alt) {
      altRef.current?.focus();
      return setMessage({ tone: "error", text: "Bitte gib zuerst einen Alt-Text ein." });
    }
    setMessage(null);
    start(async () => {
      const url = await createImageUploadUrlAction(productId, {
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      });
      if (!url.ok) return setMessage({ tone: "error", text: url.message });
      const put = await fetch(url.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "false" },
        body: file,
      }).catch(() => null);
      if (!put?.ok)
        return setMessage({
          tone: "error",
          text: "Der Upload ist fehlgeschlagen. Bitte versuche es noch einmal.",
        });
      const done = await finalizeImageUploadAction(productId, url.path, alt);
      setMessage({ tone: done.ok ? "success" : "error", text: done.message });
      if (done.ok) {
        if (fileRef.current) fileRef.current.value = "";
        if (altRef.current) altRef.current.value = "";
        setPreview(null);
        router.refresh();
      }
    });
  };

  const current = list.find((i) => i.id === selected) ?? list[0];

  return (
    <div className="flex flex-col gap-4">
      {message ? (
        <FormMessage tone={message.tone} className="mb-0">
          {message.text}
        </FormMessage>
      ) : null}
      {list.length === 0 ? (
        <p className="text-admin-text-2 text-[14px]">
          Noch keine Bilder. Lade das erste Bild hoch, es wird zum Hauptbild.
        </p>
      ) : (
        <ol
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          aria-label="Bilder in Reihenfolge"
        >
          {list.map((img, i) => (
            <li
              key={img.id}
              draggable={hydrated && canEdit}
              onDragStart={() => setDragId(img.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(img.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(img.id);
              }}
              className={cx(
                "rounded-admin-karte bg-admin-flaeche relative flex flex-col overflow-hidden border-2",
                current?.id === img.id ? "border-admin-akzent" : "border-transparent",
                overId === img.id && dragId !== img.id && "ring-admin-akzent ring-2 ring-offset-2",
                pending && "opacity-70",
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(img.id)}
                className="relative block aspect-square w-full"
                aria-label={`Bild ${i + 1} auswählen, Alt-Text bearbeiten`}
                aria-pressed={current?.id === img.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt}
                  className="size-full object-contain p-2"
                  loading="lazy"
                />
                <span
                  className={cx(
                    "absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-[12px] font-bold",
                    i === 0 ? "bg-admin-akzent text-admin-auf-akzent" : "bg-admin-karte",
                  )}
                >
                  {i + 1}
                </span>
                {i === 0 ? (
                  <span className="bg-admin-akzent text-admin-auf-akzent absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-bold">
                    Hauptbild
                  </span>
                ) : null}
                {canEdit && hydrated ? (
                  <span
                    className="bg-admin-karte absolute top-2 left-2 flex size-6 cursor-grab items-center justify-center rounded-md"
                    aria-hidden="true"
                  >
                    <Icon name="griff" size={14} />
                  </span>
                ) : null}
              </button>
              {canEdit ? (
                <div className="grid grid-cols-4 items-center p-1">
                  <button
                    type="submit"
                    form={opFormId}
                    name="op"
                    value={`up:${img.id}`}
                    disabled={i === 0}
                    aria-label={`Bild ${i + 1} nach vorn`}
                    title="Nach vorn"
                    className={buttonClasses("text", "sm", "text-admin-text px-0")}
                  >
                    <Icon name="chevron-links" size={16} />
                  </button>
                  <button
                    type="submit"
                    form={opFormId}
                    name="op"
                    value={`down:${img.id}`}
                    disabled={i === list.length - 1}
                    aria-label={`Bild ${i + 1} nach hinten`}
                    title="Nach hinten"
                    className={buttonClasses("text", "sm", "text-admin-text px-0")}
                  >
                    <Icon name="chevron-rechts" size={16} />
                  </button>
                  <button
                    type="submit"
                    form={opFormId}
                    name="op"
                    value={`main:${img.id}`}
                    disabled={i === 0}
                    aria-label={`Bild ${i + 1} als Hauptbild`}
                    title="Als Hauptbild"
                    className={buttonClasses("text", "sm", "text-admin-text px-0")}
                  >
                    <Icon name="haken" size={16} />
                  </button>
                  <button
                    type="submit"
                    form={opFormId}
                    name="op"
                    value={`delete:${img.id}`}
                    aria-label={`Bild ${i + 1} löschen`}
                    title="Löschen"
                    onClick={(e) => {
                      if (
                        !window.confirm(
                          "Bild wirklich löschen? Das lässt sich nicht rückgängig machen.",
                        )
                      )
                        e.preventDefault();
                    }}
                    className={buttonClasses("text", "sm", "text-admin-rot px-0")}
                  >
                    <Icon name="schliessen" size={16} />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {/* Alt-Texte: alle im Formular, sichtbar ist der des ausgewählten Bilds (ohne JS alle) */}
      {list.map((img, i) => {
        const name = `images.${img.id}.alt`;
        const err = state.fieldErrors?.[name];
        const visible = !hydrated || current?.id === img.id || Boolean(err);
        return (
          <div key={img.id} className={visible ? "" : "hidden"}>
            <input type="hidden" name={`images.${img.id}.altOriginal`} value={img.alt} />
            <Field
              name={name}
              label={`Alt-Text für Bild ${i + 1}`}
              defaultValue={img.alt}
              required
              disabled={!canEdit}
              maxLength={250}
              hint="Beschreibe, was auf dem Bild zu sehen ist. Wichtig für Screenreader und Suchmaschinen."
            />
          </div>
        );
      })}

      {canEdit ? (
        <div className="rounded-admin-feld border-admin-rahmen-stark flex flex-col gap-3 border border-dashed p-3">
          <p className="text-[14px] font-bold">Bild hochladen</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[13px] font-medium">Alt-Text für das neue Bild *</span>
              <input
                ref={altRef}
                form={uploadFormId}
                name="alt"
                maxLength={250}
                placeholder={`${productTitle}, Dose 0,33 l, Vorderansicht`}
                className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte focus-visible:border-admin-akzent h-11 w-full border px-3 text-[14px] focus-visible:border-2 focus-visible:outline-none md:h-10"
              />
            </label>
            <label className={buttonClasses("secondary", "md", "cursor-pointer")}>
              <Icon name="upload" size={16} />
              Datei wählen
              <input
                ref={fileRef}
                form={uploadFormId}
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  setPreview(f ? URL.createObjectURL(f) : null);
                }}
              />
            </label>
          </div>
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview}
              alt="Vorschau des gewählten Bilds"
              className="rounded-admin-feld bg-admin-flaeche size-28 object-contain"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              form={uploadFormId}
              variant="primary"
              icon="upload"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void upload();
              }}
            >
              {pending ? "Wird hochgeladen …" : "Hochladen"}
            </Button>
            <span className="text-admin-text-2 text-[12px]">
              JPEG, PNG, WebP oder AVIF, mindestens 200 Pixel, höchstens 10 MB
              {hydrated ? "" : " (ohne JavaScript 2 MB)"}. Gespeichert wird nur das Original, Größen
              und Formate erzeugt das Bild-CDN.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
