import type {
  EventSquadAthlete,
  EventSquadRankingResult,
  EventSquadRankingRow,
} from "@/types/domain";
import { shortSchoolName } from "@/lib/utils/focusTeam";

const brandName = "SquadMark CO";
const brandHandle = "@squadmarkco";

function classYear(grade: number | undefined) {
  return grade ? String(2038 - grade) : "";
}

function athleteName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;

  return `${parts[0]} ${parts.at(-1)}`;
}

function meetDate(date: string | undefined) {
  if (!date) return "";
  const [, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) ?? [];
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

function AthleteMarkRow({ athlete }: { athlete: EventSquadAthlete }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.8rem_4.6rem_3.8rem_minmax(0,1fr)] items-center gap-1.5 border-t border-white px-2 py-1.5 even:bg-[#ececec] odd:bg-white">
      <span className="min-w-0 truncate font-semibold text-[#172554]">
        {athleteName(athlete.athleteName)}
      </span>
      <span className="rounded-sm bg-[#ccecf4] px-1 text-center text-[11px] font-black text-[#0f2a47]">
        {classYear(athlete.grade) || "-"}
      </span>
      <span className="rounded-sm bg-[#ffd5b8] px-1 text-right font-black tabular-nums text-[#172554]">
        {athlete.markRaw}
      </span>
      <span className="text-right text-[11px] font-bold tabular-nums text-slate-700">
        {meetDate(athlete.meetDate)}
      </span>
      <span className="min-w-0 truncate text-[11px] font-medium italic text-slate-700">
        {athlete.meetName}
      </span>
    </div>
  );
}

function SquadRankingBlock({
  squad,
  focusTeam,
}: {
  squad: EventSquadRankingRow;
  focusTeam?: string;
}) {
  const focused = focusTeam === squad.school;
  const division = squad.athletes[0]?.classification ?? squad.classification;

  return (
    <article className={focused ? "ring-2 ring-[#16a34a] ring-offset-2" : ""}>
      <div className="grid grid-cols-[3.4rem_minmax(0,1fr)]">
        <div className="bg-[#6f2c91] px-2 py-2 text-center text-2xl font-black leading-none tabular-nums text-white">
          {squad.rank}
          <div className="mt-1 text-[10px] font-black uppercase text-white/85">
            {division}
          </div>
        </div>
        <div className="bg-[#173b67] px-3 py-2 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black leading-none tracking-normal">
                {shortSchoolName(squad.school)}
              </h3>
              <div className="mt-1 text-xs font-black italic text-white/80">
                average {squad.averageRaw}
              </div>
            </div>
            <div className="shrink-0 text-right text-base font-black tabular-nums">
              {squad.aggregateRaw}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_2.8rem_4.6rem_3.8rem_minmax(0,1fr)] gap-1.5 bg-[#dfe7ef] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
        <span>Athlete</span>
        <span className="text-center">Yr</span>
        <span className="text-right">Mark</span>
        <span className="text-right">Date</span>
        <span>Meet</span>
      </div>
      <div className="text-[11px]">
        {squad.athletes.map((athlete) => (
          <AthleteMarkRow key={`${squad.school}-${athlete.id}`} athlete={athlete} />
        ))}
      </div>
    </article>
  );
}

export function EventSquadGraphic({
  ranking,
  eventTitle,
  scopeLabel,
  focusTeam,
}: {
  ranking: EventSquadRankingResult;
  eventTitle: string;
  scopeLabel: string;
  focusTeam?: string;
}) {
  const topSquads = ranking.squads.slice(0, 4);
  return (
    <section className="app-panel">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="coach-kicker">Preview</div>
          <h2 className="mt-1 text-base font-semibold tracking-normal text-slate-950">
            Picture preview
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {ranking.gender} {eventTitle}, {scopeLabel}. Each team uses its
            four best verified marks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden rounded-lg bg-[#102b47] px-3 py-2 text-sm font-semibold text-white sm:block">
            {brandHandle}
          </div>
          <div className="hidden rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 sm:block">
            Best four combined
          </div>
        </div>
      </div>

      <div className="bg-[#edf3f8] p-3">
        <div className="mx-auto max-h-[30rem] max-w-[820px] overflow-auto rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="h-1 bg-[#223cff]" />
          <div className="mt-1 h-1 bg-[#ff1616]" />
          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-black italic text-slate-950">
                Colorado High School Outdoor Track &amp; Field
              </div>
              <h3 className="mt-1 text-2xl font-black leading-none tracking-normal text-slate-950">
                #EventSquad Rankings
              </h3>
            </div>
            <div className="rounded-sm border border-slate-200 px-3 py-2 text-right text-sm font-black italic text-[#d42f55]">
              Athletic-style
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 border-4 border-[#6f2c91] px-3 py-1 text-xs font-black sm:text-sm">
            <span>
              {ranking.gender} {eventTitle} — {scopeLabel}
            </span>
            <span className="text-xs font-bold text-[#172554]">
              {ranking.eligibleAthleteCount} eligible marks
            </span>
          </div>

          <div className="mt-3 max-w-3xl space-y-2.5">
            {topSquads.length ? (
              topSquads.map((squad) => (
                <SquadRankingBlock
                  key={squad.school}
                  squad={squad}
                  focusTeam={focusTeam}
                />
              ))
            ) : (
              <div className="border border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                No school has four eligible marks for this image yet.
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between border-t border-slate-300 pt-2 text-xs font-black text-slate-950">
            <span>State list</span>
            <span>{brandName}</span>
            <span>Best four combined</span>
          </div>
        </div>
      </div>
    </section>
  );
}
