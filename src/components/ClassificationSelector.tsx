"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layers3, Lock } from "lucide-react";
import type { Classification } from "@/types/domain";
import {
  CLASSIFICATION_QUERY_PARAM,
  LOCK_CLASSIFICATION,
} from "@/lib/utils/classificationScope";
import { FOCUS_TEAM_QUERY_PARAM } from "@/lib/utils/focusTeam";

const classificationOptions: Classification[] = ["3A", "4A", "5A"];

export function ClassificationSelector({
  currentClassification,
}: {
  currentClassification: Classification;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingClassification, setPendingClassification] =
    useState<Classification | null>(null);
  const visibleClassification = pendingClassification ?? currentClassification;

  useEffect(() => {
    const timeout = window.setTimeout(() => setPendingClassification(null), 0);
    return () => window.clearTimeout(timeout);
  }, [currentClassification]);

  function updateClassification(classification: Classification) {
    if (classification === visibleClassification) return;

    const params = new URLSearchParams(window.location.search);
    params.set(CLASSIFICATION_QUERY_PARAM, classification);
    params.delete(FOCUS_TEAM_QUERY_PARAM);
    setPendingClassification(classification);
    window.dispatchEvent(
      new CustomEvent("classification-changed", { detail: classification }),
    );
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  if (LOCK_CLASSIFICATION) {
    return (
      <div className="col-span-2 inline-flex h-11 w-full items-center gap-2 rounded-lg border border-[#d8e2ea] bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm sm:w-auto xl:col-span-1">
        <Layers3 size={16} className="shrink-0 text-[#0f2a47]" />
        <span className="text-slate-500">Division</span>
        <span className="text-slate-950">{currentClassification}</span>
        <Lock size={14} className="text-slate-400" />
      </div>
    );
  }

  return (
    <div
      className="col-span-2 flex w-full flex-row items-center gap-2 rounded-lg border border-[#d8e2ea] bg-white p-1.5 shadow-sm sm:w-auto xl:col-span-1"
      aria-label="Division switcher"
      aria-busy={isPending}
    >
      <div className="hidden shrink-0 items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-normal text-slate-500 sm:flex">
        <Layers3 size={14} className="text-[#0f2a47]" />
        Division
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-3 rounded-md bg-[#eef4f2] p-1">
        {classificationOptions.map((classification) => {
          const active = visibleClassification === classification;

          return (
            <button
              key={classification}
              type="button"
              aria-pressed={active}
              onClick={() => updateClassification(classification)}
              className={`h-9 rounded-md px-3 text-sm font-semibold transition ${
                active
                  ? "bg-[#08233f] text-white shadow-sm"
                  : "text-slate-700 hover:bg-white/70"
              } ${isPending && active ? "ring-2 ring-emerald-300/60" : ""}`}
            >
              {classification}
            </button>
          );
        })}
      </div>
    </div>
  );
}
