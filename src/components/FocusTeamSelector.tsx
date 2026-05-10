"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, School } from "lucide-react";
import type { Classification } from "@/types/domain";
import { CLASSIFICATION_QUERY_PARAM } from "@/lib/utils/classificationScope";
import {
  FOCUS_TEAM_QUERY_PARAM,
  focusTeamCookieName,
  focusTeamStorageKey,
} from "@/lib/utils/focusTeam";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function writeFocusTeam(team: string, classification: Classification) {
  window.localStorage.setItem(focusTeamStorageKey(classification), team);
  document.cookie = `${focusTeamCookieName(classification)}=${encodeURIComponent(
    team,
  )}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent("focus-team-saved", {
      detail: { team, classification },
    }),
  );
}

export function FocusTeamSelector({
  schools,
  currentTeam,
  classification,
  label = "Focus school",
}: {
  schools: string[];
  currentTeam: string;
  classification: Classification;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [teamState, setTeamState] = useState({
    propTeam: currentTeam,
    draftTeam: currentTeam,
    savedTeam: currentTeam,
  });
  const normalizedTeamState =
    teamState.propTeam === currentTeam
      ? teamState
      : { propTeam: currentTeam, draftTeam: currentTeam, savedTeam: currentTeam };
  const { draftTeam, savedTeam } = normalizedTeamState;

  function saveTeam() {
    const teamToSave = draftTeam;
    writeFocusTeam(teamToSave, classification);
    setTeamState({
      propTeam: currentTeam,
      draftTeam: teamToSave,
      savedTeam: teamToSave,
    });

    const params = new URLSearchParams(window.location.search);
    const currentQueryTeam = params.get(FOCUS_TEAM_QUERY_PARAM);
    params.set(CLASSIFICATION_QUERY_PARAM, classification);
    params.set(FOCUS_TEAM_QUERY_PARAM, teamToSave);

    if (currentQueryTeam !== teamToSave) {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }

    router.refresh();
  }

  const dirty = draftTeam !== savedTeam;

  return (
    <div className="col-span-2 flex w-full flex-row items-center gap-2 rounded-xl border border-[#d8e2ea] bg-white p-2 shadow-sm sm:w-auto xl:col-span-1">
      <label className="inline-flex h-10 min-w-0 flex-1 items-center gap-2 px-2 text-sm font-semibold text-slate-700">
        <School size={16} className="shrink-0 text-[#0f2a47]" />
        <span className="hidden text-slate-500 sm:inline">{label}</span>
        <select
          aria-label={label}
          value={draftTeam}
          onChange={(event) =>
            setTeamState({
              ...normalizedTeamState,
              draftTeam: event.target.value,
            })
          }
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-950 outline-none sm:min-w-64"
        >
          {schools.map((school) => (
            <option key={school} value={school}>
              {school}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!dirty}
        onClick={saveTeam}
        className={`coach-action inline-flex min-w-[5.25rem] items-center justify-center gap-2 px-3 text-sm transition ${
          dirty
            ? "bg-[#102b47] text-white hover:bg-[#163a5d]"
            : "cursor-default bg-emerald-50 text-emerald-800"
        }`}
        aria-live="polite"
      >
        <Check size={15} />
        {dirty ? "Save" : "Saved"}
      </button>
    </div>
  );
}
