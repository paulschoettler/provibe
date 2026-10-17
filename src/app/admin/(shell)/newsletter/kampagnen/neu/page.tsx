import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { createCampaignAction } from "@/lib/admin/newsletter/ui-actions";
import { listSegments } from "@/lib/admin/segments/segments";
import { NoAccess } from "@/components/admin/NoAccess";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Card } from "@/components/admin/ui/Card";
import { Field, Select } from "@/components/admin/ui/fields";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

export const metadata: Metadata = { title: "Neue Kampagne" };

/** /admin/newsletter/kampagnen/neu: Entwurf anlegen, danach weiter im Block-Editor. */
export default async function NeueKampagnePage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const session = await requireStaff("support", { next: "/admin/newsletter/kampagnen/neu" });
  if (!PERMISSIONS.sendNewsletter(session))
    return <NoAccess text="Kampagnen anlegen dürfen Owner und Admin." />;
  const segments = await listSegments().catch(() => []);
  const { segment } = await searchParams;
  const preset = segments.some((s) => s.id === segment) ? segment : "";
  return (
    <>
      <PageHeader title="Neue Kampagne" backHref="/admin/newsletter" backLabel="Newsletter" />
      <Card className="max-w-2xl">
        <ActionForm action={createCampaignAction} className="flex flex-col gap-4">
          <Field
            name="name"
            label="Interner Name"
            placeholder="zum Beispiel Peach ist zurück"
            required
            maxLength={120}
          />
          <Field name="subject" label="Betreff" required maxLength={150} />
          <Field
            name="preheader"
            label="Vorschautext"
            hint="Erscheint im Postfach neben dem Betreff"
            maxLength={200}
          />
          <Select
            name="segmentId"
            label="Zielgruppe"
            defaultValue={preset}
            options={[
              { value: "", label: "Alle mit Einwilligung" },
              ...segments.map((s) => ({ value: s.id, label: `Segment: ${s.name}` })),
            ]}
            hint="Versand nur an Kontakte mit bestätigter Einwilligung; im Segment ohne Opt-in wird übersprungen."
          />
          <div>
            <SubmitButton pendingLabel="Wird angelegt …">
              Entwurf anlegen und gestalten
            </SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
