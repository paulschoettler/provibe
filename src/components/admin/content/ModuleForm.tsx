import { saveModuleAction } from "@/lib/admin/content/layout-actions";
import type { HomepageModuleView } from "@/lib/admin/content/homepage";
import {
  fieldValue,
  getPath,
  MODULE_FIELDS,
  type ModuleField,
} from "@/lib/admin/content/module-fields";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Checkbox, Field, Switch, Textarea } from "@/components/admin/ui/fields";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { ImageField } from "./ImageField";
import { Hint } from "./parts";

function Input({
  field,
  name,
  value,
  disabled,
}: {
  field: ModuleField;
  name: string;
  value: string;
  disabled: boolean;
}) {
  if (field.type === "textarea" || field.type === "lines")
    return (
      <Textarea
        name={name}
        label={field.label}
        hint={field.hint}
        defaultValue={value}
        rows={field.type === "lines" ? 4 : 3}
        maxLength={field.type === "textarea" ? field.max : undefined}
      />
    );
  if (field.type === "image")
    return <ImageField name={name} label={field.label} defaultValue={value} disabled={disabled} />;
  return (
    <Field
      name={name}
      label={field.label}
      hint={field.hint}
      defaultValue={value}
      maxLength={field.max}
      placeholder={field.type === "link" ? "/collections/all" : undefined}
    />
  );
}

/**
 * Formular eines Startseiten-Moduls (Figma 41:2481): Schalter, Texte, Links, Bilder und
 * Listeneinträge. Unbekannte Felder der Konfiguration bleiben beim Speichern erhalten.
 */
export function ModuleForm({ mod, canEdit }: { mod: HomepageModuleView; canEdit: boolean }) {
  const spec = MODULE_FIELDS[mod.kind];
  const formId = `modul-${mod.id}`;
  const items = spec?.repeat
    ? (Array.isArray(getPath(mod.config, spec.repeat.path))
        ? (getPath(mod.config, spec.repeat.path) as unknown[])
        : []
      ).slice(0, spec.repeat.max)
    : [];
  const slots = spec?.repeat ? Math.min(items.length + 1, spec.repeat.max) : 0;

  return (
    <ActionForm id={formId} action={saveModuleAction} resetOnSuccess={false}>
      <input type="hidden" name="id" value={mod.id} />
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <Switch
          name="isEnabled"
          label="Auf der Startseite zeigen"
          description="Ausgeblendete Module bleiben gespeichert."
          defaultChecked={mod.isEnabled}
        />
        {spec ? (
          spec.fields.map((f) => (
            <Input
              key={f.path}
              field={f}
              name={`cfg.${f.path}`}
              value={fieldValue(mod.config, f)}
              disabled={!canEdit}
            />
          ))
        ) : (
          <Hint tone="info">
            Für diese Modulart gibt es noch kein Formular. Die Konfiguration bleibt unverändert.
          </Hint>
        )}
        {spec?.repeat
          ? Array.from({ length: slots }, (_, i) => {
              const item = items[i];
              const isNew = i >= items.length;
              return (
                <fieldset
                  key={i}
                  className="rounded-admin-feld border-admin-rahmen flex flex-col gap-3 border p-3"
                >
                  <legend className="px-1 text-[13px] font-semibold">
                    {isNew
                      ? `${spec.repeat!.itemLabel} hinzufügen`
                      : `${spec.repeat!.itemLabel} ${i + 1}`}
                  </legend>
                  {spec.repeat!.fields.map((f) => (
                    <Input
                      key={f.path}
                      field={f}
                      name={`cfg.${spec.repeat!.path}.${i}.${f.path}`}
                      value={fieldValue(item, f)}
                      disabled={!canEdit}
                    />
                  ))}
                  {!isNew ? (
                    <Checkbox
                      name={`cfg.${spec.repeat!.path}.${i}._remove`}
                      label={`${spec.repeat!.itemLabel} entfernen`}
                    />
                  ) : null}
                </fieldset>
              );
            })
          : null}
        {canEdit ? (
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Wird gespeichert …">Speichern</SubmitButton>
          </div>
        ) : null}
      </fieldset>
    </ActionForm>
  );
}
