import type { Metadata } from "next";
import Image from "next/image";
import { Eyebrow, WaveCut } from "@/components/content/Decor";
import { SiteLink } from "@/components/layout/SiteLink";
import { SiteShell } from "@/components/layout/SiteShell";
import { getBlogPosts } from "@/lib/content/blog";
import { formatDateLongDe } from "@/lib/content/format";
import { publicEnv } from "@/lib/env/public";

/**
 * Blog "News" (F4): Route bleibt erhalten. Ohne veröffentlichte Beiträge zeigt die Seite einen
 * Hinweis und ist noindex; ab dem ersten Beitrag wird sie indexierbar (Revalidation stündlich
 * oder per revalidateBlog()).
 */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const posts = await getBlogPosts();
  return {
    title: "News",
    description:
      "Neuigkeiten von provibe: Sorten, Hintergründe und alles rund um Eistee mit Protein.",
    alternates: { canonical: "/blogs/news" },
    robots: posts.length === 0 ? { index: false, follow: true } : undefined,
  };
}

function coverUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("/") || path.startsWith("http")) return path;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${path}`;
}

export default async function BlogIndexPage() {
  const posts = await getBlogPosts();
  return (
    <SiteShell>
      <section
        className="pv-hero-grad pv-hero-grad--soft pt-10 pb-16 lg:pt-16 lg:pb-24"
        aria-labelledby="news-titel"
      >
        <div className="pv-container flex flex-col gap-3">
          <Eyebrow>Magazin</Eyebrow>
          <h1 id="news-titel" className="pv-display">
            News
          </h1>
          <p className="pv-lead max-w-[560px]">
            Neues von provibe, sobald es etwas zu erzählen gibt.
          </p>
        </div>
      </section>
      <WaveCut />
      <div className="pv-container pv-before-footer pt-6">
        {posts.length === 0 ? (
          <div className="pv-card-soft flex max-w-[640px] flex-col gap-3 px-6 py-8">
            <h2 className="pv-h2 !text-[24px]">Hier entsteht gerade etwas.</h2>
            <p className="pv-body !text-[16px]">
              Noch gibt es keine Beiträge. Bis dahin findest du alles über provibe auf unserer
              Story-Seite und im Shop.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <SiteLink href="/pages/uber-uns" className="pv-btn-secondary">
                Unsere Story
              </SiteLink>
              <SiteLink href="/pages/shop" className="pv-btn-primary">
                Zum Shop
              </SiteLink>
            </div>
          </div>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const cover = coverUrl(post.coverImagePath);
              return (
                <li key={post.id}>
                  <article className="pv-flavor-card h-full">
                    {cover ? (
                      <Image
                        src={cover}
                        alt=""
                        width={800}
                        height={500}
                        sizes="(min-width: 1024px) 380px, 100vw"
                        className="aspect-[8/5] w-full object-cover"
                      />
                    ) : null}
                    <div className="pv-flavor-card-body">
                      {post.publishedAt ? (
                        <time
                          dateTime={post.publishedAt}
                          className="text-plum text-[13px] font-medium"
                        >
                          {formatDateLongDe(post.publishedAt)}
                        </time>
                      ) : null}
                      <h2 className="text-wine m-0 text-[21px] leading-[1.25] font-semibold">
                        <SiteLink href={`/blogs/news/${post.handle}`} className="hover:underline">
                          {post.title}
                        </SiteLink>
                      </h2>
                      {post.excerpt ? <p className="pv-body !text-[15px]">{post.excerpt}</p> : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}
