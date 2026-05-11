import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  Gauge,
  Medal,
  ShieldCheck,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AppPanel, AppPanelHeader } from "@/components/AppPrimitives";
import { CoachInterestForm } from "@/components/CoachInterestForm";
import { PageHeader } from "@/components/PageHeader";

type PremiumTool = {
  title: string;
  copy: string;
  href: string;
  icon: LucideIcon;
};

type NextStep = {
  title: string;
  copy: string;
  icon: LucideIcon;
};

const premiumTools: PremiumTool[] = [
  {
    title: "Pick team",
    copy: "Save a program and make every ranking, score, and brief team-aware.",
    href: "/",
    icon: Gauge,
  },
  {
    title: "Inspect bubble marks",
    copy: "Open the Final 18, see who is safe, and find the first mark that matters.",
    href: "/rankings",
    icon: Medal,
  },
  {
    title: "Test score swings",
    copy: "Change finishes and ranges to see how a state-score path opens or closes.",
    href: "/virtual-state-meet",
    icon: Trophy,
  },
  {
    title: "Plan the weekend",
    copy: "Turn entries, weather, heat estimates, and late meets into a coach action list.",
    href: "/weekend-plan",
    icon: CalendarDays,
  },
];

const packages = [
  {
    name: "Founder Coach",
    price: "$19/mo",
    detail: "Individual early access, direct product input, and weekly coach brief experiments.",
  },
  {
    name: "Team Season",
    price: "$135/season",
    detail: "One program, one saved dashboard, and a season-long scouting workspace.",
  },
  {
    name: "Local Sponsor",
    price: "Custom",
    detail: "Sponsored previews, ranking graphics, and state-week coverage blocks.",
  },
];

const weeklyDeliverables = [
  "Top-18 risk report for your saved team",
  "Team scoring what-if and reachable place targets",
  "Weekend entries brief with weather and heat context",
  "Regional/XC watchlist as the product expands beyond track",
];

const trustPoints: NextStep[] = [
  {
    title: "Founder access",
    copy: "Limited early access for coaches who want direct input and hands-on setup.",
    icon: Users,
  },
  {
    title: "Team-aware workflow",
    copy: "Every report starts from a saved school, division, and competitive context.",
    icon: ShieldCheck,
  },
  {
    title: "Coach-ready output",
    copy: "The goal is a weekly brief a coach can use before entries, regionals, or state.",
    icon: BarChart3,
  },
];

export default function CoachProPage() {
  const interestEmail =
    process.env.NEXT_PUBLIC_COACH_INTEREST_EMAIL ??
    "hello@coloradodistanceintel.com";

  return (
    <div>
      <PageHeader
        title="Coach Pro"
        description="The paid layer: pick a team, see the next actions, inspect bubble marks, test score swings, and turn public results into a coach-ready weekly brief."
        actions={
          <Link
            href="/intel"
            className="coach-action app-button-secondary inline-flex h-10 items-center gap-2 px-4 text-sm"
          >
            Public intel
            <ArrowRight size={15} />
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <AppPanel className="p-4 sm:p-5">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#08724f] text-white">
            <BadgeDollarSign size={18} />
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-normal text-slate-950">
            Sell interpretation, not raw results.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Results databases are the commodity layer. Coach Pro is the decision
            layer: what changed, what matters, who to watch, and which lineup or
            race choice is worth testing before the meet.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              ["Current value", "Track state week"],
              ["Paid promise", "Coach brief"],
              ["Next market", "XC season"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-[#d8e2ea] bg-[#f8fafc] p-3"
              >
                <div className="coach-kicker">{label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </AppPanel>

        <AppPanel>
          <AppPanelHeader
            label="What a coach gets"
            title="Concrete weekly deliverables"
            description="Pricing only works if the coach can picture the output. This is the founder version of the paid promise."
          />
          <div className="grid gap-3 p-4">
            {weeklyDeliverables.map((item, index) => (
              <div
                key={item}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-lg border border-[#d8e2ea] bg-[#f8fafc] p-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-sm font-semibold tabular-nums text-[#08233f]">
                  {index + 1}
                </span>
                <span className="text-sm leading-5 text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </AppPanel>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-4">
        {premiumTools.map((tool) => {
          const Icon = tool.icon;

          return (
            <Link
              key={tool.title}
              href={tool.href}
              className="tap-row coach-surface group rounded-lg p-4 transition hover:border-[#9fb0bf] hover:bg-[#f8fafc]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#08233f] text-white">
                <Icon size={18} />
              </div>
              <h2 className="mt-3 text-base font-semibold leading-5 text-slate-950 group-hover:text-[#2f6f5e]">
                {tool.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {tool.copy}
              </p>
            </Link>
          );
        })}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <CoachInterestForm recipient={interestEmail} />

        <AppPanel>
          <AppPanelHeader
            label="Access plans"
            title="Founder-access packages"
            description="Coach Pro is currently concierge access. Request access and we will confirm the right package before any payment."
          />
          <div className="grid gap-3 p-4">
            {packages.map((item) => (
              <div
                key={item.name}
                className="grid gap-3 rounded-lg border border-[#d8e2ea] bg-white p-3 sm:grid-cols-[9rem_minmax(0,1fr)]"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-950">
                    {item.name}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[#08724f]">
                    {item.price}
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </AppPanel>
      </section>

      <AppPanel className="mt-5">
        <AppPanelHeader
          label="Trust"
          title="Built around the way coaches already make meet decisions"
          description="The product is intentionally narrow: identify the marks that matter, test the team-score impact, and package the result into a practical weekly brief."
        />
        <div className="grid gap-3 p-4 md:grid-cols-3">
          {trustPoints.map((step) => {
            const Icon = step.icon;

            return (
              <div
                key={step.title}
                className="rounded-lg border border-[#d8e2ea] bg-[#f8fafc] p-4"
              >
                <Icon size={18} className="text-[#16324f]" />
                <h3 className="mt-3 text-sm font-semibold text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {step.copy}
                </p>
              </div>
            );
          })}
        </div>
      </AppPanel>
    </div>
  );
}
