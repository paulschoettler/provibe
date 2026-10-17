import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { Eyebrow } from "@/components/content/Decor";
import { JsonLd, absoluteUrl } from "@/components/content/JsonLd";
import { SiteShell } from "@/components/layout/SiteShell";
import { getBlogPost, getBlogPosts } from "@/lib/content/blog";
import { formatDateLongDe } from "@/lib/content/format";

/** Blogartikel, vorbereitet für das Blog-Modul im Backoffice. Statisch je veröffentlichtem Beitrag. */
export const revalidate = 3600;

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ slug: p.handle }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  // notFound() schon hier, damit die 404 vollständig im Server-HTML steht (nicht erst im Stream)
  if (!post) notFound();
  const path = `/blogs/news/${post.handle}`;
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: post.title,
      url: path,
      publishedTime: post.publishedAt ?? undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  const path = `/blogs/news/${post.handle}`;
  return (
    <SiteShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          author: post.authorName
            ? { "@type": "Person", name: post.authorName }
            : { "@type": "Organization", name: "provibe" },
          mainEntityOfPage: absoluteUrl(path),
          publisher: { "@type": "Organization", name: "provibe" },
        }}
      />
      <article className="pv-container pv-before-footer pt-8 lg:max-w-[760px] lg:pt-14">
        <Breadcrumbs
          items={[
            { name: "News", path: "/blogs/news" },
            { name: post.title, path },
          ]}
        />
        <Eyebrow className="mt-6">News</Eyebrow>
        <h1 className="pv-display mt-3 !text-[36px] lg:!text-[56px]">{post.title}</h1>
        <p className="text-plum mt-3 text-[14px] font-medium">
          {post.publishedAt ? (
            <time dateTime={post.publishedAt}>{formatDateLongDe(post.publishedAt)}</time>
          ) : null}
          {post.authorName ? ` · ${post.authorName}` : null}
        </p>
        <div className="pv-prose mt-8" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
      </article>
    </SiteShell>
  );
}
