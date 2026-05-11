import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Gauge,
  Image as ImageIcon,
  Medal,
  Newspaper,
  SlidersHorizontal,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { TeamMascotMark } from "@/components/TeamMascotMark";
import { getEventDefinition } from "@/lib/data/events";
import {
  getLatestVerifiedMeetDateForClassification,
  getVirtualMeetForClassification,
} from "@/lib/services/appData";
import {
  getHomeBestRankingPathForTeam,
  getHomeSchoolOptionsForClassification,
} from "@/lib/services/homeData";
import { resolveClassification } from "@/lib/utils/classificationScope";
import {
  DEFAULT_FOCUS_TEAM,
  decodeFocusTeamCookie,
  focusTeamCookieName,
  focusTeamHref,
  resolveFocusTeam,
} from "@/lib/utils/focusTeam";
import { rankingPath } from "@/lib/utils/rankingRoutes";
import type {
  Classification,
  VirtualMeetEntry,
  VirtualStateMeet,
} from "@/types/domain";

const SCORING = [10, 8, 7, 6, 5, 4, 3, 2, 1];

type CommandAction = {
  icon: LucideIcon;
  step: string;
  title: string;
  copy: string;
  href: string;
};

type HomeActionRow = {
  id: string;
  athleteName: string;
  eventTitle: string;
  seed: number;
  markRaw: string;
  currentPlace: number;
  currentPoints: number;
  targetPlace: number;
  targetPoints: number;
  pointGain: number;
  href: string;
  priorityScore: number;
};

type HomeNextAction = {
  id: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  tone: "gain" | "hold";
};

function formatMeetDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00-06:00`));
}

function pointsForPlace(place: number | undefined) {
  if (!place) return 0;
  return SCORING[place - 1] ?? 0;
}

function rangeWidth(place: number) {
  return place <= 3 ? 1 : place <= 9 ? 2 : place <= 13 ? 4 : 5;
}

function targetPlaceForEntry(entry: VirtualMeetEntry) {
  const place = entry.projectedPlace ?? entry.seed;
  const highPlace = Math.max(1, place - rangeWidth(place));

  if (place <= 9) return highPlace;
  if (highPlace <= 9) return highPlace;

  return place <= 13 ? 9 : highPlace;
}

function buildHomeNextActions(
  virtualMeet: VirtualStateMeet,
  focusTeam: string,
  classification: Classification,
): HomeNextAction[] {
  const rows = virtualMeet.events
    .flatMap((event) => {
      const definition = getEventDefinition(event.event);
      const eventTitle = `${event.gender} ${definition.displayName}`;

      return event.entries
        .filter((entry) => entry.school === focusTeam)
        .map((entry): HomeActionRow | undefined => {
          const currentPlace = entry.projectedPlace ?? entry.seed;
          const currentPoints = pointsForPlace(currentPlace);
          const targetPlace = targetPlaceForEntry(entry);
          const targetPoints = pointsForPlace(targetPlace);
          const pointGain = Math.max(0, targetPoints - currentPoints);

          if (currentPoints === 0 && targetPoints === 0) {
            return undefined;
          }

          return {
            id: entry.id,
            athleteName: entry.athleteName,
            eventTitle,
            seed: entry.seed,
            markRaw: entry.markRaw,
            currentPlace,
            currentPoints,
            targetPlace,
            targetPoints,
            pointGain,
            href: focusTeamHref(
              rankingPath(event.gender, definition.slug),
              focusTeam,
              classification,
            ),
            priorityScore:
              pointGain * 20 +
              targetPoints * 6 +
              currentPoints * 4 +
              Math.max(0, 18 - entry.seed),
          };
        });
    })
    .filter((row): row is HomeActionRow => Boolean(row));

  const topGain = rows
    .filter((row) => row.pointGain > 0)
    .sort(
      (a, b) =>
        b.pointGain - a.pointGain ||
        b.priorityScore - a.priorityScore ||
        a.eventTitle.localeCompare(b.eventTitle),
    )[0];
  const topHold = rows
    .filter((row) => row.currentPoints > 0 && row.id !== topGain?.id)
    .sort(
      (a, b) =>
        b.currentPoints - a.currentPoints ||
        a.currentPlace - b.currentPlace ||
        a.eventTitle.localeCompare(b.eventTitle),
    )[0];
  const actions: HomeNextAction[] = [];

  if (topGain) {
    actions.push({
      id: `gain-${topGain.id}`,
      label: `Chase +${topGain.pointGain}`,
      title: topGain.athleteName,
      detail: `${topGain.eventTitle}: needs top ${topGain.targetPlace}. Seed #${topGain.seed}, ${topGain.markRaw}.`,
      href: topGain.href,
      tone: "gain",
    });
  }

  if (topHold) {
    actions.push({
      id: `hold-${topHold.id}`,
      label: `Protect ${topHold.currentPoints}`,
      title: topHold.athleteName,
      detail: `${topHold.eventTitle}: hold top ${topHold.currentPlace}. Seed #${topHold.seed}, ${topHold.markRaw}.`,
      href: topHold.href,
      tone: "hold",
    });
  }

  return actions;
}

