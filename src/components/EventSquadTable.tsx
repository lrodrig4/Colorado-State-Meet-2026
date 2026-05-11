import type {
  EventSquadIncompleteRow,
  EventSquadRankingRow,
} from "@/types/domain";
import { shortSchoolName } from "@/lib/utils/focusTeam";

function athleteList(squad: EventSquadRankingRow) {
  return squad.athletes
    .map(
      (athlete) =>
        `${athlete.athleteName} (${athlete.rank}, ${athlete.markRaw}${
          athlete.classification ? `, ${athlete.classification}` : ""
        })`,
    )
    .join(", ");
}

export function EventSquadTable({
  squads,
  incompleteSquads,
  focusTeam,
}: {
  squads: EventSquadRankingRow[];
  incompleteSquads: EventSquadIncompleteRow[];
  focusTeam?: string;
}) {
  return (
    <section className="app-panel">
      <div className="border-b border-slate-200 p-4">
        <div className="coach-kicker">All teams</div>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          All team rankings
        </h2>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {squads.map((squad) => {
          const focused = squad.school === focusTeam;

          return (
            <article
              key={squad.school}
              className={`rounded-lg border p-3 shadow-sm ${
                focused ? "border-[#2f6f5e] bg-emerald-50/50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-normal text-slate-500">
                    Rank {squad.rank}
                  </div>
                  <h3 className="mt-1 break-words text-base font-semibold text-slate-950">
                    {shortSchoolName(squad.school)}
                  </h3>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {squad.athletes[0]?.classification ?? "Unknown"} division
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black tabular-nums text-slate-950">
                    {squad.averageRaw}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    {squad.aggregateRaw} total
                  </div>
                </div>
              </div>
              <div className="mt-3 divide-y divide-slate-100 rounded-lg bg-white">
                {squad.athletes.map((athlete) => (
                  <div
                    key={athlete.id}
                    className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 px-3 py-2 text-sm"
                  >
                    <span className="font-black tabular-nums text-slate-500">
                      #{athlete.rank}
                    </span>
                    <span className="min-w-0 truncate font-medium text-slate-800">
                      {athlete.athleteName}
                    </span>
                    <span className="font-black tabular-nums text-slate-950">
                      {athlete.markRaw}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden lg:block">
        <table className="app-data-table table-fixed">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[18%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[45%]" />
          </colgroup>
          <thead>
            <tr>
              <th>Rank</th>
              <th>School</th>
              <th>Class</th>
              <th>Average</th>
              <th>Total</th>
              <th>Best four</th>
            </tr>
          </thead>
          <tbody>
            {squads.map((squad) => {
              const focused = squad.school === focusTeam;

              return (
                <tr
                  key={squad.school}
                  className={`border-t border-slate-100 ${
                    focused ? "bg-emerald-50/70" : "bg-white"
                  }`}
                >
                  <td className="font-black tabular-nums text-slate-950">
                    {squad.rank}
                  </td>
                  <td className="break-words">
                    <div className="font-semibold text-slate-950">
                      {shortSchoolName(squad.school)}
                    </div>
                    {focused ? (
                      <div className="text-xs font-semibold text-[#2f6f5e]">
                        Saved team
                      </div>
                    ) : null}
                  </td>
                  <td className="font-semibold text-slate-600">
                    {squad.athletes[0]?.classification ?? "-"}
                  </td>
                  <td className="font-black tabular-nums text-slate-950">
                    {squad.averageRaw}
                  </td>
                  <td className="font-semibold tabular-nums text-slate-700">
                    {squad.aggregateRaw}
                  </td>
                  <td className="break-words text-slate-700">
                    {athleteList(squad)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {incompleteSquads.length ? (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-black uppercase tracking-normal text-slate-500">
            Almost enough marks
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {incompleteSquads.slice(0, 12).map((row) => (
              <div
                key={row.school}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm"
              >
                <span className="font-semibold text-slate-950">
                  {shortSchoolName(row.school)}
                </span>{" "}
                <span className="text-slate-500">
                  {row.athleteCount}/4 marks
                  {row.bestAthlete ? `, best ${row.bestAthlete.markRaw}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
