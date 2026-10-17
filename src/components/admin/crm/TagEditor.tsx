import { addTagAction, removeTagAction } from "@/lib/admin/customers/ui-actions";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Field } from "@/components/admin/ui/fields";
import { Icon } from "@/components/admin/ui/Icon";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

/**
 * Tags im Kundenprofil (Figma 29:6892: Chips mit x und "Tag hinzufügen"). Jede Änderung ist ein
 * eigenes Formular (ohne JavaScript nutzbar), Support darf Tags setzen.
 */
export function TagEditor({
  customerId,
  tags,
  suggestions,
  compact,
}: {
  customerId: string;
  tags: string[];
  suggestions: string[];
  compact?: boolean;
}) {
  const listId = `tag-vorschlaege-${customerId}`;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap items-center gap-1.5" aria-label="Tags">
        {tags.map((tag) => (
          <li key={tag}>
            <ActionForm action={removeTagAction} className="contents">
              <input type="hidden" name="customerId" value={customerId} />
              <input type="hidden" name="tag" value={tag} />
              <span className="border-admin-rahmen bg-admin-flaeche inline-flex h-8 items-center gap-1 rounded-[6px] border pr-0.5 pl-2 text-[12px] font-medium md:h-[26px]">
                {tag}
                <button
                  type="submit"
                  aria-label={`Tag ${tag} entfernen`}
                  className="hover:bg-admin-karte flex size-7 items-center justify-center rounded md:size-5"
                >
                  <Icon name="schliessen" size={12} />
                </button>
              </span>
            </ActionForm>
          </li>
        ))}
        {tags.length === 0 && !compact ? (
          <li className="text-admin-text-2 text-[13px]">Noch keine Tags.</li>
        ) : null}
      </ul>
      <ActionForm action={addTagAction} className="flex items-end gap-2">
        <input type="hidden" name="customerId" value={customerId} />
        <Field
          name="tag"
          label="Tag hinzufügen"
          hideLabel={compact}
          placeholder="Tag hinzufügen"
          maxLength={40}
          list={listId}
          className={compact ? "w-44" : "max-w-xs flex-1"}
        />
        <datalist id={listId}>
          {suggestions
            .filter((s) => !tags.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
        <SubmitButton variant="secondary" icon="plus" pendingLabel="…">
          Tag
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
