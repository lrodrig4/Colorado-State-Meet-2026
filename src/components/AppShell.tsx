"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  GitBranch,
  Gauge,
  Medal,
  PlusCircle,
  Search,
  Trophy,
} from "lucide-react";
import { QualifierLogo } from "@/components/CoachVisuals";
import {
  focusTeamHref,
  FOCUS_TEAM_QUERY_PARAM,
  focusTeamCookieName,
  focusTeamStorageKey,
} from "@/lib/utils/focusTeam";
import {
  CLASSIFICATION_QUERY_PARAM,
  DEFAULT_CLASSIFICATION,
  resolveClassification,
  withClassificationHref,
} from "@/lib/utils/classificationScope";

const navItems = [
  { href: "/", label: "Command", shortLabel: "Command", icon: Gauge },
  { href: "/rankings", label: "Top 18 Cutoff Board", shortLabel: "Cutoffs", icon: Medal },
  { href: "/weekend-plan", label: "St. Vrain Entries", shortLabel: "Entries", icon: GitBranch },
  { href: "/virtual-state-meet", label: "State Scenarios", shortLabel: "Scores", icon: Trophy },
  { href: "/meets", label: "Meets", shortLabel: "Meets", icon: Search },
  { href: "/meets/import", label: "Import", shortLabel: "Import", icon: PlusCircle },
];

function persistFocusTeam(team: string, classification: typeof DEFAULT_CLASSIFICATION) {
  window.localStorage.setItem(focusTeamStorageKey(classification), team);
  document.cookie = `${focusTeamCookieName(classification)}=${encodeURIComponent(
    team,
  )}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/meets") return pathname === "/meets";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [focusTeam, setFocusTeam] = useState<string | undefined>();
  const [classification, setClassification] = useState(DEFAULT_CLASSIFICATION);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentClassification = resolveClassification(
      params.get(CLASSIFICATION_QUERY_PARAM) ?? undefined,
    );
    window.setTimeout(
      () =>
        setClassification(currentClassification),
      0,
    );
    const teamFromUrl = params.get(FOCUS_TEAM_QUERY_PARAM);
    const teamFromStorage = window.localStorage.getItem(
      focusTeamStorageKey(currentClassification),
    );

    if (teamFromUrl) {
      persistFocusTeam(teamFromUrl, currentClassification);
      window.setTimeout(() => setFocusTeam(teamFromUrl), 0);
      return;
    }

    if (teamFromStorage) {
      params.set(FOCUS_TEAM_QUERY_PARAM, teamFromStorage);
      router.replace(`${pathname}?${params.toString()}`);
      window.setTimeout(() => setFocusTeam(teamFromStorage), 0);
    }
  }, [pathname, router]);

  useEffect(() => {
    function readClassificationFromLocation() {
      const params = new URLSearchParams(window.location.search);
      setClassification(
        resolveClassification(
          params.get(CLASSIFICATION_QUERY_PARAM) ?? undefined,
        ),
      );
    }

    function handleClassificationChanged(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      const nextClassification = resolveClassification(detail);
      setClassification(nextClassification);
      setFocusTeam(
        window.localStorage.getItem(focusTeamStorageKey(nextClassification)) ??
          undefined,
      );
    }

    window.addEventListener("popstate", readClassificationFromLocation);
    window.addEventListener(
      "classification-changed",
      handleClassificationChanged,
    );

    return () => {
      window.removeEventListener("popstate", readClassificationFromLocation);
      window.removeEventListener(
        "classification-changed",
        handleClassificationChanged,
      );
    };
  }, []);

  useEffect(() => {
    function handleFocusTeamSaved(event: Event) {
      const detail = (
        event as CustomEvent<{
          team?: string;
          classification?: typeof DEFAULT_CLASSIFICATION;
        }>
      ).detail;
      if (detail?.team && detail.classification === classification) {
        setFocusTeam(detail.team);
      }
    }

    window.addEventListener("focus-team-saved", handleFocusTeamSaved);
    return () => window.removeEventListener("focus-team-saved", handleFocusTeamSaved);
  }, [classification]);

  const navHref = (href: string) =>
    focusTeam
      ? focusTeamHref(href, focusTeam, classification)
      : withClassificationHref(href, classification);

  return (
    <div className="min-h-dvh overflow-x-hidden text-slate-950">
      <aside className="coach-rail fixed inset-y-0 left-0 z-20 hidden w-[16rem] border-r border-[#d8e2ea] lg:block">
        <div className="flex h-20 items-center gap-3 border-b border-[#d8e2ea] px-5">
          <QualifierLogo className="size-9 shrink-0" />
          <div>
            <div className="text-sm font-semibold leading-5 text-[#0b1726]">
              Colorado {classification}
            </div>
            <div className="text-xs font-medium text-slate-500">
              Top 18 Command
            </div>
          </div>
        </div>
        <nav className="space-y-1.5 px-3 py-4">
          <div className="coach-kicker px-3 pb-2">
            Coach workflow
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={navHref(item.href)}
                prefetch={false}
                className={`tap-row flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
                  active
                    ? "bg-[#102b47] text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm"
                }`}
              >
                <Icon size={17} strokeWidth={2.2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4">
          <div className="rounded-xl border border-[#d8e2ea] bg-white/90 p-3 text-xs leading-5 text-slate-600 shadow-sm">
            <div className="font-semibold text-slate-950">Current scope</div>
            2026 outdoor, CHSAA {classification}, public-source marks,
            state-weekend scoring.
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-[#d8e2ea] bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link
            href={navHref("/")}
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <QualifierLogo className="size-7" />
            <span>{classification} Top 18</span>
          </Link>
          <div className="rounded-full bg-[#eef4f2] px-2.5 py-1.5 text-xs font-semibold text-[#2f6f5e]">
            {classification}
          </div>
        </div>
        <nav className="hide-scrollbar flex gap-1 overflow-x-auto border-t border-[#d8e2ea] px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={navHref(item.href)}
                prefetch={false}
                className={`tap-row flex min-w-[4.7rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold leading-none ${
                  active ? "bg-[#102b47] text-white shadow-sm" : "bg-white text-slate-600"
                }`}
              >
                <Icon size={15} />
                {item.shortLabel}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="overflow-x-hidden lg:pl-[16rem]">
        <div className="mx-auto w-full max-w-[1440px] px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