function CommandLink({ action }: { action: CommandAction }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      prefetch={false}
      className="tap-row group flex min-h-[10.5rem] flex-col gap-4 border-t border-[#d8e2ea] bg-white p-4 transition hover:bg-[#f8fbfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] focus-visible:ring-inset sm:p-5 lg:border-l lg:border-t-0"
    >
      <div className="flex items-start gap-4">
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#d8e2ea] bg-white text-[#08233f] shadow-sm">
          <Icon size={23} strokeWidth={2.1} />
          <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#3f7666] text-sm font-semibold text-white ring-2 ring-white">
            {action.step}
          </span>
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.35rem] font-semibold leading-tight tracking-normal text-slate-950 sm:text-2xl">
            {action.title}
          </h2>
          <p className="mt-2 text-base leading-6 text-slate-600">
            {action.copy}
          </p>
        </div>
      </div>
      <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-[#0f6f50] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
        Open <ArrowRight size={16} />
      </span>
    </Link>
  );
}

function HomeNextActions({
  actions,
  rankingsHref,
  scoringHref,
  latestMeetLabel,
}: {
  actions: HomeNextAction[];
  rankingsHref: string;
  scoringHref: string;
  latestMeetLabel: string;
}) {
  const toneClasses = {
    gain: "border-emerald-200 bg-white text-emerald-950",
    hold: "border-amber-200 bg-white text-amber-950",
  };
  const labelClasses = {
    gain: "text-emerald-700",
    hold: "text-amber-800",
  };

  return (
    <div className="mt-5 rounded-lg border border-[#d8e2ea] bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Gauge size={16} className="text-[#16324f]" />
          Next actions
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Verified {latestMeetLabel}
        </div>
      </div>
      {actions.length ? (
        <div className="mt-3 grid gap-2">
          {actions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              prefetch={false}
              className={`tap-row rounded-lg border p-3 transition hover:border-[#0f8a5f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] ${toneClasses[action.tone]}`}
            >
              <div
                className={`text-[11px] font-semibold uppercase tracking-normal ${labelClasses[action.tone]}`}
              >
                {action.label}
              </div>
              <div className="mt-1 break-words text-sm font-semibold leading-5">
                {action.title}
              </div>
              <div className="mt-1 break-words text-xs leading-5 text-slate-600">
                {action.detail}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-5 text-slate-600">
          No projected scoring action yet. Start with the full state list.
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={rankingsHref}
          prefetch={false}
          className="tap-row inline-flex min-h-10 items-center justify-center rounded-md border border-[#cbd8e3] bg-[#08233f] px-3 text-center text-xs font-semibold text-white transition hover:bg-[#102f4f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
        >
          Rankings
        </Link>
        <Link
          href={scoringHref}
          prefetch={false}
          className="tap-row inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-center text-xs font-semibold text-slate-700 transition hover:border-[#0f8a5f] hover:text-[#0f6f50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f]"
        >
          What-if
        </Link>
      </div>
    </div>
  );
}

function CoachCommandCard({
  focusTeam,
  classification,
  schoolOptions,
  primaryRankingHref,
  scoringHref,
  nextActions,
  latestMeetLabel,
}: {
  focusTeam: string;
  classification: Classification;
  schoolOptions: string[];
  primaryRankingHref: string;
  scoringHref: string;
  nextActions: HomeNextAction[];
  latestMeetLabel: string;
}) {
  const actions: CommandAction[] = [
    {
      icon: Medal,
      step: "1",
      title: "Final 18 rankings",
      copy: "Open every state event field, cutline, bubble, and scratch-watch read.",
      href: primaryRankingHref,
    },
    {
      icon: Trophy,
      step: "2",
      title: "State scenarios",
      copy: "Edit finishes and ranges to test the team score path event by event.",
      href: scoringHref,
    },
    {
      icon: ImageIcon,
      step: "3",
      title: "Top 4 graphics",
      copy: "Generate combined event ranking images from each school's best four marks.",
      href: focusTeamHref("/event-squads", focusTeam, classification),
    },
  ];

  return (
    <section className="coach-surface grid overflow-hidden lg:grid-cols-[minmax(22rem,0.95fr)_repeat(3,minmax(0,1fr))]">
      <div className="bg-[#f5f8fb] p-4 sm:p-5">
        <TeamMascotMark
          schoolName={focusTeam}
          classification={classification}
        />
        <p className="mt-5 text-base leading-7 text-slate-600">
          State is this week, so start with projected points, reachable team
          places, and exact finish targets.
        </p>
        <div className="mt-5 grid gap-2">
          <ClassificationSelector currentClassification={classification} />
          <FocusTeamSelector
            schools={schoolOptions}
            currentTeam={focusTeam}
            classification={classification}
            label="Team"
          />
        </div>
        <HomeNextActions
          actions={nextActions}
          rankingsHref={primaryRankingHref}
          scoringHref={scoringHref}
          latestMeetLabel={latestMeetLabel}
        />
      </div>

      {actions.map((action) => (
        <CommandLink key={action.title} action={action} />
      ))}
    </section>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const classification = resolveClassification(resolvedSearchParams.class);
  const savedFocusTeam = decodeFocusTeamCookie(
    cookieStore.get(focusTeamCookieName(classification))?.value,
  );
  const schoolOptions = await getHomeSchoolOptionsForClassification(classification);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const [bestPath, virtualMeet, latestVerifiedMeetDate] = await Promise.all([
    getHomeBestRankingPathForTeam(classification, focusTeam),
    getVirtualMeetForClassification(classification),
    getLatestVerifiedMeetDateForClassification(classification),
  ]);
  const primaryRankingHref = focusTeamHref(bestPath, focusTeam, classification);
  const scoringHref = focusTeamHref(
    "/virtual-state-meet",
    focusTeam,
    classification,
  );
  const nextActions = buildHomeNextActions(
    virtualMeet,
    focusTeam,
    classification,
  );
  const latestMeetLabel = latestVerifiedMeetDate
    ? formatMeetDate(latestVerifiedMeetDate)
    : "No marks";

  return (
    <div>
      <CoachCommandCard
        focusTeam={focusTeam}
        classification={classification}
        schoolOptions={schoolOptions}
        primaryRankingHref={primaryRankingHref}
        scoringHref={scoringHref}
        nextActions={nextActions}
        latestMeetLabel={latestMeetLabel}
      />

      <section className="mt-5 rounded-lg border border-[#d8e2ea] bg-white p-4 sm:p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-normal text-slate-950">
          <Medal size={20} className="text-[#16324f]" />
          Official State Qualifiers
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Download the official CHSAA state qualifying lists.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <a
            href="/qualifiers/3a_state_quals_2026.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="tap-row flex items-center justify-between rounded-lg border border-[#cbd8e3] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#0f8a5f] hover:bg-white hover:text-[#0f6f50]"
          >
            3A Qualifiers
            <ArrowRight size={16} />
          </a>
          <a
            href="/qualifiers/4a_state_quals_2026.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="tap-row flex items-center justify-between rounded-lg border border-[#cbd8e3] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#0f8a5f] hover:bg-white hover:text-[#0f6f50]"
          >
            4A Qualifiers
            <ArrowRight size={16} />
          </a>
          <a
            href="/qualifiers/5a_state_quals_2026.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="tap-row flex items-center justify-between rounded-lg border border-[#cbd8e3] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#0f8a5f] hover:bg-white hover:text-[#0f6f50]"
          >
            5A Qualifiers
            <ArrowRight size={16} />
          </a>
        </div>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-2">
        <Link
          href="/intel"
          prefetch={false}
          className="tap-row coach-surface group rounded-lg p-4 transition hover:border-[#9fb0bf] hover:bg-[#f8fafc]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#08233f] text-white">
            <Newspaper size={18} />
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-normal text-slate-950 group-hover:text-[#2f6f5e]">
            Build the public intel feed
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Turn rankings, cutlines, state scenarios, and distance culture into
            articles runners share and coaches trust.
          </p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0f6f50]">
            Open Distance Intel <ArrowRight size={15} />
          </span>
        </Link>

        <Link
          href="/coach-pro"
          prefetch={false}
          className="tap-row coach-surface group rounded-lg p-4 transition hover:border-[#9fb0bf] hover:bg-[#f8fafc]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#08724f] text-white">
            <BadgeDollarSign size={18} />
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-normal text-slate-950 group-hover:text-[#2f6f5e]">
            Package the coach subscription
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sell the decision layer: saved team context, weekly scouting briefs,
            score swings, and the next action before the meet.
          </p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0f6f50]">
            Open Coach Pro <ArrowRight size={15} />
          </span>
        </Link>
      </section>

      <Link
        href={focusTeamHref("/state-context", focusTeam, classification)}
        prefetch={false}
        className="coach-surface tap-row mt-5 flex min-h-24 items-center justify-between gap-4 p-4 transition hover:border-[#0f8a5f] hover:bg-[#f8fbfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16324f] sm:p-5"
      >
        <span className="flex min-w-0 gap-4">
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#eef4f2] text-[#08233f] sm:flex">
            <BarChart3 size={21} />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold tracking-normal text-slate-950">
              More state context
            </span>
            <span className="mt-1 block text-base leading-6 text-slate-600">
              Score bars, projected scoring events, and one-click Final 18
              checks for {focusTeam}.
            </span>
          </span>
        </span>
        <span className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
          Open <ArrowRight size={16} />
        </span>
      </Link>

      <Link
        href={focusTeamHref("/statistics", focusTeam, classification)}
        prefetch={false}
        className="tap-row mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#0f6f50]"
      >
        <SlidersHorizontal size={16} />
        Open deeper numbers
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}
