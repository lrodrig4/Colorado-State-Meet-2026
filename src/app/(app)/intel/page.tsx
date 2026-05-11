import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Camera,
  Flame,
  Newspaper,
  Trophy,
} from "lucide-react";
import { AppPanel, AppPanelHeader } from "@/components/AppPrimitives";
import { PageHeader } from "@/components/PageHeader";
import { PointMixTrackSvg, StateMeetBlueprintSvg } from "@/components/CoachVisuals";
import { featuredIntelPosts } from "@/lib/content/intel";

const launchCalendar = [
  "Track state-week command center now",
  "XC preseason class-by-class team watchlists next",
  "Weekly Colorado XC power ranking with course-context notes",
  "Coach scouting briefs before regionals and state",
];

const mediaInventory = [
  "Weekly ranking cards",
  "State qualifier graphics",
  "Team score swing charts",
  "Race preview photo blocks",
];

export default function IntelPage() {
  const posts = featuredIntelPosts(4);

  return (
    <div>
      <PageHeader
        title="Distance Intel"
        description="Public rankings context, race previews, coach-grade analysis, and enough personality for distance runners to share it."
        actions={
          <Link
            href="/coach-pro"
            className="coach-action app-button-navy inline-flex h-10 items-center gap-2 px-4 text-sm"
          >
            Coach Pro
            <ArrowRight size={15} />
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <AppPanel className="p-4 sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr] xl:items-center">
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#08233f] text-white">
                <Newspaper size={18} />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal text-slate-950">
                MileSplit shows what happened. This explains what it means.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The public feed turns rankings, cutlines, scoring paths, and
                local distance culture into articles coaches trust and runners
                actually open.
              </p>
            </div>
            <StateMeetBlueprintSvg className="min-h-[14rem] w-full rounded-lg border border-[#d8e2ea] bg-white" />
          </div>
        </AppPanel>

        <AppPanel className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="coach-kicker">Roadmap</div>
              <h2 className="mt-1 text-base font-semibold text-slate-950">
                Track now, XC next
              </h2>
            </div>
            <Trophy size={20} className="text-[#d4951f]" />
          </div>
          <ol className="mt-4 space-y-3">
            {launchCalendar.map((item, index) => (
              <li
                key={item}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-lg border border-[#d8e2ea] bg-[#f8fafc] p-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-sm font-semibold tabular-nums text-[#08233f]">
                  {index + 1}
                </span>
                <span className="text-sm leading-5 text-slate-700">{item}</span>
              </li>
            ))}
          </ol>
        </AppPanel>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/intel/${post.slug}`}
            className="tap-row coach-surface group rounded-lg p-4 transition hover:border-[#9fb0bf] hover:bg-[#f8fafc]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="coach-kicker">{post.lane}</div>
              <span className="text-xs font-semibold text-slate-500">
                {post.readTime}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-normal text-slate-950 group-hover:text-[#2f6f5e]">
              {post.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{post.deck}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0f6f50]">
              Read intel
              <ArrowRight size={15} />
            </div>
          </Link>
        ))}
      </section>

      <AppPanel className="mt-5">
        <AppPanelHeader
          label="Media layer"
          title="Photos, graphics, and sharp charts become the distribution engine"
          description="The command center already makes coach-useful calculations. The public feed repackages those calculations into shareable images, short previews, and columns that send coaches back to the paid workflow."
        />
        <div className="grid gap-4 p-4 md:grid-cols-[0.7fr_1.3fr] md:items-center">
          <PointMixTrackSvg relayPct={42} className="mx-auto w-full max-w-[18rem]" />
          <div className="grid gap-3 sm:grid-cols-2">
            {mediaInventory.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border border-[#d8e2ea] bg-[#f8fafc] p-3 text-sm font-semibold text-slate-800"
              >
                {item.includes("chart") ? (
                  <BarChart3 size={17} className="text-[#16324f]" />
                ) : item.includes("Runtism") ? (
                  <Flame size={17} className="text-[#16324f]" />
                ) : (
                  <Camera size={17} className="text-[#16324f]" />
                )}
                {item}
              </div>
            ))}
          </div>
        </div>
      </AppPanel>
    </div>
  );
}
