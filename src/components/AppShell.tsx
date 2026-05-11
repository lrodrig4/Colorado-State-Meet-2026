"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BadgeDollarSign,
  CalendarDays,
  Gauge,
  Menu,
  Medal,
  MoreHorizontal,
  Newspaper,
  RefreshCw,
  Trophy,
  Upload,
  Users,
  X,
  type LucideIcon,
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

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/", label: "Command", shortLabel: "Command", icon: Gauge },
  {
    href: "/rankings",
    label: "Final 18 Rankings",
    shortLabel: "Ranks",
    icon: Medal,
  },
  {
    href: "/event-squads",
    label: "Top 4 Graphics",
    shortLabel: "Picture",
    icon: Users,
  },
  {
    href: "/virtual-state-meet",
    label: "State Scenarios",
    shortLabel: "Scores",
    icon: Trophy,
  },
];

const planningItems: NavItem[] = [
  {
    href: "/statistics",
    label: "Statistics",
    shortLabel: "Stats",
    icon: BarChart3,
  },
  {
    href: "/weekend-plan",
    label: "Weekend Plan",
    shortLabel: "Weekend",
    icon: CalendarDays,
  },
  { href: "/meets", label: "Meet List", shortLabel: "Meets", icon: CalendarDays },
  { href: "/meets/import", label: "Add Results", shortLabel: "Add", icon: Upload },
];

const growthItems: NavItem[] = [
  {
    href: "/intel",
    label: "Intel Feed",
    shortLabel: "Intel",
    icon: Newspaper,
  },
  {
    href: "/coach-pro",
    label: "Coach Pro",
    shortLabel: "Pro",
    icon: BadgeDollarSign,
  },
];

const allNavItems = [...navItems, ...planningItems, ...growthItems];

function LinkPendingIndicator() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={`app-link-pending ${pending ? "is-pending" : ""}`}
    />
  );
}

