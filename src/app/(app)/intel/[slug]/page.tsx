import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Newspaper, ShieldCheck } from "lucide-react";
import { AppPanel } from "@/components/AppPrimitives";
import { PageHeader } from "@/components/PageHeader";
import { getIntelPostBySlug, intelPosts } from "@/lib/content/intel";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00-06:00`));
}

export function generateStaticParams() {
  return intelPosts.map((post) => ({ slug: post.slug }));
}

export default async function IntelPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getIntelPostBySlug(slug);

  if (!post) notFound();

  return (
    <div>
      <PageHeader
        title={post.title}
        description={post.deck}
        actions={
          <Link
            href="/intel"
            className="coach-action app-button-secondary inline-flex h-10 items-center gap-2 px-4 text-sm"
          >
            <ArrowLeft size={15} />
            Intel feed
          </Link>
        }
      />

      <article className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <AppPanel className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
            <span className="rounded-md bg-[#eef4f2] px-2 py-1 text-[#0f6f50]">
              {post.lane}
            </span>
            <span>{formatDate(post.publishedAt)}</span>
            <span>{post.readTime}</span>
            <span>{post.author}</span>
          </div>
          <div className="mt-6 space-y-6">
            {post.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold tracking-normal text-slate-950">
                  {section.heading}
                </h2>
                <p className="mt-2 text-base leading-8 text-slate-700">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </AppPanel>

        <aside className="space-y-4">
          <AppPanel className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ShieldCheck size={17} className="text-[#0f6f50]" />
              Source trail
            </div>
            <ul className="mt-3 space-y-2">
              {post.sourceTrail.map((source) => (
                <li key={source} className="text-sm leading-5 text-slate-600">
                  {source}
                </li>
              ))}
            </ul>
            <Link
              href={post.relatedHref}
              className="coach-action app-button-secondary mt-4 inline-flex h-10 items-center gap-2 px-4 text-sm"
            >
              {post.relatedLabel}
              <ArrowRight size={15} />
            </Link>
          </AppPanel>

          <AppPanel className="p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#08233f] text-white">
              <Newspaper size={18} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-950">
              Turn this into a coach workflow
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Public analysis should point coaches back to the private command
              center where they can save a team, scout events, and test scores.
            </p>
            <Link
              href="/coach-pro"
              className="coach-action app-button-navy mt-4 inline-flex h-10 items-center gap-2 px-4 text-sm"
            >
              Coach Pro
              <ArrowRight size={15} />
            </Link>
          </AppPanel>
        </aside>
      </article>
    </div>
  );
}