function persistFocusTeam(
  team: string,
  classification: typeof DEFAULT_CLASSIFICATION,
) {
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const currentClassification = resolveClassification(
        params.get(CLASSIFICATION_QUERY_PARAM) ?? undefined,
      );
      setClassification(currentClassification);
      const teamFromUrl = params.get(FOCUS_TEAM_QUERY_PARAM);
      const teamFromStorage = window.localStorage.getItem(
        focusTeamStorageKey(currentClassification),
      );

      if (teamFromUrl) {
        persistFocusTeam(teamFromUrl, currentClassification);
        setFocusTeam(teamFromUrl);
        return;
      }

      if (teamFromStorage) {
        params.set(FOCUS_TEAM_QUERY_PARAM, teamFromStorage);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        setFocusTeam(teamFromStorage);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
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
    return () =>
      window.removeEventListener("focus-team-saved", handleFocusTeamSaved);
  }, [classification]);

  const navHref = (href: string) =>
    focusTeam
      ? focusTeamHref(href, focusTeam, classification)
      : withClassificationHref(href, classification);
  const activeItem =
    allNavItems.find((item) => isNavActive(pathname, item.href)) ?? navItems[0];

  const renderDesktopNav = (items: NavItem[], label: string) => (
    <div className="space-y-1">
      <div className="coach-kicker px-3 pb-2 text-slate-400">{label}</div>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isNavActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={navHref(item.href)}
            prefetch={false}
            className={`tap-row relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
              active
                ? "bg-white text-[#06172a] shadow-sm"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {active ? (
              <span className="absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400" />
            ) : null}
            <Icon size={17} strokeWidth={2.2} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <LinkPendingIndicator />
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-dvh overflow-x-hidden text-slate-950">
      <aside className="coach-rail fixed inset-y-0 left-0 z-40 hidden w-[15.5rem] border-r border-[#0c2743] lg:block">
        <div className="flex h-[4.75rem] items-center gap-3 border-b border-white/10 px-5">
          <QualifierLogo className="size-9 shrink-0" />
          <div>
            <div className="text-sm font-semibold leading-5 text-white">
              Distance Intel
            </div>
            <div className="text-xs font-semibold text-emerald-300">
              Colorado {classification}
            </div>
          </div>
        </div>
        <nav className="space-y-5 px-3 py-4">
          {renderDesktopNav(navItems, "Command")}
          {renderDesktopNav(planningItems, "Operations")}
          {renderDesktopNav(growthItems, "Public Growth")}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-300">
            <div className="text-slate-400">Team</div>
            <div className="font-semibold text-white">
              {focusTeam ?? `CHSAA ${classification}`}
            </div>
            <div className="mt-1 text-emerald-300">Coach workspace</div>
          </div>
        </div>
      </aside>

      <header className="fixed left-[15.5rem] right-0 top-0 z-30 hidden h-[4.75rem] items-center justify-between border-b border-[#d8e2ea] bg-white/95 px-6 backdrop-blur lg:flex">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            Team
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-950">
            {focusTeam
              ? `${focusTeam} - CHSAA ${classification}`
              : `CHSAA ${classification}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8e2ea] bg-[#f8fafc] px-3 text-sm font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Distance intelligence workspace
          </div>
          <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8e2ea] bg-white px-3 text-sm font-semibold text-slate-700">
            <span className="text-slate-500">Year</span>
            <span>2026 state season</span>
            <RefreshCw size={15} className="text-[#16324f]" />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8e2ea] bg-white text-sm font-semibold text-[#0d2742]">
            CO
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-30 border-b border-[#d8e2ea] bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-3">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileMenuOpen(true)}
            className="tap-row inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8e2ea] bg-white text-[#0d2742]"
          >
            <Menu size={19} />
          </button>
          <Link
            href={navHref("/")}
            prefetch={false}
            className="tap-row flex min-w-0 flex-1 items-center gap-2.5 rounded-lg pr-2 text-sm font-semibold"
          >
            <QualifierLogo className="size-8 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-[0.9rem] leading-5 text-[#08111f]">
                {activeItem.label}
              </span>
              <span className="block truncate text-[0.72rem] font-medium leading-4 text-slate-500">
                Distance Intel
              </span>
            </span>
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8e2ea] bg-white text-sm font-semibold text-[#0d2742]">
            CO
          </div>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 lg:hidden">
          <div className="coach-rail h-full w-[18rem] max-w-[86vw] border-r border-white/10 p-3 shadow-2xl">
            <div className="flex h-14 items-center justify-between gap-3 border-b border-white/10 px-2">
              <div className="flex items-center gap-3">
                <QualifierLogo className="size-9 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-white">
                    Distance Intel
                  </div>
                  <div className="text-xs font-semibold text-emerald-300">
                    Colorado {classification}
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="space-y-5 py-4">
              {[
                ["Command", navItems] as const,
                ["Operations", planningItems] as const,
                ["Public Growth", growthItems] as const,
              ].map(([label, items]) => (
                <div key={label} className="space-y-1">
                  <div className="coach-kicker px-3 pb-2 text-slate-400">
                    {label}
                  </div>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={navHref(item.href)}
                        prefetch={false}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`tap-row flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
                          active
                            ? "bg-white text-[#06172a]"
                            : "text-slate-300"
                        }`}
                      >
                        <Icon size={17} />
                        <span className="flex-1">{item.label}</span>
                        <LinkPendingIndicator />
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <main className="overflow-x-hidden pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-[15.5rem] lg:pt-[4.75rem]">
        <div className="mx-auto w-full max-w-[1440px] px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
          {children}
        </div>
      </main>

      <nav className="app-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-[#d8e2ea] bg-white/95 px-2 pt-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={navHref(item.href)}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`tap-row flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[0.66rem] font-semibold leading-none transition ${
                  active
                    ? "bg-[#08233f] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={17} strokeWidth={active ? 2.5 : 2.1} />
                <span className="truncate">{item.shortLabel}</span>
                <LinkPendingIndicator />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="tap-row flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[0.66rem] font-semibold leading-none text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <MoreHorizontal size={17} strokeWidth={2.1} />
            <span>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
